import { authFile } from "./support/accounts";
import { expect, test } from "./support/fixtures";

// Journey 6: a parent who writes little answers with one tap, the teacher
// reads it in the same conversation.
test.use({ storageState: authFile("parent") });

const SUBJECT = "Suivi de Sènami en mathématiques";
const QUICK = ["J'ai bien reçu votre message.", "Merci pour l'information."];

test("parent sends a quick message in the existing conversation and the teacher sees it", async ({ page, pageAs }) => {
  await page.goto("/espace/messages");
  await page.getByRole("link", { name: new RegExp(SUBJECT) }).click();
  await expect(page.getByRole("heading", { level: 1, name: SUBJECT })).toBeVisible();

  const log = page.getByRole("log", { name: "Messages de la conversation" });
  const last = log.getByRole("article").last();
  await expect(last).toBeVisible();
  // Pick the quick message that differs from the current last one, so the
  // teacher's view proves this run's message arrived, however many runs
  // came before.
  const lastText = (await last.textContent()) ?? "";
  const quick = QUICK.find((q) => !lastText.includes(q))!;

  await page.getByRole("region", { name: "Messages rapides, un appui pour envoyer" }).getByRole("button", { name: quick }).click();
  await expect(page.getByText("Message envoyé.")).toBeVisible();
  await expect(last).toHaveAccessibleName("Message de Vous");
  await expect(last).toContainText(quick);

  const teacher = await pageAs("enseignant");
  await teacher.goto("/espace/messages");
  await teacher.getByRole("link", { name: new RegExp(SUBJECT) }).click();
  const teacherLast = teacher.getByRole("log", { name: "Messages de la conversation" }).getByRole("article").last();
  await expect(teacherLast).toHaveAccessibleName("Message de Afiavi Hounkpatin");
  await expect(teacherLast).toContainText(quick);
});
