# AI Metrics — Personal AI Operating System

## Overview
A full-stack React web app built with TanStack Router/React Start (SSR). It serves as a personal workspace for managing AI tools, prompts, and conversations. Data is synced to a GitHub repository via a server-side API endpoint.

## Tech Stack
- **Frontend/SSR Framework:** React 19 + TanStack Router + @tanstack/react-start
- **Build Tool:** Vite 7 with @lovable.dev/vite-tanstack-config
- **Styling:** Tailwind CSS v4 + Radix UI + shadcn/ui component patterns
- **State/Data:** @tanstack/react-query
- **Charts:** recharts
- **Animations:** framer-motion
- **Package Manager:** npm (package-lock.json present; bun.lockb also present from original)

## Project Structure
```
src/
  routes/           # TanStack Router route modules
    __root.tsx      # Root HTML shell with head/body setup
    index.tsx       # Websites page
    ask.tsx         # Ask page
    desktop.tsx     # Desktop page
    prompts.tsx     # Prompts page
  components/       # React components
    ui/             # shadcn-style UI primitives
    app-shell.tsx   # Main app layout/shell
  hooks/            # Custom React hooks
  lib/              # App logic (gemini.ts, github-data.ts, store.ts)
  styles.css        # Tailwind CSS entry
  router.tsx        # TanStack Router setup
  routeTree.gen.ts  # Auto-generated route tree
api/
  github.ts         # Server handler for GitHub data read/write
public/             # Static assets (favicon.svg)
```

## Environment Variables
- `GITHUB_*` — GitHub API credentials used by `api/github.ts` for data persistence
- `VITE_*` — Client-side environment variables (loaded by Vite)

## Development
```bash
npm run dev       # Start dev server on port 5000
npm run build     # Build for production
npm run preview   # Preview production build
```

## Replit Configuration
- Dev server: port 5000, host 0.0.0.0, allowedHosts: true
- Workflow: "Start application" → `npm run dev` → port 5000 (webview)
- Deployment: autoscale, build: `npm run build`, run: `npm run preview`
