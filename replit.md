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

**Required env vars (set in Replit Secrets or `.replit` userenv):**

| Key | Description |
|---|---|
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase public anon key (publishable) |
| `VITE_GEMINI_API_KEY` | Google Gemini API key (for Ask page AI chat) |

---

## Stack

| Layer | Technology |
|---|---|
| Runtime | Node 20 |
| SPA framework | React 19 + TanStack Router v1 (file-based routing) |
| Build tool | Vite 7 |
| Styling | Tailwind CSS v4 (`@tailwindcss/vite` plugin) + design token system in `src/styles.css` |
| UI primitives | Radix UI + shadcn/ui component patterns |
| Animations | Framer Motion |
| Drag & Drop | @dnd-kit/core + @dnd-kit/modifiers + @dnd-kit/sortable |
| Data / Realtime | Supabase JS v2 (`@supabase/supabase-js`) |
| AI | Google Gemini REST API (model: `gemini-2.0-flash-exp`) |
| Voice | Web Speech API (browser-native, no external dependency) |
| Toasts | Sonner |
| Markdown | react-markdown + remark-gfm |
| Charts | Recharts |
| Forms | react-hook-form + zod |
| Package manager | npm |

---

## Database Setup

Three SQL files must be run in your Supabase SQL Editor:

| File | Purpose |
|---|---|
| `SETUP.sql` | Core tables: `items`, `desktop_layout`, `desktop_folders`, `usage_logs` |
| `SETUP_NEW_TABS.sql` | Additional tab tables (links, messages, etc.) |
| `HORIZON_SETUP.sql` | Horizon calendar: `horizon_tasks` table |

**RLS note:** RLS is disabled on all tables. This is fine for a single-user personal tool. Add RLS + Supabase Auth before making the app multi-user.

---

## PWA Support

AI Metrics is installable as a Progressive Web App:

- `public/manifest.json` — App manifest with name, icons, theme color, and shortcuts (Horizon, Ask)
- `public/sw.js` — Service worker: static asset caching, push notification handler, notification-click routing
- `index.html` — Registers the service worker on load, includes `<link rel="manifest">`, Apple PWA meta tags

**Installing:** In Chrome/Edge, click the install icon in the address bar. On Android, use "Add to Home Screen".

**Push notifications:** The service worker is ready to receive push payloads. FCM integration requires a Firebase project config (not yet connected — see Gotchas).

---

## File Structure

