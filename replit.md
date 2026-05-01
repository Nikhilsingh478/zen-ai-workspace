# AI Metrics — Personal AI Operating System

## Overview

A full-stack React web app built with TanStack Router/React Start (SSR). It serves as a personal workspace for managing AI tools, prompts, and a drag-and-drop desktop launcher. All data is persisted to **Supabase** (PostgreSQL) with real-time sync.

## Tech Stack

- **Frontend/SSR Framework:** React 19 + TanStack Router + @tanstack/react-start
- **Build Tool:** Vite 7
- **Styling:** Tailwind CSS v4 + Radix UI + shadcn/ui component patterns
- **Drag & Drop:** @dnd-kit/core
- **Animations:** framer-motion
- **Data Layer:** Supabase (PostgreSQL) — 3 tables: `items`, `desktop_layout`, `desktop_folders`
- **Realtime:** Supabase realtime channel `db-changes`
- **Toasts:** sonner
- **Package Manager:** npm

## Environment Variables

- `VITE_SUPABASE_URL` — Supabase project URL
- `VITE_SUPABASE_ANON_KEY` — Supabase public anon key

## Project Structure

```
src/
  routes/           # TanStack Router route modules
    __root.tsx      # Root HTML shell + Toaster
    index.tsx       # Websites page (skeleton while loading)
    ask.tsx         # Ask page (Gemini integration)
    desktop.tsx     # Desktop launcher page (skeleton while loading)
    prompts.tsx     # Prompts page (skeleton while loading)
  components/
    desktop/        # Desktop launcher system
      desktop-grid.tsx    # Main DnD grid with dnd-kit
      desktop-item.tsx    # Draggable/droppable website icon
      folder-icon.tsx     # Draggable/droppable folder icon
      folder-overlay.tsx  # Folder modal (open, rename, delete)
      drag-ghost.tsx      # Lightweight DragOverlay ghost clone
    app-shell.tsx   # Main app layout/sidebar
    sync-indicator.tsx    # Cloud sync status indicator
  hooks/
    use-mobile.ts   # Responsive breakpoint hook
  lib/
    github-data.ts  # Types and SEED_DATA (kept for types only)
    supabase.ts     # Supabase client init
    supabase-data.ts # All Supabase read/write operations
    store.ts        # Global external store (useSyncExternalStore)
                    # Optimistic updates + toast on error/success
                    # Realtime subscription cleanup on unmount
    desktop-layout.ts # Grid position helpers and layout normalizer
    gemini.ts       # Gemini AI integration
  styles.css        # Tailwind CSS entry
  router.tsx        # TanStack Router setup
```

## Data & Persistence

- **Storage:** Supabase PostgreSQL
  - `public.items` — websites and prompts (type field distinguishes them)
  - `public.desktop_layout` — per-item x/y grid positions
  - `public.desktop_folders` — folder metadata + children array
  - RLS disabled on all three tables
- **Hydration:** Store starts with empty state. After mount, fetches from Supabase. Loading skeletons shown while `loaded === false`.
- **Mutations:** Optimistic (UI updates instantly), then async persist to Supabase. On error, state rolls back + toast.error shown.
- **Realtime:** Supabase channel subscribed after initial load; any change to any table triggers a full refetch.

## Desktop Launcher

- 8-col grid on desktop, 4-col on mobile
- Drag items to reposition (snap-to-grid, swap on collision)
- Drag item onto existing folder → adds to folder
- Right-click empty space → "New Folder" context menu (desktop)
- Mobile: "New Folder" button in top-right
- Folder overlay: click to open, remove items, rename, delete
- No auto folder creation from drag (manual only)
- DragOverlay: plain `<DragOverlay dropAnimation={null}>` — dnd-kit handles cursor tracking natively

## Dev Notes

- Port: 5000 (`npm run dev` = `vite dev --port 5000 --host 0.0.0.0`)
- Workflow: `npm run dev`
- Hydration note: SSR renders with empty state; client hydrates with Supabase data after mount. Loading skeletons prevent flash of empty content.
