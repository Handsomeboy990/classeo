import type { Page } from "@playwright/test";

import { expect, test } from "./support/fixtures";

// The teacher file: the page of a person of the national registry, for the
// ministry, the departments and the circonscriptions. The demonstration
// teacher, Nafissatou Issifou, teaches in two secondary schools of the
// Atlantique (CEG Godomey and a second one, from the identity demo data).

const FILE_URL = /\/espace\/enseignants\/registre\/[^/?]+$/;

async function openFromRegistry(page: Page) {
  await page.goto("/espace/enseignants?q=Issifou");
  await expect(page.getByRole("heading", { level: 1, name: "Registre des enseignants" })).toBeVisible();
  const row = page.getByRole("row").filter({ hasText: "Nafissatou" });
  await expect(row).toHaveCount(1);
  return row;
}

test.describe("teacher file", () => {
  test("the national administrator opens a teacher file from the registry", async ({ pageAs }) => {
    const page = await pageAs("ministre");
    const row = await openFromRegistry(page);
    // The name is a link to the file.
    await row.getByRole("link", { name: /Issifou Nafissatou/ }).click();
    await expect(page).toHaveURL(FILE_URL);
    await expect(page.getByRole("heading", { level: 1, name: /Nafissatou Issifou/ })).toBeVisible();

    // Schools of the person, each with its per school record.
    const schools = page.getByRole("region", { name: "Établissements" });
    await expect(schools.getByRole("link", { name: "CEG Godomey" })).toHaveAttribute("href", /^\/espace\/enseignants\/[^/]+$/);
    await expect(schools.getByText("Secondaire général · MESTFP").first()).toBeVisible();
    // Current year, history and activity.
    await expect(page.getByRole("heading", { level: 2, name: /^Année \d{4}-\d{4}$/ })).toBeVisible();
    await expect(page.getByRole("region", { name: "CEG Godomey" }).getByRole("table")).toBeVisible();
    await expect(page.getByRole("heading", { level: 2, name: "Parcours par année" })).toBeVisible();
    await expect(page.getByRole("heading", { level: 2, name: "Activité de l'année" })).toBeVisible();
    await expect(page.getByText("Fiches de notes remplies")).toBeVisible();
    // The ministry sees the contacts and keeps the registry of the State.
    await expect(page.getByText("Dernière connexion")).toBeVisible();
    await expect(page.getByRole("button", { name: "Modifier le registre" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Rémunération" })).toContainText("payé par");

    // The PDF file, registered with a verification code.
    const pdf = page.getByRole("link", { name: /^Fiche \(PDF\)/ });
    const res = await page.request.get((await pdf.getAttribute("href"))!);
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toBe("application/pdf");
    expect(res.headers()["content-disposition"]).toContain("fiche-enseignant-issifou-nafissatou.pdf");
  });

  test("a registry row opens the file when clicked anywhere", async ({ pageAs }) => {
    const page = await pageAs("ddestfp");
    const row = await openFromRegistry(page);
    // A click on the status cell, away from any link.
    await row.getByRole("cell").filter({ hasText: /établissements|APE|Compte/ }).first().click();
    await expect(page).toHaveURL(FILE_URL);
    await expect(page.getByRole("heading", { level: 1, name: /Nafissatou Issifou/ })).toBeVisible();
    // A department sees the file without the ministry's registry action.
    await expect(page.getByRole("button", { name: "Modifier le registre" })).toHaveCount(0);
  });

  test("a DDEMP cannot open the file of a teacher of secondary schools only", async ({ pageAs }) => {
    const minister = await pageAs("ministre");
    const row = await openFromRegistry(minister);
    await row.getByRole("link", { name: /Issifou Nafissatou/ }).click();
    await expect(minister).toHaveURL(FILE_URL);
    const path = new URL(minister.url()).pathname;
    const profileId = path.split("/").pop()!;

    const ddemp = await pageAs("ddemp");
    await ddemp.goto(path);
    await expect(ddemp.getByRole("heading", { level: 1, name: "Cette page est introuvable" })).toBeVisible();
    await expect(ddemp.getByText("Nafissatou")).toHaveCount(0);
    expect((await ddemp.request.get(`/api/pdf/fiche-enseignant/${profileId}`)).status()).toBe(404);
    // A school keeps its per school records: the person file is not theirs.
    const head = await pageAs("directeur");
    await head.goto(path);
    await expect(head.getByRole("heading", { level: 1, name: "Cette page est introuvable" })).toBeVisible();
  });

  test("the file reads on a phone without sideways scrolling @mobile", async ({ pageAs }) => {
    const page = await pageAs("ministre");
    const row = await openFromRegistry(page);
    await row.getByRole("link", { name: /Issifou Nafissatou/ }).click();
    await expect(page).toHaveURL(FILE_URL);
    await expect(page.getByRole("heading", { level: 2, name: "Parcours par année" })).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
});
