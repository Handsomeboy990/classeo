import type { Page } from "@playwright/test";

import { PARTNER_EMAIL, PASSWORD } from "./support/accounts";
import { expect, passwordField, test, uniqueSuffix } from "./support/fixtures";

// Public pages for signed out visitors: the home page and the sign in page
// in Fongbe or Yoruba, rendered on the server from the translations shipped
// with the seed (no call to the translation service), and the photo
// credits. The voice is not exercised here (slow, and quota bound).

const FRENCH_TITLE = "L'école béninoise, du ministère à la maison.";

// The language select, whatever its label reads in the current language.
const languageSelect = (page: Page) => page.locator("header select[name=lang]");

async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow, "horizontal overflow in pixels").toBeLessThanOrEqual(0);
}

test("a visitor reads the home page in Fongbe, then back in French @mobile", async ({ page }) => {
  await page.goto("/");
  const heading = page.getByRole("heading", { level: 1 });
  await expect(heading).toHaveText(FRENCH_TITLE);
  await expect(page.locator("#page-content")).toHaveAttribute("lang", "fr");

  // A choice made before hydration is reset to the controlled value: pick
  // again until the page answers.
  await expect(async () => {
    await languageSelect(page).selectOption("fon");
    await expect(page).toHaveURL(/\?lang=fon$/, { timeout: 3_000 });
  }).toPass({ timeout: 20_000 });
  await expect(heading).not.toHaveText(FRENCH_TITLE);
  await expect(page.locator("#page-content")).toHaveAttribute("lang", "fon");
  // The voice follows the page, and names stay as written.
  await expect(page.locator("header select[name=voix]")).toHaveValue("fon");
  await expect(page.getByText("République du Bénin")).toBeVisible();
  await expect(page.getByText(/DEGAN Gabin, CC BY-SA 4\.0/)).toBeVisible();
  await expectNoHorizontalScroll(page);

  // The choice follows the visitor to the sign in page.
  await expect(page.locator("a[href='/connexion?lang=fon']").first()).toBeVisible();

  await languageSelect(page).selectOption("fr");
  await expect(page).toHaveURL(/\/$/);
  await expect(heading).toHaveText(FRENCH_TITLE);
  await expect(page.locator("#page-content")).toHaveAttribute("lang", "fr");
});

test("the voice language is chosen apart from the page", async ({ page }) => {
  await page.goto("/?lang=yo&voix=fr");
  await expect(page.locator("#page-content")).toHaveAttribute("lang", "yo");
  await expect(page.locator("header select[name=voix]")).toHaveValue("fr");
  await expect(page.locator("header select[name=lang]")).toHaveValue("yo");
  // The listen button names the voice it will use.
  const listen = page.locator("main button[aria-pressed]");
  await expect(listen).toBeVisible();
  await expect(listen).not.toContainText("Fongbe");

  await expect(async () => {
    await page.locator("header select[name=voix]").selectOption("fon");
    await expect(page).toHaveURL(/\?lang=yo&voix=fon$/, { timeout: 3_000 });
  }).toPass({ timeout: 20_000 });
  await expect(listen).toContainText("Fongbe");
});

test("the photo credits are reached from the footer, every photograph credited @mobile", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("contentinfo").getByRole("link", { name: "Crédits photos" }).click();
  await expect(page).toHaveURL(/\/credits$/);
  await expect(page.getByRole("heading", { level: 1, name: "Crédits photos" })).toBeVisible();

  const items = page.locator("main ol > li");
  await expect(items).toHaveCount(5);
  for (const item of await items.all()) {
    await expect(item.getByRole("img")).toHaveAttribute("alt", /.{20,}/);
    await expect(item.getByRole("heading", { level: 2 })).toBeVisible();
    await expect(item.getByRole("link", { name: "Voir l'original sur Wikimedia Commons" })).toHaveAttribute("href", /^https:\/\/commons\.wikimedia\.org\/wiki\/File:/);
    await expect(item.getByText(/CC BY 4\.0|CC BY-SA 4\.0|Domaine public/).first()).toBeVisible();
    await expect(item.getByText(/Redimensionnée/)).toBeVisible();
  }
  for (const author of ["Thomas Dorn", "Rofik Adam", "DEGAN Gabin", "Kulttuurinavigaattori", "Peace Corps"]) await expect(page.locator("main")).toContainText(author);
  await expectNoHorizontalScroll(page);

  // The raw file stays in step for the repository.
  const md = await page.request.get("/images/CREDITS.md");
  expect(md.ok()).toBe(true);
});

