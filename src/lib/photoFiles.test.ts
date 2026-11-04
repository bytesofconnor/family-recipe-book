import { describe, expect, it } from "vitest";
import { photoContentType, photosFromPicker } from "./photoFiles";

function file(name: string, type: string): File {
  return new File(["x"], name, { type });
}

describe("photosFromPicker", () => {
  it("keeps jpeg, png, and heic photos", () => {
    const files = [
      file("a.jpg", "image/jpeg"),
      file("b.png", "image/png"),
      file("c.HEIC", "image/heic"),
    ];
    expect(photosFromPicker(files).map((item) => item.name)).toEqual([
      "a.jpg",
      "b.png",
      "c.HEIC",
    ]);
  });

  it("keeps a HEIC photo when the phone omits the type", () => {
    const heic = file("IMG_2044.HEIC", "");
    expect(photoContentType(heic)).toBe("image/heic");
    expect(photosFromPicker([heic, file("notes.txt", "text/plain")])).toEqual([
      heic,
    ]);
  });

  it("keeps a jpeg the phone reports as a generic binary", () => {
    expect(photoContentType(file("scan.jpg", "application/octet-stream"))).toBe(
      "image/jpeg",
    );
  });

  it("drops a pdf, a text file, and a pdf named like a jpeg", () => {
    expect(
      photosFromPicker([
        file("sunday.pdf", "application/pdf"),
        file("notes.txt", ""),
        file("recipe.jpg", "application/pdf"),
      ]),
    ).toEqual([]);
  });
});
