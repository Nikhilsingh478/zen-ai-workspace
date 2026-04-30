// ─── Types ────────────────────────────────────────────────────────────────────

export type DataType = "prompt" | "website" | "folder" | "layout";

export type DataItemBase = {
  id: string;
  type: DataType;
  tags: string[];
  createdAt: string;
  updatedAt: string;
};

export type Prompt = DataItemBase & {
  type: "prompt";
  title: string;
  body: string;
};

export type Website = DataItemBase & {
  type: "website";
  name: string;
  url: string;
  description: string;
};

export type FutureDataItem = DataItemBase & {
  type: "folder" | "layout";
  [key: string]: unknown;
};

export type AppDataItem = Prompt | Website | FutureDataItem;

export type DesktopLayoutEntry = {
  id: string;
  x: number;
  y: number;
};

export type DesktopFolder = {
  id: string;
  name: string;
  children: string[];
};

export type AppStorage = {
  items: AppDataItem[];
  desktop: {
    layout: DesktopLayoutEntry[];
    folders: DesktopFolder[];
  };
};

// ─── Seed data ────────────────────────────────────────────────────────────────

const seedDate = "2026-04-30T00:00:00.000Z";

export const SEED_ITEMS: AppDataItem[] = [
  {
    id: "1",
    type: "website",
    name: "ChatGPT",
    url: "https://chat.openai.com",
    description: "Conversational AI assistant for writing, coding and reasoning.",
    tags: ["chat", "general"],
    createdAt: seedDate,
    updatedAt: seedDate,
  },
  {
    id: "2",
    type: "website",
    name: "Claude",
    url: "https://claude.ai",
    description: "Thoughtful long-context assistant by Anthropic.",
    tags: ["chat", "writing"],
    createdAt: seedDate,
    updatedAt: seedDate,
  },
  {
    id: "3",
    type: "website",
    name: "Perplexity",
    url: "https://perplexity.ai",
    description: "AI-powered search with cited sources.",
    tags: ["search"],
    createdAt: seedDate,
    updatedAt: seedDate,
  },
  {
    id: "4",
    type: "website",
    name: "Midjourney",
    url: "https://midjourney.com",
    description: "Image generation with a strong artistic direction.",
    tags: ["image"],
    createdAt: seedDate,
    updatedAt: seedDate,
  },
  {
    id: "5",
    type: "website",
    name: "Runway",
    url: "https://runway.ml",
    description: "Generative video and creative tools for filmmakers.",
    tags: ["video"],
    createdAt: seedDate,
    updatedAt: seedDate,
  },
  {
    id: "6",
    type: "website",
    name: "ElevenLabs",
    url: "https://elevenlabs.io",
    description: "Realistic AI voice generation and cloning.",
    tags: ["audio"],
    createdAt: seedDate,
    updatedAt: seedDate,
  },
  {
    id: "7",
    type: "website",
    name: "Cursor",
    url: "https://cursor.com",
    description: "AI-native code editor built for pairs programming.",
    tags: ["code"],
    createdAt: seedDate,
    updatedAt: seedDate,
  },
  {
    id: "8",
    type: "website",
    name: "v0",
    url: "https://v0.app",
    description: "Generative UI from natural language prompts.",
    tags: ["ui", "code"],
    createdAt: seedDate,
    updatedAt: seedDate,
  },
  {
    id: "p1",
    type: "prompt",
    title: "Senior code reviewer",
    body: "Act as a staff engineer. Review the following code for clarity, correctness, and idiomatic style. Give a prioritized list of changes with rationale, then a refactor.",
    tags: [],
    createdAt: seedDate,
    updatedAt: seedDate,
  },
  {
    id: "p2",
    type: "prompt",
    title: "Tighten my writing",
    body: "Edit the following text to be calmer, clearer and more confident. Remove filler. Preserve voice. Return only the edited version.",
    tags: [],
    createdAt: seedDate,
    updatedAt: seedDate,
  },
  {
    id: "p3",
    type: "prompt",
    title: "Explain like a teacher",
    body: "Explain the concept below to a curious beginner. Use one analogy, one tiny example, and end with a single question that tests understanding.",
    tags: [],
    createdAt: seedDate,
    updatedAt: seedDate,
  },
  {
    id: "p4",
    type: "prompt",
    title: "Product brainstorm",
    body: "Generate 10 distinct product ideas around the theme: {{theme}}. For each, give a one-line pitch, target user, and the riskiest assumption.",
    tags: [],
    createdAt: seedDate,
    updatedAt: seedDate,
  },
  {
    id: "p5",
    type: "prompt",
    title: "SQL whisperer",
    body: "Given this schema and natural language question, return a single PostgreSQL query. Use CTEs when it improves readability. Add a one-sentence comment above explaining the approach.",
    tags: [],
    createdAt: seedDate,
    updatedAt: seedDate,
  },
  {
    id: "p6",
    type: "prompt",
    title: "Daily focus plan",
    body: "Here is my todo list. Pick the 3 tasks with highest leverage today, in order. Justify each choice in one short sentence. Surface anything I should explicitly NOT do.",
    tags: [],
    createdAt: seedDate,
    updatedAt: seedDate,
  },
];

