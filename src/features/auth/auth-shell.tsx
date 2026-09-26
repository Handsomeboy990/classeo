import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

import { BeninFlag } from "@/components/brand/flag";
import { Logo } from "@/components/brand/logo";
import { InfoTip } from "@/components/kit/info-tip";
import { ReadAloud } from "@/components/kit/read-aloud";
import { TextProvider } from "@/components/kit/text-provider";
import { AnalyticsSlot } from "@/features/analytics/analytics-slot";
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

// Frame of the signed out pages: sign in and forgotten password.
//
// Phone, portrait: a short band of the school yard photograph (8 to 10rem,
// never more than a fifth of a small screen) carrying the logo and the
// language control, then the form on a sheet rising over it, as in an
// installed application. Phone, landscape (a short window): the band
// shrinks to a strip, so the form starts in view. Large screen: the
// photograph fills the left half with a word on the way back in, the form
// sits in a card on the right, the language control above it.
//
// The texts arrive translated (tr) and reach the client forms through
// TextProvider. description "info" keeps the page's explanation in an info
// bubble beside the title (sign in: the form speaks for itself).
export function AuthShell({
  tr,
  voice,
  title,
  description,
  descriptionAs = "text",
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
  descriptionAs?: "text" | "info";
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
  const labels = { language: t(PUBLIC.common.language), voice: t(PUBLIC.common.voice) };

  return (
    <main id="page-content" tabIndex={-1} lang={lang} className="flex min-h-dvh flex-col bg-surface outline-none lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(30rem,38rem)] lg:bg-bg">
      <div className="relative h-36 shrink-0 overflow-hidden bg-sidebar min-[400px]:h-40 sm:h-52 lg:sticky lg:top-0 lg:h-dvh [@media(max-height:540px)_and_(max-width:1023px)]:h-20">
        <Image
          src={PHOTO_IMAGES[PHOTO.file]}
          alt={t(PHOTO.alt)}
          fill
          priority
          sizes="(min-width: 1024px) 60vw, 100vw"
          className="object-cover object-[30%_45%] lg:object-[8%_50%]"
          placeholder="blur"
        />
        {/* Phones: the way home and the language over the photograph. */}
        <div className="absolute inset-x-0 top-0 flex items-center justify-between gap-3 bg-gradient-to-b from-black/65 via-black/30 to-transparent px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-8 sm:px-8 lg:hidden">
          <Link href={home} aria-label={t(PUBLIC.common.home)} className="min-w-0 rounded-lg">
            <Logo tone="inverse" className="[&>span:last-child]:text-white" />
          </Link>
          <LanguageControls lang={lang} voice={voice} extra={extra} labels={labels} tone="inverse" />
        </div>
        {/* Large screens: a word on the way back in. */}
        <div className="absolute inset-x-0 bottom-0 hidden bg-gradient-to-t from-black/80 via-black/45 to-transparent px-12 pt-40 pb-10 text-white lg:block">
          <p className="max-w-lg font-display text-3xl leading-tight font-bold text-balance xl:text-4xl">{node(side.title)}</p>
          {side.body && <p className="mt-3 max-w-lg leading-relaxed text-white/90">{node(side.body)}</p>}
        </div>
      </div>

      <section className="relative z-10 -mt-5 flex flex-1 flex-col rounded-t-[1.75rem] bg-surface px-5 pt-7 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-[0_-8px_24px_-12px_rgb(0_0_0/0.25)] min-[400px]:px-6 sm:px-10 lg:mt-0 lg:rounded-none lg:bg-bg lg:px-8 lg:py-8 lg:shadow-none">
        <div className="hidden justify-end lg:flex">
          <LanguageControls lang={lang} voice={voice} extra={extra} labels={labels} />
        </div>
        <div className="flex flex-1 flex-col lg:justify-center lg:py-8">
          <div className="mx-auto w-full max-w-md lg:rounded-2xl lg:border lg:border-border lg:bg-surface lg:p-8 lg:shadow-raised">
            <div className="mb-7 hidden items-center justify-between gap-3 lg:flex">
              <Link href={home} aria-label={t(PUBLIC.common.home)} className="rounded-lg">
                <Logo />
              </Link>
              <span className="flex items-center gap-2 text-xs font-semibold text-muted" lang="fr" translate="no">
                <BeninFlag className="h-3.5" />
                Bénin
              </span>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex min-w-0 flex-1 items-center gap-1.5">
                <h1 className="min-w-0 text-[1.75rem] leading-tight font-bold tracking-tight sm:text-3xl">{node(title)}</h1>
                {descriptionAs === "info" && (
                  <InfoTip label={t(PUBLIC.common.moreInfo)} className="mt-1">
                    {node(description)}
                  </InfoTip>
                )}
              </div>
              {listen && <ReadAloud text={listen} lang={voice} label={t(listenText(voice))} translatable={false} />}
            </div>
            {descriptionAs === "text" && <p className="mt-2 leading-relaxed text-pretty text-muted">{node(description)}</p>}
            <div className="mt-6">
              <TextProvider lang={lang} texts={texts}>
                {children}
              </TextProvider>
            </div>
            {lang !== "fr" && <p className="mt-6 text-xs text-muted">{node(PUBLIC.common.machine)}</p>}
          </div>
        </div>
        <p className="mx-auto mt-6 w-full max-w-md text-center text-xs text-muted lg:mt-0">
          {t(PUBLIC.common.photo)} : <span translate="no">{shortCredit(PHOTO)}</span>
          {" · "}
          <Link href={withChoice("/credits", lang, voice)} className="inline-flex min-h-11 items-center font-semibold underline underline-offset-4 hover:text-text">
            {node(PUBLIC.common.credits)}
          </Link>
        </p>
      </section>
      <AnalyticsSlot tr={tr} />
    </main>
  );
}
