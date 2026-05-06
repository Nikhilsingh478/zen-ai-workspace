import { useCallback, useEffect, useRef, useState } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

export type VoiceState = "idle" | "listening" | "processing";

interface UseVoiceInputOptions {
  onTranscript: (text: string) => void;
  lang?: string;
}

// The Web Speech API types are inconsistently available across TS DOM lib versions.
// We define a minimal interface and access through `window as any` to stay safe.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRecognition = any;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const win = typeof window !== "undefined" ? (window as any) : undefined;

const SpeechRecognitionCtor: (new () => AnyRecognition) | undefined =
  win?.SpeechRecognition ?? win?.webkitSpeechRecognition;

/** True when the current browser supports the Web Speech API. */
export const isSpeechSupported = Boolean(SpeechRecognitionCtor);

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useVoiceInput({ onTranscript, lang = "en-US" }: UseVoiceInputOptions) {
  const [voiceState, setVoiceState] = useState<VoiceState>("idle");
  const recognitionRef = useRef<AnyRecognition>(null);

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
  }, []);

  const start = useCallback(() => {
    if (!SpeechRecognitionCtor || voiceState !== "idle") return;

    const recognition = new SpeechRecognitionCtor();
    recognition.lang = lang;
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onstart = () => setVoiceState("listening");

    recognition.onresult = (event: { results: { [index: number]: { [index: number]: { transcript: string } } } }) => {
      const transcript = (event.results[0][0].transcript as string).trim();
      setVoiceState("processing");
      onTranscript(transcript);
    };

    recognition.onerror = () => setVoiceState("idle");
    recognition.onend = () => setVoiceState("idle");

    recognitionRef.current = recognition;
    recognition.start();
  }, [lang, onTranscript, voiceState]);

  const toggle = useCallback(() => {
    if (voiceState === "idle") start();
    else stop();
  }, [voiceState, start, stop]);

  // Abort any active recognition on unmount
  useEffect(() => {
    return () => recognitionRef.current?.abort();
  }, []);

  return {
    voiceState,
    toggle,
    isListening: voiceState === "listening",
  };
}
