import { supabase } from "@/lib/supabase";
import { addTaskDirect, getHorizonTasks } from "@/lib/horizon";
import type { HorizonTask } from "@/lib/horizon";

// ─── Types ────────────────────────────────────────────────────────────────────

export type GeminiMessagePart =
  | { text: string }
  | { functionCall: { name: string; args: Record<string, unknown> } }
  | { functionResponse: { name: string; response: { result: string } } };

export interface GeminiMessage {
  role: "user" | "model";
  parts: GeminiMessagePart[];
}

interface GeminiRequest {
  contents: GeminiMessage[];
  tools?: Array<{ functionDeclarations?: unknown[] } | { googleSearch?: Record<string, never> }>;
  generationConfig?: {
    temperature?: number;
    topK?: number;
    topP?: number;
    maxOutputTokens?: number;
  };
}

interface GeminiResponse {
  candidates?: Array<{
    content: { parts: GeminiMessagePart[]; role: string };
    finishReason: string;
    index: number;
    groundingMetadata?: {
      groundingChunks?: Array<{
        web?: { title?: string; uri?: string };
      }>;
    };
  }>;
}

export interface UserContext {
  websites?: Array<{ name: string; url: string; description: string; tags: string[] }>;
  prompts?: Array<{ title: string; body: string }>;
  links?: Array<{ name: string; url: string; description?: string | null }>;
  messages?: Array<{ motive: string; time: string; message: string }>;
  folders?: Array<{ name: string; items: string[] }>;
}

export type SearchSource = {
  title: string;
  url: string;
  snippet: string;
};

export type SearchType =
  | "general"
  | "news"
  | "weather"
  | "comparison"
  | "howto"
  | "definition"
  | "local"
  | "code"
  | "math";

// ─── Error map ────────────────────────────────────────────────────────────────

const HTTP_ERRORS: Record<number, string> = {
  400: "Invalid request. Please check your API key and try again.",
  403: "API key is invalid or permissions are insufficient.",
  429: "Rate limit exceeded. Please try again in a moment.",
};

// ─── JARVIS Tool Definitions ──────────────────────────────────────────────────

const JARVIS_TOOLS = [
  {
    name: "create_task",
    description:
      "Creates a task in Horizon when the user mentions something they need to do, a reminder, a deadline, or any actionable item with a time component.",
    parameters: {
      type: "object",
      properties: {
        title: { type: "string", description: "Clear, concise task title" },
        taskDate: { type: "string", description: "Date in YYYY-MM-DD format" },
        taskTime: { type: "string", description: "Time in HH:MM 24h format" },
        priority: { type: "string", enum: ["low", "medium", "high"] },
        description: { type: "string", description: "Optional extra context" },
      },
      required: ["title", "taskDate", "taskTime", "priority"],
    },
  },
  {
    name: "save_memory",
    description:
      "Saves something important to persistent memory when the user says 'remember that', mentions a preference, shares something personal, or says something that should be recalled in future sessions.",
    parameters: {
      type: "object",
      properties: {
        content: { type: "string", description: "The memory to save, written as a clear statement" },
        memory_type: {
          type: "string",
          enum: ["general", "preference", "commitment", "idea", "fact"],
          description: "Classification of what kind of memory this is",
        },
      },
      required: ["content", "memory_type"],
    },
  },
  {
    name: "get_today_tasks",
    description:
      "Retrieves all tasks scheduled for today when the user asks about their day, their schedule, what's pending, or what they need to do.",
    parameters: { type: "object", properties: {} },
  },
  {
    name: "get_pending_tasks",
    description:
      "Retrieves all incomplete tasks across all dates when the user asks about backlog, pending work, or unfinished tasks.",
    parameters: { type: "object", properties: {} },
  },
  {
    name: "recall_memories",
    description:
      "Searches persistent memory when the user asks what Jarvis remembers, asks about their own preferences, or references something from the past.",
    parameters: {
      type: "object",
      properties: {
        memory_type: {
          type: "string",
          enum: ["general", "preference", "commitment", "idea", "fact", "all"],
          description: "Filter by type or 'all' for everything",
        },
      },
      required: ["memory_type"],
    },
  },
  {
    name: "delete_task",
    description:
      "Deletes a specific task when the user says to remove, cancel, or delete a task.",
    parameters: {
      type: "object",
      properties: {
        task_id: { type: "string", description: "The task ID to delete" },
      },
      required: ["task_id"],
    },
  },
  {
    name: "update_task",
    description:
      "Updates an existing task's title, date, time, or priority when the user wants to reschedule or modify a task.",
    parameters: {
      type: "object",
      properties: {
        task_id: { type: "string", description: "The task ID to update" },
        title: { type: "string" },
        taskDate: { type: "string", description: "YYYY-MM-DD" },
        taskTime: { type: "string", description: "HH:MM 24h" },
        priority: { type: "string", enum: ["low", "medium", "high"] },
      },
      required: ["task_id"],
    },
  },
];

