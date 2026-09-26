import type { Page } from "@playwright/test";

import { authFile } from "./support/accounts";
import { expect, test } from "./support/fixtures";
import { leftInFrench, visibleTexts, type Seen } from "./support/untranslated";

// Local languages: parents hold translation:view by default and see the
// language switcher; staff without it do not, and the server refuses them.
// The interface translations come from the cache filled by
// scripts/pretranslate.ts: these journeys make no call to the service for
// the interface. The voice is not exercised here (slow, and quota bound).
test.use({ storageState: authFile("parent") });

test("a parent switches the family dashboard to Fongbe and back to French @mobile", async ({ page }) => {
  await page.goto("/espace");
  const heading = page.getByRole("heading", { level: 1 });
  await expect(heading).toContainText("Bonjour");
  const select = page.getByLabel("Langue", { exact: true });
  await expect(select).toHaveValue("fr");

  // A choice made before hydration is reset to the controlled value: pick
  // again until the switcher answers.
  const translated = page.getByRole("status").filter({ hasText: /Page traduite en fongbe/ });
  await expect(async () => {
    await select.selectOption("fon");
    await expect(translated).toBeVisible({ timeout: 3_000 });
  }).toPass({ timeout: 20_000 });
  await expect(page.locator("#page-content")).toHaveAttribute("lang", "fon");
  // Names are never translated.
  await expect(heading).toContainText("Afiavi");
  await expect(heading).not.toContainText("Bonjour");

  // The French original, then the translation again.
  await page.getByRole("button", { name: "Voir en français" }).click();
  await expect(heading).toContainText("Bonjour");
  await page.getByRole("button", { name: "Revenir au fongbe" }).click();
  await expect(heading).not.toContainText("Bonjour");

  // Remembered on this device.
  await page.reload();
  await expect(page.getByLabel("Langue", { exact: true })).toHaveValue("fon");
  await expect(heading).not.toContainText("Bonjour");

  await page.getByLabel("Langue", { exact: true }).selectOption("fr");
  await expect(heading).toContainText("Bonjour");
  await expect(page.locator("#page-content")).not.toHaveAttribute("lang", /.+/);
});

test("a parent is offered the translation of an announcement", async ({ page }) => {
  await page.goto("/espace/contenus");
  const translate = page.getByRole("button", { name: "Traduire en fongbe" }).first();
  await expect(translate).toBeVisible();
  await translate.click();
  const dialog = page.getByRole("dialog", { name: "Traduction en fongbe" });
  await expect(dialog).toBeVisible();
  // Translated, or an honest message: the French text is always there.
  await expect(dialog.getByText("Texte original en français")).toBeVisible();
  await expect(dialog.getByText("Traduction en cours…")).toHaveCount(0, { timeout: 60_000 });
  await expect(dialog.locator("[lang=fon] p").or(dialog.getByRole("alert")).first()).toBeVisible();
  await dialog.getByRole("button", { name: "Fermer" }).last().click();
  await expect(dialog).toBeHidden();
});

