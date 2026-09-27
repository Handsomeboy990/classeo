import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

import { FlagStripe } from "@/components/brand/flag";
import { IndependenceNotice } from "@/components/brand/independence-notice";
import { loadBrand } from "@/components/brand/load-brand";
import { BrandLockup } from "@/components/brand/lockup";
import { InfoTip } from "@/components/kit/info-tip";
import { ReadAloud } from "@/components/kit/read-aloud";
import { TextProvider } from "@/components/kit/text-provider";
import { AnalyticsSlot } from "@/features/analytics/analytics-slot";
import { LanguageControls } from "@/features/public-pages/language-controls";
import { photo, shortCredit } from "@/features/public-pages/photos";
import { PHOTO_IMAGES } from "@/features/public-pages/photo-images";
import { noticeTranslation } from "@/features/public-pages/public-frame";
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
// The official look of the account pages (design source of truth, 3.3).
// Phone, portrait: the navy bar with the lockup and the language control
// over the tricolour rule, a short band of the school yard photograph, then
// the form on a sheet rising over it. Phone, landscape (a short window): the
// band shrinks to a strip, so the form starts in view. Large screen: a
// tricolour rule along the top; the photograph fills the left half with the
// lockup at the top and a word on the way back in at the bottom; the form
// sits in a card on the right under the light lockup, the language control
// above it. The independence notice closes the column, on every width.
//
// The texts arrive translated (tr) and reach the client forms through
// TextProvider. description "info" keeps the page's explanation in an info
// bubble beside the title (sign in: the form speaks for itself).
export async function AuthShell({
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
  const brand = await loadBrand();
  const side = ASIDES[aside];
  const home = withChoice("/", lang, voice);
  const labels = { language: t(PUBLIC.common.language), voice: t(PUBLIC.common.voice) };

  return (
    <div className="flex min-h-dvh flex-col bg-surface lg:bg-bg">
      {/* Large screens: the tricolour rule along the top of the page. */}
      <FlagStripe className="h-1 shrink-0 max-lg:hidden" />
      {/* Phones: the navy bar with the lockup and the language, the rule
          under it. Not the bg-header utility: the yellow focus ring of the
          navy surfaces would reach the light panel of the language menu. */}
      <div className="shrink-0 lg:hidden" lang={lang}>
        <div className="flex min-h-14 items-center justify-between gap-3 bg-(--header) px-4 pt-[env(safe-area-inset-top)] min-[400px]:px-5 sm:px-8">
          <BrandLockup brand={brand} tone="dark" size="bar" href={home} className="focus-visible:outline-flag-yellow!" />
          <LanguageControls lang={lang} voice={voice} extra={extra} labels={labels} tone="inverse" className={BAR_LANGUAGE} />
        </div>
        <FlagStripe className="h-1" />
      </div>

      <main id="page-content" tabIndex={-1} lang={lang} className="flex flex-1 flex-col outline-none lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(30rem,38rem)]">
        <div className="relative h-32 shrink-0 overflow-hidden bg-sidebar min-[400px]:h-36 sm:h-48 lg:sticky lg:top-0 lg:h-[calc(100dvh-4px)] [@media(max-height:540px)_and_(max-width:1023px)]:h-16">
          <Image
            src={PHOTO_IMAGES[PHOTO.file]}
            alt={t(PHOTO.alt)}
            fill
            priority
            sizes="(min-width: 1024px) 60vw, 100vw"
            className="object-cover object-[30%_45%] lg:object-[8%_50%]"
            placeholder="blur"
          />
          {/* Large screens: the dark lockup over a navy veil at the top, a
              word on the way back in at the bottom. */}
          <div className="absolute inset-x-0 top-0 hidden h-40 bg-linear-to-b from-[rgb(7_39_71/0.85)] to-transparent px-12 pt-8 lg:block">
            <BrandLockup brand={brand} tone="dark" size="auth" href={home} className="focus-visible:outline-flag-yellow!" />
          </div>
          <div className="absolute inset-x-0 bottom-0 hidden bg-linear-to-t from-black/80 via-black/45 to-transparent px-12 pt-40 pb-10 text-white lg:block">
            <p className="max-w-lg font-display text-3xl leading-tight font-bold text-balance xl:text-4xl">{node(side.title)}</p>
            {side.body && <p className="mt-3 max-w-lg leading-relaxed text-white/90">{node(side.body)}</p>}
          </div>
        </div>

        <section className="relative z-10 -mt-4 flex flex-1 flex-col rounded-t-sheet bg-surface px-5 pt-7 pb-[max(1.5rem,env(safe-area-inset-bottom))] shadow-[0_-8px_24px_-12px_rgb(0_0_0/0.25)] min-[400px]:px-6 sm:px-10 lg:mt-0 lg:rounded-none lg:bg-bg lg:px-8 lg:pt-8 lg:shadow-none">
          <div className="hidden justify-end lg:flex">
            <LanguageControls lang={lang} voice={voice} extra={extra} labels={labels} />
          </div>
          <div className="flex flex-1 flex-col lg:justify-center lg:py-8">
            <div className="mx-auto w-full max-w-md lg:max-w-[28rem] lg:rounded-card lg:border lg:border-border lg:bg-surface lg:p-8 lg:shadow-raised">
              <div className="mb-6 hidden lg:block">
                <BrandLockup brand={brand} tone="light" size="auth" href={home} />
              </div>
              <div className="flex items-center gap-3">
                <div className="flex min-w-0 flex-1 items-center gap-1.5">
                  <h1 className="min-w-0 text-[1.5rem] leading-tight font-bold text-text lg:text-[1.75rem]">{node(title)}</h1>
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
          <div className="mx-auto mt-6 flex w-full max-w-md flex-col items-center gap-1 text-center lg:mt-0">
            <IndependenceNotice brand={brand} translation={noticeTranslation(tr)} className="justify-center text-left" />
            <p className="text-xs text-muted">
              {t(PUBLIC.common.photo)} : <span translate="no">{shortCredit(PHOTO)}</span>
              {" · "}
              <Link
                href={withChoice("/credits", lang, voice)}
                className="inline-flex min-h-11 items-center font-semibold text-link underline underline-offset-[3px] hover:text-text"
              >
                {node(PUBLIC.common.credits)}
              </Link>
            </p>
          </div>
        </section>
        <AnalyticsSlot tr={tr} />
      </main>
    </div>
  );
}

// The language button on the navy bar of a phone: the inverse button, square
// cornered, with the yellow focus ring of the navy surfaces.
const BAR_LANGUAGE =
  "[&_[data-language-menu]]:rounded-control [&_[data-language-menu]]:border-white/25 [&_[data-language-menu]]:bg-white/10 [&_[data-language-menu]]:backdrop-blur-none [&_[data-language-menu]:focus-visible]:outline-flag-yellow! [&_[data-language-menu]:hover]:bg-white/20";
