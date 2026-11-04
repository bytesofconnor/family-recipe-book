import { isSourceKind, type SourceKind } from "./sources";

export type ExtractedCard = {
  title: string;
  makes: string;
  ingredients: string[];
  steps: string[];
  notes: string;
  sourceKind: SourceKind;
  sourceTitle: string;
};

const STEP_HEAD = /^(how|steps?|directions?|method|instructions?)\b/i;
const ING_HEAD = /^(ingredients?|what went in|you need)\b/i;

export function cardFromText(raw: string, fileName?: string): ExtractedCard {
  const lines = raw
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s*[-*•\d.)]+\s*/, "").trim())
    .filter((line) => line.length > 0);

  const title = lines[0] ?? fileName?.replace(/\.[a-z0-9]+$/i, "") ?? "";
  const ingredients: string[] = [];
  const steps: string[] = [];
  let section: "ing" | "step" | "unk" = "unk";

  for (const line of lines.slice(1)) {
    if (ING_HEAD.test(line)) {
      section = "ing";
      continue;
    }
    if (STEP_HEAD.test(line)) {
      section = "step";
      continue;
    }
    if (section === "step") {
      steps.push(line);
      continue;
    }
    if (section === "ing" || /^[\d¼½¾⅓⅔]/.test(line) || line.length < 80) {
      ingredients.push(line);
      if (section === "unk" && ingredients.length >= 3) {
        section = "ing";
      }
      continue;
    }
    steps.push(line);
    section = "step";
  }

  return {
    title: title.replace(/\s+/g, " ").trim(),
    makes: "",
    ingredients,
    steps,
    notes: "",
    sourceKind: "original",
    sourceTitle: "",
  };
}

export function cardsFromPages(pages: string[], fileName?: string): ExtractedCard[] {
  const cards = pages
    .map((page) => cardFromText(page, fileName))
    .filter(
      (card) =>
        card.title.length > 0 &&
        card.ingredients.length + card.steps.length >= 2,
    );
  if (cards.length > 1) {
    return cards.slice(0, 24);
  }
  return [cardFromText(pages.join("\n\n"), fileName)];
}

export function parseCardsJson(text: string): ExtractedCard[] {
  const trimmed = text
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();
  const candidates = [trimmed];
  const fenced = trimmed.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
  if (fenced?.[0] && fenced[0] !== trimmed) {
    candidates.push(fenced[0]);
  }
  for (const candidate of candidates) {
    try {
      const parsed: unknown = JSON.parse(candidate);
      const rows = Array.isArray(parsed)
        ? parsed
        : parsed &&
            typeof parsed === "object" &&
            Array.isArray((parsed as { cards?: unknown }).cards)
          ? (parsed as { cards: unknown[] }).cards
          : parsed && typeof parsed === "object"
            ? [parsed]
            : [];
      const cards = rows
        .map((row) => cardFromUnknown(row))
        .filter((card): card is ExtractedCard => card !== null)
        .slice(0, 24);
      if (cards.length > 0) {
        return cards;
      }
    } catch {
      // try next candidate
    }
  }
  return [];
}

export function parseCardJson(text: string): ExtractedCard | null {
  return parseCardsJson(text)[0] ?? null;
}

function cardFromUnknown(parsed: unknown): ExtractedCard | null {
  if (!parsed || typeof parsed !== "object") {
    return null;
  }
  const row = parsed as Record<string, unknown>;
  const ingredients = asLines(row.ingredients);
  const steps = asLines(row.steps);
  const title = typeof row.title === "string" ? row.title.trim() : "";
  const notes = typeof row.notes === "string" ? row.notes.trim() : "";
  if (
    title.length === 0 &&
    ingredients.length === 0 &&
    steps.length === 0 &&
    notes.length === 0
  ) {
    return null;
  }
  const sourceKind = isSourceKind(row.sourceKind)
    ? row.sourceKind
    : "original";
  return {
    title,
    makes: typeof row.makes === "string" ? row.makes.trim() : "",
    ingredients,
    steps,
    notes,
    sourceKind,
    sourceTitle:
      typeof row.sourceTitle === "string" ? row.sourceTitle.trim() : "",
  };
}

function asLines(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .filter((line): line is string => typeof line === "string")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}
