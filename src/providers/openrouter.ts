import type { AIProvider, ExpandRequest } from "./types";
import { buildUserMessage } from "../prompts";

const OPENROUTER_BASE = "https://openrouter.ai/api/v1";

export class OpenRouterProvider implements AIProvider {
  readonly id = "openrouter" as const;

  constructor(private opts: { apiKey: string; model: string }) {}

  async expand(req: ExpandRequest): Promise<string> {
    if (!this.opts.apiKey) {
      throw new Error("OpenRouter API key is not set. Configure it in plugin settings.");
    }
    const body = {
      model: this.opts.model,
      messages: [
        { role: "system", content: req.systemPrompt },
        { role: "user", content: buildUserMessage(req.userPrompt, req.selection) },
      ],
      stream: true,
    };

    const response = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.opts.apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://github.com/obsidian-ai-expander",
        "X-Title": "Obsidian AI Expander",
      },
      body: JSON.stringify(body),
      signal: req.signal,
    });

    if (!response.ok) {
      const text = await safeText(response);
      throw new Error(`OpenRouter HTTP ${response.status}: ${text || response.statusText}`);
    }
    if (!response.body) {
      throw new Error("OpenRouter response has no body");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let full = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let sepIdx: number;
      while ((sepIdx = buffer.indexOf("\n\n")) !== -1) {
        const event = buffer.slice(0, sepIdx);
        buffer = buffer.slice(sepIdx + 2);
        const piece = parseSseEvent(event);
        if (piece === DONE) return full;
        if (piece) {
          full += piece;
          req.onToken(piece);
        }
      }
    }

    return full;
  }

  async listModels(): Promise<string[]> {
    const headers: Record<string, string> = {};
    if (this.opts.apiKey) headers.Authorization = `Bearer ${this.opts.apiKey}`;
    const response = await fetch(`${OPENROUTER_BASE}/models`, { headers });
    if (!response.ok) {
      throw new Error(`OpenRouter HTTP ${response.status}: ${response.statusText}`);
    }
    const data = (await response.json()) as { data?: Array<{ id: string }> };
    return (data.data ?? []).map((m) => m.id).sort();
  }
}

const DONE = Symbol("done");

function parseSseEvent(event: string): string | typeof DONE | null {
  let acc = "";
  for (const rawLine of event.split("\n")) {
    const line = rawLine.trimEnd();
    if (!line || line.startsWith(":")) continue;
    if (!line.startsWith("data:")) continue;
    const payload = line.slice(5).trim();
    if (payload === "[DONE]") return DONE;
    try {
      const json = JSON.parse(payload) as {
        choices?: Array<{ delta?: { content?: string }; finish_reason?: string | null }>;
      };
      const piece = json.choices?.[0]?.delta?.content ?? "";
      if (piece) acc += piece;
    } catch {
      /* ignore malformed event */
    }
  }
  return acc || null;
}

async function safeText(r: Response): Promise<string> {
  try {
    return await r.text();
  } catch {
    return "";
  }
}
