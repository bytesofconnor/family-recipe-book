import { describe, expect, it } from "vitest";
import { readRecipeText, recipeFromHtml, validateRecipeJson } from "./recipeRead";

const PASTE = `Sunday stew
Serves 6
Prep: 15 min
Cook: 40 min

Ingredients
1/2 cup flour
2 onions
salt

Directions
1. Simmer until thick.
2. Rest overnight.

Notes
Better the next day
`;

describe("validateRecipeJson", () => {
  it("accepts structured ingredients and keeps a low-confidence field", () => {
    const verdict = validateRecipeJson(
      JSON.stringify({
        cards: [
          {
            title: "Sunday stew",
            makes: "Serves 6",
            prepTime: 15,
            cookTime: "40 min",
            ingredients: [
              { quantity: "1/2", unit: "cup", item: "flour", confidence: "high" },
              { quantity: "", unit: "", item: "salt", confidence: "low" },
            ],
            steps: [{ text: "1. Simmer", confidence: "high" }],
            notes: "Better the next day",
            sourceKind: "family",
            sourceTitle: "",
            confidence: { title: "high", makes: "high", times: "low", notes: "high" },
          },
        ],
      }),
    );
    expect(verdict.ok).toBe(true);
    if (!verdict.ok) return;
    expect(verdict.cards[0]).toMatchObject({
      title: "Sunday stew",
      prepTime: "15 min",
      cookTime: "40 min",
      ingredients: ["½ cup flour", "salt"],
      steps: ["Simmer"],
      sourceKind: "family",
    });
    expect(verdict.cards[0]?.parts[1]?.confidence).toBe("low");
    expect(verdict.cards[0]?.confidence.times).toBe("low");
  });

  it("rejects a card whose ingredients are not a list, with a reason to retry", () => {
    const verdict = validateRecipeJson(
      '{"cards":[{"title":"Soup","ingredients":"flour","steps":[]}]}',
    );
    expect(verdict.ok).toBe(false);
    if (verdict.ok) return;
    expect(verdict.reason).toContain("ingredients must be an array");
  });

  it("rejects prose that is not JSON", () => {
    const verdict = validateRecipeJson("I could not read the card.");
    expect(verdict.ok).toBe(false);
  });
});

describe("readRecipeText", () => {
  it("pulls yield, times, ingredients, and numbered steps from a paste", () => {
    const card = readRecipeText(PASTE);
    expect(card.title).toBe("Sunday stew");
    expect(card.makes).toBe("6 servings");
    expect(card.prepTime).toBe("15 min");
    expect(card.cookTime).toBe("40 min");
    expect(card.ingredients).toEqual(["½ cup flour", "2 onions", "salt"]);
    expect(card.parts[0]).toMatchObject({ quantity: "½", unit: "cup", item: "flour" });
    expect(card.steps).toEqual(["Simmer until thick.", "Rest overnight."]);
    expect(card.notes).toBe("Better the next day");
  });
});

describe("recipeFromHtml", () => {
  it("reads a schema.org recipe without copying the page prose", () => {
    const html = `
      <html><head>
        <script type="application/ld+json">
          {
            "@context": "https://schema.org",
            "@type": "Recipe",
            "name": "Weeknight beans",
            "recipeYield": "4 servings",
            "prepTime": "PT10M",
            "cookTime": "PT1H",
            "recipeIngredient": ["1 cup beans", "2 cloves garlic"],
            "recipeInstructions": [
              { "@type": "HowToStep", "text": "Simmer the beans." }
            ],
            "description": "A short note."
          }
        </script>
      </head><body><p>A long article that should not become the recipe.</p></body></html>
    `;
    const card = recipeFromHtml(html);
    expect(card).toMatchObject({
      title: "Weeknight beans",
      makes: "4 servings",
      prepTime: "10 min",
      cookTime: "1 hr",
      ingredients: ["1 cup beans", "2 cloves garlic"],
      steps: ["Simmer the beans."],
      notes: "A short note.",
    });
    expect(card?.parts[1]).toMatchObject({ unit: "clove", item: "garlic" });
  });
});
