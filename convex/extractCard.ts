"use node";

import { v } from "convex/values";
import JSZip from "jszip";
import { extractText, getDocumentProxy } from "unpdf";
import { action, env } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { askRecipeModel } from "./lib/askRecipe";
import {
  friendlyReadError,
  imageGate,
  logReadFailure,
  READ_BAD_TYPE,
  READ_GATEWAY,
  READ_MISSED,
  READ_MISSED_LINK,
  READ_TOO_BIG,
} from "./lib/readFailure";
import {
  extractionInstructions,
  plainTextFromHtml,
  readRecipePages,
  readRecipeText,
  recipeFromHtml,
  validateRecipeJson,
  type ReadCard,
} from "./lib/recipeRead";
import { kindFromUrl, sourceKindValidator } from "./lib/sources";

const confidence = v.union(v.literal("high"), v.literal("low"));

const cardFields = {
  title: v.string(),
  makes: v.string(),
  prepTime: v.string(),
  cookTime: v.string(),
  ingredients: v.array(v.string()),
  parts: v.array(
    v.object({
      quantity: v.string(),
      unit: v.string(),
      item: v.string(),
      line: v.string(),
      confidence,
    }),
  ),
  steps: v.array(v.string()),
  stepConfidence: v.array(confidence),
  notes: v.optional(v.string()),
  sourceKind: sourceKindValidator,
  sourceTitle: v.string(),
  confidence: v.object({
    title: confidence,
    makes: confidence,
    times: confidence,
    notes: confidence,
  }),
};

const extractReturn = v.object({
  cards: v.array(v.object(cardFields)),
  usedAi: v.boolean(),
  rawText: v.string(),
  skipped: v.optional(v.boolean()),
  readError: v.optional(v.string()),
});

const MAX_SCAN_IMAGES = 6;

const scanFile = v.object({
  storageId: v.id("_storage"),
  fileName: v.string(),
  mimeType: v.string(),
});

export const fromUpload = action({
  args: {
    writerToken: v.optional(v.string()),
    kitchenId: v.optional(v.id("kitchens")),
    storageId: v.id("_storage"),
    fileName: v.string(),
    mimeType: v.string(),
    images: v.optional(v.array(scanFile)),
  },
  returns: extractReturn,
  handler: async (
    ctx,
    args,
  ): Promise<{
    cards: ReadCard[];
    usedAi: boolean;
    rawText: string;
    skipped?: boolean;
    readError?: string;
  }> => {
    await ctx.runQuery(internal.sallyCredit.assertWriter, {
      writerToken: args.writerToken,
      kitchenId: args.kitchenId,
    });

    const batch = (args.images && args.images.length > 0
      ? args.images
      : [
          {
            storageId: args.storageId,
            fileName: args.fileName,
            mimeType: args.mimeType,
          },
        ]
    ).slice(0, MAX_SCAN_IMAGES);

    const loaded: LoadedFile[] = [];
    for (const [index, file] of batch.entries()) {
      const opened = await openStoredFile(ctx, file);
      if (!opened) {
        if (index === 0) {
          throw new Error("That file didn't stay. Try the upload once more.");
        }
        continue;
      }
      loaded.push(opened);
    }

    const pages: string[] = [];
    const images: ScanImage[] = [];
    let skippedBig = 0;
    let unreadable = 0;
    for (const file of loaded) {
      if (file.isImage) {
        const gate = imageGate(new Uint8Array(file.bytes));
        if (!gate.ok) {
          if (gate.error === "size") skippedBig += 1;
          else unreadable += 1;
          continue;
        }
        images.push({
          bytes: file.bytes,
          mime: gate.mime,
          fileName: file.fileName,
        });
        continue;
      }
      const textPages = file.isPdf
        ? await textFromPdf(file.bytes)
        : await pagesFromFile(file.bytes, file.fileName, file.mime);
      pages.push(...textPages);
    }
    const rawText = pages.join("\n\n---\n\n");
    const onlyImages = loaded.length > 0 && loaded.every((file) => file.isImage);

    let readError: string | undefined;
    const apiKey = env.AI_GATEWAY_API_KEY?.trim();
    if (apiKey && (images.length > 0 || rawText.trim().length > 0)) {
      try {
        const cards = await cardsWithAi({
          apiKey,
          pages,
          rawText,
          fileName: args.fileName,
          images,
          skippedBig,
        });
        if (cards.length > 0) {
          return { cards, usedAi: true, rawText };
        }
        console.warn("Card extract: AI returned no parseable cards");
        readError = READ_MISSED;
      } catch (error) {
        logReadFailure("Card extract failed", error);
        readError = friendlyReadError(error);
      }
    } else if (!apiKey) {
      console.warn("Card extract: AI_GATEWAY_API_KEY missing");
    }

    if (onlyImages) {
      if (images.length === 0 && skippedBig > 0 && unreadable === 0) {
        readError = READ_TOO_BIG;
      } else if (images.length === 0 && unreadable > 0) {
        readError = READ_BAD_TYPE;
      }
      return {
        cards: [],
        usedAi: false,
        rawText,
        skipped: !apiKey,
        readError: readError ?? READ_GATEWAY,
      };
    }
    if (rawText.trim().length > 0) {
      const local = readRecipePages(pages.length > 0 ? pages : [rawText], args.fileName);
      if (local.some((card) => card.ingredients.length + card.steps.length > 0)) {
        return { cards: local, usedAi: false, rawText };
      }
    }
    return {
      cards: [],
      usedAi: false,
      rawText,
      readError: readError ?? READ_GATEWAY,
    };
  },
});

