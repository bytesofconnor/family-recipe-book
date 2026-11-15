import { v } from "convex/values";
import { sourceKindValidator } from "./sources";

export const changeValidator = v.object({
  move: v.string(),
  change: v.string(),
  why: v.string(),
});

export const kindValidator = v.union(
  v.literal("muffins"),
  v.literal("cookies"),
  v.literal("cake"),
  v.literal("bread"),
  v.literal("crisp"),
  v.literal("bars"),
  v.literal("other"),
);

export const bakeValidator = v.object({
  _id: v.id("bakes"),
  _creationTime: v.number(),
  slug: v.string(),
  title: v.string(),
  story: v.string(),
  sourceTitle: v.string(),
  sourceUrl: v.string(),
  sourceKind: v.optional(sourceKindValidator),
  bakerName: v.string(),
  kind: v.optional(kindValidator),
  method: v.optional(v.string()),
  makes: v.optional(v.string()),
  prepTime: v.optional(v.string()),
  cookTime: v.optional(v.string()),
  ingredients: v.optional(v.array(v.string())),
  steps: v.optional(v.array(v.string())),
  ingredientSearch: v.optional(v.string()),
  originStorageId: v.optional(v.id("_storage")),
  coverUrl: v.optional(v.string()),
  coverStorageId: v.optional(v.id("_storage")),
  ownerId: v.optional(v.id("users")),
  kitchenId: v.optional(v.id("kitchens")),
  status: v.union(v.literal("draft"), v.literal("published")),
  publishedAt: v.optional(v.number()),
  bakedOn: v.string(),
  outcome: v.string(),
  changes: v.array(changeValidator),
});

export const bakeTeaserValidator = v.object({
  _id: v.id("bakes"),
  slug: v.string(),
  title: v.string(),
  sourceTitle: v.string(),
  sourceUrl: v.string(),
  sourceKind: v.optional(sourceKindValidator),
  bakerName: v.string(),
  bakerAvatarUrl: v.union(v.string(), v.null()),
  kind: v.optional(kindValidator),
  publishedAt: v.optional(v.number()),
  bakedOn: v.string(),
  outcome: v.string(),
  changes: v.array(changeValidator),
  ingredients: v.array(v.string()),
  photoUrl: v.union(v.string(), v.null()),
  ownerId: v.optional(v.id("users")),
  madeByOthers: v.number(),
});

export const photoValidator = v.object({
  _id: v.id("photos"),
  storageId: v.id("_storage"),
  url: v.union(v.string(), v.null()),
  alt: v.string(),
});
