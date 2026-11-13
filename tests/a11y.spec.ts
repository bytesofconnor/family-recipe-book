import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { FIXTURE_BAKE_ID } from "../src/test/a11yFixtureData";

declare global {
  interface Window {
    __A11Y_SIGNED_IN__?: boolean;
    __A11Y_ADMIN__?: boolean;
  }
}

/**
 * Enforced accessibility checks. Public pages render without a live Convex
 * backend. Signed-in write-desk, edit, You, family, and admin/editor pages
 * use the local `vite --mode a11y` fixture (generic kitchen data, no
 * production backend, no real credentials).
 */

const VIEWPORTS = [
  { name: "desktop", width: 1280, height: 800 },
  { name: "mobile", width: 390, height: 844 },
] as const;

const WCAG_AA_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] as const;
const FAIL_IMPACTS = new Set(["serious", "critical"]);
const MIN_TAP = 44;
const SCREENSHOT_DIRS = [
  "/opt/cursor/artifacts/screenshots",
  "test-results/a11y-screenshots",
];

type ScanPage = {
  name: string;
  path: string;
  ready: string;
  controls: string[];
  docked?: boolean;
};

const PUBLIC_PAGES: ScanPage[] = [
  {
    name: "join cover",
    path: "/join",
    ready: "Continue with Google",
    controls: ["Continue with Google", "Join", "FAQ"],
    docked: true,
  },
  {
    name: "invite door",
    path: "/join?invite=family-link",
    ready: "You’ve been invited",
    controls: ["Continue with Google", "Join", "FAQ"],
    docked: true,
  },
  {
    name: "FAQ",
    path: "/faq",
    ready: "Before you open the book.",
    controls: ["Join", "FAQ", "Who’s it for?"],
    docked: true,
  },
  {
    name: "invalid slip",
    path: "/slip/short",
    ready: "This slip doesn’t open.",
    controls: [],
    docked: false,
  },
];

const SIGNED_IN_PAGES: ScanPage[] = [
  {
    name: "write desk",
    path: "/add",
    ready: "Put it in the book however you already have it",
    controls: [
      "Take or choose photos",
      "Upload a PDF or PowerPoint",
      "Type it myself",
      "Add a recipe",
      "Recipes",
    ],
    docked: true,
  },
  {
    name: "recipe edit form",
    path: `/add?edit=${FIXTURE_BAKE_ID}`,
    ready: "How we made it",
    controls: ["Save changes", "Cancel", "Edit a recipe"],
    docked: true,
  },
  {
    name: "you editor",
    path: "/you",
    ready: "Call me",
    controls: ["Save", "Add a photo", "Sign out", "You", "Family"],
    docked: true,
  },
  {
    name: "family editor",
    path: "/you/family",
    ready: "Invite someone",
    controls: ["Copy a share link", "You", "Family"],
    docked: true,
  },
];

const ADMIN_PAGES: ScanPage[] = [
  {
    name: "admin preview",
    path: "/add",
    ready: "Try a month",
    controls: ["Hide", "Now", "Me"],
    docked: true,
  },
];

function formatViolations(
  violations: Awaited<ReturnType<AxeBuilder["analyze"]>>["violations"],
) {
  return violations
    .map((violation) => {
      const nodes = violation.nodes
        .map((node) => `    - ${node.target.join(" ")}`)
        .join("\n");
      return `  ${violation.id} [${violation.impact}] ${violation.help}\n${nodes}`;
    })
    .join("\n");
}

async function preparePage(
  page: Page,
  route: ScanPage,
  viewport: (typeof VIEWPORTS)[number],
  shotPrefix?: string,
) {
  await page.setViewportSize({
    width: viewport.width,
    height: viewport.height,
  });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(route.path);
  await expect(
    page.getByText(route.ready, { exact: false }).first(),
  ).toBeVisible({ timeout: 20_000 });

  if (shotPrefix) {
    const file = `${shotPrefix}-${viewport.name}.png`;
    for (const dir of SCREENSHOT_DIRS) {
      await mkdir(dir, { recursive: true });
      await page.screenshot({
        path: `${dir}/${file}`,
        fullPage: true,
      });
    }
  }
}

function visibleControl(page: Page, name: string): Locator {
  return page.getByRole("button", { name }).or(page.getByRole("link", { name }));
}

async function firstVisible(locator: Locator): Promise<Locator | null> {
  const count = await locator.count();
  for (let index = 0; index < count; index += 1) {
    const candidate = locator.nth(index);
    if (await candidate.isVisible()) {
      return candidate;
    }
  }
  return null;
}

async function tabToControl(page: Page, name: string) {
  const control = await firstVisible(visibleControl(page, name));
  expect(control, `Expected a visible control named "${name}"`).not.toBeNull();

  for (let step = 0; step < 64; step += 1) {
    await page.keyboard.press("Tab");
    const focused = await control!.evaluate(
      (node) =>
        node === document.activeElement || node.contains(document.activeElement),
    );
    if (focused) {
      return control!;
    }
  }

  throw new Error(`Keyboard tab order never reached "${name}"`);
}

