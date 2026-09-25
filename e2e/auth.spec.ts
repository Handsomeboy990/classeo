import { authFile, PARTNER_EMAIL, PASSWORD, type Role } from "./support/accounts";
import { expect, mainMenu, passwordField, signIn, test } from "./support/fixtures";

// Journey 1: each role reaches /espace with the menu its permissions allow,
// and nothing more. The sign in itself is exercised by auth.setup.ts.
const MENUS: { role: Role; heading: RegExp; shows: string[]; hides: string[] }[] = [
  {
    role: "ministre",
    heading: /^Bonjour, Adjoa$/,
    shows: ["Tableau de bord", "Territoire", "Statistiques", "Établissements", "Enseignants", "Demandes", "Comptes utilisateurs", "Rôles et droits", "Journal d'activité"],
    hides: ["Notes", "Frais et paiements", "Mes enfants"],
  },
  {
    role: "directeur",
    heading: /^Bonjour, Florentin$/,
    shows: ["Mon établissement", "Classes", "Élèves", "Enseignants", "Notes", "Bulletins", "Présences", "Frais et paiements", "Annonces et ressources", "Rôles et droits", "Demandes de réinitialisation"],
    hides: ["Territoire", "Mes enfants"],
  },
  {
    role: "enseignant",
    heading: /^Bonjour/,
    shows: ["Classes", "Notes", "Présences", "Emploi du temps", "Messagerie"],
    hides: ["Frais et paiements", "Statistiques", "Bulletins", "Comptes utilisateurs"],
  },
  {
    role: "comptable",
    heading: /^Bonjour, Gildas$/,
    shows: ["Frais et paiements", "Élèves", "Messagerie"],
    hides: ["Notes", "Annonces et ressources", "Rôles et droits"],
  },
  {
    role: "parent",
    heading: /^Bonjour, Afiavi$/,
    shows: ["Tableau de bord", "Mes enfants", "Annonces et ressources", "Messagerie"],
    hides: ["Statistiques", "Élèves", "Notes", "Frais et paiements", "Ma scolarité"],
  },
  {
    role: "eleve",
    heading: /^Bonjour, Sènami$/,
    shows: ["Tableau de bord", "Ma scolarité", "Messagerie"],
    hides: ["Mes enfants", "Statistiques", "Notes"],
  },
];

for (const { role, heading, shows, hides } of MENUS) {
  test.describe(`${role} menu`, () => {
    test.use({ storageState: authFile(role) });

    test(`${role} lands on /espace with the right menu entries @mobile`, async ({ page }) => {
      await page.goto("/espace");
      await expect(page).toHaveURL(/\/espace$/);
      await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();

      const menu = await mainMenu(page);
      for (const label of shows) await expect(menu.getByRole("link", { name: label, exact: true })).toBeVisible();
      for (const label of hides) await expect(menu.getByRole("link", { name: label, exact: true })).toHaveCount(0);
    });
  });
}

test.describe("sign in", () => {
  test("a wrong password is refused, the right one then signs in", async ({ page }) => {
    await signIn(page, PARTNER_EMAIL, "not-the-password-2026");
    await expect(page.getByText("Identifiant ou mot de passe incorrect.")).toBeVisible();
    await expect(page).toHaveURL(/\/connexion/);

    // A successful sign in resets the failure counter, so repeated runs
    // never lock the partner account.
    await passwordField(page).fill(PASSWORD);
    await page.getByRole("button", { name: "Se connecter" }).click();
    await expect(page).toHaveURL(/\/espace$/);
    await expect(page.getByRole("heading", { level: 1, name: /^Bonjour, Estelle$/ })).toBeVisible();
  });

  test("the private space sends a visitor to the sign in page", async ({ page }) => {
    await page.goto("/espace/notes");
    await expect(page).toHaveURL(/\/connexion\?next=%2Fespace%2Fnotes$/);
    await expect(page.getByRole("heading", { level: 1, name: "Connexion" })).toBeVisible();
  });
});
