# AI Metrics — Personal AI Operating System

A dark-themed, premium personal workspace for managing AI tools, prompts, a drag-and-drop desktop launcher, links, images, messages, a calendar task manager (Horizon), a JARVIS voice AI assistant, and an AI chat powered by Google Gemini. All data persists in real time via Supabase. Installable as a PWA.

---

## Run & Operate

| Command | Purpose |
|---|---|
| `npm run dev` | Start dev server on port 5000 |
| `npm run build` | Production Vite build → `dist/` |
| `npm run preview` | Preview production build locally |
| `npm run lint` | ESLint |
| `npm run format` | Prettier |

**Port 5000** is hard-coded in `package.json` (`vite dev --port 5000 --host 0.0.0.0`) and `.replit` (`waitForPort = 5000`). Change both together or neither.

---

## Environment Variables

Set all of these in Replit Secrets (never commit them).

| Key | Required | Description |
|---|---|---|
| `VITE_SUPABASE_URL` | ✅ | Supabase project URL (`https://<ref>.supabase.co`) |
| `VITE_SUPABASE_ANON_KEY` | ✅ | Supabase public anon key (safe to expose in browser) |
| `VITE_GEMINI_API_KEY` | ✅ | Google Gemini API key — powers Ask page chat and JARVIS AI |
| `VITE_FIREBASE_API_KEY` | ⚠️ FCM | Firebase web API key |
| `VITE_FIREBASE_AUTH_DOMAIN` | ⚠️ FCM | Firebase auth domain |
| `VITE_FIREBASE_PROJECT_ID` | ⚠️ FCM | Firebase project ID |
| `VITE_FIREBASE_STORAGE_BUCKET` | ⚠️ FCM | Firebase storage bucket |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | ⚠️ FCM | Firebase messaging sender ID |
| `VITE_FIREBASE_APP_ID` | ⚠️ FCM | Firebase app ID |
| `VITE_FIREBASE_VAPID_KEY` | ⚠️ FCM | VAPID key for web push (Firebase Console → Cloud Messaging) |

> All `VITE_` prefixed vars are injected by Vite into client bundle. FCM vars are optional — the app degrades gracefully without them (no push notifications, but everything else works).

---

## Stack

| Layer | Technology | Version |
|---|---|---|
| Runtime | Node | 20 |
| SPA framework | React | 19 |
| Router | TanStack Router (file-based) | v1 |
| Build tool | Vite | 7 |
| Styling | Tailwind CSS (`@tailwindcss/vite` plugin) | v4 |
| Design tokens | Custom oklch variables | `src/styles.css` |
| UI primitives | Radix UI + shadcn/ui patterns | latest |
| Animations | Framer Motion | 12 |
| Drag & Drop | @dnd-kit/core + @dnd-kit/modifiers + @dnd-kit/sortable | 6/9/10 |
| Database / Realtime | Supabase JS v2 | 2 |
| AI — Ask page | Google Gemini REST API (`gemini-flash-latest`) | — |
| AI — JARVIS | Google Gemini REST API + Web Speech API + SpeechSynthesis | — |
| Voice | Web Speech API (browser-native) | — |
| Push notifications | Firebase Cloud Messaging (FCM) | 12 |
| Toasts | Sonner | 2 |
| Markdown | react-markdown + remark-gfm | 10/4 |
| Charts | Recharts | 2 |
| Forms | react-hook-form + zod | 7/3 |
| Package manager | npm | — |

---

## Database Setup

Five SQL files must be run in Supabase SQL Editor **in this exact order**:

| File | Tables Created | Run Order |
|---|---|---|
| `SETUP.sql` | `items`, `desktop_layout`, `desktop_folders`, `usage_logs` | 1st |
| `SETUP_NEW_TABS.sql` | `links`, `messages` | 2nd |
| `HORIZON_SETUP.sql` | `horizon_tasks` | 3rd |
| `TIMELINE_SETUP.sql` | `timeline_months` | 4th |
| `NOTIFICATIONS_SETUP.sql` | `notification_tokens`, `reminder_sent_log` | 5th |

**RLS is disabled** on all tables. Suitable for single-user personal use. Add RLS + Supabase Auth before going multi-user.

### Schema reference

**`items`** — AI websites directory
```sql
id uuid, title text, url text, description text, tags text[], created_at timestamptz, last_opened_at timestamptz
```

**`desktop_layout`** — icon positions on the desktop grid
```sql
id text (item id), position integer, type text ('item'|'folder')
```

**`desktop_folders`** — folder groups on the desktop
```sql
id uuid, name text, item_ids text[], created_at timestamptz
```