```
/
├── index.html                  # App shell HTML — manifest link, SW registration
├── public/
│   ├── favicon.png             # App icon (used in manifest + favicon)
│   ├── manifest.json           # PWA manifest
│   └── sw.js                   # Service worker (cache + push notifications)
├── SETUP.sql                   # Supabase schema: core tables
├── SETUP_NEW_TABS.sql          # Supabase schema: supplementary tables
├── HORIZON_SETUP.sql           # Supabase schema: horizon_tasks table
└── src/
    ├── styles.css              # Design tokens (oklch color vars, typography)
    ├── main.tsx                # React root, TanStack Router provider
    ├── router.tsx              # Router instance config
    ├── routeTree.gen.ts        # Auto-generated route tree (TanStack Router plugin)
    │
    ├── routes/
    │   ├── __root.tsx          # Root layout — AppShell wrapper + Sonner <Toaster>
    │   ├── index.tsx           # /           Websites directory (AI tools)
    │   ├── desktop.tsx         # /desktop    Drag-and-drop macOS-style icon launcher
    │   ├── prompts.tsx         # /prompts    Personal prompt library
    │   ├── links.tsx           # /links      Link board
    │   ├── images.tsx          # /images     Image board (Supabase Storage)
    │   ├── messages.tsx        # /messages   Important messages/notes
    │   ├── horizon.tsx         # /horizon    Calendar + fullscreen task manager
    │   ├── insights.tsx        # /insights   AI tool usage analytics + Horizon analytics
    │   └── ask.tsx             # /ask        Gemini AI chat + mic voice input
    │
    ├── components/
    │   ├── app-shell.tsx           # Sidebar nav + mobile bottom nav + page layout
    │   ├── matrix-modal.tsx        # Shared modal (React Portal + Framer Motion)
    │   ├── page-header.tsx         # Reusable page title + action slot
    │   ├── sync-indicator.tsx      # Supabase sync status pill ("Synced" / "Syncing…")
    │   ├── desktop/
    │   │   ├── desktop-grid.tsx    # DnD grid orchestrator (dnd-kit DndContext + SortableContext)
    │   │   ├── desktop-item.tsx    # Draggable website icon cell
    │   │   ├── folder-icon.tsx     # Draggable + droppable folder cell
    │   │   ├── folder-overlay.tsx  # Folder detail modal (rename, delete, remove items)
    │   │   ├── drag-ghost.tsx      # DragOverlay ghost clone (lightweight, no sub-renders)
    │   │   └── command-palette.tsx # Right-click context menu on desktop grid
    │   ├── image-board/            # Image upload, rename, delete modals
    │   ├── link-board/             # Link card component + add/edit modal
    │   ├── messages/               # Message card + add/edit/delete modal
    │   └── ui/                     # shadcn/ui generated primitives (button, dialog, select, etc.)
    │
    ├── hooks/
    │   ├── use-mobile.tsx          # Breakpoint hook — returns true when viewport ≤ 768px
    │   ├── use-voice-input.ts      # Web Speech API hook — VoiceState: idle | listening | processing
    │   └── use-wake-word.ts        # Wake word hook — detects "jarvis" via continuous SpeechRecognition
    │                               #   (hook file intact; currently disabled in ask.tsx — see status below)
    │
    └── lib/
        ├── github-data.ts          # Domain types + seed data — source of truth for all TypeScript types
        ├── supabase.ts             # Supabase JS client singleton (reads VITE_ env vars)
        ├── supabase-data.ts        # All DB read/write helpers (typed, no ORM)
        ├── store.ts                # Global external store (useSyncExternalStore) for websites + prompts + desktop
        ├── link-board.ts           # External store for links (same pattern as store.ts)
        ├── important-messages.ts   # External store for messages
        ├── horizon.ts              # External store for Horizon tasks (CRUD + realtime)
        ├── desktop-layout.ts       # Grid math: buildLauncherEntries, normalizeDesktopLayout
        ├── gemini.ts               # Gemini REST API wrapper (UserContext builder, error mapping)
        ├── usage-tracking.ts       # Tool open + prompt copy event logging + getInsightsData()
        └── utils.ts                # cn() Tailwind class merge helper
```

---

## Pages & Features

### Websites (`/`)
- Curated directory of AI tools / websites
- Add, edit, delete entries with title, URL, description, tags
- Tag filter chips — click to filter by tag
- Sort options: alphabetical, recently added, most opened
- Favicon auto-fetch via Google's favicon service
- Tool opens are tracked in `usage_logs` for Insights analytics

### Desktop (`/desktop`)
- macOS-style drag-and-drop icon grid
- Drag icons to reposition — snap-to-grid + swap behaviour
- Drag one icon onto another to create a folder group
- Right-click on the grid → "New Folder" context menu
- Folders are draggable and droppable (items can be added/removed)
- Grid scrolls vertically when icons overflow the viewport
- Layout persists to Supabase (`desktop_layout` + `desktop_folders` tables)
- Fixed `gridTemplateRows` prevents layout shift on load or during drag

### Prompts (`/prompts`)
- Personal prompt library — add, edit, delete prompts
- Copy-to-clipboard with one click
- Prompt copies are tracked in `usage_logs` for Insights analytics

### Links (`/links`)
- Simple link board for quick-access URLs
- Cards with title, URL, optional description
- Add/edit/delete via modal

### Images (`/images`)
- Image board backed by Supabase Storage
- Upload images, rename, delete
- Displayed as a responsive grid

### Messages (`/messages`)
- Store and view important notes, messages, or reminders
- Markdown-lite display with add/edit/delete
- Messages are passed as context to the Gemini AI in the Ask tab

