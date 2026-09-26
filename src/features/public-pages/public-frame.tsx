import Link from "next/link";

import { Logo } from "@/components/brand/logo";

import { LanguageControls } from "./language-controls";
import { PUBLIC } from "./texts";
import { withChoice, type PublicLang, type PublicTranslator } from "./translate";

// Header and footer of the public pages (home, photo credits). The header
// carries the two language controls, discreet beside the way in; on a phone
// they take a second row of their own.
export function PublicHeader({ tr, voice, signIn = true }: { tr: PublicTranslator; voice: PublicLang; signIn?: boolean }) {
  const { t, lang } = tr;
  return (
    <header lang={lang} className="border-b border-border bg-surface">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-4 gap-y-3 px-4 py-3 sm:px-8">
        <Link href={withChoice("/", lang, voice)} aria-label={t(PUBLIC.common.home)} className="min-w-0 rounded-lg">
          <Logo />
        </Link>
        <LanguageControls
          lang={lang}
          voice={voice}
          labels={{ language: t(PUBLIC.common.language), voice: t(PUBLIC.common.voice), apply: t(PUBLIC.common.apply) }}
          className="order-last w-full border-t border-border pt-3 sm:order-none sm:ml-auto sm:w-auto sm:border-0 sm:pt-0"
        />
        {signIn && (
          <Link
            href={withChoice("/connexion", lang, voice)}
            className="ml-auto inline-flex min-h-11 items-center gap-2 rounded-control bg-primary px-4 text-sm font-bold whitespace-nowrap text-on-primary hover:bg-primary-hover sm:ml-0"
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
    </footer>
  );
}
