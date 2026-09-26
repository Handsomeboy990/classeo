import { authFile } from "./support/accounts";
import { expect, expectForbidden, test } from "./support/fixtures";

// Journey 7: school fees are for the accountant, not the secretary.
test.describe("accountant", () => {
  test.use({ storageState: authFile("comptable") });

  test("opens an invoice and sees its installments", async ({ page }) => {
    await page.goto("/espace/frais/factures");
    await expect(page.getByRole("heading", { level: 1, name: "Factures" })).toBeVisible();

    // An invoice with the contribution scolaire (20 000 FCFA, three
    // installments): the girls of CEG Godomey are exempt and owe the
    // parents' association dues only.
    const first = page
      .getByRole("row")
      .filter({ hasText: /20[\s\u202f\u00a0]000/ })
      .first()
      .getByRole("link", { name: /^FAC-\d{4}-\d{4}$/ });
    const number = (await first.textContent())!.trim();
    await first.click();

    await expect(page.getByRole("heading", { level: 1, name: `Facture ${number}` })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Tranches" })).toBeVisible();
    const installments = page.getByRole("table", { name: /Tranches de la facture/ });
    await expect(installments.getByRole("row")).toHaveCount(4);
    await expect(installments.getByText("Tranche 1 et APE")).toBeVisible();
    await expect(installments.getByText("Tranche 2", { exact: true })).toBeVisible();
    await expect(installments.getByText("Tranche 3", { exact: true })).toBeVisible();
  });
});

test.describe("secretary", () => {
  test.use({ storageState: authFile("secretaire") });

  test("gets the 403 page on /espace/frais", async ({ page }) => {
    const response = await page.goto("/espace/frais");
    expect(response?.status()).toBe(403);
    await expectForbidden(page);
    await expect(page.getByRole("heading", { name: "Frais et paiements" })).toHaveCount(0);
  });
});
