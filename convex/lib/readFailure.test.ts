import { describe, expect, it } from "vitest";
import {
  friendlyReadError,
  imageGate,
  MAX_SCAN_BYTES,
  READ_GATEWAY,
  READ_TIMEOUT,
  sniffImageMime,
} from "./readFailure";

describe("sniffImageMime", () => {
  it("recognizes jpeg, png, and webp, and rejects heic", () => {
    expect(sniffImageMime(Uint8Array.from([0xff, 0xd8, 0xff, 0xe0]))).toBe("image/jpeg");
    expect(
      sniffImageMime(Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
    ).toBe("image/png");
    const webp = new Uint8Array(12);
    webp.set([0x52, 0x49, 0x46, 0x46], 0);
    webp.set([0x57, 0x45, 0x42, 0x50], 8);
    expect(sniffImageMime(webp)).toBe("image/webp");
    expect(sniffImageMime(Uint8Array.from([0, 0, 0, 24, 102, 116, 121, 112]))).toBeNull();
  });
});

describe("imageGate", () => {
  it("accepts a small jpeg and refuses a huge png and a heic", () => {
    const jpeg = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0, 0]);
    expect(imageGate(jpeg)).toEqual({ ok: true, mime: "image/jpeg" });
    const png = new Uint8Array(MAX_SCAN_BYTES + 1);
    png.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    expect(imageGate(png)).toEqual({ ok: false, error: "size" });
    const heic = Uint8Array.from([0, 0, 0, 24, 102, 116, 121, 112]);
    expect(imageGate(heic)).toEqual({ ok: false, error: "type" });
  });
});

describe("friendlyReadError", () => {
  it("turns a timeout into a message she can act on", () => {
    expect(friendlyReadError(new Error("The operation timed out"))).toBe(READ_TIMEOUT);
    expect(friendlyReadError(new Error("This operation was aborted"))).toBe(READ_TIMEOUT);
  });

  it("hides a gateway 400 behind the same friendly line", () => {
    expect(friendlyReadError(new Error("Invalid JSON response"))).toBe(READ_GATEWAY);
  });
});
