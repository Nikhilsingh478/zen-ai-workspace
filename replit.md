# AI Metrics — Personal AI Operating System

A premium personal workspace and AI command center built as a React 19 SPA. Manages AI tools, a drag-and-drop desktop launcher, prompt library, link board, image board, important messages, a calendar + AI-generated life planner (Horizon + Timeline), a JARVIS voice AI assistant with a full cinematic HUD, and a Gemini-powered chat interface. All structured data persists in Supabase in real time. Installable as a Progressive Web App and compilable as a native Android app via Capacitor.

---

## Run & Operate

| Command | Purpose |
|---|---|
| `npm run dev` | Start Vite dev server on **port 5000** (`--host 0.0.0.0`) |
| `npm run build` | Production Vite build → `dist/` |
| `npm run build:dev` | Development-mode Vite build (source maps, no minification) |
| `npm run preview` | Preview the production build locally |
| `npm run lint` | ESLint check across all source files |
| `npm run format` | Prettier auto-format |
| `npm run cap:sync` | `npm run build` then `npx cap sync android` — syncs web assets into the Android project |
| `npm run cap:open` | Open the Android project in Android Studio |
| `npm run cap:run` | Full build → sync → run on connected Android device/emulator |
| `npm run android:debug` | Build + sync (debug variant, no launch) |
| `npm run android:release` | Build + sync (release-ready assets) |

**Port 5000** is hard-coded in both `package.json` (dev script) and `.replit` (`waitForPort = 5000`). Change both together or neither.

---

## Environment Variables

Set all of these in Replit Secrets (never commit). All must be prefixed `VITE_` so Vite injects them into the client bundle at build time.

| Key | Required | Description |
|---|---|---|
| `VITE_SUPABASE_URL` | ✅ | Supabase project URL (`https://<ref>.supabase.co`) |
| `VITE_SUPABASE_ANON_KEY` | ✅ | Supabase public anon key (safe to expose in browser) |
| `VITE_GEMINI_API_KEY` | ✅ | Primary Google Gemini API key — powers Ask chat, JARVIS AI, and Timeline schedule generation |
| `VITE_GEMINI_API_KEY_2` | ⚠️ | Optional fallback Gemini key — if absent, single-key mode with no failover |
| `VITE_FIREBASE_API_KEY` | ⚠️ FCM | Firebase web API key |
| `VITE_FIREBASE_AUTH_DOMAIN` | ⚠️ FCM | Firebase auth domain (e.g. `<project>.firebaseapp.com`) |
| `VITE_FIREBASE_PROJECT_ID` | ⚠️ FCM | Firebase project ID |
| `VITE_FIREBASE_STORAGE_BUCKET` | ⚠️ FCM | Firebase storage bucket |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | ⚠️ FCM | Firebase messaging sender ID |
| `VITE_FIREBASE_APP_ID` | ⚠️ FCM | Firebase app ID |
| `VITE_FIREBASE_VAPID_KEY` | ⚠️ FCM | VAPID key for web push (Firebase Console → Cloud Messaging → Web Push certificates) |

> FCM vars are all optional — the app degrades gracefully without them (no push notifications, service worker still registers for asset caching, everything else works fully).

---

## Stack

| Layer | Technology | Version |
|---|---|---|
| Runtime | Node.js | 20 |
| SPA framework | React | 19 |
| Router | TanStack Router (file-based, auto-generated route tree) | v1 |
| Build tool | Vite | 7 |
| Styling | Tailwind CSS v4 via `@tailwindcss/vite` plugin | 4 |
| Design tokens | Custom `oklch` CSS variables in `src/styles.css` | — |
| UI primitives | Radix UI + shadcn/ui component patterns | latest |
| Animations | Framer Motion | 12 |
| Drag & Drop | @dnd-kit/core + @dnd-kit/modifiers + @dnd-kit/sortable | 6/9/10 |
| Database / Realtime | Supabase JS v2 | 2 |
| Server-side query cache | TanStack Query | 5 |
| AI — Ask page | Google Gemini REST API (`gemini-flash-latest`) | — |
| AI — JARVIS | Google Gemini REST API + Web Speech API + SpeechSynthesis | — |
| AI — Timeline | Google Gemini REST API (structured JSON schedule generation) | — |
| Voice | Web Speech API (browser-native, Chrome/Edge only) | — |
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

Five SQL files must be run in Supabase SQL Editor **in this exact order**:

| File | Tables Created | Run Order |
|---|---|---|
| `SETUP.sql` | `items`, `desktop_layout`, `desktop_folders`, `usage_logs` | 1st |
| `SETUP_NEW_TABS.sql` | `links`, `messages` | 2nd |
| `HORIZON_SETUP.sql` | `horizon_tasks` | 3rd |
| `TIMELINE_SETUP.sql` | `timeline_months` | 4th |
| `NOTIFICATIONS_SETUP.sql` | `notification_tokens`, `reminder_sent_log` | 5th |

**RLS is disabled** on all tables. Suitable for single-user personal use. Add Supabase Auth + Row Level Security before going multi-user.

### Schema Reference

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
item_ids   text[],            -- ordered list of item ids inside the folder
created_at timestamptz DEFAULT now()
```

**`usage_logs`** — analytics events (opens + prompt copies)
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
content    text,              -- full Markdown body
created_at timestamptz DEFAULT now()
```

**`horizon_tasks`** — tasks for Horizon calendar AND Timeline life-planner
```sql
id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
title                text NOT NULL,
description          text,              -- Timeline tasks embed [timeline:monthKey:domain] prefix here
task_date            date NOT NULL,     -- YYYY-MM-DD
task_time            time NOT NULL,     -- HH:MM (24-hour, UTC)
priority             text NOT NULL,     -- 'low' | 'medium' | 'high'
completed            boolean DEFAULT false,
notification_enabled boolean DEFAULT true,
created_at           timestamptz DEFAULT now()
```
> **Timeline tasks** are stored in `horizon_tasks` with a special description prefix: `[timeline:2026-05:gym] 🏋️ Gym Session`. The Timeline store filters them by this pattern — no separate table is needed.

**`timeline_months`** — monthly context and AI-generated schedule cache
```sql
month_key          text PRIMARY KEY,   -- e.g. "2026-05"
context            text,              -- user's free-text monthly goals
generated_schedule text,              -- JSON blob of AI-generated day-by-day schedule
updated_at         timestamptz DEFAULT now()
```

**`notification_tokens`** — FCM device push tokens
```sql
id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
token      text UNIQUE NOT NULL,
created_at timestamptz DEFAULT now(),
updated_at timestamptz DEFAULT now()
```

**`reminder_sent_log`** — deduplication log for the push scheduler Edge Function
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
| `public/manifest.json` | App name, short name, icons (192×192 + 512×512 PNG), theme color, display mode (`standalone`), PWA shortcuts (`/horizon`, `/ask`) |
| `public/sw.js` | Cache-first service worker for all static assets; handles `push` events and `notificationclick` routing to `/horizon` |
| `public/firebase-messaging-sw.js` | Background FCM push handler — receives pushes when the app tab is closed; shows OS notification and routes click to `/horizon` |
| `index.html` | Registers `sw.js` on load via `navigator.serviceWorker.register`; `<link rel="manifest">`; Apple PWA meta tags (`apple-mobile-web-app-capable`, `apple-mobile-web-app-status-bar-style`, `apple-touch-icon`) |

