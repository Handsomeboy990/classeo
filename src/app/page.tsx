import { ArrowRight } from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { BeninFlag } from "@/components/brand/flag";
import { InfoTip } from "@/components/kit/info-tip";
import { ReadAloud } from "@/components/kit/read-aloud";
import { photo, shortCredit, type PhotoFile } from "@/features/public-pages/photos";
import { PHOTO_IMAGES } from "@/features/public-pages/photo-images";
import { PublicFooter, PublicHeader } from "@/features/public-pages/public-frame";
import { publicTranslator } from "@/features/public-pages/server";
import { listenText, PUBLIC, PUBLIC_SPEECH } from "@/features/public-pages/texts";
import { publicChoice, withChoice } from "@/features/public-pages/translate";

export const metadata: Metadata = {
  title: { absolute: "Classéo · Le système éducatif, à portée de main" },
  description:
    "Classéo, la plateforme de gestion scolaire pour le Bénin : inscriptions, notes, bulletins, présences, frais et messages, pour l'équipe de l'établissement, les enseignants et les familles.",
};

// Captions are fragments: a full stop added by the translation is dropped.
const fragment = (text: string) => text.replace(/[.\s]+$/u, "");

const HERO: PhotoFile = "classe-lecture.webp";
const BAND: PhotoFile[] = ["chemin-de-l-ecole.webp", "lecture-a-plusieurs.webp", "cour-de-recreation.webp"];

// Public home page. Calm and institutional: one sentence of purpose, the way
// in, real photographs of Beninese schools, and a word on accessibility. The
// features are for the presentation, not for this page. Shown in French,
// Fongbe or Yoruba (?lang=), rendered here from the prepared translations;
// the voice reads the French source in the language chosen (?voix=).
export default async function LandingPage({ searchParams }: PageProps<"/">) {
  const { lang, voice } = publicChoice(await searchParams);
  const tr = await publicTranslator(lang);
  const { t, node } = tr;
  const hero = photo(HERO);

  return (
    <>
      <PublicHeader tr={tr} voice={voice} />

      <main id="page-content" tabIndex={-1} lang={lang} className="outline-none">
        <section aria-labelledby="hero-title" className="bg-surface">
          <div className="mx-auto grid max-w-7xl gap-8 px-4 pt-6 pb-12 sm:px-8 sm:pt-8 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:items-center lg:gap-14 lg:pt-14 lg:pb-20">
            <div className="order-2 lg:order-1">
              <p className="flex items-center gap-2.5 text-sm font-semibold text-muted" lang="fr" translate="no">
                <BeninFlag className="h-4" />
                République du Bénin
              </p>
              <h1
                id="hero-title"
                className="mt-4 text-[min(2.25rem,10.5vw)] leading-[1.06] font-extrabold tracking-tight text-balance hyphens-none sm:text-5xl lg:text-[3.5rem]"
              >
                {node(PUBLIC.landing.title)}
              </h1>
              <p className="mt-5 max-w-xl text-lg leading-relaxed text-muted">{node(PUBLIC.landing.purpose)}</p>
              <div className="mt-8 flex items-center gap-3">
                <Link
                  href={withChoice("/connexion", lang, voice)}
                  className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-control bg-primary px-6 text-base font-bold text-on-primary shadow-xs hover:bg-primary-hover sm:flex-none"
                >
                  {t(PUBLIC.landing.enter)}
                  <ArrowRight className="size-5" aria-hidden />
                </Link>
                <ReadAloud
                  text={PUBLIC_SPEECH.landing}
                  lang={voice}
                  label={t(listenText(voice))}
                  translatable={false}
                  className="size-12"
                />
              </div>
            </div>
            <figure className="order-1 lg:order-2">
              <div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-surface-2 sm:aspect-[16/10] lg:aspect-[4/5]">
                <Image
                  src={PHOTO_IMAGES[HERO]}
                  alt={t(hero.alt)}
                  fill
                  priority
                  sizes="(min-width: 1024px) 40rem, 100vw"
                  className="object-cover object-[50%_35%]"
                  placeholder="blur"
                />
              </div>
              <figcaption className="mt-2 text-xs text-muted">
                {fragment(t(hero.caption))}. {t(PUBLIC.common.photo)} : <span translate="no">{shortCredit(hero)}</span>.
              </figcaption>
            </figure>
          </div>
        </section>

        {/* Who it serves, in one line. */}
        <section className="border-y border-border bg-bg">
          <p className="mx-auto max-w-7xl px-4 py-5 text-center text-[0.9375rem] leading-relaxed text-balance text-muted sm:px-8">{node(PUBLIC.landing.audience)}</p>
        </section>

        <section aria-labelledby="band-title" className="bg-bg">
          <div className="mx-auto max-w-7xl px-4 py-12 sm:px-8 lg:py-16">
            <h2 id="band-title" className="sr-only">
              {node(PUBLIC.landing.bandTitle)}
            </h2>
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {BAND.map((file, i) => {
                const p = photo(file);
                return (
                  <li key={file} className={i === 0 ? "sm:col-span-2 lg:col-span-1" : undefined}>
                    <figure>
                      <div className="relative aspect-[3/2] overflow-hidden rounded-xl bg-surface-2">
                        <Image
                          src={PHOTO_IMAGES[file]}
                          alt={t(p.alt)}
                          fill
                          sizes="(min-width: 1024px) 26rem, (min-width: 640px) 50vw, 100vw"
                          className="object-cover"
                          placeholder="blur"
                          data-decorative
                        />
                      </div>
                      <figcaption className="mt-2 flex flex-wrap items-baseline justify-between gap-x-3 text-sm">
                        <span className="font-semibold text-text">
                          {fragment(t(p.caption))}
                          {p.place && (
                            <span translate="no">
                              , {p.place}
                            </span>
                          )}
                        </span>
                        <span className="text-xs text-muted">
                          {t(PUBLIC.common.photo)} : <span translate="no">{shortCredit(p)}</span>
                        </span>
                      </figcaption>
                    </figure>
                  </li>
                );
              })}
            </ul>
          </div>
        </section>

        <section aria-labelledby="a11y-title" className="border-t border-border bg-surface">
          <div className="mx-auto grid max-w-7xl gap-4 px-4 py-12 sm:px-8 md:grid-cols-[16rem_1fr] md:gap-10 lg:py-16">
            <div className="flex items-start gap-1.5">
              <h2 id="a11y-title" className="text-2xl font-extrabold text-balance">
                {node(PUBLIC.landing.a11yTitle)}
              </h2>
              <InfoTip label={t(PUBLIC.common.moreInfo)} className="mt-1.5">
                {node(PUBLIC.landing.a11yBody)}
              </InfoTip>
            </div>
            <p className="max-w-3xl text-lg leading-relaxed text-muted">
              {node(PUBLIC.landing.a11yVoice)} {node(PUBLIC.landing.a11ySettings)}
            </p>
          </div>
        </section>
      </main>

      <PublicFooter tr={tr} voice={voice} />
    </>
  );
}
