/**
 * @vitest-environment node
 * 
 * Unit tests for photo mutation logic.
 * Tests pure functions that implement the business logic.
 */

import { describe, it, expect } from "vitest";
import {
  shouldSetAsCover,
  selectNewCover,
  validatePhotosForReorder,
} from "./photos";
import type { Id } from "./_generated/dataModel";

describe("shouldSetAsCover", () => {
  it("returns true when bake has no cover", () => {
    const bake = { coverStorageId: undefined };
    expect(shouldSetAsCover(bake, false)).toBe(true);
  });

  it("returns false when bake has cover and setCover is false", () => {
    const bake = { coverStorageId: "existing" as Id<"_storage"> };
    expect(shouldSetAsCover(bake, false)).toBe(false);
  });

  it("returns true when setCover flag is true", () => {
    const bake = { coverStorageId: "existing" as Id<"_storage"> };
    expect(shouldSetAsCover(bake, true)).toBe(true);
  });

  it("returns true when bake has no cover even if setCover is false", () => {
    const bake = { coverStorageId: undefined };
    expect(shouldSetAsCover(bake, false)).toBe(true);
  });

  it("leaves the bake uncovered when the caller opts out", () => {
    const bake = { coverStorageId: undefined };
    expect(shouldSetAsCover(bake, false, true)).toBe(false);
  });

  it("still sets the cover when the caller opts out but asks for this photo", () => {
    const bake = { coverStorageId: undefined };
    expect(shouldSetAsCover(bake, true, true)).toBe(true);
  });
});

describe("selectNewCover", () => {
  it("returns first remaining photo when cover is removed", () => {
    const photos = [
      { _id: "p1" as Id<"photos">, storageId: "s1" as Id<"_storage"> },
      { _id: "p2" as Id<"photos">, storageId: "s2" as Id<"_storage"> },
      { _id: "p3" as Id<"photos">, storageId: "s3" as Id<"_storage"> },
    ];
    
    const newCover = selectNewCover(photos, "p1" as Id<"photos">);
    expect(newCover).toBe("s2" as Id<"_storage">);
  });

  it("returns undefined when last photo is removed", () => {
    const photos = [
      { _id: "p1" as Id<"photos">, storageId: "s1" as Id<"_storage"> },
    ];
    
    const newCover = selectNewCover(photos, "p1" as Id<"photos">);
    expect(newCover).toBeUndefined();
  });

  it("returns next photo when middle photo is removed", () => {
    const photos = [
      { _id: "p1" as Id<"photos">, storageId: "s1" as Id<"_storage"> },
      { _id: "p2" as Id<"photos">, storageId: "s2" as Id<"_storage"> },
      { _id: "p3" as Id<"photos">, storageId: "s3" as Id<"_storage"> },
    ];
    
    const newCover = selectNewCover(photos, "p2" as Id<"photos">);
    // Returns first remaining, which is p1
    expect(newCover).toBe("s1" as Id<"_storage">);
  });
});