**Installing:**
- **Android Chrome/Edge:** Tap the install icon in the address bar, or browser menu → "Add to Home Screen"
- **iOS Safari:** Share → "Add to Home Screen"
- **Desktop Chrome/Edge:** Click install icon in address bar

---

## Push Notifications — Full Setup Guide

### 1. Run SQL
Execute `NOTIFICATIONS_SETUP.sql` in Supabase SQL Editor (after `HORIZON_SETUP.sql`).

### 2. Deploy the Edge Function
```bash
npx supabase functions deploy send-reminders --project-ref <YOUR_PROJECT_REF>
```

### 3. Set Edge Function Secret
In Supabase Dashboard → Settings → Edge Functions:

| Secret | Value |
|---|---|
| `FIREBASE_SERVICE_ACCOUNT` | Full JSON from Firebase Console → Project Settings → Service Accounts → "Generate new private key" |

### 4. Schedule the Cron (Supabase SQL Editor)
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

### Pipeline Details
1. **Token registration** — `initFCM()` in `src/lib/fcm.ts` registers the browser with FCM and upserts the device token into `notification_tokens`. Only runs if mic/notification permission is already granted — **never prompts on startup**.
2. **Permission request** — Only triggered when user explicitly toggles the reminder switch on a task in Horizon. The permission request flow is fully user-initiated.
3. **Background SW** — `public/firebase-messaging-sw.js` receives push events when the app tab is closed; shows OS notification.
4. **Foreground handler** — `onMessage()` in `fcm.ts` intercepts pushes while the app tab is open and shows an in-app notification banner instead of an OS popup.
5. **Scheduler** — Supabase Edge Function `send-reminders` runs every minute via `pg_cron`. Finds tasks due in the next 15 minutes, sends FCM HTTP v1 push to all registered tokens, logs each dispatch to `reminder_sent_log` to prevent duplicates within the same window.
6. **Routing** — Both the service worker `notificationclick` handler and the foreground banner navigate the user to `/horizon` on click.

---

## File Structure

```
/
├── index.html                              # App shell — manifest link, SW registration, Apple PWA meta tags
├── capacitor.config.ts                     # Capacitor config: appId, appName, webDir, Android settings
├── vite.config.ts                          # Vite config: React plugin, TanStack Router plugin, Tailwind plugin, port 5000
├── tailwind.config.ts                      # Tailwind config (minimal — most config is @theme inline in styles.css)
├── tsconfig.json                           # TypeScript config: strict, path alias @/ → src/
├── public/
│   ├── favicon.png                         # App icon (512×512 PNG)
│   ├── manifest.json                       # PWA manifest (name, icons, shortcuts, theme)
│   ├── sw.js                               # Service worker: cache-first + push handler + notificationclick
│   └── firebase-messaging-sw.js            # Background FCM push handler (tab closed)
├── SETUP.sql                               # Supabase schema: items, desktop_layout, desktop_folders, usage_logs
├── SETUP_NEW_TABS.sql                      # Supabase schema: links, messages
├── HORIZON_SETUP.sql                       # Supabase schema: horizon_tasks
├── TIMELINE_SETUP.sql                      # Supabase schema: timeline_months
├── NOTIFICATIONS_SETUP.sql                 # Supabase schema: notification_tokens, reminder_sent_log
└── src/
    ├── styles.css                          # All design tokens (oklch CSS vars), Tailwind @theme inline, JARVIS keyframes
    ├── main.tsx                            # React root — mounts <RouterProvider router={router} />
    ├── router.tsx                          # TanStack Router instance creation
    ├── routeTree.gen.ts                    # Auto-generated route tree — NEVER edit manually
    │
    ├── routes/
    │   ├── __root.tsx                      # Root layout: Splashscreen + AppShell + Toaster + JarvisFloatingOrb + InAppNotificationHost
    │   ├── index.tsx                       # /          Websites / AI tools directory
    │   ├── desktop.tsx                     # /desktop   Drag-and-drop icon launcher
    │   ├── prompts.tsx                     # /prompts   Personal prompt library
    │   ├── links.tsx                       # /links     Quick-access link board
    │   ├── images.tsx                      # /images    Image board (Supabase Storage)
    │   ├── messages.tsx                    # /messages  Important messages / notes (Markdown)
    │   ├── horizon.tsx                     # /horizon   Monthly calendar + timeline task manager
    │   ├── timeline.tsx                    # /timeline  AI-generated 6-month life planner
    │   ├── insights.tsx                    # /insights  Usage analytics + Horizon productivity analytics
    │   ├── ask.tsx                         # /ask       Multi-turn Gemini AI chat + voice input
    │   ├── jarvis.tsx                      # /jarvis    JARVIS fullscreen AI command center (cinematic HUD)
    │   └── context.tsx                     # /context   Personal context editor for JARVIS memory
    │
    ├── components/
    │   ├── app-shell.tsx                   # Collapsible sidebar nav + mobile bottom nav + page layout wrapper
    │   ├── matrix-modal.tsx                # Shared modal (React Portal + Framer Motion backdrop + scale)
    │   ├── page-header.tsx                 # Reusable page title + subtitle + action slot
    │   ├── sync-indicator.tsx              # Supabase sync status pill (idle / syncing / error)
    │   ├── voice-overlay.tsx               # Horizon voice assistant floating pill + settings drawer
    │   ├── in-app-notification.tsx         # Instagram-style in-app notification banners (FCM foreground)
    │   ├── jarvis/
    │   │   ├── ai-core.tsx                 # Animated holographic AI core SVG (5 rings, radar sweep, pulse rings, orb, HUD brackets)
    │   │   └── floating-orb.tsx            # Global JARVIS floating action button — renders on all non-JARVIS pages
    │   ├── desktop/
    │   │   ├── desktop-grid.tsx            # dnd-kit DndContext + SortableContext — the full draggable grid
    │   │   ├── desktop-item.tsx            # Individual draggable website icon cell
    │   │   ├── folder-icon.tsx             # Draggable + droppable folder cell
    │   │   ├── folder-overlay.tsx          # Folder detail modal (rename, delete, remove items from folder)
    │   │   ├── drag-ghost.tsx              # DragOverlay ghost component (lightweight visual clone)
    │   │   └── command-palette.tsx         # Right-click context menu on the grid background ("New Folder")
    │   ├── image-board/
    │   │   ├── upload-modal.tsx            # Image upload flow (file input → Supabase Storage)
    │   │   ├── rename-modal.tsx            # Rename an image file in Storage
    │   │   └── delete-modal.tsx            # Confirm + delete an image from Storage
    │   ├── link-board/
    │   │   ├── link-card.tsx               # Individual link card (title, URL, description, copy button)
    │   │   └── link-modal.tsx              # Add / edit link modal (react-hook-form)
    │   ├── messages/
    │   │   ├── message-card.tsx            # Message card with Markdown preview
    │   │   └── message-modal.tsx           # Add / edit / delete message modal
    │   └── ui/                             # shadcn/ui primitives (Button, Dialog, Select, Switch, Sheet, Accordion…)
    │
    ├── hooks/
    │   ├── use-mobile.tsx                  # Breakpoint hook — returns true when viewport ≤ 768 px
    │   ├── use-voice-input.ts              # Web Speech API wrapper — VoiceState: idle | listening | processing
    │   ├── use-voice-assistant.ts          # Full Horizon voice assistant hook (wake word, command parsing, TTS)
    │   └── use-wake-word.ts                # Continuous background SpeechRecognition for passive keyword detection
    │
    └── lib/
        ├── github-data.ts                  # Domain types + seed website data — TypeScript type source of truth
        ├── supabase.ts                     # Supabase JS client singleton (reads VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY)
        ├── supabase-data.ts                # All typed Supabase DB helpers (read/write/delete, no ORM)
        ├── store.ts                        # Global external store (useSyncExternalStore) — websites, prompts
        ├── link-board.ts                   # External store for links
        ├── important-messages.ts           # External store for messages
        ├── image-board.ts                  # External store for images (Supabase Storage list/upload/rename/delete)
        ├── horizon.ts                      # External store for Horizon tasks + PRIORITY_CONFIG + addTaskDirect() + addTasksBatch()
        ├── timeline.ts                     # Timeline external store — useTimeline() hook, DOMAINS, TIMELINE_MONTHS, encodeTimelineDesc()
        ├── desktop-layout.ts               # Grid math: buildLauncherEntries(), normalizeDesktopLayout()
        ├── gemini.ts                       # Gemini REST API wrapper — UserContext builder, error mapping, dual-key support
        ├── jarvis.ts                       # JARVIS global state store + voice engine + Gemini AI integration + wake word system
        ├── usage-tracking.ts               # Tool-open + prompt-copy event logging; getInsightsData()
        ├── fcm.ts                          # Firebase Cloud Messaging: initFCM(), token upsert, permission, onMessage()
        ├── firebase.ts                     # Firebase app singleton (reads VITE_FIREBASE_* vars)
        ├── notifications.ts                # Notification abstraction helpers (wraps platform/notifications.ts)
        ├── voice-settings.ts               # Horizon voice assistant persistent settings store (localStorage)
        ├── voice-commander.ts              # Horizon voice command parser and executor
        ├── utils.ts                        # cn() — Tailwind class merge helper (tailwind-merge + clsx)
        └── platform/                       # Platform abstraction layer (browser / PWA / Capacitor native)
            ├── index.ts                    # Platform detection: isNative, isPWA, isBrowser, name, label
            ├── jarvis-native.ts            # Capacitor bridge to JarvisPlugin (Android foreground service, wake word events)
            ├── native-lifecycle.ts         # Capacitor App plugin — app state change / URL open handlers
            ├── notifications.ts            # NotificationService interface + BrowserNotificationService impl
            ├── storage.ts                  # StorageService interface + LocalStorageService impl
            ├── system.ts                   # TrayService, ShortcutService, StartupService, AppLifecycle (stubs, Tauri-ready)
            ├── voice.ts                    # VoicePlatformCapabilities + getVoicePlatformLimitations()
            └── window.ts                   # WindowService (minimize, maximize, close, setTitle — stubs + Tauri-ready)
```

