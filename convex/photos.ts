import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireWriterOrCook, writerOrCookArgs } from "./lib/access";
import { photoValidator } from "./lib/validators";
import type { Doc, Id } from "./_generated/dataModel";

/**
 * A caller that omits leaveUncovered still promotes the first photo when the
 * bake has no cover. Intake passes leaveUncovered so "no cover" stays empty.
 */
export function shouldSetAsCover(
  bake: { coverStorageId?: Id<"_storage"> },
  setCoverFlag: boolean,
  leaveUncovered = false,
): boolean {
  if (setCoverFlag) {
    return true;
  }
  if (leaveUncovered) {
    return false;
  }
  return !bake.coverStorageId;
}

/**
 * Pure function: Select new cover photo when current cover is removed
 */
export function selectNewCover<T extends { _id: unknown; storageId: Id<"_storage"> }>(
  photos: T[],
  removedPhotoId: unknown,
): Id<"_storage"> | undefined {
  const remaining = photos.filter((p) => p._id !== removedPhotoId);
  return remaining[0]?.storageId;
}

/**
 * Pure function: Validate that all photos belong to the same bake
 */
export function validatePhotosForReorder<T extends { _id: unknown; bakeId: Id<"bakes"> }>(
  photos: T[],
  targetBakeId: Id<"bakes">,
  requestedPhotoIds: unknown[],
): boolean {
  const allMatch = photos.every(
    (p) => requestedPhotoIds.includes(p._id) && p.bakeId === targetBakeId
  );
  return allMatch && photos.length === requestedPhotoIds.length;
}

export const listForBake = query({
  args: { bakeId: v.id("bakes") },
  returns: v.array(photoValidator),
  handler: async (ctx, args) => {
    const photos = await ctx.db
      .query("photos")
      .withIndex("by_bake", (q) => q.eq("bakeId", args.bakeId))
      .take(12);

    const withUrls = [];
    for (const photo of photos) {
      const url = await ctx.storage.getUrl(photo.storageId);
      withUrls.push({
        _id: photo._id,
        storageId: photo.storageId,
        url,
        alt: photo.alt,
      });
    }
    return withUrls;
  },
});

export const generateUploadUrl = mutation({
  args: writerOrCookArgs,
  returns: v.string(),
  handler: async (ctx, args) => {
    await requireWriterOrCook(ctx, args);
    return await ctx.storage.generateUploadUrl();
  },
});

export const attach = mutation({
  args: {
    ...writerOrCookArgs,
    bakeId: v.id("bakes"),
    storageId: v.id("_storage"),
    alt: v.string(),
    setCover: v.optional(v.boolean()),
    leaveUncovered: v.optional(v.boolean()),
  },
  returns: v.id("photos"),
  handler: async (ctx, args) => {
    await requireWriterOrCook(ctx, args);
    const bake = await ctx.db.get("bakes", args.bakeId);
    if (!bake) {
      throw new Error("Bake not found");
    }

    const photoId = await ctx.db.insert("photos", {
      bakeId: args.bakeId,
      storageId: args.storageId,
      alt: args.alt.trim() || bake.title,
    });

    if (shouldSetAsCover(bake, args.setCover ?? false, args.leaveUncovered ?? false)) {
      await ctx.db.patch("bakes", args.bakeId, { coverStorageId: args.storageId });
    }

    return photoId;
  },
});

export const remove = mutation({
  args: {
    ...writerOrCookArgs,
    photoId: v.id("photos"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireWriterOrCook(ctx, args);
    const photo = await ctx.db.get("photos", args.photoId);
    if (!photo) {
      return null;
    }

    const bake = await ctx.db.get("bakes", photo.bakeId);
    if (!bake) {
      return null;
    }

    // If removing the cover photo, set a new cover from remaining photos
    if (bake.coverStorageId === photo.storageId) {
      const allPhotos = await ctx.db
        .query("photos")
        .withIndex("by_bake", (q) => q.eq("bakeId", photo.bakeId))
        .collect();
      
      // Use pure function to select new cover
      const newCover = selectNewCover(allPhotos, args.photoId);

      await ctx.db.patch("bakes", photo.bakeId, {
        coverStorageId: newCover,
      });
    }

    // Delete from database first
    await ctx.db.delete("photos", args.photoId);

    // Only delete storage if no other photos reference it and it's not the cover
    // (cover was already updated above if this was the cover photo being removed)
    const bakeAfterUpdate = await ctx.db.get("bakes", photo.bakeId);
    const stillReferenced = bakeAfterUpdate?.coverStorageId === photo.storageId;
    
    if (!stillReferenced) {
      // Check if any other photos in this bake reference this storage
      const otherPhotos = await ctx.db
        .query("photos")
        .withIndex("by_bake", (q) => q.eq("bakeId", photo.bakeId))
        .collect();
      const stillUsed = otherPhotos.some(p => p.storageId === photo.storageId);
      
      if (!stillUsed) {
        await ctx.storage.delete(photo.storageId);
      }
    }

    return null;
  },
});

export const setCover = mutation({
  args: {
    ...writerOrCookArgs,
    photoId: v.id("photos"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireWriterOrCook(ctx, args);
    const photo = await ctx.db.get("photos", args.photoId);
    if (!photo) {
      throw new Error("Photo not found");
    }

    await ctx.db.patch("bakes", photo.bakeId, { coverStorageId: photo.storageId });
    return null;
  },
});

export const reorder = mutation({
  args: {
    ...writerOrCookArgs,
    bakeId: v.id("bakes"),
    photoIds: v.array(v.id("photos")),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireWriterOrCook(ctx, args);
    
    // Get all existing photos for this bake
    const existingPhotos = await ctx.db
      .query("photos")
      .withIndex("by_bake", (q) => q.eq("bakeId", args.bakeId))
      .collect();

    // Use pure function to validate the reorder request
    if (!validatePhotosForReorder(existingPhotos, args.bakeId, args.photoIds)) {
      throw new Error("Invalid photo IDs for reorder");
    }

    // Store photo data
    const photoData = new Map<Id<"photos">, Doc<"photos">>();
    for (const photo of existingPhotos) {
      photoData.set(photo._id, photo);
    }

    // Delete all
    for (const photo of existingPhotos) {
      await ctx.db.delete("photos", photo._id);
    }

    // Re-insert in new order
    for (const photoId of args.photoIds) {
      const data = photoData.get(photoId);
      if (data) {
        await ctx.db.insert("photos", {
          bakeId: data.bakeId,
          storageId: data.storageId,
          alt: data.alt,
        });
      }
    }

    return null;
  },
});
