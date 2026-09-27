import { authFile } from "./support/accounts";
import { expect, test } from "./support/fixtures";

// Shared pieces of the interface: the info bubble that holds explanations,
// the speaker-only listen button and the page shown for an unknown address.

test.describe("info bubble", () => {
  test("opens on keyboard focus, describes its button and closes with Escape", async ({ page }) => {
    await page.goto("/connexion");
    const field = page.getByLabel("Identifiant");
    const info = page.getByRole("button", { name: "Plus d'informations sur ce champ" });
    const tip = page.getByRole("tooltip").filter({ hasText: "Votre prénom et votre nom" });

    await expect(tip).toBeHidden();
    await expect(info).toHaveAccessibleDescription(/séparés par un point/);
    // From the field back to the "i" with the keyboard.
    await field.click();
    await page.keyboard.press("Shift+Tab");
    await expect(info).toBeFocused();
    await expect(tip).toBeVisible();
    // Inside the window, whole.
    const box = (await tip.boundingBox())!;
    const width = page.viewportSize()!.width;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(width);

    await page.keyboard.press("Escape");
    await expect(tip).toBeHidden();
    await expect(info).toBeFocused();
  });

  test("toggles with a tap and closes with a tap elsewhere @mobile-only", async ({ page }) => {
    await page.goto("/connexion");
    const info = page.getByRole("button", { name: "Plus d'informations sur ce champ" });
    const tip = page.getByRole("tooltip").filter({ hasText: "Votre prénom et votre nom" });

    await info.tap();
    await expect(info).toHaveAttribute("aria-expanded", "true");
    await expect(tip).toBeVisible();
    const box = (await tip.boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(page.viewportSize()!.width);

    // Anywhere outside the bubble: the password label, away from it.
    await page.locator("label", { hasText: /^Mot de passe/ }).tap();
    await expect(tip).toBeHidden();
    await expect(info).toHaveAttribute("aria-expanded", "false");
  });

  test.describe("in the private space", () => {
    test.use({ storageState: authFile("directeur") });

    test("page explanations live in the bubble beside the title @mobile", async ({ page }) => {
      await page.goto("/espace/statistiques");
      await expect(page.getByRole("heading", { level: 1, name: "Statistiques" })).toBeVisible();
      const method = page.getByRole("tooltip").filter({ hasText: "Méthode de calcul" });
      await expect(method).toBeHidden();
      await page.getByRole("button", { name: "À propos de cette page" }).click();
      await expect(method).toBeVisible();
      await expect(method).toContainText("Taux d'absence");
    });
  });
});

test.describe("listen button", () => {
  test.use({ storageState: authFile("parent") });

  test("is a speaker only: the spoken summary is not printed next to it @mobile", async ({ page }) => {
    await page.goto("/espace");
    const senami = page.getByRole("region", { name: "Sènami Hounkpatin" });
    const listen = senami.getByRole("button", { name: "Écouter le résumé" });
    await expect(listen).toBeVisible();
    await expect(listen).toHaveText("");
    await expect(listen).toHaveAttribute("aria-pressed", "false");
    // The sentence stays available to screen readers only.
    const summary = senami.getByText(/^Résumé : /);
    await expect(summary).toHaveClass(/sr-only/);
  });
});

test.describe("unknown address", () => {
  test("shows a designed not found page with ways back @mobile", async ({ page }) => {
    const res = await page.goto("/une-page-qui-n-existe-pas");
    expect(res?.status()).toBe(404);
    await expect(page.getByRole("heading", { level: 1, name: "Cette page est introuvable" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Aller à mon espace" })).toHaveAttribute("href", "/espace");
    await expect(page.getByRole("button", { name: "Page précédente" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Retour à l'accueil" })).toHaveAttribute("href", "/");
    // In the public frame, with the independence notice.
    await expect(page.getByRole("contentinfo").getByText("Plateforme indépendante, non officielle. Non affiliée au Gouvernement du Bénin.")).toBeVisible();
  });
});
