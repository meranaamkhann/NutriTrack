import { aiParsedOutputSchema } from "./ai.schemas.js";
import type { z } from "zod";

export type AiParsedOutput = z.infer<typeof aiParsedOutputSchema>;

export interface AiProvider {
  parseFoodText(rawText: string): Promise<unknown>;
}

// Placeholder provider so the endpoint works without a live LLM key. Replace
// with a real call (Anthropic/OpenAI, structured output / tool schema) behind
// this same interface. Whatever the provider returns is untrusted and is
// re-validated by aiParsedOutputSchema before it is ever shown to the user.
export class StubAiProvider implements AiProvider {
  async parseFoodText(_rawText: string): Promise<unknown> {
    return { items: [] };
  }
}

export async function parseAndValidate(provider: AiProvider, rawText: string): Promise<AiParsedOutput> {
  const raw = await provider.parseFoodText(rawText);
  const result = aiParsedOutputSchema.safeParse(raw);
  if (!result.success) {
    return { items: [] };
  }
  return result.data;
}
