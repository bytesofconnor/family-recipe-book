import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

async function expectNoSeriousAxe(page: Page) {
  const result = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  const blocking = result.violations.filter(
    (violation) =>
      violation.impact === "serious" || violation.impact === "critical",
  );
  expect(blocking, JSON.stringify(blocking, null, 2)).toEqual([]);
}

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
        "Uploaded 3 photos. Tap one if it should be the cover. Couldn't read words on them. You can still save it.",
      ),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Use as cover, photo 1" }),
    ).toHaveAttribute("aria-pressed", "false");
    await expect(
      page.getByRole("button", { name: "Use as cover, photo 2" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Use as cover, photo 3" }),
    ).toBeVisible();
    const second = page.getByRole("button", { name: "Use as cover, photo 2" });
    await second.click();
    await expect(
      page.getByRole("button", { name: "Cover, photo 2" }),
    ).toHaveAttribute("aria-pressed", "true");
    await page.getByRole("button", { name: "Cover, photo 2" }).click();
    await expect(
      page.getByRole("button", { name: "Use as cover, photo 2" }),
    ).toHaveAttribute("aria-pressed", "false");
    const choice = page.getByRole("button", { name: "Use as cover, photo 1" });
    const box = await choice.boundingBox();
    expect(box).not.toBeNull();
    expect(Math.min(box!.width, box!.height)).toBeGreaterThanOrEqual(44);
    await expect(
      page.getByRole("button", { name: "Put it in the book" }),
    ).toBeVisible();
    await expect(
      page.getByText("Put it in the book however you already have it"),
    ).toHaveCount(0);
    await expectNoSeriousAxe(page);
  });

  test("desktop: several photos start with no cover", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await stubUpload(page, 200);
    await openDesk(page);

    await page.getByRole("button", { name: "Take or choose photos" }).click();
    await page.getByLabel("Recipe photos").setInputFiles(PHOTOS.slice(0, 2));

    await expect(
      page.getByText(
        "Uploaded 2 photos. Tap one if it should be the cover. Couldn't read words on them. You can still save it.",
      ),
    ).toBeVisible();
    const first = page.getByRole("button", { name: "Use as cover, photo 1" });
    const second = page.getByRole("button", { name: "Use as cover, photo 2" });
    await expect(first).toHaveAttribute("aria-pressed", "false");
    await expect(second).toHaveAttribute("aria-pressed", "false");
    await second.click();
    await expect(
      page.getByRole("button", { name: "Cover, photo 2" }),
    ).toHaveAttribute("aria-pressed", "true");
    await expect(first).toHaveAttribute("aria-pressed", "false");
    await expectNoSeriousAxe(page);
  });

  test("mobile: a HEIC photo with no type still opens the card", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await stubUpload(page, 200);
    await openDesk(page);

    await page.getByRole("button", { name: "Take or choose photos" }).click();
    await expect(page.getByLabel("Recipe photos")).toHaveAttribute("multiple", "");
    const types = await page.evaluate(() => {
      const input = document.querySelector('input[aria-label="Recipe photos"]');
      if (!(input instanceof HTMLInputElement)) {
        throw new Error("missing photo input");
      }
      const transfer = new DataTransfer();
      transfer.items.add(new File(["jpeg"], "counter.jpg", { type: "image/jpeg" }));
      transfer.items.add(new File(["heic"], "IMG_2044.HEIC", { type: "" }));
      input.files = transfer.files;
      const seen = [...(input.files ?? [])].map((file) => `${file.name}:${file.type}`);
      input.dispatchEvent(new Event("change", { bubbles: true }));
      return seen;
    });
    expect(types).toEqual(["counter.jpg:image/jpeg", "IMG_2044.HEIC:"]);
    await expect(
      page.getByText(
        "Uploaded 2 photos. Tap one if it should be the cover. Couldn't read words on them. You can still save it.",
      ),
    ).toBeVisible();
  });

  test("desktop: one photo opens the recipe card", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await stubUpload(page, 200);
    await openDesk(page);

    await page.getByRole("button", { name: "Take or choose photos" }).click();
    await page.getByLabel("Recipe photos").setInputFiles(PHOTOS[0]!);

    await expect(
      page.getByText("Couldn't read words on this. You can still save it."),
    ).toBeVisible();
    await expect(page.getByRole("img", { name: "counter" })).toBeVisible();
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
    await expectNoSeriousAxe(page);
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
      page.getByText("Couldn't read words on this. You can still save it."),
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
