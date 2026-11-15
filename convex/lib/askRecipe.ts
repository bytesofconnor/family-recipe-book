import { createGateway, generateText } from "ai";

/** Vertex first. The Google route for this model id is deprecated and answers 400. */
export const EXTRACT_MODEL = "google/gemini-2.5-flash";
export const EXTRACT_FALLBACKS = [
  "google/gemini-2.5-flash-lite",
  "openai/gpt-4o-mini",
] as const;

export async function askRecipeModel(input: {
  apiKey: string;
  prompt: string;
  images: Array<{ bytes: Uint8Array; mime: string }>;
}): Promise<string> {
  const gateway = createGateway({ apiKey: input.apiKey });
  const content: Array<
    | { type: "text"; text: string }
    | { type: "file"; data: Uint8Array; mediaType: string }
  > = [{ type: "text", text: input.prompt }];
  for (const image of input.images) {
    content.push({
      type: "file",
      data: image.bytes,
      mediaType: image.mime,
    });
  }
  const result = await generateText({
    model: gateway(EXTRACT_MODEL),
    reasoning: "none",
    temperature: 0,
    maxOutputTokens: 4096,
    maxRetries: 0,
    timeout: { totalMs: 25_000 },
    messages: [{ role: "user", content }],
    providerOptions: {
      gateway: {
        tags: ["feature:card-extract"],
        order: ["vertex", "google"],
        models: [...EXTRACT_FALLBACKS],
      },
    },
  });
  const text = result.text.trim();
  if (text.length > 0) return text;
  return (result.reasoningText ?? "").trim();
}
