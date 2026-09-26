import path from "node:path";

import type { Page } from "@playwright/test";

import { expect, signIn, test } from "./support/fixtures";

// Mock exams: a college proposes an exam, the invited college accepts, the
// DDESTFP validates (the secondary chain has no circonscription); the DDESTFP
// imposes one; a teacher enters results; a family reads its child's exams;
// and the refusals around them.
// Screenshots are written only when E2E_SCREENSHOTS names a folder.

const SHOTS = process.env.E2E_SCREENSHOTS;
async function shot(page: Page, name: string) {
  if (SHOTS) await page.screenshot({ path: path.join(SHOTS, `${name}.png`), fullPage: true });
}

// Seeded: last year's departmental BEPC mock with the results of CEG
// Godomey, this year's first one (February 2027), and the CEP mock of the
// circonscription of Abomey-Calavi (May 2027).
const SEEDED_3E = "Examen blanc départemental du BEPC 2026, Atlantique";
const SEEDED_BEPC = "Premier examen blanc départemental du BEPC, Atlantique";
const SEEDED_CM2 = "Examen blanc du CEP, circonscription d'Abomey-Calavi";
// The exam the DDESTFP imposes below, starting today: the teacher enters
// its results.
const IMPOSED = `Examen blanc imposé ${Date.now().toString(36)}`;

function isoIn(days: number) {
  return new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
}

// The date field of the kit takes a typed jj/mm/aaaa date.
function frIn(days: number) {
  const [y, m, d] = isoIn(days).split("-");
  return `${d}/${m}/${y}`;
}

test.describe.configure({ mode: "serial" });