test("staff without translation:view see no switcher and are refused by the server", async ({ pageAs }) => {
  const director = await pageAs("directeur");
  await director.goto("/espace");
  await expect(director.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(director.getByLabel("Langue", { exact: true })).toHaveCount(0);
  await expect(director.getByRole("button", { name: /^Traduire en / })).toHaveCount(0);
  const res = await director.request.post("/api/langues/interface", { data: { lang: "fon", texts: ["Bonjour"] } });
  expect(res.status()).toBe(403);
  const voice = await director.request.post("/api/langues/voix", { data: { lang: "fon", text: "Bonjour" } });
  expect(voice.status()).toBe(403);
});

test("the interface route answers from the cache and rejects unknown languages", async ({ page }) => {
  await page.goto("/espace");
  const ok = await page.request.post("/api/langues/interface", { data: { lang: "fon", texts: ["Annuler", "13,5/20", "Sènami Hounkpatin"] } });
  expect(ok.status()).toBe(200);
  const body = (await ok.json()) as { translations: Record<string, string> };
  expect(Object.keys(body.translations)).not.toContain("13,5/20");
  expect(Object.keys(body.translations)).not.toContain("Sènami Hounkpatin");
  const bad = await page.request.post("/api/langues/interface", { data: { lang: "xx", texts: ["Annuler"] } });
  expect(bad.status()).toBe(400);
});

// Coverage of the interface translation: on every page a parent reaches, in
// the shell around it and in the dialogs and sheets it opens, nothing a
// parent sees or hears stays in French once the interface is in Fongbe,
// apart from what is never translated (names of people, schools and places,
// amounts, codes). Each state is shown once in French, once in Fongbe; a
// string present, identical, in both is left in French. The translations
// come from the same cache.

// Demonstration data a parent sees and that stays as it is.
const NAMES = [
  "Afiavi Hounkpatin",
  "Afiavi",
  "Sènami Hounkpatin",
  "HOUNKPATIN Sènami",
  "Sènami",
  "Mahougnon Hounkpatin",
  "HOUNKPATIN Mahougnon",
  "Mahougnon",
  "Hounkpatin",
  "Florentin Agossou",
  "Florentin",
  "Agossou",
  "Adjoa Houngbédji",
  "Adjoa",
  "Houngbédji",
  "Nafissatou Issifou",
  "Madame Issifou",
  "Mariam Dègbo",
  "Brice Kiki",
  "Rosine Assogba",
  "Yacoubou Agbodjogbé",
  "Rodrigue Bani",
  "Prisca Idrissou",
  "Ulrich Adéoti",
  "Carine Worou",
  "Gildas Sossou",
  "Gildas",
  "Sossou",
  "Mireille Dossou",
  "CEG Godomey",
  "EPP Godomey Centre",
  "CEG Godomey et EPP Godomey Centre",
  "Abomey-Calavi",
  "Atlantique",
  "Abomey-Calavi, Atlantique",
  "Carrefour Godomey, route de Pahou, Abomey-Calavi, Atlantique",
  "Classéo",
  "MTN MoMo",
  "Moov Money",
  "FedaPay",
  "Ecobank Bénin",
];
const NAME = new RegExp(`^(?:${NAMES.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})$`);
// Amounts, identifiers (invoices, receipts, report cards, transactions,
// verification codes and links), account and phone numbers, the contact
// lines of the schools (with an e-mail address), a date and place of birth.
// "Facture" before an invoice number is also the Fon word the service
// gives back.
const DATA = [
  /^[\d\s  .,]+(?:FCFA)?$/,
  /^(?:Facture )?[A-Z]{2,4}-[\dA-Z-]+$/,
  /^[A-Z]{2}\d{6,}/,
  /^[A-Z0-9]{10,}$/,
  /^[A-Z0-9]{5}-[A-Z0-9]{5}$/,
  /^(?:BJ\d{2}|BJ\d{3})[\dA-Z ]+$/,
  /@|https?:|127\.0\.0\.1|\/verifier\//,
  /^\+?[\d ]{8,}$/,
  /^\d{2}\/\d{2}\/\d{4} à \S+$/,
];

// Content other journeys wrote (a message, an exam title) carries their
// unique suffix, a timestamp in base 36 or in figures: user content, not
// interface text.
function writtenByJourney(text: string) {
  const now = Date.now();
  const recent = (n: number) => Math.abs(n - now) < 30 * 86_400_000;
  return (text.match(/\b[a-z0-9]{8}\b/g) ?? []).some((t) => recent(parseInt(t, 36))) || (text.match(/\d{13}/g) ?? []).some((t) => recent(Number(t)));
}

function allowed(text: string) {
  const bare = text.replace(/^[\s·,()]+|[\s·,()]+$/g, "");
  return writtenByJourney(bare) || NAME.test(bare) || DATA.some((re) => re.test(bare)) || bare.split(/\s*[·,]\s*/).every((part) => NAME.test(part) || DATA.some((re) => re.test(part)));
}

async function setLanguage(page: Page, lang: "fr" | "fon") {
  await page.evaluate((lang) => {
    const key = Object.keys(localStorage).find((k) => k.startsWith("classeo:lang:"));
    if (key) localStorage.setItem(key, JSON.stringify({ lang, lastLocal: "fon" }));
  }, lang);
}

async function show(page: Page, path: string, lang: "fr" | "fon", open?: (page: Page) => Promise<void>) {
  await setLanguage(page, lang);
  await page.goto(path);
  // The region is marked once the first answer is applied (the status line
  // is hidden on a phone in a conversation).
  if (lang === "fon") await expect(page.locator("#page-content")).toHaveAttribute("lang", "fon", { timeout: 15_000 });
  if (open) await open(page);
  // Follow up requests for the strings rendered after a change.
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(lang === "fon" ? 1200 : 300);
  return visibleTexts(page);
}

type Check = { name: string; path: string; open?: (page: Page) => Promise<void> };

async function expectTranslated(page: Page, checks: Check[]) {
  const left: Record<string, Seen[]> = {};
  for (const c of checks) {
    const french = await show(page, c.path, "fr", c.open);
    let rest = leftInFrench(french, await show(page, c.path, "fon", c.open), allowed);
    // Texts rendered after an action (form errors, a toast) are translated
    // by one more request once they appear: read the page again for a few
    // seconds before calling a text untranslated, so a slow machine is not
    // mistaken for a gap.
    for (let tries = 0; rest.length && tries < 8; tries++) {
      await page.waitForTimeout(1000);
      rest = leftInFrench(french, await visibleTexts(page), allowed);
    }
    if (rest.length) left[c.name] = rest;
  }
  await setLanguage(page, "fr");
  expect(left).toEqual({});
}

// Picks the language once, so the choice is stored for this account.
async function start(page: Page) {
  await page.goto("/espace");
  const select = page.getByLabel("Langue", { exact: true });
  await expect(async () => {
    await select.selectOption("fon");
    await expect(page.getByRole("status").filter({ hasText: /Page traduite en fongbe/ })).toBeVisible({ timeout: 3_000 });
  }).toPass({ timeout: 20_000 });
}

async function hrefs(page: Page, path: string, selector: string) {
  await page.goto(path);
  // The list streams in after the loading skeleton; it may also be empty.
  await page
    .locator(selector)
    .first()
    .waitFor({ timeout: 10_000 })
    .catch(() => {});
  return page.locator(selector).evaluateAll((links) => [...new Set(links.map((a) => a.getAttribute("href")!))]);
}

test.describe("nothing stays in French on the parent pages in Fongbe", () => {
  test.describe.configure({ timeout: 240_000 });

  test("dashboard, children and their records @mobile", async ({ page }) => {
    await start(page);
    const [child] = await hrefs(page, "/espace/suivi", "#page-content a[href^='/espace/suivi/']");
    expect(child).toBeTruthy();
    await expectTranslated(page, [
      { name: "dashboard", path: "/espace" },
      { name: "children", path: "/espace/suivi" },
      { name: "child", path: child! },
      { name: "grades", path: `${child}/notes` },
      { name: "attendance", path: `${child}/presences` },
      { name: "timetable", path: `${child}/emploi-du-temps` },
      { name: "record", path: `${child}/parcours` },
    ]);
  });

  test("report cards, fees and the payment flow @mobile", async ({ page }) => {
    await start(page);
    const [child] = await hrefs(page, "/espace/suivi", "#page-content a[href^='/espace/suivi/']");
    const [report] = await hrefs(page, child!, "#page-content a[href^='/espace/bulletins/']");
    const [invoice] = await hrefs(page, "/espace/payer", "#page-content a[href^='/espace/payer/']");
    const checks: Check[] = [
      { name: "fees", path: `${child}/frais` },
      { name: "payments", path: "/espace/payer" },
    ];
    if (report) checks.push({ name: "report card", path: report });
    if (invoice) {
      checks.push({ name: "invoice", path: invoice });
      // An empty declaration: the form errors. Not the online payment form,
      // shown when a payment provider is configured.
      checks.push({ name: "invoice form errors", path: invoice, open: (p) => p.locator("#page-content form:has(input[name=transactionRef]) button[type=submit]").click() });
    }
    await expectTranslated(page, checks);
  });

  test("mock exams, announcements, messages, notifications, preferences, guide @mobile", async ({ page }) => {
    await start(page);
    // The seeded exam, listed last: the exams other journeys create start
    // later and carry texts they wrote.
    const exam = (await hrefs(page, "/espace/examens-blancs", "#page-content a[href^='/espace/examens-blancs/']")).at(-1);
    const [content] = await hrefs(page, "/espace/contenus", "#page-content a[href^='/espace/contenus/c']");
    const [thread] = await hrefs(page, "/espace/messages", "#page-content a[href^='/espace/messages/']");
    const checks: Check[] = [
      { name: "mock exams", path: "/espace/examens-blancs" },
      { name: "announcements", path: "/espace/contenus" },
      { name: "messages", path: "/espace/messages" },
      { name: "notifications", path: "/espace/notifications" },
      { name: "preferences", path: "/espace/preferences" },
      { name: "guide", path: "/espace/aide" },
      { name: "new conversation", path: "/espace/messages", open: (p) => p.locator("#page-content button:has(svg.lucide-message-square-plus)").first().click() },
    ];
    if (exam) checks.push({ name: "mock exam", path: exam });
    if (content) checks.push({ name: "announcement", path: content });
    if (thread) checks.push({ name: "conversation", path: thread });
    await expectTranslated(page, checks);
  });

  test("the shell: menus, sheets and the accessibility panel @mobile", async ({ page, isMobile }) => {
    await start(page);
    const checks: Check[] = [{ name: "accessibility panel", path: "/espace", open: (p) => p.locator(".a11y-fab").click() }];
    if (isMobile) {
      checks.push({ name: "menu sheet", path: "/espace", open: (p) => p.locator("[data-tab-bar] button[aria-haspopup=dialog]").click() });
      checks.push({ name: "account sheet", path: "/espace", open: (p) => p.locator("header button[aria-haspopup=dialog]:visible").last().click() });
    } else {
      checks.push({ name: "account menu", path: "/espace", open: (p) => p.locator("header button[aria-haspopup]:visible").last().click() });
    }
    // A page reached by a client side navigation, without reload.
    checks.push({
      name: "client navigation",
      path: "/espace",
      open: async (p) => {
        await p.locator(isMobile ? "[data-tab-bar] a[href='/espace/messages']" : "aside a[href='/espace/messages']").click();
        await p.waitForURL(/\/espace\/messages$/);
      },
    });
    await expectTranslated(page, checks);
  });
});
