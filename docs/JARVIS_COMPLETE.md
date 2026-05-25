# AI Matrix — Complete Technical Reference

> Last updated: May 2026. Written for developers working on this codebase.

---

## 1. Project Overview

**AI Matrix** is a single-user personal AI operating system — a web application that acts as a command centre for one person's digital life. It combines an AI tool directory, task management, a monthly goal planner, an image/link board, a prompt library, usage analytics, and a full-featured voice AI assistant (JARVIS) under one interface.

There is no authentication system. The entire app assumes a single trusted user. Supabase RLS policies are either disabled or set to `USING (true)` throughout.

### Tech Stack

| Layer | Technology |
|---|---|
| UI Framework | React 19 (with concurrent features) |
| Build Tool | Vite 7 |
| Router | TanStack Router v1 (file-based) |
| Styling | Tailwind CSS v4 (CSS-first config) |
| Animation | Framer Motion 11 |
| Database / Storage | Supabase JS v2 (PostgreSQL + Storage) |
| AI — Chat & Tools | Google Gemini 2.0 Flash (function calling) |
| AI — Voice Synthesis | Kokoro-82M (ONNX, Web Worker) with browser TTS fallback |
| AI — Wake Word | openwakeword-wasm-browser (`hey_jarvis` keyword) |
| Notifications | Firebase Cloud Messaging (FCM) via Supabase Edge Function |
| Package Manager | npm / bun (lockfiles for both present) |
| Mobile Target | Capacitor (Android build config present) |

---

## 2. All 12 Pages

### `/` — Websites (AI Tool Directory)
**Purpose:** Curated directory of AI tools and websites the user has bookmarked.
**Key features:** Add/edit/delete websites with name, URL, favicon auto-detection, tags, description. Sortable by newest/oldest/name. Filterable by tag. Search by name/URL/description.
**Supabase tables:** `items` (website records), `desktop_layout` (shared desktop storage)
**AI:** None directly.

### `/ask` — Ask AI
**Purpose:** A clean, distraction-free chat interface for single-turn or multi-turn AI conversations.
**Key features:** Streaming-style Gemini responses with Markdown rendering (remark-gfm), voice input via browser SpeechRecognition, conversation starter chips, context injection from all data sources (websites, prompts, desktop, links, messages).
**Supabase tables:** None (session-only, not persisted).
**AI:** `geminiAPI.generateWithTools()` — full context injection, no function calling on this page.

### `/desktop` — Desktop Launcher
**Purpose:** A drag-and-drop icon grid for launching tools quickly.
**Key features:** Folders, drag to reorder, drag-into-folder to group, right-click to create folder, search/filter icons. Icons are website entries rendered as favicons.
**Supabase tables:** `desktop_layout`
**AI:** None.

### `/horizon` — Task Calendar
**Purpose:** Premium calendar-based task manager with day-view and notification support.
**Key features:** Week strip navigation, day detail view, create/edit/delete tasks (title, date, time, priority: low/medium/high), mark complete, per-task FCM notification toggle, test notification button, real-time subscription via Supabase channel.
**Supabase tables:** `horizon_tasks`, `notification_tokens`, `reminder_sent_log`
**AI:** JARVIS can create, read, update, and delete tasks via function calling (`create_task`, `get_today_tasks`, `get_pending_tasks`, `update_task`, `delete_task`).

### `/context` — Context Window
**Purpose:** A free-text field where the user teaches JARVIS about their life, preferences, goals, and emotional state.
**Key features:** Plain textarea, save to `localStorage` under key `jarvis:user-context`. Persists across sessions. Read by `buildJarvisSystemPrompt()` on every session init.
**Supabase tables:** None (localStorage only).
**AI:** Content is injected verbatim into the JARVIS system prompt under `USER CONTEXT:`.

