import { authFile } from "./support/accounts";
import { expect, test, uniqueSuffix } from "./support/fixtures";

// Journey 5: an audio announcement needs a written transcript, for readers
// who are deaf or hard of hearing. The announcement is deleted at the end.
test.use({ storageState: authFile("directeur") });

test("director publishes an audio announcement only with a transcript, then deletes it", async ({ page }) => {
  const title = `Annonce de test ${uniqueSuffix()}`;
  const transcriptRequired =
    "La transcription est obligatoire pour un audio ou une vidéo : les personnes sourdes ou malentendantes doivent pouvoir lire tout ce qui est dit.";

  await page.goto("/espace/contenus/nouveau");
  await expect(page.getByRole("heading", { level: 1, name: "Nouveau contenu" })).toBeVisible();

  await page.getByRole("combobox", { name: "Type", exact: true }).selectOption({ label: "Annonce" });
  await page.getByLabel("Titre").fill(title);
  await page.getByLabel("Résumé facile à lire").fill("Message de test, il sera supprimé tout de suite.");
  await page.getByLabel("Texte complet").fill("Annonce créée par la suite de tests de bout en bout, puis supprimée.");
  await page.getByRole("combobox", { name: "Cible" }).selectOption({ label: "CEG Godomey" });
  await page.getByRole("combobox", { name: "Public" }).selectOption({ label: "Personnel" });
  await page.getByRole("combobox", { name: "Type de média" }).selectOption({ label: "Audio" });

  // Without a transcript: refused, the form keeps what was typed.
  const transcript = page.getByLabel("Transcription écrite");
  await expect(transcript).toBeVisible();
  await page.getByRole("button", { name: "Publier" }).click();
  await expect(page.getByText(transcriptRequired)).toBeVisible();
  await expect(transcript).toHaveAttribute("aria-invalid", "true");
  await expect(transcript).toBeFocused();
  await expect(page).toHaveURL(/\/espace\/contenus\/nouveau$/);
  await expect(page.getByLabel("Titre")).toHaveValue(title);

  // With a transcript: accepted.
  await transcript.fill("Bonjour à toutes et à tous. Ceci est la transcription de l'annonce de test.");
  await page.getByRole("button", { name: "Publier" }).click();
  await expect(page).toHaveURL(/\/espace\/contenus\/(?!nouveau)[\w-]+$/);
  await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
  await expect(page.getByText("Ceci est la transcription de l'annonce de test.")).toBeVisible();

  // Clean up through the interface.
  await page.getByRole("button", { name: `Supprimer « ${title} »` }).click();
  const dialog = page.getByRole("dialog", { name: "Supprimer ce contenu ?" });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Supprimer", exact: true }).click();

  await expect(page).toHaveURL(/\/espace\/contenus\?supprime=1$/);
  await expect(page.getByText("Contenu supprimé.")).toBeVisible();
  await expect(page.getByText(title)).toHaveCount(0);
});