---

## Pages

### `/` — Websites Directory

- Curated directory of AI tools and websites with add/edit/delete CRUD
- Fields: title, URL, description, tags (multi-value, comma-separated)
- Tag filter chips at the top — click to filter by tag, click active tag to clear
- Sort options: Alphabetical, Recently Added, Most Opened (from `usage_logs`)
- Favicon auto-fetched via `https://www.google.com/s2/favicons?domain=…&sz=32`
- Clicking a tool opens it in a new tab and logs an `open` event to `usage_logs` for Insights analytics
- Search via Fuse.js fuzzy search across title, URL, description, tags

### `/desktop` — Icon Launcher

- macOS-style drag-and-drop icon grid using dnd-kit
- Grid rows fixed in px via `gridTemplateRows: repeat(N, ${cellPx}px)` — never shifts on load or drag (see Architecture)
- Snap-to-grid: items swap positions on drop, not insert-before
- **Folder creation:** drag one icon onto another → automatically creates a folder; `handleDrop` in `desktop-grid.tsx` detects icon-on-icon and calls Supabase insert
- **Right-click:** on the empty grid background opens a context menu with "New Folder"
- **Folder overlay:** click a folder to open a modal showing its contents; supports rename, delete folder, remove items
- Icons are draggable; folders are draggable and droppable (items can be dragged into existing folders)
- Grid scrolls vertically when icons overflow the viewport height
- Layout persists in `desktop_layout` + `desktop_folders` Supabase tables; normalized on load via `normalizeDesktopLayout()`

### `/prompts` — Prompt Library

- Add, edit, delete personal prompts (title + free-text body)
- One-click copy to clipboard with animated checkmark feedback
- Prompt copies tracked in `usage_logs` (`event_type: 'copy'`) for Insights analytics
- Fuzzy search via Fuse.js

### `/links` — Link Board

- Quick-access URL cards: title, URL, optional description
- Add / edit / delete via modal (react-hook-form)
- Supabase realtime subscription — changes sync live across open tabs

### `/images` — Image Board

- Upload images to Supabase Storage (`public/` bucket) via file input
- Rename and delete images
- Responsive card grid layout
- All operations go through `src/lib/image-board.ts` external store

### `/messages` — Important Messages

- Store personal notes, important messages, reminders
- Full Markdown rendering: h1–h3 headings, bold, italic, `inline code`, fenced code blocks (syntax highlighted via rehype-highlight), blockquotes, ordered/unordered lists, tables, links
- Add / edit / delete via modal
- **Context injection:** message content is passed to Gemini on every Ask page request as part of the workspace context prompt

### `/horizon` — Calendar & Timeline Tasks

**Calendar view:**
- Monthly grid, always 7 columns × 6 rows (42 cells) — previous/next month overflow cells shown at 22% opacity
- Full calendar fits in viewport on desktop without scrolling: `md:flex-1 md:grid-rows-6` with `md:aspect-auto md:h-full` cells that expand to fill their grid row
- Direction-aware `AnimatePresence` slide transitions when navigating months (left/right `x` offset based on direction state)
- **Today's cell:** arctic blue–tinted background (`rgba(125,211,252,0.1)`), arctic blue border, looping pulsing box-shadow glow animation (`jarvis-blink` keyframe applied via motion)
- **Selected cell:** subtler arctic blue tint + border
- **Task dot:** small 3px circle below the day number — sky-300/sky-400 tinted; task count badge in top-right corner for days with 2+ tasks
- Day-of-week headers stagger in on mount via `staggerChildren`
- Month navigation: Today button + left/right chevrons, all with arctic blue borders

**Fullscreen task experience:**
- Clicking any date triggers a full-page overlay (`absolute inset-0 z-30 bg-background`) — no modal, fully immersive
- Header shows back arrow, selected date, task count summary ("3 of 5 remaining") — count animates on change with `AnimatePresence mode="wait"`
- "Add Task" button and "Clear day" (with confirm step) in header
- Back button (`← Calendar`) fades the overlay out

