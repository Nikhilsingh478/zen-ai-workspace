# AI Metrics — Complete Feature Documentation

**Last updated:** May 2026  
**Version:** Production (React 19 + Vite 7)

---

## Table of Contents

1. [Project Overview](#project-overview)
2. [Technology Stack](#technology-stack)
3. [Architecture](#architecture)
4. [Navigation Structure](#navigation-structure)
5. [Pages & Features](#pages--features)
   - [Websites (`/`)](#1-websites-)
   - [Desktop (`/desktop`)](#2-desktop-desktop)
   - [Prompts (`/prompts`)](#3-prompts-prompts)
   - [Link Board (`/links`)](#4-link-board-links)
   - [Image Board (`/images`)](#5-image-board-images)
   - [Important Messages (`/messages`)](#6-important-messages-messages)
   - [Insights (`/insights`)](#7-insights-insights)
   - [Ask (`/ask`)](#8-ask-ask)
   - [JARVIS (`/jarvis`)](#9-jarvis-jarvis)
   - [Context Window (`/context`)](#10-context-window-context)
   - [Horizon (`/horizon`)](#11-horizon-horizon)
   - [Timeline (`/timeline`)](#12-timeline-timeline)
6. [Core Libraries & Services](#core-libraries--services)
   - [Supabase Integration](#supabase-integration)
   - [Gemini AI Integration](#gemini-ai-integration)
   - [Firebase Cloud Messaging (FCM)](#firebase-cloud-messaging-fcm)
   - [Global State Stores](#global-state-stores)
   - [Usage Tracking](#usage-tracking)
7. [Environment Variables](#environment-variables)
8. [Database Schema](#database-schema)

---

## Project Overview

**AI Metrics** is a single-user personal AI operating system — a private, self-hosted dashboard designed to centralize every dimension of the user's digital life and cognitive workflow. It is not a multi-tenant SaaS product; it is a bespoke personal command center.

The core philosophy: every piece of information the user cares about — tools, prompts, links, messages, tasks, goals — lives in one dark-mode interface, and an AI layer (Google Gemini) understands all of it and can be spoken to via voice or chat.

Key capabilities at a glance:
- **Organize** — bookmark AI websites, save reusable prompts, curate links and images, log important messages
- **Plan** — manage daily tasks on Horizon with calendar view and priority levels; plan months of goals on Timeline
- **Act** — talk to JARVIS by voice to create tasks, get answers, and execute commands hands-free
- **Reflect** — see usage analytics, task completion rates, notification status, and domain-level progress on Insights
- **Context** — teach JARVIS about your life once via the Context Window; it injects that knowledge into every future AI interaction

---

## Technology Stack

| Layer | Technology |
|---|---|
| UI Framework | React 19 (concurrent features, `useSyncExternalStore`) |
| Build Tool | Vite 7 (file-based HMR, ESM-native) |
| Routing | TanStack Router v1 (file-based routing, type-safe params) |
| Styling | Tailwind CSS v4 with oklch color tokens |
| Animation | Framer Motion 11 (layout animations, AnimatePresence, spring physics) |
| Database / Realtime | Supabase JS v2 (PostgreSQL + Realtime subscriptions + Storage) |
| AI Model | Google Gemini API — `gemini-flash-latest` |
| Push Notifications | Firebase Cloud Messaging (FCM) v10 |
| Drag & Drop | @dnd-kit/core + @dnd-kit/sortable |
| UI Components | shadcn/ui (Radix-based, fully unstyled primitives) |
| Toast Notifications | Sonner |
| Charts | Recharts (LineChart, BarChart, PieChart, ResponsiveContainer) |
| Voice | Web Speech API (SpeechRecognition / webkitSpeechRecognition) |
| Markdown | react-markdown with syntax highlighting |
| Icons | Lucide React |

---

## Architecture

### File-Based Routing

Routes live under `src/routes/` and are automatically picked up by TanStack Router's Vite plugin. Each route file exports a `Route` object created via `createFileRoute(path)`. The root layout (`__root.tsx`) wraps all routes with the `AppShell` component.

```
src/
  routes/
    __root.tsx          ← Root layout, renders AppShell + <Outlet />
    index.tsx           ← / (Websites)
    desktop.tsx         ← /desktop
    prompts.tsx         ← /prompts
    links.tsx           ← /links
    images.tsx          ← /images
    messages.tsx        ← /messages
    insights.tsx        ← /insights
    ask.tsx             ← /ask
    jarvis.tsx          ← /jarvis
    context.tsx         ← /context
    horizon.tsx         ← /horizon
    timeline.tsx        ← /timeline
  lib/
    supabase.ts         ← Supabase client
    gemini.ts           ← GeminiAPI class, UserContext builder
    jarvis.ts           ← JARVIS voice engine + global store
    horizon.ts          ← Horizon task store (useSyncExternalStore)
    timeline.ts         ← Timeline store + domain/month config
    fcm.ts              ← Firebase FCM init + useFCMStatus hook
    store.ts            ← Shared utilities (faviconFor, etc.)
    usage-tracking.ts   ← Client-side usage analytics
    utils.ts            ← cn() and misc helpers
  components/
    app-shell.tsx       ← Navigation shell (sidebar + mobile nav)
    jarvis/
      ai-core.tsx       ← Animated JARVIS orb (center HUD panel)
```

### State Management Philosophy

The app uses **module-level external stores** (not Redux, not Zustand) combined with React 19's `useSyncExternalStore`. Each domain (Horizon tasks, JARVIS state, Timeline months) has its own singleton module that:
1. Holds a `let state` variable
2. Maintains a `Set<() => void>` of listeners
3. Exposes `subscribe`, `getSnapshot`, and mutation functions
4. Subscribes to Supabase Realtime for live database changes

This means state is shared across all components that call the same hook, and a Supabase INSERT/UPDATE from any source (even another browser tab) triggers an instant UI update.

---

## Navigation Structure

### App Shell (`src/components/app-shell.tsx`)

The shell renders two navigation surfaces depending on screen size:

**Desktop Sidebar** — always visible on `md:` and above. Lists all 12 routes in a vertical rail with icons and labels.

**Mobile Bottom Navigation** — split into two tiers:

| Tier | Routes |
|---|---|
| `MOBILE_PRIMARY` (bottom bar, always visible) | Websites, Horizon, JARVIS, Timeline |
| `MOBILE_SECONDARY` (expandable overflow menu) | Ask, Prompts, Links, Images, Messages, Insights, Context |

The bottom bar shows the 4 primary destinations as full-width icon+label tabs. A "More" button opens a sheet/drawer listing the secondary destinations.

All navigation items have:
- Route path (`to`)
- Display label
- Lucide icon
- Active state detection via `useMatch`

---

## Pages & Features

---

### 1. Websites (`/`)

**Purpose:** Central bookmark manager for AI tools and websites the user actively uses.

**Data model:**
```ts
type Website = {
  id: string
  name: string
  url: string
  description: string
  tags: string[]
  createdAt: string
}
```

**Features:**
- **Add Website** — modal form with name, URL, description, and comma-separated tags fields
- **Favicon display** — each website card shows the site's favicon fetched via a Google favicon proxy (`faviconFor(url, size)` from `src/lib/store.ts`)
- **Tags** — each site can have multiple tags; tags are rendered as small badges on the card
- **Quick copy** — copy the URL to clipboard with one click
- **Open in new tab** — external link button on each card
- **Delete** — remove a website from the list
- **Search / filter** — filter cards by name or tag in real time
- **Supabase persistence** — all websites are stored in the `websites` table; changes reflect immediately via Realtime

**AI integration:** All saved websites are injected into the Gemini context when the user opens Ask or uses JARVIS, so the AI can reference them by name when answering questions.

---

### 2. Desktop (`/desktop`)

**Purpose:** A virtual desktop-style folder organizer for grouping related links, notes, or concepts.

**Features:**
- **Folders** — create named folders (e.g., "Dev Tools", "Research", "Inspiration")
- **Items within folders** — each folder holds a list of text entries (URLs, notes, or references)
- **Drag-and-drop reordering** — powered by @dnd-kit; folders and items within folders can be reordered by dragging
- **Inline editing** — click a folder name or item to rename it in place
- **Add/remove** — add new folders via a button; add items inside any folder; delete folders or individual items
- **Supabase persistence** — folder structure is persisted; Realtime keeps it in sync

**AI integration:** The user's Desktop folders (folder names + item counts) are included in the Gemini context string injected into Ask and JARVIS, giving the AI awareness of what folder groups exist.

---

### 3. Prompts (`/prompts`)

**Purpose:** A personal prompt library — a curated collection of AI prompt templates the user reuses regularly.

**Data model:**
```ts
type Prompt = {
  id: string
  title: string
  body: string
  createdAt: string
}
```

**Features:**
- **Add prompt** — create a prompt with a title and full body text; body supports multi-line prompts
- **Copy to clipboard** — one-click copy of the prompt body; triggers a Sonner toast confirmation
- **Edit prompt** — modify title or body inline
- **Delete prompt** — remove a prompt with confirmation
- **Search** — filter prompts by title in real time
- **Usage count tracking** — each copy action is tracked via the usage-tracking module, contributing to the Insights page stats
- **Supabase persistence** — stored in the `prompts` table

**AI integration:** All saved prompts (title + body) are injected into Gemini context, so the AI in Ask/JARVIS knows about the user's prompt library.

---

### 4. Link Board (`/links`)

**Purpose:** A quick-access board for arbitrary URLs that don't belong in Websites (temporary links, references, research sources).

**Data model:**
```ts
type Link = {
  id: string
  name: string
  url: string
  description?: string | null
  createdAt: string
}
```

**Features:**
- **Add link** — name, URL, and optional description
- **Favicon display** — same `faviconFor()` utility as Websites
- **Open externally** — all links open in new tabs
- **Copy URL** — one-click clipboard copy
- **Delete**
- **Supabase persistence**

**AI integration:** All links (name + URL + description) are included in the Gemini context string.

---

### 5. Image Board (`/images`)

**Purpose:** A visual mood board / reference image collection stored in Supabase Storage.

**Features:**
- **Upload images** — file picker accepts common image formats; images are uploaded to a Supabase Storage bucket
- **Grid view** — images displayed in a responsive masonry-style grid
- **Full-screen preview** — click any image to open a lightbox overlay
- **Delete** — remove images from both the UI and Storage
- **Lazy loading** — images load progressively as they enter the viewport
- **Supabase Storage** — images are stored in a dedicated bucket; public URLs are returned and stored in the `images` table

---

### 6. Important Messages (`/messages`)

**Purpose:** A log of important messages, reminders, or notes the user wants to remember — emails, SMS screenshots, key decisions, commitments.

**Data model:**
```ts
type Message = {
  id: string
  motive: string    // e.g., "Commitment", "Reminder", "Decision"
  time: string      // freeform time reference, e.g., "Monday 3pm"
  message: string   // the full message text
  createdAt: string
}
```

**Features:**
- **Add message** — form with motive category, time reference, and message body
- **Delete**
- **Supabase persistence**

**AI integration:** All messages (motive + time + message text) are injected into Gemini context, enabling the AI to reference what the user has logged as important when answering questions.

---

### 7. Insights (`/insights`)

**Purpose:** A personal analytics dashboard showing usage statistics, productivity metrics, and system health.

**Data sources:**
- `src/lib/usage-tracking.ts` — client-side event log stored in `localStorage` and/or Supabase, tracking page visits, copy actions, AI queries, etc.
- `src/lib/horizon.ts` — live Horizon task data (completion rates, pending tasks, today's tasks)
- `src/lib/fcm.ts` — Firebase FCM notification permission status

**UI components:**

**Metric Cards** — animated cards (Framer Motion spring entrance) showing a single KPI:
- Large colored value
- Label in uppercase tracking-widest
- Optional sub-label
- Icon with matching accent color
- Hover: border brightens, box-shadow appears

**Section wrappers** — grouped by domain with a left-border accent color and a small section title

**Charts (Recharts):**
- `LineChart` + `ResponsiveContainer` — trend over time (daily/weekly activity)
- `BarChart` — bar comparison of activity by category
- `PieChart` + `Cell` — domain distribution (AI queries by feature, task breakdown by domain, etc.)
- Custom `ChartTooltip` component — dark glass-effect tooltip with color-coded entries

**Rank lists** — ordered lists showing top websites, top prompts, top domains by usage count; each row shows favicon (with letter fallback on error), rank number, name, and count

**Horizon task stats shown:**
- Total tasks created (all-time)
- Today's pending tasks
- Today's completed tasks
- Total active (incomplete) tasks
- Completion rate percentage

**FCM status indicator:**
- Shows whether push notification permission is `granted`, `denied`, or `default`
- Bell icon (granted) vs BellOff icon (denied/default)
- Colored accent: green for granted, muted for others

**Refresh button** — re-fetches all analytics data on demand

---

### 8. Ask (`/ask`)

**Purpose:** A full-featured AI chat interface powered by Google Gemini that is fully aware of the user's entire saved data.

**Context injection:**
On the first message of every new conversation, the system prompt is automatically built to include:
1. **Role preamble** — "You are Jarvis — a sharp, concise AI assistant embedded in the user's personal AI Metrics workspace."
2. **Saved Websites** — all website names, URLs, descriptions, and tags
3. **Saved Prompts** — all prompt titles and bodies
4. **Saved Links** — all link names, URLs, and descriptions
5. **Important Messages** — all messages with motive, time, and body
6. **Desktop Folders** — folder names and item counts

This context is built by `buildContextString(userContext)` in `src/lib/gemini.ts` and prepended to the first user message. Subsequent turns in the same conversation use only the conversation history (no re-injection), which keeps token usage efficient.

**Features:**
- **Multi-turn conversation** — full conversation history is maintained in component state and passed to Gemini on every request; the AI can reference previous messages in the same session
- **Voice input** — microphone button opens the browser's SpeechRecognition API; spoken text is transcribed and placed in the input field
- **Markdown rendering** — AI responses are rendered with `react-markdown`, supporting headings, bold, italic, code blocks, lists, and links
- **Streaming-style UI** — messages appear with a fade-in animation as they arrive
- **Dual API key failover** — if the primary `VITE_GEMINI_API_KEY` returns a 429 (rate limit) or 403 (auth), the request is automatically retried with `VITE_GEMINI_API_KEY_2` transparently
- **Error handling** — descriptive error messages for 400 (bad request), 403 (invalid key), 429 (rate limit), and network failures
- **Clear conversation** — button to wipe the chat history and start fresh
- **Sonner toasts** — error states surface as dismissible toasts

**Model configuration:**
```
model: gemini-flash-latest
temperature: 0.7
topK: 40
topP: 0.95
maxOutputTokens: 8192
```

---

### 9. JARVIS (`/jarvis`)

**Purpose:** A hands-free voice AI interface — the user's personal voice-activated assistant that can understand natural language commands, answer questions with full user context, and create Horizon tasks on the fly.

**Full name:** Just A Rather Very Intelligent System

#### Wake Word Detection

JARVIS runs a persistent passive listening loop in the background (desktop only). Wake words:
- `"jarvis"`
- `"hey jarvis"`
- `"okay jarvis"`

When a wake word is detected, JARVIS instantly switches from passive mode to command mode without restarting the SpeechRecognition instance. Any words spoken immediately after the wake word (in the same breath) are captured inline.

**Mobile behavior:** Passive wake word listening is disabled on mobile because the OS plays a beep every time the microphone starts/stops, causing an infinite beep loop. On mobile, the user must use **Tap-To-Talk** — pressing the central orb button to start listening manually.

#### Voice Engine (`src/lib/jarvis.ts`)

The voice engine is a carefully engineered wrapper around the Web Speech API:

| Parameter | Value | Purpose |
|---|---|---|
| `continuous` | `true` | Don't stop after one utterance |
| `interimResults` | `true` | Show real-time transcript while speaking |
| `lang` | `en-US` | Language model |
| `SILENCE_THRESHOLD_MS` | `1200` ms | Wait 1.2s after last speech before finalizing command |
| `MAX_LISTEN_MS` | `20000` ms | Hard 20s ceiling per command session |

**Buffering logic:** The engine accumulates ALL final transcript segments (multiple `isFinal=true` events that browsers fire for a single long utterance) into `accumulatedFinalText` and only processes the full command after a silence gap. This prevents long commands from being cut off mid-sentence — a common failure in naive implementations.

**Voice state machine:**

```
idle → listening → processing → speaking → idle
```

- `idle` — microphone off, wake word loop running (desktop) or waiting for tap (mobile)
- `listening` — actively capturing the user's command; transcript displayed live
- `processing` — command sent to Gemini; waiting for response
- `speaking` — response is being read aloud via the Web Speech Synthesis API

#### Task Creation via Voice

JARVIS understands natural language task requests. Example commands:
- "Add a task to review my PRs tomorrow at 2pm"
- "Create a high priority task for gym on Friday at 6am"
- "Remind me to call the client next Monday at noon"

The command is sent to Gemini with a system prompt instructing it to parse task details. Gemini returns a structured JSON object containing:
```ts
type ParsedTask = {
  title: string
  taskDate: string      // YYYY-MM-DD
  taskTime: string      // HH:MM
  priority: "low" | "medium" | "high"
  description?: string
}
```
The task is then written directly to Supabase via `addTaskDirect()` from `src/lib/horizon.ts`. The Horizon Realtime subscription picks it up and the task appears on the Horizon page instantly.

#### 3-Column HUD Layout

The JARVIS page is a full-screen heads-up display with three panels:

**Left panel — Status Panel (`StatusPanel` component):**
- Live digital clock (updates every second via `setInterval`)
- JARVIS voice state badge (colored by state: idle=dim blue, listening=blue-300, processing=sky-400, speaking=blue-300)
- Horizon task stats:
  - Pending today
  - Completed today
  - Total active tasks
- Enable/disable JARVIS toggle

**Center panel — AI Core (`AICore` component, `src/components/jarvis/ai-core.tsx`):**
- Animated orb — a multi-layered animated circle that pulses when listening, spins when processing, and glows when speaking
- Tap-to-talk button (center of orb, functional on mobile and desktop)
- Live transcript display — shows the partially-recognized speech in real time below the orb
- Voice state label

**Right panel — Chat Log:**
- Scrollable message history showing the conversation between the user and JARVIS
- Each message has a role badge (User / JARVIS), timestamp, and content
- Messages of type `task_created` show a special confirmation UI with the created task details (title, date, time, priority)
- Messages of type `error` show in a distinct error style
- Trash button to clear all messages

#### Mobile Layout

On mobile, the 3-column layout collapses to a single-column view:
- Back button to navigate away
- Compact status at the top
- AI Core orb centered
- Transcript below the orb
- Chat log below that, scrollable

#### Persistence

JARVIS chat messages are session-only (not persisted to Supabase). The `enabled` preference (whether JARVIS passive listening is on) is persisted to `localStorage` under key `jarvis:enabled`.

#### Browser Compatibility

`isJarvisSupported` is exported from `src/lib/jarvis.ts`. It is `true` only if `window.SpeechRecognition` or `window.webkitSpeechRecognition` exists. On unsupported browsers, the JARVIS UI shows a friendly unsupported message.

---

### 10. Context Window (`/context`)

**Purpose:** A free-form personal knowledge base that is injected into JARVIS's system prompt, giving the AI persistent knowledge about the user's life, preferences, goals, and emotional state.

**How it works:**
1. The user writes anything they want in a large textarea — goals, personality notes, current projects, communication preferences, location, hobbies, stress levels, etc.
2. Pressing "Save" writes the text to `localStorage` under the key `jarvis:user-context`
3. When JARVIS processes a command, it reads this context from `localStorage` and prepends it to the Gemini system prompt before the user's message
4. The AI in Ask also reads this context

**Example context text:**
```
I am currently focusing on building my startup.
I prefer concise answers but appreciate a supportive tone when I'm stressed.
I live in New York and my main hobbies are coding and reading sci-fi.
My current priority is shipping the MVP by June.
```

**UI:**
- Header with Brain icon and subtitle "Teach JARVIS about your life, preferences, and emotional state."
- A full-height resizable textarea labeled "Personal Database" with a UserCircle icon
- Placeholder text showing an example context entry
- Save button — triggers `localStorage.setItem("jarvis:user-context", contextText)` and shows a Sonner success toast "Personal context updated for J.A.R.V.I.S."
- Spell-check is disabled to avoid red underlines interrupting the writing flow

**Storage:** `localStorage` only (not Supabase) — keeps sensitive personal notes off the server.

---

### 11. Horizon (`/horizon`)

**Purpose:** A daily task manager with a calendar interface, priority levels, and Firebase push notification reminders.

#### Data Model

```ts
type Priority = "low" | "medium" | "high"

type HorizonTask = {
  id: string
  title: string
  description: string | null
  taskDate: string           // YYYY-MM-DD
  taskTime: string           // HH:MM (24h)
  priority: Priority
  completed: boolean
  notificationEnabled: boolean
  createdAt: string
}
```

Tasks are stored in the Supabase `horizon_tasks` table. The schema maps snake_case columns to camelCase in the `rowToTask()` function.

#### Calendar View

The calendar displays days in a horizontal strip or grid layout (responsive). The selected date is highlighted with an arctic-blue accent. Days that have tasks show a colored dot indicator beneath the day number. Clicking a date filters the task list to that day.

Navigation:
- Previous/next month arrow buttons
- "Today" shortcut button
- Month/year label in the header

#### Task List

Below the calendar, tasks for the selected date are listed. Each task card shows:
- **Title** — main task name
- **Time** — displayed in 12-hour format (e.g., "2:30 PM")
- **Priority badge** — colored pill:
  - `low` → muted green
  - `medium` → amber/yellow
  - `high` → red
- **Notification bell** — icon showing whether FCM notification is enabled for this task
- **Completion checkbox** — clicking toggles the `completed` field via Supabase; completed tasks get a strikethrough style
- **Delete button** — on mobile: always visible at `opacity-60`; on desktop: hidden at `opacity-0`, appears on group hover (`md:opacity-0 md:group-hover:opacity-100`)

#### Add/Edit Task Modal

A Framer Motion animated modal form for creating or editing tasks:

| Field | Type | Notes |
|---|---|---|
| Title | text input | Required |
| Description | textarea | Optional |
| Date | date picker | Defaults to currently selected date |
| Time | time input | 24-hour format |
| Priority | radio/select | low / medium / high |
| Notification | toggle | Enables FCM push reminder |

Submitting creates a new task via `addTaskDirect()` or updates an existing one via Supabase `update`.

#### Priority System

Priority affects visual styling throughout:
- Card left-border color
- Priority badge background and text color
- Default sort order: high tasks float to the top of the list

#### Firebase Cloud Messaging Integration

When a task has `notificationEnabled: true`, the app schedules a push notification via FCM to remind the user at the task's date/time. The FCM token is obtained via `getToken()` from Firebase and stored locally. The `useFCMStatus()` hook exposes:
- `permission` — browser notification permission state (`granted` / `denied` / `default`)
- `token` — the FCM device token (string)
- `supported` — whether FCM is supported in the current browser

On the Insights page, FCM status is displayed with a Bell / BellOff icon.

#### Supabase Realtime

The Horizon store (`src/lib/horizon.ts`) subscribes to the `horizon_tasks` Supabase Realtime channel. INSERT, UPDATE, and DELETE events on the `horizon_tasks` table immediately patch the in-memory store and trigger a re-render across all components using `useHorizon()`. This means tasks created by JARVIS voice commands appear on the Horizon page without any manual refresh.

#### Shared with Timeline

Tasks created by Timeline are written into `horizon_tasks` with a special description prefix:
```
[timeline:2026-05:gym] 🏋️ Gym
```
Horizon renders these tasks normally (they appear in the calendar on their dates). Timeline reads them back by filtering for this prefix. There is no separate timeline tasks table — both pages share `horizon_tasks`.

---

### 12. Timeline (`/timeline`)

**Purpose:** A multi-month AI-powered life schedule planner. The user writes their goals for a month, clicks Generate, and Gemini produces a detailed day-by-day schedule across 9 life domains. The generated tasks are exported to Horizon and tracked with progress rings and analytics charts.

#### Months Covered

The Timeline covers 6 months (May – October 2026):

| Key | Label |
|---|---|
| `2026-05` | May 2026 |
| `2026-06` | June 2026 |
| `2026-07` | July 2026 |
| `2026-08` | August 2026 |
| `2026-09` | September 2026 |
| `2026-10` | October 2026 |

Each month has its own context (goals text) and generated schedule, persisted to the `timeline_months` Supabase table.

#### 9 Life Domains

Every Timeline task belongs to exactly one domain:

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

Each domain has a matching glow color (35% opacity version of the base color) used for card shadows and progress bar glows.

#### Month Selector

A horizontal scrollable tab strip at the top of the page shows all 6 months plus an "Overview" tab. Each tab displays:
- Month short label (May, Jun, Jul…)
- A circular SVG progress ring showing the completion percentage for that month's tasks
- Active tab is visually highlighted with an arctic-blue glow and border

#### Goal Setting

Each month has a large textarea for the user to write their goals/intentions for that month in plain English. Example:
```
May goals:
- Ship the AI Metrics MVP by May 15
- Go to the gym 4x per week
- Complete 2 freelance client projects
- Practice cricket every weekend
```
The text is saved to Supabase (`timeline_months.context`) on blur or via a save button.

#### AI Schedule Generation

When the user clicks **Generate Schedule**:
1. The goal text (context) is sent to Gemini with a structured system prompt requesting a detailed schedule
2. Gemini returns a schedule broken into tasks with date, time, domain, and title
3. The generated schedule text is saved to `timeline_months.generated_schedule`
4. Each task is parsed and written to `horizon_tasks` via `addTasksBatch()` with the `[timeline:MONTH:DOMAIN]` description prefix

Tasks created this way appear immediately in Horizon (via Realtime), and the Timeline page reads them back by filtering `horizon_tasks` for the timeline description prefix.

#### Task Cards (per-domain view)

Tasks for the selected month are grouped by domain. Each domain group shows:
- Domain icon + label + color accent header
- List of tasks sorted by date
- Each task: date, time range (`startTime` → `endTime`, 60-minute duration default), title
- Completion toggle — calls `toggleTask(id)` → `toggle()` from `useHorizon()` → updates `horizon_tasks.completed` in Supabase

#### Analytics Panel (per-month)

Shown below the task list for the selected month:

**4 stat cards:**
- Tasks Done: `completed / total` count
- Active Days: number of distinct dates with tasks
- Completion: overall percentage
- Domains: number of active domains in this month

**Overall progress bar** — animated gradient bar (deep blue → sky → light blue) showing completion percentage, animated with a 1.2s ease-out Framer Motion transition

**Domain breakdown** — per-domain horizontal progress bars, sorted by task count descending, each showing domain icon + label + animated fill bar + percentage

#### Overview Panel (all months)

Selected when the "Overview" tab is active. Aggregates statistics across all 6 months:

**4 stat cards:**
- Total Tasks (all months combined)
- Completed (all months combined)
- Active Months (months with at least one task)
- Overall Rate (completion % across all tasks)

**Master progress bar** — labeled "May → Oct 2026", animated gradient, showing overall completion percentage

**Month-by-month breakdown** — each month as a row with its label, individual progress bar, task count, and completion percentage

**Domain breakdown (all months)** — aggregated per-domain stats sorted by total task count

#### Data Architecture

Timeline does not have its own tasks table. It uses `horizon_tasks` as its task storage, encoding the month key and domain ID into the task's `description` field:

```
[timeline:2026-05:gym] 🏋️ Gym
```

The regex `TL_RE = /^\[timeline:([^:]+):([^\]]+)\]/` extracts `monthKey` and `domainId` from any Horizon task's description. The `horizonToTimeline()` function converts a `HorizonTask` into a `TimelineTask`. The `useTimeline()` hook derives its task list entirely from the Horizon store — no separate Supabase query.

The `timeline_months` table stores only month metadata (context text + generated schedule text), not the tasks themselves.

---

## Core Libraries & Services

### Supabase Integration

**Client:** `src/lib/supabase.ts` — initialized with `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.

**Tables used:**
- `websites` — saved AI tools
- `prompts` — reusable prompt templates
- `links` — quick-access links
- `images` — image metadata (files in Storage)
- `messages` — important messages log
- `desktop` — folder structure
- `horizon_tasks` — all tasks (Horizon + Timeline)
- `timeline_months` — month metadata (context + generated schedule)

**Realtime subscriptions:** `horizon_tasks` table is subscribed to via `supabase.channel()` in `src/lib/horizon.ts`. INSERT, UPDATE, DELETE events patch the in-memory store immediately without any polling.

**Storage:** Supabase Storage bucket used by the Images page for uploading and serving images.

---

### Gemini AI Integration

**File:** `src/lib/gemini.ts`

**Class:** `GeminiAPI` — singleton exported as `geminiAPI`

**Model:** `gemini-flash-latest` (via `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent`)

**Dual key failover:**
- Primary key: `VITE_GEMINI_API_KEY`
- Fallback key: `VITE_GEMINI_API_KEY_2`
- On 429 (rate limit) or 403 (auth error) from primary, the request is automatically retried with the fallback key
- User-facing error messages are human-readable (not raw HTTP codes)

**Context builder (`buildContextString`):**
Accepts a `UserContext` object and produces a structured markdown string with labeled sections for websites, prompts, links, messages, and desktop folders. This string is prepended to the first message of any conversation in Ask or JARVIS.

**Generation config:**
```json
{
  "temperature": 0.7,
  "topK": 40,
  "topP": 0.95,
  "maxOutputTokens": 8192
}
```

---

### Firebase Cloud Messaging (FCM)

**File:** `src/lib/fcm.ts`

**Hook:** `useFCMStatus()` — returns `{ permission, token, supported }`

FCM delivers push notification reminders for Horizon tasks with `notificationEnabled: true`. The app requests notification permission on first use. The FCM VAPID key is required for web push (`VITE_FIREBASE_VAPID_KEY`).

---

### Global State Stores

The app uses three module-level external stores, all following the same pattern:

#### Horizon Store (`src/lib/horizon.ts`)

- **State:** `{ tasks: HorizonTask[], loaded: boolean }`
- **Hook:** `useHorizon()` → `{ tasks, loaded, toggle, addTask, deleteTask, ... }`
- **Boot:** `ensureBooted()` — fetches all tasks from Supabase on first mount, then subscribes to Realtime
- **Direct mutations:** `addTaskDirect()`, `getHorizonTasks()` — used by JARVIS to create tasks without going through the React hook

#### JARVIS Store (`src/lib/jarvis.ts`)

- **State:** `{ voiceState, isAwake, messages, transcript, enabled }`
- **Hook:** `useJarvis()` → the current state snapshot
- **Actions:** exposed via the `jarvis` object: `jarvis.enable()`, `jarvis.disable()`, `jarvis.sendMessage(text)`, `jarvis.clearMessages()`
- **Persistence:** `enabled` saved to `localStorage("jarvis:enabled")`

#### Timeline Months Store (`src/lib/timeline.ts`)

- **State:** `{ months: Record<string, TimelineMonth>, loaded: boolean }`
- **Hook:** `useTimeline()` → `{ tasks, loaded, saveContext, saveGeneratedSchedule, toggleTask, getMonthData, getMonthTasks, getMonthProgress }`
- **Tasks:** derived from Horizon store (no separate fetch) — `horizonTasks.map(horizonToTimeline).filter(Boolean)`
- **Month metadata:** fetched from `timeline_months` table on boot via `ensureMonthsBooted()`

---

### Usage Tracking

**File:** `src/lib/usage-tracking.ts`

**Function:** `getInsightsData()` → `InsightsData`

Tracks client-side events:
- Page visits (which routes are viewed and how often)
- AI queries (how many times Ask and JARVIS are used)
- Copy actions (prompts, URLs)
- Task creation events

Data is stored in `localStorage` as timestamped event logs. The Insights page calls `getInsightsData()` to get aggregated stats for all chart and metric card displays.

---

## Environment Variables

All environment variables are prefixed with `VITE_` to be accessible in the browser bundle:

| Variable | Purpose | Required |
|---|---|---|
| `VITE_GEMINI_API_KEY` | Primary Google Gemini API key | Yes |
| `VITE_GEMINI_API_KEY_2` | Fallback Gemini key (rate limit failover) | Recommended |
| `VITE_SUPABASE_URL` | Supabase project URL | Yes |
| `VITE_SUPABASE_ANON_KEY` | Supabase anonymous (public) key | Yes |
| `VITE_FIREBASE_API_KEY` | Firebase project API key | Yes (for FCM) |
| `VITE_FIREBASE_AUTH_DOMAIN` | Firebase auth domain | Yes (for FCM) |
| `VITE_FIREBASE_PROJECT_ID` | Firebase project ID | Yes (for FCM) |
| `VITE_FIREBASE_STORAGE_BUCKET` | Firebase storage bucket | Yes (for FCM) |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | FCM sender ID | Yes (for FCM) |
| `VITE_FIREBASE_APP_ID` | Firebase app ID | Yes (for FCM) |
| `VITE_FIREBASE_VAPID_KEY` | FCM VAPID key for web push | Yes (for FCM) |

---

## Database Schema

### `horizon_tasks`
```sql
id                   uuid         primary key default gen_random_uuid()
title                text         not null
description          text
task_date            date         not null
task_time            time         not null
priority             text         not null default 'medium'  -- 'low' | 'medium' | 'high'
completed            boolean      not null default false
notification_enabled boolean      not null default false
created_at           timestamptz  not null default now()
```

### `timeline_months`
```sql
month_key            text         primary key  -- e.g., '2026-05'
context              text         not null default ''
generated_schedule   text
updated_at           timestamptz  not null default now()
```

### `websites`
```sql
id           uuid         primary key default gen_random_uuid()
name         text         not null
url          text         not null
description  text         not null default ''
tags         text[]       not null default '{}'
created_at   timestamptz  not null default now()
```

### `prompts`
```sql
id           uuid         primary key default gen_random_uuid()
title        text         not null
body         text         not null
created_at   timestamptz  not null default now()
```

### `links`
```sql
id           uuid         primary key default gen_random_uuid()
name         text         not null
url          text         not null
description  text
created_at   timestamptz  not null default now()
```

### `messages`
```sql
id           uuid         primary key default gen_random_uuid()
motive       text         not null
time         text         not null
message      text         not null
created_at   timestamptz  not null default now()
```

### `images`
```sql
id           uuid         primary key default gen_random_uuid()
url          text         not null       -- Supabase Storage public URL
name         text
created_at   timestamptz  not null default now()
```

---

*Documentation covers all 12 pages and all core systems as of May 2026. For Timeline database setup, see `TIMELINE_SETUP.sql` in the project root.*