### `/insights` — Usage Analytics
**Purpose:** Dashboard showing how the user has been using their tools and prompts.
**Key features:** Line chart of daily opens, bar chart of top tools, pie chart of action breakdown (open vs copy), Recharts-powered visualisations, task completion metrics pulled from Horizon, FCM status indicator.
**Supabase tables:** `usage_logs`, `horizon_tasks`
**AI:** None.

### `/links` — Link Board
**Purpose:** Drag-and-drop board of important links (separate from the full website directory).
**Key features:** Add/edit/delete links, drag-to-reorder via `@dnd-kit`, position persisted per card. Cards render as favicon + name + URL.
**Supabase tables:** `links`
**AI:** None.

### `/images` — Image Board
**Purpose:** Personal masonry board of uploaded images.
**Key features:** Upload images to Supabase Storage (`image-board` bucket), rename, delete, masonry grid layout (`columns-*`). Files stored at `storage_path`, displayed via `public_url`.
**Supabase tables:** `image_board`
**Supabase Storage:** `image-board` bucket (public read)
**AI:** None.

### `/messages` — Important Messages
**Purpose:** Time-stamped notes and reminders the user wants to keep visible.
**Key features:** Add/edit/delete messages with motive, time, and body text. Stagger-animated card list.
**Supabase tables:** `important_messages`
**AI:** None.

### `/prompts` — Prompt Library
**Purpose:** Personal library of reusable AI prompts.
**Key features:** Add/delete prompts with title, content, tags. Copy to clipboard. Search by name/content. Sort by newest/oldest/alpha. Usage logged on copy.
**Supabase tables:** `items` (shared store — prompts have a `type` discriminator)
**AI:** Prompts injected as context into the Ask page's Gemini calls.

### `/timeline` — Monthly Goal Planner
**Purpose:** High-level monthly planning tool with AI schedule generation.
**Key features:** Scroll through future months (defined in `TIMELINE_MONTHS` constant), write free-text goals per month per domain (study, health, work, personal, etc.), trigger Gemini to generate a full daily schedule from the goals. Generated schedule is parsed into `horizon_tasks` rows via `addTasksBatch()`. Existing timeline tasks can be wiped per month via `deleteTasksByMonthKey()`. Context and generated schedule text persisted to `timeline_months`.
**Supabase tables:** `timeline_months`, `horizon_tasks`
**AI:** `geminiAPI.generateContent()` — structured prompt asking for a JSON schedule. Response parsed by `robustParseSchedule()` which handles partial/malformed JSON.

### `/jarvis` — JARVIS Voice Assistant
**Purpose:** The full JARVIS interface — the centrepiece of the app.
**Key features:** Animated floating orb, wake word detection (`hey_jarvis`), voice command processing via Gemini function calling, Kokoro neural TTS, conversation cooldown system, cinematic extended window for chat, history card viewer for past sessions, morning briefing.
**Supabase tables:** `jarvis_sessions`, `jarvis_messages`, `jarvis_memory`, `horizon_tasks`, `timeline_months`
**AI:** Full Gemini function calling pipeline — see Section 3.

---

## 3. JARVIS Complete Architecture

All JARVIS logic lives in `src/lib/jarvis.ts` (the state machine, audio pipeline, conversation runtime, wake word, TTS queue) and `src/lib/gemini.ts` (the Gemini API client, function definitions, `executeToolCall`). The React UI is in `src/routes/jarvis.tsx` and the chat window in `src/components/jarvis/extended-window.tsx`.

### 3.1 Audio State Machine

Six states defined as `JarvisAudioState`:

| State | Meaning |
|---|---|
| `idle` | Mic closed, no audio activity. Default resting state. |
| `listening` | Mic open, SpeechRecognition active, collecting user speech. |
| `processing` | Speech collected, Gemini API call in flight. |
| `speaking` | TTS is playing back JARVIS's response. |
| `interrupted` | User interrupted TTS playback mid-sentence. |
| `error` | A recoverable error occurred. Transitions back to `idle`. |

**Transition rules** (enforced by `transitionAudioState()`):

```
idle        → listening, error
listening   → processing, idle, error
processing  → speaking, error, idle
speaking    → idle, interrupted, error
interrupted → listening, idle
error       → idle
```

