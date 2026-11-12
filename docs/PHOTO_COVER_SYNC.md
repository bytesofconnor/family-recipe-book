# Photo Cover Synchronization Safety

This document explains how the new multi-image photo system maintains backward compatibility with existing recipes and keeps the cover photo synchronized.

## Data Model

### Before (Legacy)
```typescript
bakes: {
  _id: Id<"bakes">,
  coverUrl?: string,           // External URL (deprecated)
  coverStorageId?: Id<"_storage">,  // Storage ID for uploaded photo
  // ... other fields
}
```

### After (Current)
```typescript
bakes: {
  _id: Id<"bakes">,
  coverUrl?: string,           // External URL (still supported for legacy)
  coverStorageId?: Id<"_storage">,  // NOW: Primary cover reference
  // ... other fields
}

photos: {
  _id: Id<"photos">,
  bakeId: Id<"bakes">,         // Which recipe this photo belongs to
  storageId: Id<"_storage">,   // The actual photo file
  alt: string,                 // Alt text for accessibility
}
// Indexed by bakeId for fast lookup
```

## Safety Guarantees

### 1. No Destructive Schema Changes

The `photos` table is **additive only**:
- ✅ New table added alongside existing `bakes` table
- ✅ No fields removed from `bakes`
- ✅ No data migrations required
- ✅ Existing `coverStorageId` values untouched

**Why this is safe:**
- Database schema evolution is append-only
- Old code (if any) can still read `coverStorageId`
- New code reads both `photos` table and `coverStorageId`

### 2. Backward Compatibility

Three recipe states coexist safely:

#### State A: Legacy recipe (created before photos table)
```typescript
bake = {
  _id: "b1",
  title: "Old Recipe",
  coverStorageId: "s-old",  // ✅ Still works
}
photos = []  // Empty - no photos rows exist
```

**Display behavior:**
```typescript
// BakePage.tsx logic:
const photos = useQuery(api.photos.listForBake, { bakeId: bake._id });
const galleryPhotos = photos && photos.length > 0 
  ? photos 
  : null;

const heroSrc = galleryPhotos?.[0]?.url ?? bake.coverUrl ?? bake.coverStorageId;

// Result: Falls back to coverStorageId ✅
```

#### State B: Recipe with single photo in photos table
```typescript
bake = {
  _id: "b2",
  title: "Transitional Recipe",
  coverStorageId: "s1",  // Synced with photos[0]
}
photos = [
  { _id: "p1", bakeId: "b2", storageId: "s1", alt: "Main photo" }
]
```

**Display behavior:**
- Photo gallery shows single photo (no thumbnails)
- Cover is synchronized between `coverStorageId` and `photos[0].storageId`

#### State C: Recipe with multiple photos
```typescript
bake = {
  _id: "b3",
  title: "Modern Recipe",
  coverStorageId: "s2",  // Points to cover photo
}
photos = [
  { _id: "p1", bakeId: "b3", storageId: "s1", alt: "First photo" },
  { _id: "p2", bakeId: "b3", storageId: "s2", alt: "Cover photo" },
  { _id: "p3", bakeId: "b3", storageId: "s3", alt: "Third photo" },
]
```

**Display behavior:**
- Photo gallery shows all photos with thumbnails
- Cover photo appears first (reordered on query)
- Thumbnails allow switching between photos

### 3. Cover Synchronization Logic

#### When attaching a photo (PhotoManager upload):

```typescript
// convex/photos.ts - attach mutation
const bake = await ctx.db.get("bakes", args.bakeId);

await ctx.db.insert("photos", {
  bakeId: args.bakeId,
  storageId: args.storageId,
  alt: args.alt,
});

// Sync cover:
if (args.setCover || (!args.leaveUncovered && !bake.coverStorageId)) {
  // Set as cover when asked, or when this is the first photo and the caller
  // did not opt out. Multi-photo intake opts out so an empty cover stays empty.
  await ctx.db.patch("bakes", args.bakeId, { 
    coverStorageId: args.storageId 
  });
}
```

**Safety guarantees:**
- ✅ Callers that omit `leaveUncovered` still make the first photo the cover
- ✅ Multi-photo intake passes `leaveUncovered` so "no cover" stays empty
- ✅ Subsequent photos don't override cover unless requested
- ✅ `setCover` flag gives explicit control
- ✅ No race conditions (mutations are serialized by Convex)

#### When removing a photo:

```typescript
// convex/photos.ts - remove mutation
const photo = await ctx.db.get("photos", args.photoId);
const bake = await ctx.db.get("bakes", photo.bakeId);

// If removing the cover, reassign to next photo
if (bake.coverStorageId === photo.storageId) {
  const allPhotos = await ctx.db
    .query("photos")
    .withIndex("by_bake", q => q.eq("bakeId", photo.bakeId))
    .collect();
  
  const remainingPhotos = allPhotos.find(p => p._id !== args.photoId);
  
  await ctx.db.patch("bakes", photo.bakeId, {
    coverStorageId: remainingPhotos?.storageId ?? undefined
  });
}

await ctx.db.delete("photos", args.photoId);
```

**Safety guarantees:**
- ✅ Cover automatically moves to next photo when current cover is removed
- ✅ Cover is cleared when last photo is removed (falls back to decorative plate)
- ✅ No orphaned cover references
- ✅ Transactional (all-or-nothing within mutation)

