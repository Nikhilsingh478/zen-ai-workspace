/**
 * useVoiceAssistant — production-grade voice assistant hook.
 *
 * State machine:
 *   idle → passive (mic starts, listening for wake word)
 *   passive → active (wake word detected)
 *   active → processing (command captured or timeout)
 *   processing → speaking (response ready, voiceResponses=true)
 *   speaking → passive (utterance ends)
 *   any → idle (disabled)
 *   any → error (permission denied / unsupported)
 *
 * One SpeechRecognition session runs continuously (continuous=true).
 * We never double-start. Modal state controls what we do with results.
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

  // Refs to escape stale closures
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recRef = useRef<any>(null);
  const stateRef = useRef<AssistantState>("idle");
  const mountedRef = useRef(true);
  const intentionalStopRef = useRef(false);
  const restartTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const commandTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const settingsRef = useRef(getVoiceSettings());

  // Pull tasks for command context — avoid re-subscribing recognition on task changes
  const { tasks } = useHorizon();
  const tasksRef = useRef(tasks);
  useEffect(() => {
    tasksRef.current = tasks;
  }, [tasks]);

  // Keep settingsRef fresh
  useEffect(() => {
    const unsub = subscribeVoiceSettings(() => {
      settingsRef.current = getVoiceSettings();
    });
    return () => { unsub(); };
  }, []);

  // Synchronized state setter (keeps ref + React state aligned)
  const setStateSync = useCallback((s: AssistantState) => {
    stateRef.current = s;
    if (mountedRef.current) setState(s);
  }, []);

  // ── Recognition stop ──────────────────────────────────────────────────────

  const stopRecognition = useCallback(() => {
    clearTimeout(restartTimerRef.current);
    if (recRef.current) {
      intentionalStopRef.current = true;
      try {
        recRef.current.abort();
      } catch {
        /* ignore */
      }
      recRef.current = null;
    }
  }, []);

  // ── Command handler (forward-declared via ref to avoid circular deps) ─────

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleCommandRef = useRef<(cmd: string) => Promise<void>>(null as any);

  // ── Recognition start ─────────────────────────────────────────────────────

  const startRecognition = useCallback(() => {
    if (!SpeechRecognitionCtor) return;
    if (recRef.current) return; // already running — never double-start

    clearTimeout(restartTimerRef.current);

    const rec = new SpeechRecognitionCtor();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = "en-US";
    rec.maxAlternatives = 1;
    recRef.current = rec;
    intentionalStopRef.current = false;

    rec.onstart = () => {
      if (!mountedRef.current) return;
      if (stateRef.current === "idle") setStateSync("passive");
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rec.onresult = (event: any) => {
      if (!mountedRef.current) return;

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const text: string = (result[0].transcript as string).trim();
        const isFinal: boolean = result.isFinal;
        const lower = text.toLowerCase();

        if (stateRef.current === "passive") {
          const ww = settingsRef.current.wakeWord.toLowerCase();
          if (lower.includes(ww) || lower.includes("hey horizon")) {
            clearTimeout(commandTimeoutRef.current);
            setStateSync("active");
            if (mountedRef.current) setTranscript("");

            // If command was inline with wake word on same utterance (final only)
            if (isFinal) {
              const inlineCmd = stripWakeWord(text, settingsRef.current.wakeWord).trim();
              if (inlineCmd.length > 2) {
                handleCommandRef.current?.(inlineCmd);
                return;
              }
            }

            // Wait up to 6s for next utterance as the command
            commandTimeoutRef.current = setTimeout(() => {
              if (stateRef.current === "active" && mountedRef.current) {
                setStateSync("passive");
                setTranscript("");
              }
            }, 6000);
            return;
          }
        } else if (stateRef.current === "active") {
          if (mountedRef.current) setTranscript(text);

          if (isFinal) {
            clearTimeout(commandTimeoutRef.current);
            const cmd = stripWakeWord(text, settingsRef.current.wakeWord);
            if (cmd.length > 1) {
              handleCommandRef.current?.(cmd);
            } else {
              setStateSync("passive");
              setTranscript("");
            }
          }
        }
      }
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rec.onerror = (e: any) => {
      if (!mountedRef.current) return;
      const err: string = e.error ?? "";
      if (err === "not-allowed" || err === "service-not-allowed") {
        setPermission("denied");
        setStateSync("error");
        stopRecognition();
      }
      // no-speech / aborted / network → let onend handle restart
    };

    rec.onend = () => {
      recRef.current = null;
      if (!mountedRef.current || intentionalStopRef.current) return;
      // Auto-restart only in listening states
      const s = stateRef.current;
      if (s === "passive" || s === "active") {
        restartTimerRef.current = setTimeout(() => {
          if (
            mountedRef.current &&
            (stateRef.current === "passive" || stateRef.current === "active")
          ) {
            startRecognition();
          }
        }, 500);
      }
    };

    try {
      rec.start();
    } catch {
      recRef.current = null;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setStateSync, stopRecognition]);

  // ── Command handler ───────────────────────────────────────────────────────

  const handleCommand = useCallback(
    async (cmd: string) => {
      if (!mountedRef.current) return;
      setStateSync("processing");
      if (mountedRef.current) setTranscript(cmd);

      const result = await executeVoiceCommand(cmd, tasksRef.current);
      if (!mountedRef.current) return;

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

      const returnToPassive = () => {
        setStateSync("passive");
        if (mountedRef.current) setTranscript("");
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
    [setStateSync],
  );

  // Wire handleCommand into ref so startRecognition closure can call it
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
    clearTimeout(commandTimeoutRef.current);
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    stopRecognition();
    setStateSync("idle");
    if (mountedRef.current) {
      setTranscript("");
    }
  }, [setStateSync, stopRecognition]);

  const dismiss = useCallback(() => {
    if (stateRef.current === "speaking" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    clearTimeout(commandTimeoutRef.current);
    if (stateRef.current !== "idle" && stateRef.current !== "error") {
      setStateSync("passive");
      if (mountedRef.current) setTranscript("");
    }
  }, [setStateSync]);

  // ── Auto-start on mount (if previously enabled + permission granted) ──────

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
          // 'prompt' → user must enable manually; don't auto-request
        })
        .catch(() => {
          /* Permissions API unavailable — skip auto-start */
        });
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
      clearTimeout(commandTimeoutRef.current);
      if ("speechSynthesis" in window) window.speechSynthesis.cancel();
      intentionalStopRef.current = true;
      try {
        recRef.current?.abort();
      } catch {
        /* ignore */
      }
      recRef.current = null;
    };
  }, []);

  return { state, permission, transcript, lastResponse, enable, disable, dismiss };
}
