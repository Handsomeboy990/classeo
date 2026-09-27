import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { IndependenceNotice } from "./independence-notice";
import { BrandLockup, type LockupSize } from "./lockup";
import { BRAND_DEFAULTS, INDEPENDENCE_NOTICE, type BrandSettings } from "./settings";

const OFFICIAL: BrandSettings = { ...BRAND_DEFAULTS, official: true };
const INDEPENDENT: BrandSettings = { ...BRAND_DEFAULTS, official: false };
const FULL = "Plateforme indépendante, non officielle. Non affiliée au Gouvernement du Bénin.";
const SIZES: LockupSize[] = ["header", "sidebar", "bar", "drawer", "footer", "auth"];

const notice = (props: Parameters<typeof IndependenceNotice>[0]) => renderToStaticMarkup(createElement(IndependenceNotice, props));
const lockup = (props: Parameters<typeof BrandLockup>[0]) => renderToStaticMarkup(createElement(BrandLockup, props));
// Visible text of a fragment, without its tags.
const text = (html: string) => html.replace(/<[^>]+>/g, "").replace(/&#x27;/g, "'");

// Classes that would clip, shorten, hide or fade a text.
const HIDING = /\b(truncate|line-clamp-\d|text-ellipsis|overflow-hidden|opacity-\d+|italic|sr-only|hidden)\b/;

describe("brand defaults", () => {
  it("show the coat of arms and keep the notice (owner decision of 2026-09-27)", () => {
    expect(BRAND_DEFAULTS.official).toBe(true);
    expect(BRAND_DEFAULTS.notice).toBe(true);
    expect(BRAND_DEFAULTS.authority).toBe("");
  });

  it("hold the exact wording of both notices", () => {
    expect(INDEPENDENCE_NOTICE.full).toBe(FULL);
    expect(INDEPENDENCE_NOTICE.short).toBe("Plateforme indépendante");
  });
});

describe("IndependenceNotice", () => {
  for (const [mode, brand] of [
    ["official", OFFICIAL],
    ["independent", INDEPENDENT],
  ] as const) {
    it(`shows the exact sentence, whole, in ${mode} mode`, () => {
      const html = notice({ brand });
      expect(text(html)).toBe(FULL);
      // Nothing clips, shortens, fades or hides it, at any width.
      for (const cls of html.matchAll(/class="([^"]*)"/g)) expect(cls[1]).not.toMatch(HIDING);
      expect(html).not.toMatch(/title=|uppercase|max-\[/);
      expect(html).toContain('lang="fr"');
      expect(html).toContain('translate="no"');
    });
  }

  it("renders nothing when the notice option is off", () => {
    expect(notice({ brand: { ...OFFICIAL, notice: false } })).toBe("");
    expect(notice({ brand: { ...INDEPENDENT, notice: false } })).toBe("");
  });

  it("offers the short form for documents", () => {
    expect(text(notice({ brand: OFFICIAL, variant: "short" }))).toBe("Plateforme indépendante");
  });

  it("keeps the French sentence first, then the translation in brackets", () => {
    expect(text(notice({ brand: OFFICIAL, translation: "Traduction" }))).toBe(`${FULL} (Traduction)`);
  });

  it("uses the muted colour of its surface", () => {
    expect(notice({ tone: "dark" })).toContain("text-footer-muted");
    expect(notice({ tone: "light" })).toContain("text-muted");
  });
});

describe("BrandLockup", () => {
  it("official mode: coat of arms, République du Bénin above its rule, then Classéo as a product (decision D5)", () => {
    for (const size of SIZES) {
      const html = lockup({ brand: OFFICIAL, size });
      expect(html).toContain('src="/brand/armoiries-benin.svg"');
      expect(html).toMatch(/<img[^>]*alt=""/);
      expect(html).toContain('data-brand-lockup="official"');
      // The State first, as a small muted supra-line over the rule, then
      // the product name.
      expect(html).toMatch(/République du Bénin[\s\S]*bg-flag-green[\s\S]*>Classéo</);
      const republic = html.match(/<span[^>]*class="([^"]*)"[^>]*>République du Bénin<\/span>/);
      expect(republic![1]).toContain("text-[0.5625em]");
      expect(republic![1]).toMatch(/text-(header-)?muted/);
      // Classéo in sentence case, never in the capitals of an institution.
      const word = html.match(/<span[^>]*class="([^"]*)"[^>]*>Classéo<\/span>/);
      expect(word![1]).not.toContain("uppercase");
      // No ministry name, no independent subtitle.
      expect(text(html)).not.toMatch(/Minist/);
      expect(html).not.toContain("Gestion scolaire");
    }
  });

  it("official mode: the product line, except in the app bar and the sidebar, and the part that goes under 360 px", () => {
    for (const size of SIZES.filter((s) => s !== "bar" && s !== "sidebar")) {
      const html = lockup({ brand: OFFICIAL, size });
      expect(html).toMatch(/max-\[359px\]:hidden[^>]*>Plateforme de gestion scolaire</);
    }
    for (const size of ["bar", "sidebar"] as const) expect(text(lockup({ brand: OFFICIAL, size }))).not.toContain("Plateforme de gestion scolaire");
  });

  it("keeps the px sizes of part 3.1 when fixed, and follows the text size otherwise", () => {
    expect(lockup({ brand: OFFICIAL, fixed: true })).toContain("text-[16px]");
    expect(lockup({ brand: OFFICIAL })).toContain("text-[1rem]");
  });

  it("official mode names a configured authority, then Classéo", () => {
    const html = lockup({ brand: { ...OFFICIAL, authority: "Autorité de test" } });
    expect(text(html)).toContain("Autorité de test");
    expect(text(html)).toContain("Classéo");
  });

  it("independent mode: the Classéo mark, no coat of arms", () => {
    const html = lockup({ brand: INDEPENDENT, size: "header" });
    expect(html).not.toContain("armoiries");
    expect(html).not.toContain("République du Bénin");
    expect(text(html)).toContain("Gestion scolaire · Bénin");
    // The subtitle is the part that goes under 360 px, never the name.
    expect(html).toMatch(/max-\[359px\]:hidden[^>]*>Gestion scolaire/);
    // The app bar keeps the name alone.
    expect(text(lockup({ brand: INDEPENDENT, size: "bar" }))).not.toContain("Gestion scolaire");
  });

  it("never truncates the word Classéo", () => {
    for (const brand of [OFFICIAL, INDEPENDENT, { ...OFFICIAL, authority: "Autorité de test" }]) {
      for (const size of SIZES) {
        const html = lockup({ brand, size });
        const word = html.match(/<span[^>]*class="([^"]*)"[^>]*>Classéo<\/span>/);
        expect(word, `${size}`).not.toBeNull();
        expect(word![1]).toContain("whitespace-nowrap");
        expect(word![1]).not.toMatch(HIDING);
      }
    }
  });

  it("as the home link, is named Classéo, accueil", () => {
    const html = lockup({ brand: OFFICIAL, href: "/" });
    const link = html.match(/<a [^>]*>/)?.[0] ?? "";
    expect(link).toContain('href="/"');
    expect(link).toContain('aria-label="Classéo, accueil"');
  });

  it("takes the colours of its surface", () => {
    expect(lockup({ brand: OFFICIAL, tone: "dark" })).toContain("text-header-text");
    expect(lockup({ brand: OFFICIAL, tone: "light" })).toContain("text-primary");
  });
});