### Horizon (`/horizon`)
- Premium calendar + task management system
- Monthly calendar view with animated month transitions (Framer Motion AnimatePresence)
- Today's date highlighted with a soft white overlay
- Dates with tasks show a dot indicator and task count badge
- **Fullscreen task experience** — clicking any date opens a full-screen overlay (no sidebar)
  - AnimatePresence fade + scale transition covers the entire page
  - Back button to return to calendar
  - Task count header: "X of Y remaining"
- **Task cards** — premium vertical stack:
  - Collapsed: title, time (12hr format), completion checkbox, priority indicator dot
  - Expanded: description, edit/delete buttons, reminder toggle status
  - Smooth Framer Motion layout animation on expand/collapse
- **Add/Edit task modal** (Dialog + react-hook-form + zod):
  - Title (required)
  - Time picker: 12-hour format, full 60-minute range (00–59), AM/PM select — all via shadcn Select
  - Description (optional textarea)
  - Priority selector: Low / Medium / High (monochrome white-opacity system)
  - Reminder toggle (bell icon, styled switch)
- **Color system:** White-only monochrome — zero purple/blue. `rgba(255,255,255,0.06–0.18)` overlays only
- **Supabase integration:** `horizon_tasks` table (requires `HORIZON_SETUP.sql`)
- **Realtime:** Supabase postgres_changes subscription — all CRUD operations sync live across tabs

### Insights (`/insights`)
- **Horizon analytics section** (top):
  - Done Today, Done This Week, Pending Today, Completion Rate metric cards
  - Task Trend — Last 7 Days bar chart (Scheduled vs Completed, white-only bars)
  - Priority Distribution donut chart (Low / Medium / High, white opacity scale)
  - Upcoming tasks, Total tasks, Busiest Day of week cards
- **AI tool usage section:**
  - Opens Today, Copies Today, Streak, Week-over-week delta metric cards
  - Top Tool, Top Prompt, Avg/Day, Busiest Day
  - Top Tools ranked list (with favicons)
  - Usage — Last 7 Days line chart (Tools + Prompts, white strokes)
  - Top Prompts ranked list
  - Daily Activity bar chart
  - Hour of Day distribution bar chart (last 30 days)
  - AI Insights — auto-generated plain-English observations
  - Recent Activity feed (last 10 events)
- Auto-refreshes every 30 seconds
- Manual refresh button
- All chart colors: white-only (`rgba(255,255,255,0.12–0.6)`) — no blue/purple

### Ask (`/ask`)
- Gemini AI chat with full multi-turn conversation history
- **Full workspace context passed to Gemini on every request:**
  - All websites (name, URL, tags)
  - All prompts (title, content)
  - All links
  - All important messages
  - All desktop folders and their contents
- **Chat animations (Framer Motion):**
  - User message: slides in from bottom-right with slight x offset + scale spring
  - Assistant reply: slides in from left with y + x offset + scale
  - Both: layout-animated, `AnimatePresence mode="popLayout"` for exit
  - Assistant avatar dot with Sparkles icon appears alongside each reply
  - Thinking bubble: avatar dot with rotating Sparkles icon + 3-dot bouncing animation (staggered y/opacity/scale)
  - Mic icon: AnimatePresence swap between Mic and Square icons on state change
  - Input bar: shadow elevates on focus/content, smooth border color transitions
  - Waveform bars: 5-bar animated equalizer in the input box while listening
- **Voice input (mic only):** Click mic button → record → transcript injected into input → user reviews and sends manually
- **Jarvis wake word: TEMPORARILY DISABLED** — `use-wake-word.ts` hook is intact; all wake word code in `ask.tsx` is commented out. Only mic functionality is active. Re-enable by uncommenting the relevant sections.
- Empty state: animated starter prompt chips (Plan / Edit / Brainstorm / Explain)
- Markdown rendering: headers, lists, code blocks, blockquotes, tables, bold, italic, links
- Auto-scroll to latest message after each turn (smooth, with 60ms paint delay)
- Auto-resize textarea (up to 128px)
- Enter to send, Shift+Enter for newline

---

## Architecture Decisions

### Global external store over Context API
`store.ts`, `link-board.ts`, `important-messages.ts`, and `horizon.ts` all use `useSyncExternalStore` with module-level state. All subscribers receive the same snapshot synchronously, eliminating Context cascading re-renders across the whole tree on every keystroke.

