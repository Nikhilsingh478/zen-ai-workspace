# AI Metrics — Full Documentation

_Last updated: May 4, 2026_

## What is AI Metrics?

AI Metrics is a personal AI operating system — a private, browser-based dashboard for people who live inside AI tools. Every section is a different mode of working with AI: discovering tools, launching them spatially, reusing prompts, asking quick questions, tracking your usage, saving important links and images, and keeping reminders top of mind.

Everything syncs in real time through a Supabase backend, so any change you make in one tab or device shows up everywhere else.

The eight top-level sections are:

1. **Websites** — your AI tool directory
2. **Desktop** — spatial launcher with folders and drag-and-drop
3. **Prompts** — clipboard-ready prompt library
4. **Link Board** — drag-and-drop board of important URLs
5. **Image Board** — masonry gallery of uploaded images allows downloading them too
6. **Important Messages** — reminders with motive, time, and message
7. **Insights** — usage analytics across tools and prompts
8. **Ask** — direct AI chat powered by Google Gemini

---

## 1. Websites Tab (`/`)

**What it's for:** A curated directory of every AI website, tool, or service you use — with tags, descriptions, and instant search.

### Adding a website
Click **Add Website** in the top-right. Fill in:
- **Name** — e.g. "Perplexity"
- **URL** — auto-prefixes `https://` if you forget
- **Description** — when to reach for it
- **Tags** — comma-separated categories (e.g. `research, chat, writing`)

Cards save instantly and show the website's favicon.

### Editing & deleting
Hover any card to reveal **pencil** (edit) and **trash** (delete) icons in the top-right.

### Search & filtering
- The search bar matches name, description, URL, and tags.
- Tag pills below the search filter the grid (multi-select uses AND logic).
- The **Newest / Name A–Z / Name Z–A / Oldest** dropdown changes sort order.
- A **Clear** button appears when filters are active and resets everything at once.

---

## 2. Desktop Tab (`/desktop`)

**What it's for:** A spatial, icon-based launcher — your websites become tappable icons on a grid, like a phone home screen for your AI stack.

### Launching
Click any icon to open its URL in a new tab.

### Drag-and-drop rearranging
Click-and-hold any icon (8px movement on desktop, 250ms hold on mobile) and drag to a new cell. The icon drops at the cell your **cursor** is over — independent of where you grabbed it. Dropping onto an occupied cell **swaps** positions.

### Folders
- **Create:** right-click the empty grid → **New Folder**, or click the New Folder button in the header (mobile shows it above the grid).
- **Add items:** drag any icon onto a folder — the folder highlights when ready to receive.
- **Open:** click the folder to open a full-screen overlay listing its contents.
- **Remove items:** drag any item out of the overlay onto the dim backdrop.
- **Rename:** click the folder name in the overlay and edit inline.
- **Delete:** the **Delete folder** button returns all children to the desktop.

### Other behavior
- The filter bar at the top dims non-matching icons to 25% opacity as you type.
- The grid auto-resolves collisions and expands downward.
- Compact icon size on desktop, larger touch-friendly icons on mobile.
- Folders show a 2×2 preview of the first four icons inside.

---

## 3. Prompts Tab (`/prompts`)

**What it's for:** A personal prompt library — copy any prompt to your clipboard with one click.

### Adding
Click **New Prompt** and fill in **Title** and **Prompt**. Saved instantly.

### Copying
- **Desktop:** click the card body — it flashes green and copies.
- **Mobile:** tap the card to copy, or use the dedicated copy button.

### Deleting
Two-step confirmation: first click arms the trash icon (turns red), second click within 2 seconds deletes.

### Search & sort
The search bar matches title and body. Sort pills toggle between **Newest / Oldest / A–Z**.

### Layout
Masonry columns (1 / 2 / 3 depending on screen size) so short and long prompts tile naturally.

---

## 4. Link Board (`/links`)

**What it's for:** A separate, drag-and-drop board of important URLs that don't fit your tool directory — articles, references, dashboards, anything you want to keep in a personal corkboard.

### Adding
**Add Link** opens a modal with:
- **Link Name** (required)
- **URL** (required, auto-prefixes `https://`)
- **Description** (optional, multi-line)

### Editing & deleting
Hover any card to reveal:
- **Pencil** — opens the same modal pre-filled with current values.
- **Trash** — two-step confirmation matching the Prompts pattern.

### Drag to reorder
A grip handle on the left side of each card (visible on hover) lets you drag cards to any position in the grid. The new order is saved to Supabase via the `position` column. Sensors match the Desktop tab — 8px on desktop, 250ms hold on mobile.

### Layout
Responsive auto-fill grid (`repeat(auto-fill, minmax(260px, 1fr))`, 16px gap) — fills as many columns as the viewport allows. Each card shows the link's favicon, name, clickable URL, and optional description.

---

## 5. Image Board (`/images`)

**What it's for:** A personal masonry gallery of uploaded images — references, screenshots, mood boards, brand assets.

