import { expect, test as base, type BrowserContext, type Locator, type Page } from "@playwright/test";

import { authFile, PASSWORD, type Role } from "./accounts";

type Fixtures = {
  // Opens a page already signed in as another role, from the session saved
  // by auth.setup.ts. Never signs in again: the login is rate limited.
  pageAs: (role: Role) => Promise<Page>;
};

export const test = base.extend<Fixtures>({
  // The fixture callback is named `provide` rather than `use`, which the
  // React hooks lint rule would take for a hook.
  pageAs: async ({ browser, baseURL, viewport, isMobile, hasTouch, locale, timezoneId }, provide) => {
    const contexts: BrowserContext[] = [];
    await provide(async (role) => {
      const context = await browser.newContext({
        baseURL,
        viewport,
        isMobile,
        hasTouch,
        locale,
        timezoneId,
        serviceWorkers: "block",
        storageState: authFile(role),
      });
      contexts.push(context);
      return context.newPage();
    });
    await Promise.all(contexts.map((c) => c.close()));
  },
});

export { expect };

// Signs in through the form. Used by the setup project and the wrong
// password journey only.
export async function signIn(page: Page, email: string, password = PASSWORD) {
  await page.goto("/connexion");
  await page.getByLabel("Adresse e-mail").fill(email);
  await passwordField(page).fill(password);
  await page.getByRole("button", { name: "Se connecter" }).click();
}

// The one CSS selector of the suite: the label "Mot de passe" also matches
// the "Afficher le mot de passe" button, and the required asterisk keeps an
// exact label query from matching the field.
export function passwordField(page: Page) {
  return page.locator("input[name=password]");
}

// The main menu. Below the desktop breakpoint it lives in a sheet opened
// from the "Menu" tab of the bottom tab bar.
export async function mainMenu(page: Page): Promise<Locator> {
  const width = page.viewportSize()?.width ?? 1366;
  if (width < 1024) {
    await page.getByRole("navigation", { name: "Navigation rapide" }).getByRole("button", { name: "Menu", exact: true }).click();
    const drawer = page.getByRole("dialog", { name: "Menu" });
    await expect(drawer).toBeVisible();
    return drawer.getByRole("navigation", { name: "Menu principal" });
  }
  return page.getByRole("navigation", { name: "Menu principal" });
}

// The 403 page rendered by forbidden().
export async function expectForbidden(page: Page) {
  await expect(page.getByRole("heading", { name: "Accès refusé", level: 1 })).toBeVisible();
  await expect(page.getByText("Votre rôle ne donne pas accès à cette page.")).toBeVisible();
}

// Unique per run and per worker, so parallel or repeated runs never collide.
export function uniqueSuffix() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}
