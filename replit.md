# AI Metrics — Personal AI Operating System

> A cinematic, full-stack personal command center. Built for one user. Built to be unreasonably powerful.

AI Metrics is a React 19 SPA that fuses a curated AI tools directory, a drag-and-drop OS-style desktop launcher, a prompt library, a link board, an image board, a Markdown message board, a calendar and AI-generated life planner (Horizon + Timeline), a **JARVIS AI assistant** with a minimal Linear/Perplexity-aesthetic 3-column command center, persistent memory banks, session history, native function calling, real-time web search grounding, a daily morning briefing system, and a standalone Gemini AI chat. All structured data lives in Supabase with real-time subscriptions. The app is installable as a PWA and compiles to a native Android app via Capacitor.

The JARVIS module is the crown jewel — Phase 1 of "JARVIS Evolution" ships a full 6-state audio state machine, Gemini function calling with 7 tool declarations, a TTSQueue sentence splitter, an intent pre-classifier (7 intent types including `search_query`), Google Search Grounding integration with dynamic per-type result rendering, a daily morning briefing delivered once per calendar day, persistent cross-session memory, and paginated session history — all wired into a precision minimal `#0a0a0a` command center with Space Mono monospacing and arctic-blue state accents.

---

## Run & Operate

| Command | Purpose |
|---|---|
| `npm run dev` | Start Vite dev server on **port 5000** (`--host 0.0.0.0`) |
| `npm run build` | Production Vite build → `dist/` |
| `npm run build:dev` | Dev-mode build (source maps, no minify) |
| `npm run preview` | Preview the production build locally |
| `npm run lint` | ESLint across all source files |
| `npm run format` | Prettier auto-format |
| `npm run cap:sync` | `npm run build` → `npx cap sync android` |
| `npm run cap:open` | Open Android project in Android Studio |
| `npm run cap:run` | Full build → sync → run on device/emulator |
| `npm run android:debug` | Build + sync (debug, no launch) |
| `npm run android:release` | Build + sync (release-ready) |

**Port 5000** is hard-coded in `package.json` and `.replit` (`waitForPort = 5000`). Change both together or neither.

---

## Environment Variables

All variables must be prefixed `VITE_` — Vite injects them into the client bundle at build time. Set them in Replit Secrets, never in code.

| Key | Required | Description |
|---|---|---|
| `VITE_SUPABASE_URL` | ✅ | Supabase project URL (`https://<ref>.supabase.co`) |
| `VITE_SUPABASE_ANON_KEY` | ✅ | Supabase public anon key (safe to expose in browser) |
| `VITE_GEMINI_API_KEY` | ✅ | Primary Gemini key — powers Ask, JARVIS, Timeline, session summaries, Search Grounding |
| `VITE_GEMINI_API_KEY_2` | ⚠️ | Fallback Gemini key — auto-engaged on 429/403 from primary. Use a **different Google account** for genuine dual-quota |
| `VITE_FIREBASE_API_KEY` | ⚠️ FCM | Firebase web API key |
| `VITE_FIREBASE_AUTH_DOMAIN` | ⚠️ FCM | Firebase auth domain |
| `VITE_FIREBASE_PROJECT_ID` | ⚠️ FCM | Firebase project ID |
| `VITE_FIREBASE_STORAGE_BUCKET` | ⚠️ FCM | Firebase storage bucket |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | ⚠️ FCM | Firebase messaging sender ID |
| `VITE_FIREBASE_APP_ID` | ⚠️ FCM | Firebase app ID |
| `VITE_FIREBASE_VAPID_KEY` | ⚠️ FCM | VAPID key for web push |

