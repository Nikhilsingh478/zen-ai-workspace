/**
 * useVoiceAssistant — stable, long-running passive wake-word assistant.
 *
 * State machine:
 *   idle       → passive    (enabled, mic granted, listening for wake word)
 *   passive    → active     (wake word detected)
 *   active     → processing (silence confirmed + at least one final chunk received)
 *   processing → speaking   (response ready, voiceResponses=true)
 *   speaking   → passive    (utterance ends)
 *   any        → idle       (disabled)
 *   any        → error      (permission denied / unsupported)
 *
 * Wake-word stability:
 *   - ONE persistent SpeechRecognition instance — created once, reused via .start().
 *   - isListeningRef/isStartingRef/manuallyStopped prevent duplicate .start() calls.
 *   - onend auto-recovers after 1s if not manually stopped.
 *   - visibilitychange recovers listening when tab regains focus.
 *   - MIN_RESTART_MS cooldown prevents mobile restart storms.
 *   - Fuzzy wake-word matching: "hey jarvis", "he jarvis", "hi jarvis", "jarvis", etc.
 *   - Rolling 200-char passive buffer preserves context across interim chunks.
 *
 * Transcript robustness:
 *   - Silence timer (SILENCE_MS) only fires after at least one final chunk landed.
 *   - After a final chunk, the silence window extends to SILENCE_AFTER_FINAL_MS.
 *   - Interim results update the display but never trigger processing alone.
 *   - transcriptBufferRef accumulates only isFinal segments — never overwritten by interim.
 *   - interimRef holds the current live interim — joined to buffer for display only.
 *   - Max command window (MAX_CMD_MS) submits whatever is buffered if still active.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { getVoiceSettings, subscribeVoiceSettings } from "@/lib/voice-settings";
import { executeVoiceCommand, stripWakeWord } from "@/lib/voice-commander";
import { useHorizon } from "@/lib/horizon";

// ─── Browser compat ────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const win = typeof window !== "undefined" ? (window as any) : undefined;
const SpeechRecognitionCtor: (new () => any) | undefined =
  win?.SpeechRecognition ?? win?.webkitSpeechRecognition;

export const isVoiceAssistantSupported = Boolean(SpeechRecognitionCtor);

// ─── Timing constants ──────────────────────────────────────────────────────────

/** Silence window when NO final chunk yet received — generous, user still forming sentence */
const SILENCE_MS = 5000;
/** Silence window AFTER a final chunk — wait this long for any continuation */
const SILENCE_AFTER_FINAL_MS = 4500;
/** Max active listening window before force-submitting */
const MAX_CMD_MS = 25000;
/** Minimum ms between recognition .start() calls */
const MIN_RESTART_MS = 1200;

// ─── Types ─────────────────────────────────────────────────────────────────────

export type AssistantState =
  | "idle"
  | "passive"
  | "active"
  | "processing"
  | "speaking"
  | "error";

export type PermissionStatus = "unknown" | "granted" | "denied" | "unsupported";

export interface VoiceAssistantHandle {
  state: AssistantState;
  permission: PermissionStatus;
  transcript: string;
  lastResponse: string;
  enable: () => Promise<void>;
  disable: () => void;
  dismiss: () => void;
}

// ─── Wake-word fuzzy matching ──────────────────────────────────────────────────

const WAKE_PHRASES = [
  "hey jarvis", "he jarvis", "hi jarvis", "hay jarvis",
  "a jarvis", "ok jarvis", "okay jarvis",
  "jarvis",
];

function normalizeText(text: string): string {
  return text.toLowerCase().replace(/[^\w\s]/g, "").replace(/\s+/g, " ").trim();
}

function containsWakePhrase(text: string, configuredWakeWord: string): boolean {
  const n = normalizeText(text);
  const cwn = normalizeText(configuredWakeWord);
  return [...WAKE_PHRASES, cwn].some((p) => n.includes(p));
}

// ─── SpeechSynthesis helper ────────────────────────────────────────────────────

function speak(text: string, onEnd?: () => void) {
  if (!("speechSynthesis" in window)) { onEnd?.(); return; }
  window.speechSynthesis.cancel();
  const utt = new SpeechSynthesisUtterance(text);
  utt.rate = 1.0; utt.pitch = 1.0; utt.volume = 1.0; utt.lang = "en-US";
  const pref = window.speechSynthesis.getVoices().find(
    (v) => v.lang.startsWith("en") &&
      (v.name.includes("Google") || v.name.includes("Natural") || v.name.includes("Samantha")),
  );
  if (pref) utt.voice = pref;
  utt.onend = () => onEnd?.();
  utt.onerror = () => onEnd?.();
  window.speechSynthesis.speak(utt);
}

