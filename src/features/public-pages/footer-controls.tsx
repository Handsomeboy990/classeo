"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { choiceQuery, PUBLIC_LANGS, type PublicLang } from "./translate";

// "Accessibilité" in the footer opens the settings of the round button that
// every screen carries (components/shell/accessibility-fab.tsx, in the root
// layout): the same panel on a large screen, the same sheet on a phone.
export function AccessibilityLink({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <button type="button" aria-haspopup="dialog" onClick={() => document.querySelector<HTMLButtonElement>("button.a11y-fab")?.click()} className={className}>
      {children}
    </button>
  );
}

// The languages of the public pages, as links to the same page in each one
// (the voice follows the page). Pages written in French only link to the
// home page instead.
export function FooterLanguages({ lang, translatable, className }: { lang: PublicLang; translatable: boolean; className?: string }) {
  const pathname = usePathname();
  const base = translatable ? pathname : "/";
  return (
    <ul className="flex flex-col" data-no-translate>
      {PUBLIC_LANGS.map((l) => (
        <li key={l.code}>
          <Link
            href={`${base}${choiceQuery(l.code, l.code)}`}
            hrefLang={l.code}
            lang={l.code}
            aria-current={translatable && l.code === lang ? "true" : undefined}
            className={className}
          >
            {l.label}
          </Link>
        </li>
      ))}
    </ul>
  );
}
