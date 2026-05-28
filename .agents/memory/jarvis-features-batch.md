---
name: JARVIS 6-feature batch decisions
description: Non-obvious implementation choices from the Proactive Intelligence, Context Auto-Update, Daily Review, Habit Tracking, Quick Capture, and Batch Task features
---

## Pending context update signaling

`executeToolCall` (gemini.ts) can't communicate back to `handleCommand` (jarvis.ts) through return values because it's called deep inside `generateWithTools`. Solution: module-level `_pendingContextUpdate` variable in gemini.ts, set by `update_user_context` tool handler, cleared atomically by exported `takePendingContextUpdate()`. `handleCommand` calls this after `generateWithTools` returns and injects a silent `context_update` UI badge.

**Why:** Any alternative (events, callbacks, globals in jarvis.ts) would create circular imports or race conditions.

## Life-update routing to tools path

"I just got a freelance client" naturally classifies as `conversation` (streaming, no tools). To allow `update_user_context` tool to fire, life-update phrases (`I just got/started/finished...`, `I've decided...`, `I'm now learning...`) are mapped to `memory_capture` intent in `classifyIntent`, which IS in `TOOLS_INTENTS`. Gemini then chooses between `save_memory` and `update_user_context`.

**Why:** Avoids needing a new intent type and keeps tool routing simple.

## analyzeHabits dual-mode

`analyzeHabits(tasks?)` works two ways: with no arg it fetches the last 7 days from Supabase (used by `initJarvisSession`); with a tasks array passed in it skips the fetch (used by `generateDailyReview` which already has the data). Always returns `""` on error — never throws.

## DisplayMessage type sync

`JarvisMessage` (jarvis.ts) and `DisplayMessage` (extended-window.tsx) have identical `type` union fields. When adding new message types, update BOTH or TypeScript will error on `setHistoryViewMessages` and `historyViewMessages` state.

## Proactive check interval

15-minute interval (`setInterval`). Also fires once immediately on `startProactiveChecks()` call. One alert at a time — function returns after the first match to avoid flooding the feed.

## Daily review uses generateContent (not generateWithTools)

`generateDailyReview()` returns a carefully constructed prompt string. The daily_review handler calls `geminiAPI.generateContent(reviewPrompt)` — just the prompt as a string, no conversation history, no tools. This is the right API since it's a standalone generation, not a multi-turn tool-calling flow.
