import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { BRAND_DEFAULTS, INDEPENDENCE_NOTICE } from "@/components/brand/settings";

import { AppFooter, FOOTER_LINKS } from "./app-footer";

const footer = (notice: boolean) => renderToStaticMarkup(createElement(AppFooter, { brand: { ...BRAND_DEFAULTS, notice }, year: 2026 }));
const text = (html: string) => html.replace(/<[^>]+>/g, "").replace(/&#x27;/g, "'");

describe("app footer", () => {
  it("carries the copyright and the whole independence notice under a 1 px border rule", () => {
    const html = footer(true);
    expect(text(html)).toContain("© 2026 Classéo");
    expect(text(html)).toContain(INDEPENDENCE_NOTICE.full);
    expect(html).toContain('lang="fr" translate="no"');
    // Part 3.5: a plain --border rule, not the tricolour band.
    expect(html).toMatch(/data-app-footer-body[^>]*border-t border-border/);
    expect(html).not.toContain("bg-flag-green");
  });

  it("links to the help, the document check and the credits, in a named navigation", () => {
    const html = footer(true);
    expect(html).toContain('aria-label="Liens du pied de page"');
    expect(FOOTER_LINKS.map((l) => l.href)).toEqual(["/espace/aide", "/verifier", "/credits"]);
    for (const l of FOOTER_LINKS) expect(html).toContain(`href="${l.href}"`);
  });

  it("drops only the notice when the option is off", () => {
    const html = footer(false);
    expect(text(html)).not.toContain(INDEPENDENCE_NOTICE.full);
    expect(html).toContain('href="/espace/aide"');
  });
});
