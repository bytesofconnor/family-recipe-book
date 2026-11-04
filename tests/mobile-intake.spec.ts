import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Locator, type Page } from "@playwright/test";

const JPEG = Buffer.from(
  "/9j/4AAQSkZJRgABAQAAAQABAAD/2wCEAAkGBxMTEhUTExMWFRUVFRcVFRcVFRUVFRUVFRUWFhUVFRUYHSggGBolGxUVITEhJSsrLi4uFx8zODMtNygtLisBCgoKDg0OGhAQGy0lHyUtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLf/AABEIAAMBAAMBIgACEQEDEQH/xAAbAAABBQEBAAAAAAAAAAAAAAADAAIEBQYHAf/EABQBAQAAAAAAAAAAAAAAAAAAAAD/xAAUAQEAAAAAAAAAAAAAAAAAAAAA/8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAwDAQACEQMRAD8A6gAA//9k=",
  "base64",
);

const CARD_PHOTO = {
  name: "Sunday-loaf-card.jpg",
  mimeType: "image/jpeg",
  buffer: JPEG,
};

const LARGE_HEIC = {
  name: "IMG_2045.HEIC",
  mimeType: "image/heic",
  buffer: Buffer.alloc(2 * 1024 * 1024, 7),
};

type UploadStub = {
  types: string[];
  fail: () => void;
  ok: () => void;
};

function slugify(title: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug.length > 0 ? slug : "recipe";
}

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

async function visibleControl(page: Page, name: string): Promise<Locator> {
  const control = page
    .getByRole("button", { name })
    .or(page.getByRole("link", { name }));
  const count = await control.count();
  for (let index = 0; index < count; index += 1) {
    const candidate = control.nth(index);
    if (await candidate.isVisible()) {
      return candidate;
    }
  }
  throw new Error(`Expected a visible control named "${name}"`);
}

async function tabToControl(page: Page, name: string) {
  const control = await visibleControl(page, name);
  for (let step = 0; step < 90; step += 1) {
    await page.keyboard.press("Tab");
    const focused = await control.evaluate(
      (node) =>
        node === document.activeElement || node.contains(document.activeElement),
    );
    if (focused) {
      return control;
    }
  }
  throw new Error(`Keyboard tab order never reached "${name}"`);
}

async function expectFocusRing(page: Page) {
  const ring = await page.evaluate(() => {
    const el = document.activeElement;
    if (!(el instanceof HTMLElement) || el === document.body) {
      return false;
    }
    const styles = getComputedStyle(el);
    const outline =
      styles.outlineStyle !== "none" &&
      styles.outlineWidth !== "0px" &&
      styles.outlineColor !== "rgba(0, 0, 0, 0)";
    const shadow = styles.boxShadow !== "none";
    return outline || shadow;
  });
  expect(ring).toBe(true);
}

async function expectClearOfDock(page: Page, name: string) {
  const control = await visibleControl(page, name);
  await control.scrollIntoViewIfNeeded();
  const box = await control.boundingBox();
  expect(box).not.toBeNull();
  expect(Math.min(box!.width, box!.height)).toBeGreaterThanOrEqual(44);
  const dock = page.locator(".book-dock");
  if ((await dock.count()) > 0) {
    const dockBox = await dock.boundingBox();
    if (dockBox && box) {
      expect(box.y + box.height).toBeLessThanOrEqual(dockBox.y + 1);
    }
  }
}

async function blockOutside(page: Page) {
  const leaked: string[] = [];
  await page.route(
    /sallysbakingaddiction\.com|tiktok\.com|pinterest\.com|pin\.it|example\.com/,
    async (route) => {
      leaked.push(route.request().url());
      await route.abort();
    },
  );
  return leaked;
}

async function stubUpload(page: Page): Promise<UploadStub> {
  let status = 200;
  const types: string[] = [];
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
    types.push(route.request().headers()["content-type"] ?? "");
    await route.fulfill({
      status,
      headers,
      contentType: "application/json",
      body: JSON.stringify({ storageId: "jd7a11yfixture00000storage" }),
    });
  });
  return {
    types,
    fail() {
      status = 500;
    },
    ok() {
      status = 200;
    },
  };
}

async function start(page: Page) {
  const leaked = await blockOutside(page);
  const upload = await stubUpload(page);
  await page.addInitScript(() => {
    window.__A11Y_SIGNED_IN__ = true;
  });
  await page.goto("/add");
  await expect(
    page.getByText("Put it in the book however you already have it"),
  ).toBeVisible();
  return { leaked, upload };
}

async function saveFromCard(page: Page, title: string, leaked: string[]) {
  const story = page.getByLabel("How it went");
  if ((await story.inputValue()).trim().length < 2) {
    await story.fill("Always a hit on a weeknight.");
  }
  await page.getByRole("button", { name: "Put it in the book" }).click();
  await expectSaved(page, title, leaked);
}

