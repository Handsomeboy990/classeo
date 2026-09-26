import type { Page } from "@playwright/test";

import { expect, test, uniqueSuffix } from "./support/fixtures";

// Group messages and the pieces families send to the school. Every journey
// runs on a phone and on a computer, and writes content unique to the run.

const PDF = (title: string) => ({ name: "piece.pdf", mimeType: "application/pdf", buffer: Buffer.from(`%PDF-1.4\n% ${title}\n1 0 obj << /Type /Catalog >> endobj\ntrailer << /Root 1 0 R >>\n%%EOF\n`) });

function frIn(days: number) {
  const [y, m, d] = new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

// The parent page opens on the youngest child; the pieces of CEG Godomey
// belong to Sènami.
async function openSenami(parent: Page) {
  await parent.goto("/espace/pieces-justificatifs");
  await expect(parent.getByRole("heading", { level: 1, name: "Pièces et justificatifs" })).toBeVisible();
  await parent.getByRole("navigation", { name: "Choisir l'enfant" }).getByRole("link", { name: /Sènami Hounkpatin/ }).click();
  await expect(parent.getByRole("navigation", { name: "Choisir l'enfant" }).getByRole("link", { name: /Sènami Hounkpatin/ })).toHaveAttribute("aria-current", "page");
}

// Opens the pending piece of the queue whose page shows this text: the
// queue may hold pieces other journeys sent at the same time.
async function openPending(staff: Page, type: "ENROLLMENT" | "ABSENCE" | "MEDICAL", text: string) {
  await staff.goto(`/espace/pieces-familles?type=${type}`);
  await expect(staff.getByRole("heading", { level: 1, name: "Pièces des familles" })).toBeVisible();
  const hrefs = await staff.getByRole("table").getByRole("link").evaluateAll((links) => links.map((a) => a.getAttribute("href")!));
  for (const href of hrefs.reverse()) {
    await staff.goto(href);
    if (await staff.getByText(text, { exact: false }).first().isVisible()) return href;
  }
  throw new Error(`No pending piece shows "${text}"`);
}

test.describe("group messages", () => {
  test("a head of school writes to two parents who never see each other @mobile", async ({ pageAs }) => {
    const suffix = uniqueSuffix();
    const subject = `Réunion ${suffix}`;
    const director = await pageAs("directeur");
    await director.goto("/espace/messages");
    await director.getByRole("button", { name: "Nouvelle conversation" }).click();
    const dialog = director.getByRole("dialog", { name: "Nouvelle conversation" });
    const search = dialog.getByRole("searchbox");
    for (const name of ["Afiavi Hounkpatin", "Colette Dossa"]) {
      await search.fill(name.split(" ")[1]!);
      await dialog.getByRole("checkbox", { name }).check();
    }
    await expect(dialog.getByText("les 2 destinataires ne se voient pas entre eux")).toBeVisible();
    // Parents are never offered a shared conversation.
    await expect(dialog.getByRole("switch")).toHaveCount(0);
    await dialog.getByLabel("Sujet").fill(subject);
    await dialog.getByLabel("Message").fill(`${suffix} Bonjour, la réunion est avancée à 8 h.`);
    await dialog.getByRole("button", { name: "Envoyer à 2 personnes" }).click();
    await expect(director).toHaveURL(/\/espace\/messages\?envoye=2$/);
    await expect(director.getByText("Message envoyé à 2 destinataires")).toBeVisible();

    const parent = await pageAs("parent");
    await parent.goto("/espace/messages");
    await parent.getByRole("link", { name: new RegExp(subject) }).click();
    await expect(parent.getByRole("heading", { level: 1, name: subject })).toBeVisible();
    await expect(parent.getByText(/^Avec Florentin Agossou/)).toBeVisible();
    await expect(parent.getByText("Colette Dossa")).toHaveCount(0);
  });

  test("staff may share one conversation between several colleagues @mobile", async ({ pageAs }) => {
    const suffix = uniqueSuffix();
    const subject = `Conseil ${suffix}`;
    const director = await pageAs("directeur");
    await director.goto("/espace/messages");
    await director.getByRole("button", { name: "Nouvelle conversation" }).click();
    const dialog = director.getByRole("dialog", { name: "Nouvelle conversation" });
    const search = dialog.getByRole("searchbox");
    await search.fill("Tossou");
    await dialog.getByRole("checkbox", { name: "Pélagie Tossou" }).check();
    await search.fill("Issifou");
    await dialog.getByRole("checkbox", { name: /Issifou/ }).first().check();
    await expect(dialog.getByRole("switch", { name: "Une seule conversation pour tout le groupe" })).toBeChecked();
    await dialog.getByLabel("Sujet").fill(subject);
    await dialog.getByLabel("Message").fill(`${suffix} Point sur les notes vendredi.`);
    await dialog.getByRole("button", { name: "Envoyer à 2 personnes" }).click();
    await expect(director.getByRole("heading", { level: 1, name: subject })).toBeVisible();
    await expect(director.getByText(/^Avec .*Pélagie Tossou.*Issifou|^Avec .*Issifou.*Pélagie Tossou/)).toBeVisible();
  });
});

test.describe("pieces sent by families", () => {
  test("a parent sends an enrollment piece and the school validates it @mobile", async ({ pageAs }) => {
    const label = `Certificat de scolarité ${uniqueSuffix()}`;
    const director = await pageAs("directeur");
    await director.goto("/espace/pieces-familles/liste");
    await director.getByRole("button", { name: "Ajouter une pièce" }).click();
    const add = director.getByRole("dialog", { name: "Ajouter une pièce" });
    await add.getByLabel("Nom de la pièce").fill(label);
    await add.getByRole("button", { name: "Ajouter", exact: true }).click();
    await expect(director.getByText("Pièce ajoutée à la liste.")).toBeVisible();

    const parent = await pageAs("parent");
    await openSenami(parent);
    const item = parent.getByRole("listitem").filter({ hasText: label });
    await expect(item.getByText("À envoyer")).toBeVisible();
    await item.getByRole("button", { name: "Envoyer la pièce" }).click();
    const send = parent.getByRole("dialog", { name: label });
    await send.getByLabel("Fichier").setInputFiles(PDF(label));
    await send.getByRole("button", { name: "Envoyer", exact: true }).click();
    await expect(parent.getByText("Pièce envoyée. L'école vous répondra ici.")).toBeVisible();
    await expect(item.getByText("En attente de l'école")).toBeVisible();

    // The file opens for the parent, never for a teacher.
    const href = await item.getByRole("link", { name: "Voir le fichier envoyé" }).getAttribute("href");
    expect((await parent.request.get(href!)).status()).toBe(200);
    const teacher = await pageAs("enseignant");
    expect((await teacher.request.get(href!)).status()).toBe(404);

    const secretary = await pageAs("secretaire");
    await openPending(secretary, "ENROLLMENT", label);
    await expect(secretary.getByRole("heading", { level: 1, name: label })).toBeVisible();
    await secretary.getByRole("button", { name: "Valider" }).click();
    await expect(secretary.getByText("Pièce validée.")).toBeVisible();

    await parent.reload();
    await expect(parent.getByRole("listitem").filter({ hasText: label }).getByText("Validée")).toBeVisible();
  });

  test("a parent justifies an absence and the school accepts it @mobile", async ({ pageAs }) => {
    const reason = `Rendez-vous chez le dentiste ${uniqueSuffix()}`;
    const parent = await pageAs("parent");
    await openSenami(parent);
    await parent.getByRole("button", { name: "Justifier" }).first().click();
    const dialog = parent.getByRole("dialog", { name: /^Justifier l'absence du/ });
    await dialog.getByLabel("Motif de l'absence").fill(reason);
    await dialog.getByRole("button", { name: "Envoyer la justification" }).click();
    await expect(parent.getByText("Justification envoyée. L'école vous répondra ici.")).toBeVisible();

    const secretary = await pageAs("secretaire");
    await openPending(secretary, "ABSENCE", reason);
    await secretary.getByRole("button", { name: "Valider" }).click();
    await expect(secretary.getByText("Justification acceptée : l'absence est excusée.")).toBeVisible();

    await parent.reload();
    await expect(parent.getByText(`Absence excusée : Justifiée : ${reason}`)).toBeVisible();
  });

  test("a medical certificate is validated, then its file is gone @mobile", async ({ pageAs }) => {
    // A period unique to the run, to find the piece in the queue.
    const offset = 30 + Math.floor(Math.random() * 300);
    const parent = await pageAs("parent");
    await openSenami(parent);
    await parent.getByRole("button", { name: "Envoyer un certificat médical" }).click();
    const dialog = parent.getByRole("dialog", { name: "Certificat médical pour une dispense d'EPS" });
    await dialog.getByLabel("Dispensé à partir du").fill(frIn(offset));
    await dialog.getByLabel("Jusqu'au").fill(frIn(offset + 13));
    await dialog.getByLabel("Certificat médical").setInputFiles(PDF("Certificat médical"));
    await dialog.getByRole("button", { name: "Envoyer le certificat" }).click();
    await expect(parent.getByText("Pièce envoyée. L'école vous répondra ici.")).toBeVisible();

    // The secretariat does not handle health pieces.
    const secretary = await pageAs("secretaire");
    await secretary.goto("/espace/pieces-familles");
    await expect(secretary.getByRole("link", { name: /Certificats médicaux/ })).toHaveCount(0);

    const director = await pageAs("directeur");
    const endLabel = frIn(offset + 13).split("/").reverse().join("-");
    const until = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${endLabel}T00:00:00Z`)).replace(/^1 /, "1er ");
    const page = await openPending(director, "MEDICAL", `au ${until}`);
    const fileHref = await director.getByRole("link", { name: "Ouvrir le fichier" }).getAttribute("href");
    expect((await director.request.get(fileHref!)).status()).toBe(200);
    expect((await secretary.request.get(fileHref!)).status()).toBe(404);
    await director.getByRole("button", { name: "Valider" }).click();
    await expect(director.getByText("Pièce validée. Le fichier de santé est supprimé, seule la décision est gardée.")).toBeVisible();
    await director.goto(page);
    await expect(director.getByText("Fichier supprimé", { exact: true })).toBeVisible();
    expect((await director.request.get(fileHref!)).status()).toBe(404);
    expect((await parent.request.get(fileHref!)).status()).toBe(404);
  });
});
