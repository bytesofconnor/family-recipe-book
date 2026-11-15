import {
  formatIngredientLine,
  parseIngredientLine,
  type Confidence,
  type IngredientPart,
} from "./ingredientLine";
import { cardFromText } from "./cardFromText";
import { isSourceKind, type SourceKind } from "./sources";

export type FieldMarks = {
  title: Confidence;
  makes: Confidence;
  times: Confidence;
  notes: Confidence;
};

export type ReadCard = {
  title: string;
  makes: string;
  prepTime: string;
  cookTime: string;
  ingredients: string[];
  parts: IngredientPart[];
  steps: string[];
  stepConfidence: Confidence[];
  notes: string;
  sourceKind: SourceKind;
  sourceTitle: string;
  confidence: FieldMarks;
};

export type ModelVerdict =
  | { ok: true; cards: ReadCard[] }
  | { ok: false; reason: string };

const ING_HEAD = /^(ingredients?|what went in|you need)\b/i;
const STEP_HEAD = /^(how|steps?|directions?|method|instructions?)\b/i;
const NOTE_HEAD = /^(notes?|aside)\b/i;
const YIELD_HEAD = /^(serves|servings|yield|makes)\b[:\s-]*(.*)$/i;
const PREP_HEAD = /^(prep(?:aration)?(?:\s*time)?)\b[:\s-]*(.*)$/i;
const COOK_HEAD = /^(cook(?:ing)?(?:\s*time)?|bake(?:\s*time)?)\b[:\s-]*(.*)$/i;
const TOTAL_HEAD = /^(total(?:\s*time)?)\b[:\s-]*(.*)$/i;

function blankMarks(): FieldMarks {
  return { title: "low", makes: "low", times: "low", notes: "low" };
}

export function emptyReadCard(fileName?: string): ReadCard {
  const title = (fileName ?? "")
    .replace(/\.[a-z0-9]+$/i, "")
    .replace(/[-_]+/g, " ")
    .trim();
  return {
    title,
    makes: "",
    prepTime: "",
    cookTime: "",
    ingredients: [],
    parts: [],
    steps: [],
    stepConfidence: [],
    notes: "",
    sourceKind: "original",
    sourceTitle: "",
    confidence: blankMarks(),
  };
}

function clip(value: string, max: number): string {
  const trimmed = value.replace(/\s+/g, " ").trim();
  return trimmed.length > max ? trimmed.slice(0, max).trim() : trimmed;
}

function asConfidence(value: unknown): Confidence | null {
  return value === "high" || value === "low" ? value : null;
}

function asText(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
}

function asTime(value: unknown): string | null {
  if (typeof value === "number" && Number.isFinite(value) && value > 0 && value < 24 * 60) {
    return `${value} min`;
  }
  if (typeof value !== "string") return null;
  return clip(value, 80);
}

function mark(value: string, given: Confidence | null): Confidence {
  if (given) return given;
  return value.trim().length > 0 ? "high" : "low";
}

function partFromUnknown(value: unknown, index: number): IngredientPart | string | null {
  if (typeof value === "string") {
    const part = parseIngredientLine(value);
    if (part.line.length === 0) return null;
    return part;
  }
  if (!value || typeof value !== "object") {
    return `ingredient ${index + 1} must be a line or an object`;
  }
  const row = value as Record<string, unknown>;
  const item = asText(row.item) ?? asText(row.name) ?? "";
  const quantity = asText(row.quantity) ?? "";
  const unit = asText(row.unit) ?? "";
  if (item.trim().length === 0 && quantity.trim().length === 0) {
    return `ingredient ${index + 1} needs an item`;
  }
  const parsed = parseIngredientLine(
    formatIngredientLine({
      quantity: quantity.trim(),
      unit: unit.trim(),
      item: item.trim(),
    }),
  );
  const kept =
    parsed.item.length > 0
      ? parsed
      : {
          ...parsed,
          item: item.trim(),
          line: formatIngredientLine({
            quantity: parsed.quantity || quantity.trim(),
            unit: parsed.unit || unit.trim(),
            item: item.trim(),
          }),
        };
  const given = asConfidence(row.confidence);
  return {
    ...kept,
    confidence: given === "low" || kept.confidence === "low" ? "low" : "high",
  };
}

function stepFromUnknown(
  value: unknown,
  index: number,
): { text: string; confidence: Confidence } | string {
  if (typeof value === "string") {
    const text = value.replace(/^\s*\d+[.)]\s+/, "").trim();
    if (text.length === 0) return `step ${index + 1} is empty`;
    return { text, confidence: "high" };
  }
  if (!value || typeof value !== "object") {
    return `step ${index + 1} must be a line or an object`;
  }
  const row = value as Record<string, unknown>;
  const text = (asText(row.text) ?? asText(row.step) ?? "")
    .replace(/^\s*\d+[.)]\s+/, "")
    .trim();
  if (text.length === 0) return `step ${index + 1} needs text`;
  const given = asConfidence(row.confidence);
  return { text, confidence: given ?? "high" };
}

