import path from "node:path";

import { authFile } from "./support/accounts";
import { expect, test, uniqueSuffix } from "./support/fixtures";

// Institutional messaging: the departmental direction writes to two schools
// at once, each school answers for itself, its staff (not its teachers) see
// the thread, and the direction sees who has read it.
test.use({ storageState: authFile("ddemp") });

const SHOTS = process.env.E2E_SHOTS_DIR;
const shot = (name: string) => (SHOTS ? { path: path.join(SHOTS, `${name}.png`), fullPage: true } : undefined);

test("a departmental direction writes to two schools, one answers, receipts follow", async ({ page, pageAs }) => {
  const subject = `Circulaire de test ${uniqueSuffix()}`;

  await page.goto("/espace/messages");
  await page.getByRole("button", { name: "Nouvelle conversation" }).click();
  const dialog = page.getByRole("dialog", { name: "Nouvelle conversation" });
  await dialog.getByText("Un établissement ou un service").click();

  // The picker follows the routes: the ministry and the department's own
  // schools and districts, never another department.
  await expect(dialog.getByRole("checkbox", { name: "Ministère des Enseignements" })).toBeVisible();
  await expect(dialog.getByRole("checkbox", { name: "Circonscription scolaire d'Abomey-Calavi" })).toBeVisible();
  await expect(dialog.getByRole("checkbox", { name: /Direction départementale du Borgou/ })).toHaveCount(0);
  await dialog.getByRole("searchbox").fill("godomey");
  await expect(dialog.getByRole("checkbox", { name: "CEG Allada" })).toHaveCount(0);
  await dialog.getByRole("checkbox", { name: "CEG Godomey" }).check();
  await dialog.getByRole("checkbox", { name: "EPP Godomey Centre" }).check();

  // Nothing sent without a subject: the choice stays.
  await dialog.getByLabel("Message").fill("Merci de confirmer vos effectifs de 6e avant vendredi.");
  await dialog.getByRole("button", { name: "Envoyer à 2 destinataires" }).click();
  await expect(dialog.getByLabel("Sujet")).toHaveAttribute("aria-invalid", "true");
  await expect(dialog.getByText("2 choisis")).toBeVisible();
  await dialog.getByLabel("Sujet").fill(subject);
  if (SHOTS) await page.screenshot(shot("01-ddemp-picker"));
  await dialog.getByRole("button", { name: "Envoyer à 2 destinataires" }).click();

  await expect(page).toHaveURL(/\/espace\/messages\?envoye=2$/);
  await expect(page.getByText("Message envoyé à 2 destinataires")).toBeVisible();
  const rows = page.getByRole("link", { name: new RegExp(subject) });
  await expect(rows).toHaveCount(2);
  await expect(rows.filter({ hasText: "CEG Godomey" })).toContainText("Pas encore lu");

  // The school's head sees the direction as the party and answers.
  const director = await pageAs("directeur");
  await director.goto("/espace/messages");
  const row = director.getByRole("link", { name: new RegExp(subject) });
  await expect(row).toContainText("Direction départementale de l'Atlantique");
  await expect(row).toContainText("Pour CEG Godomey");
  await row.click();
  await expect(director.getByText("CEG Godomey avec Direction départementale de l'Atlantique")).toBeVisible();
  const log = director.getByRole("log", { name: "Messages de la conversation" });
  await expect(log.getByRole("article").first()).toHaveAccessibleName("Message de Aristide Gbaguidi, Direction départementale de l'Atlantique");
  await director.getByLabel("Votre message").first().fill("Bien reçu, nos effectifs de 6e sont à jour.");
  await director.getByRole("button", { name: "Envoyer" }).last().click();
  await expect(log.getByRole("article").last()).toContainText("nos effectifs de 6e sont à jour");
  await expect(log.getByRole("article").last()).toHaveAccessibleName("Message de Vous, CEG Godomey");
  if (SHOTS) await director.screenshot(shot("02-director-thread"));

  // Another member of the school's staff sees the thread and who answered.
  const secretary = await pageAs("secretaire");
  await secretary.goto("/espace/messages");
  await secretary.getByRole("link", { name: new RegExp(subject) }).click();
  await expect(secretary.getByRole("log", { name: "Messages de la conversation" }).getByRole("article").last()).toHaveAccessibleName(
    "Message de Florentin Agossou, CEG Godomey",
  );

  // A teacher of the school does not read the school's mail.
  const teacher = await pageAs("enseignant");
  await teacher.goto("/espace/messages");
  await expect(teacher.getByRole("link", { name: new RegExp(subject) })).toHaveCount(0);

  // The direction sees the answer and, on the other thread, no reading yet.
  await page.goto("/espace/messages");
  await expect(rows.filter({ hasText: "CEG Godomey" })).toContainText("Nouveau");
  await expect(rows.filter({ hasText: "EPP Godomey Centre" })).toContainText("Pas encore lu");
  if (SHOTS) await page.screenshot(shot("03-ddemp-list"));
  await rows.filter({ hasText: "CEG Godomey" }).click();
  await expect(page.getByRole("log", { name: "Messages de la conversation" }).getByRole("article").last()).toHaveAccessibleName(
    "Message de Florentin Agossou, CEG Godomey",
  );
});

test("a school writes to the ministry, its department, its district and any school, never to another district", async ({ pageAs }) => {
  const director = await pageAs("directeur");
  await director.goto("/espace/messages");
  await director.getByRole("button", { name: "Nouvelle conversation" }).click();
  const dialog = director.getByRole("dialog", { name: "Nouvelle conversation" });
  await dialog.getByText("Un établissement ou un service").click();
  await expect(dialog.getByRole("checkbox", { name: "Ministère des Enseignements" })).toBeVisible();
  await expect(dialog.getByRole("checkbox", { name: "Direction départementale de l'Atlantique" })).toBeVisible();
  await expect(dialog.getByRole("checkbox", { name: "Circonscription scolaire d'Abomey-Calavi" })).toBeVisible();
  await expect(dialog.getByRole("checkbox", { name: "CEG Allada" })).toBeVisible();
  await expect(dialog.getByRole("checkbox", { name: "CEG Godomey" })).toHaveCount(0);
  await expect(dialog.getByRole("checkbox", { name: /Circonscription scolaire de Cotonou/ })).toHaveCount(0);
  await expect(dialog.getByRole("checkbox", { name: /Direction départementale du Littoral/ })).toHaveCount(0);
});

test("a parent writes only to people", async ({ pageAs }) => {
  const parent = await pageAs("parent");
  await parent.goto("/espace/messages");
  await parent.getByRole("button", { name: "Nouvelle conversation" }).click();
  const dialog = parent.getByRole("dialog", { name: "Nouvelle conversation" });
  await expect(dialog.getByText("Un établissement ou un service")).toHaveCount(0);
  await expect(dialog.getByRole("group", { name: "Destinataire" }).first()).toBeVisible();
});

test("the institution picker fits the narrowest screen @mobile-only", async ({ pageAs }) => {
  const director = await pageAs("directeur");
  await director.goto("/espace/messages");
  await director.getByRole("button", { name: "Nouvelle conversation" }).click();
  const dialog = director.getByRole("dialog", { name: "Nouvelle conversation" });
  await dialog.getByText("Un établissement ou un service").click();
  await dialog.getByRole("searchbox").fill("allada");
  await dialog.getByRole("checkbox", { name: "CEG Allada" }).check();
  await expect(dialog.getByText("1 choisi, 200 au plus")).toBeVisible();
  const overflow = await director.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  if (SHOTS) await director.screenshot(shot("06-mobile-picker"));
});
