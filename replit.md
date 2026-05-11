# AI Metrics — Personal AI Operating System

A dark-themed, premium personal workspace for managing AI tools, prompts, a drag-and-drop desktop launcher, links, images, messages, a calendar task manager (Horizon), and an AI chat powered by Google Gemini. All data persists in real time via Supabase. Installable as a PWA.

---

## Run & Operate

| Command | Purpose |
|---|---|
| `npm run dev` | Start dev server on port 5000 |
| `npm run build` | Production Vite build → `dist/` |
| `npm run preview` | Preview production build locally |
| `npm run lint` | ESLint |
| `npm run format` | Prettier |

**Required env vars (set in Replit Secrets):**

| Key | Description |
|---|---|
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase public anon key (publishable) |
| `VITE_GEMINI_API_KEY` | Google Gemini API key (for Ask page AI chat) |

> **Port 5000** is hard-coded in both `package.json` (`vite dev --port 5000`) and `.replit` (`waitForPort = 5000`). Change both together or change neither.

---

## Stack

| Layer | Technology |
|---|---|
| Runtime | Node 20 |
| SPA framework | React 19 + TanStack Router v1 (file-based routing) |
| Build tool | Vite 7 |
| Styling | Tailwind CSS v4 (`@tailwindcss/vite` plugin) + design tokens in `src/styles.css` |
| UI primitives | Radix UI + shadcn/ui component patterns |
| Animations | Framer Motion |
| Drag & Drop | @dnd-kit/core + @dnd-kit/modifiers + @dnd-kit/sortable |
| Data / Realtime | Supabase JS v2 (`@supabase/supabase-js`) |
| AI | Google Gemini REST API (`gemini-2.0-flash-exp`) |
| Voice | Web Speech API (browser-native) |
| Toasts | Sonner |
| Markdown | react-markdown + remark-gfm |
| Charts | Recharts |
| Forms | react-hook-form + zod |
| Package manager | npm |

---

## Database Setup

Four SQL files must be run in Supabase SQL Editor, in order:

| File | Tables Created | Notes |
|---|---|---|
| `SETUP.sql` | `items`, `desktop_layout`, `desktop_folders`, `usage_logs` | Core app data |
| `SETUP_NEW_TABS.sql` | `links`, `messages` (and others) | Supplementary tabs |
| `HORIZON_SETUP.sql` | `horizon_tasks` | Horizon calendar |
| `NOTIFICATIONS_SETUP.sql` | `notification_tokens`, `reminder_sent_log` | FCM push notifications |

**RLS:** Disabled on all tables. Fine for single-user personal use. Add RLS + Supabase Auth before going multi-user.

---

## PWA

AI Metrics is installable as a Progressive Web App.

| File | Purpose |
|---|---|
| `public/manifest.json` | App name, icons, theme colour, PWA shortcuts (Horizon, Ask) |
| `public/sw.js` | Service worker: static asset caching, push notification handler, `notificationclick` routing |
| `index.html` | Registers service worker on load; `<link rel="manifest">`, Apple PWA meta tags |

**Installing:** Chrome/Edge → click the install icon in the address bar. Android → "Add to Home Screen".

**Push notifications:** Service worker handler is complete. FCM token generation requires a Firebase project config (not yet wired).

---

## File Structure