function cardFromRow(row: Record<string, unknown>, index: number): ReadCard | string {
  if (!Array.isArray(row.ingredients)) return `card ${index + 1} ingredients must be an array`;
  if (!Array.isArray(row.steps)) return `card ${index + 1} steps must be an array`;
  const title = asText(row.title);
  const makes = asText(row.makes);
  const notes = asText(row.notes);
  const prep = asTime(row.prepTime);
  const cook = asTime(row.cookTime);
  if (title === null || makes === null || notes === null) {
    return `card ${index + 1} title, makes, and notes must be text`;
  }
  if (prep === null && row.prepTime !== undefined && row.prepTime !== null) {
    return `card ${index + 1} prepTime must be text or minutes`;
  }
  if (cook === null && row.cookTime !== undefined && row.cookTime !== null) {
    return `card ${index + 1} cookTime must be text or minutes`;
  }
  const parts: IngredientPart[] = [];
  for (const [partIndex, value] of row.ingredients.entries()) {
    const part = partFromUnknown(value, partIndex);
    if (typeof part === "string") return `card ${index + 1} ${part}`;
    if (part) parts.push(part);
  }
  const steps: string[] = [];
  const stepConfidence: Confidence[] = [];
  for (const [stepIndex, value] of row.steps.entries()) {
    const step = stepFromUnknown(value, stepIndex);
    if (typeof step === "string") return `card ${index + 1} ${step}`;
    steps.push(step.text);
    stepConfidence.push(step.confidence);
  }
  const note = clip(notes, 400);
  const named = clip(title, 120);
  if (
    named.length === 0 &&
    parts.length === 0 &&
    steps.length === 0 &&
    note.length === 0
  ) {
    return `card ${index + 1} is empty`;
  }
  const sourceKind = isSourceKind(row.sourceKind) ? row.sourceKind : "original";
  const sourceTitle = clip(asText(row.sourceTitle) ?? "", 160);
  const given =
    row.confidence && typeof row.confidence === "object"
      ? (row.confidence as Record<string, unknown>)
      : {};
  const prepTime = prep ?? "";
  const cookTime = cook ?? "";
  return {
    title: named,
    makes: clip(makes, 80),
    prepTime,
    cookTime,
    ingredients: parts.map((part) => part.line),
    parts,
    steps,
    stepConfidence,
    notes: note,
    sourceKind,
    sourceTitle,
    confidence: {
      title: mark(named, asConfidence(given.title)),
      makes: mark(makes, asConfidence(given.makes)),
      times: mark(`${prepTime} ${cookTime}`, asConfidence(given.times)),
      notes: mark(note, asConfidence(given.notes)),
    },
  };
}

function jsonCandidates(text: string): string[] {
  const trimmed = text
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();
  const candidates = [trimmed];
  const fenced = trimmed.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
  if (fenced?.[0] && fenced[0] !== trimmed) candidates.push(fenced[0]);
  return candidates;
}

export function validateRecipeJson(text: string): ModelVerdict {
  let last = "the answer was not JSON";
  for (const candidate of jsonCandidates(text)) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(candidate);
    } catch {
      last = "the answer was not valid JSON";
      continue;
    }
    const rows = Array.isArray(parsed)
      ? parsed
      : parsed &&
          typeof parsed === "object" &&
          Array.isArray((parsed as { cards?: unknown }).cards)
        ? (parsed as { cards: unknown[] }).cards
        : parsed && typeof parsed === "object"
          ? [parsed]
          : null;
    if (!rows) {
      last = "the answer needs a cards array";
      continue;
    }
    if (rows.length === 0) {
      last = "cards is empty";
      continue;
    }
    const cards: ReadCard[] = [];
    for (const [index, row] of rows.slice(0, 12).entries()) {
      if (!row || typeof row !== "object") {
        return { ok: false, reason: `card ${index + 1} must be an object` };
      }
      const card = cardFromRow(row as Record<string, unknown>, index);
      if (typeof card === "string") return { ok: false, reason: card };
      cards.push(card);
    }
    if (cards.length === 0) return { ok: false, reason: "no usable card" };
    return { ok: true, cards };
  }
  return { ok: false, reason: last };
}

function normalizeYield(label: string, rest: string): string {
  const trimmed = rest.replace(/\s+/g, " ").trim();
  if (/^(?:about\s+)?\d+(?:\s+\d+\s*\/\s*\d+|\s*[½⅓⅔¼¾⅛⅜⅝⅞⅙⅚])?(?:\s*[-–—]\s*\d+)?$/i.test(trimmed)) {
    const servings = /serv/i.test(label);
    return servings ? `${trimmed} servings` : trimmed;
  }
  return trimmed;
}

