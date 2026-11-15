/**
 * Score recipe reads.
 * Paste and schema.org links run here.
 * Photo reads call AI Gateway only when AI_GATEWAY_API_KEY is already in the
 * environment. This script never prints that value and never reads Convex.
 */
import { readFileSync } from "node:fs";
import {
  plainTextFromHtml,
  readRecipeText,
  recipeFromHtml,
  validateRecipeJson,
} from "../convex/lib/recipeRead.ts";
import { askRecipeModel } from "../convex/lib/askRecipe.ts";

type Ingredient = { quantity: string; unit: string; item: string };
type Expectation = {
  title: string;
  makes: string;
  prep: string;
  cook: string;
  ingredients: Ingredient[];
  steps: number;
  notes: string;
  images?: string[];
};

const UNIT_ALIAS: Record<string, string> = {
  c: "cup",
  cup: "cup",
  cups: "cup",
  tsp: "teaspoon",
  teaspoon: "teaspoon",
  teaspoons: "teaspoon",
  tbsp: "tablespoon",
  tablespoon: "tablespoon",
  tablespoons: "tablespoon",
  lb: "pound",
  lbs: "pound",
  pound: "pound",
  pounds: "pound",
  oz: "ounce",
  ounce: "ounce",
  inches: "inch",
  inch: "inch",
  cloves: "clove",
  clove: "clove",
};

function normQty(value: string): string {
  return value
    .replaceAll("½", "1/2")
    .replaceAll("⅓", "1/3")
    .replaceAll("¼", "1/4")
    .replaceAll("¾", "3/4")
    .replaceAll("⅛", "1/8")
    .replace(/\s+/g, "")
    .toLowerCase();
}

function normUnit(value: string): string {
  const key = value.trim().toLowerCase().replace(/\.$/, "");
  return UNIT_ALIAS[key] ?? key;
}

function scoreCard(
  name: string,
  card: {
    title: string;
    makes: string;
    prepTime: string;
    cookTime: string;
    parts: Array<{ quantity: string; unit: string; item: string }>;
    steps: string[];
    notes: string;
  },
  expected: Expectation,
): string[] {
  const misses: string[] = [];
  if (!card.title.toLowerCase().includes(expected.title.toLowerCase())) {
    misses.push(`title "${card.title}"`);
  }
  if (!card.makes.includes(expected.makes)) misses.push(`yield "${card.makes}"`);
  if (expected.prep && !card.prepTime.includes(expected.prep)) {
    misses.push(`prep "${card.prepTime}"`);
  }
  if (expected.cook && !card.cookTime.includes(expected.cook)) {
    misses.push(`cook "${card.cookTime}"`);
  }
  if (card.steps.length !== expected.steps) {
    misses.push(`steps ${card.steps.length} wanted ${expected.steps}`);
  }
  if (expected.notes && !card.notes.toLowerCase().includes(expected.notes.toLowerCase())) {
    misses.push("notes");
  }
  expected.ingredients.forEach((want, index) => {
    const got = card.parts[index];
    if (!got) {
      misses.push(`ingredient ${index + 1} missing`);
      return;
    }
    if (normQty(got.quantity) !== normQty(want.quantity)) {
      misses.push(`qty ${index + 1} "${got.quantity}"`);
    }
    if (normUnit(got.unit) !== normUnit(want.unit)) {
      misses.push(`unit ${index + 1} "${got.unit}"`);
    }
    if (!got.item.toLowerCase().includes(want.item.toLowerCase())) {
      misses.push(`item ${index + 1} "${got.item}"`);
    }
  });
  const mark = misses.length === 0 ? "clean" : misses.join("; ");
  console.log(`${name}: ${mark}`);
  return misses;
}

