import { expect, test, type Page } from "@playwright/test";

/**
 * Signed-in polish: room art on tall pages, readable notes, a real photo
 * size, a footer mark that is not a fake page number, and phone clearance.
 */

async function signedIn(page: Page) {
  await page.addInitScript(() => {
    window.__A11Y_SIGNED_IN__ = true;
    sessionStorage.setItem("thatsyum-preview-open", "0");
  });
}

test.beforeEach(async ({ page }) => {
  await signedIn(page);
});

test("a short recipe note is one line, and the footer has no page number", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/bakes/sunday-muffins");
  await expect(page.getByRole("heading", { name: "Sunday muffins" })).toBeVisible();

  const note = page.locator(".bake-leaf-intro p").first();
  await expect(note).toHaveText("Always a hit on a slow morning.");
  await expect(note).not.toHaveClass(/drop-cap/);
  await expect(page.locator(".drop-cap")).toHaveCount(0);

  for (const path of ["/", "/add", "/bakes/sunday-muffins"]) {
    await page.goto(path);
    await expect(page.locator(".book-colophon-page-num")).toHaveCount(0);
    const folio = await page.locator(".book-colophon-page").innerText();
    expect(folio.trim(), path).toBe("");
  }
});

test("season art repeats down a page taller than the viewport", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/bakes/sunday-muffins");
  await expect(page.getByRole("heading", { name: "Sunday muffins" })).toBeVisible();
  const paint = await page.evaluate(() => {
    const body = getComputedStyle(document.body);
    const repeat = body.backgroundRepeat.split(",")[0]?.trim();
    return {
      image: body.backgroundImage,
      repeat,
      attachment: body.backgroundAttachment.split(",")[0]?.trim(),
      fixedArt: document.querySelector(".season-artwork") !== null,
      taller: document.documentElement.scrollHeight > window.innerHeight + 200,
    };
  });

  expect(paint.taller).toBe(true);
  expect(paint.fixedArt).toBe(false);
  expect(paint.image).toContain("/themes/");
  expect(paint.repeat).toBe("repeat-y");
  expect(paint.attachment).not.toBe("fixed");
});

test("desktop hero photo fills its column", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/bakes/sunday-muffins");
  const width = await page
    .locator(".bake-leaf-hero-photo")
    .evaluate((node) => node.getBoundingClientRect().width);
  expect(width).toBeGreaterThan(420);
});

test("phone paper is flush left and the last line clears the tab bar", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });

  for (const path of ["/add", "/bakes/sunday-muffins"]) {
    await page.goto(path);
    await page.evaluate(() => {
      document.scrollingElement?.scrollTo(0, document.scrollingElement.scrollHeight);
    });

    const box = await page.evaluate(() => {
      const dock = document.querySelector(".book-dock")?.getBoundingClientRect();
      const line = document
        .querySelector(".book-colophon, .site-footer")
        ?.getBoundingClientRect();
      const book = document.querySelector(".book")?.getBoundingClientRect();
      const photo = document.querySelector(".bake-leaf-hero-photo")?.getBoundingClientRect();
      return {
        dockTop: dock?.top ?? 0,
        lineBottom: line?.bottom ?? 0,
        bookLeft: book?.left ?? 99,
        photoWidth: photo?.width ?? 0,
        bookWidth: book?.width ?? 1,
      };
    });

    expect(box.bookLeft, path).toBeLessThan(2);
    expect(box.dockTop - box.lineBottom, path).toBeGreaterThan(28);
    if (path.startsWith("/bakes/")) {
      expect(box.photoWidth).toBeGreaterThan(box.bookWidth * 0.7);
    }
  }
});

test("opening a deep link does not show the recipe index", async ({ page }) => {
  for (const path of ["/bakes/sunday-muffins", "/add", "/you"]) {
    await page.goto(path, { waitUntil: "domcontentloaded" });
    const sawIndex = await page.evaluate(() => {
      const index = [...document.querySelectorAll(".book-warm-page")].find((node) =>
        node.textContent?.includes("Search recipes"),
      );
      if (!(index instanceof HTMLElement)) {
        return false;
      }
      return getComputedStyle(index).display !== "none" && !index.hidden;
    });
    expect(sawIndex, path).toBe(false);
  }
});
