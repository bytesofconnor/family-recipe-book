import { getFunctionName } from "convex/server";
import type { ReactNode } from "react";
import {
  FIXTURE_DUMMY_COOKS,
  FIXTURE_EDIT_BAKE,
  FIXTURE_KITCHEN_ID,
  FIXTURE_ME,
  FIXTURE_MINE,
  FIXTURE_PHOTOS,
  FIXTURE_PUBLISHED_BAKE,
  FIXTURE_TEASER,
} from "@/test/a11yFixtureData";
import { isA11ySignedIn } from "@/test/a11yFixtureMode";

type QueryArgs = Record<string, unknown> | "skip" | undefined;
type PublishedBake = typeof FIXTURE_PUBLISHED_BAKE;
type FixturePhoto = (typeof FIXTURE_PHOTOS)[number];

const savedBySlug = new Map<string, PublishedBake>();
const photosByBake = new Map<string, FixturePhoto[]>();

function record(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object") {
    return value as Record<string, unknown>;
  }
  return {};
}

function stringList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.map((item) => String(item));
}

function slugify(title: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug.length > 0 ? slug : "recipe";
}

function savedBakeId(slug: string): PublishedBake["_id"] {
  const body = slug.replace(/[^a-z0-9]/g, "").slice(0, 18).padEnd(18, "0");
  return `sv${body}` as PublishedBake["_id"];
}

function rememberSave(args: unknown) {
  const fields = record(args);
  const title = String(fields.title ?? "").trim() || "Recipe";
  const slug = slugify(title);
  const story = String(fields.story ?? "");
  const ingredients = stringList(fields.ingredients);
  const steps = stringList(fields.steps);
  const id = savedBakeId(slug);
  const bake = {
    ...FIXTURE_PUBLISHED_BAKE,
    _id: id,
    slug,
    title,
    story,
    outcome: "",
    sourceTitle: String(fields.sourceTitle ?? ""),
    sourceUrl: String(fields.sourceUrl ?? ""),
    sourceKind: String(fields.sourceKind ?? "original"),
    bakerName: String(fields.bakerName ?? FIXTURE_PUBLISHED_BAKE.bakerName),
    kind: String(fields.kind ?? "other"),
    makes: String(fields.makes ?? ""),
    ingredients,
    steps,
    ingredientSearch: ingredients.join(" "),
    changes: [],
    coverUrl: "",
  } as PublishedBake;
  savedBySlug.set(slug, bake);
  return { bakeId: id, slug };
}

function rememberPhoto(args: unknown) {
  const fields = record(args);
  const bakeId = String(fields.bakeId ?? "");
  if (bakeId.length === 0) {
    return;
  }
  const photos = photosByBake.get(bakeId) ?? [];
  const sample = FIXTURE_PHOTOS[0];
  if (!sample) {
    return;
  }
  photos.push({
    _id: `ph${photos.length}${bakeId.slice(-10)}` as FixturePhoto["_id"],
    storageId: (fields.storageId ?? sample.storageId) as FixturePhoto["storageId"],
    url: sample.url,
    alt: String(fields.alt ?? "Recipe photo"),
  });
  photosByBake.set(bakeId, photos);
}

function extractedCard(title: string, ingredients: string[], steps: string[]) {
  return {
    title,
    makes: "One batch",
    ingredients,
    steps,
    sourceKind: "original" as const,
    sourceTitle: "",
  };
}

function cardTitle(fileName: string): string {
  const stem = fileName.replace(/\.[^.]+$/, "");
  const words = stem
    .replace(/[-_]+/g, " ")
    .replace(/\bcard\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
  return words.length >= 2 ? words : "Sunday loaf";
}

function hostFrom(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }
}

function lookupCredit(args: unknown) {
  const url = String(record(args).url ?? "").trim();
  const host = hostFrom(url);
  if (!host) {
    return { hostOk: false, title: null };
  }
  const sally =
    host === "sallysbakingaddiction.com" ||
    host.endsWith(".sallysbakingaddiction.com");
  if (!sally) {
    return { hostOk: false, title: null };
  }
  if (url.toLowerCase().includes("sunday-loaf")) {
    return { hostOk: true, title: "Sunday loaf" };
  }
  return { hostOk: true, title: null };
}

