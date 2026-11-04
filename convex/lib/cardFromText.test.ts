import { describe, expect, it } from "vitest";
import { parseCardsJson } from "./cardFromText";

describe("parseCardsJson", () => {
  it("keeps a short note beside the ingredients and steps", () => {
    const cards = parseCardsJson(
      JSON.stringify({
        cards: [
          {
            title: "Sunday stew",
            makes: "One pot",
            ingredients: ["lamb", "onion"],
            steps: ["Simmer"],
            notes: "Better the next day",
            sourceKind: "original",
            sourceTitle: "",
          },
        ],
      }),
    );
    expect(cards).toHaveLength(1);
    expect(cards[0]).toMatchObject({
      title: "Sunday stew",
      ingredients: ["lamb", "onion"],
      steps: ["Simmer"],
      notes: "Better the next day",
    });
  });

  it("keeps a title when the rest of the card is blank", () => {
    const cards = parseCardsJson('{"title":"Half a card","ingredients":[],"steps":[]}');
    expect(cards[0]?.title).toBe("Half a card");
    expect(cards[0]?.ingredients).toEqual([]);
    expect(cards[0]?.notes).toBe("");
  });
});
