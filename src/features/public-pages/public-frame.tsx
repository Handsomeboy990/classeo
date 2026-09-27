import { ChevronDown, ExternalLink, LogIn } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { BeninFlag, FlagStripe } from "@/components/brand/flag";
import { IndependenceNotice } from "@/components/brand/independence-notice";
import { loadBrand } from "@/components/brand/load-brand";
import { BrandLockup } from "@/components/brand/lockup";
import { cn } from "@/lib/utils";

import { AccessibilityLink, FooterLanguages } from "./footer-controls";
import { LanguageControls } from "./language-controls";
import { NATIONAL_MOTTO, USEFUL_LINKS } from "./links";
import { PublicMenu, type PublicNavItem } from "./public-menu";
import { PUBLIC } from "./texts";
import { createTranslator, withChoice, type PublicLang, type PublicTranslator } from "./translate";

// Header and footer of the public pages (home, credits, document check,
// offline, not found, access refused), in the grammar of the official sites
// of Benin (design source of truth, parts 3.2, 3.5 and 3.6): a dark band,
// the navy main bar with the brand lockup, a tricolour rule; a dark footer
// in columns ending on the flag band. Always the light official look: no
// colour here follows the system's dark mode.

// Content width and side margins of the header and footer.
const WRAP = "mx-auto w-full max-w-[80rem] px-5 sm:px-6 lg:px-8";

type Current = "home" | "verify" | null;

// The notice, followed on a translated page by its translation.
export function noticeTranslation(tr: PublicTranslator) {
  const translated = tr.t(PUBLIC.common.notice);
  return tr.lang !== "fr" && translated !== PUBLIC.common.notice ? translated : undefined;
}

export async function PublicHeader({
  tr,
  voice,
  current = null,
  signIn = true,
  languages = true,
}: {
  tr: PublicTranslator;
  voice: PublicLang;
  // The page of the main navigation shown (aria-current).
  current?: Current;
  signIn?: boolean;
  // false on the pages written in French only.
  languages?: boolean;
}) {
  const { t, node, lang } = tr;
  const brand = await loadBrand();
  const signInHref = withChoice("/connexion", lang, voice);
  const nav: PublicNavItem[] = [
    {
      key: "home",
      href: withChoice("/", lang, voice),
      label: node(PUBLIC.common.navHome),
      current: current === "home",
    },
    // The document check is written in French only.
    {
      key: "verify",
      href: "/verifier",
      label: node(PUBLIC.common.verify),
      current: current === "verify",
    },
  ];

  return (
    <>
      {/* The band scrolls away with the page. Its background is not the
          bg-band utility: the yellow focus ring of the navy surfaces would
          reach the light panel of the language menu. */}
      <div lang={lang} className="bg-(--band) text-band-text shadow-[inset_0_-1px_0_rgb(255_255_255/0.1)]">
        <div className={cn(WRAP, "flex h-11 items-center gap-2 lg:h-9")}>
          <BeninFlag className="h-3 w-[1.125rem] rounded-[1px]" />
          <p className="min-w-0 text-xs leading-tight">
            <span className="max-lg:hidden">{node(PUBLIC.common.band)}</span>
            <span className="max-[359px]:hidden lg:hidden">{node(PUBLIC.common.bandShort)}</span>
          </p>
          {languages && (
            <LanguageControls
              lang={lang}
              voice={voice}
              tone="inverse"
              labels={{
                language: t(PUBLIC.common.language),
                voice: t(PUBLIC.common.voice),
              }}
              className="ml-auto [&_[data-language-menu]]:rounded-control [&_[data-language-menu]]:border-white/25 [&_[data-language-menu]]:bg-white/10 [&_[data-language-menu]]:backdrop-blur-none [&_[data-language-menu]:focus-visible]:outline-flag-yellow! [&_[data-language-menu]:hover]:bg-white/20 lg:[&_[data-language-menu]]:h-7 lg:[&_[data-language-menu]]:text-xs"
            />
          )}
        </div>
      </div>

      <header lang={lang} className="sticky top-0 z-30">
        <div className="bg-header text-header-text">
          {/* Below 1024 px the bar keeps its px sizes at every text size
              (64 px, margins 16 then 20 px, 44 px buttons, the lockup of
              part 3.1): it holds a logo and icon buttons, and with a very
              large text it would otherwise push the menu off the screen
              (WCAG 1.4.10) and take a third of the window, sticky. */}
          <div className="mx-auto flex h-[64px] w-full max-w-[80rem] items-center gap-[8px] px-[16px] min-[400px]:gap-[12px] min-[400px]:px-[20px] sm:px-[24px] lg:h-20 lg:gap-3 lg:px-8">
            {/* The compact size of the lockup below 1024 px: the coat of arms,
                the name and the two buttons hold on one line down to 320 px. */}
            <BrandLockup brand={brand} tone="dark" size="bar" fixed href={withChoice("/", lang, voice)} className="mr-auto lg:hidden" />
            <BrandLockup brand={brand} tone="dark" size="header" href={withChoice("/", lang, voice)} className="mr-auto max-lg:hidden" />
            <nav aria-label={t(PUBLIC.common.mainNav)} className="h-full max-lg:hidden">
              <ul className="flex h-full items-stretch gap-1">
                {nav.map((item) => (
                  <li key={item.key} className="relative flex items-center">
                    <Link
                      href={item.href}
                      aria-current={item.current ? "page" : undefined}
                      className={cn(
                        "rounded-control px-3.5 py-2.5 font-display text-[0.8125rem] leading-none font-semibold tracking-[0.04em] uppercase hover:bg-white/10 hover:text-white",
                        item.current ? "text-white" : "text-white/90",
                      )}
                    >
                      {item.label}
                    </Link>
                    {item.current && <span aria-hidden className="absolute inset-x-[1.125rem] bottom-0 h-[3px] bg-flag-yellow" />}
                  </li>
                ))}
              </ul>
            </nav>
            {signIn && (
              <Link
                href={signInHref}
                className="inline-flex h-[44px] shrink-0 items-center justify-center gap-[8px] rounded-control bg-accent px-3 font-display text-sm font-bold whitespace-nowrap text-on-accent hover:brightness-95 focus-visible:outline-white! max-[439px]:w-[44px] max-[439px]:px-0 min-[440px]:px-4 max-sm:text-large:w-[44px] max-sm:text-large:px-0! lg:ml-4 lg:h-11 lg:gap-2 lg:px-5"
              >
                <LogIn className="size-[18px] shrink-0 lg:size-[1.125rem]" aria-hidden />
                {/* One name at a time, the one shown: "Connexion" on a
                    phone, the icon alone under 440 px (the official lockup
                    leaves no more room) and, with a very large text, under
                    640 px; "Se connecter" from 1024 px. */}
                <span className="sr-only min-[440px]:hidden max-sm:text-large:inline!">{node(PUBLIC.common.signInShort)}</span>
                <span className="max-[439px]:hidden max-sm:text-large:hidden lg:hidden">{node(PUBLIC.common.signInShort)}</span>
                <span className="max-lg:hidden">{node(PUBLIC.common.signIn)}</span>
              </Link>
            )}
            <PublicMenu
              lang={lang}
              items={nav}
              signIn={signIn ? { href: signInHref, label: node(PUBLIC.common.signIn) } : null}
              labels={{
                menu: t(PUBLIC.common.menu),
                open: t(PUBLIC.common.openMenu),
                close: t(PUBLIC.common.closeMenu),
                nav: t(PUBLIC.common.mainNav),
              }}
              lockup={<BrandLockup brand={brand} tone="dark" size="drawer" />}
              notice={<IndependenceNotice brand={brand} translation={noticeTranslation(tr)} />}
            />
          </div>
        </div>
        <FlagStripe className="h-1" />
      </header>
    </>
  );
}

