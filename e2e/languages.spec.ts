import { authFile } from "./support/accounts";
import { expect, test } from "./support/fixtures";

// Local languages: parents hold translation:view by default and see the
// language switcher; staff without it do not, and the server refuses them.
// The interface translations come from the cache filled by
// scripts/pretranslate.ts: these journeys make no call to the service for
// the interface. The voice is not exercised here (slow, and quota bound).
test.use({ storageState: authFile("parent") });

test("a parent switches the family dashboard to Fongbe and back to French @mobile", async ({ page }) => {
  await page.goto("/espace");
  const heading = page.getByRole("heading", { level: 1 });
  await expect(heading).toContainText("Bonjour");
  const select = page.getByLabel("Langue", { exact: true });
  await expect(select).toHaveValue("fr");

  await select.selectOption("fon");
  await expect(page.getByRole("status").filter({ hasText: /Page traduite en fongbe/ })).toBeVisible();
  await expect(page.locator("#page-content")).toHaveAttribute("lang", "fon");
  // Names are never translated.
  await expect(heading).toContainText("Afiavi");
  await expect(heading).not.toContainText("Bonjour");

  // The French original, then the translation again.
  await page.getByRole("button", { name: "Voir en français" }).click();
  await expect(heading).toContainText("Bonjour");
  await page.getByRole("button", { name: "Revenir au fongbe" }).click();
  await expect(heading).not.toContainText("Bonjour");

  // Remembered on this device.
  await page.reload();
  await expect(page.getByLabel("Langue", { exact: true })).toHaveValue("fon");
  await expect(heading).not.toContainText("Bonjour");

  await page.getByLabel("Langue", { exact: true }).selectOption("fr");
  await expect(heading).toContainText("Bonjour");
  await expect(page.locator("#page-content")).not.toHaveAttribute("lang", /.+/);
});

test("a parent is offered the translation of an announcement", async ({ page }) => {
  await page.goto("/espace/contenus");
  const translate = page.getByRole("button", { name: "Traduire en fongbe" }).first();
  await expect(translate).toBeVisible();
  await translate.click();
  const dialog = page.getByRole("dialog", { name: "Traduction en fongbe" });
  await expect(dialog).toBeVisible();
  // Translated, or an honest message: the French text is always there.
  await expect(dialog.getByText("Texte original en français")).toBeVisible();
  await expect(dialog.getByText("Traduction en cours…")).toHaveCount(0, { timeout: 60_000 });
  await expect(dialog.locator("[lang=fon] p").or(dialog.getByRole("alert")).first()).toBeVisible();
  await dialog.getByRole("button", { name: "Fermer" }).last().click();
  await expect(dialog).toBeHidden();
});

test("staff without translation:view see no switcher and are refused by the server", async ({ pageAs }) => {
  const director = await pageAs("directeur");
  await director.goto("/espace");
  await expect(director.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(director.getByLabel("Langue", { exact: true })).toHaveCount(0);
  await expect(director.getByRole("button", { name: /^Traduire en / })).toHaveCount(0);
  const res = await director.request.post("/api/langues/interface", { data: { lang: "fon", texts: ["Bonjour"] } });
  expect(res.status()).toBe(403);
  const voice = await director.request.post("/api/langues/voix", { data: { lang: "fon", text: "Bonjour" } });
  expect(voice.status()).toBe(403);
});

test("the interface route answers from the cache and rejects unknown languages", async ({ page }) => {
  await page.goto("/espace");
  const ok = await page.request.post("/api/langues/interface", { data: { lang: "fon", texts: ["Annuler", "13,5/20", "Sènami Hounkpatin"] } });
  expect(ok.status()).toBe(200);
  const body = (await ok.json()) as { translations: Record<string, string> };
  expect(Object.keys(body.translations)).not.toContain("13,5/20");
  expect(Object.keys(body.translations)).not.toContain("Sènami Hounkpatin");
  const bad = await page.request.post("/api/langues/interface", { data: { lang: "xx", texts: ["Annuler"] } });
  expect(bad.status()).toBe(400);
});
