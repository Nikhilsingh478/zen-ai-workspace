# AI Metrics — Personal AI Operating System

## Overview
A full-stack React web app built with TanStack Router/React Start (SSR). It serves as a personal workspace for managing AI tools, prompts, and a drag-and-drop desktop launcher. All data is persisted to **localStorage** (no backend, no environment variables required).

## Tech Stack
- **Frontend/SSR Framework:** React 19 + TanStack Router + @tanstack/react-start
- **Build Tool:** Vite 7 with @lovable.dev/vite-tanstack-config
- **Styling:** Tailwind CSS v4 + Radix UI + shadcn/ui component patterns
- **Drag & Drop:** @dnd-kit/core
- **Animations:** framer-motion
- **Persistence:** localStorage (key: `ai-matrix:data`)
- **Package Manager:** npm

## Project Structure
```
src/
  routes/           # TanStack Router route modules
    __root.tsx      # Root HTML shell
    index.tsx       # Websites page
    ask.tsx         # Ask page (Gemini integration)
    desktop.tsx     # Desktop launcher page
    prompts.tsx     # Prompts page
  components/
    desktop/        # Desktop launcher system
      desktop-grid.tsx    # Main DnD grid with dnd-kit
      desktop-item.tsx    # Draggable/droppable website icon
      folder-icon.tsx     # Draggable/droppable folder icon
      folder-overlay.tsx  # Folder modal (open, rename, delete)
      drag-ghost.tsx      # Lightweight DragOverlay ghost clone
    app-shell.tsx   # Main app layout/sidebar
    sync-indicator.tsx    # "Saved locally" status indicator
  hooks/
    use-mobile.tsx  # Responsive breakpoint hook
  lib/
    github-data.ts  # Types, SEED_DATA, fetchData/saveData (localStorage)
    store.ts        # Global external store (useSyncExternalStore)
    desktop-layout.ts # Grid position helpers and layout normalizer
    gemini.ts       # Gemini AI integration
  styles.css        # Tailwind CSS entry
  router.tsx        # TanStack Router setup
api/
  github.ts         # (unused) Legacy GitHub API endpoint
```

## Data & Persistence
- **Storage:** Browser localStorage, key `ai-matrix:data`
- **Hydration:** Store always starts with SEED_DATA. After first mount, `useEffect` reads localStorage and replaces with saved data. This prevents SSR hydration mismatches.
- **Save:** Every mutation calls `saveData()` synchronously (no debounce, no network calls)
- **Seed data:** 8 AI websites + 6 prompt templates loaded if localStorage is empty

## Desktop Launcher
- 8-col grid on desktop, 4-col on mobile
- Drag items to reposition (snap-to-grid, swap on collision)
- Drag item onto existing folder → adds to folder
- Right-click empty space → "New Folder" context menu (desktop)
- Mobile: "New Folder" button in top-right
- Folder overlay: click to open, remove items, rename, delete
- No auto folder creation from drag (manual only)
- DragOverlay ghost sized to exact cell pixel width via ResizeObserver

## Dev Notes
- Port: 5000 (vite.config.ts)
- Workflow: `npm run dev`
- Hydration errors visible in dev console on Vite server restart — this is a known HMR reconnect artifact, not a runtime bug. Normal page loads are clean.
