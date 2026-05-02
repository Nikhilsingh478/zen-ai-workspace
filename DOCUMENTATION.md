# AI Metrics — Full Documentation

## What is AI Metrics?

AI Metrics is a personal AI operating system — a private, browser-based dashboard for people who live inside AI tools. Instead of hunting through browser bookmarks or re-typing the same prompts over and over, everything lives in one dark, premium interface that stays in sync across devices via a live Supabase backend.

There are four sections: **Websites**, **Desktop**, **Prompts**, and **Ask**. Each serves a different mode of working with AI.

---

## Websites Tab

**What it's for:** A curated directory of every AI website, tool, or service you use. Think of it as your AI-specific bookmark manager with tags, descriptions, and instant search.

### Adding a website
Click **Add Website** in the top-right. Fill in:
- **Name** — human-readable label (e.g. "Perplexity")
- **URL** — the full address (auto-prefixes `https://` if you forget)
- **Description** — what you use it for, when to reach for it
- **Tags** — comma-separated categories (e.g. `research, chat, writing`)

The website is saved instantly to your Supabase database and appears in the grid.

### Editing a website
Hover any card to reveal the **pencil icon** (top-right of the card). Click it to open the Edit modal where you can update any field. Changes sync immediately.

### Deleting a website
Hover a card and click the **trash icon**. The card is removed instantly.

### Search
The search bar (top of the tab) searches across name, description, URL, and tags simultaneously. Results filter in real time as you type.

### Tag filter pills
Every unique tag from your collection appears as a clickable pill below the search bar. Click a tag to filter the grid to only items with that tag. Click multiple tags to narrow further (AND logic — item must have all selected tags). Tags highlight white when active. Click again to deselect.

### Sorting
The **Newest** dropdown lets you change sort order:
- **Newest** — most recently added first (default)
- **Name A–Z** — alphabetical by name
- **Name Z–A** — reverse alphabetical
- **Oldest** — oldest entries first

### Clearing filters
When any filter is active, a **Clear** button appears. Clicking it resets search, tags, and sort at once. The result count shows how many items match your current filters.

---

## Desktop Tab

**What it's for:** A spatial, icon-based launcher. Your websites become tappable icons on a grid — like a phone home screen for your AI stack. Drag to rearrange, group into folders, and launch any tool in one click.

### Launching a tool
Click any icon to open its URL in a new tab.

### Drag and drop rearranging
Click and hold any icon (8px movement threshold on desktop, 250ms hold on mobile), then drag it to a new grid position. Release to snap it into place. The icon drops at whichever grid cell your **cursor** is over when you let go — grab-point independent.

If you drop an icon onto an occupied cell, the two icons **swap** positions.

### Folders
**Creating a folder:**
- Right-click anywhere on the empty grid to open the context menu → **New Folder**
- Or click the **New Folder** button in the top-right header
- On mobile, a New Folder button appears above the grid

**Adding items to a folder:**
Drag any icon onto a folder. When the folder highlights (bright ring + glow), release — the icon is now inside.

**Opening a folder:**
Click the folder icon. A full-screen overlay opens showing all items inside. Click any item to launch it.

**Removing items from a folder:**
Inside the folder overlay, drag any item toward the "drag out to remove" backdrop (the semi-transparent area). The item returns to the desktop grid.

**Renaming a folder:**
Click the folder name text at the top of the overlay — it becomes an editable field. Press Enter or click away to save.