**`usage_logs`** — analytics events
```sql
id uuid, event_type text ('open'|'copy'), item_id uuid, item_title text, created_at timestamptz
```

**`links`** — link board entries
```sql
id uuid, title text, url text, description text, created_at timestamptz
```

**`messages`** — important messages / notes
```sql
id uuid, title text, content text (Markdown), created_at timestamptz
```

**`horizon_tasks`** — Horizon calendar tasks
```sql
id uuid, title text, description text, task_date date (YYYY-MM-DD),
task_time time (HH:MM), priority text ('low'|'medium'|'high'),
completed boolean, notification_enabled boolean, created_at timestamptz
```

**`timeline_months`** — Timeline monthly context + generated schedule
```sql
month_key text (PK, e.g. "2026-05"), context text, generated_schedule text (JSON),
updated_at timestamptz
```
> Timeline tasks themselves live in `horizon_tasks` — identified by descriptions starting with `[timeline:<monthKey>:<domainId>]`

**`notification_tokens`** — FCM device tokens
```sql
id uuid, token text (unique), created_at timestamptz, updated_at timestamptz
```

**`reminder_sent_log`** — deduplication for push scheduler
```sql
id uuid, task_id uuid, sent_at timestamptz
```

---

## PWA

AI Metrics is installable as a Progressive Web App on Android, iOS (Safari → Add to Home Screen), Windows (Edge/Chrome).

| File | Purpose |
|---|---|
| `public/manifest.json` | App name, icons, theme colour, display mode, PWA shortcuts (Horizon, Ask) |
| `public/sw.js` | Service worker: cache-first static assets, push notification handler, `notificationclick` routing |
| `public/firebase-messaging-sw.js` | Background FCM push handler — receives pushes when app is closed |
| `index.html` | Registers service worker on load; `<link rel="manifest">`, Apple PWA meta tags |

**Installing:** Chrome/Edge → install icon in address bar. Android → browser menu → "Add to Home Screen". iOS Safari → Share → "Add to Home Screen".

---

## Push Notifications — Full Setup Guide

### 1. Run SQL
Execute `NOTIFICATIONS_SETUP.sql` in Supabase SQL Editor (after `HORIZON_SETUP.sql`).

### 2. Deploy the Edge Function
```bash
npx supabase functions deploy send-reminders --project-ref <YOUR_PROJECT_REF>
```

### 3. Set Edge Function secret (Supabase Dashboard → Settings → Edge Functions)
| Secret | Value |
|---|---|
| `FIREBASE_SERVICE_ACCOUNT` | Full JSON from Firebase Console → Project Settings → Service Accounts → Generate new private key |

### 4. Schedule the cron (Supabase SQL Editor)
Enable `pg_cron` and `pg_net` extensions first, then:
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

### How the pipeline works
1. **Token registration** — `initFCM()` in `src/lib/fcm.ts` registers the browser with FCM and upserts the token to `notification_tokens`. Only runs if permission was already granted — never prompts on startup.
2. **Permission request** — Only triggered when user explicitly enables a reminder toggle on a task. Never on app load.
3. **Background SW** — `public/firebase-messaging-sw.js` receives push events when the app tab is closed.
4. **Foreground handler** — `onMessage()` in `fcm.ts` shows a `Notification` API popup while the app is open.
5. **Scheduler** — Supabase Edge Function `send-reminders` runs every minute, finds tasks due in the next 15 minutes, sends FCM HTTP v1 push to all registered tokens, logs each dispatch to `reminder_sent_log` to prevent duplicates.
6. **Routing** — Both SW `notificationclick` and foreground click navigate the user to `/horizon`.

---

## File Structure

