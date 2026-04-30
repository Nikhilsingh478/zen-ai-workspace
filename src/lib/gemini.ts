// Gemini API integration

export interface GeminiMessage {
  role: "user" | "model";
  parts: { text: string }[];
}

export interface GeminiRequest {
  contents: GeminiMessage[];
  generationConfig?: {
    temperature?: number;
    topK?: number;
    topP?: number;
    maxOutputTokens?: number;
  };
}

export interface GeminiResponse {
  candidates: Array<{
    content: {
      parts: { text: string }[];
      role: string;
    };
    finishReason: string;
    index: number;
  }>;
  promptFeedback?: {
    blockReason?: string;
    safetyRatings?: Array<{
      category: string;
      probability: string;
      blocked: boolean;
    }>;
  };
}

export class GeminiAPI {
  private apiKey: string;
  private baseUrl = "https://generativelanguage.googleapis.com/v1beta/models";

  constructor() {
    this.apiKey = import.meta.env.VITE_GEMINI_API_KEY || "";

    if (!this.apiKey) {
      console.warn("Gemini API key not found in environment variables");
    }
  }

  async generateContent(
    prompt: string,
    conversationHistory: GeminiMessage[] = [],
    userContext?: { websites: any[]; prompts: any[] },
  ): Promise<string> {
    if (!this.apiKey) {
      return "API key not configured. Please add your Gemini API key to the .env file.";
    }

    try {
      // Build context string from user's data
      let contextString = "";
      if (userContext) {
        if (userContext.websites && userContext.websites.length > 0) {
          contextString += "\n\nUser's Websites:\n";
          userContext.websites.forEach((site, i) => {
            contextString += `${i + 1}. ${site.name} - ${site.url}\n   Description: ${site.description}\n   Tags: ${site.tags.join(", ")}\n`;
          });
        }

        if (userContext.prompts && userContext.prompts.length > 0) {
          contextString += "\n\nUser's Prompts:\n";
          userContext.prompts.forEach((prompt, i) => {
            contextString += `${i + 1}. ${prompt.title}\n   ${prompt.body}\n`;
          });
        }
      }

      // Add system context
      const systemPrompt = `You are an AI assistant helping with the user's AI Metrics workspace. ${contextString}

The user is asking for help with their AI tools and prompts. Provide helpful, contextual responses based on their saved data when relevant.

User's question:`;

      const requestBody: GeminiRequest = {
        contents: [
          ...conversationHistory,
          {
            role: "user",
            parts: [{ text: systemPrompt + " " + prompt }],
          },
        ],
        generationConfig: {
          temperature: 0.7,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 2048,
        },
      };

      const response = await fetch(
        `${this.baseUrl}/gemini-flash-latest:generateContent?key=${this.apiKey}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(requestBody),
        },
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error("Gemini API error:", errorData);

        if (response.status === 400) {
          return "Invalid request. Please check your API key and try again.";
        } else if (response.status === 403) {
          return "API key is invalid or permissions are insufficient.";
        } else if (response.status === 429) {
          return "Rate limit exceeded. Please try again in a moment.";
        } else {
          return `API error (${response.status}): ${errorData.error?.message || "Unknown error"}`;
        }
      }

      const data: GeminiResponse = await response.json();

      if (data.candidates && data.candidates.length > 0) {
        const candidate = data.candidates[0];
        if (candidate.content && candidate.content.parts && candidate.content.parts.length > 0) {
          return candidate.content.parts[0].text;
        }
      }

      return "No response received from Gemini.";
    } catch (error) {
      console.error("Error calling Gemini API:", error);
      return "Failed to connect to Gemini API. Please check your internet connection.";
    }
  }

  isConfigured(): boolean {
    return !!this.apiKey;
  }
}

// Export singleton instance
export const geminiAPI = new GeminiAPI();
