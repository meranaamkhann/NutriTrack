import { aiParsedOutputSchema } from "./ai.schemas.js";
import { env } from "../../config/env.js";
import { logger } from "../../lib/logger.js";
import type { z } from "zod";

export type AiParsedOutput = z.infer<typeof aiParsedOutputSchema>;

export interface AiProvider {
  parseFoodText(rawText: string): Promise<unknown>;
}

export class StubAiProvider implements AiProvider {
  async parseFoodText(_rawText: string): Promise<unknown> {
    return { items: [] };
  }
}

const SYSTEM_PROMPT = `You extract foods from a short natural-language meal description.
Respond with ONLY a JSON object, no prose, no markdown fences, matching exactly:
{"items":[{"name":string,"quantity":number,"unit":"G"|"ML"|"PIECE"|"CUP"|"TBSP"|"TSP"|"OZ","meal":"BREAKFAST"|"LUNCH"|"DINNER"|"SNACK"|"CUSTOM","estimatedCalories":number,"estimatedProteinG":number,"estimatedCarbG":number,"estimatedFatG":number}]}
Rules:
- If no meal is stated, guess from context or use "SNACK".
- Use "PIECE" for countable items (eggs, rotis) with quantity = count.
- Give your best real-world nutrition estimate per item, not zeros.
- If nothing food-related is in the text, respond {"items":[]}.
- Never include any text outside the JSON object.`;

export class AnthropicAiProvider implements AiProvider {
  constructor(private apiKey: string) {}

  async parseFoodText(rawText: string): Promise<unknown> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);

    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          "x-api-key": this.apiKey,
          "anthropic-version": "2023-06-01"
        },
        body: JSON.stringify({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 1024,
          system: SYSTEM_PROMPT,
          messages: [{ role: "user", content: rawText.slice(0, 500) }]
        })
      });

      if (!res.ok) {
        logger.warn({ status: res.status }, "AI provider returned non-OK status");
        return { items: [] };
      }

      const data = (await res.json()) as { content?: { type: string; text?: string }[] };
      const textBlock = data.content?.find((b) => b.type === "text")?.text ?? "";
      const cleaned = textBlock.trim().replace(/^```json\s*|```$/g, "");

      try {
        return JSON.parse(cleaned);
      } catch {
        logger.warn("AI provider returned non-JSON output, discarding");
        return { items: [] };
      }
    } catch (err) {
      logger.warn({ err }, "AI provider call failed or timed out");
      return { items: [] };
    } finally {
      clearTimeout(timeout);
    }
  }
}

export function buildAiProvider(): AiProvider {
  if (env.ANTHROPIC_API_KEY) return new AnthropicAiProvider(env.ANTHROPIC_API_KEY);
  return new StubAiProvider();
}

export async function parseAndValidate(provider: AiProvider, rawText: string): Promise<AiParsedOutput> {
  const raw = await provider.parseFoodText(rawText);
  const result = aiParsedOutputSchema.safeParse(raw);
  if (!result.success) {
    return { items: [] };
  }
  return result.data;
}