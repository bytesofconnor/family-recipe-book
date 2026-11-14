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
    const storageId = `jd7a11yfixturestor${String(types.length).padStart(6, "0")}`;
    await route.fulfill({
      status,
      headers,
      contentType: "application/json",
      body: JSON.stringify({ storageId }),
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

async function saveFromCard(
  page: Page,
  title: string,
  leaked: string[],
  options?: { fillStory?: boolean },
) {
  if (options?.fillStory !== false) {
    const story = page.getByLabel("How it went");
    if ((await story.inputValue()).trim().length < 2) {
      await story.fill("Always a hit on a weeknight.");
    }
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

function lineGroup(page: Page, name: string) {
  return page.getByRole("group", { name, exact: true });
}

async function fillLines(page: Page, name: string, text: string) {
  const group = lineGroup(page, name);
  const parts = text.split("\n");
  const boxes = group.getByRole("textbox");
  await boxes.nth(0).fill(parts[0] ?? "");
  for (let index = 1; index < parts.length; index += 1) {
    await group.getByRole("button", { name: "Add another" }).click();
    await boxes.nth(index).fill(parts[index] ?? "");
  }
}

async function expectLines(page: Page, name: string, text: string) {
  const group = lineGroup(page, name);
  const boxes = group.getByRole("textbox");
  if (text.length === 0) {
    await expect(boxes).toHaveCount(1);
    await expect(boxes.nth(0)).toHaveValue("");
    return;
  }
  const parts = text.split("\n");
  await expect(boxes).toHaveCount(parts.length);
  for (let index = 0; index < parts.length; index += 1) {
    await expect(boxes.nth(index)).toHaveValue(parts[index] ?? "");
  }
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
        "Uploaded 3 photos. Tap one if it should be the cover. Check the recipe before saving.",
      ),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Use as cover, photo 1" }),
    ).toHaveAttribute("aria-pressed", "false");
    const coverChoice = await tabToControl(page, "Use as cover, photo 2");
    await expectFocusRing(page);
    await expectClearOfDock(page, "Use as cover, photo 2");
    await coverChoice.click();
    await expect(
      page.getByRole("button", { name: "Cover, photo 2" }),
    ).toHaveAttribute("aria-pressed", "true");
    await expectNoSeriousAxe(page);
    await saveFromCard(page, "Sunday loaf", leaked);
    await expect(
      page.getByRole("tab", { name: "Photo 1: Sunday loaf", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("tab", { name: "Photo 2: Sunday loaf - Photo 1", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("tab", { name: "Photo 3: Sunday loaf - Photo 3", exact: true }),
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
        "Uploaded 2 photos. Tap one if it should be the cover. Check the recipe before saving.",
      ),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Use as cover, photo 1" }),
    ).toHaveAttribute("aria-pressed", "false");
    await saveFromCard(page, "Sunday loaf", leaked);
    await expect(
      page.getByRole("tab", { name: "Photo 1: Sunday loaf", exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("tab", { name: "Photo 1: Sunday loaf - Photo 1", exact: true }),
    ).toBeVisible();
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
      "Keep at least one card with a name.",
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
    await fillLines(page, "What went in", "oats\nmilk");
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
    await fillLines(page, "What went in", "flour\nblueberries");
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
    await fillLines(page, "What went in", "rice\noil");
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
    await fillLines(page, "What went in", "chocolate\nbutter");
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
    await fillLines(page, "What went in", "broth\nbeans");
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
    await expectSaved(page, "Weeknight toast", leaked);
    await expect(page.getByRole("heading", { name: "What went in" })).toHaveCount(0);
    await expectNoSeriousAxe(page);
  });

  test("a photo added on the card with no file type still saves", async ({
    page,
  }) => {
    const { leaked, upload } = await start(page);
    await page.getByRole("button", { name: "Type it myself" }).click();
    await page.getByLabel("What do you call it?").fill("Card photo loaf");
    await fillLines(page, "What went in", "flour\nsalt");
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

  test("a photo scan fills the card, stays editable, and saves", async ({
    page,
  }) => {
    const { leaked } = await start(page);
    await choosePhotos(page, {
      name: "scan-full.jpg",
      mimeType: "image/jpeg",
      buffer: JPEG,
    });
    await expect(
      page.getByText("Filled in from the photo. Change anything that's wrong."),
    ).toBeVisible();
    await expect(
      page.getByText("Read from the photo. Change it if it's wrong."),
    ).toHaveCount(4);
    await expect(page.getByLabel("What do you call it?")).toHaveValue(
      "Sunday stew",
    );
    await expectLines(page, "What went in", "lamb\nonion");
    await expectLines(page, "How", "Simmer");
    await expect(page.getByLabel("How it went")).toHaveValue(
      "Better the next day",
    );
    await fillLines(page, "What went in", "beef\nonion");
    await expectNoSeriousAxe(page);
    await saveFromCard(page, "Sunday stew", leaked, { fillStory: false });
    await expect(page.getByText("beef", { exact: true })).toBeVisible();
    await expect(page.getByText("Better the next day")).toBeVisible();
    await expect(page.getByText("Simmer", { exact: true })).toBeVisible();
  });

  test("a partial scan leaves the blank lines empty and still saves", async ({
    page,
  }) => {
    const { leaked } = await start(page);
    await choosePhotos(page, {
      name: "scan-partial.jpg",
      mimeType: "image/jpeg",
      buffer: JPEG,
    });
    await expect(
      page.getByText("Filled in what I could read. Blank lines are fine."),
    ).toBeVisible();
    await expect(page.getByLabel("What do you call it?")).toHaveValue(
      "Half a card",
    );
    await expectLines(page, "What went in", "");
    await expectLines(page, "How", "");
    await expect(
      page.getByText("Read from the photo. Change it if it's wrong."),
    ).toHaveCount(1);
    await saveFromCard(page, "Half a card", leaked, { fillStory: false });
    await expect(
      page.getByRole("heading", { name: "What went in" }),
    ).toHaveCount(0);
  });

  test("a scan that finds nothing still saves the photo", async ({ page }) => {
    const { leaked } = await start(page);
    await choosePhotos(page, {
      name: "scan-fail.jpg",
      mimeType: "image/jpeg",
      buffer: JPEG,
    });
    await expect(
      page.getByText("Couldn't read words on this. You can still save it."),
    ).toBeVisible();
    await expect(page.getByLabel("What do you call it?")).toHaveValue("scan fail");
    await expectLines(page, "What went in", "");
    await expect(
      page.getByText("Read from the photo. Change it if it's wrong."),
    ).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Put it in the book" })).toBeEnabled();
    await saveFromCard(page, "scan fail", leaked, { fillStory: false });
    await expect(page.getByRole("img", { name: "scan fail" })).toBeVisible();
  });

  test("a scan that errors still opens an editable card", async ({ page }) => {
    const { leaked } = await start(page);
    await choosePhotos(page, {
      name: "scan-throw.jpg",
      mimeType: "image/jpeg",
      buffer: JPEG,
    });
    await expect(
      page.getByText("Couldn't read words on this. You can still save it."),
    ).toBeVisible();
    await expect(page.getByRole("alert")).toHaveCount(0);
    await expect(page.getByLabel("What do you call it?")).toHaveValue(
      "scan throw",
    );
    await page.getByLabel("What do you call it?").fill("Quiet loaf");
    await saveFromCard(page, "Quiet loaf", leaked, { fillStory: false });
  });

  test("several photos are read as one recipe", async ({ page }) => {
    const { leaked } = await start(page);
    await choosePhotos(page, [
      { name: "scan-combine.jpg", mimeType: "image/jpeg", buffer: JPEG },
      { name: "side.jpg", mimeType: "image/jpeg", buffer: JPEG },
    ]);
    await expect(
      page.getByText(
        "Read across the photos. Tap one if it should be the cover. Change anything that's wrong.",
      ),
    ).toBeVisible();
    await expect(page.getByLabel("What do you call it?")).toHaveValue(
      "Sunday stew",
    );
    await expectLines(page, "What went in", "lamb\npotato");
    await saveFromCard(page, "Sunday stew", leaked, { fillStory: false });
    await expect(page.getByText("lamb", { exact: true })).toBeVisible();
    await expect(page.getByText("potato", { exact: true })).toBeVisible();
  });

  test("a link scan fills the card and still saves after an edit", async ({
    page,
  }) => {
    const { leaked } = await start(page);
    await page
      .getByRole("button", { name: "Paste a link — Sally, TikTok, Pinterest" })
      .click();
    await page.locator("#sourceUrl").fill("https://recipes.example.com/scan-full");
    await expect(
      page.getByText("Filled in from the link. Change anything that's wrong."),
    ).toBeVisible();
    await expect(
      page.getByText("Read from the link. Change it if it's wrong."),
    ).toHaveCount(4);
    await expect(page.getByLabel("What do you call it?")).toHaveValue("Link stew");
    await expectLines(page, "What went in", "beans\nstock");
    await fillLines(page, "What went in", "beans\nkale");
    await expect(
      page.getByRole("button", { name: "Put it in the book" }),
    ).toBeEnabled();
    await saveFromCard(page, "Link stew", leaked, { fillStory: false });
    await expect(page.getByText("kale", { exact: true })).toBeVisible();
    await expect(page.getByText("From the page")).toBeVisible();
  });

  test("a link scan that finds nothing leaves the card empty and editable", async ({
    page,
  }) => {
    const { leaked } = await start(page);
    await page
      .getByRole("button", { name: "Paste a link — Sally, TikTok, Pinterest" })
      .click();
    await page.locator("#sourceUrl").fill("https://recipes.example.com/scan-fail");
    await expect(
      page.getByText(
        "Couldn't read words on this link. You can still save it.",
      ),
    ).toBeVisible();
    await expect(page.getByLabel("What do you call it?")).toHaveValue("");
    await expectLines(page, "What went in", "");
    await expect(page.getByRole("button", { name: "Put it in the book" })).toBeEnabled();
    await page.getByLabel("What do you call it?").fill("Quiet soup");
    await saveFromCard(page, "Quiet soup", leaked, { fillStory: false });
    await expect(
      page.getByRole("heading", { name: "What went in" }),
    ).toHaveCount(0);
  });
});

const PHONE_CHOICES = [
  "Take or choose photos",
  "Upload a PDF or PowerPoint",
  "Paste a link — Sally, TikTok, Pinterest",
  "Type it myself",
] as const;

async function expectAboveDock(page: Page, locator: Locator) {
  await locator.scrollIntoViewIfNeeded();
  const box = await locator.boundingBox();
  expect(box).not.toBeNull();
  expect(Math.min(box!.width, box!.height)).toBeGreaterThanOrEqual(44);
  const dockBox = await page.locator(".book-dock").boundingBox();
  expect(dockBox).not.toBeNull();
  expect(box!.y + box!.height).toBeLessThanOrEqual(dockBox!.y + 1);
  return box!;
}

test.describe("add paths at 390", () => {
  test.use({ viewport: { width: 390, height: 844 } });
  test.describe.configure({ timeout: 60_000 });

  test("each add path is a full-width button", async ({ page }) => {
    await start(page);
    const boxes = [];
    for (const name of PHONE_CHOICES) {
      boxes.push(
        await expectAboveDock(
          page,
          page.getByRole("button", { name, exact: true }),
        ),
      );
    }
    const width = boxes[0]!.width;
    for (const box of boxes) {
      expect(Math.abs(box.width - width)).toBeLessThanOrEqual(2);
    }
    const desk = await page.locator(".write-desk").boundingBox();
    expect(width).toBeGreaterThan((desk?.width ?? 0) * 0.9);
    const border = await page
      .getByRole("button", { name: "Type it myself", exact: true })
      .evaluate((el) => getComputedStyle(el).borderTopWidth);
    expect(parseFloat(border)).toBeGreaterThanOrEqual(2);
  });

  test("photo and file pickers offer the camera and the library", async ({
    page,
  }) => {
    await start(page);
    const photos = page
      .waitForEvent("filechooser", { timeout: 3_000 })
      .catch(() => null);
    await page.getByRole("button", { name: "Take or choose photos" }).click();
    await photos;
    const photoInput = page.getByLabel("Recipe photos");
    await expect(photoInput).toHaveAttribute("accept", "image/*");
    await expect(photoInput).toHaveAttribute("multiple", "");
    expect(await photoInput.getAttribute("capture")).toBeNull();

    await page.goto("/add");
    await expect(
      page.getByText("Put it in the book however you already have it"),
    ).toBeVisible();
    const files = page
      .waitForEvent("filechooser", { timeout: 3_000 })
      .catch(() => null);
    await page.getByRole("button", { name: "Upload a PDF or PowerPoint" }).click();
    await files;
    const fileInput = page.getByLabel("Recipe file");
    await expect(fileInput).toHaveAttribute("accept", /pdf/);
    expect(await fileInput.getAttribute("capture")).toBeNull();
  });

  test("typing keeps save, reorder, and a reload draft in reach", async ({
    page,
  }) => {
    await start(page);
    await page.getByRole("button", { name: "Type it myself", exact: true }).click();
    const back = page.getByRole("button", { name: "Add a different way" });
    const backBorder = await back.evaluate(
      (el) => getComputedStyle(el).borderTopWidth,
    );
    expect(parseFloat(backBorder)).toBeGreaterThanOrEqual(2);
    await expect(page.getByLabel("What do you call it?")).toBeFocused();
    const save = await expectAboveDock(
      page,
      page.getByRole("button", { name: "Put it in the book" }),
    );
    const later = await expectAboveDock(
      page,
      page.getByRole("button", { name: "Save for later" }),
    );
    expect(Math.abs(save.width - later.width)).toBeLessThanOrEqual(2);
    const cardPhoto = page.getByLabel("Tap to add a photo");
    await expect(cardPhoto).toHaveAttribute("accept", "image/*");
    expect(await cardPhoto.getAttribute("capture")).toBeNull();

    const step = lineGroup(page, "How").getByRole("textbox");
    await step.focus();
    const stepBox = await step.boundingBox();
    const dockBox = await page.locator(".book-dock").boundingBox();
    expect(stepBox).not.toBeNull();
    expect(dockBox).not.toBeNull();
    expect(stepBox!.y + stepBox!.height).toBeLessThanOrEqual(dockBox!.y + 1);
    const margin = await step.evaluate(
      (el) => getComputedStyle(el).scrollMarginBottom,
    );
    expect(parseFloat(margin)).toBeGreaterThan(40);

    await page.getByLabel("What do you call it?").fill("Sunday toast");
    await fillLines(page, "What went in", "bread\nbutter");
    const group = lineGroup(page, "What went in");
    const up = group.getByRole("button", { name: "Move ingredient 2 up" });
    const upBox = await up.boundingBox();
    expect(upBox).not.toBeNull();
    expect(Math.min(upBox!.width, upBox!.height)).toBeGreaterThanOrEqual(44);
    await up.click();
    await expect(group.getByRole("textbox").nth(0)).toHaveValue("butter");
    await expect.poll(async () =>
      page.evaluate(() => sessionStorage.getItem("write-desk-draft")),
    ).toContain("butter\\nbread");
    await page.reload();
    await expect(page.getByLabel("What do you call it?")).toHaveValue(
      "Sunday toast",
    );
    await expect(page.getByText("Picked up where you left off.")).toBeVisible();
    await expectLines(page, "What went in", "butter\nbread");
  });

  test("typing shows where it came from above the save bar", async ({ page }) => {
    await start(page);
    await page.getByRole("button", { name: "Type it myself", exact: true }).click();
    const mine = page.getByRole("button", { name: "Mine", pressed: true });
    const last = page.getByRole("button", { name: "Pinterest" });
    const mineBox = await mine.boundingBox();
    const lastBox = await last.boundingBox();
    const save = await page
      .getByRole("button", { name: "Put it in the book" })
      .boundingBox();
    expect(mineBox).not.toBeNull();
    expect(lastBox).not.toBeNull();
    expect(save).not.toBeNull();
    expect(mineBox!.y).toBeGreaterThanOrEqual(0);
    expect(lastBox!.y + lastBox!.height).toBeLessThanOrEqual(save!.y + 1);
  });

  test("a pasted link keeps the address field and save above the tab bar", async ({
    page,
  }) => {
    await start(page);
    await page
      .getByRole("button", { name: "Paste a link — Sally, TikTok, Pinterest" })
      .click();
    const url = page.locator("#sourceUrl");
    await expect(url).toBeFocused();
    await expect(url).toHaveAttribute("type", "url");
    await expect(url).toHaveAttribute("enterkeyhint", "go");
    await expect(url).toHaveAttribute("autocapitalize", "off");
    await expectAboveDock(
      page,
      page.getByRole("button", { name: "Put it in the book" }),
    );
  });

  test("a scanned pile keeps its save action above the tab bar", async ({
    page,
  }) => {
    await start(page);
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
    const save = await expectAboveDock(
      page,
      page.getByRole("button", { name: "Put 2 in the book" }),
    );
    const desk = await page.locator(".write-desk").boundingBox();
    expect(save.width).toBeGreaterThan((desk?.width ?? 0) * 0.9);
    const fix = page.getByRole("button", { name: "Open and fix" }).first();
    const fixBox = await expectAboveDock(page, fix);
    const columnBox = await fix.locator("xpath=..").boundingBox();
    expect(fixBox.width).toBeGreaterThan((columnBox?.width ?? 0) * 0.9);
    const fixBorder = await fix.evaluate(
      (el) => getComputedStyle(el).borderTopWidth,
    );
    expect(parseFloat(fixBorder)).toBeGreaterThanOrEqual(2);
  });

  test("a missing name explains itself above the tab bar", async ({ page }) => {
    await start(page);
    await page.getByRole("button", { name: "Type it myself" }).click();
    await page.getByRole("button", { name: "Put it in the book" }).click();
    const alert = page.getByRole("alert");
    await expect(alert).toHaveText("Give it a name so you can find it later.");
    const box = await alert.boundingBox();
    const save = await page
      .getByRole("button", { name: "Put it in the book" })
      .boundingBox();
    const dock = await page.locator(".book-dock").boundingBox();
    expect(box).not.toBeNull();
    expect(save).not.toBeNull();
    expect(dock).not.toBeNull();
    expect(box!.y).toBeGreaterThanOrEqual(0);
    expect(box!.y + box!.height).toBeLessThanOrEqual(save!.y + 1);
    expect(save!.y + save!.height).toBeLessThanOrEqual(dock!.y + 1);
  });
});
