// ─── Domain types ─────────────────────────────────────────────────────────────

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

// ─── Seed data (reference / dev use) ─────────────────────────────────────────

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
    id: "p1",
    type: "prompt",
    title: "Senior code reviewer",
    body: "Act as a staff engineer. Review the following code for clarity, correctness, and idiomatic style. Give a prioritized list of changes with rationale, then a refactor.",
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