### Optimistic mutations
Every write updates local state instantly, then persists to Supabase async. On failure, state rolls back and `toast.error` is shown. Users never wait for network round-trips.

### React Portal for modals
`MatrixModal` renders via `createPortal(…, document.body)` to escape any `transform` or `overflow` ancestor that would break `position: fixed` centering. Critical because Framer Motion applies transforms on animated page wrappers.

### Cursor-based DnD collision (Desktop)
The desktop grid ignores dnd-kit's collision rect (which lags the visual by the grab offset) and instead recomputes the target cell from `activatorEvent.clientX + delta.x`. This makes folder drops and grid snaps land exactly where the drag ghost appears visually.

### Fixed-px grid rows (Desktop)
Desktop grid sets `gridTemplateRows: repeat(N, ${cellPx}px)` matching column cell size — not `auto`. This prevents rows from collapsing when sparse, eliminating layout shifts on drag and on initial load.

### Horizon fullscreen task UX
Clicking a date sets `selectedDate` state. `AnimatePresence` renders a `motion.div` with `absolute inset-0 z-30 bg-background` that covers the entire page area — no sidebar, no modal, no bottom sheet. The back button simply clears `selectedDate`. This gives an immersive, distraction-free task editing experience on both desktop and mobile.

### Flexible time input
The Horizon task time picker uses two shadcn `Select` dropdowns: hours (01–12) and minutes (all 60 values, 00–59) plus an AM/PM selector. Converts to 24-hour format (`HH:MM`) for Supabase storage. Displays in 12-hour format (`format12Hour()` helper) everywhere in the UI.

### Gemini conversation history
`ask.tsx` converts the `messages` display array to Gemini's `{role, parts}` format and passes full history on every call. The system/context prompt is only prepended on the first turn (`conversationHistory.length === 0`); subsequent turns are raw user text to avoid context duplication.

### Horizon realtime sync
`horizon.ts` subscribes to `postgres_changes` on the `horizon_tasks` table. Any insert/update/delete triggers a full refetch. Intentionally simple; for high-frequency writes, debounce or switch to incremental updates.

### No SSR in practice
TanStack Start is installed but the Vite config runs as a pure client-side SPA. The store hydrates from Supabase after mount; loading skeletons prevent flash of empty content.

---

## Design Language

### Color system
- All surfaces: oklch dark values defined in `src/styles.css` as CSS custom properties
- Highlights: **white-only monochrome** — `rgba(255,255,255,0.04)` through `rgba(255,255,255,0.18)` for backgrounds, borders, overlays
- **Zero purple/blue accent colors** on any interactive element, chart, or highlight
- Typography: `text-foreground` (near-white), `text-copy-secondary` (white/60), `text-copy-muted` (white/35–40)
- Charts use white opacity scale: `rgba(255,255,255,0.12)` (low), `rgba(255,255,255,0.55)` (completed/active)

### Motion principles
- Easing: `[0.22, 1, 0.36, 1]` (custom spring-like cubic bezier) throughout
- Durations: 0.18–0.35s for transitions, 0.45s for page-level entrances
- AnimatePresence: used everywhere for mount/unmount — never abrupt DOM removals
- Hover: subtle `y: -1` to `-2`, `scale: 1.02–1.04` lifts
- No over-animation — motion is cinematic and purposeful, not decorative

### Component patterns
- All cards: `rounded-2xl border border-white/[0.07] bg-[#18181B]`
- All inputs: `rounded-xl border border-white/[0.08] bg-white/[0.04] focus:border-white/[0.18]`
- All modals: React Portal, `AnimatePresence` fade + scale, `bg-[var(--surface-1)]`
- Buttons: `rounded-xl` primary = `bg-foreground text-background`, secondary = `border-white/[0.08] text-copy-secondary`

---

## User Preferences

