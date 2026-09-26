// Search engine settings of the public pages: the canonical address, the
// language variants, the share cards, the sitemap and robots rules. Pure,
// tested in seo.test.ts; the pages and app/robots.ts, app/sitemap.ts use it.
//
// Only the public pages are indexed. The private space, the API, the secret
// demonstration page and the password flows are closed to robots (robots.txt,
// a noindex meta and an X-Robots-Tag header, see next.config.ts).

import type { Metadata } from "next";

import { appUrl } from "@/lib/mail/config";

type Env = Record<string, string | undefined>;

export const SITE_NAME = "Classéo";

export function siteUrl(env: Env = process.env) {
  return appUrl(env);
}

// The languages of the public pages (?lang=). hreflang takes BCP 47 codes:
// "fon" (Fongbe) has no two letter code.
export const SEO_LANGS = ["fr", "fon", "yo"] as const;
export type SeoLang = (typeof SEO_LANGS)[number];

const OG_LOCALES: Record<SeoLang, string> = { fr: "fr_BJ", fon: "fon_BJ", yo: "yo_BJ" };

// Public pages, in the sitemap. lastModified: the last change of the page's
// content, updated by hand when the text changes.
export const PUBLIC_PAGES = [
  { path: "/", lastModified: "2026-09-26", priority: 1, languages: true },
  { path: "/connexion", lastModified: "2026-09-26", priority: 0.8, languages: true },
  { path: "/mot-de-passe-oublie", lastModified: "2026-09-26", priority: 0.5, languages: true },
  { path: "/credits", lastModified: "2026-09-26", priority: 0.3, languages: true },
  { path: "/verifier", lastModified: "2026-09-26", priority: 0.6, languages: false },
] as const;

// Never indexed. Kept in step with the noindex metadata of these pages.
export const PRIVATE_PREFIXES = ["/espace", "/api", "/acces", "/changer-mot-de-passe", "/hors-ligne", "/mot-de-passe-oublie/"] as const;

export function withLang(path: string, lang: SeoLang) {
  return lang === "fr" ? path : `${path}?lang=${lang}`;
}

// The address of each language of a page, and x-default for the French one.
export function languageAlternates(path: string, base = siteUrl()): Record<string, string> {
  const out: Record<string, string> = {};
  for (const lang of SEO_LANGS) out[lang] = `${base}${withLang(path, lang)}`;
  out["x-default"] = `${base}${path}`;
  return out;
}

export function isSeoLang(value: unknown): value is SeoLang {
  return typeof value === "string" && (SEO_LANGS as readonly string[]).includes(value);
}

// Metadata of a public page: description, canonical address (the language
// shown), the other languages, and the share cards (the image comes from
// app/opengraph-image.tsx).
export function publicMetadata(page: { path: string; title: string; description: string; lang?: unknown; languages?: boolean; absoluteTitle?: boolean }): Metadata {
  const lang: SeoLang = page.languages !== false && isSeoLang(page.lang) ? page.lang : "fr";
  const canonical = withLang(page.path, lang);
  return {
    title: page.absoluteTitle ? { absolute: page.title } : page.title,
    description: page.description,
    alternates: { canonical, ...(page.languages !== false ? { languages: languageAlternates(page.path) } : {}) },
    openGraph: {
      type: "website",
      siteName: SITE_NAME,
      locale: OG_LOCALES[lang],
      url: canonical,
      title: page.absoluteTitle ? page.title : `${page.title} · ${SITE_NAME}`,
      description: page.description,
    },
    twitter: { card: "summary_large_image", title: page.absoluteTitle ? page.title : `${page.title} · ${SITE_NAME}`, description: page.description },
    robots: { index: true, follow: true },
  };
}

// For every signed in page, the demo page and the password flows.
export const NO_INDEX: Metadata["robots"] = { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } };

export function robotsRules(base = siteUrl()) {
  return {
    rules: [{ userAgent: "*", allow: ["/"], disallow: [...PRIVATE_PREFIXES] }],
    sitemap: `${base}/sitemap.xml`,
  };
}

export function sitemapEntries(base = siteUrl()) {
  return PUBLIC_PAGES.map((p) => ({
    url: `${base}${p.path}`,
    lastModified: new Date(`${p.lastModified}T00:00:00Z`),
    changeFrequency: "monthly" as const,
    priority: p.priority,
    ...(p.languages ? { alternates: { languages: Object.fromEntries(SEO_LANGS.map((l) => [l, `${base}${withLang(p.path, l)}`])) } } : {}),
  }));
}

// Structured data of the home page: the organisation and the site.
export function homeJsonLd(base = siteUrl()) {
  return [
    {
      "@context": "https://schema.org",
      "@type": "Organization",
      name: SITE_NAME,
      url: `${base}/`,
      logo: `${base}/icons/icon-512.png`,
      description: "Plateforme de gestion scolaire pour le Bénin : inscriptions, notes, bulletins, présences, frais et messages.",
      areaServed: { "@type": "Country", name: "Bénin" },
    },
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: SITE_NAME,
      url: `${base}/`,
      inLanguage: [...SEO_LANGS],
    },
  ];
}

// JSON for a script tag: "<" escaped so the data can never close the tag.
export function jsonLdString(data: unknown) {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