function finishCard(input: {
  title: string;
  makes: string;
  prepTime: string;
  cookTime: string;
  ingredientLines: string[];
  steps: string[];
  notes: string;
  fileName?: string;
}): ReadCard {
  const parts = input.ingredientLines
    .map((line) => parseIngredientLine(line))
    .filter((part) => part.line.length > 0);
  const title = input.title.trim() || emptyReadCard(input.fileName).title;
  const steps = input.steps.map((step) => step.replace(/^\s*\d+[.)]\s+/, "").trim()).filter(Boolean);
  return {
    title,
    makes: clip(input.makes, 80),
    prepTime: clip(input.prepTime, 80),
    cookTime: clip(input.cookTime, 80),
    ingredients: parts.map((part) => part.line),
    parts,
    steps,
    stepConfidence: steps.map(() => "high" as const),
    notes: clip(input.notes, 400),
    sourceKind: "original",
    sourceTitle: "",
    confidence: {
      title: title.length >= 2 ? "high" : "low",
      makes: input.makes.trim().length > 0 ? "high" : "low",
      times:
        input.prepTime.trim().length > 0 || input.cookTime.trim().length > 0
          ? "high"
          : "low",
      notes: input.notes.trim().length > 0 ? "high" : "low",
    },
  };
}

export function readRecipeText(raw: string, fileName?: string): ReadCard {
  const lines = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  let title = "";
  let makes = "";
  let prepTime = "";
  let cookTime = "";
  let section: "unk" | "ing" | "step" | "note" = "unk";
  let sawHead = false;
  const ingredientLines: string[] = [];
  const steps: string[] = [];
  const notes: string[] = [];

  for (const line of lines) {
    const yieldHit = YIELD_HEAD.exec(line);
    if (yieldHit && (yieldHit[2] ?? "").trim().length > 0) {
      makes = makes || normalizeYield(yieldHit[1] ?? "", yieldHit[2] ?? "");
      sawHead = true;
      continue;
    }
    const prepHit = PREP_HEAD.exec(line);
    if (prepHit) {
      prepTime = prepTime || (prepHit[2] ?? "").trim();
      sawHead = true;
      continue;
    }
    const cookHit = COOK_HEAD.exec(line);
    if (cookHit) {
      cookTime = cookTime || (cookHit[2] ?? "").trim();
      sawHead = true;
      continue;
    }
    const totalHit = TOTAL_HEAD.exec(line);
    if (totalHit && cookTime.length === 0 && prepTime.length === 0) {
      cookTime = (totalHit[2] ?? "").trim();
      sawHead = true;
      continue;
    }
    if (ING_HEAD.test(line)) {
      section = "ing";
      sawHead = true;
      continue;
    }
    if (STEP_HEAD.test(line)) {
      section = "step";
      sawHead = true;
      continue;
    }
    if (NOTE_HEAD.test(line)) {
      section = "note";
      sawHead = true;
      const rest = line.replace(NOTE_HEAD, "").replace(/^[:\s-]+/, "").trim();
      if (rest.length > 0) notes.push(rest);
      continue;
    }
    if (!title && section === "unk") {
      title = line.replace(/^\s*\d+[.)]\s+/, "");
      continue;
    }
    if (section === "step") {
      steps.push(line);
      continue;
    }
    if (section === "note") {
      notes.push(line);
      continue;
    }
    if (section === "ing") {
      ingredientLines.push(line);
    }
  }

  if (sawHead && (ingredientLines.length > 0 || steps.length > 0 || title.length > 0)) {
    return finishCard({
      title,
      makes,
      prepTime,
      cookTime,
      ingredientLines,
      steps,
      notes: notes.join(" "),
      fileName,
    });
  }

  const loose = cardFromText(raw, fileName);
  return finishCard({
    title: loose.title,
    makes,
    prepTime,
    cookTime,
    ingredientLines: loose.ingredients,
    steps: loose.steps,
    notes: loose.notes,
    fileName,
  });
}

export function readRecipePages(pages: string[], fileName?: string): ReadCard[] {
  const cards = pages
    .map((page) => readRecipeText(page, fileName))
    .filter(
      (card) =>
        card.title.length > 0 && card.ingredients.length + card.steps.length >= 2,
    );
  if (cards.length > 1) return cards.slice(0, 12);
  return [readRecipeText(pages.join("\n\n"), fileName)];
}

