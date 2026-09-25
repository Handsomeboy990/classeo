import { authFile } from "./support/accounts";
import { expect, expectForbidden, mainMenu, test } from "./support/fixtures";

// Journey 8: controls follow the permissions; the server refuses the rest.
test.describe("national analyst", () => {
  test.use({ storageState: authFile("analyste") });

  test("has no edit controls on schools", async ({ page, pageAs }) => {
    // Control: the minister does see them on the same page.
    const minister = await pageAs("ministre");
    await minister.goto("/espace/etablissements");
    await expect(minister.getByRole("button", { name: "Nouvel établissement" })).toBeVisible();
    await expect(minister.getByRole("button", { name: /^Désactiver / }).first()).toBeVisible();

    await page.goto("/espace/etablissements");
    await expect(page.getByRole("heading", { level: 1, name: "Établissements" })).toBeVisible();
    const school = page.getByRole("table").getByRole("link").first();
    await expect(school).toBeVisible();
    await expect(page.getByRole("button", { name: "Nouvel établissement" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /^(Désactiver|Réactiver) / })).toHaveCount(0);

    const name = (await school.textContent())!.trim();
    await school.click();
    await expect(page.getByRole("heading", { level: 1, name, exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Modifier" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /^(Désactiver|Réactiver) / })).toHaveCount(0);
  });
});

test.describe("school director", () => {
  test.use({ storageState: authFile("directeur") });

  test("cannot see the rights matrix", async ({ page }) => {
    await page.goto("/espace");
    const menu = await mainMenu(page);
    await expect(menu.getByRole("link", { name: "Rôles et droits" })).toHaveCount(0);

    await page.goto("/espace/droits");
    await expectForbidden(page);
    await expect(page.getByRole("heading", { name: "Rôles et droits" })).toHaveCount(0);
  });
});