async function focusedHasVisibleRing(page: Page) {
  return page.evaluate(() => {
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
}

async function expectNoBlockingAxe(
  page: Page,
  route: ScanPage,
  viewport: (typeof VIEWPORTS)[number],
) {
  const results = await new AxeBuilder({ page })
    .withTags([...WCAG_AA_TAGS])
    .analyze();

  const blocking = results.violations.filter((violation) =>
    FAIL_IMPACTS.has(violation.impact ?? ""),
  );

  expect(
    blocking,
    blocking.length
      ? `Serious/critical a11y violations on ${route.path} (${viewport.name}):\n${formatViolations(blocking)}`
      : undefined,
  ).toEqual([]);
}

async function expectKeyboardAndFocus(
  page: Page,
  routes: ScanPage[],
  viewport: (typeof VIEWPORTS)[number],
  open: (page: Page, route: ScanPage, viewport: (typeof VIEWPORTS)[number]) => Promise<void>,
) {
  for (const route of routes.filter((item) => item.controls.length > 0)) {
    await open(page, route, viewport);

    for (const name of route.controls) {
      const control = await firstVisible(visibleControl(page, name));
      if (!control) {
        continue;
      }
      await tabToControl(page, name);
      expect(
        await focusedHasVisibleRing(page),
        `Focused "${name}" on ${route.path} (${viewport.name}) has no visible focus ring`,
      ).toBe(true);
    }
  }
}

async function expectTapTargets(
  page: Page,
  routes: ScanPage[],
  extraNames: (route: ScanPage) => string[],
  open: (page: Page, route: ScanPage, viewport: (typeof VIEWPORTS)[number]) => Promise<void>,
) {
  const viewport = VIEWPORTS.find((item) => item.name === "mobile")!;

  for (const route of routes) {
    await open(page, route, viewport);

    for (const name of [...route.controls, ...extraNames(route)]) {
      const control = await firstVisible(visibleControl(page, name));
      if (!control) {
        continue;
      }
      const box = await control.boundingBox();
      expect(box, `Missing box for "${name}" on ${route.path}`).toBeTruthy();
      expect(
        box!.width,
        `"${name}" on ${route.path} is ${box!.width.toFixed(1)}px wide`,
      ).toBeGreaterThanOrEqual(MIN_TAP);
      expect(
        box!.height,
        `"${name}" on ${route.path} is ${box!.height.toFixed(1)}px tall`,
      ).toBeGreaterThanOrEqual(MIN_TAP);
    }
  }
}

async function expectDockClearance(
  page: Page,
  routes: ScanPage[],
  open: (page: Page, route: ScanPage, viewport: (typeof VIEWPORTS)[number]) => Promise<void>,
) {
  const viewport = VIEWPORTS.find((item) => item.name === "mobile")!;
  const docked = routes.filter((route) => route.docked !== false);

  for (const route of docked) {
    await open(page, route, viewport);

    const dock = page.locator(".book-dock");
    await expect(dock, `Dock missing on ${route.path}`).toBeVisible();
    const dockBox = await dock.boundingBox();
    expect(dockBox).toBeTruthy();

    await page.evaluate(() => {
      const root = document.scrollingElement;
      root?.scrollTo(0, root.scrollHeight);
    });

    const hidden = await page.evaluate((dockTop) => {
      const blocked: string[] = [];
      const candidates = document.querySelectorAll(
        "h1, .book-cover-cta, .book-cover-proof, .book-back-proof, .site-footer",
      );

      for (const node of candidates) {
        if (!(node instanceof HTMLElement)) {
          continue;
        }
        if (node.closest("[inert], [aria-hidden='true']")) {
          continue;
        }
        const styles = getComputedStyle(node);
        if (styles.display === "none" || styles.visibility === "hidden") {
          continue;
        }
        const rect = node.getBoundingClientRect();
        if (rect.height < 8 || rect.width < 8) {
          continue;
        }
        if (rect.bottom > dockTop + 4) {
          blocked.push(
            `${node.tagName.toLowerCase()}${node.className ? `.${String(node.className).split(" ")[0]}` : ""} bottom=${Math.round(rect.bottom)} dock=${Math.round(dockTop)}`,
          );
        }
      }

      return blocked;
    }, dockBox!.y);

    expect(
      hidden,
      `Content sits under the dock on ${route.path}:\n${hidden.join("\n")}`,
    ).toEqual([]);
  }
}

test.describe("public page accessibility", () => {
  for (const viewport of VIEWPORTS) {
    for (const route of PUBLIC_PAGES) {
      test(`${route.name} @ ${viewport.name}: no serious/critical WCAG 2.1 AA`, async ({
        page,
      }) => {
        await preparePage(page, route, viewport);
        await expectNoBlockingAxe(page, route, viewport);
      });
    }

    test(`keyboard reaches main controls with visible focus @ ${viewport.name}`, async ({
      page,
    }) => {
      await expectKeyboardAndFocus(
        page,
        PUBLIC_PAGES,
        viewport,
        preparePage,
      );
    });
  }

  test("mobile primary controls are at least 44x44", async ({ page }) => {
    await expectTapTargets(
      page,
      PUBLIC_PAGES,
      (route) => (route.path === "/faq" ? ["Front cover"] : []),
      preparePage,
    );
  });

  test("mobile dock does not hide page content", async ({ page }) => {
    await expectDockClearance(page, PUBLIC_PAGES, preparePage);
  });
});

test.describe("signed-in page accessibility", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.__A11Y_SIGNED_IN__ = true;
    });
  });

  for (const viewport of VIEWPORTS) {
    for (const route of SIGNED_IN_PAGES) {
      test(`${route.name} @ ${viewport.name}: no serious/critical WCAG 2.1 AA`, async ({
        page,
      }) => {
        await preparePage(
          page,
          route,
          viewport,
          `a11y-${route.name.replace(/\s+/g, "-")}`,
        );
        await expectNoBlockingAxe(page, route, viewport);
      });
    }

    test(`keyboard reaches signed-in controls with visible focus @ ${viewport.name}`, async ({
      page,
    }) => {
      await expectKeyboardAndFocus(
        page,
        SIGNED_IN_PAGES,
        viewport,
        preparePage,
      );
    });
  }

  test("mobile signed-in primary controls are at least 44x44", async ({
    page,
  }) => {
    await expectTapTargets(page, SIGNED_IN_PAGES, () => [], preparePage);
  });

  test("mobile dock does not hide signed-in page content", async ({ page }) => {
    await expectDockClearance(page, SIGNED_IN_PAGES, preparePage);
  });
});

