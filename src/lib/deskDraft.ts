import type { SourceKind } from "@/lib/sources";

export const DESK_DRAFT_KEY = "write-desk-draft";

const INTAKES = ["photo", "file", "link", "type"] as const;
const KINDS = [
  "original",
  "family",
  "friend",
  "book",
  "sally",
  "tiktok",
  "pinterest",
] as const;

export type DeskIntake = (typeof INTAKES)[number];

export type DeskChange = {
  id: string;
  move: string;
  change: string;
  why: string;
};

export type DeskPileCard = {
  title: string;
  makes: string;
  ingredients: string;
  steps: string;
  sourceKind: SourceKind;
  sourceTitle: string;
  notes: string;
  keep: boolean;
};

export type DeskDraft = {
  version: 1;
  screen: "card" | "tray";
  intake: DeskIntake;
  sourceKind: SourceKind;
  title: string;
  sourceTitle: string;
  sourceUrl: string;
  titleTouched: boolean;
  story: string;
  bakedOn: string;
  showDate: boolean;
  changes: DeskChange[];
  makes: string;
  ingredients: string;
  steps: string;
  pile: DeskPileCard[];
  editingIndex: number | null;
  hadPhoto: boolean;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function isKind(value: unknown): value is SourceKind {
  return (
    typeof value === "string" &&
    (KINDS as readonly string[]).includes(value)
  );
}

function isIntake(value: unknown): value is DeskIntake {
  return (
    typeof value === "string" &&
    (INTAKES as readonly string[]).includes(value)
  );
}

function isChange(value: unknown): value is DeskChange {
  return (
    isRecord(value) &&
    isString(value.id) &&
    isString(value.move) &&
    isString(value.change) &&
    isString(value.why)
  );
}

function isCard(value: unknown): value is DeskPileCard {
  return (
    isRecord(value) &&
    isString(value.title) &&
    isString(value.makes) &&
    isString(value.ingredients) &&
    isString(value.steps) &&
    isKind(value.sourceKind) &&
    isString(value.sourceTitle) &&
    isString(value.notes) &&
    typeof value.keep === "boolean"
  );
}

export function deskDraftIsWorthKeeping(draft: DeskDraft): boolean {
  return (
    draft.title.trim().length > 0 ||
    draft.story.trim().length > 0 ||
    draft.ingredients.trim().length > 0 ||
    draft.steps.trim().length > 0 ||
    draft.makes.trim().length > 0 ||
    draft.sourceUrl.trim().length > 0 ||
    draft.sourceTitle.trim().length > 0 ||
    draft.changes.some((row) => row.change.trim().length > 0) ||
    draft.pile.length > 0 ||
    draft.hadPhoto
  );
}

export function parseDeskDraft(raw: string | null): DeskDraft | null {
  if (!raw) {
    return null;
  }
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isRecord(value) || value.version !== 1) {
    return null;
  }
  if (value.screen !== "card" && value.screen !== "tray") {
    return null;
  }
  if (!isIntake(value.intake) || !isKind(value.sourceKind)) {
    return null;
  }
  if (!Array.isArray(value.changes) || !value.changes.every(isChange)) {
    return null;
  }
  if (!Array.isArray(value.pile) || !value.pile.every(isCard)) {
    return null;
  }
  if (value.editingIndex !== null && typeof value.editingIndex !== "number") {
    return null;
  }
  const title = value.title;
  const sourceTitle = value.sourceTitle;
  const sourceUrl = value.sourceUrl;
  const story = value.story;
  const bakedOn = value.bakedOn;
  const makes = value.makes;
  const ingredients = value.ingredients;
  const steps = value.steps;
  if (
    !isString(title) ||
    !isString(sourceTitle) ||
    !isString(sourceUrl) ||
    !isString(story) ||
    !isString(bakedOn) ||
    !isString(makes) ||
    !isString(ingredients) ||
    !isString(steps)
  ) {
    return null;
  }
  if (typeof value.titleTouched !== "boolean") {
    return null;
  }
  if (typeof value.showDate !== "boolean") {
    return null;
  }
  if (typeof value.hadPhoto !== "boolean") {
    return null;
  }
  const draft: DeskDraft = {
    version: 1,
    screen: value.screen,
    intake: value.intake,
    sourceKind: value.sourceKind,
    title,
    sourceTitle,
    sourceUrl,
    titleTouched: value.titleTouched,
    story,
    bakedOn,
    showDate: value.showDate,
    changes: value.changes,
    makes,
    ingredients,
    steps,
    pile: value.pile,
    editingIndex: value.editingIndex,
    hadPhoto: value.hadPhoto,
  };
  return deskDraftIsWorthKeeping(draft) ? draft : null;
}

function safeSession(): Storage | null {
  try {
    return typeof sessionStorage === "undefined" ? null : sessionStorage;
  } catch {
    return null;
  }
}

export function readDeskDraft(
  storage: Storage | null = safeSession(),
): DeskDraft | null {
  if (!storage) {
    return null;
  }
  try {
    return parseDeskDraft(storage.getItem(DESK_DRAFT_KEY));
  } catch {
    return null;
  }
}

export function writeDeskDraft(
  draft: DeskDraft,
  storage: Storage | null = safeSession(),
): void {
  if (!storage) {
    return;
  }
  try {
    if (!deskDraftIsWorthKeeping(draft)) {
      storage.removeItem(DESK_DRAFT_KEY);
      return;
    }
    storage.setItem(DESK_DRAFT_KEY, JSON.stringify(draft));
  } catch {
    return;
  }
}

export function clearDeskDraft(storage: Storage | null = safeSession()): void {
  if (!storage) {
    return;
  }
  try {
    storage.removeItem(DESK_DRAFT_KEY);
  } catch {
    return;
  }
}
