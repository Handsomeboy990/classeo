import type { Locator, Page } from "@playwright/test";

import { PARTNER_EMAIL, PASSWORD } from "./support/accounts";
import { chooseLanguage, expect, languageMenu, passwordField, test, uniqueSuffix } from "./support/fixtures";

// Public pages for signed out visitors: the home page and the sign in page
// in Fongbe or Yoruba, rendered on the server from the translations shipped
// with the seed (no call to the translation service), and the photo
// credits. The voice is not exercised here (slow, and quota bound).

const FRENCH_TITLE = "Le système éducatif, à portée de main.";
const NOTICE = "Plateforme indépendante, non officielle. Non affiliée au Gouvernement du Bénin.";

async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow, "horizontal overflow in pixels").toBeLessThanOrEqual(0);
}

test("a visitor reads the home page in Fongbe, then back in French @mobile", async ({ page }) => {
  await page.goto("/");
  const heading = page.getByRole("heading", { level: 1 });
  await expect(heading).toHaveText(FRENCH_TITLE);
  await expect(page.locator("#page-content")).toHaveAttribute("lang", "fr");

  // The compact control of the header: the language code on the button,
  // the choices one tap away.
  await expect(languageMenu(page)).toHaveText(/FR/);
  await chooseLanguage(page, "Fongbe", "Langue");
  await expect(page).toHaveURL(/\?lang=fon$/);
  await expect(heading).not.toHaveText(FRENCH_TITLE);
  await expect(page.locator("#page-content")).toHaveAttribute("lang", "fon");
  await expect(languageMenu(page)).toHaveText(/FON/);
  // The voice follows the page, and names stay as written.
  await languageMenu(page).click();
  await expect(page.getByRole("group").nth(1).getByRole("link", { name: "Fongbe", exact: true })).toHaveAttribute("aria-current", "true");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("banner").locator("[data-brand-lockup]:visible")).toContainText("République du Bénin");
  await expect(page.getByText(/DEGAN Gabin, CC BY-SA 4\.0/)).toBeVisible();
  await expectNoHorizontalScroll(page);

  // The choice follows the visitor to the sign in page.
  await expect(page.locator("a[href='/connexion?lang=fon']").first()).toBeVisible();

  await languageMenu(page).click();
  await page.getByRole("group").first().getByRole("link", { name: "Français", exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(heading).toHaveText(FRENCH_TITLE);
  await expect(page.locator("#page-content")).toHaveAttribute("lang", "fr");
});

test("the voice language is chosen apart from the page", async ({ page }) => {
  await page.goto("/?lang=yo&voix=fr");
  await expect(page.locator("#page-content")).toHaveAttribute("lang", "yo");
  await expect(languageMenu(page)).toHaveText(/YO/);
  // The listen button, a speaker only, names the voice it will use.
  const listen = page.locator("main button[aria-pressed]");
  await expect(listen).toBeVisible();
  await expect(listen).not.toHaveAccessibleName(/fongbe/i);

  await languageMenu(page).click();
  await page.getByRole("group").nth(1).getByRole("link", { name: "Fongbe", exact: true }).click();
  await expect(page).toHaveURL(/\?lang=yo&voix=fon$/);
  await expect(listen).toHaveAccessibleName(/fongbe/i);
});

test("the photo credits are reached from the footer, every photograph credited @mobile", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("contentinfo").getByRole("link", { name: "Crédits photos" }).locator("visible=true").first().click();
  await expect(page).toHaveURL(/\/credits$/);
  await expect(page.getByRole("heading", { level: 1, name: "Crédits photos" })).toBeVisible();

  const items = page.locator("main ol > li");
  await expect(items).toHaveCount(5);
  for (const item of await items.all()) {
    await expect(item.getByRole("img")).toHaveAttribute("alt", /.{20,}/);
    await expect(item.getByRole("heading", { level: 3 })).toBeVisible();
    await expect(item.getByRole("link", { name: "Voir l'original sur Wikimedia Commons" })).toHaveAttribute("href", /^https:\/\/commons\.wikimedia\.org\/wiki\/File:/);
    await expect(item.getByText(/CC BY 4\.0|CC BY-SA 4\.0|Domaine public/).first()).toBeVisible();
    await expect(item.getByText(/Redimensionnée/)).toBeVisible();
  }
  // The coat of arms of the lockup is credited with its licence.
  const emblem = page.getByRole("region", { name: "Armoiries" });
  await expect(emblem).toContainText("Tinynanorobots et Fenn-O-maniC");
  await expect(emblem.getByRole("link", { name: "CC BY-SA 3.0" })).toHaveAttribute("href", /creativecommons\.org\/licenses\/by-sa\/3\.0/);
  // The reading voice is credited too.
  const voice = page.getByRole("region", { name: "Voix de lecture" });
  await expect(voice).toContainText("SIWIS");
  await expect(voice.getByRole("link", { name: "CC BY 4.0" })).toHaveAttribute("href", /creativecommons\.org\/licenses\/by\/4\.0/);
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
    // The identifier format sits in an info bubble beside the label, and
    // still describes the field for screen readers.
    const hint = page.getByText("Votre prénom et votre nom, séparés par un point.");
    await expect(hint).toBeHidden();
    await expect(page.getByLabel("Identifiant")).toHaveAccessibleDescription(/Votre prénom et votre nom, séparés par un point/);
    const info = page.getByRole("button", { name: "Plus d'informations sur ce champ" });
    await info.click();
    await expect(hint).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(hint).toBeHidden();
    await page.getByText("Où trouver mon identifiant ?").click();
    await expect(page.getByText("Aucune adresse e-mail n'est nécessaire.", { exact: false })).toBeVisible();
    await expect(languageMenu(page)).toHaveAccessibleName("Langue : Français");
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
    await languageMenu(page).click();
    await page.getByRole("group").first().getByRole("link", { name: "Français", exact: true }).click();
    await expect(page).toHaveURL(/\/connexion\?next=%2Fespace%2Fnotes$/);
    await expect(heading).toHaveText("Connexion");
  });
});