**Timeline task layout:**
- Tasks sorted chronologically, grouped by hour ("2 PM", "5 PM", etc.)
- Left column: time label (slides from left) + circular node (springs in + breathing glow) + continuous vertical connector rail (`linear-gradient` in arctic blue `rgba(125,211,252,0.12)`)
- Node color reflects time of day: deep-night (indigo), morning (sky), afternoon (amber), evening (orange), night (violet)
- Right column: `TimelineTaskCard` components aligned to their time node
- Groups animate in with `staggerChildren` delays; `useInView` from Framer Motion defers off-screen group animations

**Task cards:**
- Collapsed state: checkbox, priority stripe, title, time, bell icon (if reminder enabled)
- Expanded state (click card): description, priority badge, time badge, reminder badge, Edit + Delete buttons
- Expand transition: `height: 0 → "auto"` with `AnimatePresence`
- Completed: opacity drops to 0.3, title gets `line-through`, checkbox shows checkmark
- Cards have arctic blue borders/backgrounds (`rgba(125,211,252,0.025/0.08)`) with hover brightening
- **Priority stripe colours:** Low → `bg-blue-400/45`, Medium → `bg-amber-400/45`, High → `bg-red-400/50`

**Add/Edit task modal (react-hook-form + zod):**
- Title (required, validated), description (optional)
- Time: 12-hour picker (hour select + minute select + AM/PM select)
- Priority: three toggle buttons (Low / Medium / High) with semantic color from `PRIORITY_CONFIG`
- Reminder toggle: arctic blue holographic design — ON shows cyan gradient border, blue-tinted glass background, glowing toggle thumb; OFF shows subtle arctic border
- Default: reminder is **ON** for all new tasks — users never need to manually enable it
- Modal has arctic blue top-edge highlight, arctic blue bordered inputs with blue glow on focus, arctic blue gradient submit button

### `/timeline` — AI Life Planner

A 6-month AI-generated schedule planner powered by Gemini. Covers **May 2026 – October 2026**.

**Month selector:**
- Horizontal scrollable rail of month cards on desktop (with `HoloLine` separator accents)
- Vertical list on mobile
- Each card shows: month label, completion progress bar, task count
- Current month: sky-blue border + glow. Past month: muted. Selected: bright sky border + box-shadow glow

**9 Life Domains:**

| Domain ID | Label | Icon | Color |
|---|---|---|---|
| `development` | Development | ⌨️ | #3B82F6 (blue) |
| `gym` | Gym | 🏋️ | #10B981 (emerald) |
| `cricket` | Cricket | 🏏 | #F59E0B (amber) |
| `ai_exploration` | AI Exploration | 🤖 | #8B5CF6 (violet) |
| `freelance` | Freelance | 💼 | #06B6D4 (cyan) |
| `jarvis` | Jarvis | ⚡ | #0EA5E9 (sky) |
| `travel` | Travel | ✈️ | #EC4899 (pink) |
| `resume` | Resume/Career | 📄 | #F97316 (orange) |
| `content` | Content | 🎬 | #EF4444 (red) |

**Monthly context input:**
- Free-text field for monthly goals, routine, constraints (e.g. "Focus on launching MVP, gym 5x/week, cricket on weekends")
- Saved to `timeline_months` in Supabase

**AI schedule generation:**
- Gemini prompt asks for a `{ days: [{ date, tasks: [{ title, startTime, endTime, domain }] }] }` JSON object
- `generationConfig: { temperature: 0.4, maxOutputTokens: 8192 }` — low temperature for structured output
- `robustParseSchedule()` handles three fallback parsing strategies: direct parse, trailing-comma repair, regex-based day extraction
- Generated schedule cached in `timeline_months.generated_schedule` (JSON string) — no re-generation on revisit
- Effective start: if the month has already begun, schedule starts from today (not month start)

**Schedule display:**
- Day-by-day task cards, grouped by date, with domain icon + color coding
- Domain filter chips to hide/show specific life areas
- Progress bar per day and per month
- Task completion toggle (checks/unchecks in Horizon)
- "Regenerate" button clears the cached schedule and re-calls Gemini

**Task storage:**
- All timeline tasks are stored in `horizon_tasks` with a special description prefix: `[timeline:2026-05:gym] 🏋️ Gym Session`
- `encodeTimelineDesc(monthKey, domain, label)` builds this prefix
- `useTimeline()` hook filters `horizon_tasks` by the `[timeline:*]` regex pattern — no separate table
- `addTasksBatch()` in `horizon.ts` bulk-inserts all generated tasks in one operation
- `deleteTasksByMonthKey()` deletes all tasks for a month before regenerating

### `/insights` — Analytics Dashboard

**Horizon productivity analytics:**
- Stat cards: Done Today, Done This Week, Pending Today, Completion Rate (%)
- Task Trend — Last 7 Days: grouped bar chart (Scheduled vs Completed per day) via Recharts
- Priority Distribution: donut/pie chart (Low / Medium / High task counts)
- Summary stats: Upcoming Tasks (next 7 days), Total Active Tasks, Busiest Day of week

**AI tool usage analytics:**
- Stat cards: Opens Today, Copies Today, Current Streak (days), Week-over-week open delta
- Summary: Top Tool (most opened), Top Prompt (most copied), Avg Opens/Day, Busiest Hour
- Top Tools ranked list with favicons and open counts
- Usage Last 7 Days: dual-line chart (Tool Opens + Prompt Copies)
- Top Prompts ranked list
- Daily Activity bar chart (opens per weekday)
- Hour-of-Day distribution bar chart (opens per hour 0–23)
- AI Insights: auto-generated plain-English observations from Gemini based on usage patterns
- Recent Activity feed: last 10 events (type, tool name, timestamp)
- Auto-refreshes every 30 seconds; manual "Refresh" button

### `/ask` — AI Chat

- Multi-turn Gemini `gemini-flash-latest` chat with full conversation history maintained in React state
- **Workspace context:** on the first message of a session, a system/context prompt is prepended containing: all websites, all prompts, all links, all messages, desktop folders, and the user's JARVIS personal context (from `localStorage["jarvis:user-context"]`)
- Subsequent turns are raw user text only — context is not re-injected per turn
- Voice input (mic button): `useVoiceInput()` hook transcribes speech via Web Speech API; transcript injected into the text field for user review and manual send
- **Empty state starter chips:** "Plan my next 90 minutes", "Brainstorm names for…", "Summarize this", "What should I focus on today?"
- Full Markdown rendering in assistant replies (headings, lists, code blocks, tables, links)
- Animated chat bubbles: user messages slide from bottom-right; assistant messages slide from left
- Thinking indicator: rotating Sparkles icon + 3-dot bounce animation while Gemini is generating
- Voice waveform: 5 animated bars show while mic is active

### `/jarvis` — JARVIS AI Command Center

**Overview:** A fullscreen cinematic AI assistant with deep space background (`#050609`), CSS grid dot pattern overlay, radial vignette, and arctic electric-blue holographic palette (`#7DD3FC`, `#93C5FD`, `#0EA5E9`).

**Layout — Desktop (3-column flex):**

