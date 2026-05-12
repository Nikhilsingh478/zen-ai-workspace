# AI Metrics — Intelligence Suite (Zen AI Workspace)

> A living, exhaustive reference for the AI Metrics (Zen AI Workspace) codebase. This document is the source-of-truth for every architectural decision, data shape, component, and styling choice in the app. Written for a developer who has never seen the codebase.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Core Systems & Architecture](#2-core-systems--architecture)
3. [J.A.R.V.I.S. Voice Engine](#3-jarvis-voice-engine)
4. [Horizon Task Management & FCM](#4-horizon-task-management--fcm)
5. [Data Model & State Management](#5-data-model--state-management)
6. [Routing & Navigation](#6-routing--navigation)
7. [Styling System & Design Language](#7-styling-system--design-language)
8. [Build, Deployment & PWA](#8-build-deployment--pwa)
9. [Gotchas & Decisions Log](#9-gotchas--decisions-log)

---

## 1. Project Overview

### What it is
**AI Metrics (Intelligence Suite)** is a comprehensive, browser-based personal AI operating system. Evolving from a simple launcher (formerly "AI Matrix"), it is now a full-fledged intelligent workspace that includes:

- **J.A.R.V.I.S.** — An always-listening, wake-word activated voice assistant powered by Gemini.
- **Horizon** — An intelligent task and calendar management system with push notifications.
- **Websites & Desktop** — A searchable, tag-filterable card grid and an OS-style launcher grid with drag-and-drop.
- **Prompts & Ask** — A prompt library and a direct Gemini chat interface.
- **Insights & Links** — Dashboards for tracking usage and organizing resources.

### Who it's for
Power users, developers, and AI enthusiasts who want a single, fast, keyboard-and-voice-friendly home for their AI stack. It unifies tools, tasks, and an AI assistant into a cohesive, cyberpunk-inspired dark-mode interface.

### Tech Stack

**Runtime & Framework**
- `react` `^19.2.0`, `react-dom` `^19.2.0`
- `@tanstack/react-router` `^1.169.2` (File-based routing)
- `firebase` `^12.13.0` (Cloud Messaging)
- `framer-motion` `^12.38.0` (Spring animations)

**Build Tools**
- `vite` `^7.3.3`
- `@tailwindcss/vite` `^4.3.0`
- `typescript` `^5.9.3`

**UI & Styling**
- `tailwindcss` `^4.3.0` (CSS-first approach)
- `@radix-ui/react-*` (Primitive accessible components)
- `lucide-react` (Iconography)

**AI & APIs**
- **Google Gemini API** (Uses `VITE_GEMINI_API_KEY` with automatic failover to `VITE_GEMINI_API_KEY_2`)
- **Web Speech API** (`SpeechRecognition` and `speechSynthesis`)

---

## 2. Core Systems & Architecture

The app is built as a single-page application (SPA) with a heavy emphasis on client-side state, augmented by external APIs (Gemini) and background services (Firebase Cloud Messaging).

### The Full Data Flow
1. **User Action** (Click, Voice Command) → **Hook** → **State Update** (`store.ts` or `jarvis.ts`).
2. **State Updates** trigger `emit()`, causing subscribed React components to re-render using `useSyncExternalStore`.
3. **Persistence** is handled synchronously via `localStorage`, ensuring zero latency.
4. **Asynchronous Tasks** (e.g., asking Gemini, scheduling a notification) are processed in background promises, updating the state upon completion.

### Dual-Gemini Failover Mechanism
To ensure high availability, the app implements a robust Gemini API client (`lib/gemini.ts`):
- It reads `VITE_GEMINI_API_KEY` as the primary key.
- If an API request fails with a `429 Too Many Requests` or `403 Forbidden`, it automatically swaps to `VITE_GEMINI_API_KEY_2`.
- This ensures uninterrupted service for J.A.R.V.I.S. and the Ask module.

---

## 3. J.A.R.V.I.S. Voice Engine

The crown jewel of the suite is the JARVIS Voice Assistant (`src/lib/jarvis.ts` and `src/components/jarvis/ai-core.tsx`).

### Voice Recognition Lifecycle
- Uses native `window.SpeechRecognition` in `continuous = true` mode.
- **Wake Word Detection:** The engine constantly buffers interim transcripts. When it detects "jarvis" or "hey jarvis", it transitions from `idle` to `listening`.
- **Silence Detection (The 800ms Buffer):** Browser speech APIs often split long sentences into multiple "final" segments. JARVIS buffers all final segments and uses a timeout (`SILENCE_THRESHOLD_MS`). It only processes the command when the user stops speaking for 800ms.
- **Auto-Restart:** If recognition drops or ends unexpectedly (`onend`), JARVIS automatically restarts in passive mode. A 400ms delay is injected after Text-To-Speech (TTS) completes to ensure Chrome releases the microphone resource before restarting recognition.

### Voice UI (The AICore)
- Built entirely with **SVG** to guarantee perfect centering and alignment (avoiding CSS `transform` drift).
- Features dynamic, rotating partial arcs (300°, 240°, 200°), radar sweeps, and pulsating rings.
- Reacts instantly to voice state (`passive`, `listening`, `processing`, `speaking`).

---

## 4. Horizon Task Management & FCM

Horizon is the productivity layer, integrating task management with real-time browser push notifications.

### Push Notification System (`src/lib/notifications.ts` & `fcm.ts`)
- Uses **Firebase Cloud Messaging (FCM)** for push notifications.
- **Service Worker (`public/firebase-messaging-sw.js`):** Handles background messages when the app is closed.
- **Sound & Lock-Screen Fixes:** 
  - Browsers suppress notification sounds if a notification is updated using the same `tag`. We use unique timestamp-based tags (`horizon-${Date.now()}`) for *every* notification to force the OS to play the notification sound.
  - On mobile, `requireInteraction: true` is set so notifications stay on the lock screen until explicitly dismissed.
  - Includes Android vibration patterns (`[200, 60, 200]`).

---

## 5. Data Model & State Management

The app eschews Redux/Zustand in favor of React 18's native `useSyncExternalStore` for ultra-fast, zero-dependency state management.

### Store Pattern (`src/lib/store.ts`)
```ts
const listeners = new Set<() => void>();
let state: StoreState = { storage: SEED_DATA, loaded: false };

function emit() { listeners.forEach((fn) => fn()); }
function setState(next: Partial<StoreState>) {
  state = { ...state, ...next };
  emit();
}
```
All mutations replace the state object entirely (referential inequality triggers re-renders).

### Hydration Strategy
To prevent SSR hydration mismatches (remnant from TanStack Start testing):
1. Both server and client initially render using `SEED_DATA`.
2. A `useEffect` immediately fires on the client, reads `localStorage`, and updates the state.
3. This flips the `<SyncIndicator />` from "Loading" to a subtle cyan dot.

---

## 6. Routing & Navigation

Uses **@tanstack/react-router** for file-based routing.

### Route Tree
- `/` - Websites (Home)
- `/desktop` - Mac-style draggable launcher grid
- `/prompts` - Reusable prompt library
- `/ask` - Gemini Chat interface
- `/horizon` - Calendar and Task management
- `/jarvis` - Full-screen JARVIS AI Core interface
- `/insights` - Analytics and usage tracking

Routes are automatically generated into `src/routeTree.gen.ts`. **Never edit this file manually.**

---

## 7. Styling System & Design Language

The entire app adheres to a strict, cyberpunk-minimalist "Dark + Sky Blue" aesthetic.

### Global Tokens (`src/styles.css`)
Tailwind v4 is used with `oklch` colors for deep, rich dark backgrounds.
The global accent color is defined via CSS variables to ensure consistency across the App Shell, Desktop, and JARVIS interfaces:

```css
:root {
  --background: oklch(0.135 0 0); /* Deep dark #0B0B0C */
  --foreground: oklch(0.94 0 0);  /* Primary text #EDEDED */
  
  /* Primary Accent: Sky Blue */
  --primary: oklch(0.6 0.2 220);  /* #0EA5E9 */
  --ring: oklch(0.6 0.2 220 / 55%);
  
  /* JARVIS specific tokens */
  --jarvis-primary: #0EA5E9;
  --jarvis-accent:  #38BDF8;
}
```

### UI Paradigms
- **AppShell:** Contains a collapsible sidebar (desktop) and a bottom tab bar (mobile). The active state indicator is a subtle cyan bar with a `rgba(14,165,233,0.07)` background tint.
- **Glassmorphism:** Heavy use of `backdrop-filter: blur(14px)` on modals, headers, and the floating JARVIS orb.
- **Micro-interactions:** Framer Motion is used for layout animations, hover scaling (`whileHover={{ scale: 1.05 }}`), and spring-physics transitions.

---

## 8. Build, Deployment & PWA

### Vite & Build Process
- Built with `vite build`.
- Environment variables must be prefixed with `VITE_` (e.g., `VITE_GEMINI_API_KEY`).
- Configured for SPA deployment on Vercel (`vercel.json` rewrites all traffic to `index.html`).

### PWA & Trusted Web Activity (TWA)
The app is configured as a Progressive Web App (PWA) and can be bundled into an Android APK via Trusted Web Activities (TWA).
- `assetlinks.json` is located in `public/.well-known/assetlinks.json` to verify ownership of the domain `app.vercel.thunderbold.twa` against the Android app's SHA-256 fingerprint.

---

## 9. Gotchas & Decisions Log

1. **Why `SpeechRecognition` drops off:** Browsers aggressively suspend microphone access. JARVIS combats this by instantly scheduling a restart in the `onend` handler. Do not remove the `setTimeout(..., 500)` in `jarvis.ts`, or the app will go permanently deaf.
2. **Notification Sounds Silenced:** Fixed by assigning a `Date.now()` timestamp to the notification `tag`. Without this, Chrome replaces the notification silently.
3. **SVG over DOM for Rings:** The `AICore` uses SVG `<circle>` and `<path>` instead of CSS `border-radius: 50%` divs. CSS transforms frequently cause sub-pixel drift, making concentric circles look wobbly during animations. SVG guarantees perfect mathematical centering.
4. **Dual API Keys:** The free tier of Gemini has strict rate limits. The app seamlessly catches `429` errors and reroutes through `VITE_GEMINI_API_KEY_2`. Both must be present in production for stability.

---

*End of documentation. Maintain this file alongside major architectural shifts.*