import { PASSWORD } from "./support/accounts";
import { expect, passwordField, test } from "./support/fixtures";

// The demonstration panel lives on a secret sign in page,
// /acces/<DEMO_ACCESS_TOKEN>, and never on the public /connexion of a
// production run. The suite runs on a production build started without
// DEMO_MODE; the token and the demo password come from the same variables
// as the server's (the webServer of playwright.config.ts inherits them).
const TOKEN = process.env.DEMO_ACCESS_TOKEN;
const PANEL = "Comptes de démonstration";

test.describe("demo access", () => {
  test("the public sign in page of a production run shows no demo panel", async ({ page }) => {
    test.skip(process.env.DEMO_MODE === "on", "the server runs with DEMO_MODE=on");
    await page.goto("/connexion");
    await expect(page.getByRole("button", { name: "Se connecter" })).toBeVisible();
    await expect(page.getByText(PANEL)).toHaveCount(0);
    await expect(page.getByText("Mot de passe commun")).toHaveCount(0);
  });

  test("a wrong token answers the regular 404 page", async ({ page }) => {
    const response = await page.goto(`/acces/${"0".repeat(64)}`);
    expect(response?.status()).toBe(404);
    await expect(page.getByRole("heading", { name: "Cette page est introuvable" })).toBeVisible();
    await expect(page.getByText(PANEL)).toHaveCount(0);
  });

  test("the secret page with the right token shows the panel and signs in", async ({ page }) => {
    test.skip(!TOKEN, "DEMO_ACCESS_TOKEN is not set for this run");
    const response = await page.goto(`/acces/${TOKEN}`);
    expect(response?.status()).toBe(200);
    // Dynamic and private: never kept by a shared cache.
    expect(response?.headers()["cache-control"] ?? "").not.toContain("public");
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex, nofollow/);
    await expect(page.locator('meta[name="referrer"]')).toHaveAttribute("content", "no-referrer");
    // The language controls stay on the secret address.
    await expect(page.locator(`a[href^="/acces/${TOKEN}?lang="]`).first()).toBeAttached();

    await page.getByText(PANEL).click();
    await page.getByRole("button", { name: /Analyste national/ }).click();
    await expect(page.getByLabel("Identifiant")).toHaveValue("rodrigue.kpadonou");
    if (process.env.DEMO_PASSWORD) {
      await expect(passwordField(page)).toHaveValue(process.env.DEMO_PASSWORD);
    } else {
      // A production run without DEMO_PASSWORD shows the identifiers only.
      await expect(passwordField(page)).toHaveValue("");
      await passwordField(page).fill(PASSWORD);
    }
    await page.getByRole("button", { name: "Se connecter" }).click();
    await expect(page).toHaveURL(/\/espace$/);
  });
});