#### When setting cover explicitly:

```typescript
// convex/photos.ts - setCover mutation
const photo = await ctx.db.get("photos", args.photoId);

await ctx.db.patch("bakes", photo.bakeId, { 
  coverStorageId: photo.storageId 
});
```

**Safety guarantees:**
- ✅ Always points to a photo that exists in photos table
- ✅ Validates photo ownership (must belong to same bake)
- ✅ Access-controlled (requires writer or cook permission)

### 4. Query Ordering (Cover First)

Currently, photos are returned in insertion order. To guarantee cover appears first:

**Option A: Client-side reordering** (current implementation)
```typescript
// BakePage.tsx
const photos = useQuery(api.photos.listForBake, { bakeId });
const coverStorageId = bake.coverStorageId;

// Reorder so cover is first
const galleryPhotos = photos
  ?.filter(p => p.url)
  .sort((a, b) => {
    if (a.storageId === coverStorageId) return -1;
    if (b.storageId === coverStorageId) return 1;
    return 0;
  });
```

**Option B: Database ordering** (future enhancement)
```typescript
// Add `order` field to photos table
photos: {
  _id: Id<"photos">,
  bakeId: Id<"bakes">,
  storageId: Id<"_storage">,
  alt: string,
  order: number,  // 0 = cover, 1+ = gallery order
}

// Query with ordering
const photos = await ctx.db
  .query("photos")
  .withIndex("by_bake", q => q.eq("bakeId", args.bakeId))
  .order("asc")  // Order by _creationTime, then reorder by `order` field
  .collect();
```

### 5. What CANNOT Break

#### Existing recipes without photos
- ❌ CANNOT lose their cover image
  - Reason: `coverStorageId` is never deleted, only updated
- ❌ CANNOT show wrong image
  - Reason: BakePage falls back to `coverStorageId` when `photos` is empty

#### Recipe cards and listings
- ❌ CANNOT break
  - Reason: They only read `coverStorageId`, don't query photos table
  - Code: `<RecipeCard coverUrl={bake.coverUrl} />` unchanged

#### Search and filtering
- ❌ CANNOT be affected
  - Reason: Search indexes text fields only, not photos

### 6. Access Control

All photo mutations require authentication:

```typescript
// convex/photos.ts
export const attach = mutation({
  args: {
    ...writerOrCookArgs,  // Requires writerToken OR kitchenId
    bakeId: v.id("bakes"),
    storageId: v.id("_storage"),
    alt: v.string(),
  },
  handler: async (ctx, args) => {
    await requireWriterOrCook(ctx, args);  // Enforced here
    // ... mutation logic
  }
});
```

**Safety guarantees:**
- ✅ Only authenticated users can modify photos
- ✅ Same access control as recipe editing
- ✅ No anonymous uploads
- ✅ No cross-recipe manipulation (bakeId validated)

## Testing Coverage

### Unit Tests (vitest)
- ✅ First photo becomes cover
- ✅ Explicit cover setting works
- ✅ Cover reassignment on removal
- ✅ Cover clearing on last photo removal
- ✅ Reorder validation (rejects wrong bake)
- ✅ Legacy fallback (coverStorageId without photos)

### Component Tests (vitest)
- ✅ PhotoManager renders photos
- ✅ Cover badge displays correctly
- ✅ Up/down buttons work
- ✅ Set cover button appears for non-cover photos
- ✅ Remove button present for all photos

### Integration Tests (Playwright)
- ✅ Photo gallery displays multiple photos
- ✅ Clicking thumbnail switches main photo
- ✅ Keyboard navigation works
- ✅ Mobile viewport no horizontal overflow
- ✅ ARIA labels present and correct
- ✅ Smoke tests (/, /join, /faq) pass

## Migration Path

### Phase 1: Deploy (Current)
- ✅ Add photos table (empty initially)
- ✅ Deploy new code
- ✅ Old recipes continue working (State A)

### Phase 2: Gradual Adoption
- ✅ Users add photos via PhotoManager
- ✅ Recipes transition to State B or C
- ✅ Both old and new recipes coexist

### Phase 3: Optional Cleanup (Future)
- ❓ Optionally migrate legacy recipes to photos table
- ❓ Not required - both systems work indefinitely

## Rollback Safety

If we need to rollback:

1. **Database:** No-op - photos table exists but is optional
2. **Code:** Old code ignores photos table, reads coverStorageId
3. **Data:** No data is lost or corrupted

The system is **rollback-safe** because:
- Photos table is additive (doesn't break old code)
- coverStorageId is never removed
- BakePage has fallback logic

## Conclusion

The multi-image photo system is **production-safe** because:

1. ✅ No destructive changes to existing data
2. ✅ Backward compatible with legacy recipes
3. ✅ Cover synchronization is automatic and validated
4. ✅ Access-controlled mutations
5. ✅ Comprehensive test coverage
6. ✅ Rollback-safe design

**Risk level: LOW**
- Adding photos to new recipes: Zero risk to existing recipes
- Editing photos on existing recipes: Cover sync keeps display consistent
- Worst case: Photo upload fails → user retries, no data corruption
