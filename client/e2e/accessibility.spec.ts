import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";

async function expectNoA11yViolations(page: Page) {
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);
}

test.describe("Accessibility audit", () => {
  test("public pages should have no axe violations", async ({ page }) => {
    for (const path of ["/", "/market", "/about"]) {
      await page.goto(path);
      await expectNoA11yViolations(page);
    }
  });

  test("skip link should move focus to the main landmark", async ({ page }) => {
    await page.goto("/");

    await page.keyboard.press("Tab");
    const skipLink = page.getByRole("link", { name: /skip to main content/i });
    await expect(skipLink).toBeFocused();

    await skipLink.press("Enter");
    await expect(page.locator("#main-content")).toBeFocused();
  });

  test("mobile navigation should remain accessible", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");

    await expectNoA11yViolations(page);
    await expect(page.getByRole("navigation", { name: /mobile navigation/i })).toBeVisible();
  });
});
