import type { ProviderId } from "../settings";

export interface ExpandRequest {
  systemPrompt: string;
  userPrompt: string;
  selection: string;
  onToken: (chunk: string) => void;
  signal: AbortSignal;
}

export interface AIProvider {
  id: ProviderId;
  expand(req: ExpandRequest): Promise<string>;
  listModels?(): Promise<string[]>;
}