// Links of the footer: 44 px targets below 1024 px, 32 px above.
const FOOT_LINK = "inline-flex min-h-11 items-center gap-1.5 py-1 text-left text-sm text-footer-text underline-offset-[3px] hover:text-white hover:underline lg:min-h-8";

export async function PublicFooter({ tr, voice, languages = true }: { tr: PublicTranslator; voice: PublicLang; languages?: boolean }) {
  const { t, node, lang } = tr;
  const brand = await loadBrand();
  const year = new Date().getFullYear();

  const columns: { title: string; body: ReactNode }[] = [
    {
      title: PUBLIC.common.footerPlatform,
      body: (
        <ul className="flex flex-col">
          <li>
            <Link href={withChoice("/", lang, voice)} className={FOOT_LINK}>
              {node(PUBLIC.common.navHome)}
            </Link>
          </li>
          <li>
            <Link href={withChoice("/connexion", lang, voice)} className={FOOT_LINK}>
              {node(PUBLIC.common.signIn)}
            </Link>
          </li>
          <li>
            <Link href="/verifier" className={FOOT_LINK}>
              {node(PUBLIC.common.verify)}
            </Link>
          </li>
          <li>
            {/* The offline page is written in French only. */}
            <Link href="/hors-ligne" className={FOOT_LINK}>
              {node(PUBLIC.common.offline)}
            </Link>
          </li>
        </ul>
      ),
    },
    {
      title: PUBLIC.common.footerHelp,
      body: (
        <ul className="flex flex-col">
          <li>
            <Link href={withChoice("/mot-de-passe-oublie", lang, voice)} className={FOOT_LINK}>
              {node(PUBLIC.help.title)}
            </Link>
          </li>
          <li>
            <AccessibilityLink className={FOOT_LINK}>{node(PUBLIC.common.accessibility)}</AccessibilityLink>
          </li>
          <li>
            <Link href={withChoice("/credits", lang, voice)} className={FOOT_LINK}>
              {node(PUBLIC.common.credits)}
            </Link>
          </li>
        </ul>
      ),
    },
    {
      title: PUBLIC.common.footerLinks,
      body: (
        <ul className="flex flex-col" lang="fr" translate="no">
          {USEFUL_LINKS.map((l) => (
            <li key={l.href}>
              <a href={l.href} rel="noopener noreferrer" className={cn(FOOT_LINK, "items-start")}>
                <span>
                  {l.label}
                  <ExternalLink className="ml-1.5 inline size-3.5 align-[-0.125em]" aria-hidden />
                  <span className="sr-only" lang={lang}>
                    {" "}
                    {t(PUBLIC.common.external)}
                  </span>
                </span>
              </a>
            </li>
          ))}
        </ul>
      ),
    },
    {
      title: PUBLIC.common.footerLanguages,
      body: <FooterLanguages lang={lang} translatable={languages} className={FOOT_LINK} />,
    },
  ];

  const heading = "font-display text-xs leading-tight font-bold tracking-[0.08em] text-white uppercase";

  return (
    <footer lang={lang} className="bg-footer text-footer-text">
      <div className={cn(WRAP, "pt-10 pb-5 lg:pt-14 lg:pb-6")}>
        <div className="grid gap-x-8 gap-y-2 sm:grid-cols-2 sm:gap-y-8 lg:grid-cols-[1.4fr_1fr_1fr_1.25fr_0.8fr] lg:gap-10">
          <div className="max-sm:mb-4 sm:col-span-2 lg:col-span-1">
            <BrandLockup brand={brand} tone="dark" size="footer" href={withChoice("/", lang, voice)} />
            <p className="mt-4 max-w-[36ch] text-sm leading-relaxed text-footer-muted">{node(PUBLIC.common.footerNote)}</p>
            {brand.official && (
              <div className="mt-4 flex flex-col gap-2">
                <p className="font-display text-xs font-semibold text-footer-muted" lang="fr" translate="no">
                  {NATIONAL_MOTTO}
                </p>
                <FlagStripe className="h-0.5 w-24" />
              </div>
            )}
          </div>
          {columns.map((c) => (
            <div key={c.title}>
              {/* Phones: each column folds into a section. */}
              <details className="group border-b border-footer-rule sm:hidden">
                <summary className={cn(heading, "flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 [&::-webkit-details-marker]:hidden")}>
                  {node(c.title)}
                  <ChevronDown className="size-4 shrink-0 transition-transform group-open:rotate-180 motion-reduce:transition-none" aria-hidden />
                </summary>
                <div className="pb-4">{c.body}</div>
              </details>
              <div className="max-sm:hidden">
                <h2 className={cn(heading, "mb-4 border-b border-footer-rule pb-3")}>{node(c.title)}</h2>
                {c.body}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-10 flex flex-col gap-4 border-t border-footer-rule pt-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex flex-col gap-1.5">
            <p className="text-[0.8125rem] text-footer-muted">
              © {year} <span translate="no">Classéo</span>
            </p>
            <IndependenceNotice brand={brand} tone="dark" translation={noticeTranslation(tr)} />
            {lang !== "fr" && <p className="text-xs text-footer-muted">{node(PUBLIC.common.machine)}</p>}
          </div>
          <p className="flex shrink-0 flex-wrap items-center gap-x-2 text-[0.8125rem] text-footer-muted">
            <Link href={withChoice("/credits", lang, voice)} className="inline-flex min-h-11 items-center underline-offset-[3px] hover:text-white hover:underline lg:min-h-8">
              {node(PUBLIC.common.credits)}
            </Link>
            <span aria-hidden>·</span>
            <Link href="/hors-ligne" className="inline-flex min-h-11 items-center underline-offset-[3px] hover:text-white hover:underline lg:min-h-8">
              {node(PUBLIC.common.offline)}
            </Link>
          </p>
        </div>
      </div>
      <FlagStripe className="h-1.5" />
    </footer>
  );
}

// The content of a public page, between the header and the footer.
export function PublicMain({ lang, children, className }: { lang: PublicLang; children: ReactNode; className?: string }) {
  return (
    <main id="page-content" tabIndex={-1} lang={lang} className={cn("bg-bg outline-none", className)}>
      {children}
    </main>
  );
}

// A public page written in French only (document check, offline, not found,
// access refused): the same header and footer, without the language menu.
export function FrenchPublicPage({ current = null, className, children }: { current?: Current; className?: string; children: ReactNode }) {
  const tr = createTranslator("fr", {});
  return (
    <>
      <PublicHeader tr={tr} voice="fr" current={current} languages={false} />
      <PublicMain lang="fr" className={className}>
        {children}
      </PublicMain>
      <PublicFooter tr={tr} voice="fr" languages={false} />
    </>
  );
}
