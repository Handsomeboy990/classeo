import type { BrowserContext, Page } from "@playwright/test";

import { authFile, type Role } from "./support/accounts";
import { expect, test } from "./support/fixtures";

// Offline journeys, with the real service worker (the rest of the suite
// blocks it). A teacher signs in with network: the key pages of the role are
// downloaded in the background, even those never opened. Without network the
// teacher opens a grade sheet and a register never visited, enters a grade
// and an absence, and both are saved when the network returns. A grade
// changed meanwhile by the head of school is refused, kept on the device,
// and sent again after correction.

type OfflineState = { userId: string; updatedAt: number; running?: boolean; pages: { url: string; title: string | null }[] };

const SHOTS = process.env.E2E_SCREENSHOTS;

async function shot(page: Page, name: string) {
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true });
}

async function openContext(browser: import("@playwright/test").Browser, baseURL: string | undefined, role: Role) {
  return browser.newContext({ baseURL, storageState: authFile(role), serviceWorkers: "allow", locale: "fr-FR", timezoneId: "Africa/Porto-Novo", viewport: { width: 1366, height: 900 } });
}

// Waits until the service worker has downloaded the key pages of the role.
async function offlinePages(page: Page) {
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined));
  let state: OfflineState | null = null;
  await expect
    .poll(
      async () => {
        state = await page.evaluate(async () => {
          const name = (await caches.keys()).find((k) => k.startsWith("classeo-meta-"));
          if (!name) return null;
          const hit = await (await caches.open(name)).match("/__classeo/offline-state");
          return hit ? hit.json() : null;
        });
        return state && !state.running && state.updatedAt > 0 ? state.pages.length : 0;
      },
      { timeout: 90_000, intervals: [1000] },
    )
    .toBeGreaterThan(3);
  return state as unknown as OfflineState;
}

async function goOffline(context: BrowserContext, page: Page) {
  await context.setOffline(true);
  await page.evaluate(() => window.dispatchEvent(new Event("offline")));
}

async function goOnline(context: BrowserContext, page: Page) {
  await context.setOffline(false);
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
}