```
/
├── index.html                     # App shell — manifest, SW registration, Apple PWA meta
├── public/
│   ├── favicon.png                # App icon (manifest + favicon)
│   ├── manifest.json              # PWA manifest
│   └── sw.js                      # Service worker (cache-first + push handler)
├── SETUP.sql                      # Supabase schema: core tables
├── SETUP_NEW_TABS.sql             # Supabase schema: links, messages, etc.
├── HORIZON_SETUP.sql              # Supabase schema: horizon_tasks
└── src/
    ├── styles.css                 # Design tokens (oklch vars, Tailwind @theme inline)
    ├── main.tsx                   # React root, RouterProvider
    ├── router.tsx                 # TanStack Router instance
    ├── routeTree.gen.ts           # Auto-generated route tree (never edit manually)
    │
    ├── routes/
    │   ├── __root.tsx             # Root layout: Splashscreen + AppShell + Toaster + page transitions
    │   ├── index.tsx              # /          Websites directory
    │   ├── desktop.tsx            # /desktop   DnD icon launcher
    │   ├── prompts.tsx            # /prompts   Prompt library
    │   ├── links.tsx              # /links     Link board
    │   ├── images.tsx             # /images    Image board (Supabase Storage)
    │   ├── messages.tsx           # /messages  Important messages
    │   ├── horizon.tsx            # /horizon   Calendar + timeline task manager
    │   ├── insights.tsx           # /insights  Usage analytics + Horizon analytics
    │   └── ask.tsx                # /ask       Gemini AI chat + voice input
    │
    ├── components/
    │   ├── app-shell.tsx          # Sidebar nav + mobile bottom nav + page layout wrapper
    │   ├── matrix-modal.tsx       # Shared modal (React Portal + Framer Motion)
    │   ├── page-header.tsx        # Reusable page title + action slot
    │   ├── sync-indicator.tsx     # Supabase sync status pill ("Synced" / "Syncing…")
    │   ├── desktop/
    │   │   ├── desktop-grid.tsx   # DnD grid (dnd-kit DndContext + SortableContext)
    │   │   ├── desktop-item.tsx   # Draggable website icon cell
    │   │   ├── folder-icon.tsx    # Draggable + droppable folder cell
    │   │   ├── folder-overlay.tsx # Folder detail modal (rename, delete, remove items)
    │   │   ├── drag-ghost.tsx     # DragOverlay ghost (lightweight, no sub-renders)
    │   │   └── command-palette.tsx# Right-click context menu on desktop grid
    │   ├── image-board/           # Image upload / rename / delete modals
    │   ├── link-board/            # Link card + add/edit modal
    │   ├── messages/              # Message card + add/edit/delete modal
    │   └── ui/                    # shadcn/ui primitives (Button, Dialog, Select, Switch, etc.)
    │
    ├── hooks/
    │   ├── use-mobile.tsx         # Breakpoint hook — true when viewport ≤ 768 px
    │   ├── use-voice-input.ts     # Web Speech API — VoiceState: idle | listening | processing
    │   └── use-wake-word.ts       # Continuous background SpeechRecognition for "jarvis" keyword
    │                              # Hook is complete; disabled in ask.tsx (all code commented out)
    │
    └── lib/
        ├── github-data.ts         # Domain types + seed data — source of truth for TypeScript types
        ├── supabase.ts            # Supabase JS client singleton (reads VITE_ env vars)
        ├── supabase-data.ts       # All DB read/write helpers (typed, no ORM)
        ├── store.ts               # Global store (useSyncExternalStore) — websites, prompts, desktop
        ├── link-board.ts          # External store for links
        ├── important-messages.ts  # External store for messages
        ├── horizon.ts             # External store for Horizon tasks + PRIORITY_CONFIG + helpers
        ├── desktop-layout.ts      # Grid math: buildLauncherEntries, normalizeDesktopLayout
        ├── gemini.ts              # Gemini REST API wrapper (UserContext builder, error mapping)
        ├── usage-tracking.ts      # Tool-open + prompt-copy event logging, getInsightsData()
        └── utils.ts               # cn() Tailwind class merge helper
```

---

## Pages

### `/` — Websites directory
- Curated directory of AI tools / websites
- Add, edit, delete entries: title, URL, description, tags
- Tag filter chips — click to filter by tag
- Sort: alphabetical, recently added, most opened
- Favicon auto-fetch via Google favicon service (`https://www.google.com/s2/favicons?domain=…`)
- Tool opens logged to `usage_logs` for Insights analytics

### `/desktop` — Icon launcher
- macOS-style drag-and-drop icon grid
- Snap-to-grid with swap on drop
- Drag icon onto another → creates a folder group
- Right-click grid → "New Folder" context menu
- Folders are draggable and droppable (items can be added/removed via folder overlay)
- Grid scrolls vertically when icons overflow the viewport
- Layout persists in `desktop_layout` + `desktop_folders` tables in Supabase
- Fixed `gridTemplateRows` prevents layout shift on load or during drag