// ─── Hook ──────────────────────────────────────────────────────────────────────

export function useVoiceAssistant(): VoiceAssistantHandle {
  const [state, setState] = useState<AssistantState>("idle");
  const [permission, setPermission] = useState<PermissionStatus>("unknown");
  const [transcript, setTranscript] = useState("");
  const [lastResponse, setLastResponse] = useState("");

  // ── Core refs ────────────────────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recRef = useRef<any>(null);            // single persistent SpeechRecognition
  const stateRef = useRef<AssistantState>("idle");
  const mountedRef = useRef(true);

  // ── Restart guards ────────────────────────────────────────────────────────
  const isListeningRef = useRef(false);        // true while rec is active
  const isStartingRef = useRef(false);         // true while .start() is in flight
  const manuallyStopped = useRef(false);       // intentional stop — skip recovery
  const lastRestartTimeRef = useRef(0);
  const restartTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // ── Command timing ────────────────────────────────────────────────────────
  const commandMaxTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // ── Transcript state ──────────────────────────────────────────────────────
  /** Accumulated isFinal segments — the source of truth for commands */
  const transcriptBufferRef = useRef("");
  /** Current live interim chunk — display only, never submitted */
  const interimRef = useRef("");
  /** Whether at least one isFinal chunk has landed in active mode */
  const hasFinalRef = useRef(false);
  /** Rolling buffer for passive mode wake-word detection */
  const passiveRollingRef = useRef("");

  // ── Settings + tasks ──────────────────────────────────────────────────────
  const settingsRef = useRef(getVoiceSettings());
  const { tasks } = useHorizon();
  const tasksRef = useRef(tasks);
  useEffect(() => { tasksRef.current = tasks; }, [tasks]);
  useEffect(() => {
    const unsub = subscribeVoiceSettings(() => { settingsRef.current = getVoiceSettings(); });
    return () => { unsub(); };
  }, []);

  // ── State sync ────────────────────────────────────────────────────────────
  const setStateSync = useCallback((s: AssistantState) => {
    stateRef.current = s;
    if (mountedRef.current) setState(s);
  }, []);

  // ── Clear active-command state ────────────────────────────────────────────
  const clearActiveState = useCallback(() => {
    clearTimeout(silenceTimerRef.current);
    clearTimeout(commandMaxTimerRef.current);
    transcriptBufferRef.current = "";
    interimRef.current = "";
    hasFinalRef.current = false;
    passiveRollingRef.current = "";
    if (mountedRef.current) setTranscript("");
  }, []);

  // ── Command handler ref (fwd-declared) ───────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleCommandRef = useRef<(cmd: string) => Promise<void>>(null as any);

  // ── Submit accumulated command ────────────────────────────────────────────
  /**
   * Called once we're confident the user has finished speaking.
   * Always submits transcriptBufferRef — the finalized segments only.
   * Falls back to the last interim if no finals were received (edge case).
   */
  const submitCommand = useCallback(() => {
    if (stateRef.current !== "active" || !mountedRef.current) return;
    clearTimeout(silenceTimerRef.current);
    clearTimeout(commandMaxTimerRef.current);

    const finalText = transcriptBufferRef.current.trim();
    const fallback = interimRef.current.trim();
    const cmd = finalText || fallback;

    console.log("[jarvis] final transcript:", cmd || "(empty)");
    console.log("[jarvis] has final chunks:", hasFinalRef.current, "| buffer:", JSON.stringify(finalText), "| interim fallback:", JSON.stringify(fallback));

    if (cmd.length > 1) {
      handleCommandRef.current?.(cmd);
    } else {
      console.log("[jarvis] transcript too short — returning to passive");
      setStateSync("passive");
      clearActiveState();
    }
  }, [setStateSync, clearActiveState]);

  // ── Arm/reset the silence timer ───────────────────────────────────────────
  /**
   * Called on every speech event (interim or final).
   * Uses a longer window once a final chunk has landed,
   * preventing premature submission during mid-sentence pauses.
   */
  const resetSilenceTimer = useCallback(() => {
    clearTimeout(silenceTimerRef.current);
    const delay = hasFinalRef.current ? SILENCE_AFTER_FINAL_MS : SILENCE_MS;
    silenceTimerRef.current = setTimeout(() => {
      if (stateRef.current === "active" && mountedRef.current) {
        console.log("[jarvis] silence timeout fired | hasFinal:", hasFinalRef.current);
        submitCommand();
      }
    }, delay);
  }, [submitCommand]);

  // ── Attempt to (re-)start the persistent recognition instance ─────────────
  const attemptStart = useCallback(() => {
    if (!recRef.current || !mountedRef.current) return;
    if (manuallyStopped.current) { console.log("[jarvis] restart prevented — manually stopped"); return; }
    if (isListeningRef.current) { console.log("[jarvis] restart prevented — already listening"); return; }
    if (isStartingRef.current) { console.log("[jarvis] restart prevented — start in flight"); return; }

    const elapsed = Date.now() - lastRestartTimeRef.current;
    if (elapsed < MIN_RESTART_MS) {
      const delay = MIN_RESTART_MS - elapsed + 80;
      console.log(`[jarvis] restart scheduled in ${delay}ms (cooldown)`);
      clearTimeout(restartTimerRef.current);
      restartTimerRef.current = setTimeout(attemptStart, delay);
      return;
    }

    isStartingRef.current = true;
    lastRestartTimeRef.current = Date.now();
    console.log("[jarvis] recognition starting");
    try {
      recRef.current.start();
    } catch (err) {
      isStartingRef.current = false;
      console.warn("[jarvis] .start() threw:", err);
      if (!manuallyStopped.current && mountedRef.current) {
        restartTimerRef.current = setTimeout(attemptStart, 1500);
      }
    }
  }, []);

  // ── Schedule a recovery restart ───────────────────────────────────────────
  const scheduleRestart = useCallback((delayMs = 1000) => {
    if (manuallyStopped.current || !mountedRef.current) return;
    clearTimeout(restartTimerRef.current);
    restartTimerRef.current = setTimeout(() => {
      const s = stateRef.current;
      if ((s === "passive" || s === "active") && mountedRef.current && !manuallyStopped.current) {
        console.log("[jarvis] passive recovery triggered");
        attemptStart();
      }
    }, delayMs);
  }, [attemptStart]);

  // ── Build the ONE persistent SpeechRecognition instance ───────────────────
  const initRecognition = useCallback(() => {
    if (!SpeechRecognitionCtor || recRef.current) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rec = new SpeechRecognitionCtor() as any;
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = "en-US";
    rec.maxAlternatives = 1;
    recRef.current = rec;

    // ── onstart ───────────────────────────────────────────────────────
    rec.onstart = () => {
      isStartingRef.current = false;
      isListeningRef.current = true;
      passiveRollingRef.current = "";
      if (!mountedRef.current) return;
      if (stateRef.current === "idle") setStateSync("passive");
      console.log("[jarvis] recognition started | state:", stateRef.current);
    };

    // ── onresult ──────────────────────────────────────────────────────
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rec.onresult = (event: any) => {
      if (!mountedRef.current) return;

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const text: string = (result[0].transcript as string).trim();
        const isFinal: boolean = result.isFinal;

        console.log(`[jarvis] transcript chunk [${isFinal ? "FINAL" : "interim"}]: "${text}"`);

        // ── PASSIVE: detect wake phrase ────────────────────────────────
        if (stateRef.current === "passive") {
          // Accumulate rolling context — preserves phrase across interim chunks
          passiveRollingRef.current = (passiveRollingRef.current + " " + text).trim().slice(-220);

          const ww = settingsRef.current.wakeWord;
          if (containsWakePhrase(passiveRollingRef.current, ww)) {
            console.log("[jarvis] wake phrase detected in:", passiveRollingRef.current);
            passiveRollingRef.current = "";
            clearActiveState();
            setStateSync("active");

            // Inline command: wake + command spoken in a single final utterance
            if (isFinal) {
              const inlineCmd = stripWakeWord(text, ww).trim();
              if (inlineCmd.length > 2) {
                console.log("[jarvis] inline command detected:", inlineCmd);
                transcriptBufferRef.current = inlineCmd;
                hasFinalRef.current = true;
                if (mountedRef.current) setTranscript(inlineCmd);
                resetSilenceTimer();
                // Also set max window
                clearTimeout(commandMaxTimerRef.current);
                commandMaxTimerRef.current = setTimeout(() => {
                  if (stateRef.current === "active" && mountedRef.current) submitCommand();
                }, MAX_CMD_MS);
                return;
              }
            }

            // No inline command — set max window, wait for user to speak
            clearTimeout(commandMaxTimerRef.current);
            commandMaxTimerRef.current = setTimeout(() => {
              if (stateRef.current === "active" && mountedRef.current) {
                console.log("[jarvis] max command window expired");
                submitCommand();
              }
            }, MAX_CMD_MS);

            // Arm initial silence timer — user may still be speaking
            resetSilenceTimer();
          }
          return;
        }

        // ── ACTIVE: accumulate command transcript ──────────────────────
        if (stateRef.current === "active") {
          if (isFinal) {
            // Strip any wake-word residue from finals and append
            const stripped = stripWakeWord(text, settingsRef.current.wakeWord);
            if (stripped.length > 0) {
              transcriptBufferRef.current = (transcriptBufferRef.current + " " + stripped).trim();
              hasFinalRef.current = true;
              console.log("[jarvis] final chunk appended | buffer now:", JSON.stringify(transcriptBufferRef.current));
            }
            interimRef.current = "";
          } else {
            // Interim — update display ref only
            interimRef.current = stripWakeWord(text, settingsRef.current.wakeWord);
          }

          // Live display: finalized buffer + current interim
          const display = (
            transcriptBufferRef.current +
            (interimRef.current ? " " + interimRef.current : "")
          ).trim();
          if (mountedRef.current) setTranscript(display);

          // Reset silence timer on every speech event — interim or final
          // The timer uses a longer window after the first final chunk lands
          resetSilenceTimer();
        }
      }
    };

    // ── onerror ───────────────────────────────────────────────────────
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rec.onerror = (e: any) => {
      isStartingRef.current = false;
      if (!mountedRef.current) return;
      const err: string = e.error ?? "";
      console.warn("[jarvis] recognition error:", err);
      if (err === "not-allowed" || err === "service-not-allowed") {
        manuallyStopped.current = true;
        isListeningRef.current = false;
        setPermission("denied");
        setStateSync("error");
        return;
      }
      // no-speech / aborted / network — onend handles restart
    };

    // ── onend ─────────────────────────────────────────────────────────
    rec.onend = () => {
      isStartingRef.current = false;
      isListeningRef.current = false;
      if (!mountedRef.current) return;

      console.log("[jarvis] recognition ended | state:", stateRef.current, "| manuallyStopped:", manuallyStopped.current);

      if (manuallyStopped.current) return;

      // Auto-recover in any listening state
      const s = stateRef.current;
      if (s === "passive" || s === "active") {
        scheduleRestart(1000);
      }
    };
  }, [setStateSync, clearActiveState, resetSilenceTimer, scheduleRestart, submitCommand]);

  // ── Stop listening cleanly ────────────────────────────────────────────────
  const stopListening = useCallback(() => {
    manuallyStopped.current = true;
    isStartingRef.current = false;
    clearTimeout(restartTimerRef.current);
    if (recRef.current && isListeningRef.current) {
      try { recRef.current.abort(); } catch { /* ignore */ }
    }
    isListeningRef.current = false;
  }, []);

  // ── Command handler ───────────────────────────────────────────────────────
  const handleCommand = useCallback(
    async (cmd: string) => {
      if (!mountedRef.current) return;
      console.log("[jarvis] parsed command:", cmd);
      setStateSync("processing");
      if (mountedRef.current) setTranscript(cmd);

      // Detect command category for logging
      const lower = cmd.toLowerCase();
      const isNav = ["open", "go to", "show", "take me to", "navigate", "switch", "launch"]
        .some((v) => lower.includes(v));
      const isTask = ["remind", "schedule", "appointment", "task", "add to horizon", "meeting"]
        .some((v) => lower.includes(v));
      const category = isNav ? "navigation" : isTask ? "task-creation" : "ai-query";
      console.log("[jarvis] parser confidence: high | category:", category);
      if (!isNav && !isTask) console.log("[jarvis] fallback to Gemini: yes");

      const result = await executeVoiceCommand(cmd, tasksRef.current);
      if (!mountedRef.current) return;

      console.log("[jarvis] command result:", result.type, result.type !== "navigate" ? result.text?.slice(0, 80) : result.route);

      const returnToPassive = () => { clearActiveState(); setStateSync("passive"); };

      const respond = (responseText: string, afterSpeak: () => void) => {
        if (settingsRef.current.voiceResponses) {
          setStateSync("speaking");
          speak(responseText, () => { if (mountedRef.current) afterSpeak(); });
        } else {
          afterSpeak();
        }
      };

      if (result.type === "navigate") {
        if (mountedRef.current) setLastResponse(`Opening ${result.label}.`);
        respond(`Opening ${result.label}.`, returnToPassive);
        setTimeout(() => {
          win?.history?.pushState({}, "", result.route);
          window.dispatchEvent(new PopStateEvent("popstate"));
        }, 180);
        return;
      }

      if (mountedRef.current) setLastResponse(result.text);
      respond(result.text, returnToPassive);
    },
    [setStateSync, clearActiveState],
  );

  useEffect(() => { handleCommandRef.current = handleCommand; }, [handleCommand]);

  // ── Public enable ─────────────────────────────────────────────────────────
  const enable = useCallback(async () => {
    if (!SpeechRecognitionCtor) {
      setPermission("unsupported");
      setStateSync("error");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((t) => t.stop());
      setPermission("granted");
    } catch {
      setPermission("denied");
      setStateSync("error");
      return;
    }
    initRecognition();
    manuallyStopped.current = false;
    setStateSync("passive");
    attemptStart();
  }, [setStateSync, initRecognition, attemptStart]);

  // ── Public disable ────────────────────────────────────────────────────────
  const disable = useCallback(() => {
    clearTimeout(commandMaxTimerRef.current);
    clearTimeout(silenceTimerRef.current);
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    stopListening();
    setStateSync("idle");
    if (mountedRef.current) {
      transcriptBufferRef.current = "";
      interimRef.current = "";
      hasFinalRef.current = false;
      setTranscript("");
    }
  }, [setStateSync, stopListening]);

  // ── Public dismiss ────────────────────────────────────────────────────────
  const dismiss = useCallback(() => {
    if (stateRef.current === "speaking" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    clearTimeout(commandMaxTimerRef.current);
    clearTimeout(silenceTimerRef.current);
    if (stateRef.current !== "idle" && stateRef.current !== "error") {
      clearActiveState();
      setStateSync("passive");
    }
  }, [setStateSync, clearActiveState]);

  // ── visibilitychange: recover on tab focus ────────────────────────────────
  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden) { console.log("[jarvis] tab hidden"); return; }
      console.log("[jarvis] tab visible — checking recovery");
      const s = stateRef.current;
      if ((s === "passive" || s === "active") && !manuallyStopped.current && !isListeningRef.current) {
        scheduleRestart(800);
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [scheduleRestart]);

  // ── Auto-start on mount ───────────────────────────────────────────────────
  useEffect(() => {
    if (!SpeechRecognitionCtor) { setPermission("unsupported"); return; }
    const settings = getVoiceSettings();
    if (!settings.enabled || !settings.autoStart) return;

    if (navigator.permissions) {
      navigator.permissions.query({ name: "microphone" as PermissionName })
        .then((result) => {
          if (result.state === "granted") {
            setPermission("granted");
            initRecognition();
            manuallyStopped.current = false;
            setStateSync("passive");
            attemptStart();
          } else if (result.state === "denied") {
            setPermission("denied");
            setStateSync("error");
          }
        })
        .catch(() => { /* Permissions API unavailable */ });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── React to settings changes ─────────────────────────────────────────────
  useEffect(() => {
    const unsub = subscribeVoiceSettings(() => {
      const s = getVoiceSettings();
      settingsRef.current = s;
      if (!s.enabled && stateRef.current !== "idle" && stateRef.current !== "error") disable();
    });
    return () => { unsub(); };
  }, [disable]);

  // ── Cleanup on unmount ────────────────────────────────────────────────────
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      manuallyStopped.current = true;
      clearTimeout(restartTimerRef.current);
      clearTimeout(commandMaxTimerRef.current);
      clearTimeout(silenceTimerRef.current);
      if ("speechSynthesis" in window) window.speechSynthesis.cancel();
      isStartingRef.current = false;
      if (recRef.current) { try { recRef.current.abort(); } catch { /* ignore */ } }
    };
  }, []);

  return { state, permission, transcript, lastResponse, enable, disable, dismiss };
}