// ─── Tool Execution ───────────────────────────────────────────────────────────

function formatTaskList(tasks: HorizonTask[]): string {
  if (!tasks.length) return "No tasks found.";
  return tasks
    .map(
      (t) =>
        `• [${t.completed ? "DONE" : "PENDING"}] ${t.taskDate} ${t.taskTime} — ${t.title} (${t.priority} priority, id: ${t.id})`,
    )
    .join("\n");
}

export async function executeToolCall(
  toolName: string,
  toolArgs: Record<string, unknown>,
  sessionId: string,
): Promise<string> {
  try {
    if (toolName === "create_task") {
      const input = {
        title: String(toolArgs.title ?? "Untitled"),
        taskDate: String(toolArgs.taskDate ?? new Date().toISOString().split("T")[0]),
        taskTime: String(toolArgs.taskTime ?? "09:00"),
        priority: (["low", "medium", "high"].includes(String(toolArgs.priority))
          ? toolArgs.priority
          : "medium") as "low" | "medium" | "high",
        description: toolArgs.description ? String(toolArgs.description) : null,
        notificationEnabled: true,
      };
      const task = await addTaskDirect(input);
      if (!task) return "Failed to create the task — database error.";
      return `Task created: "${task.title}" on ${task.taskDate} at ${task.taskTime} (${task.priority} priority, id: ${task.id}).`;
    }

    if (toolName === "save_memory") {
      const content = String(toolArgs.content ?? "");
      const memory_type = String(toolArgs.memory_type ?? "general");
      const { error } = await supabase.from("jarvis_memory").insert({
        content,
        memory_type,
        source_session_id: sessionId || null,
      });
      if (error) return `Failed to save memory: ${error.message}`;
      return `Memory saved: "${content}" (type: ${memory_type}).`;
    }

    if (toolName === "get_today_tasks") {
      const today = new Date().toISOString().split("T")[0];
      const tasks = getHorizonTasks().filter((t) => t.taskDate === today);
      return `Today's tasks (${today}):\n${formatTaskList(tasks)}`;
    }

    if (toolName === "get_pending_tasks") {
      const tasks = getHorizonTasks().filter((t) => !t.completed);
      return `All pending tasks:\n${formatTaskList(tasks)}`;
    }

    if (toolName === "recall_memories") {
      const memory_type = String(toolArgs.memory_type ?? "all");
      let query = supabase
        .from("jarvis_memory")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(20);
      if (memory_type !== "all") {
        query = query.eq("memory_type", memory_type);
      }
      const { data, error } = await query;
      if (error) return `Failed to recall memories: ${error.message}`;
      if (!data || data.length === 0) return "No memories found.";
      const rows = data as Array<{ id: string; content: string; memory_type: string; created_at: string; recalled_count: number }>;
      const ids = rows.map((m) => m.id);
      await supabase
        .from("jarvis_memory")
        .update({ recalled_count: rows[0].recalled_count + 1, last_recalled_at: new Date().toISOString() })
        .in("id", ids)
        .then(() => null, () => null);
      return rows
        .map((m) => `• [${m.memory_type}] ${m.content} (saved ${new Date(m.created_at).toLocaleDateString()})`)
        .join("\n");
    }

    if (toolName === "delete_task") {
      const task_id = String(toolArgs.task_id ?? "");
      const { error } = await supabase.from("horizon_tasks").delete().eq("id", task_id);
      if (error) return `Failed to delete task: ${error.message}`;
      return `Task deleted successfully.`;
    }

    if (toolName === "update_task") {
      const task_id = String(toolArgs.task_id ?? "");
      const updates: Record<string, unknown> = {};
      if (toolArgs.title) updates.title = String(toolArgs.title);
      if (toolArgs.taskDate) updates.task_date = String(toolArgs.taskDate);
      if (toolArgs.taskTime) updates.task_time = String(toolArgs.taskTime);
      if (toolArgs.priority) updates.priority = String(toolArgs.priority);
      const { error } = await supabase.from("horizon_tasks").update(updates).eq("id", task_id);
      if (error) return `Failed to update task: ${error.message}`;
      return `Task updated successfully.`;
    }

    return `Unknown tool: ${toolName}`;
  } catch (err) {
    console.error(`[executeToolCall] ${toolName} error:`, err);
    return `Tool execution failed: ${String(err)}`;
  }
}

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

// ─── Search type classifier ───────────────────────────────────────────────────

