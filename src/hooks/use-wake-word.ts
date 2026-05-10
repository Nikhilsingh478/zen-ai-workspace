import { useCallback, useEffect, useRef, useState } from "react";

// ─── Browser compat (same shim as use-voice-input) ────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const win = typeof window !== "undefined" ? (window as any) : undefined;
const SpeechRecognitionCtor: (new () => any) | undefined =
  win?.SpeechRecognition ?? win?.webkitSpeechRecognition;

export const isWakeWordSupported = Boolean(SpeechRecognitionCtor);

// ─── Hook ─────────────────────────────────────────────────────────────────────

interface UseWakeWordOptions {
  onDetected: () => void;
  keyword?: string;
}

/**
 * Runs a silent background continuous speech recognition loop.
 * Calls `onDetected` when the keyword (default "jarvis") is heard.
 * Call `resume()` after command recording finishes to restart the listener.
 */
export function useWakeWord({ onDetected, keyword = "jarvis" }: UseWakeWordOptions) {
  const [enabled, setEnabled] = useState(false);
  const [isWatching, setIsWatching] = useState(false);

  const enabledRef = useRef(false);
  const pausedRef = useRef(false);
  const recRef = useRef<any>(null); // eslint-disable-line @typescript-eslint/no-explicit-any
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const onDetectedRef = useRef(onDetected);
  useEffect(() => { onDetectedRef.current = onDetected; }, [onDetected]);

  const startListener = useCallback(() => {
    if (!SpeechRecognitionCtor || !enabledRef.current || pausedRef.current) return;

    const rec = new SpeechRecognitionCtor();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = "en-US";
    recRef.current = rec;

    rec.onstart = () => setIsWatching(true);

    rec.onresult = (event: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const text = (event.results[i][0].transcript as string).toLowerCase();
        if (text.includes(keyword)) {
          pausedRef.current = true;
          try { rec.stop(); } catch { /* ignore */ }
          onDetectedRef.current();
          return;
        }
      }
    };

    rec.onerror = (e: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
      // Permission denied → disable entirely
      if (e.error === "not-allowed") {
        enabledRef.current = false;
        setEnabled(false);
        setIsWatching(false);
      }
      // Other errors (no-speech, aborted) → let onend handle restart
    };

    rec.onend = () => {
      setIsWatching(false);
      // Auto-restart unless paused (command mode) or disabled
      if (enabledRef.current && !pausedRef.current) {
        timerRef.current = setTimeout(startListener, 400);
      }
    };

    try { rec.start(); } catch { /* ignore double-start */ }
  }, [keyword]);

  /**
   * Call this once command recording is complete so the wake listener restarts.
   */
  const resume = useCallback(() => {
    if (!enabledRef.current) return;
    pausedRef.current = false;
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(startListener, 800);
  }, [startListener]);

  const enable = useCallback(() => {
    enabledRef.current = true;
    pausedRef.current = false;
    setEnabled(true);
    startListener();
  }, [startListener]);

  const disable = useCallback(() => {
    enabledRef.current = false;
    pausedRef.current = false;
    clearTimeout(timerRef.current);
    setEnabled(false);
    setIsWatching(false);
    try { recRef.current?.abort(); } catch { /* ignore */ }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      enabledRef.current = false;
      clearTimeout(timerRef.current);
      try { recRef.current?.abort(); } catch { /* ignore */ }
    };
  }, []);

  return { enabled, isWatching, enable, disable, resume };
}
