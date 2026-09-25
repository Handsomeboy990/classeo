import path from "node:path";

import { authFile } from "./support/accounts";
import { expect, test } from "./support/fixtures";

// Contents reach only those they are meant for (seeded contents, see
// prisma/seed.ts): a departmental announcement for teachers, a school event
// for parents, a class resource for pupils.
test.use({ storageState: authFile("parent") });

const SHOTS = process.env.E2E_SHOTS_DIR;
const TEACHERS_ONLY = "Conférence pédagogique départementale";
const PARENTS_OF_CEG = "Réunion des parents d'élèves";
const CLASS_RESOURCE = "Fiche de révision : les nombres relatifs";

test("a parent receives the parents' contents of their child's school, not the teachers' ones", async ({ page }) => {
  await page.goto("/espace/contenus");
  await expect(page.getByText(PARENTS_OF_CEG).first()).toBeVisible();
  await expect(page.getByText(TEACHERS_ONLY)).toHaveCount(0);
  // The class resource is for the pupils, not for their parents.
  await expect(page.getByText(CLASS_RESOURCE)).toHaveCount(0);
  // No supervision view for a family.
  await expect(page.getByRole("navigation", { name: "Choisir la vue" })).toHaveCount(0);
  if (SHOTS) await page.screenshot({ path: path.join(SHOTS, "04-parent-contents.png"), fullPage: true });
});

test("a teacher receives the teachers' announcement of the department", async ({ pageAs }) => {
  const teacher = await pageAs("enseignant");
  await teacher.goto("/espace/contenus");
  await expect(teacher.getByText(TEACHERS_ONLY).first()).toBeVisible();
  await expect(teacher.getByText(PARENTS_OF_CEG)).toHaveCount(0);
});

test("the ministry does not receive a school's event but follows it in the managed view", async ({ pageAs }) => {
  const minister = await pageAs("ministre");
  await minister.goto("/espace/contenus?q=parents");
  await expect(minister.getByText(PARENTS_OF_CEG)).toHaveCount(0);
  await minister.getByRole("navigation", { name: "Choisir la vue" }).getByRole("link", { name: "Publiés ou suivis" }).click();
  await expect(minister).toHaveURL(/vue=geres/);
  await expect(minister.getByText(PARENTS_OF_CEG).first()).toBeVisible();
  if (SHOTS) await minister.screenshot({ path: path.join(SHOTS, "05-minister-managed.png"), fullPage: true });
});

test("a pupil receives the resource of their class", async ({ pageAs }) => {
  const student = await pageAs("eleve");
  await student.goto("/espace/contenus");
  await expect(student.getByText(CLASS_RESOURCE).first()).toBeVisible();
  await expect(student.getByText(TEACHERS_ONLY)).toHaveCount(0);
});
