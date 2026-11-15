export const SCALE_FACTORS = [0.5, 1, 2] as const;
export type ScaleFactor = (typeof SCALE_FACTORS)[number];

export const SCALE_CHOICES: readonly {
  factor: ScaleFactor;
  label: string;
}[] = [
  { factor: 0.5, label: "½×" },
  { factor: 1, label: "1×" },
  { factor: 2, label: "2×" },
];

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

const PLURAL_OF: Record<string, string> = {
  cup: "cups",
  teaspoon: "teaspoons",
  tablespoon: "tablespoons",
  egg: "eggs",
  clove: "cloves",
  ounce: "ounces",
  pound: "pounds",
  gram: "grams",
  kilogram: "kilograms",
  stick: "sticks",
  muffin: "muffins",
  cookie: "cookies",
  serving: "servings",
  loaf: "loaves",
  batch: "batches",
  pinch: "pinches",
  can: "cans",
  package: "packages",
  slice: "slices",
};

const SINGULAR_OF: Record<string, string> = Object.fromEntries(
  Object.entries(PLURAL_OF).map(([singular, plural]) => [plural, singular]),
);

type AmountHit = { value: number; end: number };

function isAmountBoundary(text: string, index: number): boolean {
  if (index >= text.length) return true;
  return /\s/u.test(text[index] ?? "");
}

function fractionValue(numerator: number, denominator: number): number | null {
  if (denominator === 0) return null;
  return numerator / denominator;
}

function readTightMixed(slice: string): AmountHit | null {
  const ascii = /^(\d+)-(\d+)\s*\/\s*(\d+)/.exec(slice);
  if (ascii) {
    const whole = Number(ascii[1]);
    const numerator = Number(ascii[2]);
    const denominator = Number(ascii[3]);
    const part = fractionValue(numerator, denominator);
    if (part !== null && part < 1) {
      return { value: whole + part, end: ascii[0].length };
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
  if (tight) {
    return { value: tight.value, end: start + tight.end };
  }

  const ascii = /^(\d+)\s*\/\s*(\d+)/.exec(slice);
  if (ascii) {
    const part = fractionValue(Number(ascii[1]), Number(ascii[2]));
    if (part !== null) {
      return { value: part, end: start + ascii[0].length };
    }
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
  if (dash) {
    return { raw: dash[0], end: start + dash[0].length };
  }
  const word = /^\s+to\s+/i.exec(slice);
  if (word) {
    return { raw: word[0], end: start + word[0].length };
  }
  return null;
}

type Leading = {
  start: number;
  end: number;
  low: number;
  high: number | null;
  separator: string | null;
};

function readLeading(text: string): Leading | null {
  const leadingSpace = /^\s*/.exec(text);
  const start = leadingSpace?.[0].length ?? 0;
  const first = readAmount(text, start);
  if (!first) return null;

  const separator = readRangeSeparator(text, first.end);
  if (separator) {
    const second = readAmount(text, separator.end);
    if (second && isAmountBoundary(text, second.end)) {
      return {
        start,
        end: second.end,
        low: first.value,
        high: second.value,
        separator: separator.raw,
      };
    }
  }

  if (!isAmountBoundary(text, first.end)) return null;
  return {
    start,
    end: first.end,
    low: first.value,
    high: null,
    separator: null,
  };
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

export function formatAmount(value: number): string {
  if (!Number.isFinite(value) || value < 0) return "";
  const nearestWhole = Math.round(value);
  if (Math.abs(value - nearestWhole) < 0.01) {
    return String(nearestWhole);
  }
  const whole = Math.floor(value);
  const piece = friendlyFraction(value - whole);
  if (!piece) {
    const rounded = Math.round(value * 100) / 100;
    return String(rounded);
  }
  return whole === 0 ? piece : `${whole} ${piece}`;
}

function matchCase(sample: string, next: string): string {
  if (sample[0] === sample[0]?.toUpperCase()) {
    return next[0]!.toUpperCase() + next.slice(1);
  }
  return next;
}

function wantsSingular(formatted: string, isRange: boolean): boolean {
  if (isRange) return false;
  if (formatted === "1") return true;
  if (formatted.includes(" ")) return false;
  return !/^\d+$/.test(formatted);
}

function withUnit(rest: string, formatted: string, isRange: boolean): string {
  const match = /^(\s+)([A-Za-z]+)/.exec(rest);
  if (!match) return rest;
  const word = match[2] ?? "";
  const lower = word.toLowerCase();
  const replacement = wantsSingular(formatted, isRange)
    ? SINGULAR_OF[lower]
    : PLURAL_OF[lower];
  if (!replacement || replacement === lower) return rest;
  const cased = matchCase(word, replacement);
  return match[1] + cased + rest.slice(match[0].length);
}

function formatRange(low: number, high: number, separator: string): string {
  const left = formatAmount(low);
  const right = formatAmount(high);
  const mixed = left.includes(" ") || right.includes(" ");
  if (/to/i.test(separator) || mixed) {
    return `${left} to ${right}`;
  }
  const dash = separator.includes("–")
    ? "–"
    : separator.includes("—")
      ? "—"
      : "-";
  return /\s/.test(separator) ? `${left} ${dash} ${right}` : `${left}${dash}${right}`;
}

export function scaleAmountText(text: string, factor: ScaleFactor): string {
  if (factor === 1) return text;
  const leading = readLeading(text);
  if (!leading) return text;
  const next =
    leading.high === null
      ? formatAmount(leading.low * factor)
      : formatRange(
          leading.low * factor,
          leading.high * factor,
          leading.separator ?? "-",
        );
  if (next.length === 0) return text;
  const rest = withUnit(text.slice(leading.end), next, leading.high !== null);
  return text.slice(0, leading.start) + next + rest;
}

function lineChanges(text: string, factor: ScaleFactor): boolean {
  if (factor === 1) return false;
  const trimmed = text.trim();
  if (trimmed.length === 0) return false;
  return scaleAmountText(trimmed, factor) !== trimmed;
}

/** True when half or double would change an ingredient amount or the yield. */
export function recipeCanScale(
  makes: string | undefined,
  ingredients: readonly string[],
): boolean {
  if (ingredients.some((line) => lineChanges(line, 2) || lineChanges(line, 0.5))) {
    return true;
  }
  const yieldText = makes ?? "";
  return lineChanges(yieldText, 2) || lineChanges(yieldText, 0.5);
}

export function batchNote(
  factor: ScaleFactor,
  makes?: string,
  ingredients: readonly string[] = [],
): string | null {
  if (factor === 1) return null;
  const lines = ingredients.map((line) => line.trim()).filter((line) => line.length > 0);
  const scaledCount = lines.filter((line) => lineChanges(line, factor)).length;
  const yieldText = makes?.trim() ?? "";
  const yieldChanged = lineChanges(yieldText, factor);
  if (scaledCount === 0 && !yieldChanged) return null;

  const size = factor === 2 ? "doubled" : "halved";
  if (scaledCount > 0) {
    const parts = [`Amounts ${size}.`];
    if (scaledCount < lines.length) {
      parts.push("Lines without a number stay the same.");
    }
    if (yieldText.length > 0 && !yieldChanged) {
      parts.push("The yield stays the same.");
    }
    return parts.join(" ");
  }
  if (lines.length > 0) {
    return `These ingredients don’t have amounts to change. The yield is ${size}.`;
  }
  return `Yield ${size}.`;
}