Any attempt to transition outside these rules throws an error and is caught — the state is not mutated on invalid transitions.

**Side effects on transition:**
- `speaking → *`: calls `window.speechSynthesis.cancel()` and pauses any active Kokoro `AudioBufferSourceNode`
- `* → speaking`: starts the interrupt listener (word-level detection for stop words)
- `* → idle` while `conversationRuntime.mode === "cooling-down"`: triggers `startConversationCooldown()` to begin the follow-up listening window

### 3.2 Conversational Runtime

Three modes defined as `ConversationMode`:

| Mode | Meaning |
|---|---|
| `idle` | No active conversation. JARVIS responds to wake word only. |
| `active` | User is mid-conversation. Mic re-opens after each JARVIS reply. |
| `cooling-down` | JARVIS just finished speaking. 8-second window for user follow-up. |

**Cooldown system:**
- `CONVERSATION_COOLDOWN_MS = 8000` ms
- `startConversationCooldown()` is called **only** from `TTSQueue.playNext()` when the sentence queue drains to empty — this is the single authoritative call site. It is **not** called at enqueue time. This matters because the cooldown must start after the last syllable of audio has finished playing, not when the text is queued.
- The cooldown function: sets mode to `cooling-down`, starts the 8s timer, then after 600ms auto-resumes mic listening (so user can speak immediately after JARVIS finishes)
- If the 8s timer fires without new speech: `endConversation()` is called, mode resets to `idle`, wake word detection restarts

**Dialogue policy** (`_conversationRuntime.policy`): a string injected into the system prompt each turn that biases JARVIS's response length/tone based on the classified intent of the previous turn.

**Turn count** (`_conversationRuntime.turnCount`): incremented on each `handleCommand()` call, reset to 0 on `endConversation()`. Injected into system prompt as `Current conversation turn: N`.

### 3.3 Gemini Function Calling — 7 Tools

All tool definitions are in `src/lib/gemini.ts` as `JARVIS_TOOLS`. Tool execution is handled by `executeToolCall(toolName, toolArgs, sessionId)`.

| Tool | What it does |
|---|---|
| `create_task` | Inserts a row into `horizon_tasks`. Params: `title`, `taskDate` (YYYY-MM-DD), `taskTime` (HH:MM), `priority` (low/medium/high). |
| `save_memory` | Inserts a row into `jarvis_memory`. Params: `content`, `memory_type` (general/preference/fact/reminder/goal). |
| `get_today_tasks` | Queries `horizon_tasks` WHERE `task_date = today` using `new Date().toLocaleDateString('en-CA')` (local timezone YYYY-MM-DD). Returns formatted list. |
| `get_pending_tasks` | Queries `horizon_tasks` WHERE `completed = false`, ordered by date/time, limit 20. Returns list with dates. |
| `recall_memories` | Queries `jarvis_memory` ordered by recency, limit 20. Increments `recalled_count`. Param: `memory_type` (or `all`). |
| `delete_task` | Deletes a `horizon_tasks` row by `id`. |
| `update_task` | Updates `title`, `task_date`, `task_time`, or `priority` on a `horizon_tasks` row. |

**executeToolCall flow:**
1. Gemini returns a `functionCall` part in a candidate
2. `thought_signature` field (Gemini 2.0 internal thinking) is stripped before processing
3. `executeToolCall` is called with the tool name and args
4. Result string is fed back to Gemini as a `function` role message
5. Final text response is extracted from the second Gemini call

