import { authFile } from "./support/accounts";
import { expect, test } from "./support/fixtures";

// Voice notes, recorded with Chromium's fake microphone (a steady tone) and
// its automatic consent, then played by the recipient.
test.use({
  storageState: authFile("parent"),
  launchOptions: { args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"] },
});

const SUBJECT = "Sortie pédagogique au jardin botanique";

test("a parent records a voice note and the teacher plays it @mobile", async ({ page, pageAs }) => {
  await page.goto("/espace/messages");
  await page.getByRole("link", { name: new RegExp(SUBJECT) }).click();
  await expect(page.getByRole("heading", { level: 1, name: SUBJECT })).toBeVisible();
  const log = page.getByRole("log", { name: "Messages de la conversation" });

  await page.getByRole("button", { name: "Enregistrer un message vocal" }).click();
  const recording = page.getByRole("group", { name: "Enregistrement du message vocal" });
  await expect(recording).toBeVisible();
  await expect(recording.getByText("0:02")).toBeVisible();
  await recording.getByRole("button", { name: "Arrêter" }).click();

  const preview = page.getByRole("group", { name: "Message vocal prêt à partir" });
  await expect(preview.getByRole("button", { name: /^Écouter le message vocal enregistré/ })).toBeVisible();
  await preview.getByRole("button", { name: "Envoyer" }).click();
  await expect(page.getByText("Message vocal envoyé.")).toBeVisible();
  const mine = log.getByRole("article").last();
  await expect(mine).toHaveAccessibleName("Message de Vous");
  await expect(mine.getByRole("button", { name: /^Écouter le message vocal,/ })).toBeVisible();
  const src = await mine.locator("audio").getAttribute("src");

  const teacher = await pageAs("enseignant");
  await teacher.goto("/espace/messages");
  await teacher.getByRole("link", { name: new RegExp(SUBJECT) }).click();
  const received = teacher.getByRole("log", { name: "Messages de la conversation" }).getByRole("article").last();
  await expect(received).toHaveAccessibleName("Message de Afiavi Hounkpatin");
  await received.getByRole("button", { name: /^Écouter le message vocal,/ }).click();
  await expect.poll(() => received.locator("audio").evaluate((a: HTMLAudioElement) => a.currentTime)).toBeGreaterThan(0);

  // The recording is served to the participants only, as the type sniffed at
  // upload.
  const own = await teacher.request.get(src!);
  expect(own.status()).toBe(200);
  expect(own.headers()["content-type"]).toBe("audio/webm");
  const outsider = await pageAs("comptable");
  expect((await outsider.request.get(src!)).status()).toBe(404);
});

test("a blocked microphone gets a plain explanation @mobile", async ({ page }) => {
  await page.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = () => Promise.reject(new DOMException("denied", "NotAllowedError"));
  });
  await page.goto("/espace/messages");
  await page.getByRole("link", { name: new RegExp(SUBJECT) }).click();
  await page.getByRole("button", { name: "Enregistrer un message vocal" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Le micro est bloqué pour Classéo" })).toBeVisible();
});

test("the seeded voice notes play for the parent @mobile", async ({ page }) => {
  await page.goto("/espace/messages");
  await page.getByRole("link", { name: new RegExp(SUBJECT) }).click();
  const first = page.getByRole("article", { name: "Message de Vous" }).getByRole("button", { name: /^Écouter le message vocal, 6 secondes/ }).first();
  await first.click();
  await expect(page.getByRole("button", { name: /^Mettre en pause le message vocal/ }).first()).toBeVisible();
});
