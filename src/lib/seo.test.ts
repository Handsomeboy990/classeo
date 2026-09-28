import { describe, expect, it } from "vitest";

import robots from "@/app/robots";
import sitemap from "@/app/sitemap";

import { homeJsonLd, jsonLdString, languageAlternates, NO_INDEX, publicMetadata, robotsRules, siteUrl, sitemapEntries } from "./seo";

const BASE = "https://classeo.bj";

describe("robots.txt", () => {
  it("opens the public pages and closes the private ones", () => {
    const r = robotsRules(BASE);
    expect(r.sitemap).toBe("https://classeo.bj/sitemap.xml");
    expect(r.rules[0]!.allow).toEqual(["/"]);
    expect(r.rules[0]!.disallow).toEqual(expect.arrayContaining(["/espace", "/api", "/acces", "/changer-mot-de-passe", "/hors-ligne", "/mot-de-passe-oublie/"]));
    // The public forgotten password page itself stays open.
    expect(r.rules[0]!.disallow).not.toContain("/mot-de-passe-oublie");
  });

  it("is what app/robots.ts serves", () => {
    expect(robots()).toEqual(robotsRules());
  });
});

describe("sitemap.xml", () => {
  it("lists the public pages with their date and language versions", () => {
    const entries = sitemapEntries(BASE);
    expect(entries.map((e) => e.url)).toEqual([`${BASE}/`, `${BASE}/connexion`, `${BASE}/mot-de-passe-oublie`, `${BASE}/credits`, `${BASE}/verifier`]);
    const home = entries[0]!;
    expect(home.lastModified).toBeInstanceOf(Date);
    expect(home.alternates?.languages).toEqual({ fr: `${BASE}/`, fon: `${BASE}/?lang=fon`, yo: `${BASE}/?lang=yo` });
    expect(entries.find((e) => e.url.endsWith("/verifier"))!.alternates).toBeUndefined();
    expect(entries.some((e) => e.url.includes("/espace") || e.url.includes("/acces"))).toBe(false);
  });

  it("is what app/sitemap.ts serves", () => {
    expect(sitemap()).toEqual(sitemapEntries());
  });
});

describe("page metadata", () => {
  it("gives a canonical address per language, the alternates and the share cards", () => {
    const m = publicMetadata({ path: "/connexion", title: "Connexion", description: "Se connecter.", lang: "fon" });
    expect(m.alternates?.canonical).toBe("/connexion?lang=fon");
    expect(m.alternates?.languages).toEqual(languageAlternates("/connexion"));
    expect(m.openGraph).toMatchObject({ url: "/connexion?lang=fon", locale: "fon_BJ", title: "Connexion · Classéo", description: "Se connecter." });
    expect(m.twitter).toMatchObject({ card: "summary_large_image" });
    expect(m.robots).toEqual({ index: true, follow: true });
  });

  it("names the share card on every public page but the home, which has its own file", () => {
    for (const path of ["/connexion", "/mot-de-passe-oublie", "/credits", "/verifier"]) {
      const m = publicMetadata({ path, title: "T", description: "D" });
      expect(m.openGraph, path).toMatchObject({ images: [{ url: "/opengraph-image", width: 1200, height: 630 }] });
      expect(m.twitter, path).toMatchObject({ images: [{ url: "/opengraph-image" }] });
    }
    expect(publicMetadata({ path: "/", title: "T", description: "D" }).openGraph).not.toHaveProperty("images");
  });

  it("ignores an unknown language and a page without languages", () => {
    expect(publicMetadata({ path: "/", title: "T", description: "D", lang: "xx" }).alternates?.canonical).toBe("/");
    const verify = publicMetadata({ path: "/verifier", title: "T", description: "D", lang: "fon", languages: false });
    expect(verify.alternates).toEqual({ canonical: "/verifier" });
  });

  it("closes private pages", () => {
    expect(NO_INDEX).toMatchObject({ index: false, follow: false });
  });

  it("describes the organisation and the site, safely embedded", () => {
    const [org, site] = homeJsonLd(BASE);
    expect(org).toMatchObject({ "@type": "Organization", name: "Classéo", url: `${BASE}/` });
    expect(site).toMatchObject({ "@type": "WebSite", inLanguage: ["fr", "fon", "yo"] });
    expect(jsonLdString({ a: "</script><script>alert(1)</script>" })).not.toContain("</script>");
  });

  it("reads the site address from the environment", () => {
    expect(siteUrl({ APP_URL: "https://classeo.bj/" })).toBe(BASE);
    expect(siteUrl({ VERCEL_PROJECT_PRODUCTION_URL: "classeo.vercel.app" })).toBe("https://classeo.vercel.app");
  });
});