**Intent classification** (`classifyIntent(text)`): runs before the Gemini call to route search-style queries through `generateWithSearch()` (Gemini's grounding tool) instead of the function-calling pipeline. Saves latency and cost on factual lookups.

### 3.4 Session Management

| Function | Behaviour |
|---|---|
| `startSession()` | Inserts a row into `jarvis_sessions` with `started_at = now()`, returns UUID. |
| `endSession(id)` | Sets `ended_at`, generates session summary via Gemini, writes it back to the row. |
| `initJarvisSession()` | Runs on mount. Fetches memories (20), session summaries (3), timeline context in parallel via `Promise.all`. Builds system prompt. Does NOT create a Supabase session — session creation is deferred until first message (lazy creation). Timeline context is fetched via `fetchTimelineContext()` which selects only `month_key` and `context` columns — `generated_schedule` is never fetched. Injection is capped at the 3 most recent months, 200 characters each, keeping the timeline section under 600 characters total. |
| Lazy session creation | `_state.currentSessionId` is `null` on boot. On first `handleCommand()`, `startSession()` is called if `currentSessionId` is null. |
| Empty session cleanup | On each `initJarvisSession()`, a fire-and-forget DELETE runs against `jarvis_sessions WHERE message_count = 0` to clean up sessions that were created but never received a message. |
| `updateSessionMessageCount(id)` | Increments `message_count` on the session row after each exchange. |

### 3.5 Memory System

Table: `jarvis_memory`. Five `memory_type` values:

| Type | Usage |
|---|---|
| `general` | Default catch-all for things JARVIS decides to remember |
| `preference` | User preferences ("I like dark themes", "I use Notion") |
| `fact` | Factual information about the user ("studying CS", "in IST timezone") |
| `reminder` | Time-sensitive notes the user wants resurfaces |
| `goal` | User's stated objectives |

Memories are injected into the system prompt on every session init under `PERSISTENT MEMORIES (N):`. The 20 most recent memories are loaded. On `recall_memories` tool call, `recalled_count` and `last_recalled_at` are updated.

### 3.6 Kokoro TTS

**Architecture:** Runs entirely in a Web Worker (`src/workers/kokoro-worker.js`) so the main thread is never blocked by the 82MB ONNX model load.

**Model:** `onnx-community/Kokoro-82M-v1.0` loaded via `@huggingface/transformers` pipeline. Voice: `am_adam` (American male).

**KokoroManager class** (`src/lib/jarvis.ts`):
- `load()`: posts `{ type: 'load' }` to the worker, resolves on `{ type: 'ready' }`
- `synthesize(text)`: posts `{ type: 'synthesize', text }`, resolves with `{ audioData: Float32Array, sampleRate: number }`
- `ready` getter: true once the worker has sent `type: 'ready'`

**Playback** (in `TTSQueue.playNext()`):
1. If `kokoroManager.ready`: decode Float32Array into `AudioBuffer`, play via Web Audio API `AudioBufferSourceNode`, advance queue in `onended`
2. If not ready: fall back to browser SpeechSynthesis

**Fallback chain:**
1. Kokoro (neural, high quality)
2. Browser SpeechSynthesis with `getBestMaleVoice()` priority list: Google UK English Male → Microsoft Ryan/Guy Online (Natural) → Microsoft David/Mark Desktop → Google US English → Alex/Daniel/Fred (macOS) → any neural/online voice → any male-labelled voice → any English voice

**Browser TTS parameters:** `rate: 0.92`, `pitch: 0.85`, `volume: 1.0`

### 3.7 OpenWakeWord

**Library:** `openwakeword-wasm-browser`
**Keyword:** `hey_jarvis`
**Detection threshold:** `WAKE_DETECT_THRESHOLD = 0.45`
**Post-detection cooldown:** `WAKE_COOL_MS = 3500` ms (prevents immediate re-trigger)
**Desktop only:** `startWakeWordDetection()` returns early on mobile user-agents. Mobile users tap the orb to talk.

**Load-then-start sequence** (race condition protection):
1. `_wakeWordInitializing` flag checked — returns immediately if already initialising
2. Engine created in a **local** variable (not assigned to module state yet)
3. `engine.load()` awaited — model loads from `/public/openwakeword/models/`
4. Post-load guard: if `_state.enabled` went false during load, bail cleanly
5. Event handlers wired after `load()` completes
6. `engine.start()` called
7. Only after full success: `_wakeWordEngine = engine`, `_wakeWordActive = true`

**Stop sequence:** `_wakeWordActive` and `_wakeWordInitializing` nulled first, then engine captured in local const before nulling module reference, then `engine.stop()` called — prevents null-dereference on pending callbacks.

### 3.8 Extended Window

The Extended Window (`src/components/jarvis/extended-window.tsx`) is a floating chat viewer that appears when JARVIS responds with a long message, or when the user clicks a history card.

**Two modes:**
- `live`: Shows the current session's messages. Auto-scrolls on new messages.
- `history`: Shows a past session's messages. Read-only. Auto-scroll disabled.

**Positioning:** True screen centre via CSS transform.
```css
position: fixed;
top: 50%; left: 50%;
transform: translate(-50%, -50%);
width: 65vw; max-width: 820px; min-width: 500px;
height: 65vh; max-height: 760px; min-height: 460px;
overflow: hidden;
```
Positioning is handled entirely by inline style (`WINDOWED_STYLE` constant). No Tailwind positioning classes (`bottom-*`, `right-*`, etc.) are used on the window element — they would override the centering.

Fullscreen toggle: `top/left/right/bottom: 16px`, `transform: none`. Animated via Framer Motion `layout` prop.

**Color palette:** Deep navy HUD theme.
- Background: `linear-gradient(135deg, #050d18, #060e1c)`
- Border: `rgba(56, 189, 248, 0.15)` (sky-blue)
- User bubble: `rgba(56, 189, 248, 0.08)` background, sky border
- JARVIS bubble: `rgba(10, 22, 40, 0.8)` background, `rgba(30, 58, 95, 0.6)` border
- Accent: `#38bdf8` (sky-400)

**Auto-scroll behaviour:**
- On window open: scroll to bottom after 400ms (animation completes)
- On new message while open (live mode only): scroll to bottom after 100ms (DOM renders)
- History mode: never auto-scrolls

### 3.9 History Viewer (Session Cards)

Session history cards appear in the JARVIS page sidebar/panel. Each card shows the session date, message count, and summary.

**Click flow:**
1. Card click calls `handleHistoryCardClick(sessionId)`
2. `loadSessionMessages(sessionId)` fetches rows from `jarvis_messages` WHERE `session_id = ?`
3. Messages mapped to `DisplayMessage[]` (role: `"user"` | `"jarvis"`)
4. `triggerHistoryWindowSequence()` animates the Extended Window open in `history` mode
5. The window displays messages read-only — no auto-scroll, no copy button on JARVIS messages, no live indicator

---

## 4. Database Schema

All tables live in the Supabase project. Migration SQL files are in `supabase/migrations/`.

### `items` (websites + prompts)
Shared store used by the Websites page and Prompts page. Differentiated by item type.
```
id           uuid        PK DEFAULT gen_random_uuid()
name         text        NOT NULL
url          text
description  text
position     integer     DEFAULT 0
created_at   timestamptz DEFAULT now()
```
_RLS: disabled (single-user)_

### `desktop_layout`
Stores the icon grid layout (positions, folder membership).
```
id        uuid    PK
data      jsonb   NOT NULL
```
_Exact schema managed by `src/lib/desktop-layout.ts`_

### `horizon_tasks`
Core task table. Used by Horizon calendar, JARVIS tools, and Timeline schedule generator.
```
id                    uuid        PK DEFAULT gen_random_uuid()
title                 text        NOT NULL
description           text
task_date             date        NOT NULL
task_time             text        NOT NULL   -- HH:MM format
priority              text        DEFAULT 'medium'
completed             boolean     DEFAULT false
notification_enabled  boolean     DEFAULT false
created_at            timestamptz DEFAULT now()
```
_RLS: enabled with `allow all` policy. Realtime enabled._

### `timeline_months`
Stores per-month goal text and generated schedule for the Timeline page.
```
month_key          text        PK   -- e.g. "2026-05"
context            text        NOT NULL DEFAULT ''
generated_schedule text
updated_at         timestamptz NOT NULL DEFAULT now()
```
_RLS: enabled with `allow_all_timeline_months` policy._

### `usage_logs`
Tracks tool opens and prompt copies for the Insights dashboard.
```
id          uuid        PK DEFAULT gen_random_uuid()
item_id     text        NOT NULL
item_name   text        NOT NULL DEFAULT ''
item_url    text
type        text        NOT NULL  -- CHECK IN ('tool', 'prompt')
action      text        NOT NULL  -- CHECK IN ('open', 'copy')
timestamp   timestamptz NOT NULL DEFAULT now()
```
_Indexes: `timestamp DESC`, `item_id`. RLS: disabled._

### `notification_tokens`
Stores FCM device tokens for push notification delivery.
```
id          uuid        PK DEFAULT gen_random_uuid()
token       text        NOT NULL UNIQUE
platform    text        NOT NULL DEFAULT 'web'
created_at  timestamptz NOT NULL DEFAULT now()
updated_at  timestamptz NOT NULL DEFAULT now()
```
_Trigger: auto-updates `updated_at` on UPDATE._

### `reminder_sent_log`
Prevents duplicate FCM reminder delivery. One row per task maximum.
```
id       uuid        PK DEFAULT gen_random_uuid()
task_id  uuid        NOT NULL REFERENCES horizon_tasks(id) ON DELETE CASCADE
sent_at  timestamptz NOT NULL DEFAULT now()
UNIQUE (task_id)
```

### `links`
Link Board entries.
```
id           uuid        PK DEFAULT gen_random_uuid()
name         text        NOT NULL
url          text        NOT NULL
description  text
position     integer     NOT NULL DEFAULT 0
created_at   timestamptz NOT NULL DEFAULT now()
```
_Index: `position`. RLS: disabled._

### `image_board`
Image Board metadata (files live in Supabase Storage).
```
id            uuid        PK DEFAULT gen_random_uuid()
name          text        NOT NULL
storage_path  text        NOT NULL
public_url    text        NOT NULL
created_at    timestamptz NOT NULL DEFAULT now()
```
_Index: `created_at DESC`. RLS: disabled. Storage bucket: `image-board` (public read)._

### `important_messages`
Important Messages board entries.
```
id          uuid        PK DEFAULT gen_random_uuid()
motive      text        NOT NULL
time        text        NOT NULL
message     text        NOT NULL
created_at  timestamptz NOT NULL DEFAULT now()
```
_Index: `created_at DESC`. RLS: disabled._

### `jarvis_sessions`
JARVIS conversation sessions.
```
id               uuid        PK DEFAULT gen_random_uuid()
started_at       timestamptz NOT NULL DEFAULT now()
ended_at         timestamptz
session_summary  text
message_count    integer     NOT NULL DEFAULT 0
tags             text[]      NOT NULL DEFAULT '{}'
```

### `jarvis_messages`
Individual messages within a JARVIS session.
```
id            uuid        PK DEFAULT gen_random_uuid()
session_id    uuid        NOT NULL REFERENCES jarvis_sessions(id) ON DELETE CASCADE
role          text        NOT NULL  -- CHECK IN ('user', 'assistant')
content       text        NOT NULL
message_type  text        NOT NULL DEFAULT 'conversation'
metadata      jsonb
created_at    timestamptz NOT NULL DEFAULT now()
```
_Indexes: `(session_id)`, `(created_at DESC)`_

**Note:** In the React layer, `role` values are `"user"` and `"jarvis"` (not `"assistant"`). The Supabase column stores `"assistant"` — mapping happens in `src/lib/jarvis.ts`.

### `jarvis_memory`
Persistent JARVIS memory store.
```
id                  uuid        PK DEFAULT gen_random_uuid()
content             text        NOT NULL
memory_type         text        NOT NULL DEFAULT 'general'
source_session_id   uuid        REFERENCES jarvis_sessions(id) ON DELETE SET NULL
recalled_count      integer     NOT NULL DEFAULT 0
created_at          timestamptz NOT NULL DEFAULT now()
last_recalled_at    timestamptz
```
_Indexes: `(memory_type)`, `(created_at DESC)`_

---

## 5. Environment Variables

All variables are prefixed `VITE_` and accessed via `import.meta.env`. Set these in Replit Secrets or a `.env` file.

| Variable | Required | Purpose |
|---|---|---|
| `VITE_SUPABASE_URL` | **Yes** | Supabase project URL (e.g. `https://xxxx.supabase.co`) |
| `VITE_SUPABASE_ANON_KEY` | **Yes** | Supabase anon/public key for all database operations |
| `VITE_GEMINI_API_KEY` | **Yes** | Primary Google Gemini API key (Gemini 2.0 Flash) |
| `VITE_GEMINI_API_KEY_2` | No | Fallback Gemini key. If absent, runs single-key mode with a console warning |
| `VITE_FIREBASE_API_KEY` | No* | Firebase web API key |
| `VITE_FIREBASE_AUTH_DOMAIN` | No* | Firebase auth domain |
| `VITE_FIREBASE_PROJECT_ID` | No* | Firebase project ID |
| `VITE_FIREBASE_STORAGE_BUCKET` | No* | Firebase storage bucket |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | No* | FCM sender ID |
| `VITE_FIREBASE_APP_ID` | No* | Firebase app ID |

*Firebase variables are optional — the app gracefully disables FCM push notifications when any are missing (`FIREBASE_ENABLED` guard in `src/lib/firebase.ts`).

---

## 6. Known Limitations

**Kokoro TTS unavailable in sandboxed environments:** Kokoro-82M model loading fails in sandboxed hosting environments (e.g. Replit preview) because HuggingFace's CDN requires authentication tokens that are not available in the sandbox. All dtype variants (`q8`, `fp16`, `fp32`) fail for the same reason — the domain is the problem, not the format. The browser TTS fallback activates automatically. The preferred fallback voice is `Google UK English Male` (via the `getBestMaleVoice()` priority list).

**Browser TTS fallback quality:** When Kokoro fails to load (network issues, sandboxed environment, first-load timeout), the app falls back to the browser's built-in `SpeechSynthesis` API. Voice quality varies significantly by browser and OS. Edge on Windows has the best neural voices. Chrome on Linux has limited options. The voice selector (`getBestMaleVoice()`) uses a priority list to pick the best available.

**Kokoro first-load download:** The Kokoro-82M ONNX model is ~82MB. On first load it downloads fully before any neural TTS is available. Subsequent loads use the browser cache. There is no streaming or progressive loading — the user experiences silence (or a loading indicator) until the download completes.

**OpenWakeWord Chrome/Edge only:** The WASM module for wake word detection requires a modern browser with SharedArrayBuffer support (requires COOP/COEP headers). This works in Chrome and Edge. Safari and Firefox may not support it. Mobile browsers are excluded entirely by the `isMobileUA()` guard — mobile users must tap the orb to activate JARVIS.

**Mobile tap-to-talk only:** JARVIS on mobile is tap-to-activate. No wake word. No persistent mic. This is by design to avoid battery drain and privacy concerns.

**Single-key Gemini rate limits:** The Gemini API has per-minute rate limits. The primary + fallback dual-key system (`VITE_GEMINI_API_KEY` + `VITE_GEMINI_API_KEY_2`) provides a basic rate-limit escape hatch, but sustained heavy use can still hit limits.

**No multi-user support:** The entire data model assumes one user. There are no `user_id` columns, no auth tokens, and RLS is either disabled or fully open. Do not deploy this with public access.

**FCM Supabase Edge Function dependency:** Push notifications require a deployed Supabase Edge Function that reads from `notification_tokens` and calls the Firebase Admin SDK. If the Edge Function is not deployed or its service account credentials are not set, notifications silently fail. The UI degrades gracefully (notification toggle still appears but sends no push).