### `/prompts` — Prompt library
- Add, edit, delete personal prompts
- One-click copy to clipboard
- Prompt copies tracked in `usage_logs` for Insights analytics

### `/links` — Link board
- Quick-access URL cards: title, URL, optional description
- Add / edit / delete via modal
- Supabase realtime — changes sync live

### `/images` — Image board
- Upload images to Supabase Storage
- Rename, delete
- Responsive grid layout

### `/messages` — Important messages
- Store notes, messages, reminders
- Full Markdown rendering
- Add / edit / delete via modal
- Content passed as context to Gemini AI on every Ask request
- Supabase realtime

### `/horizon` — Calendar & timeline tasks

**Calendar view:**
- Monthly grid — 7 columns × 6 rows (42 cells always)
- AnimatePresence slide transitions when navigating months (left/right direction-aware)
- Today's date: white-bordered cell with a breathing ambient glow animation (looping box-shadow pulse)
- Dates with tasks: small dot indicator + task count badge in top-right corner
- Day-of-week headers stagger in on mount

**Fullscreen task experience:**
- Clicking any calendar date triggers a full-page overlay (`absolute inset-0 z-30`) that covers the sidebar area — immersive, no modal, no bottom sheet
- Back button → clears `selectedDate`, overlay fades out
- Task count line animates when count changes (`AnimatePresence mode="wait"` on the subtitle)

**Timeline task layout:**
- Tasks sorted chronologically, grouped by hour (e.g. "2 PM", "3 PM")
- Left column (56px / 64px): time label + circular node + vertical connector line
  - Time label: fades in from left, staggered per group
  - Node: springs in (scale 0 → 1) + subtle radial glow that breathes on a loop
  - Connector line: draws downward (`scaleY` 0 → 1, `originY: "top"`)
  - Last group has no connector line
- Right column: task cards aligned to their time node

**Task cards:**
- Slide in from right (`x: 10`) with stagger per card index
- `whileHover`: lifts by 2px (non-completed only)
- Collapsed: checkbox, priority dot, title, time, bell icon (if reminder)
- Expanded (click anywhere on card row): description, priority badge, "Edit" / "Delete" actions
  - Expand uses `height: 0 → "auto"` with `AnimatePresence`
  - Inner content (description, meta, actions) stagger in with short delays

**Checkbox:**
- `whileHover: scale(1.1)`, `whileTap: scale(0.8)`
- Check icon animates in: `scale(0) rotate(-12deg)` → `scale(1) rotate(0)` via spring
- Completed card: fades to `opacity: 0.38`, title gets `line-through`

**Priority colours (semantic accents, subtle):**

| Level | Dot | Badge background | Badge text |
|---|---|---|---|
| Low | `bg-blue-400/50` | `bg-blue-500/8` | `text-blue-300/60` |
| Medium | `bg-amber-400/60` | `bg-amber-500/8` | `text-amber-300/70` |
| High | `bg-red-400/60` | `bg-red-500/7` | `text-red-300/70` |

**Add/Edit task modal** (shadcn Dialog + react-hook-form + zod):
- Title (required), error message animates in
- Time: 12-hour format — hour Select (01–12), minute Select (all 60 values 00–59), AM/PM Select
- Description (optional)
- Priority: three toggle buttons, active state uses semantic colour from `PRIORITY_CONFIG`
- Reminder toggle: Bell / BellOff icon swap with `AnimatePresence`, spring-animated toggle switch thumb
- Cancel + Save actions

**Supabase:** `horizon_tasks` table (requires `HORIZON_SETUP.sql`). Realtime `postgres_changes` subscription — insert/update/delete triggers full refetch.

### `/insights` — Analytics

**Horizon analytics (top section):**
- Done Today, Done This Week, Pending Today, Completion Rate cards
- Task Trend — Last 7 Days bar chart (Scheduled vs Completed)
- Priority Distribution donut chart
- Upcoming tasks, Total tasks, Busiest Day cards

