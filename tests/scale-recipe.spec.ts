import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.__A11Y_SIGNED_IN__ = true;
  });
});

test("batch size changes amounts on a phone", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/bakes/sunday-muffins");
  await expect(page.getByRole("heading", { name: "Sunday muffins" })).toBeVisible();

  const ingredients = page.getByRole("list").filter({ hasText: "flour" });
  await expect(ingredients).toContainText("2 cups flour");
  await expect(ingredients).toContainText("1 cup sugar");
  await expect(ingredients).toContainText("2 eggs");
  await expect(page.getByText("12 muffins", { exact: true })).toBeVisible();

  const half = page.getByRole("button", { name: "½×", exact: true });
  const original = page.getByRole("button", { name: "1×", exact: true });
  const double = page.getByRole("button", { name: "2×", exact: true });

  for (const button of [half, original, double]) {
    const box = await button.boundingBox();
    expect(box).toBeTruthy();
    expect(box!.width).toBeGreaterThanOrEqual(44);
    expect(box!.height).toBeGreaterThanOrEqual(44);
  }

  await double.click();
  await expect(double).toHaveAttribute("aria-pressed", "true");
  await expect(ingredients).toContainText("4 cups flour");
  await expect(ingredients).toContainText("2 cups sugar");
  await expect(ingredients).toContainText("4 eggs");
  await expect(page.getByText("24 muffins", { exact: true })).toBeVisible();
  await expect(page.getByText(/Amounts are for double the recipe/)).toBeVisible();

  await half.click();
  await expect(half).toHaveAttribute("aria-pressed", "true");
  await expect(ingredients).toContainText("1 cup flour");
  await expect(ingredients).toContainText("½ cup sugar");
  await expect(ingredients).toContainText("1 egg");
  await expect(page.getByText("6 muffins", { exact: true })).toBeVisible();

  await original.click();
  await expect(original).toHaveAttribute("aria-pressed", "true");
  await expect(ingredients).toContainText("2 cups flour");
  await expect(ingredients).toContainText("1 cup sugar");
  await expect(ingredients).toContainText("2 eggs");
  await expect(page.getByText("12 muffins", { exact: true })).toBeVisible();
  await expect(page.getByText(/Amounts are for/)).toHaveCount(0);
});
