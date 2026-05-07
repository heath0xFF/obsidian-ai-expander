import type { AIProvider, ExpandRequest } from "./types";
import { buildUserMessage } from "../prompts";

export class OllamaProvider implements AIProvider {
  readonly id = "ollama" as const;

  constructor(private opts: { baseUrl: string; model: string }) {}

  async expand(req: ExpandRequest): Promise<string> {
    const url = trimSlash(this.opts.baseUrl) + "/api/chat";
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
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: req.signal,
    });

    if (!response.ok) {
      const text = await safeText(response);
      throw new Error(`Ollama HTTP ${response.status}: ${text || response.statusText}`);
    }
    if (!response.body) {
      throw new Error("Ollama response has no body");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let full = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        let chunk: { message?: { content?: string }; done?: boolean; error?: string };
        try {
          chunk = JSON.parse(trimmed);
        } catch {
          continue;
        }
        if (chunk.error) throw new Error(`Ollama: ${chunk.error}`);
        const piece = chunk.message?.content ?? "";
        if (piece) {
          full += piece;
          req.onToken(piece);
        }
        if (chunk.done) return full;
      }
    }

    if (buffer.trim()) {
      try {
        const tail = JSON.parse(buffer);
        const piece = tail.message?.content ?? "";
        if (piece) {
          full += piece;
          req.onToken(piece);
        }
      } catch {
        /* ignore trailing partial */
      }
    }

    return full;
  }

  async listModels(): Promise<string[]> {
    const url = trimSlash(this.opts.baseUrl) + "/api/tags";
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Ollama HTTP ${response.status}: ${response.statusText}`);
    }
    const data = (await response.json()) as { models?: Array<{ name: string }> };
    return (data.models ?? []).map((m) => m.name).sort();
  }
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
