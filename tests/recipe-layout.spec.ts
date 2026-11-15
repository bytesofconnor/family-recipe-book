import { expect, test, type Page } from "@playwright/test";

/**
 * The recipe spread keeps one content width: photo and title share a row on
 * a large screen, notes sit in the title column, and the recipe card lines
 * up with that spread. A phone stays a single column.
 */

async function signedIn(page: Page) {
  await page.addInitScript(() => {
    window.__A11Y_SIGNED_IN__ = true;
    sessionStorage.setItem("thatsyum-preview-open", "0");
  });
}

type Box = { left: number; right: number; top: number; bottom: number; width: number };

async function boxes(page: Page) {
  return page.evaluate(() => {
    const read = (selector: string): Box | null => {
      const node = document.querySelector(selector);
      if (!(node instanceof HTMLElement)) return null;
      const rect = node.getBoundingClientRect();
      return {
        left: rect.left,
        right: rect.right,
        top: rect.top,
        bottom: rect.bottom,
        width: rect.width,
      };
    };
    return {
      photo: read(".bake-leaf-hero-photo"),
      title: read(".bake-leaf-title"),
      intro: read(".bake-leaf-intro"),
      card: read(".kitchen-method"),
      what: read(".kitchen-method-what"),
      how: read(".kitchen-method-how"),
      leaf: read(".bake-leaf"),
      book: read(".book"),
    };
  });
}

test.beforeEach(async ({ page }) => {
  await signedIn(page);
});

test("a wide recipe page shares one grid", async ({ page }) => {
  for (const width of [1024, 1280, 1440, 1800]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/bakes/sunday-muffins");
    await expect(page.getByRole("heading", { name: "Sunday muffins" })).toBeVisible();

    const layout = await boxes(page);
    expect(layout.photo, String(width)).toBeTruthy();
    expect(layout.title, String(width)).toBeTruthy();
    expect(layout.intro, String(width)).toBeTruthy();
    expect(layout.card, String(width)).toBeTruthy();
    expect(layout.what, String(width)).toBeTruthy();
    expect(layout.how, String(width)).toBeTruthy();

    const photo = layout.photo!;
    const title = layout.title!;
    const intro = layout.intro!;
    const card = layout.card!;
    const what = layout.what!;
    const how = layout.how!;

    expect(Math.abs(intro.left - title.left), `notes align with the title at ${width}`).toBeLessThan(4);
    expect(Math.abs(intro.right - title.right), `notes match the title width at ${width}`).toBeLessThan(4);
    expect(intro.left, `notes sit beside the photo at ${width}`).toBeGreaterThan(photo.right - 8);
    expect(intro.top, `notes use the column beside the photo at ${width}`).toBeLessThan(photo.bottom - 8);
    expect(Math.abs(card.left - photo.left), `card aligns with the photo at ${width}`).toBeLessThan(4);
    expect(intro.width, `notes stay a readable measure at ${width}`).toBeGreaterThan(280);
    expect(intro.width, `notes stay a readable measure at ${width}`).toBeLessThan(680);
    expect(how.left, `steps sit beside ingredients at ${width}`).toBeGreaterThan(what.right - 4);
    expect(Math.abs(how.top - what.top), `ingredient and step headings line up at ${width}`).toBeLessThan(8);

    if (width >= 1280) {
      expect(photo.width, `photo fills its column at ${width}`).toBeGreaterThan(420);
    }
    if (width >= 1600) {
      expect(layout.leaf!.width, "the spread does not stretch across a very wide page").toBeLessThan(72 * 16 + 2);
      expect(layout.leaf!.width).toBeLessThan((layout.book?.width ?? 0) - 40);
    }
  }
});

test("a phone recipe stays a single column", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/bakes/sunday-muffins");
  await expect(page.getByRole("heading", { name: "Sunday muffins" })).toBeVisible();

  const layout = await boxes(page);
  const photo = layout.photo!;
  const intro = layout.intro!;
  const what = layout.what!;
  const how = layout.how!;

  expect(intro.top).toBeGreaterThan(photo.bottom - 2);
  expect(Math.abs(intro.left - photo.left)).toBeLessThan(4);
  expect(how.top).toBeGreaterThan(what.bottom - 2);
  expect(photo.width).toBeGreaterThan((layout.book?.width ?? 1) * 0.7);

  const rule = await page.locator(".kitchen-method-how").evaluate((node) => {
    return getComputedStyle(node).borderLeftWidth;
  });
  expect(rule).toBe("0px");
});