test("a college proposes an exam, the partner accepts and the DDESTFP validates it", async ({ pageAs, browser }) => {
  const title = `Examen blanc de 3e ${Date.now().toString(36)}`;
  const director = await pageAs("directeur");
  await director.goto("/espace/examens-blancs");
  await expect(director.getByRole("heading", { level: 1, name: "Examens blancs" })).toBeVisible();
  await expect(director.getByRole("link", { name: SEEDED_BEPC })).toBeVisible();
  await expect(director.getByRole("link", { name: SEEDED_CM2 })).toHaveCount(0);
  await shot(director, "01-list-director");

  await director.getByRole("link", { name: "Organiser un examen blanc" }).click();
  // The subjects are ticked by the client once the level is chosen: the
  // form is hydrated before anything else is typed.
  await director.getByLabel("Classe d'examen").selectOption({ label: "3e" });
  await expect(director.getByRole("checkbox", { name: "Mathématiques" })).toBeChecked();
  await director.getByLabel("Intitulé").fill(title);
  await director.getByLabel("Premier jour des épreuves").fill(frIn(20));
  await director.getByLabel("Dernier jour des épreuves").fill(frIn(21));
  await director.getByRole("checkbox", { name: /CEG Abomey-Calavi/ }).check();
  await shot(director, "02-create-school");
  await director.getByRole("button", { name: "Créer et envoyer les invitations" }).click();
  await expect(director.getByRole("heading", { level: 1, name: title })).toBeVisible();
  const examUrl = director.url();
  expect(examUrl).not.toMatch(/nouveau$/);
  await expect(director.getByText("Invitations en cours").first()).toBeVisible();
  await expect(director.getByText(/pourra être soumis à la validation dès qu'un établissement invité aura accepté/)).toBeVisible();

  // The invited head answers.
  const partnerContext = await browser.newContext();
  const partner = await partnerContext.newPage();
  await signIn(partner, "comlan.hounsa");
  await expect(partner).toHaveURL(/\/espace$/);
  await partner.goto(examUrl);
  await expect(partner.getByRole("heading", { name: "Votre établissement est invité" })).toBeVisible();
  await partner.getByLabel("Message à l'organisateur").fill("Nous présenterons nos deux classes de 3e.");
  await partner.getByRole("button", { name: "Accepter l'invitation" }).click();
  await expect(partner.getByText("Invitation acceptée. L'organisateur est notifié.")).toBeVisible();
  await expect(partner.getByRole("heading", { name: "Votre établissement est invité" })).toHaveCount(0);
  await partnerContext.close();

  // The organiser submits to the departmental direction.
  await director.reload();
  await director.getByRole("button", { name: "Soumettre à la validation" }).click();
  await director.getByRole("dialog").getByRole("button", { name: "Soumettre" }).click();
  await expect(director.getByText(/Examen soumis à la direction départementale/)).toBeVisible();
  await expect(director.getByText("En attente de validation").first()).toBeVisible();

  // The DDESTFP validates with a note.
  const districtContext = await browser.newContext();
  const district = await districtContext.newPage();
  await signIn(district, "aristide.gbaguidi");
  await expect(district).toHaveURL(/\/espace$/);
  await district.goto("/espace/examens-blancs");
  await expect(district.getByText(/en attente de votre validation/)).toBeVisible();
  await district.goto(examUrl);
  await expect(district.getByRole("heading", { name: "Validation" })).toBeVisible();
  await shot(district, "03-district-decision");
  await district.getByRole("button", { name: "Valider l'examen" }).click();
  await expect(district.getByText("Motivez la décision (5 caractères minimum).")).toBeVisible();
  await district.getByLabel("Note de décision").fill("Calendrier compatible avec les compositions. Bonne organisation.");
  await district.getByRole("button", { name: "Valider l'examen" }).click();
  await expect(district.getByText("Examen validé. Les établissements sont notifiés.")).toBeVisible();
  await districtContext.close();

  // The circonscription does not follow a college's exam.
  const circonscriptionContext = await browser.newContext();
  const circonscription = await circonscriptionContext.newPage();
  await signIn(circonscription, "benedicta.zannou");
  await expect(circonscription).toHaveURL(/\/espace$/);
  await circonscription.goto("/espace/examens-blancs");
  await expect(circonscription.getByRole("link", { name: SEEDED_CM2 })).toBeVisible();
  await expect(circonscription.getByRole("link", { name: title })).toHaveCount(0);
  await shot(circonscription, "04-circonscription-list");
  await circonscriptionContext.close();

  await director.reload();
  await expect(director.getByText("Validé", { exact: true }).first()).toBeVisible();
  await expect(director.getByRole("heading", { name: "Historique" })).toBeVisible();
  for (const step of ["Création", "Invitation acceptée", "Soumission", "Validation"]) await expect(director.getByText(step, { exact: true }).first()).toBeVisible();
  await shot(director, "05-approved-timeline");
});

test("the DDESTFP imposes an exam on every college of a commune", async ({ pageAs }) => {
  const title = IMPOSED;
  const page = await pageAs("ddestfp");
  await page.goto("/espace/examens-blancs/nouveau");
  await expect(page.getByText(/La participation est imposée/)).toBeVisible();
  await page.getByLabel("Classe d'examen").selectOption({ label: "3e" });
  await expect(page.getByRole("checkbox", { name: "Mathématiques" })).toBeChecked();
  await page.getByLabel("Intitulé").fill(title);
  await page.getByLabel("Premier jour des épreuves").fill(frIn(0));
  await page.getByLabel("Dernier jour des épreuves").fill(frIn(1));
  await page.getByRole("radio", { name: "Tous les établissements d'une commune" }).check();
  // A long list: the searchable field, type to filter then pick.
  await page.getByRole("combobox", { name: "Commune" }).fill("Abomey");
  await page.getByRole("option", { name: "Abomey-Calavi", exact: true }).click();
  await expect(page.getByText(/établissements? concernés? pour cette classe/)).toBeVisible();
  await shot(page, "06-create-imposed");
  await page.getByRole("button", { name: "Décider l'examen blanc" }).click();
  await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
  await expect(page.getByText("Validé", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Participation imposée").first()).toBeVisible();
  await expect(page.getByRole("cell", { name: "CEG Godomey", exact: true })).toBeVisible();
});

test("a teacher enters a mock exam score and keeps it after reload", async ({ pageAs }) => {
  const page = await pageAs("enseignant");
  await page.goto("/espace/examens-blancs");
  await page.getByRole("table").getByRole("link", { name: IMPOSED }).click();
  await expect(page.getByRole("heading", { level: 1, name: IMPOSED })).toBeVisible();
  await page.getByRole("link", { name: /^3e A/ }).click();
  await expect(page.getByRole("heading", { level: 1, name: /Saisie des notes · 3e A/ })).toBeVisible();
  // Only her subject is editable.
  await expect(page.getByRole("textbox", { name: /^Français, / })).toHaveCount(0);
  const cell = page.getByRole("textbox", { name: /^Mathématiques, / }).first();
  const label = (await cell.getAttribute("aria-label"))!;
  const original = await cell.inputValue();
  const value = original === "12,5" ? "13" : "12,5";
  await cell.fill("25");
  await page.getByRole("button", { name: "Enregistrer les notes" }).click();
  await expect(page.getByText(/Des notes sont invalides/)).toBeVisible();
  await cell.fill(value);
  await page.getByRole("button", { name: "Enregistrer les notes" }).click();
  await expect(page.getByText("Tout est enregistré")).toBeVisible();
  await shot(page, "07-teacher-entry");
  await page.reload();
  await expect(page.getByRole("textbox", { name: label, exact: true })).toHaveValue(value);
  await page.getByRole("textbox", { name: label, exact: true }).fill(original);
  await page.getByRole("button", { name: "Enregistrer les notes" }).click();
  await expect(page.getByText("Tout est enregistré")).toBeVisible();
});

test("a parent reads the child's exam, and nothing else", async ({ pageAs }) => {
  const page = await pageAs("parent");
  await page.goto("/espace/examens-blancs");
  await expect(page.getByRole("link", { name: SEEDED_CM2 })).toHaveCount(0);
  await expect(page.getByRole("link", { name: SEEDED_3E })).toHaveCount(0);
  await page.getByRole("table").getByRole("link", { name: SEEDED_BEPC }).click();
  await expect(page.getByText("Les notes ne sont pas encore saisies.").first()).toBeVisible();
  await expect(page.getByRole("heading", { name: "Classement des candidats" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Établissements" })).toHaveCount(0);
  await shot(page, "08-parent-results");
});

test("refusals: no creation for a teacher, no section for the accountant, no foreign exam", async ({ pageAs }) => {
  const teacher = await pageAs("enseignant");
  const created = await teacher.goto("/espace/examens-blancs/nouveau");
  expect(created?.status()).toBe(403);

  const accountant = await pageAs("comptable");
  const list = await accountant.goto("/espace/examens-blancs");
  expect(list?.status()).toBe(403);

  // The parent never reaches the CM2 exam, even with its address.
  const minister = await pageAs("ministre");
  await minister.goto("/espace/examens-blancs");
  await minister.getByRole("table").getByRole("link", { name: SEEDED_CM2 }).click();
  const cm2 = minister.url();
  const parent = await pageAs("parent");
  await parent.goto(cm2);
  await expect(parent.getByRole("heading", { level: 1, name: SEEDED_CM2 })).toHaveCount(0);
  // Nor a teacher, who only sees the running exams of her school.
  await teacher.goto(cm2);
  await expect(teacher.getByRole("heading", { level: 1, name: SEEDED_CM2 })).toHaveCount(0);
});

test("the results sheet downloads as a PDF for the school, not for a family", async ({ pageAs }) => {
  const director = await pageAs("directeur");
  await director.goto("/espace/examens-blancs");
  await director.getByRole("table").getByRole("link", { name: SEEDED_3E }).click();
  const href = await director.getByRole("link", { name: "Relevé des résultats" }).getAttribute("href");
  expect(href).toMatch(/^\/api\/pdf\/examens-blancs\//);
  const pdf = await director.request.get(href!);
  expect(pdf.status()).toBe(200);
  expect(pdf.headers()["content-type"]).toBe("application/pdf");
  await shot(director, "09-director-results");

  const parent = await pageAs("parent");
  const refused = await parent.request.get(href!);
  expect(refused.status()).toBe(403);
});