```
/
├── index.html                          # App shell — manifest, SW registration, Apple PWA meta
├── public/
│   ├── favicon.png                     # App icon (512×512 PNG)
│   ├── manifest.json                   # PWA manifest
│   ├── sw.js                           # Service worker (cache-first + push handler)
│   └── firebase-messaging-sw.js        # Background FCM push handler
├── SETUP.sql                           # Supabase schema: core tables
├── SETUP_NEW_TABS.sql                  # Supabase schema: links, messages
├── HORIZON_SETUP.sql                   # Supabase schema: horizon_tasks
├── NOTIFICATIONS_SETUP.sql             # Supabase schema: notification_tokens, reminder_sent_log
└── src/
    ├── styles.css                      # Design tokens (oklch vars, Tailwind @theme inline)
    ├── main.tsx                        # React root, RouterProvider
    ├── router.tsx                      # TanStack Router instance
    ├── routeTree.gen.ts                # Auto-generated route tree (never edit manually — except to add new routes if Vite plugin hasn't regenerated)
    │
    ├── routes/
    │   ├── __root.tsx                  # Root layout: Splashscreen + AppShell + Toaster + VoiceOverlay + JarvisFloatingOrb + InAppNotificationHost
    │   ├── index.tsx                   # /          Websites directory
    │   ├── desktop.tsx                 # /desktop   DnD icon launcher
    │   ├── prompts.tsx                 # /prompts   Prompt library
    │   ├── links.tsx                   # /links     Link board
    │   ├── images.tsx                  # /images    Image board (Supabase Storage)
    │   ├── messages.tsx                # /messages  Important messages
    │   ├── horizon.tsx                 # /horizon   Calendar + timeline task manager
    │   ├── insights.tsx                # /insights  Usage analytics + Horizon analytics
    │   ├── ask.tsx                     # /ask       Gemini AI chat + voice input
    │   └── jarvis.tsx                  # /jarvis    JARVIS fullscreen AI command center
    │
    ├── components/
    │   ├── app-shell.tsx               # Sidebar nav + mobile bottom nav + page layout wrapper
    │   ├── matrix-modal.tsx            # Shared modal (React Portal + Framer Motion)
    │   ├── page-header.tsx             # Reusable page title + action slot
    │   ├── sync-indicator.tsx          # Supabase sync status pill
    │   ├── voice-overlay.tsx           # Horizon voice assistant floating pill + settings
    │   ├── in-app-notification.tsx     # Instagram-style in-app notification banners
    │   ├── jarvis/
    │   │   ├── ai-core.tsx             # Animated holographic AI core (rings, radar, pulse)
    │   │   └── floating-orb.tsx        # Global JARVIS floating orb widget (all non-JARVIS pages)
    │   ├── desktop/
    │   │   ├── desktop-grid.tsx        # DnD grid (dnd-kit DndContext + SortableContext)
    │   │   ├── desktop-item.tsx        # Draggable website icon cell
    │   │   ├── folder-icon.tsx         # Draggable + droppable folder cell
    │   │   ├── folder-overlay.tsx      # Folder detail modal (rename, delete, remove items)
    │   │   ├── drag-ghost.tsx          # DragOverlay ghost (lightweight)
    │   │   └── command-palette.tsx     # Right-click context menu on desktop grid
    │   ├── image-board/                # Image upload / rename / delete modals
    │   ├── link-board/                 # Link card + add/edit modal
    │   ├── messages/                   # Message card + add/edit/delete modal
    │   └── ui/                         # shadcn/ui primitives (Button, Dialog, Select, Switch…)
    │
    ├── hooks/
    │   ├── use-mobile.tsx              # Breakpoint hook — true when viewport ≤ 768 px
    │   ├── use-voice-input.ts          # Web Speech API — VoiceState: idle | listening | processing
    │   ├── use-voice-assistant.ts      # Full Horizon voice assistant hook (wake word, commands, TTS)
    │   └── use-wake-word.ts            # Continuous background SpeechRecognition for keyword detection
    │
    └── lib/
        ├── github-data.ts              # Domain types + seed data — source of truth for TypeScript types
        ├── supabase.ts                 # Supabase JS client singleton (reads VITE_ env vars)
        ├── supabase-data.ts            # All DB read/write helpers (typed, no ORM)
        ├── store.ts                    # Global store (useSyncExternalStore) — websites, prompts, desktop
        ├── link-board.ts               # External store for links
        ├── important-messages.ts       # External store for messages
        ├── horizon.ts                  # External store for Horizon tasks + PRIORITY_CONFIG + addTaskDirect()
        ├── desktop-layout.ts           # Grid math: buildLauncherEntries, normalizeDesktopLayout
        ├── gemini.ts                   # Gemini REST API wrapper (UserContext builder, error mapping)
        ├── jarvis.ts                   # JARVIS global state store + voice engine + Gemini AI integration
        ├── usage-tracking.ts           # Tool-open + prompt-copy event logging, getInsightsData()
        ├── fcm.ts                      # Firebase Cloud Messaging: init, token, permission, onMessage
        ├── firebase.ts                 # Firebase app singleton
        ├── notifications.ts            # Notification abstraction helpers
        ├── voice-settings.ts           # Horizon voice assistant settings store
        ├── voice-commander.ts          # Horizon voice command parser and executor
        ├── utils.ts                    # cn() Tailwind class merge helper
        └── platform/                   # Platform abstraction layer (browser / PWA / Tauri)
            ├── index.ts                # Platform detection (isNative, isPWA, isBrowser, name, label)
            ├── notifications.ts        # NotificationService interface + BrowserNotificationService
            ├── storage.ts              # StorageService interface + LocalStorageService
            ├── system.ts               # TrayService, ShortcutService, StartupService, AppLifecycle (all stubs → Tauri-ready)
            ├── voice.ts                # VoicePlatformCapabilities + getVoicePlatformLimitations()
            └── window.ts               # WindowService (minimize, maximize, close, center, setTitle…)
```

