export type ProviderId = "ollama" | "openrouter" | "claude-cli";

export type AcceptBehavior = "replace" | "append";

export interface AIExpanderSettings {
  defaultProvider: ProviderId;
  acceptBehavior: AcceptBehavior;
  systemPrompt: string;
  ollama: {
    baseUrl: string;
    model: string;
  };
  openrouter: {
    apiKey: string;
    model: string;
  };
  claudeCli: {
    binaryPath: string;
    model: string;
  };
}

export const DEFAULT_SYSTEM_PROMPT =
  "You are a writing assistant. The user has selected a passage and given you a directive. " +
  "Expand the passage according to the directive. Match the existing tone, voice, and Markdown formatting. " +
  "Output only the expanded passage — no preamble, no explanation, no surrounding quotes.";

export const DEFAULT_SETTINGS: AIExpanderSettings = {
  defaultProvider: "ollama",
  acceptBehavior: "replace",
  systemPrompt: DEFAULT_SYSTEM_PROMPT,
  ollama: {
    baseUrl: "http://localhost:11434",
    model: "llama3.1",
  },
  openrouter: {
    apiKey: "",
    model: "anthropic/claude-sonnet-4.6",
  },
  claudeCli: {
    binaryPath: "claude",
    model: "",
  },
};
