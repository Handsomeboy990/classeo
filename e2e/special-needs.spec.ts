import type { Page } from "@playwright/test";

import type { Role } from "./support/accounts";
import { expect, test } from "./support/fixtures";

// Owner's decision D8: a student's special needs or disability is sensitive
// data about a minor. It never shows in a list next to the names; on the
// student's record, only the head of the school and the teachers of the
// student's class see it. Every other role never receives it.

const NEED = "Déficience visuelle";
const ALL_NEEDS = /Déficience visuelle|Déficience auditive|Handicap moteur|Trouble cognitif/;

async function save(page: Page, id: string) {
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await page.waitForURL(new RegExp(`/espace/eleves/${id}$`));
}

test("special needs show on the record for the head and the class teachers only", async ({ pageAs }) => {
  // A student of one of the demo teacher's classes, in CEG Godomey.
  const teacher = await pageAs("enseignant");
  await teacher.goto("/espace/eleves");
  const first = teacher.getByRole("table").getByRole("link").first();
  const name = (await first.textContent())?.trim() ?? "";
  const id = (await first.getAttribute("href"))?.match(/^\/espace\/eleves\/([\w-]+)$/)?.[1] ?? "";
  expect(id, "a student of the teacher's class").not.toBe("");

  // The head of school records a need on the student's record.
  const director = await pageAs("directeur");
  await director.goto(`/espace/eleves/${id}/modifier`);
  const box = director.getByRole("checkbox", { name: NEED });
  const had = await box.isChecked();
  if (!had) {
    await box.check();
    await save(director, id);
  }

  try {
    const expected: [Role, boolean][] = [
      ["directeur", true],
      ["enseignant", true],
      ["secretaire", false],
      ["comptable", false],
      ["ministre", false],
    ];
    for (const [role, sees] of expected) {
      const page = await pageAs(role);
      await page.goto(`/espace/eleves/${id}`);
      await expect(page.getByRole("heading", { level: 1 }), role).toBeVisible();
      const needs = page.locator("[data-special-needs]");
      if (sees) {
        await expect(page.getByText("Besoins particuliers"), role).toBeVisible();
        await expect(needs.getByText(NEED), role).toBeVisible();
      } else {
        await expect(page.getByText("Besoins particuliers"), role).toHaveCount(0);
        await expect(page.getByRole("main").getByText(ALL_NEEDS), role).toHaveCount(0);
      }
    }

    // No list shows it next to the name, whoever reads it.
    const lastName = name.split(" ")[0];
    for (const role of ["directeur", "enseignant", "secretaire"] as Role[]) {
      const page = await pageAs(role);
      await page.goto(`/espace/eleves?q=${encodeURIComponent(lastName)}`);
      await expect(page.getByRole("table").getByRole("link", { name })).toBeVisible();
      await expect(page.getByRole("main").getByText(ALL_NEEDS), `${role}: student list`).toHaveCount(0);
    }

    // The secretary's edit form leaves the field out, and saving it keeps
    // the recorded need.
    const secretary = await pageAs("secretaire");
    await secretary.goto(`/espace/eleves/${id}/modifier`);
    await expect(secretary.getByRole("textbox", { name: /Nom/ }).first()).toBeVisible();
    await expect(secretary.getByRole("checkbox", { name: NEED })).toHaveCount(0);
    await save(secretary, id);
    await director.goto(`/espace/eleves/${id}`);
    await expect(director.locator("[data-special-needs]").getByText(NEED)).toBeVisible();
  } finally {
    if (!had) {
      await director.goto(`/espace/eleves/${id}/modifier`);
      await director.getByRole("checkbox", { name: NEED }).uncheck();
      await save(director, id);
    }
  }
});