function classifySearchType(responseText: string, userQuery: string): SearchType {
  void responseText;
  const q = userQuery.toLowerCase();

  if (/weather|temperature|rain|forecast|humid|°/.test(q)) return "weather";
  if (/news|latest|today|happened|update|current events/.test(q)) return "news";
  if (/\bvs\b|versus|compare|difference|better|which is/.test(q)) return "comparison";
  if (/how to|how do|steps|guide|tutorial|setup/.test(q)) return "howto";
  if (/what is|define|meaning|explain|who is/.test(q)) return "definition";
  if (/near me|nearby|restaurant|hotel|place|location|where/.test(q)) return "local";
  if (/code|error|bug|function|syntax|javascript|python|react/.test(q)) return "code";
  if (/calculate|percent|formula|math|equation|\d+\s*[+\-*/]/.test(q)) return "math";

  return "general";
}

// ─── API class ────────────────────────────────────────────────────────────────

class GeminiAPI {
  private readonly primaryKey: string;
  private readonly fallbackKey: string;
  private readonly baseUrl = "https://generativelanguage.googleapis.com/v1beta/models";

  constructor() {
    this.primaryKey = import.meta.env.VITE_GEMINI_API_KEY ?? "";
    this.fallbackKey = import.meta.env.VITE_GEMINI_API_KEY_2 ?? "";

    if (!this.primaryKey)
      console.warn("[Gemini] Primary API key (VITE_GEMINI_API_KEY) not configured.");
    if (!this.fallbackKey)
      console.warn("[Gemini] Fallback key (VITE_GEMINI_API_KEY_2) not configured — single-key mode.");
  }