---

## Pages

### `/` — Websites Directory
- Curated directory of AI tools / websites
- Add, edit, delete entries: title, URL, description, tags
- Tag filter chips — click to filter, click active to clear
- Sort: alphabetical, recently added, most opened
- Favicon auto-fetch via `https://www.google.com/s2/favicons?domain=…&sz=32`
- Tool opens logged to `usage_logs` for Insights analytics

### `/desktop` — Icon Launcher
- macOS-style drag-and-drop icon grid (fixed `gridTemplateRows` in px — never shifts on load or drag)
- Snap-to-grid with swap on drop
- Drag icon onto another icon → creates a folder automatically
- Right-click grid → "New Folder" context menu
- Folders are draggable and droppable — items can be added to or removed from folders via folder overlay
- Grid scrolls vertically when icons overflow the viewport
- Layout persists in `desktop_layout` + `desktop_folders` Supabase tables

### `/prompts` — Prompt Library
- Add, edit, delete personal prompts (title + body)
- One-click copy to clipboard with animated feedback
- Prompt copies tracked in `usage_logs` for Insights analytics

### `/links` — Link Board
- Quick-access URL cards: title, URL, optional description
- Add / edit / delete via modal
- Supabase realtime — changes sync live across tabs

### `/images` — Image Board
- Upload images to Supabase Storage (`public/` bucket)
- Rename, delete images
- Responsive masonry-style grid

### `/messages` — Important Messages
- Store notes, messages, reminders
- Full Markdown rendering (h1–h3, ul/ol, code blocks, blockquotes, tables, bold, italic, links)
- Add / edit / delete via modal
- Content is passed as context to Gemini AI on every Ask page request

### `/horizon` — Calendar & Timeline Tasks

**Calendar view:**
- Monthly grid — always 7 columns × 6 rows (42 cells)
- Full calendar fits in viewport on desktop without scrolling (compact layout, `grid-rows-6` + `flex-1` cells)
- AnimatePresence slide transitions when navigating months (left/right direction-aware)
- Today's date: white-bordered cell with breathing ambient glow (looping box-shadow pulse animation)
- Dates with tasks: small dot indicator + task count badge in top-right corner
- Day-of-week headers stagger in on mount

**Fullscreen task experience:**
- Clicking any date triggers a full-page overlay (`absolute inset-0 z-30`) — no modal, fully immersive
- Back button clears `selectedDate`, overlay fades out
- Task count line animates when count changes (`AnimatePresence mode="wait"`)

**Timeline task layout:**
- Tasks sorted chronologically, grouped by hour (e.g. "2 PM")
- Left column: time label (fades from left) + circular node (springs in + breathing glow) + vertical connector line (draws downward `scaleY`)
- Last group has no connector line
- Right column: task cards aligned to their time node

**Task cards:**
- Collapsed: checkbox, priority dot, title, time, bell icon (if reminder)
- Expanded (click anywhere): description, priority badge, Edit / Delete actions
- Expand uses `height: 0 → "auto"` with `AnimatePresence`
- Completed: fades to `opacity: 0.38`, title gets `line-through`
- Priority colours — Low: blue, Medium: amber, High: red (all at low opacity)

**Reminder toggle (redesigned):**
- ON: electric blue glow border, blue-tinted glass background, cyan gradient switch thumb with glow
- OFF: dark glass, dim border
- Default is **ON** for new tasks — user never needs to manually enable reminders

**Add/Edit task modal** (react-hook-form + zod):
- Title (required), description (optional)
- Time: 12-hour (hour + minute + AM/PM selects)
- Priority: three toggle buttons with semantic colour from `PRIORITY_CONFIG`
- Reminder toggle: blue holographic design (described above)

### `/insights` — Analytics

**Horizon analytics:**
- Done Today, Done This Week, Pending Today, Completion Rate stat cards
- Task Trend — Last 7 Days bar chart (Scheduled vs Completed)
- Priority Distribution donut chart
- Upcoming tasks, Total tasks, Busiest Day

