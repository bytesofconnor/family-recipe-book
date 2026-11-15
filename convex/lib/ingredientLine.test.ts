import { describe, expect, it } from "vitest";
import { scaleAmountText } from "../../src/lib/scaleAmount";
import { formatIngredientLine, parseIngredientLine } from "./ingredientLine";

describe("parseIngredientLine", () => {
  it("splits a fraction, a unit, and the item", () => {
    expect(parseIngredientLine("1/2 cup sugar")).toMatchObject({
      quantity: "½",
      unit: "cup",
      item: "sugar",
      line: "½ cup sugar",
      confidence: "high",
    });
    expect(parseIngredientLine("½ cup sugar").line).toBe("½ cup sugar");
    expect(parseIngredientLine("1 1/2 cups all-purpose flour")).toMatchObject({
      quantity: "1 ½",
      unit: "cup",
      item: "all-purpose flour",
      line: "1 ½ cups all-purpose flour",
    });
  });

  it("keeps ranges and scales both ends", () => {
    const dashed = parseIngredientLine("2-3 tbsp butter");
    expect(dashed).toMatchObject({
      quantity: "2-3",
      unit: "tablespoon",
      item: "butter",
      line: "2-3 tablespoons butter",
    });
    expect(scaleAmountText(dashed.line, 2)).toBe("4-6 tablespoons butter");

    const worded = parseIngredientLine("1 to 2 teaspoons vanilla");
    expect(worded.quantity).toBe("1 to 2");
    expect(worded.unit).toBe("teaspoon");
    expect(scaleAmountText(worded.line, 0.5)).toBe("½ to 1 teaspoons vanilla");
  });

  it("reads glued units, word amounts, and a pinch", () => {
    expect(parseIngredientLine("2c flour").line).toBe("2 cups flour");
    expect(parseIngredientLine("½c sugar").line).toBe("½ cup sugar");
    expect(parseIngredientLine("two cups flour")).toMatchObject({
      quantity: "2",
      unit: "cup",
      item: "flour",
    });
    expect(parseIngredientLine("a pinch of salt")).toMatchObject({
      quantity: "1",
      unit: "pinch",
      item: "salt",
      line: "1 pinch salt",
    });
  });

  it("leaves a line with no amount as the item", () => {
    expect(parseIngredientLine("salt to taste")).toMatchObject({
      quantity: "",
      unit: "",
      item: "salt to taste",
      line: "salt to taste",
      confidence: "high",
    });
    expect(parseIngredientLine("- onion")).toMatchObject({
      item: "onion",
      confidence: "high",
    });
  });

  it("marks a buried number as something to check", () => {
    const zest = parseIngredientLine("zest of 1 lemon");
    expect(zest.confidence).toBe("low");
    expect(zest.line).toBe("zest of 1 lemon");
    expect(scaleAmountText(zest.line, 2)).toBe(zest.line);
  });

  it("writes a line the batch-size control can half and double", () => {
    const part = parseIngredientLine("3/4 tsp salt");
    expect(part.line).toBe("¾ teaspoon salt");
    expect(scaleAmountText(part.line, 2)).toBe("1 ½ teaspoons salt");
    expect(scaleAmountText(part.line, 0.5)).toBe("⅜ teaspoon salt");
  });
});

describe("abbreviation units", () => {
  const forms = [
    ["tbsp", "tablespoon", "tablespoons"],
    ["tbsp.", "tablespoon", "tablespoons"],
    ["tbs", "tablespoon", "tablespoons"],
    ["tbs.", "tablespoon", "tablespoons"],
    ["tsp", "teaspoon", "teaspoons"],
    ["tsp.", "teaspoon", "teaspoons"],
    ["oz", "ounce", "ounces"],
    ["oz.", "ounce", "ounces"],
    ["c", "cup", "cups"],
    ["c.", "cup", "cups"],
    ["g", "gram", "grams"],
    ["g.", "gram", "grams"],
    ["ml", "milliliter", "milliliters"],
    ["ml.", "milliliter", "milliliters"],
    ["kg", "kilogram", "kilograms"],
    ["kg.", "kilogram", "kilograms"],
    ["qt", "quart", "quarts"],
    ["qt.", "quart", "quarts"],
    ["pt", "pint", "pints"],
    ["pt.", "pint", "pints"],
    ["pkg", "package", "packages"],
    ["pkg.", "package", "packages"],
    ["lb", "pound", "pounds"],
    ["lb.", "pound", "pounds"],
    ["lbs", "pound", "pounds"],
    ["l", "liter", "liters"],
    ["l.", "liter", "liters"],
  ] as const;

  it.each(forms)("keeps %s as one %s and two %s", (abbr, singular, plural) => {
    const one = formatIngredientLine({ quantity: "1", unit: abbr, item: "butter" });
    const two = formatIngredientLine({ quantity: "2", unit: abbr, item: "butter" });
    expect(parseIngredientLine(one)).toMatchObject({
      quantity: "1",
      unit: singular,
      item: "butter",
      line: `1 ${singular} butter`,
    });
    expect(parseIngredientLine(two)).toMatchObject({
      quantity: "2",
      unit: singular,
      item: "butter",
      line: `2 ${plural} butter`,
    });
    expect(parseIngredientLine(`1 ${singular} butter`).unit).toBe(singular);
    expect(parseIngredientLine(`2 ${plural} butter`).unit).toBe(singular);
    expect(parseIngredientLine(`2 ${plural} butter`).item).toBe("butter");
  });
});
