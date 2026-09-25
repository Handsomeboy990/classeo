import { authFile } from "./support/accounts";
import { expect, test } from "./support/fixtures";

// Journey 9: accessibility smoke checks on the parent's space and the public
// pages.
test.describe("parent space", () => {
  test.use({ storageState: authFile("parent") });

  test("the skip link moves focus to the main content @mobile", async ({ page }) => {
    await page.goto("/espace");
    await expect(page.getByRole("heading", { level: 1, name: "Bonjour, Afiavi" })).toBeVisible();

    await page.keyboard.press("Tab");
    const skip = page.getByRole("link", { name: "Aller au contenu principal" });
    await expect(skip).toBeFocused();
    await expect(skip).toBeInViewport();

    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/#page-content$/);
    await expect(page.getByRole("main")).toBeFocused();
  });

  test("the accessibility dialog switches to high contrast @mobile", async ({ page }) => {
    await page.goto("/espace");
    const html = page.locator("html");
    await expect(html).toHaveAttribute("data-contrast", "normal");

    await page.getByRole("button", { name: "Réglages d'accessibilité" }).click();
    const dialog = page.getByRole("dialog", { name: "Accessibilité" });
    await expect(dialog).toBeVisible();

    const contrast = dialog.getByRole("group", { name: "Contraste" });
    await contrast.getByText("Élevé").click();
    await expect(contrast.getByRole("radio", { name: "Élevé" })).toBeChecked();
    await expect(html).toHaveAttribute("data-contrast", "high");

    // Kept on this device across pages.
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await page.reload();
    await expect(html).toHaveAttribute("data-contrast", "high");
  });
});

// Journey 9, responsive: nothing overflows sideways at 375 px.
async function expectNoHorizontalScroll(page: import("@playwright/test").Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow, "horizontal overflow in pixels").toBeLessThanOrEqual(0);
}

test.describe("at 375 px", () => {
  test("no horizontal scroll on / and /connexion @mobile-only", async ({ page }) => {
    expect(page.viewportSize()?.width).toBe(375);

    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expectNoHorizontalScroll(page);

    await page.goto("/connexion");
    await expect(page.getByRole("heading", { level: 1, name: "Connexion" })).toBeVisible();
    await expectNoHorizontalScroll(page);
  });

  test.describe("signed in as parent", () => {
    test.use({ storageState: authFile("parent") });

    test("no horizontal scroll on /espace @mobile-only", async ({ page }) => {
      expect(page.viewportSize()?.width).toBe(375);
      await page.goto("/espace");
      await expect(page.getByRole("heading", { level: 1, name: "Bonjour, Afiavi" })).toBeVisible();
      await expectNoHorizontalScroll(page);
    });
  });
});