- Code style: clean, non-cluttered, senior-level — no verbose comments in JSX, no redundant CSS, properly typed (no `any` unless unavoidable)
- Modals must always appear centered regardless of page scroll position (React Portal required)
- Desktop grid must not shift layout on load or during drag (fixed row heights, no `auto`)
- Desktop page must scroll vertically when icons overflow the viewport
- Zero purple/blue accent colors — white-only monochrome highlight system throughout
- No over-animation — motion must feel expensive and cinematic, not decorative

---

## Current Feature Status

| Feature | Status | Notes |
|---|---|---|
| Websites directory | ✅ Complete | Add/edit/delete, tag filter, sort, favicon, usage tracking |
| Desktop launcher | ✅ Complete | DnD grid, folders, snap-to-grid, right-click menu |
| Prompts library | ✅ Complete | CRUD, copy-to-clipboard, usage tracking |
| Links board | ✅ Complete | CRUD, Supabase realtime |
| Images board | ✅ Complete | Supabase Storage upload/rename/delete |
| Messages board | ✅ Complete | CRUD, Supabase realtime |
| Horizon calendar | ✅ Complete | Requires `HORIZON_SETUP.sql` in Supabase |
| Horizon tasks | ✅ Complete | Full CRUD, fullscreen UX, realtime, all-60-min picker |
| Insights — AI usage | ✅ Complete | Requires `SETUP.sql` for usage_logs table |
| Insights — Horizon | ✅ Complete | Live from Horizon store (no extra SQL needed) |
| AI chat (Ask) | ✅ Complete | Requires `VITE_GEMINI_API_KEY` |
| Chat animations | ✅ Complete | User bubble, thinking bubble, assistant reply, waveform |
| Voice mic input | ✅ Active | Chrome/Edge only (Web Speech API) |
| Jarvis wake word | ⏸ Disabled | Code preserved in `use-wake-word.ts` + commented in `ask.tsx` |
| PWA installable | ✅ Complete | manifest.json + sw.js + index.html wired |
| Push notifications | 🔧 Partial | SW handler ready; needs Firebase FCM config |

---

## Gotchas

- **`VITE_` prefix required** — Supabase and Gemini keys must have the `VITE_` prefix to be injected by Vite into client code.
- **Run all three SQL files** — `SETUP.sql`, `SETUP_NEW_TABS.sql`, and `HORIZON_SETUP.sql` must each be executed in Supabase SQL Editor for all features to work.
- **Horizon loads silently without the table** — if `HORIZON_SETUP.sql` hasn't been run, Horizon catches the `PGRST205` error silently (no toast, just a console debug log). Tasks will be empty until the table is created.
- **RLS is disabled** on all Supabase tables. Anyone with the anon key can read/write. Fine for personal use; add RLS + Auth before going multi-user.
- **Voice input is Chrome/Edge only** — `SpeechRecognition` is not available in Firefox or Safari. The `isSpeechSupported` export gates the mic button so it only renders when supported.
- **Jarvis wake word is disabled** — `use-wake-word.ts` exists and is functional but all wake word logic in `ask.tsx` is commented out. To re-enable: uncomment the import, the `useWakeWord` hook call, `handleWakeDetected`, the `prevVoiceStateRef` effect, the `wakeActivated` state, the wake banner, the wand button, and the `wakeActivated` styling on the input bar.
- **Realtime triggers full refetch** — Supabase realtime fires on any table change and calls a full fetch for that store. Intentionally simple. For high-frequency writes, debounce or switch to incremental row-level updates.
- **`normalizeDesktopLayout` auto-places new items** — Any item without a layout entry gets placed in the next free cell. This can cause a temporary position shift until Supabase persists the layout. Fixed `gridTemplateRows` prevents visual glitches during this window.
- **Port 5000** — Configured in both `package.json` (`vite dev --port 5000`) and `.replit` (`waitForPort = 5000`). Do not change one without updating the other.
- **Push notifications need Firebase** — `public/sw.js` has a working push event handler and `notificationclick` handler, but FCM token generation and notification scheduling require a Firebase project config (`apiKey`, `messagingSenderId`, `appId`). This is not yet connected.
- **`routeTree.gen.ts` is auto-generated** — Do not manually edit. TanStack Router's Vite plugin regenerates it on file save whenever routes change. Add new routes by creating files in `src/routes/`.