async function expectSaved(page: Page, title: string, leaked: string[]) {
  await expect(page).toHaveURL(new RegExp(`/bakes/${slugify(title)}$`));
  await expect(
    page.getByRole("heading", { level: 1, name: title }),
  ).toBeVisible();
  expect(leaked, leaked.join("\n")).toEqual([]);
}

async function choosePhotos(page: Page, files: Parameters<Locator["setInputFiles"]>[0]) {
  await page.getByRole("button", { name: "Take or choose photos" }).click();
  await page.getByLabel("Recipe photos").setInputFiles(files);
}

test.describe("mobile recipe intake", () => {
  test.describe.configure({ timeout: 60_000 });

  test("one photo saves the recipe", async ({ page }) => {
    const { leaked, upload } = await start(page);
    await choosePhotos(page, CARD_PHOTO);
    await expect(
      page.getByText("Pulled the words off the file. Check them."),
    ).toBeVisible();
    await expect(page.getByLabel("What do you call it?")).toHaveValue(
      "Sunday loaf",
    );
    await expect(page.getByRole("img", { name: "Sunday loaf" })).toBeVisible();
    await saveFromCard(page, "Sunday loaf", leaked);
    await expect(page.getByRole("img", { name: "Sunday loaf" })).toBeVisible();
    await expect(page.getByText("flour", { exact: true })).toBeVisible();
    expect(upload.types[0]).toBe("image/jpeg");
  });

  test("several photos, including a large HEIC, save the recipe", async ({
    page,
  }) => {
    const { leaked } = await start(page);
    await choosePhotos(page, [
      CARD_PHOTO,
      { name: "IMG_2044.HEIC", mimeType: "image/heic", buffer: Buffer.from("heic") },
      LARGE_HEIC,
    ]);
    await expect(
      page.getByText(
        "Uploaded 3 photos. The first one is the cover. Check the recipe before saving.",
      ),
    ).toBeVisible();
    await saveFromCard(page, "Sunday loaf", leaked);
    await expect(page.getByRole("img", { name: "Sunday loaf" })).toBeVisible();
    await expect(
      page.getByRole("tab", { name: "Photo 3: Sunday loaf - Photo 3" }),
    ).toBeVisible();
  });

  test("a HEIC photo with no file type still saves", async ({ page }) => {
    const { leaked } = await start(page);
    await page.getByRole("button", { name: "Take or choose photos" }).click();
    const types = await page.evaluate(() => {
      const input = document.querySelector('input[aria-label="Recipe photos"]');
      if (!(input instanceof HTMLInputElement)) {
        throw new Error("missing photo input");
      }
      const transfer = new DataTransfer();
      transfer.items.add(
        new File(["jpeg"], "Sunday-loaf-card.jpg", { type: "image/jpeg" }),
      );
      transfer.items.add(new File(["heic"], "IMG_2044.HEIC", { type: "" }));
      input.files = transfer.files;
      const seen = [...(input.files ?? [])].map(
        (file) => `${file.name}:${file.type}`,
      );
      input.dispatchEvent(new Event("change", { bubbles: true }));
      return seen;
    });
    expect(types).toEqual(["Sunday-loaf-card.jpg:image/jpeg", "IMG_2044.HEIC:"]);
    await expect(
      page.getByText(
        "Uploaded 2 photos. The first one is the cover. Check the recipe before saving.",
      ),
    ).toBeVisible();
    await saveFromCard(page, "Sunday loaf", leaked);
    await expect(page.getByText("sugar", { exact: true })).toBeVisible();
    await expect(
      page.getByRole("tab", { name: "Photo 2: Sunday loaf - Photo 2" }),
    ).toBeVisible();
  });

  test("a failed photo upload can be retried and saved", async ({ page }) => {
    const { leaked, upload } = await start(page);
    upload.fail();
    await choosePhotos(page, [
      CARD_PHOTO,
      { name: "IMG_2044.HEIC", mimeType: "image/heic", buffer: Buffer.from("heic") },
    ]);
    await expect(page.getByRole("alert")).toHaveText(
      "Photo 1 didn't upload. Try again.",
    );
    await expect(
      page.getByRole("button", { name: "Take or choose photos" }),
    ).toBeVisible();
    await expectNoSeriousAxe(page);

    upload.ok();
    await choosePhotos(page, CARD_PHOTO);
    await expect(
      page.getByText("Pulled the words off the file. Check them."),
    ).toBeVisible();
    await saveFromCard(page, "Sunday loaf", leaked);
  });

  test("a file that is not a photo shows an error, then a photo saves", async ({
    page,
  }) => {
    const { leaked } = await start(page);
    await choosePhotos(page, {
      name: "notes.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("not a photo"),
    });
    await expect(page.getByRole("alert")).toHaveText(
      "Those aren't photos. Choose a picture from your camera roll.",
    );

    await choosePhotos(page, CARD_PHOTO);
    await expect(
      page.getByText("Pulled the words off the file. Check them."),
    ).toBeVisible();
    await saveFromCard(page, "Sunday loaf", leaked);
  });

  test("a PDF saves the recipe", async ({ page }) => {
    const { leaked } = await start(page);
    await page.getByRole("button", { name: "Upload a PDF or PowerPoint" }).click();
    const input = page.getByLabel("Recipe file");
    await expect(input).not.toHaveAttribute("multiple");
    await input.setInputFiles({
      name: "Sunday-loaf-card.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("%PDF-1.4"),
    });
    await expect(
      page.getByText("Pulled the words off the file. Check them."),
    ).toBeVisible();
    await saveFromCard(page, "Sunday loaf", leaked);
    await expect(page.getByText("flour", { exact: true })).toBeVisible();
    await expect(page.getByText("Always a hit on a weeknight.")).toBeVisible();
  });

  test("a PowerPoint pile can drop every card, then keep one and save it", async ({
    page,
  }) => {
    const { leaked } = await start(page);
    await page.getByRole("button", { name: "Upload a PDF or PowerPoint" }).click();
    await page.getByLabel("Recipe file").setInputFiles({
      name: "recipes-pile.pptx",
      mimeType:
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      buffer: Buffer.from("pptx"),
    });
    await expect(
      page.getByRole("heading", { name: "These recipes" }),
    ).toBeVisible();
    await expect(page.getByText("Sunday beans")).toBeVisible();
    await expect(page.getByText("Weeknight rice")).toBeVisible();
    await expectClearOfDock(page, "Put 2 in the book");
    const pileButton = await tabToControl(page, "Put 2 in the book");
    await expect(pileButton).toBeFocused();
    await expectFocusRing(page);
    await expectNoSeriousAxe(page);

    await page.getByRole("checkbox", { name: "Keep Sunday beans" }).click();
    await page.getByRole("checkbox", { name: "Keep Weeknight rice" }).click();
    await page.getByRole("button", { name: "Put 0 in the book" }).click();
    await expect(page.getByRole("alert")).toHaveText(
      "Keep at least one card with a name and what went in.",
    );

    await page.getByRole("checkbox", { name: "Leave out Weeknight rice" }).click();
    await page.getByRole("button", { name: "Put this one in the book" }).click();
    await expectSaved(page, "Weeknight rice", leaked);
    await expect(page.getByText("broth", { exact: true })).toBeVisible();
  });

  test("a Sally link fills her title without leaving the book, then saves", async ({
    page,
  }) => {
    const { leaked } = await start(page);
    await page
      .getByRole("button", { name: "Paste a link — Sally, TikTok, Pinterest" })
      .click();
    await page
      .locator("#sourceUrl")
      .fill("https://sallysbakingaddiction.com/sunday-loaf/");
    await expect(page.getByText("Sally calls this")).toBeVisible();
    await expect(page.getByText("Sunday loaf").first()).toBeVisible();
    await expect(page.getByLabel("What do you call it?")).toHaveValue(
      "Sunday loaf",
    );
    await page.getByLabel("What went in").fill("oats\nmilk");
    await saveFromCard(page, "Sunday loaf", leaked);
    await expect(
      page.locator("header").getByRole("link", { name: "Sunday loaf", exact: true }),
    ).toHaveAttribute("href", /sallysbakingaddiction\.com\/sunday-loaf/);
    await expect(page.getByText("oats", { exact: true })).toBeVisible();
  });

  test("a Sally link with no title says so, then still saves", async ({
    page,
  }) => {
    const { leaked } = await start(page);
    await page
      .getByRole("button", { name: "Paste a link — Sally, TikTok, Pinterest" })
      .click();
    await page
      .locator("#sourceUrl")
      .fill("https://sallysbakingaddiction.com/missing-page");
    await expect(
      page.getByText("Couldn't find a title on that link. Name it yourself."),
    ).toBeVisible();
    await expectNoSeriousAxe(page);
    await page.getByLabel("What do you call it?").fill("Kitchen muffins");
    await page.getByLabel("What went in").fill("flour\nblueberries");
    await saveFromCard(page, "Kitchen muffins", leaked);
    await expect(
      page.getByRole("link", { name: "Started from Sally" }),
    ).toHaveAttribute("href", /sallysbakingaddiction\.com\/missing-page/);
  });

  test("a TikTok link saves with the credit", async ({ page }) => {
    const { leaked } = await start(page);
    await page
      .getByRole("button", { name: "Paste a link — Sally, TikTok, Pinterest" })
      .click();
    await page
      .locator("#sourceUrl")
      .fill("https://www.tiktok.com/@baker/video/123");
    await expect(
      page.getByRole("button", { name: "TikTok", pressed: true }),
    ).toBeVisible();
    await expect(page.getByLabel("TikTok link")).toHaveValue(/tiktok\.com/);
    await page.getByLabel("What do you call it?").fill("Crispy rice");
    await page.getByLabel("What went in").fill("rice\noil");
    await saveFromCard(page, "Crispy rice", leaked);
    await expect(page.getByRole("link", { name: "From TikTok" })).toHaveAttribute(
      "href",
      /tiktok\.com/,
    );
  });

  test("a Pinterest link saves with the credit", async ({ page }) => {
    const { leaked } = await start(page);
    await page
      .getByRole("button", { name: "Paste a link — Sally, TikTok, Pinterest" })
      .click();
    await page.locator("#sourceUrl").fill("https://pin.it/sundaypin");
    await expect(
      page.getByRole("button", { name: "Pinterest", pressed: true }),
    ).toBeVisible();
    await expect(page.getByLabel("Pinterest link")).toHaveValue(/pin\.it/);
    await page.getByLabel("What do you call it?").fill("Saved brownies");
    await page.getByLabel("What went in").fill("chocolate\nbutter");
    await saveFromCard(page, "Saved brownies", leaked);
    await expect(
      page.getByRole("link", { name: "From Pinterest" }),
    ).toHaveAttribute("href", /pin\.it\/sundaypin/);
  });

  test("a bad or unsupported link stays in the book and still saves", async ({
    page,
  }) => {
    const { leaked } = await start(page);
    await page
      .getByRole("button", { name: "Paste a link — Sally, TikTok, Pinterest" })
      .click();
    await page.locator("#sourceUrl").fill("not a link");
    await expect(
      page.getByRole("button", { name: "Mine", pressed: true }),
    ).toBeVisible();
    await expect(
      page.getByText("Couldn't find a title on that link. Name it yourself."),
    ).toHaveCount(0);

    await page.locator("#sourceUrl").fill("https://example.com/not-a-recipe");
    await expect(
      page.getByRole("button", { name: "From Sally", pressed: true }),
    ).toHaveCount(0);
    await expect(page.getByLabel("The link")).toHaveValue(
      "https://example.com/not-a-recipe",
    );
    await page.getByLabel("What do you call it?").fill("Pantry soup");
    await page.getByLabel("What went in").fill("broth\nbeans");
    await saveFromCard(page, "Pantry soup", leaked);
    await expect(page.getByText("From this kitchen")).toBeVisible();
  });

  test("typing a recipe shows each missing piece, then saves", async ({
    page,
  }) => {
    const { leaked } = await start(page);
    await page.getByRole("button", { name: "Type it myself" }).click();
    await expectClearOfDock(page, "Put it in the book");
    const save = await tabToControl(page, "Put it in the book");
    await expect(save).toBeFocused();
    await expectFocusRing(page);

    await save.click();
    await expect(page.getByRole("alert")).toHaveText(
      "Give it a name so you can find it later.",
    );
    await page.getByLabel("What do you call it?").fill("Weeknight toast");
    await page.getByRole("button", { name: "Put it in the book" }).click();
    await expect(page.getByRole("alert")).toHaveText(/Add what went in/);
    await page.getByLabel("What went in").fill("bread\nbutter");
    await page.getByRole("button", { name: "Put it in the book" }).click();
    await expect(page.getByRole("alert")).toHaveText(
      "Say how it went — even a line or two.",
    );
    await page.getByLabel("How it went").fill("Crisp and good.");
    await page.getByRole("button", { name: "Put it in the book" }).click();
    await expectSaved(page, "Weeknight toast", leaked);
    await expect(page.getByText("butter", { exact: true })).toBeVisible();
    await expect(page.getByText("Crisp and good.")).toBeVisible();
    await expectNoSeriousAxe(page);
  });

  test("a photo added on the card with no file type still saves", async ({
    page,
  }) => {
    const { leaked, upload } = await start(page);
    await page.getByRole("button", { name: "Type it myself" }).click();
    await page.getByLabel("What do you call it?").fill("Card photo loaf");
    await page.getByLabel("What went in").fill("flour\nsalt");
    await page.getByLabel("Tap to add a photo").evaluate((input) => {
      if (!(input instanceof HTMLInputElement)) {
        throw new Error("missing photo field");
      }
      const transfer = new DataTransfer();
      transfer.items.add(new File(["heic"], "IMG_9.HEIC", { type: "" }));
      input.files = transfer.files;
      input.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await expect(page.getByRole("img", { name: "Card photo loaf" })).toBeVisible();
    await saveFromCard(page, "Card photo loaf", leaked);
    await expect(page.getByRole("img", { name: "Card photo loaf" })).toBeVisible();
    expect(upload.types).toContain("image/heic");
  });
});