**Left HUD panel (220px, fixed):**
- `J.A.R.V.I.S` wordmark in `Space Mono` monospace font + version badge `v2.0`
- Animated EQ bars (5 bars, `jarvis-eq` keyframe) — animate only when JARVIS is active
- Signal strength indicator (4 bars)
- Live clock: updates every second (`HH:MM:SS`) in monospace
- Task stats: "PENDING", "DONE", "TOTAL" pulled from `useHorizon()`
- ACTIVATE / DEACTIVATE toggle button
- Wake phrase reference: "Hey JARVIS…"
- Quick command shortcut chips

**Center:**
- `AICore` component — animated holographic orb with 5 rings, radar sweep, HUD brackets, crosshair lines, pulse rings
- Animated scan line sweeping top-to-bottom (`jarvis-scan` keyframe, 4s loop)
- Frequency bars at the bottom center (`jarvis-freq` keyframe, 8 bars)
- State label below the orb (STANDBY / LISTENING / ANALYZING / RESPONDING)
- Transcript display for current recognized speech

**Right Neural Link panel (288px):**
- Header: "NEURAL LINK" label in monospace + status dot
- Scrollable conversation history — user messages (right-aligned with `U` avatar), JARVIS messages (`J` avatar with sky-blue border)
- Task creation confirmation cards with `CheckSquare` icon
- Text input bar at the bottom with mic button + send button

**Layout — Mobile (single column):**
- Header strip with wordmark + status indicator
- AICore orb (centered, smaller)
- LOG toggle button to show/hide the chat panel (overlaid)
- Chat panel slides up from the bottom

**Animated AI Core (`src/components/jarvis/ai-core.tsx`):**
- 5 concentric rings at different radii, each rotating at a different speed and direction via CSS keyframes `jarvis-cw` / `jarvis-ccw`
- Radar sweep: rotating `conic-gradient` with its own animation
- 3 pulse rings emanating outward with staggered `animationDelay`
- Center orb: holographic `radial-gradient` from `#4DEBFF` → `#00BFFF` → `#003060` with a breathing box-shadow loop
- 4 corner HUD brackets (SVG `L`-shapes)
- Crosshair lines (horizontal + vertical)
- State overlays: waveform bars (speaking mode), processing dots (thinking mode)
- All animations run on `transform` only → GPU-accelerated, zero layout thrash

**JARVIS CSS keyframes (`src/styles.css`):**

| Keyframe | Usage | Duration |
|---|---|---|
| `jarvis-scan` | `.jarvis-scan-line` — full-height scan line sweeping top→bottom | 4s |
| `jarvis-blink` | `.jarvis-blink` — cursor/indicator blink | 1s |
| `jarvis-freq` | `.jarvis-freq-bar` — random-height frequency bars | 0.4–0.8s (staggered) |
| `jarvis-eq` | `.jarvis-eq-bar` — EQ animation in header | 0.6–1.2s (staggered) |
| `jarvis-cw` | AICore clockwise ring rotation | various |
| `jarvis-ccw` | AICore counter-clockwise ring rotation | various |

**Voice states:**

| State | Visual |
|---|---|
| `idle` | Slow rings, dim orb, EQ bars static, scan line dim |
| `listening` | Faster rings, brighter orb, dim waveform bars in orb |
| `processing` | Faster rings, pulsing orb, 3-dot bounce in orb |
| `speaking` | Faster rings, waveform bars animate in orb, EQ bars active |

**Wake word system:**
- Trigger words: `"jarvis"`, `"hey jarvis"`, `"okay jarvis"` (case-insensitive substring match)
- Module-level `SpeechRecognition` singleton in `src/lib/jarvis.ts` — one global instance, never duplicated
- **Passive mode:** continuous background recognition, only detects wake words; ignores all other speech
- **Command mode:** triggered by wake word detection; captures the next full utterance before returning to passive
- **Inline commands:** "Hey Jarvis, open Horizon" — if the wake word and command are in the same recognition result, processed immediately without a second pass
- Command timeout: 7 seconds of silence auto-returns to passive mode
- `jarvis.enable()` / `jarvis.disable()` toggle the whole system; state written to `localStorage["jarvis:enabled"]`
- `jarvis.autoStartIfEnabled()` — called at app startup in `__root.tsx`; checks `navigator.permissions.query({ name: "microphone" })` and only resumes passive listening if permission is already granted (never prompts)

**Gemini integration:**
- System prompt: JARVIS personality (precise, confident, professional; addresses user as "sir" occasionally; no filler phrases like "Certainly!", "Of course!")
- Full Horizon task context injected (up to 20 most recent tasks by `task_date + task_time`)
- User's personal context from `localStorage["jarvis:user-context"]` (set on `/context` page) injected into every system prompt
- Current date + time injected into every system prompt
- Conversation history: module-level array, capped at 20 turns, deduplicated, resets on page reload
- **Task creation:** JARVIS response contains a special JSON block `[TASKS: [...]]` which is parsed client-side and fed to `addTaskDirect()` one task at a time
- **Navigation commands:** response block `[NAVIGATE:/route]` triggers `router.navigate({ to })` immediately

**Natural language task creation:**
- Parses multi-task utterances: *"Tomorrow 8 PM gym and 10 PM project review"* → 2 tasks created in parallel
- All JARVIS-created tasks default to `notificationEnabled: true`, `priority: 'medium'`
- Task date parsing: "today", "tomorrow", "next Monday" → resolved to `YYYY-MM-DD`
- Tasks appear in Horizon immediately after creation (shared `horizon.ts` external store)
- A confirmation card appears in the JARVIS chat panel listing created tasks

**Navigation commands:**
- "Open Horizon" / "Go to Ask" / "Show me my desktop" → parsed as `[NAVIGATE:/route]` blocks
- Valid routes: `/`, `/horizon`, `/timeline`, `/ask`, `/desktop`, `/prompts`, `/links`, `/images`, `/messages`, `/insights`, `/context`

**Voice responses (SpeechSynthesis):**
- Prefers voices named Google/Daniel/Alex if available; falls back to first available voice
- Rate: 0.95, Pitch: 0.9 — measured, professional tone
- Cancelled immediately on new incoming command

**Text input:**
- Always visible at the bottom; handles Enter key + Send button
- Full text command support (all voice commands work as text too)

**Global Floating Orb (`src/components/jarvis/floating-orb.tsx`):**
- Renders on all pages **except** `/jarvis` (suppressed on the JARVIS page itself)
- Position: `bottom-[5.5rem] right-4` on mobile (above the mobile nav bar), `bottom-6 right-6` on desktop
- State-reactive: pulse rings when active/listening, spin ring when processing, waveform bars when speaking
- Click when active → dismisses JARVIS back to passive mode; click when idle → navigates to `/jarvis`
- Shows a `"J"` text badge when JARVIS is not yet enabled

### `/context` — Personal Context Window

- Full-page textarea for writing personal context to be injected into JARVIS's memory
- Persisted to `localStorage["jarvis:user-context"]` (no Supabase — intentionally local-only)
- Context is injected into JARVIS's Gemini system prompt on every interaction and into the Ask page's workspace context prompt
- Save button with loading state; success toast on save
- Example placeholder: *"I am currently focusing on building my startup. I prefer concise answers but appreciate a supportive tone when I'm stressed…"*
- No character limit enforced in UI (Gemini context window is large enough for reasonable personal bios)

