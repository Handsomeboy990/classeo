import { authFile } from "./support/accounts";
import { expect, expectForbidden, test } from "./support/fixtures";

// Journey 4: a parent follows their own children and nobody else's.
test.use({ storageState: authFile("parent") });

test("dashboard shows the child summary and the listen button @mobile", async ({ page }) => {
  await page.goto("/espace");
  await expect(page.getByRole("heading", { level: 1, name: "Bonjour, Afiavi" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Écouter", exact: true })).toBeVisible();

  const senami = page.getByRole("region", { name: "Sènami Hounkpatin" });
  await expect(senami).toBeVisible();
  await expect(senami.getByText("3e A · CEG Godomey")).toBeVisible();
  await expect(senami.getByRole("button", { name: "Écouter le résumé" })).toBeVisible();
  await expect(senami.getByRole("link", { name: /^Dernier bulletin \d+,\d+ sur 20/ })).toBeVisible();
  await expect(page.getByRole("region", { name: "Mahougnon Hounkpatin" })).toBeVisible();
});

test("opens the report card of Sènami", async ({ page }) => {
  await page.goto("/espace");
  await page.getByRole("region", { name: "Sènami Hounkpatin" }).getByRole("link", { name: "Suivi complet" }).click();

  await expect(page).toHaveURL(/\/espace\/suivi\/[\w-]+$/);
  await expect(page.getByRole("heading", { level: 1, name: "Sènami Hounkpatin" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Bulletins" })).toHaveAttribute("aria-current", "page");

  const report = page.getByRole("article", { name: /^Bulletin du trimestre 3 · 2025-2026$/ });
  await expect(report).toBeVisible();
  await expect(report.getByText("Moyenne générale")).toBeVisible();
  await expect(report.getByRole("table", { name: /Moyennes par matière/ }).getByRole("cell", { name: "Mathématiques", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Écouter le bulletin" })).toBeVisible();
});

test("cannot open another student's page by id", async ({ page, pageAs }) => {
  // A real student of the same school, taken from the director's list.
  const director = await pageAs("directeur");
  await director.goto("/espace/eleves");
  const other = director
    .getByRole("table")
    .getByRole("link")
    .filter({ hasNotText: "Hounkpatin" })
    .first();
  const href = await other.getAttribute("href");
  const studentId = href?.match(/^\/espace\/eleves\/([\w-]+)$/)?.[1];
  expect(studentId).toBeTruthy();

  // The 403 content, on the file and on a section of it. The status stays
  // 200: the route streams its loading state before the check runs.
  await page.goto(`/espace/suivi/${studentId}`);
  await expectForbidden(page);
  await expect(page.getByRole("button", { name: "Écouter le bulletin" })).toHaveCount(0);

  await page.goto(`/espace/suivi/${studentId}/notes`);
  await expectForbidden(page);
});
