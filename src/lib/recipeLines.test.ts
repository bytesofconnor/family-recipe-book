import { describe, expect, it } from "vitest";
import {
  addLine,
  linesToText,
  moveLine,
  pasteIntoLine,
  removeLine,
  splitLine,
  textToLines,
} from "./recipeLines";

describe("recipe lines", () => {
  it("round-trips an empty list and a filled list", () => {
    expect(textToLines("")).toEqual([""]);
    expect(linesToText([""])).toBe("");
    expect(linesToText(textToLines("flour\nsalt"))).toBe("flour\nsalt");
  });

  it("moves a line up and refuses to move the first line up", () => {
    expect(moveLine(["flour", "salt"], 1, -1)).toEqual(["salt", "flour"]);
    expect(moveLine(["flour", "salt"], 0, -1)).toEqual(["flour", "salt"]);
  });

  it("splits on enter and pastes several lines", () => {
    expect(splitLine(["flour and salt"], 0, 5)).toEqual({
      lines: ["flour", " and salt"],
      focusIndex: 1,
    });
    expect(pasteIntoLine([""], 0, "flour\nsalt\n", 0)).toEqual({
      lines: ["flour", "salt", ""],
      focusIndex: 2,
      split: true,
    });
    expect(pasteIntoLine(["rice"], 0, "brown", 0).split).toBe(false);
  });

  it("adds a line and removes one without leaving the list empty", () => {
    expect(addLine(["flour"])).toEqual({
      lines: ["flour", ""],
      focusIndex: 1,
    });
    expect(removeLine(["flour"], 0)).toEqual([""]);
    expect(removeLine(["flour", "salt"], 0)).toEqual(["salt"]);
  });
});