function durationPhrase(value: string): string {
  const match = /^P(?:T(?:(\d+)H)?(?:(\d+)M)?)$/i.exec(value.trim());
  if (!match) return clip(value, 80);
  const hours = Number(match[1] ?? 0);
  const minutes = Number(match[2] ?? 0);
  const bits: string[] = [];
  if (hours > 0) bits.push(hours === 1 ? "1 hr" : `${hours} hr`);
  if (minutes > 0) bits.push(`${minutes} min`);
  return bits.join(" ") || clip(value, 80);
}

function yieldText(value: unknown): string {
  if (typeof value === "string") return clip(value, 80);
  if (typeof value === "number" && Number.isFinite(value)) return `Serves ${value}`;
  if (Array.isArray(value)) {
    return clip(value.filter((bit) => typeof bit === "string").join(", "), 80);
  }
  return "";
}

function instructionText(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap((item) => instructionText(item));
  if (!value || typeof value !== "object") return [];
  const row = value as Record<string, unknown>;
  if (Array.isArray(row.itemListElement)) return instructionText(row.itemListElement);
  const text = asText(row.text);
  return text ? [text] : [];
}

function recipeNode(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  const type = row["@type"];
  const types = Array.isArray(type) ? type : [type];
  if (types.some((entry) => entry === "Recipe")) return row;
  if (Array.isArray(row["@graph"])) {
    for (const node of row["@graph"]) {
      const found = recipeNode(node);
      if (found) return found;
    }
  }
  return null;
}

export function recipeFromHtml(html: string): ReadCard | null {
  const blocks = [...html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  for (const block of blocks) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(block[1] ?? "");
    } catch {
      continue;
    }
    const nodes = Array.isArray(parsed) ? parsed : [parsed];
    for (const node of nodes) {
      const recipe = recipeNode(node);
      if (!recipe) continue;
      const ingredients = Array.isArray(recipe.recipeIngredient)
        ? recipe.recipeIngredient.filter((line): line is string => typeof line === "string")
        : [];
      const steps = instructionText(recipe.recipeInstructions);
      const notes =
        typeof recipe.description === "string" && recipe.description.length <= 280
          ? recipe.description
          : "";
      const card = finishCard({
        title: typeof recipe.name === "string" ? recipe.name : "",
        makes: yieldText(recipe.recipeYield),
        prepTime:
          typeof recipe.prepTime === "string" ? durationPhrase(recipe.prepTime) : "",
        cookTime:
          typeof recipe.cookTime === "string" ? durationPhrase(recipe.cookTime) : "",
        ingredientLines: ingredients,
        steps,
        notes,
      });
      if (card.title.length > 0 || card.ingredients.length > 0) return card;
    }
  }
  return null;
}

export function plainTextFromHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<\/(p|div|li|h1|h2|h3|tr|br|section)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

export function extractionInstructions(input: {
  imageCount: number;
  retryReason?: string;
}): string {
  const framing =
    input.imageCount > 1
      ? "Several photos were sent together. Treat the front and back of a card as one recipe unless you clearly see separate recipes."
      : input.imageCount === 1
        ? "This is a photo or scan of a recipe card, a cookbook page, or a screen. Read handwriting and print, including messy columns."
        : "A PDF, PowerPoint, pasted note, or web page may hold one recipe or many. One card per recipe.";
  const retry = input.retryReason
    ? `The last answer was rejected because ${input.retryReason}. Return only corrected JSON.`
    : "";
  return [
    "Extract home-cook recipe cards for a private family recipe book.",
    framing,
    "Skip title slides, indexes, and pages with no recipe words.",
    "Return ONLY valid JSON, no markdown fences:",
    '{"cards":[{"title":"","makes":"","prepTime":"","cookTime":"","ingredients":[{"quantity":"1/2","unit":"cup","item":"sugar","confidence":"high"}],"steps":[{"text":"Stir.","confidence":"high"}],"notes":"","sourceKind":"original","sourceTitle":"","confidence":{"title":"high","makes":"high","times":"high","notes":"high"}}]}',
    "ingredients is an array. Each ingredient has quantity (the amount as printed, including 1/2, 1½, or 1-2, or empty), unit (a cooking unit, or empty), and item (the food, without the amount).",
    "Fractions stay exact. Do not turn 1/2 into 0.5. A line with no amount still needs an item.",
    "steps is an array of short numbered actions without the leading number.",
    "makes is the yield or servings. prepTime and cookTime are short, or empty. notes is one short aside, or empty.",
    "confidence is high or low. Use low when handwriting or the layout makes a field uncertain.",
    "sourceKind must be sally, original, family, friend, book, tiktok, or pinterest.",
    "A handwritten or typed family card is family. A friend is friend. Another cookbook is book. Otherwise original.",
    "Do not invent ingredients, steps, times, or notes that are not visible. Maximum 12 cards.",
    retry,
  ]
    .filter((line) => line.length > 0)
    .join(" ");
}
