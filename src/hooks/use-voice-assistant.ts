/**
 * useVoiceAssistant — production-grade voice assistant hook.
 *
 * State machine:
 *   idle     → passive   (mic active, listening for "Jarvis")
 *   passive  → active    (wake word detected)
 *   active   → processing (3.5s silence debounce fires or max-command timeout)
 *   processing → speaking (response ready, voiceResponses=true)
 *   speaking → passive   (utterance ends)
 *   any      → idle      (disabled)
 *   any      → error     (permission denied / unsupported)
 *
 * Key stability guarantees:
 *   - One SpeechRecognition session at all times (never double-start).
 *   - Restart mutex: isStartingRef prevents overlapping start() calls.
 *   - Mobile restart cooldown: ≥1200ms between restart attempts.
 *   - Transcript is accumulated across all isFinal results in ACTIVE state.
 *   - Command fires only after 3.5s of silence (no new speech events).
 *   - Max 20s command window prevents infinite active state.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { getVoiceSettings, subscribeVoiceSettings } from "@/lib/voice-settings";
import { executeVoiceCommand, stripWakeWord } from "@/lib/voice-commander";
import { useHorizon } from "@/lib/horizon";

// ─── Browser compat ───────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const win = typeof window !== "undefined" ? (window as any) : undefined;
const SpeechRecognitionCtor: (new () => any) | undefined =
  win?.SpeechRecognition ?? win?.webkitSpeechRecognition;

export const isVoiceAssistantSupported = Boolean(SpeechRecognitionCtor);

// ─── Types ────────────────────────────────────────────────────────────────────

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

// ─── SpeechSynthesis helper ───────────────────────────────────────────────────

function speak(text: string, onEnd?: () => void) {
  if (!("speechSynthesis" in window)) {
    onEnd?.();
    return;
  }
  window.speechSynthesis.cancel();
  const utt = new SpeechSynthesisUtterance(text);
  utt.rate = 1.0;
  utt.pitch = 1.0;
  utt.volume = 1.0;
  utt.lang = "en-US";
  const voices = window.speechSynthesis.getVoices();
  const preferred = voices.find(
    (v) =>
      v.lang.startsWith("en") &&
      (v.name.includes("Google") || v.name.includes("Natural") || v.name.includes("Samantha")),
  );
  if (preferred) utt.voice = preferred;
  utt.onend = () => onEnd?.();
  utt.onerror = () => onEnd?.();
  window.speechSynthesis.speak(utt);
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useVoiceAssistant(): VoiceAssistantHandle {
  const [state, setState] = useState<AssistantState>("idle");
  const [permission, setPermission] = useState<PermissionStatus>("unknown");
  const [transcript, setTranscript] = useState("");
  const [lastResponse, setLastResponse] = useState("");

  // ── Refs to escape stale closures ────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recRef = useRef<any>(null);
  const stateRef = useRef<AssistantState>("idle");
  const mountedRef = useRef(true);
  const intentionalStopRef = useRef(false);

  // Restart control — prevents mobile restart storms
  const restartTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const isStartingRef = useRef(false);              // mutex: no double start()
  const lastRestartTimeRef = useRef(0);             // cooldown timestamp
  const MIN_RESTART_MS = 1200;                      // minimum gap between restarts

  // Command timing
  const commandMaxTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Transcript accumulation
  const transcriptBufferRef = useRef("");           // finalized speech segments

  const settingsRef = useRef(getVoiceSettings());

  // Pull tasks — stable ref avoids re-creating recognition on task list changes
  const { tasks } = useHorizon();
  const tasksRef = useRef(tasks);
  useEffect(() => { tasksRef.current = tasks; }, [tasks]);

  // Keep settingsRef fresh
  useEffect(() => {
    const unsub = subscribeVoiceSettings(() => {
      settingsRef.current = getVoiceSettings();
    });
    return () => { unsub(); };
  }, []);

  // Synchronized state setter
  const setStateSync = useCallback((s: AssistantState) => {
    stateRef.current = s;
    if (mountedRef.current) setState(s);
  }, []);

  // ── Reset active-command state ────────────────────────────────────────────

  const clearActiveState = useCallback(() => {
    clearTimeout(silenceTimerRef.current);
    clearTimeout(commandMaxTimeoutRef.current);
    transcriptBufferRef.current = "";
    if (mountedRef.current) setTranscript("");
  }, []);

  // ── Recognition stop ──────────────────────────────────────────────────────

  const stopRecognition = useCallback(() => {
    clearTimeout(restartTimerRef.current);
    if (recRef.current) {
      intentionalStopRef.current = true;
      try { recRef.current.abort(); } catch { /* ignore */ }
      recRef.current = null;
    }
    isStartingRef.current = false;
  }, []);

  // ── Command handler (forward-declared via ref to avoid circular deps) ─────

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleCommandRef = useRef<(cmd: string) => Promise<void>>(null as any);

  // ── Recognition start ─────────────────────────────────────────────────────

  const startRecognition = useCallback(() => {
    if (!SpeechRecognitionCtor) return;
    if (recRef.current) return;           // already running
    if (isStartingRef.current) return;    // start() already in flight

    clearTimeout(restartTimerRef.current);
    isStartingRef.current = true;

    const rec = new SpeechRecognitionCtor();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = "en-US";
    rec.maxAlternatives = 1;
    recRef.current = rec;
    intentionalStopRef.current = false;

    // ── onstart ──────────────────────────────────────────────────────────
    rec.onstart = () => {
      isStartingRef.current = false;
      if (!mountedRef.current) return;
      if (stateRef.current === "idle") setStateSync("passive");
      console.log("[jarvis] recognition started | state:", stateRef.current);
    };

    // ── onresult ─────────────────────────────────────────────────────────
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rec.onresult = (event: any) => {
      if (!mountedRef.current) return;

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const text: string = (result[0].transcript as string).trim();
        const isFinal: boolean = result.isFinal;
        const lower = text.toLowerCase();

        // ── PASSIVE: watching for wake word ────────────────────────────
        if (stateRef.current === "passive") {
          const ww = settingsRef.current.wakeWord.toLowerCase();
          const heard = lower.includes(ww) || lower.includes("jarvis");
          if (heard) {
            console.log("[jarvis] wake word detected in:", text);
            clearActiveState();
            setStateSync("active");

            // If command was spoken inline on the same utterance (final only)
            if (isFinal) {
              const inlineCmd = stripWakeWord(text, settingsRef.current.wakeWord).trim();
              if (inlineCmd.length > 2) {
                console.log("[jarvis] inline command:", inlineCmd);
                transcriptBufferRef.current = inlineCmd;
                if (mountedRef.current) setTranscript(inlineCmd);
                // Start silence timer for this inline command
                clearTimeout(silenceTimerRef.current);
                silenceTimerRef.current = setTimeout(() => {
                  if (stateRef.current === "active" && mountedRef.current) {
                    const cmd = transcriptBufferRef.current.trim();
                    if (cmd.length > 1) handleCommandRef.current?.(cmd);
                    else {
                      setStateSync("passive");
                      clearActiveState();
                    }
                  }
                }, 3500);
                return;
              }
            }

            // Max command window — prevents staying in ACTIVE forever
            clearTimeout(commandMaxTimeoutRef.current);
            commandMaxTimeoutRef.current = setTimeout(() => {
              if (stateRef.current === "active" && mountedRef.current) {
                const cmd = transcriptBufferRef.current.trim();
                if (cmd.length > 1) {
                  handleCommandRef.current?.(cmd);
                } else {
                  setStateSync("passive");
                  clearActiveState();
                }
              }
            }, 20000);
          }
          return; // Don't process passive speech further
        }

        // ── ACTIVE: accumulate command transcript ───────────────────────
        if (stateRef.current === "active") {
          if (isFinal) {
            // Append finalised segment to buffer (strip wake word remnants)
            const stripped = stripWakeWord(text, settingsRef.current.wakeWord);
            transcriptBufferRef.current = (transcriptBufferRef.current + " " + stripped).trim();
          }

          // Display: buffer + current interim
          const display = isFinal
            ? transcriptBufferRef.current
            : (transcriptBufferRef.current
                ? transcriptBufferRef.current + " " + stripWakeWord(text, settingsRef.current.wakeWord)
                : stripWakeWord(text, settingsRef.current.wakeWord)
              ).trim();

          if (mountedRef.current) setTranscript(display);

          // ── Silence debounce: reset timer on every speech event ───────
          // Fires 3.5s after the last speech — that's when we consider the
          // user done speaking and submit the buffered command.
          clearTimeout(silenceTimerRef.current);
          silenceTimerRef.current = setTimeout(() => {
            if (stateRef.current === "active" && mountedRef.current) {
              const cmd = transcriptBufferRef.current.trim();
              console.log("[jarvis] silence timeout — processing command:", cmd);
              if (cmd.length > 1) {
                clearTimeout(commandMaxTimeoutRef.current);
                handleCommandRef.current?.(cmd);
              } else {
                setStateSync("passive");
                clearActiveState();
              }
            }
          }, 3500);
        }
      }
    };

    // ── onerror ───────────────────────────────────────────────────────────
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rec.onerror = (e: any) => {
      isStartingRef.current = false;
      if (!mountedRef.current) return;
      const err: string = e.error ?? "";
      console.warn("[jarvis] recognition error:", err);
      if (err === "not-allowed" || err === "service-not-allowed") {
        setPermission("denied");
        setStateSync("error");
        stopRecognition();
        return;
      }
      // no-speech / aborted / network → onend will handle restart
    };

    // ── onend ─────────────────────────────────────────────────────────────
    rec.onend = () => {
      isStartingRef.current = false;
      recRef.current = null;
      if (!mountedRef.current || intentionalStopRef.current) return;

      console.log("[jarvis] recognition ended | state:", stateRef.current);

      // Auto-restart only in listening states — with cooldown to prevent storms
      const s = stateRef.current;
      if (s === "passive" || s === "active") {
        const now = Date.now();
        const elapsed = now - lastRestartTimeRef.current;
        const delay = Math.max(0, MIN_RESTART_MS - elapsed);

        restartTimerRef.current = setTimeout(() => {
          if (
            mountedRef.current &&
            !recRef.current &&
            !isStartingRef.current &&
            (stateRef.current === "passive" || stateRef.current === "active")
          ) {
            lastRestartTimeRef.current = Date.now();
            startRecognition();
          }
        }, delay + 150); // +150ms buffer for Safari/mobile
      }
    };

    try {
      rec.start();
      lastRestartTimeRef.current = Date.now();
    } catch {
      recRef.current = null;
      isStartingRef.current = false;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setStateSync, stopRecognition, clearActiveState]);

  // ── Command handler ───────────────────────────────────────────────────────

  const handleCommand = useCallback(
    async (cmd: string) => {
      if (!mountedRef.current) return;
      console.log("[jarvis] handling command:", cmd);
      setStateSync("processing");
      if (mountedRef.current) setTranscript(cmd);

      const result = await executeVoiceCommand(cmd, tasksRef.current);
      if (!mountedRef.current) return;

      console.log("[jarvis] command result:", result.type, result.type !== "navigate" ? result.text : result.route);

      const returnToPassive = () => {
        clearActiveState();
        setStateSync("passive");
      };

      const respond = (responseText: string, afterSpeak: () => void) => {
        if (settingsRef.current.voiceResponses) {
          setStateSync("speaking");
          speak(responseText, () => {
            if (mountedRef.current) afterSpeak();
          });
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

  // Wire handleCommand into ref
  useEffect(() => {
    handleCommandRef.current = handleCommand;
  }, [handleCommand]);

  // ── Public API ────────────────────────────────────────────────────────────

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
    setStateSync("passive");
    startRecognition();
  }, [setStateSync, startRecognition]);

  const disable = useCallback(() => {
    clearTimeout(commandMaxTimeoutRef.current);
    clearTimeout(silenceTimerRef.current);
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    stopRecognition();
    setStateSync("idle");
    if (mountedRef.current) {
      setTranscript("");
      transcriptBufferRef.current = "";
    }
  }, [setStateSync, stopRecognition]);

  const dismiss = useCallback(() => {
    if (stateRef.current === "speaking" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    clearTimeout(commandMaxTimeoutRef.current);
    clearTimeout(silenceTimerRef.current);
    if (stateRef.current !== "idle" && stateRef.current !== "error") {
      clearActiveState();
      setStateSync("passive");
    }
  }, [setStateSync, clearActiveState]);

  // ── Auto-start on mount ───────────────────────────────────────────────────

  useEffect(() => {
    if (!SpeechRecognitionCtor) {
      setPermission("unsupported");
      return;
    }
    const settings = getVoiceSettings();
    if (!settings.enabled || !settings.autoStart) return;

    if (navigator.permissions) {
      navigator.permissions
        .query({ name: "microphone" as PermissionName })
        .then((result) => {
          if (result.state === "granted") {
            setPermission("granted");
            setStateSync("passive");
            startRecognition();
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
      const settings = getVoiceSettings();
      settingsRef.current = settings;
      if (!settings.enabled && stateRef.current !== "idle" && stateRef.current !== "error") {
        disable();
      }
    });
    return () => { unsub(); };
  }, [disable]);

  // ── Cleanup ───────────────────────────────────────────────────────────────

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      clearTimeout(restartTimerRef.current);
      clearTimeout(commandMaxTimeoutRef.current);
      clearTimeout(silenceTimerRef.current);
      if ("speechSynthesis" in window) window.speechSynthesis.cancel();
      intentionalStopRef.current = true;
      isStartingRef.current = false;
      try { recRef.current?.abort(); } catch { /* ignore */ }
      recRef.current = null;
    };
  }, []);

  return { state, permission, transcript, lastResponse, enable, disable, dismiss };
}