**AI tool usage analytics:**
- Opens Today, Copies Today, Streak, Week-over-week delta
- Top Tool, Top Prompt, Avg/Day, Busiest Day
- Top Tools ranked list (with favicons)
- Usage Last 7 Days line chart (Tools + Prompts)
- Top Prompts ranked list
- Daily Activity bar chart, Hour of Day distribution
- AI Insights — auto-generated plain-English observations
- Recent Activity feed (last 10 events)
- All charts white-only (`rgba(255,255,255,0.12–0.6)`) — zero blue/purple
- Auto-refreshes every 30 seconds, manual refresh button

### `/ask` — AI Chat
- Gemini `gemini-flash-latest` multi-turn chat with full conversation history
- Full workspace context on every first turn: websites, prompts, links, messages, desktop folders
- System/context prompt prepended once; subsequent turns are raw user text
- Voice input (mic only): transcript injected into text field, user reviews + sends manually
- Starter chips for empty state: "Plan my next 90 minutes", "Brainstorm names for…", etc.
- Full Markdown rendering in assistant replies
- Animated chat bubbles (user: slides from bottom-right; assistant: slides from left)
- Thinking bubble: rotating Sparkles + 3-dot bounce
- Waveform: 5 bars animate height while mic is active

### `/jarvis` — JARVIS AI Command Center

**Overview:**
A fullscreen cinematic AI assistant interface with a deep space (`#020508`) background, electric blue holographic palette (`#00BFFF`, `#4DEBFF`). Scoped palette — blue only inside JARVIS, rest of app remains monochrome.

**Layout (desktop — 3 columns):**
- **Left panel** (220px): J.A.R.V.I.S wordmark, AI status indicator, real-time clock (updates every second), Horizon task stats (pending today, completed today, total active), wake phrase reference, quick command shortcuts
- **Center**: Animated AI Core + state label + transcript display
- **Right panel** (288px): scrollable conversation history with user/JARVIS message bubbles and task-created confirmation cards

**Animated AI Core:**
- 5 concentric rings rotating at different speeds and directions via CSS keyframe animations (`@keyframes jarvis-cw/ccw`) — GPU-accelerated via `transform`
- Radar sweep: rotating conic gradient (`conic-gradient`) with independent animation
- 3 pulse rings emanating from center with staggered delays
- Center orb: holographic radial gradient (`#4DEBFF → #00BFFF → #003060`) with breathing box-shadow animation
- Corner HUD brackets (4 corners)
- Crosshair lines
- State overlays: waveform bars (speaking), processing dots (thinking), dim waveform (listening)
- All animations speed up and brighten when JARVIS is awake

**Voice states:**
| State | Visual |
|---|---|
| idle | Slow rings, dim orb, no overlay |
| listening | Faster rings, bright orb, dim waveform bars |
| processing | Faster rings, pulsing orb, 3-dot bounce |
| speaking | Faster rings, waveform bars animate to voice |

**Wake word system:**
- Wake words: `"jarvis"`, `"hey jarvis"`, `"okay jarvis"` (case-insensitive, substring match)
- Module-level `SpeechRecognition` singleton — one instance globally, no conflicts
- Two modes: **passive** (continuous background, only detects wake words) and **command** (captures full utterance after wake word)
- Inline commands supported: "Hey Jarvis, what's on my schedule?" — parsed in a single recognition result
- Command timeout: 7 seconds of silence auto-dismisses back to passive mode
- `jarvis.enable()` / `jarvis.disable()` toggle the whole system; state persists in `localStorage`
- `jarvis.autoStartIfEnabled()` called on app start — resumes passive listening if previously enabled and mic permission is granted

**Gemini integration:**
- JARVIS personality system prompt: precise, confident, addresses user as "sir" occasionally, no filler phrases
- Full Horizon task context in every system prompt (up to 20 most recent tasks)
- Current date/time injected into every prompt
- Conversation history maintained (last 20 turns, deduplicated)
- Task creation via special JSON format in model response: `[TASKS: [...]]` block
- Navigation commands via `[NAVIGATE:/route]` block

**Natural language task creation:**
- JARVIS parses multi-task utterances: *"Tomorrow 8 PM gym and 10 PM project meeting"* → 2 tasks created simultaneously
- All JARVIS-created tasks have `notificationEnabled: true` automatically
- Tasks are created via `addTaskDirect()` (module-level, bypasses React hook) and appear immediately in Horizon via the shared external store
- Task confirmation shown as special card in chat panel with `CheckSquare` icons

**Navigation commands:**
- *"Open Horizon"* → `[NAVIGATE:/horizon]` → app navigates immediately
- Works for any route: `/horizon`, `/ask`, `/desktop`, `/prompts`, `/links`, `/images`, `/messages`, `/insights`, `/`

