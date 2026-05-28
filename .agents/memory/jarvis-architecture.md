---
name: JARVIS architecture
description: Key invariants and patterns across gemini.ts / jarvis.ts / jarvis.tsx that must stay consistent
---

## Core invariants

- `executeToolCall` lives in `gemini.ts` (exported). `handleCommand` is private in `jarvis.ts`.
- `JarvisMessage.type` and `DisplayMessage.type` (in `extended-window.tsx`) must be kept in sync — TypeScript will catch mismatches but only if you update BOTH.
- `TOOLS_INTENTS` set in `jarvis.ts` controls which intents go through `generateWithTools`. Any new intent that needs a Gemini tool must be added here OR handled via its own early-return branch in `handleCommand`.
- Intent classification order in `classifyIntent` matters: `quick_capture` → `task_query` → `task_creation` → `memory_capture` → `task_query` (2nd) → `memory_query` → `task_management` → `daily_review` → `search_query` → `conversation`.
- `addProactiveMessage` must NEVER call `ttsQueue.enqueue` — visual-only injection.
- `addTasksBatch` (bulk insert, returns `number`) already exists in horizon.ts for Timeline. `addJarvisTasksBatch` (Promise.allSettled, returns `{ created, failed }`) is the JARVIS-specific version — don't confuse them.

## TTS / audio state

- Every `handleCommand` branch must `transitionAudioState` on success and failure paths — leaving it in `processing` hangs the UI.
- `ttsQueue.enqueue` callback (2nd arg) is called AFTER speech finishes — use it to restart wake word detection.

## Session lifecycle

- Session is created lazily on first user message (not on mount).
- `_briefingDeliveredThisSession` prevents double morning briefing from React StrictMode double-invoke.
- `_proactiveCheckInterval` is module-level — persists across renders, must be cleared in `jarvis.disable()`.