test.describe("offline entry", () => {
  test.describe.configure({ mode: "serial" });
  test.setTimeout(180_000);

  let sheetUrl = "";
  let registerUrl = "";

  test("a teacher enters a grade and an absence without network, both are saved when it returns", async ({ browser, baseURL }) => {
    const context = await openContext(browser, baseURL, "enseignant");
    const page = await context.newPage();
    await page.goto("/espace");
    const state = await offlinePages(page);
    sheetUrl = state.pages.find((p) => /^\/espace\/notes\/[\w-]+$/.test(p.url))!.url;
    registerUrl = state.pages.find((p) => p.url.startsWith("/espace/presences?") && p.url.endsWith("MORNING"))!.url;
    expect(sheetUrl).toBeTruthy();
    expect(registerUrl).toBeTruthy();

    await page.goto("/espace/preferences");
    const available = page.getByRole("region", { name: "Hors ligne" });
    await expect(available.getByText(/Dernière mise à jour le/)).toBeVisible();
    await expect(available.getByRole("link", { name: /Semestre|Trimestre/ }).first()).toBeVisible();
    await shot(page, "01-preferences-offline-pages");

    // No network from here on: the sheet and the register were never opened.
    await goOffline(context, page);
    await page.goto(sheetUrl);
    await expect(page.getByText(/Vous êtes hors ligne/)).toBeVisible();
    const grid = page.getByRole("table", { name: /Grille de saisie des notes/ });
    const cell = grid.getByRole("textbox", { name: /^Interrogation écrite 1, / }).nth(2);
    const label = (await cell.getAttribute("aria-label"))!;
    const original = await cell.inputValue();
    const value = original === "13" ? "12" : "13";
    await cell.fill(value);
    await page.getByRole("button", { name: "Enregistrer les notes" }).click();
    await expect(page.getByText("1 note en attente d'envoi", { exact: true }).first()).toBeVisible();
    await expect(page.locator("[data-offline-status]")).toContainText("1 saisie en attente d'envoi");
    await shot(page, "02-grade-offline-pending");

    await page.goto(registerUrl);
    const row = page.getByRole("group", { name: /^Statut de / }).nth(1);
    const student = ((await row.locator("legend").textContent()) ?? "").replace("Statut de ", "");
    const wasAbsent = await row.getByRole("radio", { name: "Absent" }).isChecked();
    const target = wasAbsent ? "Présent" : "Absent";
    await row.getByText(target, { exact: true }).click();
    await page.getByRole("button", { name: /Enregistrer (l'appel|à nouveau)/ }).first().click();
    await expect(page.getByText("Appel en attente d'envoi")).toBeVisible();
    await expect(page.locator("[data-offline-status]")).toContainText("2 saisies en attente d'envoi");
    await shot(page, "03-register-offline-pending");

    // Back online: the queue is replayed through /api/offline/replay.
    const replayed = page.waitForResponse((r) => r.url().endsWith("/api/offline/replay") && r.status() === 200);
    await goOnline(context, page);
    await replayed;
    await expect(page.locator("[data-offline-status]")).toHaveCount(0, { timeout: 30_000 });
    await shot(page, "04-register-synced");

    await page.goto(sheetUrl);
    await expect(page.getByRole("textbox", { name: label, exact: true })).toHaveValue(value);
    await page.goto(registerUrl);
    const saved = page.getByRole("group", { name: `Statut de ${student}` });
    await expect(saved.getByRole("radio", { name: target })).toBeChecked();

    // Put the grade back as it was.
    await page.goto(sheetUrl);
    await page.getByRole("textbox", { name: label, exact: true }).fill(original);
    await page.getByRole("button", { name: "Enregistrer les notes" }).click();
    await expect(page.getByText("Tout est enregistré")).toBeVisible();
    await context.close();
  });

  test("a grade changed by someone else meanwhile is refused, kept, and sent again after review", async ({ browser, baseURL }) => {
    const context = await openContext(browser, baseURL, "enseignant");
    const page = await context.newPage();
    await page.goto("/espace");
    await offlinePages(page);

    await goOffline(context, page);
    await page.goto(sheetUrl);
    const cell = page.getByRole("table", { name: /Grille de saisie des notes/ }).getByRole("textbox", { name: /^Interrogation écrite 1, / }).nth(3);
    const label = (await cell.getAttribute("aria-label"))!;
    const original = await cell.inputValue();
    const mine = original === "15" ? "16" : "15";
    const theirs = original === "7" ? "6" : "7";
    await cell.fill(mine);
    await page.getByRole("button", { name: "Enregistrer les notes" }).click();
    await expect(page.getByText("1 note en attente d'envoi", { exact: true }).first()).toBeVisible();

    // Meanwhile the head of school, online, changes the same grade.
    const head = await (await browser.newContext({ baseURL, storageState: authFile("directeur"), serviceWorkers: "block" })).newPage();
    await head.goto(sheetUrl);
    await head.getByRole("textbox", { name: label, exact: true }).fill(theirs);
    await head.getByRole("button", { name: "Enregistrer les notes" }).click();
    await expect(head.getByText("Tout est enregistré")).toBeVisible();

    const replayed = page.waitForResponse((r) => r.url().endsWith("/api/offline/replay"));
    await goOnline(context, page);
    const answer = await (await replayed).json();
    expect(answer.outcome).toBe("rejected");
    await expect(page.getByRole("alert").filter({ hasText: "par une autre saisie" }).first()).toBeVisible();
    await expect(page.locator("[data-offline-status]")).toContainText("1 saisie à revoir");
    // The typed value is back in the grid, to correct and send again.
    await expect(page.getByRole("textbox", { name: label, exact: true })).toHaveValue(mine);
    await shot(page, "05-grade-refused");

    await page.goto("/espace/preferences#hors-ligne");
    await expect(page.getByRole("link", { name: "Rouvrir pour corriger" })).toBeVisible();
    await shot(page, "06-preferences-to-review");
    await page.getByRole("link", { name: "Rouvrir pour corriger" }).click();
    await expect(page.getByRole("textbox", { name: label, exact: true })).toHaveValue(mine);
    await page.getByRole("button", { name: "Enregistrer les notes" }).click();
    await expect(page.getByText("Tout est enregistré")).toBeVisible();
    await expect(page.locator("[data-offline-status]")).toHaveCount(0);
    await page.reload();
    await expect(page.getByRole("textbox", { name: label, exact: true })).toHaveValue(mine);

    // Put the grade back as it was.
    await page.getByRole("textbox", { name: label, exact: true }).fill(original);
    await page.getByRole("button", { name: "Enregistrer les notes" }).click();
    await expect(page.getByText("Tout est enregistré")).toBeVisible();
    await head.context().close();
    await context.close();
  });

  test("a message written without network is kept, then sent once when the network returns", async ({ browser, baseURL }) => {
    const context = await openContext(browser, baseURL, "enseignant");
    const page = await context.newPage();
    await page.goto("/espace/messages");
    await page.locator('a[href^="/espace/messages/"]').first().click();
    await expect(page).toHaveURL(/\/espace\/messages\/[\w-]+$/);
    await page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined));
    // Opened once with network: the conversation is kept for this account.
    await page.reload();

    await goOffline(context, page);
    await page.reload();
    const text = `Message écrit hors ligne ${Date.now()}`;
    await page.getByLabel("Votre message").fill(text);
    await page.getByRole("button", { name: "Envoyer", exact: true }).last().click();
    await expect(page.getByText(text)).toBeVisible();
    await expect(page.getByText(/En attente d'envoi, écrit le/)).toBeVisible();
    await expect(page.getByLabel("Votre message")).toHaveValue("");
    await shot(page, "07-message-offline-pending");

    const replayed = page.waitForResponse((r) => r.url().endsWith("/api/offline/replay") && r.status() === 200);
    await goOnline(context, page);
    expect((await (await replayed).json()).outcome).toBe("applied");
    await expect(page.getByText(/En attente d'envoi, écrit le/)).toHaveCount(0);
    await page.reload();
    await expect(page.getByText(text)).toHaveCount(1);
    await context.close();
  });

  test("a parent's children files are kept on the device after sign in", async ({ browser, baseURL }) => {
    const context = await openContext(browser, baseURL, "parent");
    const page = await context.newPage();
    await page.goto("/espace");
    const state = await offlinePages(page);
    const files = state.pages.filter((p) => /^\/espace\/suivi\/[\w-]+$/.test(p.url));
    expect(files.length).toBeGreaterThan(0);
    expect(state.pages.some((p) => p.url.endsWith("/emploi-du-temps"))).toBe(true);

    await goOffline(context, page);
    await page.goto(files[0]!.url);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByText(/Vous êtes hors ligne/)).toBeVisible();
    await shot(page, "08-parent-child-file-offline");
    await context.close();
  });
});
