import { authFile } from "./support/accounts";
import { expect, mainMenu, test, uniqueSuffix } from "./support/fixtures";

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

  test("reads the national roles and manages the roles of the school", async ({ page }) => {
    await page.goto("/espace");
    const menu = await mainMenu(page);
    await expect(menu.getByRole("link", { name: "Rôles et droits" })).toBeVisible();

    await page.goto("/espace/droits");
    await expect(page.getByRole("heading", { level: 1, name: "Rôles et droits" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Rôles nationaux" })).toBeVisible();

    // A national role is read only below the ministry.
    const roles = page.getByRole("navigation", { name: "Rôles" });
    await roles.getByRole("link", { name: /^Enseignant/ }).first().click();
    await expect(page.getByText("Rôle national : il se consulte ici, seul le ministère le modifie.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Enregistrer les droits" })).toHaveCount(0);

    // A role of the school, created, then removed.
    const name = `Surveillant ${uniqueSuffix()}`;
    await page.getByRole("button", { name: "Nouveau rôle" }).click();
    const dialog = page.getByRole("dialog", { name: "Nouveau rôle" });
    await expect(dialog.getByText(/Ce rôle appartiendra à CEG Godomey/)).toBeVisible();
    await dialog.getByLabel("Nom du rôle").fill(name);
    await dialog.getByRole("button", { name: "Créer le rôle" }).click();
    await expect(page.getByRole("heading", { name: new RegExp(name) })).toBeVisible();
    await expect(page.getByText("Propre à CEG Godomey")).toBeVisible();

    await page.getByRole("button", { name: "Supprimer" }).click();
    const confirm = page.getByRole("dialog", { name: `Supprimer le rôle ${name} ?` });
    await confirm.getByRole("button", { name: "Supprimer le rôle" }).click();
    await expect(page.getByRole("navigation", { name: "Rôles" }).getByRole("link", { name: new RegExp(name) })).toHaveCount(0);
  });
});