type ScanFile = {
  storageId: Id<"_storage">;
  fileName: string;
  mimeType: string;
};

type LoadedFile = {
  bytes: ArrayBuffer;
  mime: string;
  fileName: string;
  isImage: boolean;
  isPdf: boolean;
};

type ScanImage = {
  bytes: ArrayBuffer;
  mime: string;
  fileName: string;
};

async function openStoredFile(
  ctx: { storage: { getUrl: (id: Id<"_storage">) => Promise<string | null> } },
  file: ScanFile,
): Promise<LoadedFile | null> {
  const url = await ctx.storage.getUrl(file.storageId);
  if (!url) {
    return null;
  }
  const response = await fetch(url);
  if (!response.ok) {
    return null;
  }
  const bytes = await response.arrayBuffer();
  const mime = file.mimeType.toLowerCase();
  const isPdf =
    mime.includes("pdf") ||
    file.fileName.toLowerCase().endsWith(".pdf") ||
    new TextDecoder().decode(bytes.slice(0, 5)).startsWith("%PDF");
  return {
    bytes,
    mime,
    fileName: file.fileName,
    isImage: mime.startsWith("image/"),
    isPdf,
  };
}

async function textFromPdf(bytes: ArrayBuffer): Promise<string[]> {
  try {
    const pdf = await getDocumentProxy(new Uint8Array(bytes));
    const { text } = await extractText(pdf, { mergePages: false });
    const pages = (Array.isArray(text) ? text : [text])
      .map((page) => page.replace(/\s+\n/g, "\n").trim())
      .filter((page) => page.length > 0);
    if (pages.length > 0) {
      return pages;
    }
    const merged = await extractText(pdf, { mergePages: true });
    const blob = (Array.isArray(merged.text) ? merged.text.join("\n\n") : merged.text)
      .trim();
    return blob.length > 0 ? [blob.slice(0, 40_000)] : [];
  } catch (error) {
    console.error("PDF text extract failed", error);
    return [];
  }
}

async function pagesFromFile(
  bytes: ArrayBuffer,
  fileName: string,
  mime: string,
): Promise<string[]> {
  const name = fileName.toLowerCase();
  if (name.endsWith(".pptx") || mime.includes("presentationml")) {
    return await textFromPptx(bytes);
  }
  const asText = new TextDecoder().decode(bytes);
  if (asText.includes("%PDF")) {
    return await textFromPdf(bytes);
  }
  return splitPlainPages(asText.slice(0, 40_000));
}

function splitPlainPages(raw: string): string[] {
  const chunks = raw
    .split(/\n{3,}|^---+$/m)
    .map((chunk) => chunk.trim())
    .filter((chunk) => chunk.length > 0);
  return chunks.length > 0 ? chunks : [raw.trim()].filter(Boolean);
}

async function textFromPptx(bytes: ArrayBuffer): Promise<string[]> {
  const zip = await JSZip.loadAsync(bytes);
  const slides = Object.keys(zip.files)
    .filter((path) => /ppt\/slides\/slide\d+\.xml$/i.test(path))
    .sort((left, right) => left.localeCompare(right, undefined, { numeric: true }));
  const pages: string[] = [];
  for (const path of slides) {
    const xml = await zip.file(path)?.async("string");
    if (!xml) {
      continue;
    }
    const bits = [...xml.matchAll(/<a:t>([^<]*)<\/a:t>/g)].map((match) =>
      match[1]?.trim() ?? "",
    );
    const page = bits.filter((bit) => bit.length > 0).join("\n");
    if (page.length > 0) {
      pages.push(page);
    }
  }
  return pages;
}

