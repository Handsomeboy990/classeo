import { authFile } from "./support/accounts";
import { expect, passwordField, test, uniqueSuffix } from "./support/fixtures";

// Journeys of identity and delegation: accounts without e-mail, password
// help routed to the school head, the national teacher registry and the
// school switcher.

test.describe("password help without e-mail", () => {
  test.use({ storageState: authFile("directeur") });

  test("a staff member asks, the school head resets, the person signs in", async ({ page, browser }) => {
    // A long journey across two browsers, with three password hashes.
    test.slow();
    // The school head creates an account without e-mail: the identifier is
    // shown with the temporary password.
    const last = `Essai${uniqueSuffix().replace(/[^a-z]/g, "")}`;
    await page.goto("/espace/utilisateurs");
    await page.getByRole("button", { name: "Nouveau compte" }).click();
    const create = page.getByRole("dialog", { name: "Nouveau compte" });
    await create.getByLabel("Prénom").fill("Rosine");
    await create.locator("input[name=lastName]").fill(last);
    // A long list: the searchable field, type to filter then pick.
    const role = create.getByRole("combobox", { name: "Rôle" });
    await role.fill("secré");
    await page.getByRole("option", { name: "Secrétaire", exact: true }).click();
    await create.getByRole("button", { name: "Créer le compte" }).click();
    const username = (await page.getByTestId("issued-username").textContent())!.trim();
    expect(username).toBe(`rosine.${last.toLowerCase()}`);
    await page.getByRole("button", { name: "J'ai transmis ces informations" }).click();

    // Signed out: an unknown identifier and a real one get the same answer.
    const visitor = await browser.newContext({ storageState: { cookies: [], origins: [] }, serviceWorkers: "block" });
    const anon = await visitor.newPage();
    for (const login of [`personne.inconnue${uniqueSuffix().replace(/[^a-z0-9]/g, "")}`, username]) {
      await anon.goto("/mot-de-passe-oublie");
      await anon.getByLabel("Identifiant").fill(login);
      await anon.getByLabel("Téléphone pour vous rappeler").fill("0197001122");
      await anon.getByRole("button", { name: "Demander un nouveau mot de passe" }).click();
      await expect(anon.getByText("Demande transmise")).toBeVisible();
    }

    // The request reaches the school head, who resets the password.
    await expect(async () => {
      await page.goto("/espace/aide-connexion?statut=en-attente");
      await expect(page.getByText(username)).toBeVisible({ timeout: 2000 });
    }).toPass({ timeout: 20_000 });
    const row = page.getByRole("row").filter({ hasText: username });
    await expect(row.getByText("0197001122")).toBeVisible();
    await row.getByRole("button", { name: "Réinitialiser" }).click();
    const dialog = page.getByRole("dialog", { name: /Réinitialiser le mot de passe de Rosine/ });
    await dialog.getByRole("button", { name: "Réinitialiser" }).click();
    const reset = page.getByRole("dialog", { name: "Nouveau mot de passe temporaire" });
    await expect(reset.getByTestId("issued-username")).toHaveText(username, { timeout: 30_000 });
    const password = (await reset.getByTestId("temporary-password").textContent())!.trim();
    await reset.getByRole("button", { name: "J'ai transmis ces informations" }).click();

    // The person signs in with it and is asked for their own password,
    // with their identifier in view.
    await anon.goto("/connexion");
    await anon.getByLabel("Identifiant").fill(username);
    await passwordField(anon).fill(password);
    await anon.getByRole("button", { name: "Se connecter" }).click();
    await expect(anon).toHaveURL(/\/changer-mot-de-passe$/);
    await expect(anon.getByTestId("own-username")).toHaveText(username);
    await visitor.close();
  });
});

test.describe("teacher registry", () => {
  test.use({ storageState: authFile("directeur") });

  test("a school head searches the registry before creating a teacher", async ({ page }) => {
    // Creating the account hashes a password: slow on a loaded machine.
    test.slow();
    const last = `Registre${uniqueSuffix().replace(/[^a-z]/g, "")}`;
    await page.goto("/espace/enseignants");
    await page.getByRole("button", { name: "Nouvel enseignant" }).click();
    const dialog = page.getByRole("dialog", { name: "Ajouter un enseignant" });
    // Accents do not matter: the demo teacher is found from plain letters.
    await dialog.getByLabel("NPI, téléphone ou nom et prénom").fill("ISSIFOU nafissatou");
    await dialog.getByRole("button", { name: "Chercher" }).click();
    await expect(dialog.getByText("Déjà dans votre équipe")).toBeVisible();

    await dialog.getByLabel("NPI, téléphone ou nom et prénom").fill(`Élodie ${last}`);
    await dialog.getByRole("button", { name: "Chercher" }).click();
    await expect(dialog.getByText("Aucun enseignant trouvé au registre")).toBeVisible();
    await dialog.getByRole("button", { name: "Créer une nouvelle fiche" }).click();

    const form = page.getByRole("dialog", { name: "Nouvelle fiche au registre" });
    await form.locator("input[name=lastName]").fill(last);
    await form.locator("input[name=firstName]").fill("Élodie");
    await form.getByRole("button", { name: "Ajouter l'enseignant" }).click();
    const done = page.getByRole("dialog", { name: "Enseignant ajouté" });
    await expect(done.getByTestId("issued-username")).toHaveText(`elodie.${last.toLowerCase()}`, { timeout: 30_000 });
    await done.getByRole("button", { name: "J'ai transmis ces informations" }).click();

    // Searching again, without accents, finds her in the team.
    await page.getByRole("button", { name: "Nouvel enseignant" }).click();
    const again = page.getByRole("dialog", { name: "Ajouter un enseignant" });
    await again.getByLabel("NPI, téléphone ou nom et prénom").fill(`${last} elodie`);
    await again.getByRole("button", { name: "Chercher" }).click();
    await expect(again.getByText("Déjà dans votre équipe")).toBeVisible();
  });
});

test.describe("teacher registry of a department", () => {
  test.use({ storageState: authFile("ddestfp") });

  test("lists each teacher once with their schools", async ({ page }) => {
    await page.goto("/espace/enseignants?q=Issifou");
    await expect(page.getByRole("heading", { level: 1, name: "Registre des enseignants" })).toBeVisible();
    const row = page.getByRole("row").filter({ hasText: "Nafissatou" });
    await expect(row).toHaveCount(1);
    await expect(row.getByRole("link", { name: "CEG Godomey" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Exporter en CSV" })).toBeVisible();
  });
});

test.describe("school switcher", () => {
  test.use({ storageState: authFile("enseignant") });

  test("a teacher of several schools sees them with the current one marked", async ({ page }) => {
    await page.goto("/espace/choisir-etablissement");
    await expect(page.getByRole("heading", { level: 1, name: "Choisir l'établissement" })).toBeVisible();
    const current = page.getByRole("button", { name: /^Travailler à CEG Godomey, établissement actuel$/ });
    await expect(current).toBeVisible();
    // With the identity demo data the account also teaches in a second
    // school; the switch itself is not made here, the saved session is
    // shared by other journeys.
    const others = page.getByRole("button", { name: /^Travailler à / });
    test.skip((await others.count()) < 2, "demo data without a second appointment");
    await expect(others).toHaveCount(2);
  });
});
