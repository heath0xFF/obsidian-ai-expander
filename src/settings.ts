export type ProviderId = "omlx" | "openrouter" | "claude-cli";

export type AcceptBehavior = "replace" | "append";

export interface AIExpanderSettings {
  defaultProvider: ProviderId;
  acceptBehavior: AcceptBehavior;
  systemPrompt: string;
  omlx: {
    baseUrl: string;
    apiKey: string;
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
  defaultProvider: "omlx",
  acceptBehavior: "replace",
  systemPrompt: DEFAULT_SYSTEM_PROMPT,
  omlx: {
    baseUrl: "http://localhost:42069/v1",
    apiKey: "",
    model: "",
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
