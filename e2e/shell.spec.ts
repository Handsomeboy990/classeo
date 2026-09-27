import type { Page } from "@playwright/test";

import { authFile } from "./support/accounts";
import { chooseLanguage, expect, mainMenu, test } from "./support/fixtures";

// The private space shell in the official style (design source of truth,
// parts 3.4 to 3.6): tricolour rules, navy bars, the current menu entry,
// the app footer and the independence notice on every page, readable above
// the phone tab bar.

const NOTICE = "Plateforme indépendante, non officielle. Non affiliée au Gouvernement du Bénin.";
const YELLOW = "rgb(252, 209, 22)";
const NAVY = "rgb(10, 55, 100)";

function footer(page: Page) {
  return page.locator("footer[data-app-footer]");
}

// The whole sentence, visible without any interaction.
async function expectNotice(page: Page) {
  const notice = footer(page).locator("[data-independence-notice]");
  await expect(notice).toBeVisible();
  await expect(notice).toContainText(NOTICE);
}

test.describe("head of school", () => {
  test.use({ storageState: authFile("directeur") });

  test("every page of the space ends with the footer and the notice @mobile", async ({ page }) => {
    for (const path of ["/espace", "/espace/eleves", "/espace/classes", "/espace/messages", "/espace/aide"]) {
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await expectNotice(page);
      const links = footer(page).getByRole("navigation", { name: "Liens du pied de page" });
      await expect(links.getByRole("link", { name: "Aide" })).toHaveAttribute("href", "/espace/aide");
      await expect(links.getByRole("link", { name: "Vérifier un document" })).toHaveAttribute("href", "/verifier");
      await expect(links.getByRole("link", { name: "Crédits photos" })).toHaveAttribute("href", "/credits");
    }
  });

  test("at the end of a page, nothing covers the footer @mobile", async ({ page }) => {
    await page.goto("/espace");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    const links = footer(page).getByRole("navigation", { name: "Liens du pied de page" });
    await expect(links).toBeInViewport();
    const bottom = await links.evaluate((el) => el.getBoundingClientRect().bottom);
    const tabBar = page.locator("[data-tab-bar]");
    if (await tabBar.isVisible()) {
      const top = await tabBar.evaluate((el) => el.getBoundingClientRect().top);
      expect(bottom, "footer links end above the tab bar").toBeLessThanOrEqual(top);
      const fab = await page.locator(".a11y-fab").evaluate((el) => el.getBoundingClientRect().top);
      expect(bottom, "footer links end above the accessibility button").toBeLessThanOrEqual(fab);
    }
  });

  test("the large screen shell: tricolour rule, navy bars, current entry in yellow", async ({ page, isMobile }) => {
    test.skip(isMobile, "large screens only");
    await page.goto("/espace/eleves");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

    const rule = page.locator("[data-top-rule]");
    await expect(rule).toBeVisible();
    expect(await rule.evaluate((el) => el.getBoundingClientRect().toJSON())).toMatchObject({ top: 0, height: 4 });
    await expect(page.locator("[data-top-bar]")).toHaveCSS("background-color", NAVY);
    await expect(page.locator("aside").getByRole("link", { name: "Classéo, accueil" })).toBeVisible();

    const current = (await mainMenu(page)).locator("a[aria-current=page]");
    await expect(current).toHaveCount(1);
    await expect(current).toHaveAttribute("href", "/espace/eleves");
    await expect(current.locator("svg").first()).toHaveCSS("color", YELLOW);

    // Keyboard: the focus ring on the navy menu is the flag yellow.
    const entry = page.locator("aside a[href='/espace/classes']");
    await entry.focus();
    await page.keyboard.press("Shift+Tab");
    await page.keyboard.press("Tab");
    await expect(entry).toBeFocused();
    await expect(entry).toHaveCSS("outline-color", YELLOW);
  });

  test("the phone shell: navy app bar over its tricolour rule, the notice in the Menu sheet @mobile-only", async ({ page }) => {
    await page.goto("/espace");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    const bar = page.locator("[data-app-bar]");
    await expect(bar.getByRole("link", { name: "Classéo, accueil" })).toBeVisible();
    await expect(bar.locator("..")).toHaveCSS("background-color", NAVY);
    for (const target of [bar.getByRole("link", { name: /^Notifications/ }), bar.getByRole("button", { name: "Mon compte" })]) {
      const box = await target.boundingBox();
      expect(box?.width).toBeGreaterThanOrEqual(44);
      expect(box?.height).toBeGreaterThanOrEqual(44);
    }

    await mainMenu(page);
    const sheet = page.getByRole("dialog", { name: "Menu" });
    const notice = sheet.locator("[data-independence-notice]");
    await notice.scrollIntoViewIfNeeded();
    await expect(notice).toBeVisible();
    await expect(notice).toContainText(NOTICE);
  });
});

test.describe("parent", () => {
  test.use({ storageState: authFile("parent") });

  test("in Fongbe, the French notice holds and its translation follows in brackets", async ({ page }) => {
    await page.goto("/espace");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await chooseLanguage(page, "Fongbe");
    await expect(page.locator("#page-content")).toHaveAttribute("lang", "fon");
    await page.keyboard.press("Escape");

    const notice = footer(page).locator("[data-independence-notice]");
    await expect(notice.locator("[lang=fr][translate=no]")).toHaveText(NOTICE);
    await expect(notice).toContainText("(");
    // The bracketed copy is translated, not left in French.
    await expect.poll(async () => (await notice.textContent())?.split(NOTICE).length ?? 0).toBe(2);

    await chooseLanguage(page, "Français");
    await expect(notice).toHaveText(NOTICE);
  });
});