const PASTES: Array<{ name: string; text: string; expected: Expectation }> = [
  {
    name: "paste-messy-caps",
    text: `SUNDAY STEW

serves: 6
prep time - 15 minutes
cook: 40 min

INGREDIENTS:
- 1/2 c. flour
- 2 onions
- 1 lb beef
- salt

DIRECTIONS
1) Toss the beef with the flour.
2) Simmer until thick.

NOTES
Better the next day.
`,
    expected: {
      title: "Sunday stew",
      makes: "6",
      prep: "15",
      cook: "40",
      ingredients: [
        { quantity: "1/2", unit: "cup", item: "flour" },
        { quantity: "2", unit: "", item: "onions" },
        { quantity: "1", unit: "pound", item: "beef" },
        { quantity: "", unit: "", item: "salt" },
      ],
      steps: 2,
      notes: "next day",
    },
  },
  {
    name: "paste-fractions-ranges",
    text: `Honey custard
Serves 4
Prep 15 min
Cook 35 min
Ingredients
1/2 cup honey
1 1/2 cups milk
2-3 eggs
1/4 tsp salt
Steps
1. Warm the milk and honey.
2. Whisk in the eggs.
3. Bake in a water bath.
Notes
It sets as it cools.
`,
    expected: {
      title: "Honey custard",
      makes: "4",
      prep: "15",
      cook: "35",
      ingredients: [
        { quantity: "1/2", unit: "cup", item: "honey" },
        { quantity: "1 1/2", unit: "cup", item: "milk" },
        { quantity: "2-3", unit: "", item: "eggs" },
        { quantity: "1/4", unit: "teaspoon", item: "salt" },
      ],
      steps: 3,
      notes: "cools",
    },
  },
  {
    name: "paste-no-blank-lines",
    text: `Weeknight beans
Serves 4
Prep 10 min
Cook 25 min
Ingredients
2 cups cooked beans
1 onion
3 cloves garlic
1 tsp chili
Steps
1. Soften the onion.
2. Stir in the beans and chili.
Notes
Good cold, too.
`,
    expected: {
      title: "Weeknight beans",
      makes: "4",
      prep: "10",
      cook: "25",
      ingredients: [
        { quantity: "2", unit: "cup", item: "beans" },
        { quantity: "1", unit: "", item: "onion" },
        { quantity: "3", unit: "clove", item: "garlic" },
        { quantity: "1", unit: "teaspoon", item: "chili" },
      ],
      steps: 2,
      notes: "cold",
    },
  },
  {
    name: "paste-two-column-words",
    text: `Apple skillet cake
Serves 8
Prep 20 min
Cook 35 min
Ingredients
1 1/2 cups flour
1/2 cup sugar
2 apples
1 tsp cinnamon
1/2 cup butter
Steps
1. Stir the dry ingredients.
2. Fold in the apples.
3. Bake until the top is set.
Notes
Serve warm.
`,
    expected: {
      title: "Apple skillet cake",
      makes: "8",
      prep: "20",
      cook: "35",
      ingredients: [
        { quantity: "1 1/2", unit: "cup", item: "flour" },
        { quantity: "1/2", unit: "cup", item: "sugar" },
        { quantity: "2", unit: "", item: "apples" },
        { quantity: "1", unit: "teaspoon", item: "cinnamon" },
        { quantity: "1/2", unit: "cup", item: "butter" },
      ],
      steps: 3,
      notes: "warm",
    },
  },
];

const LINKS = [
  "https://www.bbcgoodfood.com/recipes/spaghetti-bolognese",
  "https://www.kingarthurbaking.com/recipes/fudge-brownies-recipe",
  "https://www.budgetbytes.com/banana-bread/",
  "https://www.recipetineats.com/banana-bread/",
  "https://www.bbc.co.uk/food/recipes/easy_chocolate_cake_31070",
  "https://www.loveandlemons.com/banana-bread/",
  "https://en.wikipedia.org/wiki/Bread",
];