**Voice responses:**
- SpeechSynthesis API — prefers Google/Daniel/Alex voices if available
- Rate 0.95, pitch 0.9 for a measured, professional tone
- Cancelled immediately on new command

**Text input:**
- Full text command support — type any command and press Enter or click Send
- Input bar always visible at bottom with mic + send buttons

**Global Floating Orb:**
- Renders on all pages except `/jarvis`
- Fixed position: `bottom-[5.5rem] right-4` on mobile (above mobile nav), `bottom-6 right-6` on desktop
- State-reactive: pulse rings when active/listening, spin ring when processing, waveform bars when speaking
- Click when active: dismisses JARVIS back to passive mode
- Click when idle: navigates to `/jarvis`
- "J" badge shown when JARVIS is not yet enabled

---

## Architecture

### Global external store (no Context API)
`store.ts`, `link-board.ts`, `important-messages.ts`, `horizon.ts`, `jarvis.ts`, `voice-settings.ts` all use `useSyncExternalStore` with module-level state. Every subscriber gets the same snapshot synchronously — no Context cascading re-renders across the tree on every keystroke or route change.

### Optimistic mutations (Horizon, Links, Messages)
Every write immediately updates local state, then persists to Supabase. On failure, state rolls back and `toast.error` is shown. Users never wait for network round-trips.

### React Portal for modals
`MatrixModal` renders via `createPortal(…, document.body)` to escape any `transform` or `overflow` ancestor. Critical because Framer Motion applies transforms on animated page wrappers, which break `position: fixed` stacking context.

### JARVIS SpeechRecognition singleton
A single module-level `recRef` variable holds the one active `SpeechRecognition` instance. The instance is shared between passive (wake word) and command capture modes. Components call `jarvis.activate()`, `jarvis.dismiss()`, `jarvis.sendText()` — they never create their own SpeechRecognition. This prevents double-instance conflicts across the floating orb and JARVIS page.

### Gemini conversation history
JARVIS maintains a `conversationHistory` array at module level. The system prompt (JARVIS personality + current tasks + date/time) is injected only on the first turn. Subsequent turns append raw user text + model response. History is capped at 20 entries.

The Ask page (`/ask`) manages its own separate conversation history in React state, using Gemini with a workspace context prompt. These are two completely independent Gemini sessions.

### JARVIS task creation (module-level)
`addTaskDirect(input)` in `horizon.ts` is a standalone async function (not inside the hook) that:
1. Calls Supabase insert directly
2. Updates module-level `state.tasks` immediately via `setState()`
3. Sorts and re-emits — all `useHorizon()` subscribers update automatically
JARVIS calls this without being in a React component.

### Cursor-based DnD collision (Desktop)
The desktop grid ignores dnd-kit's collision rect (which lags by grab offset) and instead recomputes the target cell from `activatorEvent.clientX + delta.x`. This makes folder drops and grid snaps land exactly where the drag ghost appears visually.

### Fixed-px grid rows (Desktop)
`gridTemplateRows: repeat(N, ${cellPx}px)` — not `auto`. Prevents rows from collapsing when sparse, eliminating layout shifts on drag and initial load.

### Horizon calendar viewport-fit (Desktop)
On desktop (`md:` breakpoint+), the calendar container switches from `overflow-y-auto` to `overflow-hidden flex flex-col`. The calendar grid uses `md:flex-1 md:grid-rows-6` so the 6 rows fill all available vertical space. Cells use `md:aspect-auto md:h-full` so they expand to fill their grid row rather than maintaining a square aspect ratio. The entire calendar is always visible without scrolling.

### Horizon realtime sync
`horizon.ts` subscribes to `postgres_changes` on `horizon_tasks`. Any mutation triggers a full refetch. Intentionally simple — debounce or switch to incremental updates if write frequency is high.

### Platform abstraction layer (`src/lib/platform/`)
Each service in the platform directory defines a TypeScript interface + a browser implementation. When Tauri is added:
1. Import the Tauri plugin
2. Implement the interface
3. Swap in the factory function
Call sites never change.

| Module | Interface | Current impl | Tauri impl |
|---|---|---|---|
| `notifications.ts` | `NotificationService` | `Notification` API | `tauri-plugin-notification` |
| `storage.ts` | `StorageService` | `localStorage` | `tauri-plugin-store` |
| `system.ts` | TrayService, ShortcutService, StartupService | stubs (no-ops) | `tauri-plugin-autostart`, `tauri-plugin-global-shortcut`, system tray |
| `voice.ts` | `VoicePlatformCapabilities` | Web Speech API caps | native Rust audio caps |
| `window.ts` | `WindowService` | `document.title` only | `@tauri-apps/api/window` |