  private async _request(
    apiKey: string,
    body: GeminiRequest,
  ): Promise<{ ok: boolean; text: string; status: number }> {
    try {
      const res = await fetch(
        `${this.baseUrl}/gemini-2.5-flash:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );

      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
        console.error("[Gemini] HTTP error:", err);
        return {
          ok: false,
          text:
            HTTP_ERRORS[res.status] ??
            `API error (${res.status}): ${err.error?.message ?? "Unknown error"}`,
          status: res.status,
        };
      }

      const data: GeminiResponse = await res.json();
      const part = data.candidates?.[0]?.content?.parts?.[0];
      const text = part && "text" in part ? part.text : "No response received.";
      return { ok: true, text, status: 200 };
    } catch (err) {
      console.error("[Gemini] Network error:", err);
      return {
        ok: false,
        text: "Failed to reach Gemini. Please check your internet connection.",
        status: 0,
      };
    }
  }

  private async _rawRequest(
    apiKey: string,
    body: GeminiRequest,
  ): Promise<{ ok: boolean; data: GeminiResponse | null; status: number }> {
    try {
      const res = await fetch(
        `${this.baseUrl}/gemini-2.5-flash:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );

      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
        console.error("[Gemini] HTTP error:", err);
        return { ok: false, data: null, status: res.status };
      }

      const data: GeminiResponse = await res.json();
      return { ok: true, data, status: 200 };
    } catch (err) {
      console.error("[Gemini] Network error:", err);
      return { ok: false, data: null, status: 0 };
    }
  }

  async generateContent(
    prompt: string,
    conversationHistory: GeminiMessage[] = [],
    userContext?: UserContext,
  ): Promise<string> {
    if (!this.primaryKey && !this.fallbackKey) return "API key not configured.";

    const isFirstTurn = conversationHistory.length === 0;

    const userText =
      isFirstTurn && userContext
        ? `You are Jarvis — a sharp, concise AI assistant embedded in the user's personal AI Metrics workspace. You know everything about the user's saved tools, prompts, links, and reminders. Be direct and helpful.${buildContextString(userContext)}\n\n---\n\nUser: ${prompt}`
        : prompt;

    const body: GeminiRequest = {
      contents: [
        ...conversationHistory,
        { role: "user", parts: [{ text: userText }] },
      ],
      generationConfig: { temperature: 0.7, topK: 40, topP: 0.95, maxOutputTokens: 8192 },
    };

    if (this.primaryKey) {
      const result = await this._request(this.primaryKey, body);
      if (result.ok) return result.text;
      const isSwitchableError = result.status === 429 || result.status === 403;
      if (isSwitchableError && this.fallbackKey) {
        console.warn("[Gemini] Primary key failed — retrying with fallback.");
        const fb = await this._request(this.fallbackKey, body);
        return fb.text;
      }
      return result.text;
    }

    if (this.fallbackKey) {
      const result = await this._request(this.fallbackKey, body);
      return result.text;
    }

    return "API key not configured.";
  }

  async generateWithTools(
    messages: GeminiMessage[],
    systemPrompt: string,
    sessionId: string,
  ): Promise<string> {
    if (!this.primaryKey && !this.fallbackKey) return "API key not configured.";

    const fullHistory: GeminiMessage[] = [
      { role: "user", parts: [{ text: systemPrompt }] },
      { role: "model", parts: [{ text: "Understood. JARVIS online and ready." }] },
      ...messages,
    ];

    const body: GeminiRequest = {
      contents: fullHistory,
      tools: [{ functionDeclarations: JARVIS_TOOLS }],
      generationConfig: { temperature: 0.7, topK: 40, topP: 0.95, maxOutputTokens: 8192 },
    };

    const tryRaw = async (key: string) => this._rawRequest(key, body);

    let raw = this.primaryKey ? await tryRaw(this.primaryKey) : null;
    if (!raw?.ok && this.fallbackKey) {
      console.warn("[Gemini] Primary key failed — retrying with fallback.");
      raw = await tryRaw(this.fallbackKey);
    }

    if (!raw?.ok || !raw.data) return "I encountered an error processing that request.";

    const candidate = raw.data.candidates?.[0];
    if (!candidate) return "No response received.";

    const parts = candidate.content.parts ?? [];

    const functionCallPart = parts.find((p) => "functionCall" in p && p.functionCall);
    const textPart = parts.find((p) => "text" in p && p.text);

    if (functionCallPart && "functionCall" in functionCallPart && functionCallPart.functionCall) {
      const { name, args } = functionCallPart.functionCall;
      const toolResult = await executeToolCall(name, args as Record<string, unknown>, sessionId);

      const followUpHistory: GeminiMessage[] = [
        ...fullHistory,
        { role: "model", parts: [functionCallPart] },
        { role: "user", parts: [{ functionResponse: { name, response: { result: toolResult } } }] },
      ];

      const followUpBody: GeminiRequest = {
        contents: followUpHistory,
        generationConfig: { temperature: 0.7, topK: 40, topP: 0.95, maxOutputTokens: 8192 },
      };

      if (this.primaryKey) {
        const finalResult = await this._request(this.primaryKey, followUpBody);
        if (finalResult.ok) return finalResult.text;
        if (this.fallbackKey) {
          const fb = await this._request(this.fallbackKey, followUpBody);
          return fb.text;
        }
      } else if (this.fallbackKey) {
        const finalResult = await this._request(this.fallbackKey, followUpBody);
        return finalResult.text;
      }

      return toolResult;
    }

    if (textPart && "text" in textPart && textPart.text) return textPart.text;

    return "No response received.";
  }

  async generateWithSearch(
    messages: GeminiMessage[],
    systemPrompt: string,
  ): Promise<{ text: string; sources: SearchSource[]; searchType: SearchType }> {
    const fallback = { text: "API key not configured.", sources: [] as SearchSource[], searchType: "general" as SearchType };
    if (!this.primaryKey && !this.fallbackKey) return fallback;

    const fullHistory: GeminiMessage[] = [
      { role: "user", parts: [{ text: systemPrompt }] },
      { role: "model", parts: [{ text: "Understood. I will search for current information." }] },
      ...messages,
    ];

    const body: GeminiRequest = {
      contents: fullHistory,
      tools: [{ googleSearch: {} }],
      generationConfig: { temperature: 0.7, topK: 40, topP: 0.95, maxOutputTokens: 8192 },
    };

    let raw = this.primaryKey ? await this._rawRequest(this.primaryKey, body) : null;
    if (!raw?.ok && this.fallbackKey) {
      console.warn("[Gemini] Primary key failed for search — retrying with fallback.");
      raw = await this._rawRequest(this.fallbackKey, body);
    }

    if (!raw?.ok || !raw.data) {
      return { text: "I encountered an error searching for that.", sources: [], searchType: "general" };
    }

    const candidate = raw.data.candidates?.[0];
    if (!candidate) return { text: "No search results received.", sources: [], searchType: "general" };

    const textPart = candidate.content.parts?.find((p) => "text" in p && p.text);
    const text = (textPart && "text" in textPart ? textPart.text : "") || "No results found.";

    const sources: SearchSource[] = (candidate.groundingMetadata?.groundingChunks ?? [])
      .filter((chunk) => chunk.web?.uri)
      .map((chunk) => ({
        title: chunk.web?.title ?? "",
        url: chunk.web?.uri ?? "",
        snippet: "",
      }));

    const userQuery = messages[messages.length - 1]?.parts?.find((p) => "text" in p && p.text);
    const queryText = (userQuery && "text" in userQuery ? userQuery.text : "") ?? "";
    const searchType = classifySearchType(text, queryText);

    return { text, sources, searchType };
  }

  get configured(): boolean {
    return Boolean(this.primaryKey || this.fallbackKey);
  }
}

export const geminiAPI = new GeminiAPI();