async function scoreLinks() {
  console.log("\nlinks");
  for (const url of LINKS) {
    try {
      const response = await fetch(url, {
        redirect: "follow",
        headers: {
          Accept: "text/html",
          "User-Agent": "FamilyRecipeBookScanCheck/1.0",
        },
        signal: AbortSignal.timeout(12_000),
      });
      if (!response.ok) {
        console.log(`${url}: http ${response.status}`);
        continue;
      }
      const html = (await response.text()).slice(0, 500_000);
      const schemaBlocks = html.match(/<script[^>]*application\/ld\+json/gi)?.length ?? 0;
      const card = recipeFromHtml(html);
      const host = new URL(url).hostname;
      if (card && (card.ingredients.length > 0 || card.steps.length > 0)) {
        console.log(
          `${host}: schema.org recipe, title ${card.title.length > 0 ? "yes" : "no"}, ingredients ${card.ingredients.length}, steps ${card.steps.length}`,
        );
        continue;
      }
      const local = readRecipeText(plainTextFromHtml(html).slice(0, 20_000));
      const kept =
        local.ingredients.length > 0 &&
        local.steps.length > 0 &&
        local.steps.length <= 30 &&
        local.ingredients.length <= 40;
      console.log(
        `${host}: no schema.org recipe (ld+json blocks ${schemaBlocks}), local ingredients ${local.ingredients.length}, steps ${local.steps.length}, ${kept ? "kept" : "rejected so the page is not saved as a recipe"}`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.name : "error";
      console.log(`${url}: ${message}`);
    }
  }
}

async function scoreVision() {
  console.log("\nphotos");
  const key = process.env.AI_GATEWAY_API_KEY?.trim();
  if (!key) {
    console.log(
      "skipped: AI_GATEWAY_API_KEY is not in this environment. Production was not queried.",
    );
    return;
  }
  const expected = JSON.parse(
    readFileSync("tests/fixtures/recipes/expected.json", "utf8"),
  ) as Record<string, Expectation>;
  let misses = 0;
  for (const [name, want] of Object.entries(expected)) {
    const files = want.images ?? [name];
    const images = files.map((file) => ({
      bytes: new Uint8Array(readFileSync(`tests/fixtures/recipes/${file}`)),
      mime: "image/png",
    }));
    const prompt = [
      "Read this recipe photo. Return only JSON.",
      '{"cards":[{"title":"","makes":"","prepTime":"","cookTime":"","ingredients":[{"quantity":"","unit":"","item":"","confidence":"high"}],"steps":[{"text":"","confidence":"high"}],"notes":"","sourceKind":"family","sourceTitle":"","confidence":{"title":"high","makes":"high","times":"high","notes":"high"}}]}',
    ].join("\n");
    try {
      const text = await askRecipeModel({ apiKey: key, prompt, images });
      const verdict = validateRecipeJson(text);
      if (!verdict.ok || verdict.cards.length === 0) {
        console.log(`${name}: no card`);
        misses += 1;
        continue;
      }
      const row = scoreCard(name, verdict.cards[0]!, want);
      misses += row.length > 0 ? 1 : 0;
    } catch (error) {
      const message = error instanceof Error ? error.name : "error";
      console.log(`${name}: ${message}`);
      misses += 1;
    }
  }
  const quiet = new Uint8Array(readFileSync("tests/fixtures/recipes/not-a-recipe.png"));
  try {
    const text = await askRecipeModel({
      apiKey: key,
      prompt: "If this image is not a recipe, return {\"cards\":[]}. Otherwise return the recipe JSON.",
      images: [{ bytes: quiet, mime: "image/png" }],
    });
    const verdict = validateRecipeJson(text);
    const empty = verdict.ok && verdict.cards.length === 0;
    console.log(`not-a-recipe.png: ${empty ? "clean empty" : "returned a card"}`);
  } catch (error) {
    const message = error instanceof Error ? error.name : "error";
    console.log(`not-a-recipe.png: ${message}`);
  }
  if (misses > 0) process.exitCode = 1;
}

console.log("paste");
let pasteMisses = 0;
for (const sample of PASTES) {
  const card = readRecipeText(sample.text);
  const misses = scoreCard(sample.name, card, sample.expected);
  pasteMisses += misses.length;
}
await scoreLinks();
await scoreVision();
if (pasteMisses > 0) process.exitCode = 1;
