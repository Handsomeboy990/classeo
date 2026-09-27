import { expect, test } from "./support/fixtures";

// Search engines: robots.txt, the sitemap, and the head of every public
// page (one h1, a description, a canonical address, the language versions);
// the private space is never indexed.

const PUBLIC_PAGES = ["/", "/connexion", "/mot-de-passe-oublie", "/credits", "/verifier"];

test("robots.txt closes the private space and points to the sitemap", async ({ request }) => {
  const res = await request.get("/robots.txt");
  expect(res.status()).toBe(200);
  const text = await res.text();
  for (const line of ["Allow: /", "Disallow: /espace", "Disallow: /api", "Disallow: /acces"]) expect(text).toContain(line);
  expect(text).toMatch(/Sitemap: https?:\/\/\S+\/sitemap\.xml/);
});

test("the sitemap lists the public pages with their languages", async ({ request }) => {
  const res = await request.get("/sitemap.xml");
  expect(res.status()).toBe(200);
  const xml = await res.text();
  for (const path of ["/connexion", "/credits", "/verifier"]) expect(xml).toContain(`${path}</loc>`);
  expect(xml).toContain('hreflang="fon"');
  expect(xml).not.toContain("/espace");
});

for (const path of PUBLIC_PAGES) {
  test(`${path} has one h1, a description and a canonical address`, async ({ page }) => {
    await page.goto(path);
    await expect(page.locator("h1")).toHaveCount(1);
    await expect(page.locator('meta[name="description"]')).toHaveAttribute("content", /.{50,}/);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", path === "/" ? /^https?:\/\/[^/]+\/?$/ : new RegExp(`${path}$`));
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /index, follow/);
    await expect(page.locator('meta[property="og:title"]')).toHaveCount(1);
  });
}

test("a page in Fongbe is its own canonical version", async ({ page }) => {
  await page.goto("/connexion?lang=fon");
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", /\/connexion\?lang=fon$/);
  await expect(page.locator('link[rel="alternate"][hreflang="yo"]')).toHaveAttribute("href", /\/connexion\?lang=yo$/);
});

test("the home page describes the organisation", async ({ page }) => {
  await page.goto("/");
  const data = JSON.parse((await page.locator('script[type="application/ld+json"]').textContent()) ?? "[]") as { "@type": string }[];
  expect(data.map((d) => d["@type"])).toEqual(["Organization", "WebSite"]);
});

test("the private space is never indexed", async ({ pageAs }) => {
  const page = await pageAs("parent");
  const res = await page.goto("/espace");
  expect(res?.headers()["x-robots-tag"]).toContain("noindex");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
});

test("the manifest and the icons are served", async ({ request }) => {
  const manifest = await (await request.get("/manifest.webmanifest")).json();
  expect(manifest).toMatchObject({ name: "Classéo", start_url: "/espace", display: "standalone", lang: "fr" });
  for (const path of ["/icon.svg", "/apple-icon", "/icons/icon-192.png", "/favicon.ico"]) expect((await request.get(path)).status()).toBe(200);
});
