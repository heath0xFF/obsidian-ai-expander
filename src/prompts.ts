export function buildUserMessage(userPrompt: string, selection: string): string {
  return `Directive: ${userPrompt}\n\nPassage:\n${selection}`;
}
