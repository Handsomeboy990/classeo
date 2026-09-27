"use client";

import Link from "next/link";

import { FlagStripe } from "@/components/brand/flag";
import { IndependenceNotice } from "@/components/brand/independence-notice";
import { INDEPENDENCE_NOTICE, type BrandSettings } from "@/components/brand/settings";
import { useLanguageState } from "@/features/languages/client";

// Links of the app footer and of the Menu sheet's closing lines.
export const FOOTER_LINKS = [
  { href: "/espace/aide", label: "Aide" },
  { href: "/verifier", label: "Vérifier un document" },
  { href: "/credits", label: "Crédits photos" },
] as const;

// The independence notice of the private space. The French sentence holds;
// on a page shown in a local language its translation follows in brackets,
// with the machine translation warning (the translation layer translates
// the bracketed copy, never the French one, marked translate="no").
export function SpaceNotice({ brand, tone = "light", className }: { brand: BrandSettings; tone?: "light" | "dark"; className?: string }) {
  const s = useLanguageState();
  const translated = s.allowed && s.lang !== "fr" && !s.showOriginal;
  return (
    <IndependenceNotice
      brand={brand}
      tone={tone}
      className={className}
      translation={
        translated ? (
          <>
            {INDEPENDENCE_NOTICE.full} <span>Traduction automatique : en cas de doute, le texte français fait foi.</span>
          </>
        ) : undefined
      }
    />
  );
}

// Footer of the private space (design source of truth, part 3.5): a working
// tool, so a light and compact one. A tricolour band opens it, then the
// copyright, the independence notice and three links. Placed after the
// main region by the layout; below lg it keeps the room of the tab bar and
// of the floating button at its end (shell.css), so it is never covered.
export function AppFooter({ brand, year }: { brand: BrandSettings; year: number }) {
  return (
    <footer data-app-footer className="mt-auto w-full">
      <FlagStripe className="h-1" />
      <div data-app-footer-body className="mx-auto w-full max-w-7xl px-4 pt-5 pb-6 text-xs leading-normal text-muted sm:px-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start sm:gap-x-6 sm:gap-y-2">
          <p className="shrink-0 font-display font-semibold text-text">
            © {year} <span translate="no">Classéo</span>
          </p>
          <SpaceNotice brand={brand} className="min-w-0 sm:flex-1" />
          <nav aria-label="Liens du pied de page" className="shrink-0">
            <ul className="-mx-2 flex flex-wrap items-center">
              {FOOTER_LINKS.map((l, i) => (
                <li key={l.href} className="flex items-center">
                  {i > 0 && (
                    <span aria-hidden className="text-border-strong">
                      ·
                    </span>
                  )}
                  <Link
                    href={l.href}
                    className="inline-flex min-h-11 items-center rounded-control px-2 font-semibold text-link underline-offset-[3px] hover:underline lg:min-h-8"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </div>
    </footer>
  );
}
