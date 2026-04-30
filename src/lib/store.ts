import { useEffect, useState } from "react";

export type Website = {
  id: string;
  name: string;
  url: string;
  description: string;
  tags: string[];
};

export type Prompt = {
  id: string;
  title: string;
  body: string;
};

const KEYS = {
  websites: "ai-matrix:websites",
  prompts: "ai-matrix:prompts",
} as const;

const SEED_WEBSITES: Website[] = [
  { id: "1", name: "ChatGPT", url: "https://chat.openai.com", description: "Conversational AI assistant for writing, coding and reasoning.", tags: ["chat", "general"] },
  { id: "2", name: "Claude", url: "https://claude.ai", description: "Thoughtful long-context assistant by Anthropic.", tags: ["chat", "writing"] },
  { id: "3", name: "Perplexity", url: "https://perplexity.ai", description: "AI-powered search with cited sources.", tags: ["search"] },
  { id: "4", name: "Midjourney", url: "https://midjourney.com", description: "Image generation with a strong artistic direction.", tags: ["image"] },
  { id: "5", name: "Runway", url: "https://runway.ml", description: "Generative video and creative tools for filmmakers.", tags: ["video"] },
  { id: "6", name: "ElevenLabs", url: "https://elevenlabs.io", description: "Realistic AI voice generation and cloning.", tags: ["audio"] },
  { id: "7", name: "Cursor", url: "https://cursor.com", description: "AI-native code editor built for pairs programming.", tags: ["code"] },
  { id: "8", name: "v0", url: "https://v0.app", description: "Generative UI from natural language prompts.", tags: ["ui", "code"] },
];

const SEED_PROMPTS: Prompt[] = [
  { id: "p1", title: "Senior code reviewer", body: "Act as a staff engineer. Review the following code for clarity, correctness, and idiomatic style. Give a prioritized list of changes with rationale, then a refactor." },
  { id: "p2", title: "Tighten my writing", body: "Edit the following text to be calmer, clearer and more confident. Remove filler. Preserve voice. Return only the edited version." },
  { id: "p3", title: "Explain like a teacher", body: "Explain the concept below to a curious beginner. Use one analogy, one tiny example, and end with a single question that tests understanding." },
  { id: "p4", title: "Product brainstorm", body: "Generate 10 distinct product ideas around the theme: {{theme}}. For each, give a one-line pitch, target user, and the riskiest assumption." },
  { id: "p5", title: "SQL whisperer", body: "Given this schema and natural language question, return a single PostgreSQL query. Use CTEs when it improves readability. Add a one-sentence comment above explaining the approach." },
  { id: "p6", title: "Daily focus plan", body: "Here is my todo list. Pick the 3 tasks with highest leverage today, in order. Justify each choice in one short sentence. Surface anything I should explicitly NOT do." },
];

function read<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write<T>(key: string, value: T) {
  if (typeof window === "undefined") return;
  localStorage.setItem(key, JSON.stringify(value));
}

function useStored<T>(key: string, seed: T) {
  const [value, setValue] = useState<T>(seed);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setValue(read<T>(key, seed));
    setHydrated(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (hydrated) write(key, value);
  }, [key, value, hydrated]);

  return [value, setValue, hydrated] as const;
}

export function useWebsites() {
  const [websites, setWebsites] = useStored<Website[]>(KEYS.websites, SEED_WEBSITES);
  const add = (w: Omit<Website, "id">) =>
    setWebsites((prev) => [{ ...w, id: crypto.randomUUID() }, ...prev]);
  const remove = (id: string) => setWebsites((prev) => prev.filter((w) => w.id !== id));
  return { websites, add, remove };
}

export function usePrompts() {
  const [prompts, setPrompts] = useStored<Prompt[]>(KEYS.prompts, SEED_PROMPTS);
  const add = (p: Omit<Prompt, "id">) =>
    setPrompts((prev) => [{ ...p, id: crypto.randomUUID() }, ...prev]);
  const remove = (id: string) => setPrompts((prev) => prev.filter((p) => p.id !== id));
  return { prompts, add, remove };
}

export function getDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export function faviconFor(url: string, size = 128): string {
  const domain = getDomain(url);
  return `https://www.google.com/s2/favicons?domain=${domain}&sz=${size}`;
}