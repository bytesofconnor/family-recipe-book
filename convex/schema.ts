import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { kindValidator } from "./lib/validators";
import { sourceKindValidator } from "./lib/sources";

export default defineSchema({
  ...authTables,
  users: defineTable({
    name: v.optional(v.string()),
    image: v.optional(v.string()),
    email: v.optional(v.string()),
    emailVerificationTime: v.optional(v.number()),
    phone: v.optional(v.string()),
    phoneVerificationTime: v.optional(v.number()),
    isAnonymous: v.optional(v.boolean()),
    called: v.optional(v.string()),
    avatarStorageId: v.optional(v.id("_storage")),
    createdAt: v.optional(v.number()),
    passwordHash: v.optional(v.string()),
    passwordSalt: v.optional(v.string()),
  })
    .index("email", ["email"])
    .index("phone", ["phone"]),

  bakes: defineTable({
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
    rating: v.optional(v.number()),
    outcome: v.string(),
    changes: v.array(
      v.object({
        move: v.string(),
        change: v.string(),
        why: v.string(),
      }),
    ),
  })
    .index("by_slug", ["slug"])
    .index("by_status_and_publishedAt", ["status", "publishedAt"])
    .index("by_kitchen_and_status", ["kitchenId", "status"])
    .index("by_owner_and_status", ["ownerId", "status"]),

  photos: defineTable({
    bakeId: v.id("bakes"),
    storageId: v.id("_storage"),
    alt: v.string(),
  }).index("by_bake", ["bakeId"]),

  deskSessions: defineTable({
    tokenHash: v.string(),
    passwordFingerprint: v.string(),
    createdAt: v.number(),
    expiresAt: v.number(),
  }).index("by_tokenHash", ["tokenHash"]),

  deskGates: defineTable({
    name: v.string(),
    failedAt: v.array(v.number()),
  }).index("by_name", ["name"]),

  kitchens: defineTable({
    name: v.string(),
    ownerId: v.id("users"),
    createdAt: v.number(),
  }).index("by_owner", ["ownerId"]),

  members: defineTable({
    kitchenId: v.id("kitchens"),
    userId: v.id("users"),
    role: v.union(
      v.literal("owner"),
      v.literal("cook"),
      v.literal("reader"),
    ),
  })
    // Creation order. by_kitchen_and_user sorts by user instead.
    // eslint-disable-next-line @convex-dev/no-duplicate-indexes
    .index("by_kitchen", ["kitchenId"])
    .index("by_user", ["userId"])
    .index("by_kitchen_and_user", ["kitchenId", "userId"]),

  connections: defineTable({
    viewerId: v.id("users"),
    otherUserId: v.id("users"),
    included: v.boolean(),
    createdAt: v.number(),
    called: v.optional(v.string()),
  })
    // Creation order. by_viewer_and_other sorts by the other person instead.
    // eslint-disable-next-line @convex-dev/no-duplicate-indexes
    .index("by_viewer", ["viewerId"])
    .index("by_viewer_and_other", ["viewerId", "otherUserId"])
    .index("by_other", ["otherUserId"]),

  cookbookMixes: defineTable({
    viewerId: v.id("users"),
    name: v.string(),
    includeMine: v.boolean(),
    otherUserIds: v.array(v.id("users")),
    isDefault: v.boolean(),
    createdAt: v.number(),
  }).index("by_viewer", ["viewerId"]),

  invites: defineTable({
    kitchenId: v.id("kitchens"),
    tokenHash: v.string(),
    role: v.union(v.literal("cook"), v.literal("reader")),
    createdBy: v.id("users"),
    createdAt: v.number(),
    expiresAt: v.number(),
  })
    .index("by_tokenHash", ["tokenHash"])
    .index("by_kitchen", ["kitchenId"]),

  bakeMakes: defineTable({
    bakeId: v.id("bakes"),
    userId: v.id("users"),
    rating: v.optional(v.number()),
    note: v.string(),
    madeAt: v.number(),
    title: v.string(),
    slug: v.string(),
  })
    .index("by_user_and_madeAt", ["userId", "madeAt"])
    // Creation order. by_bake_and_user sorts by who cooked it instead.
    // eslint-disable-next-line @convex-dev/no-duplicate-indexes
    .index("by_bake", ["bakeId"])
    .index("by_bake_and_user", ["bakeId", "userId"]),

  recipeSlips: defineTable({
    tokenHash: v.string(),
    bakeId: v.id("bakes"),
    createdBy: v.id("users"),
    createdAt: v.number(),
  })
    .index("by_tokenHash", ["tokenHash"])
    .index("by_bake_and_creator", ["bakeId", "createdBy"]),

  familySessions: defineTable({
    tokenHash: v.string(),
    userId: v.id("users"),
    createdAt: v.number(),
    expiresAt: v.number(),
  })
    .index("by_tokenHash", ["tokenHash"])
    .index("by_user", ["userId"]),
});