function extractFromUpload(args: unknown) {
  const fileName = String(record(args).fileName ?? "");
  const lower = fileName.toLowerCase();
  if (
    lower.includes("pile") ||
    lower.endsWith(".ppt") ||
    lower.endsWith(".pptx")
  ) {
    return {
      cards: [
        extractedCard("Sunday beans", ["black beans", "rice"], ["Simmer"]),
        extractedCard("Weeknight rice", ["rice", "broth"], ["Boil"]),
      ],
      usedAi: false,
      rawText: "",
    };
  }
  if (lower.includes("card")) {
    return {
      cards: [
        extractedCard(cardTitle(fileName), ["flour", "sugar"], ["Mix", "Bake"]),
      ],
      usedAi: false,
      rawText: "",
    };
  }
  return null;
}

function actionValue(ref: unknown, args: unknown) {
  const name = functionName(ref);
  if (name === "kitchen:remix") {
    return { letter: "Try a little less sugar next time." };
  }
  if (name === "sallyCredit:lookupCredit") {
    return lookupCredit(args);
  }
  if (name === "extractCard:fromUpload") {
    return (
      extractFromUpload(args) ?? { hostOk: false, title: null, cards: [] }
    );
  }
  return { hostOk: false, title: null, cards: [] };
}

function functionName(ref: unknown): string {
  try {
    return getFunctionName(ref as never);
  } catch {
    return "";
  }
}

function queryValue(ref: unknown, args: QueryArgs): unknown {
  const name = functionName(ref);
  const bakeId = args && args !== "skip" ? args.bakeId : undefined;
  const slug = args && args !== "skip" ? args.slug : undefined;

  switch (name) {
    case "familyAuth:me":
      return isA11ySignedIn() ? FIXTURE_ME : null;
    case "familyAuth:peekInvite":
      return null;
    case "bakes:listMine":
      return FIXTURE_MINE;
    case "bakes:listPosted":
    case "bakes:listPublished":
    case "bakes:listByPerson":
      return [FIXTURE_TEASER];
    case "bakes:getMineForEdit":
      return bakeId === FIXTURE_EDIT_BAKE._id ? FIXTURE_EDIT_BAKE : null;
    case "bakes:getPublishedBySlug": {
      if (typeof slug === "string") {
        const saved = savedBySlug.get(slug);
        if (saved) {
          return saved;
        }
        if (slug === FIXTURE_PUBLISHED_BAKE.slug) {
          return FIXTURE_PUBLISHED_BAKE;
        }
      }
      return null;
    }
    case "photos:listForBake": {
      const saved = photosByBake.get(String(bakeId ?? ""));
      if (saved && saved.length > 0) {
        return saved;
      }
      return bakeId === FIXTURE_EDIT_BAKE._id ? FIXTURE_PHOTOS : [];
    }
    case "connections:list":
      return [];
    case "mixes:list":
      return [];
    case "preview:dummyCooks":
      return FIXTURE_DUMMY_COOKS;
    case "preview:dummyBook":
      return null;
    case "preview:dummyBakes":
      return [];
    case "makes:forBake":
      return [];
    case "slips:open":
      return null;
    default:
      return [];
  }
}

function mutationValue(ref: unknown, args: unknown): unknown {
  const name = functionName(ref);
  switch (name) {
    case "kitchens:ensureMine":
    case "familyAuth:acceptInvite":
      return FIXTURE_KITCHEN_ID;
    case "kitchens:createInvite":
      return { token: "fixture-invite-token" };
    case "bakes:save":
      return rememberSave(args);
    case "bakes:updateMine":
      return { bakeId: FIXTURE_EDIT_BAKE._id, slug: FIXTURE_EDIT_BAKE.slug };
    case "photos:attach":
      rememberPhoto(args);
      return null;
    case "photos:generateUploadUrl":
    case "familyAuth:generateUploadUrl":
      return "https://example.test/upload";
    case "desk:unlock":
      return { token: "fixture-desk-token" };
    default:
      return null;
  }
}

export function useConvexAuth() {
  return {
    isLoading: false,
    isAuthenticated: isA11ySignedIn(),
  };
}

export function useQuery(query: unknown, args?: QueryArgs) {
  if (args === "skip") {
    return undefined;
  }
  return queryValue(query, args);
}

export function useMutation(mutation: unknown) {
  return (args?: unknown) => Promise.resolve(mutationValue(mutation, args));
}

export function useAction(action: unknown) {
  return async (args?: unknown) => actionValue(action, args);
}

export function ConvexProvider({ children }: { children: ReactNode }) {
  return children;
}

export class ConvexReactClient {
  constructor(url: string) {
    void url;
  }
}