**AI tool usage (bottom section):**
- Opens Today, Copies Today, Streak, Week-over-week delta
- Top Tool, Top Prompt, Avg/Day, Busiest Day
- Top Tools ranked list (with favicons)
- Usage Last 7 Days line chart (Tools + Prompts)
- Top Prompts ranked list
- Daily Activity bar chart
- Hour of Day distribution bar chart (last 30 days)
- AI Insights — plain-English auto-generated observations
- Recent Activity feed (last 10 events)

All charts: white-only (`rgba(255,255,255,0.12–0.6)`) — zero blue/purple. Auto-refreshes every 30 seconds. Manual refresh button.

### `/ask` — AI chat

- Gemini `gemini-2.0-flash-exp` multi-turn chat with full conversation history
- **Full workspace context on every request:** websites, prompts, links, messages, desktop folders
- System/context prompt prepended on the first turn only; subsequent turns are raw user text

**Chat animations:**
- User message: slides in from bottom-right (`x: 16, y: 12, scale: 0.97` → `0, 0, 1`)
- Assistant reply: slides in from left (`x: -8, y: 10, scale: 0.98` → `0, 0, 1`)
- Sparkles avatar dot: pops in with spring alongside every assistant message
- Thinking bubble: rotating Sparkles icon + 3-dot bounce (staggered `y`, `opacity`, `scale`)
- Mic icon: `AnimatePresence mode="wait"` swap between Mic and Square icons
- Waveform: 5 bars animate height while listening; slides in/out with width animation
- Input bar: box-shadow elevates when content is present

**Voice input (mic only):** Click mic → record → transcript injected into input → user reviews and sends manually. Chrome/Edge only.

**Jarvis wake word: DISABLED.** `use-wake-word.ts` is complete and functional but all usage in `ask.tsx` is commented with `// JARVIS DISABLED` markers.

**Empty state:** animated starter chips — "Plan my next 90 minutes", "Edit this paragraph", "Brainstorm names for…", "Explain a concept simply".

**Markdown rendering:** h1–h3, paragraphs, ul/ol, inline code, code blocks, blockquotes, bold, italic, links, hr, tables.

---

## Splashscreen

`src/routes/__root.tsx` renders a `Splash` component on first load that:

- Covers the full viewport (`fixed inset-0 z-[100]`)
- Shows centered: icon mark (four-quadrant SVG grid), wordmark "AI Metrics", tagline
- Ambient radial glow behind the icon
- Outer glow ring animates in (`scale 0.6 → 1`)
- Loading bar sweeps left → right at the bottom
- `setTimeout(onDone, 1600)` — fades out via `AnimatePresence` exit after 1.6 s
- Does not re-appear on route changes (state lives in `RootComponent`)

---

## Architecture

### Global external store (no Context API)
`store.ts`, `link-board.ts`, `important-messages.ts`, `horizon.ts` all use `useSyncExternalStore` with module-level state. Every subscriber gets the same snapshot synchronously — no Context cascading re-renders across the tree on every keystroke or route change.

### Optimistic mutations
Every write immediately updates local state, then persists to Supabase. On failure, state rolls back and `toast.error` is shown. Users never wait for network round-trips.

### React Portal for modals
`MatrixModal` renders via `createPortal(…, document.body)` to escape any `transform` or `overflow` ancestor. Critical because Framer Motion applies transforms on animated page wrappers, which break `position: fixed` stacking.

### Cursor-based DnD collision (Desktop)
The desktop grid ignores dnd-kit's collision rect (which lags by grab offset) and instead recomputes the target cell from `activatorEvent.clientX + delta.x`. This makes folder drops and grid snaps land exactly where the drag ghost appears visually.

### Fixed-px grid rows (Desktop)
`gridTemplateRows: repeat(N, ${cellPx}px)` — not `auto`. Prevents rows from collapsing when sparse, eliminating layout shifts on drag and initial load.

### Horizon timeline grouping
`groupByHour()` sorts tasks chronologically then groups by rounded hour label (e.g. "2 PM"). Each group renders as a `TimelineGroup` with a left rail and right card stack. Groups stagger in using a Framer Motion parent `staggerChildren` variant.

### Horizon fullscreen overlay
Clicking a calendar date sets `selectedDate` state. `AnimatePresence` renders a `motion.div` with `absolute inset-0 z-30 bg-background`. The back button clears `selectedDate`. No modal, no sidebar — fully immersive.

