import { PUBLIC_SPEECH_TEXTS } from "../src/lib/voice/public-texts";

import { authFile } from "./support/accounts";
import { expect, test } from "./support/fixtures";

// Kora's voice on the server (Piper, voice Siwis). A test server has it when
// KORA_TTS_URL points at a local run of api/kora-tts.py, and not otherwise:
// these journeys check who may ask for speech either way, and the clip when
// the voice is there.
const LANDING = PUBLIC_SPEECH_TEXTS[0]!;

test.describe("signed out", () => {
  test("the speech routes serve only the texts of the public pages", async ({ request }) => {
    const status = await request.get("/api/voix");
    expect(status.status()).toBe(200);
    const { voice } = (await status.json()) as { voice: string | null };

    const privateText = await request.post("/api/voix", { data: { text: "Moyenne de Sènami : 13,5 sur 20.", part: 0 } });
    expect(privateText.status()).toBe(401);
    const publicText = await request.post("/api/voix", { data: { text: LANDING, part: 0 } });
    // Without the voice the server says so and the browser reads itself.
    expect(publicText.status()).toBe(voice ? 200 : 503);
    if (voice) {
      const { clip } = (await publicText.json()) as { clip: string };
      const audio = await request.get(clip);
      expect(audio.headers()["content-type"]).toBe("audio/wav");
      expect((await audio.body()).subarray(0, 4).toString()).toBe("RIFF");
    }

    const local = await request.post("/api/langues/voix", { data: { lang: "fon", text: "Bonjour" } });
    expect(local.status()).toBe(401);
    const localPublic = await request.post("/api/langues/voix", { data: { lang: "fon", text: LANDING } });
    expect([401, 403]).not.toContain(localPublic.status());

    // A cached clip needs a session, or the token given with a public clip.
    expect((await request.get("/api/langues/audio/unknown")).status()).toBe(404);
    expect((await request.get("/api/langues/audio/unknown?t=forged")).status()).toBe(404);
  });

  test("the landing page offers to listen", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("button", { name: "Écouter", exact: true })).toBeVisible();
  });
});

test.describe("signed in", () => {
  test.use({ storageState: authFile("parent") });

  test("Préférences tell which voice reads French @mobile", async ({ page, request }) => {
    const { voice } = (await (await request.get("/api/voix")).json()) as { voice: string | null };
    await page.goto("/espace/preferences");
    const info = page.getByRole("region", { name: "Voix utilisée" });
    await expect(info.getByRole("status")).toContainText(voice ? "Français : voix Siwis, la même sur tous les appareils." : "Français : voix de cet appareil");
    await expect(page.getByRole("radio", { name: "Normale" }).first()).toBeChecked();
  });

  test("a signed in user may ask for any French text", async ({ page }) => {
    await page.goto("/espace");
    const res = await page.request.post("/api/voix", { data: { text: "Moyenne de Sènami : 13,5 sur 20.", part: 0 } });
    expect([200, 503]).toContain(res.status());
    const bad = await page.request.post("/api/voix", { data: { text: "Une phrase.", part: 5 } });
    expect([400, 503]).toContain(bad.status());
  });
});