### Uploading
**Upload Image** opens a modal with:
- **Image name** (required, auto-fills from filename)
- **File** (required, `image/*`, max 5MB — anything larger is rejected inline before upload)

The submit button shows **Uploading…** and is disabled during the upload. The file is stored in the `image-board` Supabase Storage bucket and a row is added to the `image_board` table with the public URL.

### Editing
Hover an image and click the **pencil** to open a rename modal. Only the `name` column updates — the file is not re-uploaded.

### Deleting
Hover an image and click the **trash**. A confirmation modal appears before any destructive call. On confirm, the file is removed from Storage and the row is deleted from the table — both must succeed or you'll see an error toast.

### Layout
Masonry columns (1 / 2 / 3) using CSS columns with `break-inside: avoid`. Each tile shows the full image with `object-cover` and the name below. Edit and delete buttons appear at the top-right on hover.

---

## 6. Important Messages (`/messages`)

**What it's for:** Time-bound reminders or notes — anything you want to "save the motive of" and remember when. Useful for follow-ups, recurring rituals, or a single-line journal of things you keep meaning to do.

### Adding
**Add Message** opens a modal with three required fields:
- **Motive** — short purpose (e.g. "Follow up with client")
- **Time** — free-form string (e.g. "Every Monday 9am" or "2025-07-01 10:00")
- **Message** — multi-line body, 4 rows

The submit button stays disabled until all three are non-empty.

### Editing
Hover any card and click the **pencil** to reopen the modal pre-filled.

### Deleting
Two-step inline confirmation: first click turns the button red and shows **Confirm?**, second click within 2 seconds deletes.

### Layout
Single-column list of full-width cards, sorted **newest first**. Each card shows the **motive** as a bold header, **time** as a pill badge using the `--surface-3` token, and the **message** as body text with whitespace preserved.

---

## 7. Insights Tab (`/insights`)

**What it's for:** Usage analytics across your tools and prompts. Logs every time you open a tool or copy a prompt and rolls them up into trends, top items, and time-range stats.

(See `SETUP.sql` to enable the `usage_logs` table.)

---

## 8. Ask Tab (`/ask`)

**What it's for:** A direct AI chat powered by Google Gemini, embedded in the dashboard so you don't need to switch tabs.

### Usage
Type a question and press **Enter** (Shift+Enter for newline). The response streams back in real time.

### Configuration
Requires a `VITE_GEMINI_API_KEY` environment variable. Without it, the tab shows a configuration warning.

---

## General Features

### Real-time sync
Every action (add, edit, delete, move, folder change, link reorder, image upload, message edit) is saved to Supabase immediately. The status indicator in the bottom-right shows **Synced** when all changes are persisted.

### Sidebar & mobile nav
- **Desktop:** left sidebar with eight one-click destinations and the active tab highlighted.
- **Mobile:** floating bottom bar with all eight tabs, compact icons + labels.

### Premium dark UI
- `#0A0A0C` base background, `#18181B` surface cards
- White text at varying opacities for hierarchy
- Subtle borders at `rgba(255,255,255,0.08)`
- Smooth Framer Motion transitions on every state change
- Sonner toast notifications for async feedback and errors
- Custom favicon embedded for browser tabs

### Mobile support
- Responsive layouts on every page
- Sidebar collapses to bottom nav
- Desktop grid switches from 8 to 4 columns
- Touch drag-and-drop with a 250ms hold activation

---

## Data & Privacy

- **Database:** Supabase Postgres in your own project.
- **Auth model:** single-user — RLS is disabled by default; no login required.
- **No analytics, no tracking, no third-party scripts** beyond Supabase and the Gemini API calls you initiate.

### Tables

| Table | Purpose |
|---|---|
| `items` | Websites + prompts (discriminated by `type`) |
| `desktop_layout` | Grid position for each desktop icon/folder |
| `desktop_folders` | Folder names + child id arrays |
| `links` | Link Board entries (with `position` for ordering) |
| `image_board` | Image Board metadata (storage path + public URL) |
| `important_messages` | Important Messages (motive / time / message) |
| `usage_logs` | Insights events (open / copy) |

### Storage

| Bucket | Purpose |
|---|---|
| `image-board` | Public-read bucket for uploaded images (5MB cap enforced client-side) |

### Setup files
- `SETUP.sql` — usage logging table for the Insights tab
- `SETUP_NEW_TABS.sql` — `links`, `image_board`, `important_messages` tables and the `image-board` storage bucket + policies

Run both in your Supabase dashboard → SQL Editor before using their corresponding tabs.

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
| Styling | Tailwind CSS v4 (oklch tokens in `src/styles.css`) |
| Drag & Drop | `@dnd-kit/core` + `@dnd-kit/sortable` |
| Animations | Framer Motion |
| Components | shadcn/ui |
| Database | Supabase (Postgres + Realtime + Storage) |
| AI | Google Gemini API |
| Notifications | Sonner |
| State | `useSyncExternalStore` external stores per feature (`store.ts`, `link-board.ts`, `image-board.ts`, `important-messages.ts`) |
| Hosting | Replit |