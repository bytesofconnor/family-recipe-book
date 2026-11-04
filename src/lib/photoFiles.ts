const PHOTO_EXTENSION_TYPE: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
  heic: "image/heic",
  heif: "image/heif",
  bmp: "image/bmp",
  tif: "image/tiff",
  tiff: "image/tiff",
  avif: "image/avif",
};

function extension(name: string): string {
  const slash = Math.max(name.lastIndexOf("/"), name.lastIndexOf("\\"));
  const base = slash >= 0 ? name.slice(slash + 1) : name;
  const dot = base.lastIndexOf(".");
  if (dot <= 0 || dot === base.length - 1) {
    return "";
  }
  return base.slice(dot + 1).toLowerCase();
}

export function photoContentType(file: File): string | null {
  if (file.type.startsWith("image/")) {
    return file.type;
  }
  const named = PHOTO_EXTENSION_TYPE[extension(file.name)];
  if (
    named &&
    (file.type === "" || file.type === "application/octet-stream")
  ) {
    return named;
  }
  return null;
}

export function uploadContentType(file: File): string {
  return photoContentType(file) ?? (file.type || "application/octet-stream");
}

export function photosFromPicker(files: readonly File[]): File[] {
  return files.filter((file) => photoContentType(file) !== null);
}
