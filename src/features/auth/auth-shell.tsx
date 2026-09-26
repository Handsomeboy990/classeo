import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

import { BeninFlag } from "@/components/brand/flag";
import { Logo } from "@/components/brand/logo";
import { ReadAloud } from "@/components/kit/read-aloud";
import { TextProvider } from "@/components/kit/text-provider";
import { LanguageControls } from "@/features/public-pages/language-controls";
import { photo, shortCredit } from "@/features/public-pages/photos";
import { PHOTO_IMAGES } from "@/features/public-pages/photo-images";
import { listenText, PUBLIC } from "@/features/public-pages/texts";
import { withChoice, type PublicLang, type PublicTranslator } from "@/features/public-pages/translate";

const PHOTO = photo("cour-de-recreation.webp");

const ASIDES = {
  signin: { title: PUBLIC.landing.title, body: null },
  help: { title: PUBLIC.help.asideTitle, body: PUBLIC.help.asideBody },
  code: { title: PUBLIC.code.asideTitle, body: PUBLIC.code.asideBody },
} as const;

// Frame of the signed out pages: sign in and forgotten password. On a
// phone, the school yard photograph as a band at the top and the form on a
// sheet rising over it, as in an installed application. On a large screen,
// the photograph fills the left half, with a word on the way back in, and
// the form sits in a card on the right. The language of the page and of the
// voice are chosen above the form; the texts arrive translated (tr) and
// reach the client forms through TextProvider.
export function AuthShell({
  tr,
  voice,
  title,
  description,
  children,
  aside,
  listen,
  extra,
}: {
  tr: PublicTranslator;
  voice: PublicLang;
  // French sources, from features/public-pages/texts.ts.
  title: string;
  description: string;
  children: ReactNode;
  aside: keyof typeof ASIDES;
  // A French text of PUBLIC_SPEECH, read aloud on request.
  listen?: string;
  // Parameters of the address kept when the language changes (?next=).
  extra?: Record<string, string | undefined>;
}) {
  const { t, node, lang, texts } = tr;
  const side = ASIDES[aside];
  const home = withChoice("/", lang, voice);

  return (
    <main id="page-content" tabIndex={-1} lang={lang} className="flex min-h-dvh flex-col bg-surface outline-none lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(30rem,38rem)] lg:bg-bg">
      <div className="relative h-40 shrink-0 overflow-hidden bg-sidebar min-[400px]:h-48 sm:h-60 lg:sticky lg:top-0 lg:h-dvh">
        <Image
          src={PHOTO_IMAGES[PHOTO.file]}
          alt={t(PHOTO.alt)}
          fill
          priority
          sizes="(min-width: 1024px) 60vw, 100vw"
          className="object-cover object-[30%_45%] lg:object-[8%_50%]"
          placeholder="blur"
        />
        {/* Phones: the way home over the photograph. */}
        <div className="absolute inset-x-0 top-0 flex items-center justify-between gap-3 bg-gradient-to-b from-black/60 to-transparent px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-8 sm:px-8 lg:hidden">
          <Link href={home} aria-label={t(PUBLIC.common.home)} className="rounded-lg">
            <Logo tone="inverse" className="[&>span:last-child]:text-white" />
          </Link>
          <span className="flex items-center gap-2 text-xs font-semibold text-white" lang="fr" translate="no">
            <BeninFlag className="h-3.5" />
            Bénin
          </span>
        </div>
        {/* Large screens: a word on the way back in. */}
        <div className="absolute inset-x-0 bottom-0 hidden bg-gradient-to-t from-black/80 via-black/45 to-transparent px-12 pt-40 pb-10 text-white lg:block">
          <p className="max-w-lg font-display text-3xl leading-tight font-bold text-balance xl:text-4xl">{node(side.title)}</p>
          {side.body && <p className="mt-3 max-w-lg leading-relaxed text-white/90">{node(side.body)}</p>}
        </div>
      </div>

      <section className="relative z-10 -mt-6 flex flex-1 flex-col rounded-t-3xl bg-surface px-5 pt-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:px-8 lg:mt-0 lg:rounded-none lg:bg-bg lg:py-8">
        <LanguageControls
          lang={lang}
          voice={voice}
          extra={extra}
          labels={{ language: t(PUBLIC.common.language), voice: t(PUBLIC.common.voice), apply: t(PUBLIC.common.apply) }}
          className="mx-auto w-full max-w-md border-b border-border pb-4 lg:mx-0 lg:ml-auto lg:w-auto lg:max-w-none lg:border-0 lg:pb-0"
        />
        <div className="flex flex-1 flex-col justify-center lg:py-8">
          <div className="mx-auto w-full max-w-md pt-6 lg:rounded-2xl lg:border lg:border-border lg:bg-surface lg:p-8 lg:shadow-raised">
            <div className="mb-7 hidden items-center justify-between gap-3 lg:flex">
              <Link href={home} aria-label={t(PUBLIC.common.home)} className="rounded-lg">
                <Logo />
              </Link>
              <span className="flex items-center gap-2 text-xs font-semibold text-muted" lang="fr" translate="no">
                <BeninFlag className="h-3.5" />
                Bénin
              </span>
            </div>
            <h1 className="text-[1.75rem] leading-tight font-bold tracking-tight sm:text-3xl">{node(title)}</h1>
            <p className="mt-2 leading-relaxed text-muted">{node(description)}</p>
            {listen && (
              <ReadAloud text={listen} lang={voice} label={t(listenText(voice))} translatable={false} className="mt-3 h-11 self-start px-3.5" />
            )}
            <div className="mt-6">
              <TextProvider lang={lang} texts={texts}>
                {children}
              </TextProvider>
            </div>
            {lang !== "fr" && <p className="mt-6 text-xs text-muted">{node(PUBLIC.common.machine)}</p>}
          </div>
        </div>
        <p className="mx-auto mt-8 w-full max-w-md text-center text-xs text-muted lg:mt-0">
          {t(PUBLIC.common.photo)} : <span translate="no">{shortCredit(PHOTO)}</span>
          {" · "}
          <Link href={withChoice("/credits", lang, voice)} className="inline-flex min-h-11 items-center font-semibold underline underline-offset-4 hover:text-text">
            {node(PUBLIC.common.credits)}
          </Link>
        </p>
      </section>
    </main>
  );
}