describe("validatePhotosForReorder", () => {
  const bakeId = "b1" as Id<"bakes">;

  it("returns true when all photos belong to bake", () => {
    const photos = [
      { _id: "p1" as Id<"photos">, bakeId },
      { _id: "p2" as Id<"photos">, bakeId },
      { _id: "p3" as Id<"photos">, bakeId },
    ];
    
    const photoIds = ["p1" as Id<"photos">, "p2" as Id<"photos">, "p3" as Id<"photos">];
    expect(validatePhotosForReorder(photos, bakeId, photoIds)).toBe(true);
  });

  it("returns false when photo belongs to different bake", () => {
    const photos = [
      { _id: "p1" as Id<"photos">, bakeId },
      { _id: "p2" as Id<"photos">, bakeId: "b2" as Id<"bakes"> }, // Different bake!
      { _id: "p3" as Id<"photos">, bakeId },
    ];
    
    const photoIds = ["p1" as Id<"photos">, "p2" as Id<"photos">, "p3" as Id<"photos">];
    expect(validatePhotosForReorder(photos, bakeId, photoIds)).toBe(false);
  });

  it("returns false when photo ID is missing", () => {
    const photos = [
      { _id: "p1" as Id<"photos">, bakeId },
      { _id: "p2" as Id<"photos">, bakeId },
      { _id: "p3" as Id<"photos">, bakeId },
    ];
    
    // Only requesting 2 of 3 photos
    const photoIds = ["p1" as Id<"photos">, "p2" as Id<"photos">];
    expect(validatePhotosForReorder(photos, bakeId, photoIds)).toBe(false);
  });

  it("returns false when extra photo ID is included", () => {
    const photos = [
      { _id: "p1" as Id<"photos">, bakeId },
      { _id: "p2" as Id<"photos">, bakeId },
    ];
    
    // Requesting 3 photos but only 2 exist
    const photoIds = ["p1" as Id<"photos">, "p2" as Id<"photos">, "p4" as Id<"photos">];
    expect(validatePhotosForReorder(photos, bakeId, photoIds)).toBe(false);
  });

  it("validates reorder preserves photo count", () => {
    const photos = [
      { _id: "p1" as Id<"photos">, bakeId },
      { _id: "p2" as Id<"photos">, bakeId },
      { _id: "p3" as Id<"photos">, bakeId },
    ];
    
    // Reordered but same photos
    const photoIds = ["p3" as Id<"photos">, "p1" as Id<"photos">, "p2" as Id<"photos">];
    expect(validatePhotosForReorder(photos, bakeId, photoIds)).toBe(true);
  });
});

describe("Cover photo ordering in BakePage", () => {
  it("sorts photos with cover first", () => {
    type Photo = { storageId: Id<"_storage">; alt: string };
    const coverStorageId = "s2" as Id<"_storage">;
    
    const photos: Photo[] = [
      { storageId: "s1" as Id<"_storage">, alt: "Photo 1" },
      { storageId: "s2" as Id<"_storage">, alt: "Photo 2 (cover)" },
      { storageId: "s3" as Id<"_storage">, alt: "Photo 3" },
    ];
    
    // BakePage sorting logic
    const sorted = [
      ...photos.filter((p) => p.storageId === coverStorageId),
      ...photos.filter((p) => p.storageId !== coverStorageId),
    ];
    
    expect(sorted[0]?.storageId).toBe("s2" as Id<"_storage">);
    expect(sorted[0]?.alt).toBe("Photo 2 (cover)");
    expect(sorted.length).toBe(3);
  });

  it("preserves order when no cover is specified", () => {
    type Photo = { storageId: Id<"_storage">; alt: string };
    const coverStorageId = undefined;
    
    const photos: Photo[] = [
      { storageId: "s1" as Id<"_storage">, alt: "Photo 1" },
      { storageId: "s2" as Id<"_storage">, alt: "Photo 2" },
    ];
    
    // BakePage sorting logic (falls back to original order)
    const sorted = coverStorageId
      ? [
          ...photos.filter((p) => p.storageId === coverStorageId),
          ...photos.filter((p) => p.storageId !== coverStorageId),
        ]
      : photos;
    
    expect(sorted).toEqual(photos);
  });
});

describe("Legacy recipe compatibility", () => {
  it("falls back to coverStorageId when photos array is empty", () => {
    type Photo = { storageId: Id<"_storage"> };
    const coverStorageId = "s-legacy" as Id<"_storage">;
    const photos: Photo[] = [];
    
    // BakePage fallback logic
    const displayPhoto = photos.length > 0 
      ? photos[0]?.storageId 
      : coverStorageId;
    
    expect(displayPhoto).toBe("s-legacy" as Id<"_storage">);
  });

  it("uses photos table when available", () => {
    type Photo = { storageId: Id<"_storage"> };
    const coverStorageId = "s1" as Id<"_storage">;
    const photos: Photo[] = [
      { storageId: "s1" as Id<"_storage"> },
      { storageId: "s2" as Id<"_storage"> },
    ];
    
    const displayPhoto = photos.length > 0 
      ? photos[0]?.storageId 
      : coverStorageId;
    
    expect(displayPhoto).toBe("s1" as Id<"_storage">);
  });
});