**Deleting a folder:**
Click the **Delete folder** button inside the folder overlay. All items that were in the folder return to the desktop grid (they don't get deleted).

### Searching the desktop
The filter bar at the top of the Desktop tab dims non-matching icons to 25% opacity as you type. This lets you quickly spot a specific tool without losing spatial context. Clear the search with the X button to restore full opacity.

### Icon grid behavior
- Icons auto-arrange with a collision resolver — no two icons can occupy the same cell
- The grid expands downward as you add more icons
- Icons show their favicon (brand icon from the website) — falls back to the first letter of the name if the favicon can't load
- Folders show a 2×2 preview grid of the first 4 icons inside them

---

## Prompts Tab

**What it's for:** A personal prompt library. Save any prompt you use regularly and copy it to your clipboard in one click. Stop re-typing or searching chat history.

### Adding a prompt
Click **New Prompt**. Fill in:
- **Title** — short description of what the prompt does (e.g. "Rewrite for clarity")
- **Prompt** — the full prompt text, written in a monospace font

Click **Save prompt**. It appears instantly in the grid.

### Copying a prompt
**Desktop:** Click anywhere on a prompt card. The card flashes green with a "Copied" indicator and the text is on your clipboard.
**Mobile:** Tap any prompt card to copy. Dedicated copy button also available in the card actions.

### Deleting a prompt
**Desktop:** Hover the card to reveal the trash icon. Click it once to arm (turns red), click again to confirm delete.
**Mobile:** A trash icon is always visible in the top-right of each card. Tap once to arm, again to confirm.

### Search
The search bar filters prompts by title and body text in real time.

### Sorting
Three sort pills appear next to the search bar:
- **Newest** — most recently created first (default)
- **Oldest** — oldest first
- **A–Z** — alphabetical by title

### Masonry layout
Prompt cards use a masonry column layout so short and long prompts tile naturally without large empty gaps.

---

## Ask Tab

**What it's for:** A direct AI chat interface powered by Google Gemini. Ask any question and get a response without leaving the dashboard — no switching tabs.

### How to use it
Type your question in the input field and press **Enter** or click the send button. The response streams back in real time.

### When it shows an error
The Ask tab requires a `VITE_GEMINI_API_KEY` environment variable to be set. Without it, the interface will display a warning. Set the key in your environment to activate it.

---

## General Features

### Real-time sync
Every action (add, edit, delete, move, folder changes) is saved to Supabase immediately. The status indicator in the bottom-left of the sidebar shows **Synced** when all changes are persisted. If you open the app in two browser tabs, changes in one reflect in the other.

### Sidebar navigation
The left sidebar provides one-click navigation between all four tabs. The active tab is highlighted. The AI Metrics logo links back to the Websites tab.

### Premium dark UI
The interface uses a consistent dark design system:
- `#0A0A0C` base background
- `#18181B` surface cards
- White text at varying opacity levels for hierarchy
- Subtle borders at `rgba(255,255,255,0.08)`
- Smooth framer-motion transitions on all state changes
- Sonner toast notifications for errors and async feedback

### Mobile support
The layout is fully responsive. On small screens:
- The sidebar collapses to a bottom navigation bar
- Desktop grid switches from 8 columns to 4 columns
- Icons use the compact size variant
- Touch drag-and-drop works with a 250ms hold before dragging activates

---

## Data & Privacy

- **Database:** Supabase PostgreSQL — your data is stored in your own Supabase project
- **Row-Level Security:** Disabled by default (single-user setup)
- **Tables:**
  - `items` — all websites and prompts
  - `desktop_layout` — grid position for each icon
  - `desktop_folders` — folder structure and membership
- **No analytics, no tracking, no third-party scripts** beyond Supabase and Gemini API calls you initiate

---

## Keyboard Shortcuts

| Action | Shortcut |
|---|---|
| Send message in Ask | `Enter` |
| New line in Ask | `Shift+Enter` |
| Close modal | `Escape` |
| Clear desktop search | Click × in filter bar |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | React 19 + TanStack Router (SPA mode) |
| Build | Vite 7 |
| Styling | Tailwind CSS v4 |
| Drag & Drop | @dnd-kit/core |
| Animations | Framer Motion |
| Components | shadcn/ui |
| Database | Supabase (PostgreSQL + Realtime) |
| AI | Google Gemini API |
| Notifications | Sonner |
| Hosting | Replit |
