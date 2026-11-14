import { describe, expect, it } from "vitest";
import {
  DESK_DRAFT_KEY,
  clearDeskDraft,
  parseDeskDraft,
  readDeskDraft,
  writeDeskDraft,
  type DeskDraft,
} from "./deskDraft";

function draft(overrides: Partial<DeskDraft> = {}): DeskDraft {
  return {
    version: 1,
    screen: "card",
    intake: "type",
    sourceKind: "original",
    title: "Sunday toast",
    sourceTitle: "",
    sourceUrl: "",
    titleTouched: true,
    story: "",
    bakedOn: "2026-11-14",
    showDate: false,
    changes: [],
    makes: "",
    ingredients: "bread",
    steps: "",
    pile: [],
    editingIndex: null,
    hadPhoto: false,
    ...overrides,
  };
}

function memoryStorage(): Storage {
  const data = new Map<string, string>();
  return {
    get length() {
      return data.size;
    },
    clear() {
      data.clear();
    },
    getItem(key: string) {
      return data.get(key) ?? null;
    },
    key(index: number) {
      return [...data.keys()][index] ?? null;
    },
    removeItem(key: string) {
      data.delete(key);
    },
    setItem(key: string, value: string) {
      data.set(key, value);
    },
  };
}

describe("desk draft", () => {
  it("drops an empty card and a broken payload", () => {
    expect(parseDeskDraft(JSON.stringify(draft({ title: "  ", ingredients: "" })))).toBeNull();
    expect(parseDeskDraft("{")).toBeNull();
    expect(parseDeskDraft(JSON.stringify({ version: 1, title: "Toast" }))).toBeNull();
  });

  it("keeps a typed recipe across a reload of the same tab", () => {
    const memory = memoryStorage();
    writeDeskDraft(draft(), memory);
    expect(readDeskDraft(memory)?.title).toBe("Sunday toast");
    expect(memory.getItem(DESK_DRAFT_KEY)).toContain("Sunday toast");
    clearDeskDraft(memory);
    expect(readDeskDraft(memory)).toBeNull();
  });

  it("keeps a photo note even when the words are still empty", () => {
    const saved = parseDeskDraft(
      JSON.stringify(draft({ title: "", ingredients: "", hadPhoto: true })),
    );
    expect(saved?.hadPhoto).toBe(true);
  });
});
