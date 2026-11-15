export type Confidence = "high" | "low";

export type IngredientPart = {
  quantity: string;
  unit: string;
  item: string;
  line: string;
  confidence: Confidence;
};

const UNICODE_VALUE: Record<string, number> = {
  "½": 1 / 2,
  "⅓": 1 / 3,
  "⅔": 2 / 3,
  "¼": 1 / 4,
  "¾": 3 / 4,
  "⅛": 1 / 8,
  "⅜": 3 / 8,
  "⅝": 5 / 8,
  "⅞": 7 / 8,
  "⅙": 1 / 6,
  "⅚": 5 / 6,
};

const UNICODE_CHARS = Object.keys(UNICODE_VALUE).join("");
const UNICODE_CLASS = `[${UNICODE_CHARS}]`;

const GLYPHS: Record<string, string> = {
  "1/2": "½",
  "1/3": "⅓",
  "2/3": "⅔",
  "1/4": "¼",
  "3/4": "¾",
  "1/8": "⅛",
  "3/8": "⅜",
  "5/8": "⅝",
  "7/8": "⅞",
  "1/6": "⅙",
  "5/6": "⅚",
};

const FRACTION_TOLERANCE = 0.02;

const PLURAL: Record<string, string> = {
  cup: "cups",
  teaspoon: "teaspoons",
  tablespoon: "tablespoons",
  ounce: "ounces",
  pound: "pounds",
  gram: "grams",
  kilogram: "kilograms",
  milliliter: "milliliters",
  liter: "liters",
  pinch: "pinches",
  dash: "dashes",
  clove: "cloves",
  stick: "sticks",
  can: "cans",
  package: "packages",
  slice: "slices",
  bunch: "bunches",
  sprig: "sprigs",
  head: "heads",
  quart: "quarts",
  pint: "pints",
  gallon: "gallons",
  inch: "inches",
  handful: "handfuls",
};

const SINGULAR: Record<string, string> = Object.fromEntries(
  Object.entries(PLURAL).map(([singular, plural]) => [plural, singular]),
);

const UNIT_ROWS = [
  ["tablespoons", "tablespoon"],
  ["tablespoon", "tablespoon"],
  ["teaspoons", "teaspoon"],
  ["teaspoon", "teaspoon"],
  ["tbsp.", "tablespoon"],
  ["tbsp", "tablespoon"],
  ["tbs.", "tablespoon"],
  ["tbs", "tablespoon"],
  ["tsp.", "teaspoon"],
  ["tsp", "teaspoon"],
  ["ounces", "ounce"],
  ["ounce", "ounce"],
  ["pounds", "pound"],
  ["pound", "pound"],
  ["grams", "gram"],
  ["gram", "gram"],
  ["kilograms", "kilogram"],
  ["kilogram", "kilogram"],
  ["milliliters", "milliliter"],
  ["milliliter", "milliliter"],
  ["liters", "liter"],
  ["liter", "liter"],
  ["pinches", "pinch"],
  ["pinch", "pinch"],
  ["dashes", "dash"],
  ["dash", "dash"],
  ["cloves", "clove"],
  ["clove", "clove"],
  ["sticks", "stick"],
  ["stick", "stick"],
  ["packages", "package"],
  ["package", "package"],
  ["slices", "slice"],
  ["slice", "slice"],
  ["bunches", "bunch"],
  ["bunch", "bunch"],
  ["sprigs", "sprig"],
  ["sprig", "sprig"],
  ["handfuls", "handful"],
  ["handful", "handful"],
  ["heads", "head"],
  ["head", "head"],
  ["quarts", "quart"],
  ["quart", "quart"],
  ["pints", "pint"],
  ["pint", "pint"],
  ["gallons", "gallon"],
  ["gallon", "gallon"],
  ["inches", "inch"],
  ["inch", "inch"],
  ["cups", "cup"],
  ["cup", "cup"],
  ["cans", "can"],
  ["can", "can"],
  ["lbs.", "pound"],
  ["lbs", "pound"],
  ["lb.", "pound"],
  ["lb", "pound"],
  ["oz.", "ounce"],
  ["oz", "ounce"],
  ["kg.", "kilogram"],
  ["kg", "kilogram"],
  ["ml.", "milliliter"],
  ["ml", "milliliter"],
  ["qt.", "quart"],
  ["qt", "quart"],
  ["pt.", "pint"],
  ["pt", "pint"],
  ["pkg.", "package"],
  ["pkg", "package"],
  ["c.", "cup"],
  ["c", "cup"],
  ["g.", "gram"],
  ["g", "gram"],
  ["l.", "liter"],
  ["l", "liter"],
] as const;

const UNIT_FORMS: Array<{ form: string; unit: string }> = UNIT_ROWS.map(
  ([form, unit]) => ({ form, unit }),
);

const WORD_AMOUNT: Record<string, number> = {
  half: 1 / 2,
  quarter: 1 / 4,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
};

type AmountHit = { value: number; end: number };

function fractionValue(numerator: number, denominator: number): number | null {
  if (denominator === 0) return null;
  return numerator / denominator;
}

