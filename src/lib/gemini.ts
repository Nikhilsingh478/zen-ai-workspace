// ─── Types ────────────────────────────────────────────────────────────────────

export interface GeminiMessage {
  role: "user" | "model";
  parts: { text: string }[];
}

interface GeminiRequest {
  contents: GeminiMessage[];
  generationConfig?: {
    temperature?: number;
    topK?: number;
    topP?: number;
    maxOutputTokens?: number;
  };
}

interface GeminiResponse {
  candidates?: Array<{
    content: { parts: { text: string }[]; role: string };
    finishReason: string;
    index: number;
  }>;
}

export interface UserContext {
  websites?: Array<{ name: string; url: string; description: string; tags: string[] }>;
  prompts?: Array<{ title: string; body: string }>;
  links?: Array<{ name: string; url: string; description?: string | null }>;
  messages?: Array<{ motive: string; time: string; message: string }>;
  folders?: Array<{ name: string; items: string[] }>;
}

// ─── Error map ────────────────────────────────────────────────────────────────

const HTTP_ERRORS: Record<number, string> = {
  400: "Invalid request. Please check your API key and try again.",
  403: "API key is invalid or permissions are insufficient.",
  429: "Rate limit exceeded. Please try again in a moment.",
};

// ─── Context builder ──────────────────────────────────────────────────────────

function buildContextString(ctx: UserContext): string {
  const parts: string[] = [];

  if (ctx.websites?.length) {
    parts.push(
      "\n\n## Saved AI Tools & Websites\n" +
        ctx.websites
          .map(
            (s, i) =>
              `${i + 1}. **${s.name}** (${s.url})\n   ${s.description}${s.tags.length ? `\n   Tags: ${s.tags.join(", ")}` : ""}`,
          )
          .join("\n"),
    );
  }

  if (ctx.prompts?.length) {
    parts.push(
      "\n\n## Saved Prompts\n" +
        ctx.prompts.map((p, i) => `${i + 1}. **${p.title}**\n   ${p.body}`).join("\n"),
    );
  }

  if (ctx.links?.length) {
    parts.push(
      "\n\n## Saved Links\n" +
        ctx.links
          .map((l, i) => `${i + 1}. ${l.name} — ${l.url}${l.description ? ` (${l.description})` : ""}`)
          .join("\n"),
    );
  }

  if (ctx.messages?.length) {
    parts.push(
      "\n\n## Important Messages / Reminders\n" +
        ctx.messages
          .map((m, i) => `${i + 1}. [${m.time}] ${m.motive}: ${m.message}`)
          .join("\n"),
    );
  }

  if (ctx.folders?.length) {
    parts.push(
      "\n\n## Desktop Folders\n" +
        ctx.folders.map((f) => `• ${f.name} (${f.items.length} items)`).join("\n"),
    );
  }

  return parts.join("");
}

// ─── API class ────────────────────────────────────────────────────────────────

class GeminiAPI {
  /**
   * Primary API key — VITE_GEMINI_API_KEY
   * Fallback key  — VITE_GEMINI_API_KEY_2
   *
   * If the primary key fails (rate-limit / auth error), the request is
   * automatically retried once with the secondary key.
   */
  private readonly primaryKey: string;
  private readonly fallbackKey: string;
  private readonly baseUrl = "https://generativelanguage.googleapis.com/v1beta/models";

  constructor() {
    this.primaryKey  = import.meta.env.VITE_GEMINI_API_KEY  ?? "";
    this.fallbackKey = import.meta.env.VITE_GEMINI_API_KEY_2 ?? "";

    if (!this.primaryKey)  console.warn("[Gemini] Primary API key (VITE_GEMINI_API_KEY) not configured.");
    if (!this.fallbackKey) console.warn("[Gemini] Fallback API key (VITE_GEMINI_API_KEY_2) not configured — single-key mode.");
  }

  /** Make a single Gemini API request with the given key. */
  private async _request(apiKey: string, body: GeminiRequest): Promise<{ ok: boolean; text: string; status: number }> {
    try {
      const res = await fetch(
        `${this.baseUrl}/gemini-flash-latest:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );

      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { error?: { message?: string } };
        console.error("[Gemini] HTTP error:", err);
        return {
          ok: false,
          text: HTTP_ERRORS[res.status] ?? `API error (${res.status}): ${err.error?.message ?? "Unknown error"}`,
          status: res.status,
        };
      }

      const data: GeminiResponse = await res.json();
      return {
        ok: true,
        text: data.candidates?.[0]?.content?.parts?.[0]?.text ?? "No response received.",
        status: 200,
      };
    } catch (err) {
      console.error("[Gemini] Network error:", err);
      return { ok: false, text: "Failed to reach Gemini. Please check your internet connection.", status: 0 };
    }
  }

  async generateContent(
    prompt: string,
    conversationHistory: GeminiMessage[] = [],
    userContext?: UserContext,
  ): Promise<string> {
    if (!this.primaryKey && !this.fallbackKey) return "API key not configured.";

    // System context is sent only on the first message of a conversation.
    const isFirstTurn = conversationHistory.length === 0;

    const userText = isFirstTurn && userContext
      ? `You are Jarvis — a sharp, concise AI assistant embedded in the user's personal AI Metrics workspace. You know everything about the user's saved tools, prompts, links, and reminders. Be direct and helpful.${buildContextString(userContext)}\n\n---\n\nUser: ${prompt}`
      : prompt;

    const body: GeminiRequest = {
      contents: [
        ...conversationHistory,
        { role: "user", parts: [{ text: userText }] },
      ],
      generationConfig: {
        temperature: 0.7,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 2048,
      },
    };

    // Try primary key first
    if (this.primaryKey) {
      const result = await this._request(this.primaryKey, body);
      if (result.ok) return result.text;

      // On rate-limit (429) or auth error (403), try fallback key
      const isSwitchableError = result.status === 429 || result.status === 403;
      if (isSwitchableError && this.fallbackKey) {
        console.warn("[Gemini] Primary key failed — retrying with fallback key.");
        const fallbackResult = await this._request(this.fallbackKey, body);
        return fallbackResult.text;
      }
      return result.text;
    }

    // Primary not configured — use fallback directly
    if (this.fallbackKey) {
      const result = await this._request(this.fallbackKey, body);
      return result.text;
    }

    return "API key not configured.";
  }

  get configured(): boolean {
    return Boolean(this.primaryKey || this.fallbackKey);
  }
}

export const geminiAPI = new GeminiAPI();
