/**
 * Voice platform abstraction.
 *
 * Describes the capabilities of the voice subsystem on each platform.
 * The hook `useVoiceAssistant` programs against these capabilities
 * rather than hard-coding browser-only assumptions, making it easier
 * to swap in a native Rust audio backend later.
 *
 * Current (web/PWA): Web Speech API — continuous mode, wake-word in JS
 * Future (Tauri):    Rust audio service (whisper.cpp or Vosk) with:
 *                    - real background listening (even when window hidden)
 *                    - OS-level wake-word detection
 *                    - low-power DSP mode
 *                    - global hotkey integration
 */

export type VoiceBackendType = "browser-speech-api" | "tauri-native";

export interface VoicePlatformCapabilities {
  /** Can the microphone run while the app tab/window is active? Always true. */
  foregroundListening: boolean;
  /** Can the microphone listen when the window is hidden or minimised? */
  backgroundListening: boolean;
  /** Is wake-word detection handled at the OS/DSP level (vs. in JS)? */
  nativeWakeWord: boolean;
  /** Can the assistant run at OS startup before the main window opens? */
  startupAssistant: boolean;
  /** Is low-power always-on microphone mode available? */
  lowPowerMode: boolean;
  /** Which backend powers the recognition. */
  backend: VoiceBackendType;
}

/**
 * Returns the voice capabilities available on the current platform.
 * Use this to conditionally enable or grey-out settings in the UI.
 */
export function getVoicePlatformCapabilities(): VoicePlatformCapabilities {
  const isNative = typeof window !== "undefined" && "__TAURI__" in window;

  if (isNative) {
    // Future Tauri build — all capabilities available via Rust backend
    return {
      foregroundListening: true,
      backgroundListening: true,
      nativeWakeWord:      true,
      startupAssistant:    true,
      lowPowerMode:        true,
      backend:             "tauri-native",
    };
  }

  return {
    foregroundListening: true,
    backgroundListening: false, // browser cannot truly background-listen
    nativeWakeWord:      false,
    startupAssistant:    false,
    lowPowerMode:        false,
    backend:             "browser-speech-api",
  };
}

/**
 * Returns a human-readable summary of what voice features are unavailable
 * on the current platform, for display in the settings panel.
 */
export function getVoicePlatformLimitations(): string[] {
  const caps = getVoicePlatformCapabilities();
  const limits: string[] = [];

  if (!caps.backgroundListening)
    limits.push("Background listening requires the desktop app.");
  if (!caps.nativeWakeWord)
    limits.push("Hardware wake-word detection requires the desktop app.");
  if (!caps.startupAssistant)
    limits.push("Startup assistant requires the desktop app.");

  return limits;
}

// ── Future Tauri voice bridge stub ────────────────────────────────────────────
// When running in Tauri, the voice system will:
//
//   1. Call a Tauri command to start the Rust audio capture pipeline.
//   2. Rust handles wake-word detection (whisper.cpp / Vosk / porcupine).
//   3. On wake-word, Rust emits a Tauri event → JS side activates.
//   4. Command audio is streamed to Rust → Whisper transcription → JS.
//   5. JS processes the command (same executeVoiceCommand path).
//
// The interface surface:
//   invoke("start_voice_listener")   → begins background capture
//   invoke("stop_voice_listener")    → ends capture, releases mic
//   listen("voice:wake-word")        → event fired when wake word heard
//   listen("voice:transcript")       → event fired with command text
//
// This modular approach means useVoiceAssistant only needs a new backend
// adapter — the state machine, command routing, and UI are unchanged.