async function cardsWithAi({
  apiKey,
  pages,
  rawText,
  fileName,
  images,
  skippedBig,
}: {
  apiKey: string;
  pages: string[];
  rawText: string;
  fileName: string;
  images: ScanImage[];
  skippedBig: number;
}): Promise<ReadCard[]> {
  const slideBlock =
    pages.length > 1
      ? pages
          .map((page, index) => `--- Page ${index + 1} ---\n${page}`)
          .join("\n\n")
          .slice(0, 24_000)
      : rawText.slice(0, 24_000);
  const modelImages = images.map((image) => ({
    bytes: new Uint8Array(image.bytes),
    mime: image.mime,
  }));
  let reason: string | undefined;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const instructions = extractionInstructions({
      imageCount: images.length,
      retryReason: reason,
    });
    const prompt = [
      instructions,
      `File name: ${fileName}`,
      skippedBig > 0
        ? `${skippedBig} photo${skippedBig === 1 ? "" : "s"} were too large to read. Use the ones attached.`
        : "",
      slideBlock
        ? `Text from the file:\n${slideBlock}`
        : images.length > 0
          ? "No plain text was available. Read the recipe from the attached photos."
          : "No text was extracted from this file.",
    ]
      .filter((line) => line.length > 0)
      .join("\n\n");
    const text = await askRecipeModel({ apiKey, prompt, images: modelImages });
    const verdict = validateRecipeJson(text);
    if (verdict.ok) return verdict.cards;
    reason = verdict.reason;
    console.warn("Card extract rejected", reason);
  }
  throw new Error(reason ?? "The recipe didn't come back in a usable shape.");
}

export const fromLink = action({
  args: {
    writerToken: v.optional(v.string()),
    kitchenId: v.optional(v.id("kitchens")),
    url: v.string(),
  },
  returns: extractReturn,
  handler: async (ctx, args) => {
    await ctx.runQuery(internal.sallyCredit.assertWriter, {
      writerToken: args.writerToken,
      kitchenId: args.kitchenId,
    });

    const url = args.url.trim();
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      return { cards: [], usedAi: false, rawText: "", skipped: true };
    }
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return { cards: [], usedAi: false, rawText: "", skipped: true };
    }
    if (kindFromUrl(url) === "sally") {
      return { cards: [], usedAi: false, rawText: "", skipped: true };
    }

    let html: string;
    try {
      const response = await fetch(parsed.toString(), {
        redirect: "follow",
        headers: { Accept: "text/html" },
        signal: AbortSignal.timeout(8000),
      });
      if (!response.ok) {
        return { cards: [], usedAi: false, rawText: "", readError: READ_MISSED_LINK };
      }
      html = (await response.text()).slice(0, 80_000);
    } catch (error) {
      logReadFailure("Link extract fetch failed", error);
      return { cards: [], usedAi: false, rawText: "", readError: READ_MISSED_LINK };
    }

    const fromPage = recipeFromHtml(html);
    const rawText = plainTextFromHtml(html).slice(0, 20_000);
    if (fromPage && (fromPage.ingredients.length > 0 || fromPage.steps.length > 0)) {
      return { cards: [fromPage], usedAi: false, rawText };
    }

    const apiKey = env.AI_GATEWAY_API_KEY?.trim();
    if (apiKey && rawText.length >= 40) {
      try {
        const cards = await cardsWithAi({
          apiKey,
          pages: [rawText],
          rawText,
          fileName: parsed.hostname,
          images: [],
          skippedBig: 0,
        });
        if (cards.length > 0) return { cards, usedAi: true, rawText };
      } catch (error) {
        logReadFailure("Link extract failed", error);
      }
    } else if (!apiKey) {
      console.warn("Link extract: AI_GATEWAY_API_KEY missing");
    }

    if (rawText.length >= 40) {
      const local = readRecipeText(rawText, parsed.hostname);
      if (
        local.ingredients.length > 0 &&
        local.steps.length > 0 &&
        local.steps.length <= 30 &&
        local.ingredients.length <= 40
      ) {
        return { cards: [local], usedAi: false, rawText };
      }
    }
    return {
      cards: [],
      usedAi: false,
      rawText,
      skipped: !apiKey,
      readError: READ_MISSED_LINK,
    };
  },
});

export const fromText = action({
  args: {
    writerToken: v.optional(v.string()),
    kitchenId: v.optional(v.id("kitchens")),
    text: v.string(),
  },
  returns: extractReturn,
  handler: async (ctx, args) => {
    await ctx.runQuery(internal.sallyCredit.assertWriter, {
      writerToken: args.writerToken,
      kitchenId: args.kitchenId,
    });
    const rawText = args.text.replace(/\r\n/g, "\n").slice(0, 20_000);
    if (rawText.trim().length < 8) {
      return { cards: [], usedAi: false, rawText, skipped: true };
    }
    const apiKey = env.AI_GATEWAY_API_KEY?.trim();
    if (apiKey) {
      try {
        const cards = await cardsWithAi({
          apiKey,
          pages: [rawText],
          rawText,
          fileName: "pasted recipe",
          images: [],
          skippedBig: 0,
        });
        if (cards.length > 0) return { cards, usedAi: true, rawText };
      } catch (error) {
        logReadFailure("Text extract failed", error);
      }
    }
    return { cards: [readRecipeText(rawText)], usedAi: false, rawText };
  },
});
