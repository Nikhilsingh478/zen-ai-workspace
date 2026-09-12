# AI Matrix — Android Build & Model Setup Guide

This document details the native Android architecture and required offline models for **JARVIS Wake-Word (KWS)** and **Kokoro-82M Neural TTS**.

---

## Architecture Overview

1. **sherpa-onnx (v1.13.8)**: Offline speech processing framework (Apache-2.0, k2-fsa).
   - **Keyword Spotter (KWS)**: Streaming Zipformer transducer running on an isolated background `AudioRecord` thread (16kHz PCM mono). Continuously listens for:
     - *"Jarvis"*
     - *"Hey Jarvis"*
     - *"OK Jarvis"*
   - **Offline Neural TTS**: Kokoro-82M model generating studio-quality voice locally without network calls.
2. **JarvisService (Foreground Service)**: Strict single-owner audio state machine (`STOPPED` ➔ `WAKE_LISTENING` ➔ `COMMAND_CAPTURING`). Prevents microphone cycling and OS silence timeouts.
3. **Horizon Native Notifications**: Exact alarm scheduling via `@capacitor/local-notifications` with custom `beep.wav` audio and boot receivers.

---

## Offline Models & Native Binaries

The following binary assets are bundled in the Android app:

### 1. sherpa-onnx Android AAR
- **Path**: `android/app/libs/sherpa-onnx-1.13.8.aar`
- **Source**: `https://github.com/k2-fsa/sherpa-onnx/releases/download/v1.13.8/sherpa-onnx-1.13.8.aar`

### 2. KWS Model (GigaSpeech 3.3M)
- **Asset Directory**: `android/app/src/main/assets/jarvis-kws/`
- **Source**: `https://github.com/k2-fsa/sherpa-onnx/releases/download/kws-models/sherpa-onnx-kws-zipformer-gigaspeech-3.3M-2024-01-01.tar.bz2`
- **Files**:
  - `encoder.int8.onnx`
  - `decoder.onnx`
  - `joiner.int8.onnx`
  - `tokens.txt`
  - `keywords.txt` (Contains BPE tokens for JARVIS, HEY_JARVIS, OK_JARVIS)

### 3. Kokoro TTS Model (v0.19)
- **Asset Directory**: `android/app/src/main/assets/jarvis-tts/`
- **Source**: `https://github.com/k2-fsa/sherpa-onnx/releases/download/tts-models/kokoro-en-v0_19.tar.bz2`
- **Files**:
  - `model.onnx`
  - `voices.bin`
  - `tokens.txt`
  - `espeak-ng-data/` (Phonemizer rules)

---

## Build Commands

### 1. Build Web Assets
```bash
npm run build
```

### 2. Sync Web Assets with Capacitor
```bash
npx cap sync android
```

### 3. Compile Android Debug APK
```bash
powershell -Command "cd android; .\gradlew.bat assembleDebug"
```

The compiled APK will be located at:
`android/app/build/outputs/apk/debug/app-debug.apk`