---

## App Shell & Navigation

### Desktop Sidebar (`src/components/app-shell.tsx`)

- Fixed left sidebar, **collapsible** — width animates between `224px` (expanded) and `60px` (collapsed) via Framer Motion spring
- Collapse/expand preference persisted to `localStorage["sidebar-collapsed"]`
- **Expanded:** Brand mark + "AI Metrics" wordmark + "INTELLIGENCE SUITE" subtitle; nav items show icon + label; "Collapse" button at bottom
- **Collapsed:** Brand mark only (centered); nav items show icon only (centered); `ChevronRight` button at bottom
- **Hover tooltips on collapsed nav items:** tooltip slides in from the left with the route label on hover; disappears on mouse-leave
- Active route indicator: animated background pill (Framer Motion `layoutId="sidebar-active-bg"`) + left-edge accent bar (2px, sky-blue, `layoutId="sidebar-active-bar"`)
- JARVIS nav item: animated pulsing dot indicator when active
- `SyncIndicator` pill shown at the bottom when expanded; hidden when collapsed (space constraint)
- All transitions use Framer Motion `AnimatePresence` for smooth label appearance/disappearance

### Mobile Bottom Nav

- Fixed floating bar: `position: fixed`, `left-3 right-3`, `bottom: calc(0.75rem + env(safe-area-inset-bottom, 0px))`
- Rounded pill with `backdropFilter: blur(20px)` glass effect
- 4 primary routes shown: Websites, Horizon, JARVIS, Timeline
- 5th slot: "More" button opens a `Sheet` (right-side drawer) containing all routes
- Active indicator: animated top-edge bar (Framer Motion `layoutId="mobile-active-dot"`)
- Accounts for Android gesture-navigation bottom inset via `env(safe-area-inset-bottom)`

---

## Architecture

### Global External Store (no Context API)
`store.ts`, `link-board.ts`, `important-messages.ts`, `image-board.ts`, `horizon.ts`, `timeline.ts`, `jarvis.ts`, `voice-settings.ts` all use `useSyncExternalStore` with module-level state objects and a Set of subscriber callbacks. Every subscriber receives the same snapshot synchronously — no React Context, no cascading re-renders across the component tree on unrelated state changes.

### Optimistic Mutations (Horizon, Links, Messages, Images)
Every write (add/update/delete) immediately updates local module state, then asynchronously persists to Supabase. On failure: state rolls back to the previous snapshot and `toast.error()` is shown. Users never wait for a network round-trip to see their change reflected.

### React Portal for Modals
`MatrixModal` renders via `createPortal(…, document.body)`, escaping any `transform` or `overflow: hidden` ancestor. This is critical because Framer Motion applies CSS transforms to animated route wrappers, which break `position: fixed` stacking contexts for children.

### JARVIS SpeechRecognition Singleton
A single module-level `recRef` variable in `jarvis.ts` holds the one active `SpeechRecognition` instance. It is shared between passive (wake-word) and command-capture modes. React components call `jarvis.activate()`, `jarvis.dismiss()`, `jarvis.sendText()` — they never instantiate their own `SpeechRecognition`. This prevents double-instance conflicts across the floating orb and the JARVIS page simultaneously mounting.

### Gemini Conversation History
JARVIS maintains a `conversationHistory` array at module level. The system prompt (JARVIS personality + Horizon tasks + user personal context + date/time) is injected only on the **first turn** as a `user` message (Gemini does not support a `system` role in the REST API). Subsequent turns append raw user text + raw model response. History is capped at 20 entries.

The Ask page (`/ask`) manages a completely separate conversation history in React `useState`. These are two independent Gemini sessions — the Ask page's context contains workspace data (websites, prompts, links, messages); JARVIS's context contains task data and the user's personal context.

### JARVIS Task Creation (Module-Level, Outside React)
`addTaskDirect(input: HorizonTaskInput)` in `horizon.ts` is a standalone async function — not inside a React hook. It:
1. Calls `supabase.from("horizon_tasks").insert(...)` directly
2. Updates module-level `state.tasks` immediately via `setState()`
3. Sorts the updated array by `task_date + task_time` and re-emits to all subscribers

`addTasksBatch(inputs[])` bulk-inserts an array of tasks (used by Timeline).
`deleteTasksByMonthKey(monthKey)` deletes all `[timeline:monthKey:*]`-prefixed tasks.

JARVIS calls `addTaskDirect` without being inside a React component. The shared `useHorizon()` subscribers (Horizon calendar, Timeline page, JARVIS HUD stats) all see the new task immediately.

### Cursor-Based DnD Collision (Desktop Grid)
The desktop grid ignores dnd-kit's default collision rect (which lags by the pointer grab offset) and instead recomputes the target cell from `activatorEvent.clientX + delta.x` and `activatorEvent.clientY + delta.y`. This makes folder drops and grid swaps land exactly where the drag ghost appears visually.

### Fixed-px Grid Rows (Desktop Grid)
`gridTemplateRows: repeat(N, ${cellPx}px)` — using an explicit pixel value, not `auto`. This prevents rows from collapsing when cells are sparse (e.g. gaps in layout after deleting icons) and eliminates layout shifts during drag and on initial load.

### Horizon Calendar Viewport-Fit (Desktop)
On `md:` breakpoint and above, the calendar container switches from `overflow-y-auto` to `overflow-hidden flex flex-col`. The calendar grid uses `md:flex-1 md:grid-rows-6` so its 6 rows fill all available vertical space. Cells use `md:aspect-auto md:h-full` so they grow to fill their row rather than maintaining a `1:1` aspect ratio. The complete calendar is always visible on desktop without scrolling.

### Horizon Realtime Sync
`horizon.ts` subscribes to Supabase `postgres_changes` on `horizon_tasks`. Any mutation fires a full `loadAll()` refetch. Intentionally simple — debounce the refetch or switch to incremental row-level updates if write frequency is high.

### Timeline Task Encoding
Timeline tasks are stored in the shared `horizon_tasks` table — no separate table. The description field encodes domain and month information: `[timeline:2026-05:gym] 🏋️ Gym Session`. `useTimeline()` filters `horizon_tasks` using the regex `/^\[timeline:([^:]+):([^\]]+)\]/` to extract `monthKey` and `domain`. This approach reuses Horizon's CRUD, realtime, and task completion infrastructure without schema duplication.

### Platform Abstraction Layer (`src/lib/platform/`)
Each service module defines a TypeScript interface and a browser implementation. When a native runtime (Capacitor, Tauri) is added, only the factory/implementation needs to change — call sites are unaffected.

| Module | Interface | Browser impl | Native impl (planned) |
|---|---|---|---|
| `notifications.ts` | `NotificationService` | `Notification` API | `tauri-plugin-notification` / `@capacitor/local-notifications` |
| `storage.ts` | `StorageService` | `localStorage` | `tauri-plugin-store` / `@capacitor/preferences` |
| `system.ts` | TrayService, ShortcutService, StartupService | stubs (no-ops) | `tauri-plugin-autostart`, `tauri-plugin-global-shortcut`, system tray |
| `voice.ts` | `VoicePlatformCapabilities` | Web Speech API caps | native Rust/Kotlin audio capabilities |
| `window.ts` | `WindowService` | `document.title` only | `@tauri-apps/api/window` / Capacitor Window |
| `jarvis-native.ts` | JarvisPlugin bridge | safe no-op stubs | Capacitor `JarvisPlugin` (Android foreground service, always-on wake word) |
| `native-lifecycle.ts` | App lifecycle | no-op | Capacitor `@capacitor/app` — `appStateChange`, `appUrlOpen` |

