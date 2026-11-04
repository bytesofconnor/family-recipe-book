"use node";

import { createGateway, generateText } from "ai";
import { v } from "convex/values";
import JSZip from "jszip";
import { extractText, getDocumentProxy } from "unpdf";
import { action, env } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import {
  cardFromText,
  cardsFromPages,
  parseCardsJson,
  type ExtractedCard,
} from "./lib/cardFromText";
import { kindFromUrl, sourceKindValidator } from "./lib/sources";

const cardFields = {
  title: v.string(),
  makes: v.string(),
  ingredients: v.array(v.string()),
  steps: v.array(v.string()),
  notes: v.optional(v.string()),
  sourceKind: sourceKindValidator,
  sourceTitle: v.string(),
};

const extractReturn = v.object({
  cards: v.array(v.object(cardFields)),
  usedAi: v.boolean(),
  rawText: v.string(),
  skipped: v.optional(v.boolean()),
});

const MAX_SCAN_IMAGES = 6;
const MAX_SCAN_BYTES = 1_500_000;

const scanFile = v.object({
  storageId: v.id("_storage"),
  fileName: v.string(),
  mimeType: v.string(),
});

/** Vision-capable free-tier models for recipe photos / scans. */
const EXTRACT_MODEL = "google/gemini-2.5-flash";
const EXTRACT_FALLBACKS = [
  "google/gemini-2.5-flash-lite",
  "openai/gpt-4o-mini",
] as const;

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
    cards: ExtractedCard[];
    usedAi: boolean;
    rawText: string;
    skipped?: boolean;
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
    for (const file of loaded) {
      if (file.isImage) {
        if (file.bytes.byteLength > MAX_SCAN_BYTES) {
          skippedBig += 1;
          continue;
        }
        images.push({
          bytes: file.bytes,
          mime: file.mime || "image/jpeg",
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
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error("Card extract failed", message);
      }
    } else if (!apiKey) {
      console.warn("Card extract: AI_GATEWAY_API_KEY missing");
    }

    if (onlyImages) {
      return {
        cards: [emptyCard(args.fileName)],
        usedAi: false,
        rawText,
        skipped: !apiKey,
      };
    }
    if (rawText.trim().length > 0) {
      const fallback =
        pages.length > 1
          ? cardsFromPages(pages, args.fileName)
          : [cardFromText(rawText, args.fileName)];
      return { cards: fallback, usedAi: false, rawText };
    }
    return { cards: [emptyCard(args.fileName)], usedAi: false, rawText };
  },
});

function emptyCard(fileName: string): ExtractedCard {
  return {
    title: fileName.replace(/\.[a-z0-9]+$/i, "").replace(/[-_]+/g, " ").trim(),
    makes: "",
    ingredients: [],
    steps: [],
    notes: "",
    sourceKind: "original",
    sourceTitle: "",
  };
}

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
}): Promise<ExtractedCard[]> {
  const gateway = createGateway({ apiKey });
  const slideBlock =
    pages.length > 1
      ? pages
          .map((page, index) => `--- Page ${index + 1} ---\n${page}`)
          .join("\n\n")
          .slice(0, 24_000)
      : rawText.slice(0, 24_000);
  const several = images.length > 1;
  const instructions = [
    "Extract home-cook recipe cards from this private family recipe book file.",
    several
      ? "Several photos were sent together. Treat them as one recipe and combine the title, ingredients, steps, and notes across the photos, unless you clearly see separate recipes."
      : images.length === 1
        ? "This is a photo or scan of a recipe. Read the handwriting or print. Pull the title, yield, ingredients, steps, and any short note written on the card."
        : "A PDF, PowerPoint, or text packet may have many recipes — one card per recipe, not one mashed card.",
    "Skip title slides, indexes, and pages with no recipe words.",
    "Return ONLY valid JSON (no markdown fences): {\"cards\":[{\"title\":\"\",\"makes\":\"\",\"ingredients\":[\"\"],\"steps\":[\"\"],\"notes\":\"\",\"sourceKind\":\"original\",\"sourceTitle\":\"\"}]}",
    "Maximum 12 cards. ingredients and steps are short lines. notes is one short aside, or empty.",
    "sourceKind must be sally, original, family, friend, book, tiktok, or pinterest.",
    "Do not invent ingredients, steps, or notes that are not visible.",
    "If it is a handwritten or typed family card, sourceKind is family. If a friend sent it, friend. If it is from another cookbook, book. TikTok or Pinterest if that is clear.",
    "Otherwise original. Do not copy a long article. Short lines only.",
  ].join(" ");

  const content: Array<
    | { type: "text"; text: string }
    | { type: "image"; image: Uint8Array; mediaType?: string }
  > = [
    {
      type: "text",
      text: [
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
        .join("\n\n"),
    },
  ];
  for (const image of images) {
    content.push({
      type: "image",
      image: new Uint8Array(image.bytes),
      mediaType: image.mime || "image/jpeg",
    });
  }

  const { text } = await generateText({
    model: gateway(EXTRACT_MODEL),
    messages: [{ role: "user", content }],
    providerOptions: {
      gateway: {
        tags: ["feature:card-extract"],
        models: [...EXTRACT_FALLBACKS],
      },
    },
  });

  return parseCardsJson(text);
}

function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
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

    const apiKey = env.AI_GATEWAY_API_KEY?.trim();
    if (!apiKey) {
      console.warn("Link extract: AI_GATEWAY_API_KEY missing");
      return { cards: [], usedAi: false, rawText: "", skipped: true };
    }

    let rawText: string;
    try {
      const response = await fetch(parsed.toString(), {
        redirect: "follow",
        headers: { Accept: "text/html" },
        signal: AbortSignal.timeout(8000),
      });
      if (!response.ok) {
        return { cards: [], usedAi: false, rawText: "" };
      }
      const html = (await response.text()).slice(0, 60_000);
      rawText = htmlToText(html).slice(0, 20_000);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error("Link extract fetch failed", message);
      return { cards: [], usedAi: false, rawText: "" };
    }

    if (rawText.length < 40) {
      return { cards: [], usedAi: false, rawText };
    }

    try {
      const cards = await cardsWithAi({
        apiKey,
        pages: [rawText],
        rawText,
        fileName: parsed.hostname,
        images: [],
        skippedBig: 0,
      });
      return { cards, usedAi: cards.length > 0, rawText };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error("Link extract failed", message);
      return { cards: [], usedAi: false, rawText };
    }
  },
});
