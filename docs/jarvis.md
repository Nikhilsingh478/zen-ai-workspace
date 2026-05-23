# JARVIS Subsystem — Technical Reference

## Architecture Overview

JARVIS is a client-side AI operating system built on a single-module design (`src/lib/jarvis.ts`). All voice, intent, search, session, and TTS logic lives in one cohesive module that exports a reactive state store plus a plain-object API (`jarvis.*`). React components never instantiate their own speech engines — they read state via `useJarvis()` and call `jarvis.*` methods.

```
Browser
  └── src/routes/jarvis.tsx          (page + UI shell)
       ├── useJarvis()               (reactive state subscription)
       └── jarvis.*                  (activate, dismiss, sendText, enable, disable)

  └── src/lib/jarvis.ts              (entire engine — one module)
       ├── WakeWordEngine            (OpenWakeWord WASM, desktop-only)
       ├── KokoroManager             (Kokoro neural TTS, WASM worker)
       ├── TTSQueue                  (serializes speech with interrupt support)
       ├── startRecognition()        (Web Speech API, command mode only)
       ├── handleCommand()           (intent → search | Gemini | tool call)
       └── Supabase                  (sessions, messages, memories, summaries)
```

---

## Audio Pipeline

```
Microphone
    │
    ▼
┌─────────────────────────────────┐
│     OpenWakeWord (WASM)          │  ← desktop-only, passive always-on
│  detects "hey_jarvis" keyword   │
└─────────────────┬───────────────┘
                  │ detect event (score ≥ 0.5)
                  ▼
         startCommandListening()
                  │
                  ▼
┌─────────────────────────────────┐
│    Web Speech API (command)      │  ← one-shot per wake/tap
│  accumulates transcript chunks   │
│  arms silence timer (1200 ms)    │
└─────────────────┬───────────────┘
                  │ final transcript
                  ▼
            handleCommand()
                  │
          ┌───────┴────────┐
          ▼                ▼
   classifyIntent()   Gemini API
   (search / chat)   (generateWithTools)
          │
          ▼
    TTSQueue.enqueue()
          │
          ▼
┌─────────────────────────────────┐
│    Kokoro TTS (WASM worker)      │  ← primary, 60 s timeout
│    → browser SpeechSynthesis    │  ← fallback on failure
└─────────────────────────────────┘
```

---

## Wake Word System (Part 12)

### Engine
`openwakeword-wasm-browser` runs a WASM-compiled neural model entirely in-browser. No server round-trips, no cloud dependency.

### Lifecycle

| Event | Action |
|---|---|
| `jarvis.enable()` | `startWakeWordDetection()` |
| `jarvis.disable()` | `stopWakeWordDetection()` |
| Wake word detected | `transitionAudioState("listening")` → `startCommandListening()` |
| Command session ends (empty) | `startWakeWordDetection()` |
| Command session ends (text) | `handleCommand(text)` |
| JARVIS page unmounts | `stopWakeWordDetection()` |

### Key Functions

**`startWakeWordDetection(): Promise<void>`**
- Guards: mobile UA returns immediately (tap-to-talk only), double-start guard via `_wakeWordActive`
- Initialises `WakeWordEngine` with `baseAssetUrl: "/openwakeword/models"`, keyword `"hey_jarvis"`, `detectionThreshold: 0.5`, `cooldownMs: 2000`
- On `detect`: calls `startCommandListening()` if `voiceState === "idle"` and `enabled`
- On `error`: logs warning, does NOT crash — tap-to-talk continues working
- Any exception during init: caught silently, graceful degradation

**`stopWakeWordDetection(): Promise<void>`**
- Calls `_wakeWordEngine.stop()`, nulls engine reference, sets `_wakeWordActive = false`

**`startCommandListening(): void`**
- Stops any active recognition, resets transcript buffers
- Patches `{ isAwake: true, transcript: "" }`
- Calls `startRecognition()` (command mode)
- Arms `MAX_LISTEN_MS` (20 s) hard timeout — on expiry with no speech, returns to wake word detection

### Asset Delivery
Model files are served from `/openwakeword/models/` at runtime. `vite-plugin-static-copy` copies them from `node_modules/openwakeword-wasm-browser/models/*` into the Vite build output at build time.

### Graceful Degradation
- OpenWakeWord load failure → tap-to-talk via `jarvis.activate()` continues working
- Mobile UA → wake word detection skipped entirely, tap-to-talk only
- Kokoro TTS failure → browser `SpeechSynthesis` fallback, no crash

---

## Session Lifecycle

```
JarvisPage mounts
    └── initJarvisSession(userId)     creates Supabase row, returns sessionId
         └── jarvis.autoStartIfEnabled()  starts wake word detection if mic granted

User interaction (voice or text)
    └── handleCommand(text, sessionId)
         ├── saveMessage(sessionId, "user", text)
         ├── classifyIntent(text)
         ├── search OR Gemini API
         ├── saveMessage(sessionId, "assistant", response)
         └── TTSQueue.enqueue(cleanTextForSpeech(response), cb)
              └── cb: startWakeWordDetection()

JarvisPage unmounts / beforeunload
    └── endSession(sessionId)         generates summary, saves to Supabase
    └── stopWakeWordDetection()
```

