import { describe, expect, it } from "vitest";
import { batchNote, formatAmount, scaleAmountText } from "./scaleAmount";

describe("formatAmount", () => {
  it("prints whole numbers without a decimal", () => {
    expect(formatAmount(2)).toBe("2");
    expect(formatAmount(1)).toBe("1");
    expect(formatAmount(0)).toBe("0");
  });

  it("prints friendly fractions instead of decimals", () => {
    expect(formatAmount(0.5)).toBe("½");
    expect(formatAmount(1.5)).toBe("1 ½");
    expect(formatAmount(0.25)).toBe("¼");
    expect(formatAmount(0.75)).toBe("¾");
    expect(formatAmount(1 / 3)).toBe("⅓");
    expect(formatAmount(2 / 3)).toBe("⅔");
    expect(formatAmount(0.125)).toBe("⅛");
    expect(formatAmount(2.5)).toBe("2 ½");
  });

  it("uses an ascii fraction when there is no glyph", () => {
    expect(formatAmount(1 / 16)).toBe("1/16");
  });
});

describe("scaleAmountText", () => {
  it("leaves the original line alone at 1×", () => {
    expect(scaleAmountText("1.5 cups", 1)).toBe("1.5 cups");
    expect(scaleAmountText("1/2 cup", 1)).toBe("1/2 cup");
    expect(scaleAmountText("2-3 apples", 1)).toBe("2-3 apples");
  });

  it("scales a leading integer", () => {
    expect(scaleAmountText("2 cups flour", 2)).toBe("4 cups flour");
    expect(scaleAmountText("2 cups flour", 0.5)).toBe("1 cup flour");
    expect(scaleAmountText("3 eggs", 0.5)).toBe("1 ½ eggs");
    expect(scaleAmountText("2 eggs", 0.5)).toBe("1 egg");
    expect(scaleAmountText("1 egg", 2)).toBe("2 eggs");
    expect(scaleAmountText("1 loaf", 2)).toBe("2 loaves");
  });

  it("scales a leading decimal and prints a fraction", () => {
    expect(scaleAmountText("1.5 cups", 2)).toBe("3 cups");
    expect(scaleAmountText("1.5 cups", 0.5)).toBe("¾ cup");
    expect(scaleAmountText(".5 tsp", 2)).toBe("1 tsp");
    expect(scaleAmountText("0.25 cup", 2)).toBe("½ cup");
  });

  it("scales ascii fractions and mixed numbers", () => {
    expect(scaleAmountText("1/2 cup", 2)).toBe("1 cup");
    expect(scaleAmountText("1 1/2 cups", 2)).toBe("3 cups");
    expect(scaleAmountText("1 1/2 cups", 0.5)).toBe("¾ cup");
    expect(scaleAmountText("1-1/2 cups", 2)).toBe("3 cups");
  });

  it("scales unicode fractions", () => {
    expect(scaleAmountText("½ cup", 2)).toBe("1 cup");
    expect(scaleAmountText("¼ tsp", 2)).toBe("½ tsp");
    expect(scaleAmountText("¾ cup", 2)).toBe("1 ½ cups");
    expect(scaleAmountText("⅓ cup", 2)).toBe("⅔ cup");
    expect(scaleAmountText("⅔ cup", 0.5)).toBe("⅓ cup");
    expect(scaleAmountText("⅛ tsp", 2)).toBe("¼ tsp");
    expect(scaleAmountText("1½ cups", 2)).toBe("3 cups");
    expect(scaleAmountText("1 ½ cups", 2)).toBe("3 cups");
  });

  it("scales both ends of a range and keeps the separator", () => {
    expect(scaleAmountText("2-3 cups", 2)).toBe("4-6 cups");
    expect(scaleAmountText("2-3 cups", 0.5)).toBe("1 to 1 ½ cups");
    expect(scaleAmountText("2–3 apples", 2)).toBe("4–6 apples");
    expect(scaleAmountText("2 to 3 apples", 0.5)).toBe("1 to 1 ½ apples");
    expect(scaleAmountText("1/2-3/4 cup", 2)).toBe("1 to 1 ½ cups");
  });

  it("scales only the leading amount and keeps the rest of the line", () => {
    expect(scaleAmountText("1 cup sugar, plus more", 2)).toBe(
      "2 cups sugar, plus more",
    );
    expect(scaleAmountText("1 glass milk", 2)).toBe("2 glass milk");
    expect(scaleAmountText("2 cups (sifted)", 2)).toBe("4 cups (sifted)");
    expect(scaleAmountText("  2 cups", 2)).toBe("  4 cups");
    expect(scaleAmountText("2 to taste", 2)).toBe("4 to taste");
    expect(scaleAmountText("2 tomatoes", 2)).toBe("4 tomatoes");
  });

  it("leaves a line unchanged when the amount is not leading or not a number", () => {
    const untouched = [
      "salt to taste",
      "zest of 1 lemon",
      "about 2 cups",
      "About 2 cups",
      "2nd egg",
      "pinch of salt",
      "1/0 cup",
      "",
    ];
    for (const line of untouched) {
      expect(scaleAmountText(line, 2)).toBe(line);
      expect(scaleAmountText(line, 0.5)).toBe(line);
    }
  });

  it("scales a yield that starts with an amount", () => {
    expect(scaleAmountText("12 muffins", 2)).toBe("24 muffins");
    expect(scaleAmountText("12 muffins", 0.5)).toBe("6 muffins");
    expect(scaleAmountText("1 muffin", 2)).toBe("2 muffins");
    expect(scaleAmountText("About a dozen", 2)).toBe("About a dozen");
  });
});

describe("batchNote", () => {
  it("says nothing at the original size", () => {
    expect(batchNote(1, "12 muffins")).toBeNull();
    expect(batchNote(1)).toBeNull();
  });

  it("mentions a yield it could scale", () => {
    expect(batchNote(2, "12 muffins")).toBe(
      "Amounts are for double the recipe. This makes 24 muffins.",
    );
    expect(batchNote(0.5, "12 muffins")).toBe(
      "Amounts are for half the recipe. This makes 6 muffins.",
    );
  });

  it("mentions a yield it left alone", () => {
    expect(batchNote(2, "About a dozen")).toBe(
      "Amounts are for double the recipe. The yield still says About a dozen.",
    );
  });

  it("skips the yield when the recipe has none", () => {
    expect(batchNote(2)).toBe("Amounts are for double the recipe.");
    expect(batchNote(0.5, "   ")).toBe("Amounts are for half the recipe.");
  });
});