export const SEED_DATA: AppStorage = {
  items: SEED_ITEMS,
  desktop: {
    layout: SEED_ITEMS.filter((item) => item.type === "website").map((item, index) => ({
      id: item.id,
      x: index % 8,
      y: Math.floor(index / 8),
    })),
    folders: [],
  },
};

// ─── localStorage key ─────────────────────────────────────────────────────────

const STORAGE_KEY = "ai-matrix:data";

// ─── Normalizers (validate shape before use) ──────────────────────────────────

function normalizeItems(data: unknown): AppDataItem[] {
  if (!Array.isArray(data)) return [];
  return data
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object")
    .filter((item) => typeof item.id === "string" && typeof item.type === "string")
    .map((item) => {
      const now = new Date().toISOString();
      return {
        ...item,
        tags: Array.isArray(item.tags) ? item.tags.filter((t) => typeof t === "string") : [],
        createdAt: typeof item.createdAt === "string" ? item.createdAt : now,
        updatedAt: typeof item.updatedAt === "string" ? item.updatedAt : now,
      } as AppDataItem;
    });
}

function normalizeLayout(data: unknown): DesktopLayoutEntry[] {
  if (!Array.isArray(data)) return [];
  return data
    .filter((e): e is Record<string, unknown> => Boolean(e) && typeof e === "object")
    .filter(
      (e) =>
        typeof e.id === "string" &&
        typeof e.x === "number" &&
        Number.isFinite(e.x) &&
        typeof e.y === "number" &&
        Number.isFinite(e.y),
    )
    .map((e) => ({
      id: e.id as string,
      x: Math.max(0, Math.floor(e.x as number)),
      y: Math.max(0, Math.floor(e.y as number)),
    }));
}

function normalizeFolders(data: unknown): DesktopFolder[] {
  if (!Array.isArray(data)) return [];
  return data
    .filter((f): f is Record<string, unknown> => Boolean(f) && typeof f === "object")
    .filter((f) => typeof f.id === "string" && typeof f.name === "string")
    .map((f) => ({
      id: f.id as string,
      name: f.name as string,
      children: Array.isArray(f.children)
        ? f.children.filter((c): c is string => typeof c === "string")
        : [],
    }));
}

function normalizeStorage(raw: unknown): AppStorage {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return SEED_DATA;
  const r = raw as Record<string, unknown>;
  const desktop = r.desktop as Record<string, unknown> | undefined;
  return {
    items: normalizeItems(r.items),
    desktop: {
      layout: normalizeLayout(desktop?.layout),
      folders: normalizeFolders(desktop?.folders),
    },
  };
}

// ─── Public API (synchronous, localStorage only) ──────────────────────────────

/**
 * Load data from localStorage. Falls back to SEED_DATA if nothing is stored.
 * Must only be called on the client (inside useEffect or event handler).
 */
export function fetchData(): AppStorage {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return SEED_DATA;
    const parsed = normalizeStorage(JSON.parse(raw));
    return parsed.items.length > 0 ? parsed : SEED_DATA;
  } catch {
    return SEED_DATA;
  }
}

/**
 * Persist data to localStorage. Synchronous. Safe to call on every change.
 */
export function saveData(data: AppStorage): void {
  try {
    const normalized = normalizeStorage(data);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
  } catch {
    // Ignore storage quota errors
  }
}
