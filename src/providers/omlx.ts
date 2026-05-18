import type { AIProvider, ExpandRequest } from "./types";
import { buildUserMessage } from "../prompts";

/**
 * oMLX is an OpenAI-compatible local inference server for Apple Silicon.
 * baseUrl is expected to already include the `/v1` prefix
 * (e.g. http://localhost:42069/v1), so endpoints are appended directly.
 */
export class OmlxProvider implements AIProvider {
  readonly id = "omlx" as const;

  constructor(private opts: { baseUrl: string; apiKey?: string; model: string }) {}

  private headers(extra?: Record<string, string>): Record<string, string> {
    const h: Record<string, string> = { ...extra };
    const key = this.opts.apiKey?.trim();
    if (key) h["Authorization"] = `Bearer ${key}`;
    return h;
  }

  async expand(req: ExpandRequest): Promise<string> {
    const url = trimSlash(this.opts.baseUrl) + "/chat/completions";
    const body = {
      model: this.opts.model,
      messages: [
        { role: "system", content: req.systemPrompt },
        { role: "user", content: buildUserMessage(req.userPrompt, req.selection) },
      ],
      stream: true,
    };

    const response = await fetch(url, {
      method: "POST",
      headers: this.headers({ "Content-Type": "application/json" }),
      body: JSON.stringify(body),
      signal: req.signal,
    });

    if (!response.ok) {
      const text = await safeText(response);
      throw new Error(`oMLX HTTP ${response.status}: ${text || response.statusText}`);
    }
    if (!response.body) {
      throw new Error("oMLX response has no body");
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
    const url = trimSlash(this.opts.baseUrl) + "/models";
    const response = await fetch(url, { headers: this.headers() });
    if (!response.ok) {
      throw new Error(`oMLX HTTP ${response.status}: ${response.statusText}`);
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

function trimSlash(s: string): string {
  return s.replace(/\/+$/, "");
}

async function safeText(r: Response): Promise<string> {
  try {
    return await r.text();
  } catch {
    return "";
  }
}
