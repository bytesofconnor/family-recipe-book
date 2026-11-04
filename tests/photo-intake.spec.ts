import { expect, test, type Page } from "@playwright/test";

/**
 * Photo intake on the write desk. The a11y fixture stands in for Convex.
 * Upload responses are stubbed so the test checks what the baker sees
 * after choosing files, on a phone-sized window and on a desktop window.
 */

const JPEG = Buffer.from(
  "/9j/4AAQSkZJRgABAQAAAQABAAD/2wCEAAkGBxMTEhUTExMWFRUVFRcVFRcVFRUVFRUVFRUWFhUVFRUYHSggGBolGxUVITEhJSsrLi4uFx8zODMtNygtLisBCgoKDg0OGhAQGy0lHyUtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLf/AABEIAAMBAAMBIgACEQEDEQH/xAAbAAABBQEBAAAAAAAAAAAAAAADAAIEBQYHAf/EABQBAQAAAAAAAAAAAAAAAAAAAAD/xAAUAQEAAAAAAAAAAAAAAAAAAAAA/8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAwDAQACEQMRAD8A6gAA//9k=",
  "base64",
);

const PHOTOS = [
  { name: "counter.jpg", mimeType: "image/jpeg", buffer: JPEG },
  { name: "IMG_2044.HEIC", mimeType: "image/heic", buffer: Buffer.from("heic-photo") },
  {
    name: "IMG_2045.HEIC",
    mimeType: "image/heic",
    buffer: Buffer.alloc(2 * 1024 * 1024, 7),
  },
];

async function openDesk(page: Page) {
  await page.addInitScript(() => {
    window.__A11Y_SIGNED_IN__ = true;
  });
  await page.goto("/add");
  await expect(
    page.getByText("Put it in the book however you already have it"),
  ).toBeVisible();
}

async function stubUpload(page: Page, status: number) {
  await page.route("https://example.test/**", async (route) => {
    const headers = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "*",
    };
    if (route.request().method() === "OPTIONS") {
      await route.fulfill({ status: 204, headers });
      return;
    }
    await route.fulfill({
      status,
      headers,
      contentType: "application/json",
      body: JSON.stringify({ storageId: "jd7a11yfixture00000storage" }),
    });
  });
}

test.describe("photo intake", () => {
  test("mobile: several photos, including a large HEIC, open the recipe card", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await stubUpload(page, 200);
    await openDesk(page);

    await page.getByRole("button", { name: "Take or choose photos" }).click();
    const input = page.getByLabel("Recipe photos");
    await expect(input).toHaveAttribute("multiple", "");
    await expect(input).toHaveAttribute("accept", "image/*");
    await expect(input).not.toHaveAttribute("capture");

    await input.setInputFiles(PHOTOS);

    await expect(
      page.getByText(
        "Uploaded 3 photos. The first one is the cover. Check the recipe before saving.",
      ),
    ).toBeVisible();
    await expect(page.getByRole("img", { name: "Recipe photo" })).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Put it in the book" }),
    ).toBeVisible();
    await expect(
      page.getByText("Put it in the book however you already have it"),
    ).toHaveCount(0);
  });

  test("desktop: one photo opens the recipe card", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await stubUpload(page, 200);
    await openDesk(page);

    await page.getByRole("button", { name: "Take or choose photos" }).click();
    await page.getByLabel("Recipe photos").setInputFiles(PHOTOS[0]!);

    await expect(
      page.getByText("Saved the file. Add what went in so you can find it later."),
    ).toBeVisible();
    await expect(page.getByRole("img", { name: "Recipe photo" })).toBeVisible();
  });

  test("mobile: a failed upload says so on the choose screen", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await stubUpload(page, 500);
    await openDesk(page);

    await page.getByRole("button", { name: "Take or choose photos" }).click();
    await page.getByLabel("Recipe photos").setInputFiles(PHOTOS.slice(0, 2));

    await expect(page.getByRole("alert")).toHaveText(
      "Photo 1 didn't upload. Try again.",
    );
    await expect(
      page.getByText("Put it in the book however you already have it"),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Put it in the book" }),
    ).toHaveCount(0);
  });

  test("mobile: a PDF still opens the recipe card", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await stubUpload(page, 200);
    await openDesk(page);

    await page.getByRole("button", { name: "Upload a PDF or PowerPoint" }).click();
    const input = page.getByLabel("Recipe file");
    await expect(input).not.toHaveAttribute("multiple");
    await input.setInputFiles({
      name: "sunday.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("%PDF-1.4"),
    });

    await expect(
      page.getByText("Saved the file. Add what went in so you can find it later."),
    ).toBeVisible();
  });

  test("mobile: a file that is not a photo shows an error", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await stubUpload(page, 200);
    await openDesk(page);

    await page.getByRole("button", { name: "Take or choose photos" }).click();
    await page.getByLabel("Recipe photos").setInputFiles({
      name: "notes.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("not a photo"),
    });

    await expect(page.getByRole("alert")).toHaveText(
      "Those aren't photos. Choose a picture from your camera roll.",
    );
    await expect(
      page.getByText("Put it in the book however you already have it"),
    ).toBeVisible();
  });
});