test.describe("official frame", () => {
  test("the header: band, navy bar with the lockup, navigation, yellow sign in button, tricolour rule @mobile", async ({ page }) => {
    await page.goto("/");
    const mobile = (page.viewportSize()?.width ?? 1366) < 1024;
    const banner = page.getByRole("banner");
    const lockup = banner.getByRole("link", { name: "Classéo, accueil" }).locator("visible=true");
    await expect(lockup).toHaveAttribute("data-brand-lockup", "official");
    await expect(lockup.locator("img[data-brand-arms]")).toBeVisible();
    await expect(lockup).toContainText("Classéo");

    // The sign in button: flag yellow, navy text.
    const signIn = banner.getByRole("link", { name: mobile ? "Connexion" : "Se connecter" });
    await expect(signIn).toHaveCSS("background-color", "rgb(252, 209, 22)");
    await expect(signIn).toHaveCSS("color", "rgb(10, 55, 100)");
    const box = await signIn.boundingBox();
    expect(box!.height).toBeGreaterThanOrEqual(44);

    // Band, bar and rule: 120 px on a computer, 112 px on a phone (a 44 px
    // band keeps the language button a full touch target).
    const bar = await banner.boundingBox();
    const top = await page.locator("body > div").filter({ has: page.locator("[data-language-menu]") }).first().boundingBox();
    expect(Math.round(top!.height + bar!.height)).toBe(mobile ? 112 : 120);

    if (!mobile) {
      const nav = page.getByRole("navigation", { name: "Navigation principale" });
      await expect(nav.getByRole("link", { name: "Accueil" })).toHaveAttribute("aria-current", "page");
      await expect(nav.getByRole("link", { name: "Vérifier un document" })).toHaveAttribute("href", "/verifier");
    }
    // The bar stays in view on scroll.
    await page.mouse.wheel(0, 1500);
    await expect.poll(async () => (await banner.boundingBox())!.y).toBe(0);
  });

  test("the footer: columns, useful links, motto, notice and flag band @mobile", async ({ page }) => {
    await page.goto("/");
    const mobile = (page.viewportSize()?.width ?? 1366) < 640;
    const footer = page.getByRole("contentinfo");
    await expect(footer).toHaveCSS("background-color", "rgb(7, 39, 71)");
    for (const title of ["Plateforme", "Aide", "Liens utiles", "Langues"]) {
      const heading = mobile ? footer.locator("summary", { hasText: title }) : footer.getByRole("heading", { level: 2, name: title });
      await expect(heading).toBeVisible();
    }
    if (mobile) await footer.locator("summary", { hasText: "Liens utiles" }).click();
    const links = footer.locator("a[href^='https://']:visible");
    await expect(links).toHaveCount(3);
    for (const href of ["https://memp.gouv.bj/", "https://enseignementsecondaire.gouv.bj/", "https://service-public.bj/"]) await expect(footer.locator(`a[href='${href}']:visible`)).toHaveAccessibleName(/\(site externe\)$/);
    await expect(footer.getByText("Fraternité, Justice, Travail")).toBeVisible();
    await expect(footer.getByText(NOTICE, { exact: true })).toBeVisible();

    // "Accessibilité" opens the settings of the round button.
    if (mobile) await footer.locator("summary", { hasText: "Aide" }).click();
    await footer.getByRole("button", { name: "Accessibilité" }).click();
    await expect(page.getByRole("dialog", { name: "Accessibilité" })).toBeVisible();
  });

  test("the independence notice is on every public page, whole and readable @mobile", async ({ page }) => {
    for (const path of ["/", "/connexion", "/mot-de-passe-oublie", "/mot-de-passe-oublie/email", "/credits", "/verifier", "/verifier/ZZZZZ-ZZZZZ", "/hors-ligne", "/une-page-qui-n-existe-pas"]) {
      await page.goto(path);
      const notice = page.getByText(NOTICE, { exact: true }).locator("visible=true").first();
      await expect(notice, path).toBeVisible();
      await expect(notice).toHaveAttribute("lang", "fr");
      await expectNoHorizontalScroll(page);
    }
    // Translated: the French sentence first, its translation after it.
    await page.goto("/?lang=fon");
    const translated = page.getByRole("contentinfo").locator("[data-independence-notice]");
    await expect(translated).toContainText(NOTICE);
    await expect(translated).toContainText(/\(.+\)/);
  });

  test("the menu drawer holds the focus, closes on Escape and gives it back @mobile-only", async ({ page }) => {
    await page.goto("/credits");
    const button = page.getByRole("button", { name: "Ouvrir le menu" });
    await button.click();
    const drawer = page.getByRole("dialog", { name: "Menu" });
    await expect(drawer).toBeVisible();
    await expect(drawer.getByText(NOTICE, { exact: true })).toBeVisible();
    await expect(drawer.getByRole("link", { name: "Se connecter" })).toHaveAttribute("href", "/connexion");
    // Tabbing stays inside the drawer.
    for (let i = 0; i < 8; i++) {
      await page.keyboard.press("Tab");
      expect(await isInside(drawer)).toBe(true);
    }
    await page.keyboard.press("Escape");
    await expect(drawer).toBeHidden();
    await expect(button).toBeFocused();

    await button.click();
    await drawer.getByRole("button", { name: "Fermer le menu" }).click();
    await expect(drawer).toBeHidden();
    await expect(button).toBeFocused();

    await button.click();
    await drawer.getByRole("link", { name: "Vérifier un document" }).click();
    await expect(page).toHaveURL(/\/verifier$/);
    await button.click();
    await expect(drawer.getByRole("link", { name: "Vérifier un document" })).toHaveAttribute("aria-current", "page");
  });
});

