"# AI Matrix — Technical Documentation

> A living, exhaustive reference for the AI Matrix codebase. This document is the source-of-truth for every architectural decision, data shape, component, and styling choice in the app. Written for a developer who has never seen the codebase.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Architecture](#2-architecture)
3. [Data Model (Exhaustive)](#3-data-model-exhaustive)
4. [State Management](#4-state-management)
5. [Routing](#5-routing)
6. [Components (Every File)](#6-components-every-file)
7. [Routes / Pages (Every File)](#7-routes--pages-every-file)
8. [Styling System](#8-styling-system)
9. [Build & Deployment](#9-build--deployment)
10. [Known Issues & Future Work](#10-known-issues--future-work)
11. [Gotchas & Decisions Log](#11-gotchas--decisions-log)

---

## 1. Project Overview

### What it is
**AI Matrix** (internally also titled *AI Metrics*) is a single-page personal operating system for AI tools. Think of it as your browser's new-tab replacement and a curated dashboard for every AI product you use. It ships four top-level surfaces:

- **Websites** — a searchable, tag-filterable card grid of AI websites (ChatGPT, Claude, Perplexity, Midjourney, etc.).
- **Desktop** — an OS-style launcher grid with drag-and-drop reordering, folders, a right-click \"New Folder\" context menu, and a drag ghost. Meant to feel like macOS Launchpad or iPadOS Home Screen.
- **Prompts** — a Pinterest/masonry library of reusable prompt templates; click-to-copy.
- **Ask** — a Gemini-powered chat surface (`gemini-flash-latest`) that receives the user's own websites + prompts as context.

### Who it's for
Power users of AI tools who want a single, fast, keyboard-friendly home for their AI stack. It replaces \"that bookmark folder with 40 AI sites in it\" with a branded, dark, curated workspace.

### What problem it solves
- Fragmentation: AI tools live across tabs, bookmarks, Notion pages, and memory.
- Context loss: users repaste the same prompts dozens of times.
- No-backend simplicity: the whole app is a static SPA on localStorage — no account, no server, no sync overhead.

### Tech stack (exact versions from `package.json`)

**Runtime / framework**
- `react` `^19.2.0`, `react-dom` `^19.2.0`
- `@tanstack/react-router` `^1.168.0` (file-based routing)
- `@tanstack/react-start` `^1.167.14` (types only; SSR hooks retained but the app is rendered client-only via `main.tsx`)
- `@tanstack/router-plugin` `^1.167.10` (regenerates `routeTree.gen.ts`)
- `@tanstack/react-query` `^5.83.0` (installed but currently unused)

**Build**
- `vite` `^7.3.1`
- `@vitejs/plugin-react` `^5.0.4` (Babel JSX transform)
- `@tailwindcss/vite` `^4.2.1`
- `vite-tsconfig-paths` `^6.0.2`
- `typescript` `^5.8.3`
- `@cloudflare/vite-plugin` `^1.25.5` (installed; not wired into `vite.config.ts`)

**Styling**
- `tailwindcss` `^4.2.1` (Tailwind v4 — CSS-first, no PostCSS config)
- `tw-animate-css` `^1.3.4`
- `tailwind-merge` `^3.5.0`
- `class-variance-authority` `^0.7.1`
- `clsx` `^2.1.1`

**UI primitives (shadcn/ui on top of Radix)**
- `@radix-ui/react-*` (23 packages; see `package.json` for the full list, all 1.x / 2.x)
- `lucide-react` `^0.575.0` (icon set used everywhere)
- `sonner` `^2.0.7`, `vaul` `^1.1.2`, `cmdk` `^1.1.1`, `input-otp` `^1.4.2`
- `embla-carousel-react` `^8.6.0`, `react-day-picker` `^9.14.0`, `react-resizable-panels` `^4.6.5`, `recharts` `^2.15.4`

**Drag & drop**
- `@dnd-kit/core` `^6.3.1`

**Animation**
- `framer-motion` `^12.38.0`

**Forms & validation**
- `react-hook-form` `^7.71.2`, `@hookform/resolvers` `^5.2.2`, `zod` `^3.24.2`

**Search & markdown**
- `fuse.js` `^7.3.0` (installed; not currently used — the app does naive `includes()` search)
- `react-markdown` `^10.1.0`, `remark-gfm` `^4.0.1`, `rehype-highlight` `^7.0.2`
- `date-fns` `^4.1.0`

**Dev-only**
- `eslint` `^9.32.0`, `typescript-eslint` `^8.56.1`, `eslint-plugin-react-hooks`, `eslint-plugin-react-refresh`, `eslint-plugin-prettier`, `eslint-config-prettier`, `prettier` `^3.7.3`, `globals` `^15.15.0`, `@types/node` `^22.16.5`, `@types/react` / `@types/react-dom` `^19.2.0`.

### Folder structure

```
/
├── api/
│   └── github.ts              # Legacy/unused GitHub API handler (not wired)
├── attached_assets/           # Historical prompts / design notes from Lovable
├── public/
│   └── favicon.svg
├── src/
│   ├── components/
│   │   ├── desktop/           # Desktop launcher subsystem
│   │   │   ├── command-palette.tsx   # ⌘K palette (not currently mounted)
│   │   │   ├── desktop-grid.tsx      # dnd-kit grid + context menu
│   │   │   ├── desktop-item.tsx      # Draggable/droppable website tile
│   │   │   ├── drag-ghost.tsx        # Pixel-sized DragOverlay ghost
│   │   │   ├── folder-icon.tsx       # Draggable/droppable folder tile
│   │   │   └── folder-overlay.tsx    # Folder modal (open/rename/delete)
│   │   ├── ui/                # 44 shadcn/ui primitives
│   │   ├── app-shell.tsx      # Global layout (sidebar + main + mobile nav)
│   │   ├── matrix-modal.tsx   # Shared dialog + shared form style constants
│   │   ├── page-header.tsx    # Title/subtitle/action triple
│   │   └── sync-indicator.tsx # \"Saved locally\" pill
│   ├── hooks/
│   │   └── use-mobile.tsx     # <768px media query hook
│   ├── lib/
│   │   ├── desktop-layout.ts  # Pure grid math (positioning, swap helpers)
│   │   ├── gemini.ts          # Gemini REST client (VITE_GEMINI_API_KEY)
│   │   ├── github-data.ts     # Types + SEED_DATA + localStorage I/O
│   │   ├── store.ts           # External store (useSyncExternalStore)
│   │   └── utils.ts           # cn() className merger
│   ├── routes/
│   │   ├── __root.tsx         # Root route wrapping <AppShell><Outlet/></AppShell>
│   │   ├── ask.tsx            # Chat surface
│   │   ├── desktop.tsx        # /desktop
│   │   ├── index.tsx          # / (Websites)
│   │   └── prompts.tsx        # /prompts
│   ├── main.tsx               # ReactDOM.createRoot + RouterProvider
│   ├── router.tsx             # createRouter + DefaultErrorComponent
│   ├── routeTree.gen.ts       # AUTO-GENERATED; never hand-edit
│   └── styles.css             # Tailwind v4 entry + design tokens
├── bunfig.toml                # (optional; bun support)
├── components.json            # shadcn registry config
├── eslint.config.js
├── index.html                 # Vite entry; #root + /src/main.tsx
├── package.json
├── tsconfig.json
├── vercel.json                # SPA rewrite rule
└── vite.config.ts
```

---

## 2. Architecture

### The full data flow

User action → hook → `updateStorage()` → `setState()` → `emit()` → every subscribed component re-renders with new snapshot → `saveData()` writes JSON to `localStorage`.

```
┌──────────────┐    useWebsites().add()     ┌────────────────┐
│  <Component> │───────────────────────────►│ updateStorage()│
└──────▲───────┘                            └──────┬─────────┘
       │ useSyncExternalStore                      │
       │                                    setState(newState)
┌──────┴───────┐                                   │
│   snap       │◄───── emit() ◄─────────── listeners.forEach()
│ (StoreState) │                                   │
└──────────────┘                             saveData(newState)
                                                   │
                                            localStorage.setItem
                                             (\"ai-matrix:data\", …)
```

There is **no network call anywhere** except Gemini (in `lib/gemini.ts`) and the favicon service (`https://www.google.com/s2/favicons?…`).

### The external store pattern (`src/lib/store.ts`)

Instead of React Context + `useState`, the app uses **React 18's `useSyncExternalStore`** with a module-level singleton:

```ts
const listeners = new Set<() => void>();
let state: StoreState = { storage: SEED_DATA, loaded: false };

function emit()                    { listeners.forEach((fn) => fn()); }
function setState(next: Partial<StoreState>) {
  state = { ...state, ...next };
  emit();
}
function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
function getSnapshot(): StoreState { return state; }
```

Each hook calls:
```ts
const snap = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
```
The third argument (server snapshot) is identical to the client snapshot because the store always starts as `SEED_DATA` — which is the whole point of the hydration strategy below.

### Why `SEED_DATA` exists (SSR-safe hydration)

The app is currently SPA-rendered, but `@tanstack/react-start` types remain wired in `routeTree.gen.ts`. That means any re-introduction of SSR needs identical HTML on the server and first client render.

The pattern:
1. **Initial state** is `{ storage: SEED_DATA, loaded: false }` — a constant available at module load on both server and client.
2. Components render once using `SEED_DATA` → HTML matches on both sides → **no hydration mismatch**.
3. After first mount, `useDataStore()`'s `useEffect(() => { ensureClientLoaded() }, [])` fires **client-only**, reads `localStorage`, and swaps `storage` for the saved value, flipping `loaded` to `true`.

```ts
let clientLoaded = false;
function ensureClientLoaded() {
  if (clientLoaded) return;
  clientLoaded = true;
  const stored = fetchData();
  setState({ storage: stored, loaded: true });
}
```

The `clientLoaded` guard is a module-level boolean — it runs exactly once per browser session, regardless of how many components mount.

### How hydration mismatches are avoided

| Hazard | Mitigation |
|---|---|
| Server and client seeing different `localStorage` | Server never touches it. Both start from `SEED_DATA`. |
| `SyncIndicator` says \"Loading…\" on server, \"Saved\" on client | The indicator returns `null` until `mounted` is `true` (`src/components/sync-indicator.tsx:13`). |
| dnd-kit's internal `useLayoutEffect` | `DesktopGrid` renders a plain `<div className=\"min-h-[240px] rounded-2xl\" />` until `mounted`, then swaps in the real grid (`desktop-grid.tsx:171`). |
| Date `new Date().toISOString()` differing | `now()` is only called inside user event handlers, never at render. Seeds use the fixed constant `\"2026-04-30T00:00:00.000Z\"`. |

---

## 3. Data Model (Exhaustive)

All types live in `src/lib/github-data.ts`. The file is misnamed (legacy from a prior GitHub-backed iteration) — there is no GitHub I/O anymore.

### `DataType`
```ts
type DataType = \"prompt\" | \"website\" | \"folder\" | \"layout\";
```
`\"folder\"` and `\"layout\"` are reserved for future first-class items but nothing produces them today — folders and layout entries live under `AppStorage.desktop`, not as items.

### `DataItemBase`
```ts
type DataItemBase = {
  id: string;          // crypto.randomUUID() at runtime, \"1\"..\"8\" / \"p1\"..\"p6\" for seeds
  type: DataType;      // discriminator
  tags: string[];      // free-form; lower-cased on search but stored as entered
  createdAt: string;   // ISO-8601
  updatedAt: string;   // ISO-8601; currently == createdAt (no rename/edit flow)
};
```

### `Prompt`
```ts
type Prompt = DataItemBase & {
  type: \"prompt\";
  title: string;       // one-line heading shown in the prompt card
  body: string;        // full prompt text; whitespace preserved, rendered monospace
};
```
Tags are stored as `[]` for prompts (the UI doesn't expose a tag input for them yet).

### `Website`
```ts
type Website = DataItemBase & {
  type: \"website\";
  name: string;        // card title
  url: string;         // normalized to start with \"https://\" on add
  description: string; // card body text (1–3 lines)
};
```

### `FutureDataItem`
```ts
type FutureDataItem = DataItemBase & {
  type: \"folder\" | \"layout\";
  [key: string]: unknown;
};
```
Placeholder variant so `AppDataItem` remains exhaustive and future migrations (e.g., storing folders as top-level items) won't need a breaking schema change.

### `AppDataItem`
```ts
type AppDataItem = Prompt | Website | FutureDataItem;
```
Discriminated union on `type`. Consumers use type guards like `items.filter((i): i is Website => i.type === \"website\")`.

### `DesktopLayoutEntry`
```ts
type DesktopLayoutEntry = {
  id: string;          // references Website.id OR DesktopFolder.id
  x: number;           // 0..(columns-1), snapped via Math.floor on load
  y: number;           // 0..Infinity, snapped via Math.floor on load
};
```

### `DesktopFolder`
```ts
type DesktopFolder = {
  id: string;          // UUID
  name: string;        // default \"New Folder\", renamable
  children: string[];  // ordered list of Website.id
};
```
Empty folders are **removed** automatically whenever their last child is removed (see `useWebsites().remove` and `useDesktopStorage().removeFromFolder`).

### `AppStorage` (the whole root shape)
```ts
type AppStorage = {
  items: AppDataItem[];
  desktop: {
    layout: DesktopLayoutEntry[];   // positions of items AND folders on the grid
    folders: DesktopFolder[];
  };
};
```
A single `AppStorage` is stored at the localStorage key `ai-matrix:data`.

### Relationships

```
┌────────────────┐                 ┌─────────────────┐
│  AppDataItem   │                 │ DesktopFolder   │
│  (Website)     │◄────children────┤ children: []    │
└───────┬────────┘                 └────────┬────────┘
        │                                   │
        │                                   │
        └────────┬──────────────────────────┘
                 │
        ┌────────▼────────────┐
        │ DesktopLayoutEntry  │ references either id
        │ { id, x, y }        │
        └─────────────────────┘
```

Invariants enforced by the store:
- A Website.id appears in **either** `desktop.layout` **or** exactly one `folder.children` — never both.
- Every `folder.id` in `folders` has a matching `layout` entry with the same id.
- Removing a Website removes it from `items`, from any containing folder, and from `layout`.
- Adding a Website pushes a new layout entry at `(0, 0)` — which is why new items appear in the top-left of the desktop.

### Normalization on load

`normalizeStorage(raw)` in `github-data.ts` hardens the parsed JSON:
- Non-objects → fall back to `SEED_DATA`.
- Items missing `id`/`type` are dropped.
- Tags that aren't string arrays become `[]`.
- Layout entries with non-finite `x`/`y` are dropped; others are floored and clamped to ≥ 0.
- Folders without `id`/`name` are dropped; `children` that aren't strings are removed.

Any corrupted write (e.g., a partial write during crash) is silently sanitized on next `fetchData()`.

### The full `SEED_DATA`

```ts
const seedDate = \"2026-04-30T00:00:00.000Z\";

SEED_ITEMS = [
  { id:\"1\", type:\"website\", name:\"ChatGPT\",    url:\"https://chat.openai.com\", tags:[\"chat\",\"general\"],  description:\"Conversational AI assistant for writing, coding and reasoning.\" },
  { id:\"2\", type:\"website\", name:\"Claude\",     url:\"https://claude.ai\",        tags:[\"chat\",\"writing\"],  description:\"Thoughtful long-context assistant by Anthropic.\" },
  { id:\"3\", type:\"website\", name:\"Perplexity\", url:\"https://perplexity.ai\",    tags:[\"search\"],          description:\"AI-powered search with cited sources.\" },
  { id:\"4\", type:\"website\", name:\"Midjourney\", url:\"https://midjourney.com\",   tags:[\"image\"],           description:\"Image generation with a strong artistic direction.\" },
  { id:\"5\", type:\"website\", name:\"Runway\",     url:\"https://runway.ml\",        tags:[\"video\"],           description:\"Generative video and creative tools for filmmakers.\" },
  { id:\"6\", type:\"website\", name:\"ElevenLabs\", url:\"https://elevenlabs.io\",    tags:[\"audio\"],           description:\"Realistic AI voice generation and cloning.\" },
  { id:\"7\", type:\"website\", name:\"Cursor\",     url:\"https://cursor.com\",       tags:[\"code\"],            description:\"AI-native code editor built for pairs programming.\" },
  { id:\"8\", type:\"website\", name:\"v0\",         url:\"https://v0.app\",           tags:[\"ui\",\"code\"],       description:\"Generative UI from natural language prompts.\" },
  { id:\"p1\", type:\"prompt\", title:\"Senior code reviewer\",  body:\"Act as a staff engineer. Review…\" },
  { id:\"p2\", type:\"prompt\", title:\"Tighten my writing\",    body:\"Edit the following text…\" },
  { id:\"p3\", type:\"prompt\", title:\"Explain like a teacher\",body:\"Explain the concept below…\" },
  { id:\"p4\", type:\"prompt\", title:\"Product brainstorm\",    body:\"Generate 10 distinct product ideas around the theme: {{theme}}…\" },
  { id:\"p5\", type:\"prompt\", title:\"SQL whisperer\",         body:\"Given this schema and natural language question…\" },
  { id:\"p6\", type:\"prompt\", title:\"Daily focus plan\",      body:\"Here is my todo list. Pick the 3 tasks with highest leverage…\" },
];

SEED_DATA = {
  items: SEED_ITEMS,
  desktop: {
    // 8 websites laid out left-to-right across the first row (x = 0..7, y = 0).
    layout: SEED_ITEMS.filter(i => i.type === \"website\").map((item, index) => ({
      id: item.id, x: index % 8, y: Math.floor(index / 8),
    })),
    folders: [],
  },
};
```

### Public API

```ts
fetchData(): AppStorage   // reads \"ai-matrix:data\" from localStorage; falls back to SEED_DATA
saveData(data): void      // normalizes + JSON.stringify + localStorage.setItem (synchronous)
```

Both are **client-only**; calling `fetchData()` during SSR would throw. They must be invoked inside `useEffect` or event handlers.

---

## 4. State Management

All public state flows through `src/lib/store.ts`. There is **no** React Context, no Redux, no Zustand, no React Query in the data layer.

### Store state shape
```ts
type StoreState = {
  storage: AppStorage;
  loaded: boolean;        // false until ensureClientLoaded() fires
};
```

### Singleton plumbing
```ts
const listeners = new Set<() => void>();
let state: StoreState = { storage: SEED_DATA, loaded: false };

function emit()                               { listeners.forEach(fn => fn()); }
function setState(next: Partial<StoreState>)  { state = { ...state, ...next }; emit(); }
function subscribe(listener: () => void)      { listeners.add(listener); return () => listeners.delete(listener); }
function getSnapshot(): StoreState            { return state; }
```

`state` is a module-scoped `let` and is **replaced, not mutated**. That matters: `useSyncExternalStore` calls `getSnapshot()` after every `emit()` and relies on referential inequality to decide whether to re-render.

### `ensureClientLoaded()`
```ts
let clientLoaded = false;
function ensureClientLoaded() {
  if (clientLoaded) return;
  clientLoaded = true;
  const stored = fetchData();
  setState({ storage: stored, loaded: true });
}
```
- Called inside `useDataStore()`'s `useEffect(() => {...}, [])`.
- Browser-only (because it reaches `localStorage`).
- Idempotent across the whole app: even though every hook that uses `useDataStore` schedules this effect, the `clientLoaded` guard short-circuits all but the first.
- Flips `loaded` to `true`, which drives `<SyncIndicator/>` from \"Loading…\" to \"Saved locally\".

### `updateStorage(updater)`
```ts
function updateStorage(updater: (s: AppStorage) => AppStorage) {
  const next = updater(state.storage);
  setState({ storage: next });
  saveData(next);
}
```
Every mutation flows through here — it's the single persistence seam. No debounce. localStorage writes are synchronous and fast (< 1ms for the expected payload sizes), so the UI stays responsive.

### Hooks

#### `useDataStore()`
```ts
function useDataStore(): StoreState {
  const snap = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  useEffect(() => { ensureClientLoaded(); }, []);
  return snap;
}
```
Internal; the base hook for everything else. The third `useSyncExternalStore` arg (server snapshot) is the same function — we always want identical server/client behavior because `SEED_DATA` is the server answer.

#### `useSyncStatus()`
```ts
export function useSyncStatus() {
  const { loaded } = useDataStore();
  return { status: loaded ? \"synced\" : \"loading\", error: null };
}
```
- **`\"loading\"`** — the browser has mounted but `ensureClientLoaded` hasn't run yet (one frame at most).
- **`\"synced\"`** — localStorage has been read; `storage` reflects real user data.

Used solely by `<SyncIndicator/>`.

#### `useWebsites()`
```ts
const { websites, add, remove } = useWebsites();
```
- `websites`: `Website[]`, memoized filter of `storage.items`.
- `add(input: WebsiteInput)`:
  - Generates `id` via `crypto.randomUUID()`.
  - Sets `createdAt = updatedAt = now()`.
  - Unshifts the new website at the head of `items`.
  - **Also prepends a layout entry `{ id, x: 0, y: 0 }`** to `desktop.layout` so the new icon appears top-left on the Desktop page. `normalizeDesktopLayout` will push subsequent occupants out of (0,0) if needed.
- `remove(id)`:
  - Drops the website from `items`.
  - Drops any matching `layout` entry.
  - Strips the id from every folder's `children`.
  - **Garbage-collects empty folders** (`.filter(f => f.children.length > 0)`).

#### `usePrompts()`
```ts
const { prompts, add, remove } = usePrompts();
```
- `add({ title, body })`: prompt is unshifted with `tags: []`.
- `remove(id)`: plain filter on `items`. Prompts never touch `desktop.*`.

#### `useDesktopStorage()`
Exposes the full desktop surface:
```ts
{ items, desktop, updateLayout, removeFromFolder,
  createEmptyFolder, addToFolder, renameFolder, deleteFolder }
```

- **`updateLayout(layout)`** — wholesale replace `desktop.layout`. Used after a drag-and-drop in `DesktopGrid`.
- **`removeFromFolder(folderId, childId)`**:
  - Re-adds `{ id: childId, x: 0, y: 0 }` to `layout` so the item reappears on the desktop.
  - Filters the child out of the folder.
  - Removes the folder if it becomes empty.
- **`createEmptyFolder(x, y)`** — picks the first free slot:
  ```ts
  if (occupied.has(`${fx}:${fy}`)) {
    let idx = 0;
    while (occupied.has(`${idx % 8}:${Math.floor(idx / 8)}`)) idx++;
    fx = idx % 8;
    fy = Math.floor(idx / 8);
  }
  ```
  The column count is hard-coded to `8` here (not the mobile `4`), a known rough edge.
- **`addToFolder(folderId, itemId)`**:
  - No-op if the folder doesn't exist or already contains the child (prevents duplicates from rapid double-drops).
  - Removes the item from `layout` and appends it to `folder.children`.
- **`renameFolder(folderId, name)`** — map update; caller (`FolderOverlay.commitRename`) trims and skips empty/unchanged names.
- **`deleteFolder(folderId)`** — spills children back onto the desktop near the folder's old location. The slot-finding algorithm:

  ```ts
  const folderEntry = prev.desktop.layout.find(e => e.id === folderId);
  const baseX = folderEntry?.x ?? 0;
  const baseY = folderEntry?.y ?? 0;
  const occupied = new Set(
    prev.desktop.layout.filter(e => e.id !== folderId).map(e => `${e.x}:${e.y}`),
  );
  let slot = 0;
  for (const childId of folder.children) {
    while (occupied.has(`${(baseX + slot) % 8}:${baseY + Math.floor((baseX + slot) / 8)}`)) {
      slot++;
    }
    const cx = (baseX + slot) % 8;
    const cy = baseY + Math.floor((baseX + slot) / 8);
    occupied.add(`${cx}:${cy}`);
    childEntries.push({ id: childId, x: cx, y: cy });
    slot++;
  }
  ```
  Translation: starting from the folder's own cell, walk in row-major order (8 columns); skip any occupied cell; place the child there. Increment `slot` and continue. Note: `(baseX + slot) % 8` + `baseY + Math.floor((baseX + slot) / 8)` produces a subtle offset when `baseX > 0` — it wraps immediately and then spills below. This is intentional: it keeps spilled items close to where the folder used to be.

### Helper functions

```ts
export function getDomain(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, \"\"); }
  catch { return url; }
}

export function faviconFor(url: string, size = 128): string {
  const domain = getDomain(url);
  return `https://www.google.com/s2/favicons?domain=${domain}&sz=${size}`;
}
```
- `getDomain` survives malformed URLs by returning the raw string.
- `faviconFor` uses Google's S2 favicon service. The `size` param is a **hint** — Google picks the nearest available size. Consumers pass `32` (small grids), `64` (regular tiles), `128` (default).

---

## 5. Routing

### TanStack Router, file-based

The router uses **TanStack Router's file-based routing** with code generation. Source files under `src/routes/` are discovered by `@tanstack/router-plugin`, which rewrites `src/routeTree.gen.ts` on every change.

Current routes:

| Path       | File                    | Component      | `<head>` title              |
|------------|-------------------------|----------------|-----------------------------|
| `/`        | `src/routes/index.tsx`  | `Index`        | `Websites — AI Metrics`     |
| `/ask`     | `src/routes/ask.tsx`    | `AskPage`      | `Ask — AI Metrics`          |
| `/desktop` | `src/routes/desktop.tsx`| `DesktopPage`  | `Desktop - AI Matrix`       |
| `/prompts` | `src/routes/prompts.tsx`| `PromptsPage`  | `Prompts — AI Metrics`      |

Every route exports:
```ts
export const Route = createFileRoute(\"/some/path\")({
  head: () => ({ meta: [{ title: \"…\" }, { name: \"description\", content: \"…\" }] }),
  component: SomeComponent,
});
```

### `routeTree.gen.ts`
- **Auto-generated.** Starts with `/* eslint-disable */` and `// @ts-nocheck`.
- Re-generated whenever the router plugin runs (via `vite dev` / `vite build`, or the CLI).
- Owns: the module-level wiring that declares each route's parent, id, path, and the TypeScript `FileRoutesByPath` / `FileRouteTypes` / `Register` interfaces that power `<Link to=\"/…\">` autocomplete.
- **Never hand-edit.** Any manual change is overwritten on next dev run.

Regenerate it by running `npm run dev` once, or by triggering the `@tanstack/router-plugin` explicitly (it's included transitively; re-running Vite is enough).

### `__root.tsx`
```tsx
export const Route = createRootRoute({
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootComponent() {
  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}
```
- **Always-rendered shell**: the sidebar, mobile bottom nav, and `<SyncIndicator/>` live here so they don't remount on navigation.
- `<Outlet/>` is the mount point every child route renders into — it slots into `<main className=\"flex-1 min-h-0 overflow-y-auto\">`.
- `NotFoundComponent` is a plain `<div>` with a `<h1>404</h1>` and a `<Link to=\"/\">` home link — rendered for unknown paths.

### `router.tsx`
```ts
export const router = createRouter({
  routeTree,
  context: {},
  scrollRestoration: true,          // TanStack handles scroll on navigation
  defaultPreloadStaleTime: 0,       // Always re-run loaders on hover-preload
  defaultErrorComponent: DefaultErrorComponent,
});

declare module \"@tanstack/react-router\" {
  interface Register { router: typeof router; }
}
```

`DefaultErrorComponent` renders a dark-themed error card with a `Try again` button (calls `router.invalidate() + reset()`) and a `Go home` button (`window.location.href = \"/\"`). In dev (`import.meta.env.DEV`), it also dumps `error.message` in a `<pre>`.

The `declare module` block registers the concrete router with the library so `<Link to=\"/ask\">` gets full literal-type checking and `useRouterState`/`useRouter` are typed.

---

## 6. Components (Every File)

### `AppShell` — `src/components/app-shell.tsx`

The global chrome. Three regions: **desktop sidebar**, **main content**, **mobile bottom nav**.

```tsx
const NAV = [
  { to: \"/\",        label: \"Websites\", icon: Globe },
  { to: \"/desktop\", label: \"Desktop\",  icon: LayoutGrid },
  { to: \"/prompts\", label: \"Prompts\",  icon: Sparkles },
  { to: \"/ask\",     label: \"Ask\",      icon: MessageSquare },
] as const;
```
Active detection: `pathname === \"/\"` for the home route, `pathname.startsWith(to)` for everything else — so `/desktop/anything` still highlights the Desktop item.

#### Layout structure
```
<div className=\"h-[100dvh] overflow-hidden flex …\">
  <aside className=\"hidden md:flex flex-col w-56 shrink-0 …\">…</aside>
  <div className=\"flex-1 min-w-0 min-h-0 flex flex-col pb-20 md:pb-0\">
    <main className=\"flex-1 min-h-0 overflow-y-auto\">{children}</main>
  </div>
  <nav className=\"md:hidden fixed bottom-3 left-3 right-3 …\">…</nav>
  <div className=\"fixed bottom-24 right-4 md:bottom-4\"><SyncIndicator compact /></div>
</div>
```

#### Why `h-[100dvh] overflow-hidden` (not `min-h-screen`)
`min-h-screen` lets the container grow beyond the viewport, breaking every flex-based height constraint below (children with `flex-1` have nothing bounded to fill). `h-[100dvh]` locks the root to **exactly** the dynamic viewport (accounts for mobile URL-bar collapse), and `overflow-hidden` prevents accidental page-level scroll.

#### Why `min-h-0` appears on flex children
Flex items default to `min-height: auto`, meaning they won't shrink below their content height. In a `h-[100dvh]` tree, that defeats the whole point — the content would overflow. Every child in the main column adds `min-h-0` to opt out of that default and let the flex distribution actually work. The same is mirrored in `src/styles.css`:
```css
.flex-1 { min-width: 0; min-height: 0; }
```
That blanket rule backs up the manual `min-h-0`s.

#### Why `pb-20 md:pb-0`
On mobile, the bottom nav is ~68px tall sitting 12px off the bottom (`bottom-3`). `pb-20` (80px) guarantees scroll content never slides under it. On desktop there's no bottom nav, so `md:pb-0` reclaims the space.

#### `SyncIndicator` placement
- **Sidebar footer** (desktop, non-compact, shows `Saved locally`).
- **Floating pill** bottom-right (always mounted; on mobile it sits above the bottom nav at `bottom-24`, on desktop it drops to `bottom-4`).

---

### `MatrixModal` — `src/components/matrix-modal.tsx`

The shared dialog used by `AddWebsiteModal` and `AddPromptModal`.

- Backdrop: `absolute inset-0 bg-black/60 backdrop-blur-md`, click-to-close.
- Panel: `max-w-md rounded-2xl border border-border bg-[var(--surface-2)] p-6`, drop shadow.
- Wrapped in `AnimatePresence`; mount/unmount is transitioned, not cut.

Motion values:
```tsx
initial={{ scale: 0.96, opacity: 0.88, y: 6 }}
animate={{ scale: 1,    opacity: 1,    y: 0 }}
exit=   {{ scale: 0.97, opacity: 0.88          }}
transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
```
(Exit intentionally skips `y` to keep dismissal feeling fast.)

Escape key handler mounts on `open`:
```tsx
useEffect(() => {
  if (!open) return;
  const onKey = (e: KeyboardEvent) => { if (e.key === \"Escape\") onClose(); };
  window.addEventListener(\"keydown\", onKey);
  return () => window.removeEventListener(\"keydown\", onKey);
}, [open, onClose]);
```

#### Exported form style constants

```ts
export const fieldClass        = \"w-full rounded-xl bg-[var(--surface-2)] border border-border px-3.5 py-2.5 text-sm text-foreground placeholder:text-copy-muted outline-none focus:border-white/20 focus:bg-[var(--surface-3)] transition\";
export const labelClass        = \"block text-[11px] font-medium uppercase tracking-wider text-copy-secondary mb-1.5\";
export const primaryButtonClass= \"inline-flex items-center justify-center gap-1.5 rounded-xl bg-foreground text-background px-4 py-2.5 text-sm font-medium hover:bg-copy-secondary active:scale-[0.97] transition\";
export const ghostButtonClass  = \"inline-flex items-center justify-center gap-1.5 rounded-xl bg-transparent text-copy-secondary hover:text-foreground px-4 py-2.5 text-sm font-medium hover:bg-white/[0.04] transition\";
```
These are imported directly everywhere a form is rendered — it's the closest the app has to a \"form kit\".

---

### `PageHeader` — `src/components/page-header.tsx`

Dead-simple title row.

```tsx
<PageHeader
  title=\"Websites\"
  subtitle={`${websites.length} tools in your library`}
  action={<button className={primaryButtonClass}><Plus/> Add Website</button>}
/>
```

Typography: `text-[28px] md:text-[34px] font-semibold tracking-tight leading-none`. The mobile 28px → desktop 34px jump is the only size step; no heading scale.

---

### `SyncIndicator` — `src/components/sync-indicator.tsx`

```tsx
const [mounted, setMounted] = useState(false);
useEffect(() => setMounted(true), []);
const { status } = useSyncStatus();
if (!mounted) return null;   // ← hydration-safety guard
```

Returning `null` until `mounted` guarantees the server-rendered HTML (nothing) matches the first client render (also nothing). The second render, after the `useEffect`, paints the actual status, avoiding the classic \"text flickers from Loading… to Saved locally\" mismatch.

- **Loading** → `<Loader2 className=\"animate-spin\" />` + optional \"Loading…\" text.
- **Synced** → `<CheckCircle2 />` + \"Saved locally\".

The `compact` prop drops the text — used in the floating mobile pill.

---

### Desktop subsystem — `src/components/desktop/`

#### `desktop-grid.tsx` (the orchestrator)
- Reads everything from `useDesktopStorage()`.
- Uses `useIsMobile()` to pick `cols = 8 | 4`.
- SSR guard: renders a plain placeholder `<div className=\"min-h-[240px] rounded-2xl\" />` until `mounted` (avoids dnd-kit's `useLayoutEffect` on the server).
- Tracks the exact cell pixel width via `ResizeObserver`:
  ```ts
  setCellPx((rect.width - (cols - 1) * GRID_GAP) / cols);
  ```
  The ghost must be exactly this wide or the drag looks wrong.
- Sensors:
  - `PointerSensor({ activationConstraint: { distance: 8 } })` — 8px pointer move before drag starts (so clicks still open links).
  - `TouchSensor({ activationConstraint: { delay: 250, tolerance: 8 } })` — 250ms press-hold on mobile.
- Drag end logic (simplified):
  1. If the dragged item landed on a **different folder**, call `addToFolder(overId, activeId)` and stop.
  2. Compute the new `(x, y)` from `delta` using `stride = cellPx + GRID_GAP`.
  3. If `(newX, newY)` is already occupied, **swap** the two entries' positions.
  4. Call `updateLayout(nextLayout)`.
  5. Clamp to `[0, cols-1]` on the x axis; y has no upper bound.
- Right-click context menu (desktop only):
  - Computes `(gridX, gridY)` from the click position using the same `stride`.
  - Shows a single \"New Folder\" button which calls `createEmptyFolder(gridX, gridY)`.
  - Suppressed on mobile; mobile gets a visible \"New Folder\" button above the grid.
- Drag overlay:
  ```tsx
  <DragOverlay dropAnimation={null} style={{ width: cellPx, pointerEvents: \"none\" }}>
    {activePositioned && <div style={{ width: cellPx }} className=\"rotate-1\"><DragGhost entry={activePositioned}/></div>}
  </DragOverlay>
  ```
  `dropAnimation={null}` disables the default fly-back tween so the tile snaps to its new home immediately.

#### `desktop-item.tsx`
- Combines `useDraggable({ id })` + `useDroppable({ id })` via a **single ref** that wires both handles to the same node.
- While `isDragging`, sets `opacity: 0.25` on the original tile.
- Click-through: if **not** dragging and the item is a website, `window.open(url, \"_blank\", \"noopener,noreferrer\")`.
- Tile design: `h-14 w-14` icon + `text-[11px]` label + hover lift `whileHover={{ y: -2 }}`.
- Favicon `<img>` with `onError` → reveals a fallback `<span>{label[0].toUpperCase()}</span>`.

#### `folder-icon.tsx`
Same dual-ref pattern. Previews up to the first 4 children in a 2×2 sub-grid:
```tsx
<div className=\"grid grid-cols-2 gap-px p-1.5 h-full w-full\">
  {[0,1,2,3].map(i => <div key={i}>{preview[i] && <img …/>}</div>)}
</div>
```
Click (when not dragging) calls `onOpen()` to show `FolderOverlay`. `isOver` applies a stronger border + shadow to signal a droppable landing zone.

#### `folder-overlay.tsx`
A modal that displays folder contents.
- Header: `FolderOpen` icon + editable name + \"Delete folder\" trash + close \"X\".
- Rename flow: `editing` toggles between a `<span>` + pencil button and an `<input>` + check button. `commitRename` trims, compares, calls `onRename` when changed.
- Keyboard: `Enter` commits, `Escape` reverts.
- Body: `grid grid-cols-3 sm:grid-cols-4 gap-3`; per-item anchor opens in a new tab.
- Per-item `-top-1 -right-1` \"X\" button (`hidden group-hover:flex`) calls `onRemoveChild(item.id)`.

#### `drag-ghost.tsx`
Pure-presentational. **Must not** call `useDraggable`/`useDroppable` — those are already active on the original tile, and double-registering breaks dnd-kit. Renders a slightly translucent, ringed copy of the tile or folder. Width is controlled entirely by the parent `DragOverlay style={{ width: cellPx }}`.

#### `command-palette.tsx`
Not currently mounted anywhere in the tree, but fully implemented:
- Opens on `Cmd/Ctrl+K`; closes on `Escape`.
- Searches `items` with naïve `.includes()` against name/description/url/tags (websites) or title/body (prompts). Results capped at 8.
- `ArrowUp`/`ArrowDown` move selection; `Enter` opens the selected website.

To re-enable, mount `<CommandPalette items={storage.items} />` inside `AppShell`.

### `ui/` — 44 shadcn/ui primitives
These are the standard shadcn/ui \"new-york\" variants wired to the same Radix versions pinned in `package.json`. Nothing custom — the CSS variables in `src/styles.css` drive their dark-only appearance. If you remove or rename a token, update the primitives that reference it (`accordion`, `alert`, `button`, `card`, `dropdown-menu`, etc.).

---

## 7. Routes / Pages (Every File)

### `src/routes/index.tsx` — Websites

```
Index
├── PageHeader (title + count + \"Add Website\" action)
├── Search input (q, useMemo filter over websites)
├── Grid: grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4
│     └── WebsiteCard[]
└── AddWebsiteModal
```

#### Search/filter
```tsx
const filtered = useMemo(() => {
  const q = query.trim().toLowerCase();
  if (!q) return websites;
  return websites.filter(w =>
    w.name.toLowerCase().includes(q) ||
    w.description.toLowerCase().includes(q) ||
    w.url.toLowerCase().includes(q) ||
    w.tags.some(t => t.toLowerCase().includes(q)));
}, [websites, query]);
```
`useMemo` is load-bearing here: the parent re-renders on every keystroke, and without memoization each card animation would re-trigger.

#### `WebsiteCard`
- `<motion.a>` so the whole tile is the link. `target=\"_blank\" rel=\"noreferrer\"`.
- Entrance animation: `initial={{ opacity: 0.9, y: 8 }} animate={{ opacity: 1, y: 0 }}` with `delay: Math.min(index * 0.03, 0.25)` — caps stagger so a 100-card list doesn't crawl in.
- Hover: `whileHover={{ y: -2 }}` plus the Tailwind hover states (`hover:bg-[var(--surface-3)]`, heavier shadow).
- Favicon container `h-10 w-10 rounded-xl` with a Google S2 favicon `h-6 w-6`.
- Tags render as small uppercase pills; domain shown via `getDomain(url)`.
- Delete button:
  ```tsx
  onClick={(e) => { e.preventDefault(); e.stopPropagation(); onRemove(); }}
  ```
  `preventDefault` stops the `<a>` navigation; `stopPropagation` stops the click bubbling back up to the motion wrapper.

#### `AddWebsiteModal`
- Local form state (`name`, `url`, `description`, `tags`).
- URL normalization: `url.startsWith(\"http\") ? url : \"https://\" + url`.
- Tags parsed: `tags.split(\",\").map(t => t.trim()).filter(Boolean)`.
- Autofocus on the name input.
- Reset on submit and on close.

---

### `src/routes/desktop.tsx` — Desktop launcher

A thin wrapper:
```tsx
function DesktopPage() {
  return (
    <div className=\"min-h-[calc(100vh-2rem)] px-5 py-8 md:px-10 md:py-12\">
      <div className=\"mx-auto max-w-7xl\">
        <PageHeader title=\"Desktop\" subtitle=\"Drag tools into place, right-click to create folders.\" />
        <DesktopGrid />
      </div>
    </div>
  );
}
```

All real logic lives in [`DesktopGrid`](#desktop-gridtsx-the-orchestrator). Summary of the OS-style behaviors:

- **Grid** — 8 cols desktop, 4 cols mobile, `gap: 16px`. `gridTemplateRows: repeat(gridRows, auto)` where `gridRows = max(maxRow + 2, 4)` so there's always empty space at the bottom to drop into.
- **Tile design** — 80–96px effective tile (56px icon + label + padding), border-radius `rounded-2xl` (16px).
- **Favicons** — `faviconFor(url, 64)` via Google S2; 8×8 render inside a dark 56×56 well.
- **Parallax / mouse movement effect** — not currently implemented (desktop grid relies on static positions + dnd-kit drag).
- **Hover** — `whileHover={{ y: -2 }}` on the tile; the icon well gains a `group-hover:shadow-[0_4px_16px_rgba(0,0,0,0.4)] group-hover:border-white/[0.15]`. Other icons are **not** dimmed on hover (only on drag, via `isActive && \"opacity-40\"`).
- **Folder drop** — highlight via `isOver ? \"bg-white/10 ring-1 ring-white/20\" : …`.
- **Context menu** — desktop only; fixed-position `motion.div` at the cursor. Closed on outside click (`<div onClick={() => setContextMenu(null)}>` wraps the grid).
- **Mobile grid** — visible \"New Folder\" button above the grid (since there's no right-click).

Known rough edges are listed in [§10](#10-known-issues--future-work).

---

### `src/routes/prompts.tsx` — Prompts

Pinterest/masonry layout using CSS columns:
```tsx
<motion.div
  variants={container}
  initial=\"hidden\"
  animate=\"show\"
  className=\"columns-1 sm:columns-2 lg:columns-3 gap-4 [column-fill:_balance]\"
>
```
- `columns-{n}` + `break-inside-avoid` on each card gives the Pinterest look without JavaScript.
- Framer Motion `variants` + `staggerChildren: 0.055` cascades entry.

#### `PromptCard`
- Entire card is `onClick={copy}` — clicks anywhere copy the prompt body.
- Trash button uses a **two-step confirm** pattern:
  ```ts
  if (confirmDelete) onRemove();
  else { setConfirmDelete(true); setTimeout(() => setConfirmDelete(false), 2000); }
  ```
  First click highlights red; second click (within 2s) deletes.
- Copy state:
  ```ts
  navigator.clipboard.writeText(prompt.body);
  setCopied(true); setTimeout(() => setCopied(false), 1600);
  ```
- Footer shows \"Click to copy\" on hover, swaps to \"Copied\" on success (AnimatePresence mode=\"wait\").
- A post-copy flash overlay (`ring-1 ring-emerald-400/30`) is overlaid via AnimatePresence.

#### `EmptyState`
Rendered when `prompts.length === 0`. Shows a `FileText` glyph, CTA button, helper text.

#### `AddPromptModal`
- Fields: `title`, `body` (monospace).
- Submit disabled until both are non-empty.
- `handleClose` resets before closing.

---

### `src/routes/ask.tsx` — Ask AI chat

Full-height chat surface over Gemini.

#### Layout
```tsx
<div className=\"h-full flex flex-col overflow-hidden\">
  <div ref={scrollRef} className=\"flex-1 min-h-0 overflow-y-auto\">…messages…</div>
  <div className=\"shrink-0 …\">…input…</div>
</div>
```
**Why `h-full` not `h-[100dvh]`:** the parent `<main>` already gives this component the remaining viewport height (after `pb-20` mobile nav clearance). Re-specifying `h-[100dvh]` inside the parent would double-claim the viewport and cause the scroll area to overflow the screen. `h-full` fills the exact budget given.

**Why `min-h-0` on the scroll area:** without it, the flex child refuses to shrink below content height, defeating the scroll.

#### State
```ts
type Message = { id: string; role: \"user\" | \"assistant\"; content: string };

const [messages, setMessages]   = useState<Message[]>([]);
const [input, setInput]         = useState(\"\");
const [thinking, setThinking]   = useState(false);
```

#### Send flow
```ts
async function getReply(input, userWebsites, userPrompts) {
  return geminiAPI.generateContent(input, [], { websites: userWebsites, prompts: userPrompts });
}
```
- The user's full `websites` and `prompts` arrays are passed as **context** — `gemini.ts` serializes them into a plain-text preamble appended to the system prompt.
- **Conversation history is currently empty** (`[]`) — each turn is stateless for the LLM, even though the UI shows a transcript. A `geminiAPI.generateContent(input, conversationHistory, context)` call with a populated history would fix that.
- Request config: `temperature 0.7, topK 40, topP 0.95, maxOutputTokens 2048`.
- Endpoint: `POST https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${VITE_GEMINI_API_KEY}`.
- Missing key → `\"API key not configured. Please add your Gemini API key to the .env file.\"`.
- On non-OK statuses, `gemini.ts` returns user-safe strings for `400/403/429` plus a catch-all.

#### Message bubble design (`Bubble`)
```tsx
isUser
  ? \"max-w-[80%] rounded-2xl rounded-br-sm bg-foreground text-background …\"
  : \"max-w-[88%] rounded-2xl rounded-bl-sm bg-[var(--surface-2)] border border-border/50 …\"
```
- Inverted colors for the user (white card on dark page).
- Asymmetric corner: one corner is `rounded-br-sm`/`rounded-bl-sm` to hint \"this is who spoke\" (like iMessage tails without a tail).
- Assistant bubbles render through `react-markdown` with `remark-gfm`:
  - Custom renderers for `h1/h2/h3`, `p`, `ul/ol/li`, inline/block `code` (block uses `<pre>` + `bg-[var(--surface-3)]`), `blockquote`, `strong`, `em`, `a` (always `target=\"_blank\"`).

#### Auto-scroll
```ts
useEffect(() => {
  scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: \"smooth\" });
}, [messages, thinking]);
```
Runs on every new message **and** when the thinking indicator flips, so the dot-loader stays in view.

#### Textarea auto-resize
```ts
useEffect(() => {
  const ta = textareaRef.current;
  if (!ta) return;
  ta.style.height = \"auto\";
  ta.style.height = Math.min(ta.scrollHeight, 128) + \"px\";
}, [input]);
```
Max 128px tall; after that, the textarea scrolls internally (`overflow-y-auto max-h-32`).

#### Sticky input bar
`shrink-0` on the input container means no matter how tall the transcript grows, the input never compresses. Built with a flex row holding a `<textarea>` + send `motion.button`.
Enter submits, Shift+Enter inserts newline.

#### Thinking indicator
Three animated dots; each `Dot` is a `motion.span` that pulses via `animate={{ scale: [1,1.4,1], opacity: [0.4,0.8,0.4], y: [0,-3,0] }}` with staggered delays.

#### Empty state
When `messages.length === 0`, a centered sparkle glyph, \"What's on your mind?\" headline, and four `STARTERS`:
```ts
const STARTERS = [
  \"Plan my next 90 minutes\",
  \"Edit this paragraph for me\",
  \"Brainstorm names for…\",
  \"Explain a concept simply\",
];
```
Each is a hover-lift button that calls `send(starter)` directly.

---

## 8. Styling System

Full file: `src/styles.css`.

### Why the `@import` order matters
```css
@import \"tw-animate-css\";
@import \"tailwindcss\" source(none);
@source \"../src\";
```
- `tw-animate-css` is imported **first** so its raw keyframes land in the stylesheet before Tailwind gets to emit its `@layer utilities`. Flip the order and Tailwind's `@layer` ordering can make `animate-*` classes lose specificity races.
- `@import \"tailwindcss\" source(none)` disables the implicit \"scan everything\" source so we can opt in manually…
- `@source \"../src\"` then tells Tailwind **exactly** where to scan. Keeps the build fast and avoids false positives from `public/` or `dist/`.

### Tailwind v4: no PostCSS
Tailwind v4 is plugin-only — the `@tailwindcss/vite` plugin replaces the old PostCSS pipeline. **There is no `postcss.config.js`**, and adding one is what breaks dev builds most often.

### `@theme inline` mapping
```css
@theme inline {
  --font-sans: \"Inter\", ui-sans-serif, system-ui, -apple-system, \"Segoe UI\", Roboto, sans-serif;
  …
  --color-background:        var(--background);
  --color-foreground:        var(--foreground);
  --color-card:              var(--card);
  --color-primary:           var(--primary);
  --color-secondary:         var(--secondary);
  --color-copy-secondary:    var(--text-secondary);
  --color-copy-muted:        var(--text-muted);
  --color-muted:             var(--muted);
  --color-accent:            var(--accent);
  --color-destructive:       var(--destructive);
  --color-border:            var(--border);
  --color-input:             var(--input);
  --color-ring:              var(--ring);
  --color-chart-1..5:        var(--chart-1..5);
  --color-sidebar*:          var(--sidebar*);
  --radius-sm/md/lg/xl/2xl/3xl/4xl: calc(var(--radius) …);
}
```
Tailwind v4 treats any `--color-{name}` declared inside `@theme` as a first-class color utility. So `--color-copy-secondary: var(--text-secondary)` is what makes `text-copy-secondary` / `bg-copy-secondary` work. Same pattern for `--color-background` → `bg-background`, etc.

### `:root` tokens (the real design values)

```css
:root {
  --radius: 0.875rem;

  /* #0B0B0C */
  --background: oklch(0.135 0 0);
  /* #EDEDED — primary text */
  --foreground: oklch(0.94 0 0);

  /* cards: #141416 / #18181B */
  --card:     oklch(0.175 0 0);
  --popover:  oklch(0.185 0 0);

  --primary:         oklch(0.94 0 0);
  --primary-foreground: oklch(0.135 0 0);
  --secondary:       oklch(0.185 0 0);

  /* #71717A — muted text */
  --muted:           oklch(0.185 0 0);
  --muted-foreground:oklch(0.54 0.005 286);

  --accent:          oklch(0.22 0 0);
  --destructive:     oklch(0.62 0.21 25);

  --border: oklch(1 0 0 / 8%);
  --input:  oklch(1 0 0 / 10%);
  --ring:   oklch(1 0 0 / 18%);

  /* #A1A1AA */
  --text-secondary: oklch(0.71 0.005 286);
  /* #71717A */
  --text-muted:     oklch(0.54 0.005 286);

  /* #141416, #18181B, #1F1F23 */
  --surface-1: oklch(0.175 0 0);
  --surface-2: oklch(0.195 0 0);
  --surface-3: oklch(0.23 0 0);

  --shadow-glow: 0 0 0 1px rgba(255,255,255,0.04), 0 12px 40px -12px rgba(0,0,0,0.6);
  --shadow-soft: 0 8px 24px -12px rgba(0,0,0,0.5);

  --chart-1..5: oklch(0.7 0.15 <hue>);

  --sidebar:                  oklch(0.16 0.002 285);
  --sidebar-foreground:       oklch(0.93 0 0);
  --sidebar-primary:          oklch(0.93 0 0);
  --sidebar-primary-foreground: oklch(0.145 0.002 285);
  --sidebar-accent:           oklch(0.22 0.003 285);
  --sidebar-accent-foreground:oklch(0.93 0 0);
  --sidebar-border:           oklch(1 0 0 / 6%);
  --sidebar-ring:             oklch(1 0 0 / 14%);
}
```

| Token             | Hex approx | Role                                   |
|-------------------|-----------:|----------------------------------------|
| `--background`    | `#0B0B0C`  | App background                         |
| `--foreground`    | `#EDEDED`  | Primary text                           |
| `--text-secondary`| `#A1A1AA`  | Subdued body text                      |
| `--text-muted`    | `#71717A`  | Tertiary text / labels                 |
| `--surface-1`     | `#141416`  | Sidebar, modal body                    |
| `--surface-2`     | `#18181B`  | Cards, form fields                     |
| `--surface-3`     | `#1F1F23`  | Hover state for cards and icon wells   |
| `--border`        | `rgba(255,255,255,0.08)` | Hairlines                |
| `--ring`          | `rgba(255,255,255,0.18)` | Focus rings              |

### Always-dark
```css
.dark { color-scheme: dark; }
html { color-scheme: dark; background: var(--color-background); }
```
The `<html>` tag has **no `class=\"dark\"`** anywhere — yet the theme variables always hit the dark palette because `:root` itself is the dark palette. There is no light mode. `color-scheme: dark` on `<html>` additionally teaches the browser to render native form controls (scrollbars, autofill) in dark colors.

### Base layer
```css
@layer base {
  * { border-color: var(--color-border); }
  body {
    background-color: var(--color-background);
    color: var(--color-foreground);
    font-family: var(--font-sans);
    -webkit-font-smoothing: antialiased;
    text-rendering: optimizeLegibility;
  }
}
```

### Performance CSS
```css
main { contain: layout; min-height: 0; }
nav a { will-change: transform, opacity; }
* { backface-visibility: hidden; -webkit-backface-visibility: hidden; }
.grid, .flex { contain: layout style; }
.max-w-7xl, .max-w-3xl { contain: layout; }
```
- `contain: layout` — opts the element out of reflow propagation into ancestors. Prevents one page's re-render from forcing others to recalculate.
- `will-change: transform, opacity` — hints the compositor to promote nav links to their own layer; their hover/focus transitions stay at 60fps.
- `backface-visibility: hidden` — silences a class of Safari repaint bugs on transformed elements (also nudges them to GPU compositing).

### The global `.flex-1` override
```css
.flex-1 { min-width: 0; min-height: 0; }
```
- Flex items default to `min-width: auto` / `min-height: auto` which prevents shrinking below the content's intrinsic size. In this app's chat layout and side-by-side sidebars, that default causes overflow and scrollbar issues. This single rule saves having to sprinkle `min-w-0 min-h-0` on every `flex-1` child.

### Custom scrollbars
```css
::-webkit-scrollbar { width: 10px; height: 10px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.06); border-radius: 8px; }
::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.12); }
```
WebKit-only (Chromium/Safari). Firefox falls back to native dark scrollbars via `color-scheme: dark`.

### Custom utilities
```css
@utility surface-1 { background-color: var(--surface-1); }
@utility surface-2 { background-color: var(--surface-2); }
@utility surface-3 { background-color: var(--surface-3); }
```
Tailwind v4's `@utility` directive defines a class that participates in responsive/dark/hover variants. Use as `className=\"surface-2 hover:surface-3\"`. (Most of the codebase still uses the equivalent `bg-[var(--surface-2)]` bracket syntax — both are valid.)

---

## 9. Build & Deployment

### `vite.config.ts`
```ts
import { defineConfig } from \"vite\";
import react from \"@vitejs/plugin-react\";
import tsconfigPaths from \"vite-tsconfig-paths\";
import tailwindcss from \"@tailwindcss/vite\";

export default defineConfig({
  plugins: [
    tailwindcss(),   // ← must be first
    react(),
    tsconfigPaths(),
  ],
  build: {
    outDir: \"dist\",
    emptyOutDir: true,
  },
});
```

- **`@tailwindcss/vite` must come first.** The Tailwind v4 plugin intercepts the CSS import graph at the pre-transform stage. If the React plugin runs first, it rewrites `.tsx` files and can strip or reorder imports, breaking CSS discovery.
- **`@vitejs/plugin-react`** — Babel JSX transform. Chosen (over SWC) because several components use features the SWC plugin still doesn't cover cleanly (e.g., top-level `<a>` tags adjacent to `export` declarations can trip SWC's bundling).
- **`vite-tsconfig-paths`** — automatically resolves the `@/*` alias from `tsconfig.json`. Without this, `import { X } from \"@/lib/store\"` is a build error.
- No Tailwind PostCSS plugin, no manual `postcss.config.js`, no `@tailwind` directives in CSS (replaced by `@import \"tailwindcss\"`).

### `tsconfig.json` paths
```json
\"paths\": { \"@/*\": [\"./src/*\"] }
```
Used by:
- TypeScript (for editor autocompletion and type-checking).
- `vite-tsconfig-paths` (for actual bundling).

They must stay in sync — changing the alias in one place without the other breaks only the editor or only the build.

### `vercel.json`
```json
{
  \"framework\": \"vite\",
  \"buildCommand\": \"npm run build\",
  \"outputDirectory\": \"dist\",
  \"installCommand\": \"npm install\",
  \"rewrites\": [
    { \"source\": \"/(.*)\", \"destination\": \"/index.html\" }
  ]
}
```

#### Why `rewrites` and not `routes`
- `routes` (legacy) is a full request-level router with ordering semantics and can break `/static/*` paths or override framework asset handling.
- `rewrites` (modern) runs **after** Vercel's own static file matching. A request for `/assets/app.xxxxx.js` is served from disk; a request for `/desktop` falls through to the rewrite and is served the SPA shell. This is the idiomatic SPA-fallback pattern on Vercel.

### Build output
```
dist/
├── index.html                     # Entry; <script> injected at build
├── assets/
│   ├── index-xxxxxxxx.js          # Main chunk (~684KB minified; see §10)
│   ├── index-xxxxxxxx.css         # Compiled Tailwind
│   └── … hashed assets …
└── favicon.svg                    # copied from public/
```

### `index.html`
Must live at the project root (Vite reads it as the conventional entry):
```html
<!doctype html>
<html lang=\"en\">
  <head>
    <meta charset=\"UTF-8\" />
    <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\" />
    <title>AI Matrix</title>
  </head>
  <body>
    <div id=\"root\"></div>
    <script type=\"module\" src=\"/src/main.tsx\"></script>
  </body>
</html>
```
Vite processes `<script type=\"module\" src=\"/src/main.tsx\">` at build time — it rewrites the src to the hashed production bundle (`/assets/index-xxxxxxxx.js`). Moving `index.html` to `public/` or elsewhere breaks this rewrite.

---

## 10. Known Issues & Future Work

### localStorage limitations
- **5MB cap** per origin (~5,000 websites + prompts worst-case; far above realistic usage).
- **Per-device**: no cross-device sync.
- **No conflict resolution**: opening the app in two tabs and editing simultaneously results in last-write-wins on the next save.
- **No migration story**: schema changes need explicit `normalizeStorage` updates to be backward-compatible.

### Planned Supabase migration
The localStorage payload (`AppStorage`) maps cleanly to three tables:

```sql
-- items: websites and prompts
create table items (
  id         uuid primary key,
  user_id    uuid references auth.users(id),
  type       text check (type in ('website', 'prompt', 'folder', 'layout')),
  data       jsonb,             -- {name, url, description, title, body, …}
  tags       text[] not null default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- desktop_layout: one row per positioned tile/folder
create table desktop_layout (
  user_id uuid references auth.users(id),
  id      uuid not null,        -- item or folder id
  x       int  not null,
  y       int  not null,
  primary key (user_id, id)
);

-- desktop_folders
create table desktop_folders (
  id       uuid primary key,
  user_id  uuid references auth.users(id),
  name     text not null,
  children uuid[] not null default '{}'  -- ordered item ids
);
```
- `fetchData` / `saveData` become `supabase.from(...).select()` / `upsert()`.
- The store's external-store pattern is unchanged — only the bottom layer swaps.
- RLS policies: `user_id = auth.uid()` on everything.
- Realtime subscription on the three tables → push updates into `setState` to keep multiple tabs in sync.

### Desktop route — current rough edges
- `createEmptyFolder` uses the hard-coded 8-column math even when rendered on mobile (4 cols). The folder still appears (the layout normalizer clamps), just not always where you'd expect.
- There is no \"drop outside the grid\" handling — releasing a tile far off the grid snaps it to the nearest valid cell via clamp.
- Folders can be dragged into other folders (via `useDraggable`), but the drop logic only handles `kind === \"item\"` targeting a folder; folder-on-folder drops fall through to a position swap. Nesting is intentionally unsupported.
- No auto folder creation from drag — by design (see `replit.md`), but users coming from macOS may expect it.

### Chunk size (~684KB)
Main contributors:
- `framer-motion` (~120KB min+gz)
- `recharts` (~180KB; installed but unused on any shipped page)
- `embla-carousel-react`, `react-day-picker`, `@radix-ui/react-*` (many)
- `react-markdown` + `remark-gfm` + `rehype-highlight` (~60KB; only used on `/ask`)

Fixes (in order of impact):
1. **Route-level code splitting** — TanStack Router supports `component: lazy(() => import(\"./routes/ask\"))`. Pull `react-markdown` off the critical path.
2. **Drop unused deps** — `recharts`, `react-day-picker`, `embla-carousel-react`, `@radix-ui/react-navigation-menu`, etc., aren't referenced and can be removed from `package.json`.
3. **Replace `fuse.js`** (unused; naive `includes` is fine at current scale).
4. **Tree-shake icons** — `lucide-react` already supports selective imports (`import { Plus } from \"lucide-react\"`); confirm no barrel-star imports slipped in.

---

## 11. Gotchas & Decisions Log

### Why `<a>` tags can't go just anywhere in JSX (router context)
In `src/router.tsx`, the error UI uses a plain `<button>` with `onClick={() => (window.location.href = \"/\")}` instead of `<Link to=\"/\">` or an `<a>`:
- `<Link>` can't render before the router has mounted — it needs the router context. During a rendering error, the context may not be available.
- A raw `<a href=\"/\">` works but triggers a full page reload, which is arguably what you want in a fatal error scenario but requires careful placement. Some Babel-plugin-react configs have historically chokepointed on anchor tags adjacent to top-level default exports during JSX transform — moving to `<button onClick={…}>` sidesteps the ambiguity entirely.

### `routeTree.gen.ts` is sacred
- Starts with `/* eslint-disable */ // @ts-nocheck`.
- Contains module augmentations for both `@tanstack/react-router` and `@tanstack/react-start`.
- Any hand-edit is wiped on the next `vite dev` run. If you need a new route, create a new file under `src/routes/`; the plugin will regenerate the tree.

### Why `useSyncExternalStore` (not `useState` / `Context`)
- **Multiple consumers** update and read the same store from many routes. A Context would force a provider at the root (done) but then every consumer re-renders when the value changes, which is fine here — but `useSyncExternalStore` also:
  - Gives a dedicated server snapshot hook (`getServerSnapshot`) for SSR correctness.
  - Sidesteps the \"stale closure\" hazard common to custom Context stores.
  - Plays well with `React.StrictMode`'s double-invoke in dev because subscribe/unsubscribe is idempotent.
- The module-level singleton is fine because there's only one user per session — no multi-tenant state isolation needed.

### The hydration-safe `SEED_DATA` pattern
- Constants imported at module load are deterministic on both server and client.
- `localStorage` is not touchable on the server — so initial state must be deterministic without it.
- Therefore: start everything from `SEED_DATA`, swap in localStorage **after first mount**, and ensure every \"localStorage-affected\" UI (`<SyncIndicator/>`, `<DesktopGrid/>`) gates on a `mounted` flag so the first render matches HTML.

### `.wrangler` folder
Historically left behind by Lovable.dev's preview infrastructure (Cloudflare Wrangler). If present, it's unused — safe to delete. There's no `wrangler.toml` wired into Vite; `@cloudflare/vite-plugin` is installed but not added to `vite.config.ts`.

### Tailwind v4 breaking change: no `postcss.config.js`
Under Tailwind v4, the PostCSS plugin is **gone**. Configuration lives in:
- `@theme inline { … }` blocks inside the CSS.
- The Vite plugin itself (`@tailwindcss/vite`).

Do not create a `postcss.config.js`. Do not use `@tailwind base; @tailwind components; @tailwind utilities;`. Use `@import \"tailwindcss\" source(none); @source \"../src\";` instead, as the app does.

### Empty folders die automatically
Every mutation that removes children filters `folders` with `.filter(f => f.children.length > 0)`. This means a folder created via `createEmptyFolder` and left empty will persist (since it has no children to trigger the filter) — but the moment it has a child added then removed, the folder itself disappears. By design: matches macOS behavior where removing the last icon collapses a smart folder.

### `desktop.layout` entry for new websites lives at `(0, 0)`
`useWebsites().add` prepends `{ id, x: 0, y: 0 }`. `normalizeDesktopLayout` then bumps subsequent occupants of `(0, 0)` to the next free row-major slot — so the new website visibly appears in the top-left corner of the Desktop page.

### Two distinct names
The product is branded **AI Matrix** in `<title>` and the `/desktop` route metadata. Other routes use **AI Metrics** (the legacy internal name from `replit.md`). `src/components/app-shell.tsx` shows \"AI Metrics\" in the sidebar logo. Pick one and normalize when rebranding.

### The `api/github.ts` file
Lives at the repo root, legacy from a GitHub-backed version of the app. Not wired to anything and not built (not under `src/`). Safe to delete; retained as a historical reference.

### `geminiAPI` is a singleton with a captured API key
`new GeminiAPI()` reads `import.meta.env.VITE_GEMINI_API_KEY` at module load. If the env var is missing in production, every call returns the static \"API key not configured…\" message. Since Vite inlines `import.meta.env.*` **at build time**, rotating the key requires a rebuild and redeploy.

### `useRouterState` selector usage
```ts
const pathname = useRouterState({ select: (s) => s.location.pathname });
```
Important: the selector is what scopes the re-renders. Without `select`, any change to router state (loaders, pending navigations, search params) would re-render `AppShell` and every nav link. With the selector, `AppShell` only re-renders when the pathname actually changes.

### `data-testid` (or lack thereof)
The codebase currently has no `data-testid` attributes. Playwright / integration tests would need to be added using accessible names (`aria-label`) or role queries, or the tests would need this codebase instrumented first.

### `@tanstack/react-query` is installed but unused
Not imported anywhere in `src/`. Safe to remove from `package.json` unless you plan to add async data fetching (e.g., the Supabase migration in §10).

---

*End of document. Keep this file versioned alongside the source. Update section 10 whenever a limitation is resolved, and section 11 whenever a non-obvious decision is made.*
"