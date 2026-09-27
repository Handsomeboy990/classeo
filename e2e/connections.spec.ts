import { expect, expectForbidden, test } from "./support/fixtures";

// Connection statistics (features/connections): the national administration
// sees every connection with full IP addresses, a departmental direction its
// territory only and truncated addresses, the page view beacon counts pages.

const PAGE = "/espace/statistiques/connexions";

test("the national administration sees the connections, its own sign in and full addresses", async ({ pageAs }) => {
  const page = await pageAs("ministre");
  await page.goto(`${PAGE}?role=NATIONAL_ADMIN&resultat=SUCCESS`);
  await expect(page.getByRole("heading", { level: 1, name: "Connexions et fréquentation" })).toBeVisible();
  // The sign in of the setup project is in the table.
  const table = page.getByRole("table", { name: /Connexions récentes/ });
  await expect(table.getByText("Adjoa Houngbédji").first()).toBeVisible();
  await expect(table.getByText("Connexion réussie").first()).toBeVisible();

  await page.goto(PAGE);
  await expect(page.getByRole("heading", { name: "Connexions par jour" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Utilisateurs actifs par département" })).toBeVisible();
  // Full addresses: at least one address is not truncated.
  const ips = await page.getByTestId("top-ip").allTextContents();
  expect(ips.length).toBeGreaterThan(0);
  expect(ips.some((ip) => /^\d+\.\d+\.\d+\.\d+$/.test(ip.trim()))).toBe(true);
  // Page views of the platform, national accounts only.
  await expect(page.getByRole("heading", { name: "Fréquentation des pages" })).toBeVisible();

  const csv = await page.request.get(`/api/export/connexions?periode=7`);
  expect(csv.status()).toBe(200);
  expect(csv.headers()["content-type"]).toContain("text/csv");
});

test("a departmental direction sees its department only, with truncated addresses", async ({ pageAs }) => {
  const page = await pageAs("ddestfp");
  // A department chosen in the address is ignored.
  await page.goto(`${PAGE}?periode=90&departement=cm0000000000000000000000`);
  await expect(page.getByRole("heading", { level: 1, name: "Connexions et fréquentation" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Utilisateurs actifs par commune" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Fréquentation des pages" })).toHaveCount(0);
  await expect(page.getByLabel("Département")).toHaveCount(0);

  const table = page.getByRole("table", { name: /Connexions récentes/ });
  await expect(table.locator("tbody tr").first()).toBeVisible();
  for (const text of await table.locator("tbody tr td:nth-child(4)").allTextContents()) expect(text).toMatch(/Atlantique|–/);

  for (const ip of [...(await page.getByTestId("top-ip").allTextContents()), ...(await page.getByTestId("recent-ip").allTextContents())]) {
    expect(ip.trim()).toMatch(/x|direct|unknown|–/);
  }
});

test("an analyst without connection_ip:view sees truncated addresses in the export", async ({ pageAs }) => {
  const page = await pageAs("analyste");
  await page.goto(PAGE);
  for (const ip of await page.getByTestId("top-ip").allTextContents()) expect(ip.trim()).toMatch(/x|direct|unknown/);
  const csv = await (await page.request.get("/api/export/connexions?periode=90")).text();
  expect(csv).not.toMatch(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/);
});

test("school staff cannot open the connections page", async ({ pageAs }) => {
  const page = await pageAs("directeur");
  // Refused inside the loading boundary of the statistics section: the 403
  // page is rendered in the stream.
  await page.goto(PAGE);
  await expectForbidden(page);
  expect((await page.request.get("/api/export/connexions")).status()).toBe(403);
});

test("the page view beacon counts same site views only", async ({ request, baseURL }) => {
  const ok = await request.post("/api/stats/visite", { data: { path: "/connexion", lang: "fon" }, headers: { origin: baseURL! } });
  expect(ok.status()).toBe(204);
  const foreign = await request.post("/api/stats/visite", { data: { path: "/" }, headers: { origin: "https://evil.example" } });
  expect(foreign.status()).toBe(403);
  const bad = await request.post("/api/stats/visite", { data: { path: "https://evil.example" }, headers: { origin: baseURL! } });
  expect(bad.status()).toBe(400);
});

test("the retention cron refuses a call without the secret", async ({ request }) => {
  const res = await request.get("/api/cron/retention");
  expect([401, 503]).toContain(res.status());
});