async function isInside(container: Locator) {
  return container.evaluate((el) => el.contains(document.activeElement));
}

// Reflow with the two largest text sizes of the accessibility panel (WCAG
// 1.4.10, control 9 of the design source of truth): on a phone, no public
// or sign in page scrolls sideways, and the menu and language buttons stay
// whole on the screen.
test.describe("very large text on a phone", () => {
  const PAGES = ["/", "/credits", "/verifier", "/une-page-qui-n-existe-pas", "/connexion", "/mot-de-passe-oublie"];

  for (const text of ["xl", "xxl"] as const) {
    for (const width of [320, 390]) {
      test(`text ${text} at ${width} px: no sideways scroll, the controls on screen`, async ({ page }) => {
        await page.addInitScript((size) => localStorage.setItem("classeo:text", size), text);
        await page.setViewportSize({ width, height: 800 });
        for (const path of PAGES) {
          await page.goto(path);
          await expect(page.locator("html")).toHaveAttribute("data-text", text);
          await expectNoHorizontalScroll(page);
          const controls = page.locator("button[aria-label='Ouvrir le menu'], [data-language-menu]").locator("visible=true");
          const count = await controls.count();
          expect(count, `${path}: header controls`).toBeGreaterThan(0);
          for (let i = 0; i < count; i++) {
            const box = (await controls.nth(i).boundingBox())!;
            expect(box.x, `${path}: control ${i}, left edge`).toBeGreaterThanOrEqual(0);
            expect(box.x + box.width, `${path}: control ${i}, right edge`).toBeLessThanOrEqual(width);
            expect(Math.round(box.height), `${path}: control ${i}, height`).toBeGreaterThanOrEqual(44);
          }
        }
      });
    }
  }
});
