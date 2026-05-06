// ─── Types ────────────────────────────────────────────────────────────────────

interface GeminiMessage {
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
  promptFeedback?: {
    blockReason?: string;
  };
}

export interface UserContext {
  websites?: Array<{ name: string; url: string; description: string; tags: string[] }>;
  prompts?: Array<{ title: string; body: string }>;
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
      "\n\nUser's Websites:\n" +
        ctx.websites
          .map((s, i) => `${i + 1}. ${s.name} — ${s.url}\n   ${s.description}\n   Tags: ${s.tags.join(", ")}`)
          .join("\n"),
    );
  }

  if (ctx.prompts?.length) {
    parts.push(
      "\n\nUser's Prompts:\n" +
        ctx.prompts.map((p, i) => `${i + 1}. ${p.title}\n   ${p.body}`).join("\n"),
    );
  }

  return parts.join("");
}

// ─── API class ────────────────────────────────────────────────────────────────

class GeminiAPI {
  private readonly apiKey: string;
  private readonly baseUrl = "https://generativelanguage.googleapis.com/v1beta/models";

  constructor() {
    this.apiKey = import.meta.env.VITE_GEMINI_API_KEY ?? "";
    if (!this.apiKey) console.warn("[Gemini] API key not configured.");
  }

  async generateContent(
    prompt: string,
    conversationHistory: GeminiMessage[] = [],
    userContext?: UserContext,
  ): Promise<string> {
    if (!this.apiKey) return "API key not configured.";

    const systemPrompt = `You are an AI assistant for the user's AI Metrics workspace.${userContext ? buildContextString(userContext) : ""}

Provide helpful, contextual responses based on the user's saved data when relevant.

User's question:`;

    const body: GeminiRequest = {
      contents: [
        ...conversationHistory,
        { role: "user", parts: [{ text: `${systemPrompt} ${prompt}` }] },
      ],
      generationConfig: { temperature: 0.7, topK: 40, topP: 0.95, maxOutputTokens: 2048 },
    };

    try {
      const res = await fetch(`${this.baseUrl}/gemini-flash-latest:generateContent?key=${this.apiKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}) as { error?: { message?: string } });
        console.error("[Gemini] HTTP error:", err);
        return (
          HTTP_ERRORS[res.status] ??
          `API error (${res.status}): ${(err as { error?: { message?: string } }).error?.message ?? "Unknown error"}`
        );
      }

      const data: GeminiResponse = await res.json();
      return data.candidates?.[0]?.content?.parts?.[0]?.text ?? "No response received from Gemini.";
    } catch (err) {
      console.error("[Gemini] Network error:", err);
      return "Failed to reach Gemini. Please check your internet connection.";
    }
  }

  get configured(): boolean {
    return Boolean(this.apiKey);
  }
}

export const geminiAPI = new GeminiAPI();
