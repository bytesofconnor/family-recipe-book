export const READ_MISSED =
  "Couldn't read words on this. You can still save it.";
export const READ_MISSED_LINK =
  "Couldn't read words on this link. You can still save it.";
export const READ_TIMEOUT =
  "Reading the photo took too long. The picture is still here. You can try again, or type the recipe.";
export const READ_TOO_BIG =
  "That photo is too big to read. It's still attached. Try a smaller picture, or type the recipe.";
export const READ_BAD_TYPE =
  "This picture is in a format the reader can't open. It's still attached. Paste the words, or take it again.";
export const READ_GATEWAY =
  "The recipe didn't come through. The picture is still here. You can try again, or type it.";

export function missedPhotos(count: number): string {
  return `Uploaded ${count} photos. Tap one if it should be the cover. Couldn't read words on them. You can still save it.`;
}

export const MAX_SCAN_BYTES = 1_500_000;

export function imageGate(
  bytes: Uint8Array,
):
  | { ok: true; mime: "image/jpeg" | "image/png" | "image/webp" | "image/gif" }
  | { ok: false; error: "type" | "size" } {
  const mime = sniffImageMime(bytes);
  if (!mime) return { ok: false, error: "type" };
  if (bytes.byteLength > MAX_SCAN_BYTES) return { ok: false, error: "size" };
  return { ok: true, mime };
}

export function sniffImageMime(
  bytes: Uint8Array,
): "image/jpeg" | "image/png" | "image/webp" | "image/gif" | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) {
    return "image/png";
  }
  if (bytes.length >= 6 && bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) {
    return "image/gif";
  }
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return "image/webp";
  }
  return null;
}

export function friendlyReadError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (/timeout|timed out|aborted|abort/i.test(message)) return READ_TIMEOUT;
  return READ_GATEWAY;
}

export function logReadFailure(scope: string, error: unknown) {
  const status =
    error && typeof error === "object" && "statusCode" in error
      ? (error as { statusCode?: number }).statusCode
      : undefined;
  const raw = error instanceof Error ? error.message : String(error);
  const safe = raw
    .replace(/Bearer\s+\S+/gi, "Bearer [redacted]")
    .replace(/AI_GATEWAY_API_KEY[=:]\s*\S+/gi, "AI_GATEWAY_API_KEY=[redacted]")
    .slice(0, 500);
  console.error(scope, status ?? "", safe);
}
