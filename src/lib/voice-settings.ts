/**
 * Voice Assistant — persistent settings store.
 * Backed by localStorage, reactive via useSyncExternalStore.
 */

import { useSyncExternalStore } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

export type WakeWord = "horizon" | "hey horizon";

export type VoiceSettings = {
  enabled: boolean;
  autoStart: boolean;
  voiceResponses: boolean;
  wakeWord: WakeWord;
};

// ─── Defaults ─────────────────────────────────────────────────────────────────

const STORAGE_KEY = "ai-metrics:voice-settings";

const DEFAULT_SETTINGS: VoiceSettings = {
  enabled: false,
  autoStart: true,
  voiceResponses: true,
  wakeWord: "horizon",
};

// ─── Module-level store ───────────────────────────────────────────────────────

const listeners = new Set<() => void>();

function readFromStorage(): VoiceSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

let _settings: VoiceSettings = readFromStorage();

function emit() {
  listeners.forEach((fn) => fn());
}

// ─── Public store API ─────────────────────────────────────────────────────────

export function subscribeVoiceSettings(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getVoiceSettings(): VoiceSettings {
  return _settings;
}

export function setVoiceSettings(patch: Partial<VoiceSettings>): void {
  _settings = { ..._settings, ...patch };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(_settings));
  } catch {
    // ignore storage errors
  }
  emit();
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useVoiceSettings(): VoiceSettings {
  return useSyncExternalStore(subscribeVoiceSettings, getVoiceSettings, getVoiceSettings);
}