> FCM vars are optional — the app degrades gracefully (SW still registers for caching, push notifications simply don't fire).

> **Gemini model note:** The entire app uses `gemini-2.5-flash` exclusively. Do NOT switch to `gemini-2.0-flash` or `gemini-flash-latest` — they behave differently and `gemini-2.0-flash` has `limit: 0` on the free tier in some regions (India, etc.), causing immediate 429s. `gemini-2.5-flash` is used universally for all Gemini calls: JARVIS conversation, tool calls, search grounding, session summaries, Timeline generation, Ask chat, and Insights AI analysis.

---

## Stack

| Layer | Technology | Version |
|---|---|---|
| Runtime | Node.js | 20 |
| SPA framework | React | 19 |
| Router | TanStack Router (file-based, auto-generated route tree) | v1 |
| Build tool | Vite | 7 |
| Styling | Tailwind CSS v4 via `@tailwindcss/vite` | 4 |
| Design tokens | Custom `oklch` CSS variables in `src/styles.css` | — |
| UI primitives | Radix UI + shadcn/ui patterns | latest |
| Animations | Framer Motion | 12 |
| Drag & Drop | @dnd-kit/core + modifiers + sortable | 6/9/10 |
| Database / Realtime | Supabase JS v2 | 2 |
| Server-side query cache | TanStack Query | 5 |
| AI — Ask page | Gemini REST API (`gemini-2.5-flash`) | — |
| AI — JARVIS | Gemini REST API + function calling + Search Grounding + Web Speech API + SpeechSynthesis | — |
| AI — Timeline | Gemini REST API (structured JSON schedule generation) | — |
| Voice | Web Speech API (Chrome/Edge only) | — |
| Push notifications | Firebase Cloud Messaging (FCM) | 12 |
| Toasts | Sonner | 2 |
| Markdown | react-markdown + remark-gfm + rehype-highlight | 10/4/7 |
| Charts | Recharts | 2 |
| Forms | react-hook-form + zod | 7/3 |
| Fuzzy search | Fuse.js | 7 |
| Date utilities | date-fns | 4 |
| Native Android | Capacitor + @capacitor/android | 8 |
| Capacitor plugins | @capacitor/app, @capacitor/haptics, @capacitor/splash-screen, @capacitor/status-bar | 8 |
| Package manager | npm | — |

---

## Database Setup

### Core Tables (Supabase SQL Editor — run in this exact order)

| File | Tables Created | Run Order |
|---|---|---|
| `SETUP.sql` | `items`, `desktop_layout`, `desktop_folders`, `usage_logs` | 1st |
| `SETUP_NEW_TABS.sql` | `links`, `messages` | 2nd |
| `HORIZON_SETUP.sql` | `horizon_tasks` | 3rd |
| `TIMELINE_SETUP.sql` | `timeline_months` | 4th |
| `NOTIFICATIONS_SETUP.sql` | `notification_tokens`, `reminder_sent_log` | 5th |
| `supabase/JARVIS_EVOLUTION_SETUP.sql` | `jarvis_sessions`, `jarvis_messages`, `jarvis_memory` | 6th |

**RLS is disabled** on all tables. Fine for single-user personal use. Add Supabase Auth + Row Level Security before any multi-user deployment.

### JARVIS Evolution Schema (6th — `supabase/JARVIS_EVOLUTION_SETUP.sql`)

**`jarvis_sessions`** — one row per conversation session

```sql
id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
started_at      timestamptz NOT NULL DEFAULT now(),
ended_at        timestamptz,
session_summary text,          -- AI-generated 2-3 sentence summary (Gemini call on session end)
message_count   integer NOT NULL DEFAULT 0,
tags            text[] NOT NULL DEFAULT '{}'
```

**`jarvis_messages`** — every individual message within a session

```sql
id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
session_id   uuid NOT NULL REFERENCES jarvis_sessions(id) ON DELETE CASCADE,
role         text NOT NULL CHECK (role IN ('user', 'assistant')),
content      text NOT NULL,
message_type text NOT NULL DEFAULT 'conversation',
-- 'conversation' | 'task_created' | 'memory_saved' | 'error' | 'morning_briefing' | 'search_result'
metadata     jsonb,   -- for search_result: { sources, searchType }; for morning_briefing: null
created_at   timestamptz NOT NULL DEFAULT now()
```

**`jarvis_memory`** — persistent cross-session memory bank

```sql
id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
content           text NOT NULL,
memory_type       text NOT NULL DEFAULT 'general',  -- 'general' | 'preference' | 'commitment' | 'idea' | 'fact'
source_session_id uuid REFERENCES jarvis_sessions(id) ON DELETE SET NULL,
recalled_count    integer NOT NULL DEFAULT 0,
created_at        timestamptz NOT NULL DEFAULT now(),
last_recalled_at  timestamptz
```

> **Without this SQL:** JARVIS still works fully — it just won't save sessions, messages, or memories across page refreshes. All errors are silently swallowed with `console.warn`.

### Core Schema Reference

**`items`** — AI websites / tools directory
```sql
id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
title        text NOT NULL,
url          text NOT NULL,
description  text,
tags         text[],
created_at   timestamptz DEFAULT now(),
last_opened_at timestamptz
```

**`desktop_layout`** — icon positions on the drag-and-drop grid
```sql
id       text PRIMARY KEY,   -- same as item id or folder id
position integer NOT NULL,
type     text NOT NULL        -- 'item' | 'folder'
```

**`desktop_folders`** — folder groups on the desktop
```sql
id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
name       text NOT NULL,
item_ids   text[],
created_at timestamptz DEFAULT now()
```

**`usage_logs`** — analytics events
```sql
id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
event_type text NOT NULL,     -- 'open' | 'copy'
item_id    uuid,
item_title text,
created_at timestamptz DEFAULT now()
```

**`links`** — link board entries
```sql
id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
title       text NOT NULL,
url         text NOT NULL,
description text,
created_at  timestamptz DEFAULT now()
```

**`messages`** — important messages / notes (Markdown)
```sql
id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
title      text NOT NULL,
content    text,
created_at timestamptz DEFAULT now()
```

**`horizon_tasks`** — tasks for Horizon calendar AND Timeline life-planner
```sql
id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
title                text NOT NULL,
description          text,              -- Timeline tasks encode [timeline:monthKey:domain] prefix here
task_date            date NOT NULL,
task_time            time NOT NULL,     -- HH:MM 24-hour UTC
priority             text NOT NULL,     -- 'low' | 'medium' | 'high'
completed            boolean DEFAULT false,
notification_enabled boolean DEFAULT true,
created_at           timestamptz DEFAULT now()
```

**`timeline_months`** — AI-generated schedule cache
```sql
month_key          text PRIMARY KEY,
context            text,
generated_schedule text,
updated_at         timestamptz DEFAULT now()
```

**`notification_tokens`** — FCM device tokens
```sql
id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
token      text UNIQUE NOT NULL,
created_at timestamptz DEFAULT now(),
updated_at timestamptz DEFAULT now()
```

**`reminder_sent_log`** — deduplication for push scheduler
```sql
id      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
task_id uuid NOT NULL,
sent_at timestamptz DEFAULT now()
```

---

## PWA

AI Metrics is fully installable as a Progressive Web App on Android, iOS (Safari → Add to Home Screen), Windows (Chrome/Edge).

| File | Purpose |
|---|---|
| `public/manifest.json` | App name, icons (192×192 + 512×512 PNG), theme color, `standalone` display, PWA shortcuts (`/horizon`, `/ask`) |
| `public/sw.js` | Cache-first service worker + push event handler + `notificationclick` routing to `/horizon` |
| `public/firebase-messaging-sw.js` | Background FCM push handler — fires when the tab is closed |
| `index.html` | Registers `sw.js`; `<link rel="manifest">`; Apple PWA meta tags |

---

## Push Notifications — Full Setup Guide

### 1. Run SQL
Execute `NOTIFICATIONS_SETUP.sql` in Supabase SQL Editor.

### 2. Deploy Edge Function
```bash
npx supabase functions deploy send-reminders --project-ref <YOUR_PROJECT_REF>
```

### 3. Set Edge Function Secret
Supabase Dashboard → Settings → Edge Functions:

| Secret | Value |
|---|---|
| `FIREBASE_SERVICE_ACCOUNT` | Full JSON from Firebase Console → Project Settings → Service Accounts → "Generate new private key" |

### 4. Schedule the Cron
```sql
select cron.schedule(
  'send-horizon-reminders',
  '* * * * *',
  $$
    select net.http_post(
      url     := '<SUPABASE_FUNCTIONS_URL>/send-reminders',
      headers := '{"Content-Type":"application/json","Authorization":"Bearer <ANON_KEY>"}',
      body    := '{}'
    );
  $$
);
```

### Pipeline
1. `initFCM()` in `src/lib/fcm.ts` registers the browser with FCM and upserts the device token — never prompts on startup
2. Permission request only fires when the user toggles the reminder switch on a task
3. Background SW handles push when tab is closed
4. Foreground `onMessage()` shows an in-app banner instead of an OS popup
5. Edge Function runs every minute via `pg_cron`, finds tasks due within 15 minutes, dispatches FCM, logs to `reminder_sent_log` to prevent duplicates

---

## File Structure

```
/
├── index.html
├── capacitor.config.ts
├── vite.config.ts
├── tailwind.config.ts
├── tsconfig.json
├── public/
│   ├── favicon.png
│   ├── manifest.json
│   ├── sw.js
│   └── firebase-messaging-sw.js
├── SETUP.sql
├── SETUP_NEW_TABS.sql
├── HORIZON_SETUP.sql
├── TIMELINE_SETUP.sql
├── NOTIFICATIONS_SETUP.sql
├── supabase/
│   ├── functions/
│   │   └── send-reminders/           # Deno Edge Function — FCM push dispatcher
│   └── JARVIS_EVOLUTION_SETUP.sql    # jarvis_sessions, jarvis_messages, jarvis_memory
└── src/
    ├── styles.css                    # oklch tokens, Tailwind @theme, JARVIS keyframes
    ├── main.tsx
    ├── router.tsx
    ├── routeTree.gen.ts              # AUTO-GENERATED — never edit manually
    │
    ├── routes/
    │   ├── __root.tsx                # Root layout: Splash + AppShell + Toaster + JarvisFloatingOrb + InAppNotificationHost
    │   ├── index.tsx                 # /          Websites / AI tools directory
    │   ├── desktop.tsx               # /desktop   Drag-and-drop icon launcher
    │   ├── prompts.tsx               # /prompts   Prompt library
    │   ├── links.tsx                 # /links     Quick-access link board
    │   ├── images.tsx                # /images    Image board (Supabase Storage)
    │   ├── messages.tsx              # /messages  Markdown notes / important messages
    │   ├── horizon.tsx               # /horizon   Monthly calendar + timeline task manager
    │   ├── timeline.tsx              # /timeline  AI-generated 6-month life planner
    │   ├── insights.tsx              # /insights  Usage analytics + Horizon productivity
    │   ├── ask.tsx                   # /ask       Multi-turn Gemini AI chat + voice input
    │   ├── jarvis.tsx                # /jarvis    JARVIS 3-column minimal AI command center
    │   └── context.tsx               # /context   Personal context editor for JARVIS memory
    │
    ├── components/
    │   ├── app-shell.tsx             # Collapsible sidebar + mobile bottom nav + page layout
    │   ├── matrix-modal.tsx          # React Portal modal (Framer Motion backdrop + scale)
    │   ├── page-header.tsx
    │   ├── sync-indicator.tsx
    │   ├── voice-overlay.tsx
    │   ├── in-app-notification.tsx   # Instagram-style FCM foreground banners
    │   ├── jarvis/
    │   │   ├── ai-core.tsx           # Minimal JARVIS orb — single circle, Mic icon, state-reactive border/glow
    │   │   ├── floating-orb.tsx      # Global JARVIS FAB — all non-JARVIS pages
    │   │   └── search-result.tsx     # Search grounding result card — 9 layout variants by SearchType
    │   ├── desktop/
    │   │   ├── desktop-grid.tsx
    │   │   ├── desktop-item.tsx
    │   │   ├── folder-icon.tsx
    │   │   ├── folder-overlay.tsx
    │   │   ├── drag-ghost.tsx
    │   │   └── command-palette.tsx
    │   ├── image-board/
    │   ├── link-board/
    │   ├── messages/
    │   └── ui/                       # shadcn/ui primitives
    │
    ├── hooks/
    │   ├── use-mobile.tsx
    │   ├── use-voice-input.ts
    │   ├── use-voice-assistant.ts
    │   └── use-wake-word.ts
    │
    └── lib/
        ├── supabase.ts
        ├── supabase-data.ts
        ├── store.ts
        ├── link-board.ts
        ├── important-messages.ts
        ├── image-board.ts
        ├── horizon.ts                # Horizon tasks store + addTaskDirect() + addTasksBatch() + deleteTasksByMonthKey()
        ├── timeline.ts
        ├── desktop-layout.ts
        ├── gemini.ts                 # Gemini REST wrapper — JARVIS_TOOLS, generateWithTools(), generateWithSearch(), dual-key failover
        ├── jarvis.ts                 # JARVIS global store — 6-state machine, TTSQueue, intent classifier, morning briefing, session management
        ├── usage-tracking.ts
        ├── fcm.ts
        ├── firebase.ts
        ├── notifications.ts
        ├── voice-settings.ts
        ├── voice-commander.ts
        ├── utils.ts
        └── platform/
            ├── index.ts
            ├── jarvis-native.ts
            ├── native-lifecycle.ts
            ├── notifications.ts
            ├── storage.ts
            ├── system.ts
            ├── voice.ts
            └── window.ts
```

---

## Pages

### `/` — Websites Directory
- Curated directory of AI tools and websites with full CRUD
- Tag filter chips, sort by Alphabetical / Recently Added / Most Opened
- Favicon auto-fetched via Google S2 API
- Fuse.js fuzzy search across title, URL, description, tags
- Opens in new tab; logs `open` events to `usage_logs` for Insights

### `/desktop` — Icon Launcher
- macOS-style drag-and-drop icon grid powered by dnd-kit
- Snap-to-grid, swap-on-drop (not insert-before)
- Drag one icon onto another → auto-creates a folder
- Right-click on empty background → "New Folder"
- Folder overlay: rename, delete, remove items
- Layout persists in `desktop_layout` + `desktop_folders`

### `/prompts` — Prompt Library
- CRUD for personal AI prompts (title + body)
- One-click copy with animated checkmark feedback
- Copy events tracked in `usage_logs`
- Fuse.js fuzzy search

### `/links` — Link Board
- Quick-access URL cards: title, URL, description
- Supabase realtime — changes sync live across open tabs

### `/images` — Image Board
- Upload to Supabase Storage (`public/` bucket)
- Rename and delete; responsive card grid

### `/messages` — Important Messages
- Full Markdown rendering: headings, bold, italic, code blocks (syntax highlighted), blockquotes, tables, links
- Injected into JARVIS + Ask page Gemini context on every request

### `/horizon` — Calendar & Task Manager

**The calendar:**
- Always 7 columns × 6 rows (42 cells) — previous/next month overflow cells at 22% opacity
- Full calendar viewport-fit on desktop: `md:flex-1 md:grid-rows-6`, cells `md:aspect-auto md:h-full`
- Today's cell: arctic blue tint + looping pulsing glow
- Task dot per day + count badge for 2+ tasks
- Direction-aware `AnimatePresence` slide transitions on month navigation

**Fullscreen task experience:**
- Clicking a date opens a full-page overlay (not a modal) — `absolute inset-0 z-30`
- Header: back arrow, date, "3 of 5 remaining" — count animates on change
- "Clear day" with inline confirm step

**Task timeline:**
- Tasks sorted chronologically, grouped by hour
- Left rail: time label + circular node + continuous `linear-gradient` connector line
- Node color by time of day: deep-night (indigo), morning (sky), afternoon (amber), evening (orange), night (violet)
- `useInView` defers off-screen group entrance animations

**Task cards:**
- Collapsed: checkbox ✅, left priority stripe, title, time, bell icon (if reminder on)
- **Checkbox when completed:** fills with `bg-sky-300/70` background so the dark tick is clearly visible
- Expanded (click card): description, priority badge, time badge, Edit + Delete buttons
- Completed state: card dims to 30% opacity, title gets strikethrough
- Priority stripe: Low → blue/45, Medium → amber/45, High → red/50

**Add/Edit modal:**
- Title (required), description (optional), 12-hour time picker (H:M:AM/PM selects)
- Priority toggle buttons (Low / Medium / High)
- Arctic blue holographic reminder toggle — defaults **ON** for all new tasks

### `/timeline` — AI Life Planner
6-month AI-generated schedule planner (May – October 2026) across 9 life domains:

| Domain | Icon | Color |
|---|---|---|
| Development | ⌨️ | #3B82F6 blue |
| Gym | 🏋️ | #10B981 emerald |
| Cricket | 🏏 | #F59E0B amber |
| AI Exploration | 🤖 | #8B5CF6 violet |
| Freelance | 💼 | #06B6D4 cyan |
| Jarvis | ⚡ | #0EA5E9 sky |
| Travel | ✈️ | #EC4899 pink |
| Resume/Career | 📄 | #F97316 orange |
| Content | 🎬 | #EF4444 red |

- Free-text monthly context field saved to `timeline_months`
- Gemini generates `{ days: [{ date, tasks: [{ title, startTime, endTime, domain }] }] }` with `temperature: 0.4`
- `robustParseSchedule()`: 3 fallback parse strategies
- Generated schedule cached — no re-generation on revisit
- All timeline tasks stored in `horizon_tasks` with `[timeline:2026-05:gym]` description prefix

### `/insights` — Analytics Dashboard

**Horizon productivity:**
- Done Today, Done This Week, Pending Today, Completion Rate
- Last 7 Days grouped bar chart (Scheduled vs Completed), Priority Distribution donut

**AI tool usage:**
- Opens Today, Copies Today, Streak, WoW delta
- Top Tool, Top Prompt, Avg Opens/Day, Busiest Hour
- Dual-line chart (Opens + Copies), Daily Activity bar, Hour-of-Day distribution
- AI Insights: Gemini-generated plain-English observations from usage patterns
- Auto-refreshes every 30 seconds

### `/ask` — AI Chat
- Multi-turn `gemini-2.5-flash` chat with full conversation history in React state
- First message prepends full workspace context: all websites, prompts, links, messages, folders, JARVIS personal context
- Voice input via Web Speech API — transcribes into the text field for review before send
- Starter chips: "Plan my next 90 minutes", "Brainstorm names for…", etc.
- Full Markdown rendering in assistant replies
- Animated thinking indicator (rotating Sparkles + 3-dot bounce)

### `/jarvis` — JARVIS AI Command Center

> A minimal Linear/Perplexity-aesthetic fullscreen AI command center. `#0a0a0a` background, `#1f1f1f` dividers, `Space Mono` monospacing for all system labels, `#38bdf8` arctic blue as the sole accent color. Precision over decoration.

#### Layout — 3-column desktop flex

**Left Status Panel (220px) — `StatusPanel` component:**
- `JARVIS` wordmark in `Space Mono` + `v3.0` badge
- **Live clock** — time in `Space Mono` 30px, date below in muted grey, updates every second via `setInterval`
- **Voice state indicator** — animated dot (color + pulse per state) + state label with `AnimatePresence` cross-fade on change
- **Today's task summary** — live from `useHorizon()`: total task count + high-priority count in red if > 0
- **JARVIS active toggle** — pill-style toggle enabling/disabling the wake-word listener; persists intent to call `jarvis.enable()` / `jarvis.disable()`
- **Quick command chips** — 4 preset commands ("What's pending today?", "Open Horizon", "Search latest news", "Open Ask") that call `jarvis.sendText()` immediately on click

**Center Column — orb + transcript + state hint:**
- `AICore` component (120px diameter) — minimal single circle with centered `Mic` icon
  - **Listening:** `#38bdf8` border + stronger glow + `#38bdf8` mic icon
  - **Processing:** `#fbbf24` (amber) border + spinning amber dashed ring overlay (360° rotation, 2.5s linear infinite)
  - **Speaking:** `#34d399` (green) border + gentle `scale: [1, 1.04, 1]` breathe animation + green mic icon
  - **Idle:** near-invisible `rgba(255,255,255,0.08)` border + dim grey mic icon
- Transcript bubble — what JARVIS is hearing — fades in/out with `AnimatePresence` spring
- State hint text below orb — "tap orb or type below" / "type below to talk" — only shown when not active

**Mobile:** Single column. A "log" button in the header toggles a full-screen `AnimatePresence` chat overlay over the center column.

**Right Panel (320px) — `RightPanel` component with 3 tabs:**

| Tab | Contents |
|---|---|
| CHAT | Scrollable conversation — all message bubble types, auto-scroll on new messages, clear button |
| HISTORY | `HistoryPanel` — paginated session archive with `getSessions(page, 10)`, date/time/count, AI summary excerpt, delete with inline confirm step |
| MEMORY | `MemoryPanel` — type filter chips (all / preference / commitment / idea / fact / general), memory cards with type badge + recalled count + date, delete with inline confirm step |

#### Message Bubble Types

All message types render distinctly in the CHAT tab:

| `msg.type` | Visual |
|---|---|
| `text` (user) | Right-aligned bubble, `rgba(39,39,42,0.6)` background, `rgba(63,63,70,0.4)` border, springs in from right |
| `text` (JARVIS) | Left-aligned with `J` avatar circle, grey text, springs in from left |
| `task_created` | Left-aligned pill, emerald `#34d399` icon + text, `rgba(6,78,59,0.2)` background |
| `morning_briefing` | Full-width card, `Sparkles` icon header ("Morning Briefing"), `rgba(8,47,73,0.4)` background, `rgba(56,189,248,0.15)` border |
| `search_result` | `SearchResult` component card — see Search Grounding section below |
| `interrupted` | Centered monospace dash separator — `— interrupted —` |

#### Input Bar
- Fixed bottom bar: mic button (toggles voice / `MicOff` icon when listening), text input, send button
- Send button: activates with accent styling only when `input.trim()` is non-empty
- Mic button calls `handleVoice()` which enables JARVIS if disabled, or toggles listening otherwise
- On `beforeunload` and unmount: `endSession()` fires to generate and persist the session summary

---

## JARVIS Evolution — Deep Dive

### Morning Briefing System (`src/lib/jarvis.ts`)

Delivers a personalized spoken and visual briefing once per calendar day. The entire system is localStorage-gated so it only ever fires once regardless of how many times the page is visited.

**Functions:**

`shouldDeliverMorningBriefing(): boolean`
- Reads `localStorage["jarvis:last-briefing-date"]`
- Returns `true` only if the stored date differs from today's ISO date (`YYYY-MM-DD`)

`markBriefingDelivered(): void`
- Writes today's ISO date to `localStorage["jarvis:last-briefing-date"]`
- Called immediately after the briefing text is received from Gemini

`buildMorningBriefingPrompt(tasks: HorizonTask[]): string`
- Accepts today's incomplete tasks from `getHorizonTasks()` filtered to today's date
- Separates tasks into `high` priority and everything else
- Builds a strict natural-language prompt instructing Gemini to:
  - Vary the greeting (not always "Good morning")
  - Reference the actual date and weekday by name
  - Mention high-priority tasks first by their real title
  - End with one honest, non-cheesy motivational line
  - Stay under 100 words, plain text only (no markdown, no asterisks)

`deliverMorningBriefing(sessionId: string): Promise<void>` — **exported, called on mount**
1. Checks `shouldDeliverMorningBriefing()` — exits immediately if false
2. Loads today's incomplete tasks from the Horizon store
3. Builds the briefing prompt
4. Sets `voiceState` to `"processing"`
5. Calls `geminiAPI.generateContent(prompt, [])` — no tools, plain text
6. If the API returns an error string or empty response, resets state and silently exits
7. Constructs a `JarvisMessage` with `type: "morning_briefing"`
8. Patches it into the message feed + sets `voiceState` to `"speaking"`
9. Persists to `jarvis_messages` with `messageType: "morning_briefing"` (fire-and-forget)
10. Enqueues the text in `TTSQueue` for spoken delivery
11. On TTS completion: resets to `idle`, marks briefing delivered, restarts passive listening if enabled

**Mount wiring in `jarvis.tsx`:**
```tsx
initJarvisSession().then(async (id) => {
  sessionIdRef.current = id;
  await deliverMorningBriefing(id);
});
```

---

### Gemini Search Grounding (`src/lib/gemini.ts`)

JARVIS can now perform real-time web searches using Gemini's native Google Search Grounding tool. Results include structured source attribution and are classified into typed layouts before rendering.

#### Types

```typescript
export type SearchSource = {
  title: string;
  url: string;
};

export type SearchType =
  | "general"
  | "news"
  | "weather"
  | "comparison"
  | "howto"
  | "definition"
  | "local"
  | "code"
  | "math";

// On GeminiResponse:
groundingMetadata?: {
  groundingChunks?: Array<{ web?: { uri: string; title: string } }>;
  webSearchQueries?: string[];
};
```

#### `classifySearchType(responseText, userQuery): SearchType`

Regex-based classifier that inspects both the user's query and Gemini's response text to assign one of 9 search types. Runs client-side with zero latency — no extra API call.

| Type | Detection Signals |
|---|---|
| `news` | "latest", "breaking", "today", "yesterday", news-related verbs |
| `weather` | "weather", "temperature", "forecast", "rain", "humidity" |
| `comparison` | "vs", "versus", "compare", "difference between", "better than" |
| `howto` | "how to", "how do", "steps to", "tutorial", "guide" |
| `definition` | "what is", "define", "meaning of", "definition" |
| `local` | "near me", "nearby", "restaurant", "store", "address" |
| `code` | "code", "error", "fix", "debug", "function", "script" |
| `math` | numeric patterns, "calculate", "equation", "solve", "formula" |
| `general` | catch-all fallback |

#### `generateWithSearch(history, systemPrompt): Promise<{ text, sources, searchType }>`

1. Sends the conversation history to Gemini with `tools: [{ googleSearch: {} }]` — enables Google Search Grounding natively
2. Dual-key failover: tries primary key, falls back to `VITE_GEMINI_API_KEY_2` on 429/403
3. Extracts `groundingMetadata.groundingChunks` → maps to `SearchSource[]` (up to 4 shown in UI)
4. Runs `classifySearchType()` on the response text + last user message
5. Returns `{ text: string, sources: SearchSource[], searchType: SearchType }`

#### `search_query` Intent Routing in `handleCommand`

When `classifyIntent()` returns `search_query`, `handleCommand` bypasses the standard `generateWithTools()` function call pipeline entirely:

```
handleCommand()
  ├─ classifyIntent() → "search_query"
  ├─ generateWithSearch()      ← Google Search Grounding
  ├─ JarvisMessage { type: "search_result", metadata: { sources, searchType } }
  ├─ saveMessage(..., "search_result", { sources, searchType })
  └─ ttsQueue.enqueue(text)
```

Standard non-search intents continue to use `generateWithTools()` with the 7 function call tools unchanged.

---

### `SearchResult` Component (`src/components/jarvis/search-result.tsx`)

Renders Gemini search grounding results with a type-appropriate header and full source attribution.

**Structure:**
1. **Header bar** — icon + label, both keyed to `searchType`, monospace uppercase

| SearchType | Icon | Label |
|---|---|---|
| `general` | `Search` | Search Result |
| `news` | `Newspaper` | Latest News |
| `weather` | `Cloud` | Weather |
| `comparison` | `Scale` | Comparison |
| `howto` | `List` | How To |
| `definition` | `HelpCircle` | Definition |
| `local` | `MapPin` | Local Results |
| `code` | `Code2` | Code / Technical |
| `math` | `Calculator` | Math |

2. **Content area** — `ReactMarkdown` renders the full Gemini response with GFM support; `className="jarvis-markdown"` for CSS scoping
3. **Sources section** — rendered only when `sources.length > 0`; shows up to 4 sources as clickable links with hostname extraction via `getSafeHostname()`, hover color transition `#38bdf8` → `#7dd3fc`, external link icon

---

### `AICore` Component — Redesigned (`src/components/jarvis/ai-core.tsx`)

The original complex SVG orb (concentric arcs, radar sweep, pulse rings, HUD brackets) has been replaced with a minimal precision circle. The design philosophy shifted to match the Linear/Perplexity aesthetic of the new JARVIS page.

**Props:**
```typescript
interface AICoreProps {
  voiceState: JarvisVoiceState;
  isAwake: boolean;
  size?: number;        // default: 120
  onClick?: () => void; // optional — makes orb tappable; absent on non-voice-supported browsers
}
```

**Visual behavior by state:**

| State | Border | Box-Shadow Glow | Mic Icon Color | Extra |
|---|---|---|---|---|
| `idle` | `rgba(255,255,255,0.08)` | `rgba(56,189,248,0.06)` | `#52525b` grey | None |
| `listening` | `rgba(56,189,248,0.4)` sky-blue | `rgba(56,189,248,0.15)` | `#38bdf8` blue | None |
| `processing` | `rgba(251,191,36,0.25)` amber | `rgba(251,191,36,0.08)` | `#fbbf24` amber | Spinning dashed amber ring at `inset: -3px` |
| `speaking` | `rgba(52,211,153,0.25)` green | `rgba(52,211,153,0.08)` | `#34d399` green | `scale: [1, 1.04, 1]` breathe loop (2s) |

- The processing ring is a separate `motion.div` with `border: 1px dashed rgba(251,191,36,0.3)` animated to `rotate: 360` on 2.5s linear loop
- All color and shadow transitions use `transition: "border-color 0.3s ease, box-shadow 0.3s ease"` inline
- Mic icon size = `Math.round(size * 0.25)` — scales proportionally

---

### Gemini Function Calling (`src/lib/gemini.ts`)

JARVIS uses Gemini's native function calling API — not JSON-in-text parsing. 7 tool declarations for non-search intents:

| Tool | Triggers When… |
|---|---|
| `create_task` | User mentions something to do, a reminder, deadline, or meeting |
| `save_memory` | User says "remember that", shares a preference, or mentions something persistent |
| `get_today_tasks` | User asks about their day, schedule, or pending work |
| `get_pending_tasks` | User asks about backlog or unfinished tasks |
| `recall_memories` | User asks what JARVIS remembers or references past context |
| `delete_task` | User says to remove or cancel a task |
| `update_task` | User wants to reschedule or modify a task |

**`generateWithTools()` flow:**
1. First call to Gemini with full tool declarations
2. If Gemini returns a `functionCall` part → execute the tool via `executeToolCall()`
3. Second call with the tool result appended as a `functionResponse`
4. Return the final natural-language text to the user

Both calls use dual-key failover: primary → fallback on 429/403. No third-party library — pure REST.

---

### 6-State Audio State Machine (`src/lib/jarvis.ts`)

```
idle → listening → processing → speaking → idle
                                         → interrupted → listening
                              → error → idle
```

Invalid transitions are blocked with `canTransitionTo()`. Every state change is reflected in the UI label, orb visual, and CSS animations simultaneously.

| State | Orb Visual | Status Dot |
|---|---|---|
| `idle` | Dim border, grey mic | `#52525b` no pulse |
| `listening` | Blue border + glow | `#38bdf8` pulsing |
| `processing` | Amber border + spinning ring | `#fbbf24` pulsing |
| `speaking` | Green border + breathe animation | `#34d399` pulsing |
| `interrupted` | Resets to idle | `#f97316` no pulse |
| `error` | Resets to idle | `#f87171` no pulse |

---

### TTSQueue (`src/lib/jarvis.ts`)

- Splits JARVIS responses into sentences at `.!?` boundaries and `\n` line breaks
- Plays each sentence sequentially via `SpeechSynthesis`
- Prefers Google/Daniel/Alex voices at 0.95 rate, 0.9 pitch
- `interrupt()` cancels the active utterance, clears the queue, transitions to `interrupted` → `listening` after 800ms
- Interrupt detection: while `voiceState === "speaking"`, if the recognition detects "stop", "wait", "hold on", "shut up", or "pause" → fires `ttsQueue.interrupt()`

---

### Intent Pre-Classifier (`src/lib/jarvis.ts`)

Before every Gemini call, `classifyIntent(message)` runs a regex-based keyword scan and returns one of 7 intent types:

| Intent | Sample Triggers | Routes To |
|---|---|---|
| `task_creation` | "remind me", "add task", "tomorrow at", "deadline", "book a" | `generateWithTools()` |
| `memory_capture` | "remember that", "save this", "make a note" | `generateWithTools()` |
| `task_query` | "what do I have", "what's today", "pending tasks" | `generateWithTools()` |
| `memory_query` | "what do you remember", "what did I tell you" | `generateWithTools()` |
| `task_management` | "delete task", "reschedule", "cancel meeting" | `generateWithTools()` |
| `search_query` | "search for", "look up", "latest news", "what happened", "price of" | `generateWithSearch()` |
| `conversation` | everything else | `generateWithTools()` |

`search_query` is the only intent that bypasses function calling entirely and routes to Google Search Grounding. All other intents receive the intent as a hint appended to the system prompt.

---

### Session Management (`src/lib/jarvis.ts`)

On JARVIS page mount → `initJarvisSession()`:
1. Loads recent session summaries (last 3) from `jarvis_sessions`
2. Loads recent memories (last 20) from `jarvis_memory`
3. Builds and caches the system prompt with memories + summaries + today's tasks
4. Creates a new session row in `jarvis_sessions`

Every message → `saveMessage()` persists to `jarvis_messages` (fire-and-forget, non-blocking).

**Extended `messageType` values:** `"conversation"` | `"task_created"` | `"memory_saved"` | `"error"` | `"morning_briefing"` | `"search_result"`

On page leave (unmount + `beforeunload`) → `endSession()`:
1. If ≥ 4 messages, calls Gemini to generate a 2-3 sentence session summary
2. Updates `jarvis_sessions` with `ended_at`, `session_summary`, `message_count`

All failures are silently caught — JARVIS never crashes due to missing Supabase tables.

---

### System Prompt Builder (`src/lib/jarvis.ts`)

`buildJarvisSystemPrompt()` injects on every fresh session:
- Current date, time, today's key, tomorrow's key
- User's personal context from `localStorage["jarvis:user-context"]`
- All pending tasks for today (title, time, priority)
- High-priority tasks flagged separately
- All persistent memories (last 20, by type)
- Last 3 session summaries
- Full JARVIS personality spec (honest, direct, non-sycophantic, push-back capable, emotionally aware)
- Navigation routing rules (`[NAVIGATE:/route]` block)

---

### Conversation History Management

Module-level `conversationHistory` array in `jarvis.ts`:
- Starts empty per page load
- Each turn appends `{ role: "user", parts: [...] }` + `{ role: "model", parts: [...] }`
- Capped at 20 turns (40 entries) to prevent token bloat
- System prompt injected as a fake first user+model exchange per Gemini's requirement (no native `system` role in REST API)

**`search_query` history:** Search responses are also written into `conversationHistory` — `{ role: "model", parts: [{ text: searchResult.text }] }` — so follow-up conversation references prior search results correctly.

---

## App Shell & Navigation

### Desktop Sidebar (`src/components/app-shell.tsx`)
- Collapsible: 224px (expanded) ↔ 60px (collapsed) via Framer Motion spring
- Collapse state persisted to `localStorage["sidebar-collapsed"]`
- Active route: animated background pill + left-edge accent bar (both via `layoutId`)
- JARVIS nav item: pulsing dot when active
- Hover tooltips on collapsed nav items

### Mobile Bottom Nav
- Fixed floating pill: `bottom: calc(0.75rem + env(safe-area-inset-bottom, 0px))`
- `backdropFilter: blur(20px)` glass effect
- 4 primary routes + "More" sheet with all routes
- Active indicator via `layoutId="mobile-active-dot"`

---

## Architecture

### Global External Store (no Context API)
`store.ts`, `link-board.ts`, `important-messages.ts`, `image-board.ts`, `horizon.ts`, `timeline.ts`, `jarvis.ts`, `voice-settings.ts` all use `useSyncExternalStore` with module-level state + subscriber Set. Synchronous, zero cascading re-renders across the tree.

### Optimistic Mutations
Every write immediately updates local state → async Supabase persist. On failure: state rolls back + `toast.error()`. Users never wait for a network round-trip.

### React Portal for Modals
`MatrixModal` renders via `createPortal(…, document.body)`, escaping Framer Motion's CSS transform ancestors that break `position: fixed` stacking contexts.

### JARVIS SpeechRecognition Singleton
One module-level `recRef` in `jarvis.ts`. React components call `jarvis.activate()`, `jarvis.dismiss()`, `jarvis.sendText()` — never instantiate their own `SpeechRecognition`. Prevents double-instance conflicts between the floating orb and the JARVIS page.

### Gemini Dual-Key Failover
```
Primary key attempt
  → ok: return response
  → 429 or 403 + fallback key exists: retry with fallback key
  → no fallback or other error: return error text
```
All three entry points implement this pattern: `_request()` (text), `_rawRequest()` (raw, for function call detection), and `generateWithSearch()` (search grounding).

### JARVIS Task Creation (Module-Level, Outside React)
`addTaskDirect(input)` in `horizon.ts` is a standalone async function — not a hook. Inserts to Supabase, updates `state.tasks`, re-sorts, emits to all `useHorizon()` subscribers. The task appears in Horizon calendar immediately.

### Morning Briefing Idempotency
`shouldDeliverMorningBriefing()` gates on `localStorage["jarvis:last-briefing-date"]`. `markBriefingDelivered()` is called only after a successful Gemini response — not before. This means if the API fails, the briefing is retried on the next mount within the same calendar day.

### Cursor-Based DnD Collision (Desktop)
Target cell recomputed from `activatorEvent.clientX + delta.x` / `activatorEvent.clientY + delta.y` — not dnd-kit's default rect (which lags by pointer grab offset). Makes folder drops land exactly where the ghost appears.

### Horizon Calendar Viewport-Fit (Desktop)
`md:flex-1 md:grid-rows-6` with `md:aspect-auto md:h-full` cells. The complete 6-week grid always fits the viewport without scrolling on desktop.

### Timeline Task Encoding
Timeline tasks live in `horizon_tasks`. Description field encodes: `[timeline:2026-05:gym] 🏋️ Gym Session`. `useTimeline()` filters with `/^\[timeline:([^:]+):([^\]]+)\]/`. Reuses all of Horizon's CRUD, realtime, and task completion infrastructure with zero schema duplication.

---

## Design Language

### JARVIS Palette (scoped to `/jarvis` route and floating orb)

The JARVIS page uses a completely independent palette from the rest of the app — precision minimal, not holographic:

| Token | Value | Usage |
|---|---|---|
| Background | `#0a0a0a` | Page background |
| Surface | `#111111` | Input bar |
| Border | `#1f1f1f` | All dividers, panel borders |
| Text primary | `#f0f0f0` | Headings, time display |
| Text secondary | `#a1a1aa` | JARVIS message text |
| Text muted | `#6b6b6b` | Timestamps, state labels |
| Text dim | `#52525b` | Inactive controls, quick commands |
| Text ghost | `#3f3f46` | Monospace system labels |
| Accent | `#38bdf8` | Active state, links, mic icon when listening |
| Accent hover | `#7dd3fc` | Source link hover |
| Success | `#34d399` | Speaking state, task-created pills |
| Warning | `#fbbf24` | Processing state |
| Error | `#f87171` | Error state, high-priority count |

### App-Wide Colour System — Arctic Glass Futuristic

All tokens are `oklch` CSS variables in `src/styles.css`.

| Token | Value | Hex | Usage |
|---|---|---|---|
| `--background` | `oklch(0.10 0.02 250)` | ~#09090F | Page background |
| `--surface-1` | `oklch(0.15 0.025 245)` | ~#111520 | Sidebar, modals |
| `--surface-2` | `oklch(0.18 0.03 245)` | ~#141A28 | Cards, dropdowns |
| `--surface-3` | `oklch(0.22 0.035 245)` | ~#1A2230 | Inputs, elevated cards |
| `--foreground` | `oklch(0.97 0.01 240)` | ~#F2F4FA | Primary text |
| `--primary` | `oklch(0.76 0.12 235)` | ~#7DD3FC | Arctic sky-blue accent |

**Arctic blue opacity scale:**
- Borders (default): `rgba(125,211,252,0.08–0.10)`
- Borders (hover): `rgba(125,211,252,0.20–0.28)`
- Background (subtle): `rgba(125,211,252,0.025–0.05)`
- Background (hover): `rgba(125,211,252,0.045–0.09)`
- Glow (ambient): `rgba(125,211,252,0.12–0.18)`

### Motion Principles
- **Easing:** `[0.22, 1, 0.36, 1]` — custom spring-like cubic-bezier — used on virtually all transitions
- **Durations:** 0.15–0.22s micro (hover, toggle), 0.28–0.35s page-level, 0.4–0.5s entrances
- **`AnimatePresence`** wraps every conditional mount — no abrupt DOM removals
- **Hover lifts:** `y: -1` to `y: -2` + `scale: 1.02–1.08` on interactive cards
- **Stagger:** `staggerChildren: 0.04–0.07s` on lists and grids
- **Ambient loops:** today-cell glow, JARVIS orb breathe (speaking state) — slow, purposeful, never decorative

### JARVIS CSS Keyframes (`src/styles.css`)

| Keyframe | Class | Duration |
|---|---|---|
| `jarvis-scan` | `.jarvis-scan-line` — top→bottom sweep | 4s |
| `jarvis-blink` | `.jarvis-blink` — cursor/indicator blink | 1s |
| `jarvis-freq` | `.jarvis-freq-bar` — frequency bars | 0.4–0.8s staggered |
| `jarvis-eq` | `.jarvis-eq-bar` — header EQ animation | 0.6–1.2s staggered |

### Component Patterns
- **Cards:** `rounded-2xl border rgba(125,211,252,0.08)` + `rgba(125,211,252,0.025)` background
- **Inputs:** `rounded-xl` arctic blue border, blue glow on focus
- **Modals:** React Portal + `AnimatePresence` fade+scale + arctic blue top-edge highlight
- **Primary buttons:** arctic blue gradient, dark text (`#050609`), blue glow shadow
- **Monospace text:** `Space Mono` — JARVIS HUD labels, clock, version badge, state indicators, tab labels, source type labels

---

## Splashscreen
- Fires once per page session (`splashDone` in React state — route changes don't re-trigger it)
- Four-quadrant SVG grid icon + wordmark + tagline
- Outer glow ring: `scale: 0.6 → 1`
- Loading bar: left → right sweep
- Fades out after 1.6 seconds via `AnimatePresence`

---

## Feature Status

| Feature | Status | Notes |
|---|---|---|
| Websites directory | ✅ Complete | CRUD, tag filter, sort, favicon, fuzzy search, usage tracking |
| Desktop launcher | ✅ Complete | dnd-kit grid, folders, snap-to-grid, right-click, folder overlay |
| Prompts library | ✅ Complete | CRUD, copy, usage tracking, fuzzy search |
| Links board | ✅ Complete | CRUD, Supabase realtime |
| Images board | ✅ Complete | Supabase Storage upload/rename/delete |
| Messages board | ✅ Complete | CRUD, realtime, Markdown, Gemini context injection |
| Horizon calendar | ✅ Complete | Month nav, today glow, task dots, viewport-fit desktop |
| Horizon timeline | ✅ Complete | Grouped by hour, animated rail, time-of-day colored nodes |
| Horizon tasks | ✅ Complete | Full CRUD, priority stripes, expand/collapse, realtime |
| Horizon checkbox fix | ✅ Fixed | Checkbox fills `bg-sky-300/70` on complete — tick is visible |
| Horizon reminders | ✅ Complete | Default ON, holographic toggle, FCM pipeline |
| Timeline life planner | ✅ Complete | 6 months, 9 domains, Gemini AI schedule, filter, completion |
| Insights — AI usage | ✅ Complete | Charts, ranked lists, Gemini insights, 30s auto-refresh |
| Insights — Horizon | ✅ Complete | Stat cards, trend chart, priority donut |
| AI chat (Ask) | ✅ Complete | Multi-turn, workspace context, voice, Markdown |
| Voice mic input | ✅ Active | Chrome/Edge only; gates on `isSpeechSupported` |
| Horizon voice assistant | ✅ Complete | Wake word, command parsing, TTS, voice settings overlay |
| **JARVIS — Morning Briefing** | ✅ Complete | Once-per-day via localStorage gate; today's tasks injected; spoken via TTSQueue |
| **JARVIS — Google Search Grounding** | ✅ Complete | `generateWithSearch()`, native `googleSearch` tool, `search_query` intent routing |
| **JARVIS — Search Result UI** | ✅ Complete | `SearchResult` component, 9 typed layouts, source attribution with up to 4 links |
| **JARVIS — search_query intent** | ✅ Complete | 7th intent type; bypasses function calling; routes to search grounding pipeline |
| **JARVIS — UI Overhaul (v3)** | ✅ Complete | Linear/Perplexity aesthetic; `#0a0a0a`; minimal AICore; 3-column with flat tab bar |
| **JARVIS — AICore redesign** | ✅ Complete | Minimal circle + Mic icon; state-reactive border/glow; processing spinner ring |
| **JARVIS — Morning Briefing bubble** | ✅ Complete | Distinct `Sparkles`-headered card in chat feed |
| JARVIS — Wake word system | ✅ Complete | Passive + command modes, 7s timeout, inline commands |
| JARVIS — Gemini function calling | ✅ Complete | 7 tools, native API (no JSON parsing), dual-call flow |
| JARVIS — 6-state audio machine | ✅ Complete | idle/listening/processing/speaking/interrupted/error |
| JARVIS — TTSQueue | ✅ Complete | Sentence splitting, interrupt detection, voice preference |
| JARVIS — Intent classifier | ✅ Complete | Regex pre-classifier, 7 intent types (inc. `search_query`), hint injected to Gemini |
| JARVIS — Persistent sessions | ✅ Complete | Requires `JARVIS_EVOLUTION_SETUP.sql`; graceful degradation without it |
| JARVIS — Memory banks | ✅ Complete | 5 memory types, filterable panel, delete, recalled_count tracking |
| JARVIS — Session history | ✅ Complete | Paginated list, AI summaries, delete |
| JARVIS — 3-tab right panel | ✅ Complete | Chat / History / Memory with flat tab bar |
| JARVIS — Duplicate messages fix | ✅ Fixed | `userMsg` patched once; `jarvisMsg` appended separately |
| JARVIS — messageType extended | ✅ Complete | Supports `morning_briefing` and `search_result` in DB + feed |
| JARVIS floating orb | ✅ Complete | Global, state-reactive (pulse/spin/waveform) |
| Context Window | ✅ Complete | Personal context editor, `localStorage["jarvis:user-context"]` |
| Collapsible sidebar | ✅ Complete | Spring animation, icon-only, hover tooltips, localStorage persisted |
| Splashscreen | ✅ Complete | Icon + wordmark + loading bar, fades at 1.6s |
| PWA installable | ✅ Complete | `manifest.json` + `sw.js` fully wired |
| Push notifications | ✅ Complete | FCM init, permission toggle, token persistence, Edge Function cron |
| Platform abstraction | ✅ Complete | `src/lib/platform/` — interfaces for all native surfaces |
| Capacitor Android | ✅ Configured | `capacitor.config.ts` + native JarvisPlugin bridge stubbed |
| In-app notification banners | ✅ Complete | Instagram-style via `InAppNotificationHost` in `__root.tsx` |

---

## Gotchas

- **`VITE_` prefix required** — all env vars must be `VITE_`-prefixed or they're `undefined` at runtime.
- **Run all 6 SQL files in order** — missing files cause silent empty states (`PGRST205` errors are swallowed with `console.debug`/`console.warn`).
- **Always use `gemini-2.5-flash`** — never `gemini-2.0-flash` or `gemini-flash-latest`. `gemini-2.0-flash` has `limit: 0` on the free tier in some regions. `gemini-2.5-flash` is what is used everywhere in this codebase.
- **`VITE_GEMINI_API_KEY_2` must be a different Google account** — same account = same quota, no benefit. For genuine dual-quota, use two separate Gmail accounts.
- **RLS is off** — anyone with the Supabase anon key can read and write all data. Fine for single-user. Add Auth + RLS before any shared deployment.
- **Voice input is Chrome/Edge only** — `SpeechRecognition` doesn't exist in Firefox or Safari. `isVoiceAssistantSupported` / `isSpeechSupported` gate all voice UI.
- **JARVIS passive listening requires mic permission already granted** — `jarvis.autoStartIfEnabled()` checks `navigator.permissions.query({ name: "microphone" })`. If the permission is `"prompt"` or `"denied"`, passive mode does not start. It never triggers a browser permission dialog automatically.
- **Single SpeechRecognition instance** — JARVIS owns the global `recRef`. The Horizon voice overlay and JARVIS cannot run simultaneously — the browser only honours one. Use one voice interface at a time.
- **JARVIS session + memory tables are optional** — without `JARVIS_EVOLUTION_SETUP.sql`, JARVIS still works but doesn't persist sessions or memories. All Supabase calls are wrapped in `try/catch` with silent degradation.
- **Morning briefing fires once per calendar day** — gated via `localStorage["jarvis:last-briefing-date"]`. Clearing localStorage or changing the system date resets it. If Gemini returns a 400/error, the briefing date is NOT marked — it will retry on next mount that same day.
- **Search grounding requires `VITE_GEMINI_API_KEY`** — the `googleSearch` tool is part of the standard Gemini API; no separate Search API key is needed. However, search grounding is only available on models that support it (`gemini-2.5-flash` supports it).
- **`search_query` intent uses no tools** — it completely bypasses the 7-tool function calling pipeline. JARVIS cannot simultaneously search the web and create a task in one message. Intent classifier decides the path.
- **`routeTree.gen.ts` is auto-generated** — never edit. If it fails to regenerate after adding a route file, restart the dev server.
- **Timeline month range is hardcoded** — `TIMELINE_MONTHS` covers May–Oct 2026. To extend, add entries to the array.
- **Timeline tasks are in `horizon_tasks`** — the `[timeline:…]` description prefix is what links them. Never strip it manually or the Timeline planner loses those tasks.
- **Supabase realtime = full refetch** — `postgres_changes` triggers a complete `loadAll()` call. For high-frequency writes, debounce the refetch.
- **Splashscreen fires once per session** — route changes don't re-trigger it; only a full browser reload does.
- **Push notifications require all Firebase vars** — without them, the app logs `[fcm] Firebase not configured` and degrades gracefully.
- **JARVIS task time is UTC** — `task_time` has no timezone. Push reminder timing may be off if the user's local timezone differs from UTC.
- **Capacitor build requires Android Studio** — `npm run cap:open` opens Android Studio which must be installed separately. Always `npm run build` before syncing native assets.
- **JARVIS design is intentionally isolated** — the `/jarvis` route uses its own `#0a0a0a` palette and Space Mono typography. Do not bleed the app-wide arctic-glass `oklch` tokens into JARVIS components — the two systems are deliberately separate.

---

## User Preferences

- Code style: clean, senior-level TypeScript; no verbose JSX comments; no redundant CSS; `any` only when truly unavoidable
- Modals must be centered regardless of page scroll (React Portal required for all modals)
- Desktop grid must not shift layout on load or drag (fixed `gridTemplateRows` in px, never `auto`)
- Arctic Glass aesthetic: consistent arctic blue (`rgba(125,211,252,…)`) across all borders, accents, glows — applies to all routes **except** `/jarvis`
- JARVIS has its own isolated precision-minimal palette: `#0a0a0a` bg, `#1f1f1f` dividers, `#38bdf8` sole accent — no arctic-glass bleedover
- Zero purple/violet accent colors anywhere except Timeline domain badges (semantic per-domain colors)
- Semantic priority accents (blue/amber/red at low opacity) only in Horizon and JARVIS task contexts
- No over-animation — every animated element must feel premium, purposeful; never decorative or distracting
- Horizon reminder toggle defaults to **ON** for all new tasks
- Sidebar collapse state persists via localStorage
- `Space Mono` monospace font for JARVIS HUD elements, clocks, system labels, and tab headers
- Gemini model: always `gemini-2.5-flash` — never `gemini-2.0-flash` or `gemini-flash-latest`
- Morning briefing prompt tone: warm but direct, like a sharp friend — no cheesy motivational language, no markdown in the spoken output, under 100 words
