import { ArrowLeft, AudioLines, ExternalLink, Languages } from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { ARMS_RATIO, ARMS_SRC } from "@/components/brand/settings";
import { LANGUAGE_CREDITS, LICENCES, OTHER_CREDITS, PHOTOS, type Licence } from "@/features/public-pages/photos";
import { PHOTO_IMAGES } from "@/features/public-pages/photo-images";
import { PublicFooter, PublicHeader, PublicMain } from "@/features/public-pages/public-frame";
import { publicTranslator } from "@/features/public-pages/server";
import { PUBLIC } from "@/features/public-pages/texts";
import { publicChoice, withChoice, type PublicTranslator } from "@/features/public-pages/translate";

export const metadata: Metadata = {
  title: "Crédits photos",
  description: "Les photographies, la voix de lecture et les armoiries affichées par Classéo, leurs auteurs, leurs sources et leurs licences.",
};

// Photo credits: every photograph of the public pages with its author, its
// source on Wikimedia Commons, its licence and what was changed, then the
// reading voice and the coat of arms of the brand lockup. The list
// comes from features/public-pages/photos.ts, like the captions of the home
// page and public/images/CREDITS.md.
export default async function CreditsPage({ searchParams }: PageProps<"/credits">) {
  const { lang, voice } = publicChoice(await searchParams);
  const tr = await publicTranslator(lang);
  const { t, node } = tr;
  const c = PUBLIC.credits;

  return (
    <>
      <PublicHeader tr={tr} voice={voice} />

      <PublicMain lang={lang}>
        <div className="mx-auto max-w-5xl px-5 py-8 sm:px-6 lg:px-8 lg:py-12">
          <Link
            href={withChoice("/", lang, voice)}
            className="-ml-1 inline-flex min-h-11 items-center gap-1.5 rounded-md px-1 text-sm font-semibold text-muted hover:text-text"
          >
            <ArrowLeft className="size-4" aria-hidden />
            {node(PUBLIC.common.backHome)}
          </Link>
          <h1 className="mt-3 text-[1.5rem] leading-tight font-bold text-balance lg:text-[1.75rem]">{node(c.title)}</h1>
          <div className="mt-4 max-w-3xl space-y-2 text-lg leading-relaxed text-muted">
            <p>{node(c.intro)}</p>
            <p>{node(c.reuse)}</p>
          </div>

          <section aria-labelledby="photos-title" className="mt-10">
            <h2 id="photos-title" className="text-xl font-bold">
              {node(c.photos)}
            </h2>
            <ol className="mt-4 flex flex-col gap-5">
              {PHOTOS.map((p) => (
                <li key={p.file} className="overflow-hidden rounded-card border border-border bg-surface shadow-xs">
                  <article aria-labelledby={`photo-${p.file}`} className="grid gap-0 sm:grid-cols-[15rem_1fr]">
                    <div className="relative aspect-[3/2] bg-surface-2 sm:aspect-auto sm:min-h-full">
                      <Image
                        src={PHOTO_IMAGES[p.file]}
                        alt={t(p.alt)}
                        fill
                        sizes="(min-width: 640px) 15rem, 100vw"
                        className="object-cover"
                        placeholder="blur"
                      />
                    </div>
                    <div className="p-4 sm:p-5">
                      <h3 id={`photo-${p.file}`} className="text-lg leading-snug font-bold text-balance">
                        {node(p.subject)}
                      </h3>
                      <CreditDetails credit={p} sourceLabel={c.sourceLink} tr={tr} />
                    </div>
                  </article>
                </li>
              ))}
            </ol>
          </section>

          <section aria-labelledby="voices-title" className="mt-12">
            <h2 id="voices-title" className="text-xl font-bold">
              {node(c.voices)}
            </h2>
            <ul className="mt-4 flex flex-col gap-5">
              {OTHER_CREDITS.filter((c) => c.kind === "voice").map((v) => (
                <li key={v.id} className="rounded-card border border-border bg-surface p-4 shadow-xs sm:p-5">
                  <article aria-labelledby={`credit-${v.id}`}>
                    <h3 id={`credit-${v.id}`} className="flex items-start gap-2.5 text-lg leading-snug font-bold text-balance">
                      <AudioLines className="mt-1 size-5 shrink-0 text-primary" aria-hidden />
                      {node(v.subject)}
                    </h3>
                    <CreditDetails credit={v} sourceLabel={c.voiceSource} tr={tr} />
                  </article>
                </li>
              ))}
            </ul>
          </section>

          <section aria-labelledby="emblem-title" className="mt-12">
            <h2 id="emblem-title" className="text-xl font-bold">
              {node(c.emblem)}
            </h2>
            <ul className="mt-4 flex flex-col gap-5">
              {OTHER_CREDITS.filter((e) => e.kind === "emblem").map((e) => (
                <li key={e.id} className="rounded-card border border-border bg-surface p-4 shadow-xs sm:p-5">
                  <article aria-labelledby={`credit-${e.id}`} className="grid gap-4 sm:grid-cols-[6rem_1fr]">
                    {/* eslint-disable-next-line @next/next/no-img-element -- the static SVG credited here, shown as is */}
                    <img src={ARMS_SRC} alt="" width={96} height={Math.round(96 / ARMS_RATIO)} className="h-auto w-24" />
                    <div className="min-w-0">
                      <h3 id={`credit-${e.id}`} className="text-lg leading-snug font-bold text-balance">
                        {node(e.subject)}
                      </h3>
                      <CreditDetails credit={e} sourceLabel={c.sourceLink} tr={tr} />
                    </div>
                  </article>
                </li>
              ))}
            </ul>
          </section>

          <section aria-labelledby="languages-title" className="mt-12">
            <h2 id="languages-title" className="text-xl font-bold">
              {node(c.languages)}
            </h2>
            <p className="mt-2 text-muted">{node(c.languagesThanks)}</p>
            <ul className="mt-4 flex flex-col gap-5">
              {LANGUAGE_CREDITS.map((l) => (
                <li key={l.id} className="rounded-card border border-border bg-surface p-4 shadow-xs sm:p-5">
                  <article aria-labelledby={`credit-${l.id}`}>
                    <h3 id={`credit-${l.id}`} className="flex items-start gap-2.5 text-lg leading-snug font-bold text-balance">
                      <Languages className="mt-1 size-5 shrink-0 text-primary" aria-hidden />
                      {node(l.subject)}
                    </h3>
                    <dl className="mt-3 grid gap-x-4 gap-y-2 text-sm sm:grid-cols-[8.5rem_1fr]">
                      <dt className="font-semibold text-muted">{node(c.author)}</dt>
                      <dd translate="no" lang="fr" className="min-w-0">
                        {l.author}
                      </dd>
                      <dt className="font-semibold text-muted">{node(c.source)}</dt>
                      <dd className="min-w-0">
                        <a href={l.sourceUrl} rel="noopener noreferrer" className={LINK}>
                          {node(c.voiceSource)}
                          <ExternalLink className="size-3.5 shrink-0" aria-hidden />
                        </a>
                      </dd>
                    </dl>
                  </article>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </PublicMain>

      <PublicFooter tr={tr} voice={voice} />
    </>
  );
}

type Credit = { author: string; sourceUrl: string; licence: keyof typeof LICENCES; changes: string };

const LINK = "inline-flex min-h-11 items-center gap-1.5 font-semibold text-link underline underline-offset-[3px] sm:min-h-0";

// Author, source, licence and changes of one work, photograph or voice.
function CreditDetails({ credit, sourceLabel, tr }: { credit: Credit; sourceLabel: string; tr: PublicTranslator }) {
  const { node } = tr;
  const c = PUBLIC.credits;
  const licence: Licence = LICENCES[credit.licence];
  return (
    <dl className="mt-3 grid gap-x-4 gap-y-2 text-sm sm:grid-cols-[8.5rem_1fr]">
      <dt className="font-semibold text-muted">{node(c.author)}</dt>
      <dd translate="no" lang="fr" className="min-w-0">
        {credit.author}
      </dd>
      <dt className="font-semibold text-muted">{node(c.source)}</dt>
      <dd className="min-w-0">
        <a href={credit.sourceUrl} rel="noopener noreferrer" className={LINK}>
          {node(sourceLabel)}
          <ExternalLink className="size-3.5 shrink-0" aria-hidden />
        </a>
      </dd>
      <dt className="font-semibold text-muted">{node(c.licence)}</dt>
      <dd className="min-w-0">
        {licence.url ? (
          <a href={licence.url} rel="license noopener noreferrer" className={LINK}>
            <span translate="no">{licence.name}</span>
            <ExternalLink className="size-3.5 shrink-0" aria-hidden />
          </a>
        ) : (
          <>
            {node(c.publicDomain)}. {node(c.publicDomainNote)}
          </>
        )}
      </dd>
      <dt className="font-semibold text-muted">{node(c.changes)}</dt>
      <dd className="min-w-0">{node(credit.changes)}</dd>
    </dl>
  );
}