---

## Design Language

### Colour System

All design tokens are `oklch` CSS variables in `src/styles.css` (`:root` block). The app uses an **Arctic Glass Futuristic** aesthetic — a dark blue-gray base with a consistent sky-blue (`#7DD3FC`) accent throughout the UI.

**Core palette:**

| Token | Value | Approx hex | Usage |
|---|---|---|---|
| `--background` | `oklch(0.10 0.02 250)` | ~#09090F | Page background |
| `--surface-1` | `oklch(0.15 0.025 245)` | ~#111520 | Sidebar, modal backgrounds |
| `--surface-2` | `oklch(0.18 0.03 245)` | ~#141A28 | Card surfaces, dropdown backgrounds |
| `--surface-3` | `oklch(0.22 0.035 245)` | ~#1A2230 | Input backgrounds, elevated cards |
| `--foreground` | `oklch(0.97 0.01 240)` | ~#F2F4FA | Primary text |
| `--primary` | `oklch(0.76 0.12 235)` | ~#7DD3FC | Primary accent (arctic sky-blue) |

**Arctic Glass tokens (used directly in inline styles):**

| Token | Value | Usage |
|---|---|---|
| `--arctic-primary` | `#7DD3FC` | Primary accent — borders, active states, glows |
| `--arctic-soft` | `#93C5FD` | Softer sky-blue — gradient ends, secondary accents |
| `--ice-blue` | `#BAE6FD` | Lightest sky-blue — text on dark backgrounds |
| `--arctic-glow` | `rgba(125,211,252,0.18)` | Standard box-shadow glow |
| `--arctic-glow-soft` | `rgba(125,211,252,0.08)` | Subtle ambient glow |
| `--glass-highlight` | `rgba(255,255,255,0.05)` | Top-edge card highlights |
| `--hud-line` | `rgba(125,211,252,0.14)` | Divider lines in HUD panels |

**Arctic blue opacity scale for interactive elements:**
- Borders (default): `rgba(125,211,252,0.08–0.10)`
- Borders (hover/active): `rgba(125,211,252,0.20–0.28)`
- Background (subtle): `rgba(125,211,252,0.025–0.05)`
- Background (hover): `rgba(125,211,252,0.045–0.09)`
- Glow (ambient): `rgba(125,211,252,0.12–0.18)`

**JARVIS scoped palette (isolated to `/jarvis` route and floating orb):**

| Token | Value | Usage |
|---|---|---|
| Background | `#050609` | JARVIS page background |
| Primary | `#0EA5E9` / `#7DD3FC` | Text, borders, active accents |
| Accent | `#93C5FD` | Gradient ends, highlights |
| Glow | `rgba(125,211,252,0.18–0.35)` | Box-shadows, orb glow |
| Panel | `rgba(14,165,233,0.04–0.10)` | HUD card backgrounds |

**Priority badge colours (Horizon only):**
- Low: `bg-blue-400/45`, `border-blue-400/25`, `text-blue-300/90`
- Medium: `bg-amber-400/45`, `border-amber-400/25`, `text-amber-300/90`
- High: `bg-red-400/50`, `border-red-400/30`, `text-red-300/90`

### Motion Principles

- **Easing:** `[0.22, 1, 0.36, 1]` — custom spring-like cubic-bezier — used on virtually every transition
- **Durations:** 0.15–0.22s micro-interactions (hover, toggle), 0.28–0.35s page-level transitions, 0.4–0.5s entrance animations
- **`AnimatePresence`** wraps every conditional mount/unmount — never abrupt DOM removals
- **Hover lifts:** `y: -1` to `y: -2` with `scale: 1.02–1.08` on interactive cards
- **Stagger:** `staggerChildren: 0.04–0.07s` on list and grid entrances
- **Ambient loops:** today-cell glow, timeline node pulse, splashscreen ring, JARVIS rings/orb — very slow (3–5s cycles), very low opacity — motion that feels alive rather than distracting
- **JARVIS CSS animations** use `transform` only (rotate, scale, translate) → GPU-accelerated, zero layout reflow

### Component Patterns

- **Cards:** `rounded-2xl border` with `rgba(125,211,252,0.08)` border + `rgba(125,211,252,0.025)` background
- **Inputs:** `rounded-xl border` with arctic blue border, blue glow on focus
- **Modals:** React Portal, `AnimatePresence` fade + scale, `bg-[var(--surface-1)]`, arctic blue top-edge highlight
- **Primary buttons:** arctic blue gradient (`rgba(125,211,252,0.9) → rgba(147,197,253,0.85)`), dark text (`#050609`), blue glow shadow
- **Ghost buttons:** arctic blue border, muted text, border brightens on hover
- **Monospace text:** `Space Mono` (Google Fonts) — used in JARVIS HUD labels, clock, version badge

---

## Splashscreen

`src/routes/__root.tsx` renders a `Splash` component on first app load only:
- Covers full viewport (`fixed inset-0 z-[100]`)
- Shows: four-quadrant SVG grid icon mark, "AI Metrics" wordmark, "Personal AI operating system" tagline
- Outer glow ring animates from `scale: 0.6` → `scale: 1`
- Loading bar sweeps left → right at the bottom
- `setTimeout(onDone, 1600)` — after 1.6 seconds, `AnimatePresence` fades the splash out via the `exit` variant
- `splashDone` lives in `RootComponent` React state — does **not** re-appear on route changes; only re-shows on a full browser page reload

---

## Feature Status