test.describe("admin editor accessibility", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.__A11Y_SIGNED_IN__ = true;
      window.__A11Y_ADMIN__ = true;
    });
  });

  for (const viewport of VIEWPORTS) {
    for (const route of ADMIN_PAGES) {
      test(`${route.name} @ ${viewport.name}: no serious/critical WCAG 2.1 AA`, async ({
        page,
      }) => {
        await preparePage(
          page,
          route,
          viewport,
          `a11y-${route.name.replace(/\s+/g, "-")}`,
        );
        await expectNoBlockingAxe(page, route, viewport);
      });
    }

    test(`keyboard reaches admin controls with visible focus @ ${viewport.name}`, async ({
      page,
    }) => {
      await expectKeyboardAndFocus(page, ADMIN_PAGES, viewport, preparePage);
    });
  }

  test("mobile admin primary controls are at least 44x44", async ({ page }) => {
    await expectTapTargets(page, ADMIN_PAGES, () => [], preparePage);
  });
});

test.describe("public join and FAQ phone polish", () => {
  const creditPages = ["/join", "/join?invite=family-link", "/faq"] as const;

  for (const viewport of VIEWPORTS) {
    test(`footer credit has no Home link @ ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize({
        width: viewport.width,
        height: viewport.height,
      });
      await page.emulateMedia({ reducedMotion: "reduce" });

      for (const path of creditPages) {
        await page.goto(path);
        await expect(
          page.getByRole("link", { name: "Home" }),
          `Home link still in the credit on ${path}`,
        ).toHaveCount(0);
        const nav =
          viewport.name === "mobile"
            ? page.locator(".book-dock")
            : page.locator(".book-bookmarks");
        await expect(nav).toBeVisible();
      }
    });
  }

  test("mobile FAQ page scroll clears the last open answer from the dock", async ({
    page,
  }) => {
    const viewport = VIEWPORTS.find((item) => item.name === "mobile")!;
    await page.setViewportSize({
      width: viewport.width,
      height: viewport.height,
    });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/faq");
    await expect(
      page.getByRole("heading", { name: "Before you open the book." }),
    ).toBeVisible();

    await page.evaluate(() => {
      for (const node of document.querySelectorAll("details.book-back-item")) {
        if (node instanceof HTMLDetailsElement) {
          node.open = true;
        }
      }
    });

    await page.evaluate(() => {
      const root = document.scrollingElement;
      root?.scrollTo(0, root.scrollHeight);
    });

    const answer = page.getByText("fill in the recipe whenever.");
    await expect(answer).toBeVisible();
    const answerBox = await answer.boundingBox();
    const dockBox = await page.locator(".book-dock").boundingBox();
    expect(answerBox, "Last FAQ answer has no box").toBeTruthy();
    expect(dockBox, "Dock has no box").toBeTruthy();
    expect(
      answerBox!.y + answerBox!.height,
      "Last FAQ answer still sits under the dock after scrolling the page",
    ).toBeLessThanOrEqual(dockBox!.y - 8);
  });
});