function isBoundary(text: string, index: number): boolean {
  if (index >= text.length) return true;
  return /\s/u.test(text[index] ?? "");
}

function readTightMixed(slice: string): AmountHit | null {
  const ascii = /^(\d+)-(\d+)\s*\/\s*(\d+)/.exec(slice);
  if (ascii) {
    const part = fractionValue(Number(ascii[2]), Number(ascii[3]));
    if (part !== null && part < 1) {
      return { value: Number(ascii[1]) + part, end: ascii[0].length };
    }
  }
  const glyph = new RegExp(`^(\\d+)-(${UNICODE_CLASS})`).exec(slice);
  if (glyph) {
    const part = UNICODE_VALUE[glyph[2] ?? ""];
    if (part !== undefined && part < 1) {
      return { value: Number(glyph[1]) + part, end: glyph[0].length };
    }
  }
  return null;
}

function readAmount(text: string, start: number): AmountHit | null {
  const slice = text.slice(start);
  const glued = new RegExp(`^(\\d+)(${UNICODE_CLASS})`).exec(slice);
  if (glued) {
    const part = UNICODE_VALUE[glued[2] ?? ""];
    if (part !== undefined) {
      return { value: Number(glued[1]) + part, end: start + glued[0].length };
    }
  }
  const spacedGlyph = new RegExp(`^(\\d+)\\s+(${UNICODE_CLASS})`).exec(slice);
  if (spacedGlyph) {
    const part = UNICODE_VALUE[spacedGlyph[2] ?? ""];
    if (part !== undefined) {
      return {
        value: Number(spacedGlyph[1]) + part,
        end: start + spacedGlyph[0].length,
      };
    }
  }
  const spacedAscii = /^(\d+)\s+(\d+)\s*\/\s*(\d+)/.exec(slice);
  if (spacedAscii) {
    const part = fractionValue(Number(spacedAscii[2]), Number(spacedAscii[3]));
    if (part !== null) {
      return {
        value: Number(spacedAscii[1]) + part,
        end: start + spacedAscii[0].length,
      };
    }
  }
  const tight = readTightMixed(slice);
  if (tight) return { value: tight.value, end: start + tight.end };
  const ascii = /^(\d+)\s*\/\s*(\d+)/.exec(slice);
  if (ascii) {
    const part = fractionValue(Number(ascii[1]), Number(ascii[2]));
    if (part !== null) return { value: part, end: start + ascii[0].length };
  }
  const decimal = /^(?:\d+\.\d+|\.\d+)/.exec(slice);
  if (decimal) {
    return { value: Number(decimal[0]), end: start + decimal[0].length };
  }
  const lone = new RegExp(`^(${UNICODE_CLASS})`).exec(slice);
  if (lone) {
    const part = UNICODE_VALUE[lone[1] ?? ""];
    if (part !== undefined) {
      return { value: part, end: start + lone[0].length };
    }
  }
  const integer = /^(\d+)/.exec(slice);
  if (integer) {
    return { value: Number(integer[1]), end: start + integer[0].length };
  }
  return null;
}

function readRangeSeparator(
  text: string,
  start: number,
): { raw: string; end: number } | null {
  const slice = text.slice(start);
  const dash = /^\s*[-–—]\s*/.exec(slice);
  if (dash) return { raw: dash[0], end: start + dash[0].length };
  const word = /^\s+to\s+/i.exec(slice);
  if (word) return { raw: word[0], end: start + word[0].length };
  return null;
}

type Leading = {
  end: number;
  low: number;
  high: number | null;
  separator: string | null;
};

function readLeadingAmount(text: string): Leading | null {
  const first = readAmount(text, 0);
  if (!first) return null;
  const separator = readRangeSeparator(text, first.end);
  if (separator) {
    const second = readAmount(text, separator.end);
    if (second && isBoundary(text, second.end)) {
      return {
        end: second.end,
        low: first.value,
        high: second.value,
        separator: separator.raw,
      };
    }
  }
  if (!isBoundary(text, first.end) && !matchUnit(text.slice(first.end))) {
    return null;
  }
  return { end: first.end, low: first.value, high: null, separator: null };
}

function friendlyFraction(fraction: number): string | null {
  const denominators = [2, 3, 4, 6, 8, 16];
  let best: { key: string; err: number } | null = null;
  for (const denominator of denominators) {
    const numerator = Math.round(fraction * denominator);
    if (numerator <= 0 || numerator >= denominator) continue;
    const err = Math.abs(fraction - numerator / denominator);
    if (err <= FRACTION_TOLERANCE && (best === null || err < best.err)) {
      best = { key: `${numerator}/${denominator}`, err };
    }
  }
  if (!best) return null;
  return GLYPHS[best.key] ?? best.key;
}

function formatAmount(value: number): string {
  if (!Number.isFinite(value) || value < 0) return "";
  const nearestWhole = Math.round(value);
  if (Math.abs(value - nearestWhole) < 0.01) return String(nearestWhole);
  const whole = Math.floor(value);
  const piece = friendlyFraction(value - whole);
  if (!piece) return String(Math.round(value * 100) / 100);
  return whole === 0 ? piece : `${whole} ${piece}`;
}