---

## Intent Classification

`classifyIntent(text): Intent`

| Intent | Trigger keywords |
|---|---|
| `"weather"` | weather, temperature, forecast, rain, snow, wind |
| `"news"` | news, headline, happening, latest, today |
| `"search"` | search, find, look up, who is, what is, when did, where is, how do, define, explain |
| `"time"` | time, clock, what time |
| `"date"` | date, what day, today's date |
| `"chat"` | (default fallback) |

Search intents route through `handleSearchIntent()` which builds a structured Perplexity/Gemini search query and returns `SearchResult` with sources and formatted text. Chat intents go directly to `geminiAPI.generateWithTools()`.

---

## Search Pipeline

`handleSearchIntent(text, intent, sessionId)`

1. Builds an optimized search query from the raw user text
2. Calls `geminiAPI.search(query, searchType)` where `searchType` ∈ `["news" | "web" | "academic" | "general"]`
3. Parses Grounding metadata for source citations
4. Returns `{ text, sources, searchType }` as a `SearchResult`
5. Speaks result via TTS, saves to Supabase with `{ sources, searchType }` metadata

---

## Audio State Machine

Valid states: `"idle" | "listening" | "speaking"`

`transitionAudioState(next, extraPatch?)` enforces transitions:

| From | To | Side-effect |
|---|---|---|
| any | `"idle"` | stop recognition, cancel TTS |
| any | `"listening"` | cancel TTS if speaking |
| any | `"speaking"` | patch voiceState |

State is stored in the module-level `_state` object and propagated to all React subscribers via `listeners.forEach(fn => fn())`.

---

## TTS Pipeline

### KokoroManager
Wraps `src/workers/kokoro-worker.js` (Kokoro WASM). Singleton. Methods:
- `speak(text): Promise<void>` — 60 s timeout, falls back to browser TTS on failure
- `interrupt()` — cancels current synthesis
- `isAvailable(): boolean` — false if worker failed to load

### TTSQueue
Async queue that serialises TTS utterances. One speech at a time, even when multiple `enqueue()` calls arrive concurrently.

- `enqueue(text, onDone?): void` — adds to queue, processes immediately if idle
- `interrupt()` — clears queue + stops current utterance

`cleanTextForSpeech(text): string` strips Markdown, code fences, URLs, and special characters before passing to TTS — prevents the engine from reading `**bold**` literally.

---

## Error Handling

| Layer | Strategy |
|---|---|
| Wake word detection | Silent catch → tap-to-talk fallback |
| Kokoro TTS | 60 s timeout → browser SpeechSynthesis fallback |
| Web Speech API `not-allowed` | Stop recognition, set idle, do not retry |
| Web Speech API `onend` with text | Harvest text and call `handleCommand()` |
| Gemini API | `toast.error()` + error message in chat |
| Supabase writes | `.catch(() => null)` — non-fatal, fire-and-forget |
| Session init failure | Log warning, continue with no session |

---

## Component Reference

### `src/lib/jarvis.ts`
Core engine. Exports:
- `jarvis` — API object (`enable`, `disable`, `activate`, `dismiss`, `sendText`, `clearMessages`, `autoStartIfEnabled`)
- `useJarvis()` — React hook, reactive state
- `initJarvisSession(userId)` — creates session, returns sessionId
- `endSession(sessionId)` — summarises and persists session
- `getSessions(userId)` — history list
- `deleteSession(sessionId)` — hard delete
- `getAllMemories(userId)` — long-term memory
- `deleteMemory(memoryId)` — remove memory
- `deliverMorningBriefing(sessionId)` — proactive briefing
- `kokoroManager` — direct TTS access
- `stopWakeWordDetection` — for unmount cleanup
- `isJarvisSupported` — boolean, false if no Web Speech API

### `src/routes/jarvis.tsx`
Page shell. Manages:
- Session initialisation on mount, session end on unmount
- Kokoro preload via `kokoroManager`
- Morning briefing delivery
- Voice/text input UI
- Memory and session history panels

### `src/components/jarvis/ai-core.tsx`
Animated orb that reflects `voiceState`. Three states: idle (pulsing ring), listening (expanding rings), speaking (wave animation).

### `src/workers/kokoro-worker.js`
Web Worker running Kokoro WASM. Accepts `{ type: "speak", text }` messages, posts back `{ type: "done" }` or `{ type: "error" }`.

---

## Key Constants

| Constant | Value | Purpose |
|---|---|---|
| `SILENCE_THRESHOLD_MS` | 1200 ms | Auto-submit after user stops speaking |
| `MAX_LISTEN_MS` | 20 000 ms | Hard command session timeout |
| `WAKE_DETECT_THRESHOLD` | 0.5 | OpenWakeWord confidence threshold |
| `WAKE_COOL_MS` | 2000 ms | Minimum ms between wake triggers |
| `WAKE_WORDS` | `["jarvis", "hey jarvis", "okay jarvis"]` | Strip-only (not detection) — used to remove wake word prefix from commands |
| `INTERRUPT_WORDS` | `["stop", "pause", "quiet", "enough", "silence"]` | Interrupts TTS when detected |