| Feature | Status | Notes |
|---|---|---|
| Websites directory | ✅ Complete | Add/edit/delete, tag filter, sort, favicon, Fuse.js fuzzy search, usage tracking |
| Desktop launcher | ✅ Complete | DnD grid, folders, snap-to-grid, right-click menu, folder overlay |
| Prompts library | ✅ Complete | CRUD, copy, usage tracking, fuzzy search |
| Links board | ✅ Complete | CRUD, Supabase realtime |
| Images board | ✅ Complete | Supabase Storage upload/rename/delete |
| Messages board | ✅ Complete | CRUD, Supabase realtime, full Markdown, Gemini context injection |
| Horizon calendar | ✅ Complete | Month nav, arctic blue today highlight + glow, task dots, viewport-fit desktop |
| Horizon timeline | ✅ Complete | Grouped by hour, animated rail (arctic blue), colored time-of-day nodes |
| Horizon tasks | ✅ Complete | Full CRUD, priority colours, expand/collapse, realtime sync |
| Horizon reminders | ✅ Complete | Default ON, arctic blue holographic toggle, FCM push pipeline |
| Timeline life planner | ✅ Complete | 6 months (May–Oct 2026), 9 domains, Gemini AI schedule, domain filter, task completion |
| Insights — AI usage | ✅ Complete | Requires `SETUP.sql` for `usage_logs`; all charts, ranked lists, activity feed |
| Insights — Horizon | ✅ Complete | Live from Horizon store; stat cards, trend chart, priority donut |
| AI chat (Ask) | ✅ Complete | Requires `VITE_GEMINI_API_KEY`; multi-turn, workspace context, voice, Markdown |
| Voice mic input | ✅ Active | Chrome/Edge only; Web Speech API; gates on `isSpeechSupported` |
| Horizon voice assistant | ✅ Complete | Wake word detection, command parsing, TTS, voice settings overlay |
| JARVIS AI assistant | ✅ Complete | Wake words, Gemini, task creation, navigation, voice responses, text input |
| JARVIS HUD redesign | ✅ Complete | Space Mono font, EQ bars, signal bars, scan line, freq bars, 3-column HUD layout |
| JARVIS floating orb | ✅ Complete | Global, all non-JARVIS pages, state-reactive (pulse/spin/waveform) |
| Context Window | ✅ Complete | Personal context editor, `localStorage["jarvis:user-context"]`, injected into JARVIS + Ask |
| Collapsible sidebar | ✅ Complete | Spring animation, icon-only mode, hover tooltips, persisted to localStorage |
| Splashscreen | ✅ Complete | Icon + wordmark + loading bar, fades at 1.6s |
| PWA installable | ✅ Complete | `manifest.json` + `sw.js` + `index.html` fully wired |
| Push notifications | ✅ Complete | FCM init, permission toggle, token persistence, foreground+background handlers, Edge Function cron, deduplication |
| Platform abstraction | ✅ Complete | `src/lib/platform/` — interfaces for notifications, storage, voice, system, window, JARVIS native, lifecycle |
| Capacitor Android | ✅ Configured | `capacitor.config.ts` + `@capacitor/android` installed; native JarvisPlugin bridge stubbed |
| In-app notification banners | ✅ Complete | Instagram-style banners via `InAppNotificationHost` in `__root.tsx` |

---

## User Preferences

- Code style: clean, senior-level TypeScript; no verbose JSX comments; no redundant CSS; `any` only when truly unavoidable
- Modals must be centered regardless of page scroll (React Portal required for all modals)
- Desktop grid must not shift layout on load or drag (fixed `gridTemplateRows` in px, never `auto`)
- Desktop page scrolls vertically when icons overflow the viewport — do not restrict height
- Arctic Glass aesthetic: consistent arctic blue (`rgba(125,211,252,…)`) across all borders, accents, glows throughout the app
- Zero purple/violet accent colours anywhere in the app except Timeline domain badges (which use per-domain semantic colors)
- Semantic priority accents (blue/amber/red at low opacity) are allowed only in Horizon and JARVIS task contexts
- JARVIS has its own scoped deeper electric-blue holographic palette — isolated to the `/jarvis` route and the floating orb
- No over-animation — every animated element must feel premium, cinematic, and purposeful; never decorative or distracting
- Horizon reminder toggle defaults to **ON** for all new tasks; users must explicitly turn it off
- Sidebar collapse state persists across sessions via localStorage
- `Space Mono` monospace font used for JARVIS HUD elements, clocks, and system labels

---

## Gotchas

- **`VITE_` prefix required** — all environment variables must be prefixed `VITE_` to be injected by Vite into the client bundle. Un-prefixed vars are undefined at runtime.
- **Run all five SQL files in order** — `SETUP.sql`, `SETUP_NEW_TABS.sql`, `HORIZON_SETUP.sql`, `TIMELINE_SETUP.sql`, `NOTIFICATIONS_SETUP.sql` must each be executed in Supabase SQL Editor. Missing files cause silent empty states (the stores swallow `PGRST205` errors with `console.debug` only).
- **Horizon silent failure** — if `HORIZON_SETUP.sql` hasn't been run, `useHorizon()` will catch the Supabase error silently and tasks will appear empty with no toast or error message.
- **Timeline tasks in Horizon** — Timeline AI-generated tasks appear in the Horizon calendar. Deleting a timeline task from Horizon removes it from Timeline too. The description prefix `[timeline:…]` is what links them — do not strip it manually.
- **RLS is disabled** on all Supabase tables — anyone with the anon key can read and write all data. This is intentional for single-user personal use. Add Supabase Auth + Row Level Security before any multi-user deployment.
- **Voice input is Chrome/Edge only** — `SpeechRecognition` is not available in Firefox or Safari. The `isSpeechSupported` flag gates the mic button in all voice-enabled components. JARVIS text input still works fully in unsupported browsers.
- **JARVIS passive listening requires mic permission to already be granted** — `jarvis.autoStartIfEnabled()` uses `navigator.permissions.query({ name: "microphone" })` to check permission state; it only starts passive listening if permission is `"granted"`. It will never trigger a browser permission prompt automatically.
- **Single SpeechRecognition instance** — JARVIS owns the one global `recRef`. If both JARVIS and the Horizon voice overlay attempt to run simultaneously, the browser only honours one (browser-enforced). In practice: use one voice interface at a time.
- **JARVIS task time is UTC** — `task_time` is stored as `HH:MM` with no timezone. The Edge Function push scheduler compares this against UTC. If the user's local timezone differs from UTC, tasks may fire ±hours off. A `timezone` column would fix this for future enhancement.
- **JARVIS conversation history resets on page reload** — `conversationHistory` is a module-level array (session memory only). For persistence across reloads, serialize it to `localStorage["jarvis:history"]`.
- **`routeTree.gen.ts` is auto-generated** — never edit this file. It is regenerated automatically on every route file save during `npm run dev`. If the Vite plugin fails to regenerate after adding a new route file, restart the dev server.
- **`normalizeDesktopLayout` auto-places new items** — any website item not yet in `desktop_layout` is assigned the next free cell position. This causes a momentary layout shift until Supabase persists the new position.
- **Push notifications require all Firebase vars** — all `VITE_FIREBASE_*` environment variables must be set for FCM to initialize. The app logs `[fcm] Firebase not configured` and degrades gracefully (SW still registers for caching, but push is disabled).
- **Splashscreen fires once per page session** — `splashDone` lives in `RootComponent` React state. Route navigation does not re-trigger it; only a full browser reload does.
- **Timeline month range is hardcoded** — `TIMELINE_MONTHS` in `src/lib/timeline.ts` covers May 2026 – October 2026. To extend the planner, add entries to this array and run `TIMELINE_SETUP.sql` to ensure the `timeline_months` table schema is present.
- **Supabase realtime = full refetch** — `postgres_changes` subscriptions trigger a full `loadAll()` call for the affected store. For high-frequency writes (e.g. many tasks being created rapidly), debounce the refetch or switch to incremental row-level updates.
- **`useInView` in TimelineGroup** — Framer Motion's `useInView` with `once: true` and `margin: "0px 0px -40px 0px"` triggers timeline group entrance animations as they scroll into view. Groups already in the viewport animate immediately on mount; groups below the fold animate when scrolled to.
- **Capacitor build requires Android Studio** — `npm run cap:open` opens Android Studio which must be installed separately. The Capacitor config sets `webDir: "dist"` — always run `npm run build` before syncing native assets.