test.describe("sign in page", () => {
  test("a wrong password is shown in the form, the right one signs in @mobile", async ({ page }) => {
    await page.goto("/connexion");
    await expect(page.getByRole("heading", { level: 1, name: "Connexion" })).toBeVisible();
    await page.getByLabel("Identifiant").fill(PARTNER_EMAIL);
    await passwordField(page).fill("not-the-password-2026");

    // The password can be read before sending.
    const toggle = page.getByRole("button", { name: "Afficher le mot de passe" });
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-pressed", "true");
    await expect(passwordField(page)).toHaveAttribute("type", "text");

    await page.getByRole("button", { name: "Se connecter" }).click();
    const alert = page.getByRole("alert").filter({ hasText: "Identifiant ou mot de passe incorrect." });
    await expect(alert).toBeVisible();
    await expect(alert).toContainText("Connexion impossible");
    await expect(page).toHaveURL(/\/connexion/);
    // What was typed is kept.
    await expect(page.getByLabel("Identifiant")).toHaveValue(PARTNER_EMAIL);

    await passwordField(page).fill(PASSWORD);
    await page.getByRole("button", { name: "Se connecter" }).click();
    await expect(page).toHaveURL(/\/espace$/);
    await expect(page.getByRole("heading", { level: 1, name: /^Bonjour, Estelle$/ })).toBeVisible();
  });

  test("the identifier is explained, and the page offers the language and the voice @mobile", async ({ page }) => {
    await page.goto("/connexion");
    await expect(page.getByText("Votre prénom et votre nom, séparés par un point.")).toBeVisible();
    await page.getByText("Où trouver mon identifiant ?").click();
    await expect(page.getByText("Aucune adresse e-mail n'est nécessaire.", { exact: false })).toBeVisible();
    await expect(page.getByLabel("Langue", { exact: true })).toHaveValue("fr");
    await expect(page.getByLabel("Voix", { exact: true })).toHaveValue("fr");
    await expect(page.getByRole("link", { name: "Crédits photos" })).toHaveAttribute("href", "/credits");
    await expectNoHorizontalScroll(page);
  });

  test("in Yoruba, the page and its refusal are translated @mobile", async ({ page }) => {
    await page.goto("/connexion?lang=yo&next=%2Fespace%2Fnotes");
    await expect(page.locator("#page-content")).toHaveAttribute("lang", "yo");
    const heading = page.getByRole("heading", { level: 1 });
    await expect(heading).not.toHaveText("Connexion");
    // The way to the forgotten password page keeps the language.
    await expect(page.locator("a[href='/mot-de-passe-oublie?lang=yo']")).toBeVisible();

    // An unknown identifier: the same refusal, and no real account counts
    // a failure.
    await page.locator("input[name=login]").fill(`inconnu.${uniqueSuffix().replace(/[^a-z]/g, "")}`);
    await passwordField(page).fill("not-the-password-2026");
    const refusal = page.locator("main").getByRole("alert");
    await expect(async () => {
      await page.locator("form button[type=submit]").click();
      await expect(refusal).toBeVisible({ timeout: 5_000 });
    }).toPass({ timeout: 20_000 });
    await expect(refusal).not.toContainText("Identifiant ou mot de passe incorrect.");

    // Back to French, keeping where to go after signing in.
    await page.locator("main select[name=lang]").selectOption("fr");
    await expect(page).toHaveURL(/\/connexion\?next=%2Fespace%2Fnotes$/);
    await expect(heading).toHaveText("Connexion");
  });
});
