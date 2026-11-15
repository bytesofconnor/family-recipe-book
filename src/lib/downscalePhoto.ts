const MAX_EDGE = 1280;
const JPEG_QUALITY = 0.72;

/** Shrink a photo before it is stored and scanned. Keeps the original if the browser cannot read it. */
export async function downscalePhoto(file: File): Promise<File> {
  if (typeof createImageBitmap !== "function") {
    return file;
  }
  try {
    const bitmap = await createImageBitmap(file);
    const longest = Math.max(bitmap.width, bitmap.height);
    const scale = longest > 0 ? Math.min(1, MAX_EDGE / longest) : 1;
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      bitmap.close();
      return file;
    }
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();
    const stem = file.name.replace(/\.[^.]+$/, "") || "photo";
    let blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((next) => resolve(next), "image/jpeg", JPEG_QUALITY);
    });
    for (const quality of [0.6, 0.45, 0.32]) {
      if (blob && blob.size > 0 && blob.size <= 1_200_000) break;
      blob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob((next) => resolve(next), "image/jpeg", quality);
      });
    }
    if (!blob || blob.size === 0) {
      return file;
    }
    if (blob.size > 1_200_000 && file.type === "image/jpeg" && file.size < blob.size) {
      return file;
    }
    return new File([blob], `${stem}.jpg`, { type: "image/jpeg" });
  } catch {
    return file;
  }
}