### Gemini conversation history
`ask.tsx` converts the `messages` display array to Gemini's `{role, parts}` format on every request. System prompt (workspace context) is prepended only on the first turn to avoid duplication.

### Horizon realtime sync
`horizon.ts` subscribes to `postgres_changes` on `horizon_tasks`. Any mutation triggers a full refetch. Intentionally simple — debounce or switch to incremental updates if write frequency is high.

---

## Design Language

### Colour system
- **Backgrounds:** oklch dark values in `src/styles.css` (`:root` block) — `--background: oklch(0.135 0 0)` (~#0B0B0C)
- **Surfaces:** `--surface-1` (~#141416), `--surface-2` (~#18181B), `--surface-3` (slightly lighter)
- **White opacity scale for everything interactive:**
  - Borders: `rgba(255,255,255,0.05–0.14)`
  - Backgrounds (hover, selection): `rgba(255,255,255,0.04–0.11)`
  - Text: `text-foreground` (~#EDEDED), `text-copy-secondary` (white/60), `text-copy-muted` (white/35)
- **Zero purple/blue accent colours** anywhere except semantic priority badges in Horizon
- **Semantic priority accents** (Horizon only): muted blue (low), muted amber (medium), muted red (high) — all at low opacity

### Motion principles
- **Easing:** `[0.22, 1, 0.36, 1]` — custom spring-like cubic bezier — used everywhere
- **Durations:** 0.15–0.22s micro-interactions, 0.28–0.35s transitions, 0.4–0.5s entrances
- **`AnimatePresence`** on every mount/unmount — never abrupt DOM removals
- **Hover lifts:** `y: -1` to `y: -2`, `scale: 1.02–1.08`
- **Stagger:** `staggerChildren: 0.04–0.07s` on list/grid entrances
- **Ambient loops:** today-cell glow, timeline node glow, splashscreen — very slow (3–4 s), low opacity
- **No over-animation** — motion is cinematic, purposeful, never decorative

### Component patterns
- Cards: `rounded-2xl border border-white/[0.07] bg-white/[0.03]`
- Inputs: `rounded-xl border border-white/[0.07] bg-white/[0.03] focus:border-white/[0.16]`
- Modals: React Portal, `AnimatePresence` fade + scale, `bg-[var(--surface-1)]`
- Primary buttons: `bg-foreground text-background`
- Ghost buttons: `border-white/[0.07] text-white/35 hover:text-white/70`

---

## User Preferences

- Code style: clean, senior-level, no verbose JSX comments, no redundant CSS, properly typed (`any` only when unavoidable)
- Modals always centered regardless of scroll (React Portal required)
- Desktop grid must not shift layout on load or drag (fixed `gridTemplateRows` in px)
- Desktop page scrolls vertically when icons overflow viewport
- Zero purple/blue accent colours — white-only monochrome palette; semantic priority accents allowed only in Horizon
- No over-animation — motion must feel premium and cinematic, never decorative

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
| Horizon calendar | ✅ Complete | Month nav, today highlight, breathing glow, task dots |
| Horizon timeline | ✅ Complete | Grouped by hour, animated rail, node draw, stagger |
| Horizon tasks | ✅ Complete | Full CRUD, priority colours, expand/collapse, realtime |
| Insights — AI usage | ✅ Complete | Requires `SETUP.sql` for `usage_logs` |
| Insights — Horizon | ✅ Complete | Live from Horizon store |
| AI chat (Ask) | ✅ Complete | Requires `VITE_GEMINI_API_KEY` |
| Chat animations | ✅ Complete | User/assistant bubbles, thinking, waveform, mic swap |
| Voice mic input | ✅ Active | Chrome/Edge only (Web Speech API) |
| Voice Assistant (Horizon) | ✅ Complete | Wake word, command processing, voice responses, settings, auto-start |
| Splashscreen | ✅ Complete | Icon + wordmark + loading bar, fades at 1.6 s |
| PWA installable | ✅ Complete | `manifest.json` + `sw.js` + `index.html` wired |
| Push notifications | ✅ Complete | FCM init on startup, permission-aware toggle, token persistence, foreground+background handlers, Supabase Edge Function scheduler, duplicate prevention via `reminder_sent_log` |

---

## Push Notifications — Full Setup Guide

### 1. Run SQL
Execute `NOTIFICATIONS_SETUP.sql` in Supabase SQL Editor (after `HORIZON_SETUP.sql`).

### 2. Deploy the Edge Function
```bash
npx supabase functions deploy send-reminders --project-ref <YOUR_PROJECT_REF>
```

### 3. Set Edge Function secrets (Supabase Dashboard → Settings → Edge Functions)
| Secret | Value |
|---|---|
| `FIREBASE_SERVICE_ACCOUNT` | Full JSON contents of a Firebase service account key (Firebase Console → Project Settings → Service Accounts → Generate new private key) |

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

### How it works
- **Frontend**: On startup, `initFCM()` silently attaches foreground listener if permission was already granted.
- **Permission**: Only requested when user explicitly enables a reminder in the task form — never on startup.
- **Token**: Generated via `getToken()` (Firebase SDK) and upserted to `notification_tokens` in Supabase.
- **Background SW**: `public/firebase-messaging-sw.js` receives push events when app is closed. Config injected via URL params at registration time.
- **Scheduler**: Edge Function `send-reminders` runs every minute, finds tasks due in the next 15 minutes, sends FCM HTTP v1 push to all registered tokens, logs each dispatch to `reminder_sent_log` (prevents duplicates).
- **Foreground**: `onMessage()` listener in `fcm.ts` shows a `Notification` API popup while the app is open.
- **Click routing**: Both SW `notificationclick` and foreground click navigate to `/horizon`.

### Timezone note
Task times are stored as HH:MM without timezone. The Edge Function compares against UTC. For accurate delivery, store your tasks ±30 min before the desired local time, or add a `timezone` column to `horizon_tasks` for a future enhancement.

---

## Gotchas

- **`VITE_` prefix required** — all env vars must have the `VITE_` prefix to be injected by Vite into client code.
- **Run all three SQL files** — `SETUP.sql`, `SETUP_NEW_TABS.sql`, and `HORIZON_SETUP.sql` must each be executed in Supabase SQL Editor. Missing files cause silent empty states, not crashes.
- **Horizon silent failure** — if `HORIZON_SETUP.sql` hasn't been run, the store catches `PGRST205` silently (`console.debug` only, no toast). Tasks will be empty.
- **RLS is disabled** on all Supabase tables — anyone with the anon key can read/write. Fine for personal use. Add RLS + Auth before going multi-user.
- **Voice input is Chrome/Edge only** — `SpeechRecognition` is unavailable in Firefox/Safari. `isSpeechSupported` gates the mic button.
- **Re-enabling Jarvis** — uncomment in `ask.tsx`: the `useWakeWord` import, hook call, `handleWakeDetected`, `prevVoiceStateRef` effect, `wakeActivated` state, wake banner `<AnimatePresence>` block, wand button, and `wakeActivated` input bar styling. The hook itself needs no changes.
- **Realtime = full refetch** — Supabase realtime fires on any table change and calls a full fetch for that store. For high-frequency writes, debounce or switch to incremental row-level updates.
- **`normalizeDesktopLayout` auto-places new items** — any item without a layout entry gets placed in the next free cell, causing a brief position shift until Supabase persists the layout. Fixed `gridTemplateRows` prevents visual glitches during this window.
- **`routeTree.gen.ts` is auto-generated** — never edit manually. TanStack Router's Vite plugin regenerates it on every route file save.
- **Push notifications need Firebase** — `public/sw.js` has a complete push event handler and `notificationclick` handler, but FCM token generation requires a Firebase project config (`apiKey`, `messagingSenderId`, `appId`). Not yet connected.
- **Splashscreen fires once per page session** — `splashDone` state lives in `RootComponent`. Navigating between routes does not re-trigger it; only a full page reload does.
- **`useInView` in TimelineGroup** — Framer Motion's `useInView` with `once: true` and `margin: "0px 0px -40px 0px"` triggers timeline animations as groups scroll into the viewport. Groups that start in view animate immediately; groups below the fold animate when scrolled to.
