import Link from "next/link";

import { Logo } from "@/components/brand/logo";
import { AnalyticsSlot } from "@/features/analytics/analytics-slot";

import { LanguageControls } from "./language-controls";
import { PUBLIC } from "./texts";
import { withChoice, type PublicLang, type PublicTranslator } from "./translate";

// Header and footer of the public pages (home, photo credits). The header
// holds the logo, the language control of the top bars and the way in, on
// one line down to 320 px (the logo keeps its mark only on the narrowest
// phones).
export function PublicHeader({ tr, voice, signIn = true }: { tr: PublicTranslator; voice: PublicLang; signIn?: boolean }) {
  const { t, lang } = tr;
  return (
    <header lang={lang} className="sticky top-0 z-30 border-b border-border bg-surface/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-2 px-4 sm:gap-3 sm:px-8">
        <Link href={withChoice("/", lang, voice)} aria-label={t(PUBLIC.common.home)} className="mr-auto min-w-0 rounded-lg">
          <Logo className="max-[379px]:[&>span:last-child]:hidden" />
        </Link>
        <LanguageControls lang={lang} voice={voice} labels={{ language: t(PUBLIC.common.language), voice: t(PUBLIC.common.voice) }} />
        {signIn && (
          <Link
            href={withChoice("/connexion", lang, voice)}
            className="inline-flex min-h-11 items-center gap-2 rounded-control bg-primary px-4 text-sm font-bold whitespace-nowrap text-on-primary hover:bg-primary-hover max-[359px]:px-3"
          >
            {t(PUBLIC.common.signIn)}
          </Link>
        )}
      </div>
    </header>
  );
}

export function PublicFooter({ tr, voice }: { tr: PublicTranslator; voice: PublicLang }) {
  const { t, node, lang } = tr;
  const links = [
    { href: withChoice("/connexion", lang, voice), label: PUBLIC.common.signIn },
    // The offline page is written in French only.
    { href: "/hors-ligne", label: PUBLIC.common.offline },
    { href: withChoice("/credits", lang, voice), label: PUBLIC.common.credits },
  ];
  return (
    <footer lang={lang} className="border-t border-border bg-bg">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-8 sm:px-8 md:flex-row md:items-center md:justify-between">
        <div>
          <Logo />
          <p className="mt-2 text-sm text-muted">{node(PUBLIC.common.footerNote)}</p>
          {lang !== "fr" && <p className="mt-1 text-xs text-muted">{node(PUBLIC.common.machine)}</p>}
        </div>
        <nav aria-label={t(PUBLIC.common.footerNav)}>
          <ul className="flex flex-wrap gap-x-5 gap-y-1 text-sm font-semibold">
            {links.map((l) => (
              <li key={l.label}>
                <Link href={l.href} className="inline-flex min-h-11 items-center underline-offset-4 hover:underline">
                  {node(l.label)}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
      <AnalyticsSlot tr={tr} />
    </footer>
  );
}