function formatRange(low: number, high: number, separator: string): string {
  const left = formatAmount(low);
  const right = formatAmount(high);
  const mixed = left.includes(" ") || right.includes(" ");
  if (/to/i.test(separator) || mixed) return `${left} to ${right}`;
  const dash = separator.includes("–")
    ? "–"
    : separator.includes("—")
      ? "—"
      : "-";
  return /\s/.test(separator) ? `${left} ${dash} ${right}` : `${left}${dash}${right}`;
}

function formatQuantity(leading: Leading): string {
  if (leading.high === null) return formatAmount(leading.low);
  return formatRange(leading.low, leading.high, leading.separator ?? "-");
}

function wantsSingular(quantity: string, isRange: boolean): boolean {
  if (isRange) return false;
  if (quantity === "1") return true;
  if (quantity.includes(" ")) return false;
  return !/^\d+$/.test(quantity);
}

function displayUnit(unit: string, quantity: string, isRange: boolean): string {
  if (unit.length === 0) return "";
  const singular = SINGULAR[unit] ?? unit;
  const plural = PLURAL[singular] ?? `${singular}s`;
  return wantsSingular(quantity, isRange) ? singular : plural;
}

function matchUnit(rest: string): { unit: string; end: number } | null {
  const lower = rest.toLowerCase();
  let best: { unit: string; end: number } | null = null;
  for (const entry of UNIT_FORMS) {
    if (!lower.startsWith(entry.form)) continue;
    const end = entry.form.length;
    const next = rest[end] ?? "";
    if (next.length > 0 && !/[\s.,)]/.test(next)) continue;
    if (best === null || end > best.end) best = { unit: entry.unit, end };
  }
  return best;
}

function cleanItem(rest: string): string {
  return rest
    .replace(/^[\s,.)]+/, "")
    .replace(/^(?:of)\s+/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function wholeLine(raw: string, confidence: Confidence): IngredientPart {
  const item = raw.replace(/\s+/g, " ").trim();
  return { quantity: "", unit: "", item, line: item, confidence };
}

function stripMarker(raw: string): string {
  return raw
    .trim()
    .replace(/^[-*•]\s+/, "")
    .replace(/^\(\d+\)\s+/, "")
    .replace(/^\d+\)\s+/, "")
    .replace(/^\d+\.\s+/, "")
    .trim();
}

function readWordAmount(text: string): Leading | null {
  const match = /^([A-Za-z]+)\b/.exec(text);
  if (!match) return null;
  const word = match[1]?.toLowerCase() ?? "";
  const value = WORD_AMOUNT[word];
  if (value === undefined) return null;
  const end = match[0].length;
  if (!isBoundary(text, end)) return null;
  return { end, low: value, high: null, separator: null };
}

function articleAmount(text: string): Leading | null {
  const match = /^(a|an)\b/i.exec(text);
  if (!match) return null;
  const rest = text.slice(match[0].length);
  if (!/^\s/.test(rest)) return null;
  const unit = matchUnit(rest.trimStart());
  if (!unit) return null;
  return { end: match[0].length, low: 1, high: null, separator: null };
}

export function formatIngredientLine(part: {
  quantity: string;
  unit: string;
  item: string;
}): string {
  const quantity = part.quantity.trim();
  const isRange = /\s+to\s+|[-–—]/i.test(quantity);
  const unit = displayUnit(part.unit.trim().toLowerCase(), quantity, isRange);
  const item = part.item.replace(/\s+/g, " ").trim();
  return [quantity, unit, item].filter((bit) => bit.length > 0).join(" ");
}

export function parseIngredientLine(raw: string): IngredientPart {
  const text = stripMarker(raw.replace(/\s+/g, " "));
  if (text.length === 0) {
    return { quantity: "", unit: "", item: "", line: "", confidence: "low" };
  }
  const article = articleAmount(text);
  const word = article ?? readWordAmount(text);
  const numeric = word ?? readLeadingAmount(text);
  if (!numeric) {
    const buried = /\d/.test(text);
    return wholeLine(text, buried ? "low" : "high");
  }
  const rest = text.slice(numeric.end);
  const spaced = /^\s*/.exec(rest)?.[0].length ?? 0;
  const unitHit = matchUnit(rest.slice(spaced));
  const afterUnit = unitHit
    ? rest.slice(spaced + unitHit.end)
    : rest;
  const item = cleanItem(afterUnit);
  const quantity = formatQuantity(numeric);
  const unit = unitHit?.unit ?? "";
  const line = formatIngredientLine({ quantity, unit, item });
  const confidence: Confidence =
    item.length === 0 || (unit.length === 0 && /\d/.test(item)) ? "low" : "high";
  return { quantity, unit, item, line, confidence };
}

export function partsFromLines(lines: readonly string[]): IngredientPart[] {
  return lines
    .map((line) => parseIngredientLine(line))
    .filter((part) => part.line.length > 0 || part.item.length > 0);
}
