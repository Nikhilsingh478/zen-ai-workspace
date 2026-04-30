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

const LOCAL_DATA_KEY = "ai-matrix:data";
const LEGACY_KEYS = {
  websites: "ai-matrix:websites",
  prompts: "ai-matrix:prompts",
} as const;

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

let memoryCache: AppStorage | null = null;

function readJson<T>(key: string): T | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  localStorage.setItem(key, JSON.stringify(value));
}

function normalizeItems(data: unknown): AppDataItem[] {
  if (!Array.isArray(data)) return [];

  return data
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object")
    .filter((item) => typeof item.id === "string" && typeof item.type === "string")
    .map((item) => {
      const now = new Date().toISOString();
      return {
        ...item,
        tags: Array.isArray(item.tags) ? item.tags.filter((tag) => typeof tag === "string") : [],
        createdAt: typeof item.createdAt === "string" ? item.createdAt : now,
        updatedAt: typeof item.updatedAt === "string" ? item.updatedAt : now,
      } as AppDataItem;
    });
}

function normalizeLayout(data: unknown): DesktopLayoutEntry[] {
  if (!Array.isArray(data)) return [];

  return data
    .filter(
      (entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === "object",
    )
    .filter(
      (entry) =>
        typeof entry.id === "string" &&
        typeof entry.x === "number" &&
        Number.isFinite(entry.x) &&
        typeof entry.y === "number" &&
        Number.isFinite(entry.y),
    )
    .map((entry) => ({
      id: entry.id as string,
      x: Math.max(0, Math.floor(entry.x as number)),
      y: Math.max(0, Math.floor(entry.y as number)),
    }));
}

function normalizeFolders(data: unknown): DesktopFolder[] {
  if (!Array.isArray(data)) return [];

  return data
    .filter(
      (folder): folder is Record<string, unknown> => Boolean(folder) && typeof folder === "object",
    )
    .filter((folder) => typeof folder.id === "string" && typeof folder.name === "string")
    .map((folder) => ({
      id: folder.id as string,
      name: folder.name as string,
      children: Array.isArray(folder.children)
        ? folder.children.filter((child): child is string => typeof child === "string")
        : [],
    }))
    ;
}

function normalizeStorage(data: unknown): AppStorage {
  if (Array.isArray(data)) {
    return {
      items: normalizeItems(data),
      desktop: { layout: [], folders: [] },
    };
  }

  if (!data || typeof data !== "object") return SEED_DATA;

  const record = data as Record<string, unknown>;
  return {
    items: normalizeItems(record.items),
    desktop: {
      layout: normalizeLayout((record.desktop as Record<string, unknown> | undefined)?.layout),
      folders: normalizeFolders((record.desktop as Record<string, unknown> | undefined)?.folders),
    },
  };
}

function readLegacyData(): AppStorage {
  const now = new Date().toISOString();
  const websites =
    readJson<Array<Omit<Website, "type" | "createdAt" | "updatedAt">>>(LEGACY_KEYS.websites) ?? [];
  const prompts =
    readJson<Array<Omit<Prompt, "type" | "tags" | "createdAt" | "updatedAt">>>(
      LEGACY_KEYS.prompts,
    ) ?? [];

  const items: AppDataItem[] = [
    ...websites.map((website) => ({
      ...website,
      type: "website" as const,
      tags: Array.isArray(website.tags) ? website.tags : [],
      createdAt: now,
      updatedAt: now,
    })),
    ...prompts.map((prompt) => ({
      ...prompt,
      type: "prompt" as const,
      tags: [],
      createdAt: now,
      updatedAt: now,
    })),
  ];

  return {
    items,
    desktop: {
      layout: items
        .filter((item) => item.type === "website")
        .map((item, index) => ({
          id: item.id,
          x: index % 8,
          y: Math.floor(index / 8),
        })),
      folders: [],
    },
  };
}

export function readFallbackData() {
  const localData = normalizeStorage(readJson<AppStorage | AppDataItem[]>(LOCAL_DATA_KEY));
  if (localData.items.length > 0) return localData;

  const legacyData = readLegacyData();
  if (legacyData.items.length > 0) {
    writeJson(LOCAL_DATA_KEY, legacyData);
    return legacyData;
  }

  return SEED_DATA;
}

export function writeFallbackData(data: AppStorage) {
  writeJson(LOCAL_DATA_KEY, data);
}

export async function fetchData(): Promise<AppStorage> {
  if (memoryCache) return memoryCache;

  try {
    const response = await fetch("/api/github", { method: "GET" });
    if (!response.ok) throw new Error("GitHub data fetch failed.");
    const data = normalizeStorage(await response.json());
    memoryCache = data.items.length > 0 ? data : SEED_DATA;
    writeFallbackData(memoryCache);
    return memoryCache;
  } catch {
    memoryCache = readFallbackData();
    return memoryCache;
  }
}

export async function saveData(data: AppStorage) {
  const nextData = normalizeStorage(data);
  memoryCache = nextData;
  writeFallbackData(nextData);

  const response = await fetch("/api/github", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(nextData),
  });

  if (!response.ok) {
    throw new Error("GitHub data save failed.");
  }
}