---

## Design Language

### Colour system
All design tokens are defined as oklch CSS variables in `src/styles.css` (`:root` block):

| Token | Value | Usage |
|---|---|---|
| `--background` | `oklch(0.135 0 0)` (~#0B0B0C) | Page background |
| `--surface-1` | `oklch(0.15 0 0)` (~#141416) | Modal backgrounds |
| `--surface-2` | `oklch(0.17 0 0)` (~#18181B) | Card backgrounds |
| `--foreground` | `oklch(0.93 0 0)` (~#EDEDED) | Primary text |

**White opacity scale (interactive elements):**
- Borders: `rgba(255,255,255,0.05–0.14)`
- Hover/selection backgrounds: `rgba(255,255,255,0.04–0.11)`
- Primary text: `text-foreground` (~#EDEDED)
- Secondary text: `text-white/60`
- Muted text: `text-white/35`

**Zero purple/blue accent colours** anywhere in the main app except:
- Semantic priority badges in Horizon (muted blue / amber / red at low opacity)
- The entire JARVIS interface (scoped blue holographic palette)

**JARVIS colour palette (scoped):**
| Token | Value | Usage |
|---|---|---|
| Background | `#020508` | JARVIS page background |
| Panel | `rgba(0,17,27,0.7)` | HUD card backgrounds |
| Primary | `#00BFFF` (Electric Blue) | Text, borders, orb |
| Accent | `#4DEBFF` (Cyan) | Highlights, orb center |
| Glow | `rgba(0,191,255,0.2)` | Box-shadows |
| Border | `rgba(0,191,255,0.12–0.35)` | Panel borders |

### Motion principles
- **Easing:** `[0.22, 1, 0.36, 1]` — custom spring-like cubic bezier — used everywhere
- **Durations:** 0.15–0.22s micro-interactions, 0.28–0.35s transitions, 0.4–0.5s entrances
- **`AnimatePresence`** on every mount/unmount — never abrupt DOM removals
- **Hover lifts:** `y: -1` to `y: -2`, `scale: 1.02–1.08`
- **Stagger:** `staggerChildren: 0.04–0.07s` on list/grid entrances
- **Ambient loops:** today-cell glow, timeline node glow, splashscreen, JARVIS orb/rings — very slow (3–4s), low opacity
- JARVIS CSS animations use `transform` only → GPU-accelerated, zero layout thrash

### Component patterns
- Cards: `rounded-2xl border border-white/[0.07] bg-white/[0.03]`
- Inputs: `rounded-xl border border-white/[0.07] bg-white/[0.03] focus:border-white/[0.16]`
- Modals: React Portal, `AnimatePresence` fade + scale, `bg-[var(--surface-1)]`
- Primary buttons: `bg-foreground text-background`
- Ghost buttons: `border-white/[0.07] text-white/35 hover:text-white/70`

---

## Splashscreen

`src/routes/__root.tsx` renders a `Splash` component on first load:
- Covers full viewport (`fixed inset-0 z-[100]`)
- Shows: icon mark (four-quadrant SVG grid), wordmark "AI Metrics", tagline
- Outer glow ring animates in (`scale 0.6 → 1`)
- Loading bar sweeps left → right at the bottom
- `setTimeout(onDone, 1600)` — fades out via `AnimatePresence` exit after 1.6s
- Does not re-appear on route changes (state in `RootComponent`)

---

## Feature Status

| Feature | Status | Notes |
|---|---|---|
| Websites directory | ✅ Complete | Add/edit/delete, tag filter, sort, favicon, usage tracking |
| Desktop launcher | ✅ Complete | DnD grid, folders, snap-to-grid, right-click menu |
| Prompts library | ✅ Complete | CRUD, copy, usage tracking |
| Links board | ✅ Complete | CRUD, Supabase realtime |
| Images board | ✅ Complete | Supabase Storage upload/rename/delete |
| Messages board | ✅ Complete | CRUD, Supabase realtime, Gemini context |
| Horizon calendar | ✅ Complete | Month nav, today highlight, breathing glow, task dots, viewport-fit on desktop |
| Horizon timeline | ✅ Complete | Grouped by hour, animated rail, node draw, stagger |
| Horizon tasks | ✅ Complete | Full CRUD, priority colours, expand/collapse, realtime |
| Horizon reminders | ✅ Complete | Default ON, blue holographic toggle, FCM push |
| Insights — AI usage | ✅ Complete | Requires `SETUP.sql` for `usage_logs` |
| Insights — Horizon | ✅ Complete | Live from Horizon store |
| AI chat (Ask) | ✅ Complete | Requires `VITE_GEMINI_API_KEY` |
| Voice mic input | ✅ Active | Chrome/Edge only (Web Speech API) |
| Horizon voice assistant | ✅ Complete | Wake word "horizon"/"hey horizon", command processing, TTS, settings |
| JARVIS AI assistant | ✅ Complete | Wake words, Gemini, task creation, navigation, voice responses |
| JARVIS floating orb | ✅ Complete | Global, all non-JARVIS pages, state-reactive |
| Splashscreen | ✅ Complete | Icon + wordmark + loading bar, fades at 1.6s |
| PWA installable | ✅ Complete | `manifest.json` + `sw.js` + `index.html` wired |
| Push notifications | ✅ Complete | FCM init, permission toggle, token persistence, foreground+background handlers, Edge Function scheduler, duplicate prevention |
| Platform abstraction | ✅ Complete | `src/lib/platform/` — Tauri-ready interfaces for notifications, storage, voice, system, window |
| In-app notification banners | ✅ Complete | Instagram-style banners via `InAppNotificationHost` |

---

## User Preferences

- Code style: clean, senior-level, no verbose JSX comments, no redundant CSS, properly typed (`any` only when unavoidable)
- Modals always centered regardless of scroll (React Portal required)
- Desktop grid must not shift layout on load or drag (fixed `gridTemplateRows` in px)
- Desktop page scrolls vertically when icons overflow viewport
- Zero purple/blue accent colours in main app — white-only monochrome palette
- Semantic priority accents (blue/amber/red) allowed only in Horizon task UI
- JARVIS has its own scoped blue holographic palette — isolated to `/jarvis` route and floating orb
- No over-animation — motion must feel premium and cinematic, never decorative
- Horizon reminder toggle defaults to ON for all new tasks

---

## Gotchas

- **`VITE_` prefix required** — all env vars must have `VITE_` to be injected by Vite into client code.
- **Run all four SQL files** — `SETUP.sql`, `SETUP_NEW_TABS.sql`, `HORIZON_SETUP.sql`, `NOTIFICATIONS_SETUP.sql` must each be executed in Supabase SQL Editor in order. Missing files cause silent empty states.
- **Horizon silent failure** — if `HORIZON_SETUP.sql` hasn't been run, the store catches `PGRST205` silently (`console.debug` only, no toast). Tasks will be empty.
- **RLS is disabled** on all Supabase tables — anyone with the anon key can read/write. Fine for personal use.
- **Voice input is Chrome/Edge only** — `SpeechRecognition` is unavailable in Firefox/Safari. `isSpeechSupported` gates the mic button. JARVIS will gracefully degrade (text input still works fully).
- **JARVIS passive listening requires mic permission** — `jarvis.autoStartIfEnabled()` silently checks permission state via `navigator.permissions.query({ name: "microphone" })` and only starts if already granted. It will never prompt on its own.
- **Single SpeechRecognition instance** — JARVIS owns a module-level `recRef`. If both JARVIS and the Horizon voice overlay are enabled simultaneously, they may conflict (browser allows only one active session). In practice, use one or the other.
- **JARVIS task dates** — task times are stored as HH:MM without timezone. Edge Function compares against UTC. Store tasks ±30 min before desired local time, or add a `timezone` column for future enhancement.
- **`routeTree.gen.ts` is auto-generated** — never edit manually unless the Vite plugin fails to regenerate (rare). The file is updated on every route file save during `npm run dev`. After adding a new route file, restart the dev server.
- **`normalizeDesktopLayout` auto-places new items** — any item without a layout entry gets placed in the next free cell, causing a brief position shift until Supabase persists the layout.
- **Push notifications need Firebase** — `VITE_FIREBASE_*` env vars must all be set for FCM to work. The app degrades gracefully without them (no crashes, no push).
- **Splashscreen fires once per page session** — `splashDone` state lives in `RootComponent`. Route changes don't re-trigger it; only a full page reload does.
- **JARVIS conversation history is session-only** — `conversationHistory` is a module-level array that resets on page refresh. For persistence, it would need to be serialized to localStorage.
- **`useInView` in TimelineGroup** — Framer Motion's `useInView` with `once: true` and `margin: "0px 0px -40px 0px"` triggers timeline animations as groups scroll into viewport. Groups that start in view animate immediately; groups below the fold animate when scrolled to.
- **Realtime = full refetch** — Supabase realtime fires on any table change and calls a full fetch for that store. For high-frequency writes, debounce or switch to incremental row-level updates.
