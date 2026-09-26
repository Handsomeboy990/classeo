import { authFile } from "./support/accounts";
import { expect, test } from "./support/fixtures";

// Journey 3: a teacher enters a grade, sees the average move, saves it and
// finds it again after a reload. The cell is put back as it was found.
test.use({ storageState: authFile("enseignant") });

function averageOf(text: string) {
  const match = text.match(/(\d+(?:,\d+)?)\/20/);
  return match ? Number(match[1]!.replace(",", ".")) : null;
}

test("teacher enters a grade, sees the average update, saves it and keeps it after reload", async ({ page }) => {
  await page.goto("/espace/notes");
  await expect(page.getByRole("heading", { level: 1, name: "Notes" })).toBeVisible();
  await page.getByRole("link", { name: /^Saisir les notes de / }).first().click();
  await expect(page).toHaveURL(/\/espace\/notes\/[\w-]+$/);

  const grid = page.getByRole("table", { name: /Grille de saisie des notes/ });
  // The second devoir surveillé is left empty by the seed (national formula:
  // two interrogations écrites, two devoirs surveillés).
  const row = grid.getByRole("row").filter({ has: page.getByRole("textbox", { name: /^Devoir surveillé 2, / }) }).first();
  const cell = row.getByRole("textbox", { name: /^Devoir surveillé 2, / });
  const studentLabel = (await cell.getAttribute("aria-label"))!;
  const status = page.getByText(/Tout est enregistré|modifications? non enregistrées?/);
  await expect(status).toHaveText("Tout est enregistré");

  const original = await cell.inputValue();
  const average = row.getByText(/\d+,\d+\/20|Pas encore de note/);
  const averageBefore = (await average.textContent()) ?? "";
  // A mark equal to the current average would leave it unchanged.
  const before = averageOf(averageBefore) ?? 10;
  let value = before >= 10 ? "4" : "17";
  if (value === original) value = "9";

  await cell.fill(value);
  await expect(average).not.toHaveText(averageBefore);
  await expect(average).toContainText("/20");
  await expect(status).toHaveText("1 modification non enregistrée");

  await page.getByRole("button", { name: "Enregistrer les notes" }).click();
  await expect(page.getByText("Tout est enregistré")).toBeVisible();

  await page.reload();
  const reloaded = page.getByRole("textbox", { name: studentLabel, exact: true });
  await expect(reloaded).toHaveValue(value);

  // Put the cell back as it was.
  await reloaded.fill(original);
  await expect(page.getByText("1 modification non enregistrée")).toBeVisible();
  await page.getByRole("button", { name: "Enregistrer les notes" }).click();
  await expect(page.getByText("Tout est enregistré")).toBeVisible();
  await page.reload();
  await expect(page.getByRole("textbox", { name: studentLabel, exact: true })).toHaveValue(original);
});

test("an out of range grade is refused and nothing is saved", async ({ page }) => {
  await page.goto("/espace/notes");
  await page.getByRole("link", { name: /^Saisir les notes de / }).first().click();

  const grid = page.getByRole("table", { name: /Grille de saisie des notes/ });
  const row = grid.getByRole("row").filter({ has: page.getByRole("textbox", { name: /^Interrogation écrite 2, / }) }).first();
  const cell = row.getByRole("textbox", { name: /^Interrogation écrite 2, / });
  const original = await cell.inputValue();

  await cell.fill("25");
  await expect(cell).toHaveAttribute("aria-invalid", "true");
  await expect(row.getByText("Note invalide")).toBeVisible();

  await page.getByRole("button", { name: "Enregistrer les notes" }).click();
  await expect(page.getByText("1 note est invalide. Corrigez les cases en rouge avant d'enregistrer.")).toBeVisible();
  await expect(cell).toBeFocused();

  // Escape restores the saved value of the cell.
  await cell.press("Escape");
  await expect(cell).toHaveValue(original);
  await expect(page.getByText("Tout est enregistré")).toBeVisible();
});
