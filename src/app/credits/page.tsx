import { ArrowLeft, ExternalLink } from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { LICENCES, PHOTOS } from "@/features/public-pages/photos";
import { PHOTO_IMAGES } from "@/features/public-pages/photo-images";
import { PublicFooter, PublicHeader } from "@/features/public-pages/public-frame";
import { publicTranslator } from "@/features/public-pages/server";
import { PUBLIC } from "@/features/public-pages/texts";
import { publicChoice, withChoice } from "@/features/public-pages/translate";

export const metadata: Metadata = {
  title: "Crédits photos",
  description: "Les photographies des pages publiques de Classéo, leurs auteurs, leurs sources et leurs licences.",
};

// Photo credits: every photograph of the public pages with its author, its
// source on Wikimedia Commons, its licence and what was changed. The list
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

      <main id="page-content" tabIndex={-1} lang={lang} className="bg-bg outline-none">
        <div className="mx-auto max-w-5xl px-4 py-8 sm:px-8 lg:py-12">
          <Link
            href={withChoice("/", lang, voice)}
            className="-ml-1 inline-flex min-h-11 items-center gap-1.5 rounded-md px-1 text-sm font-semibold text-muted hover:text-text"
          >
            <ArrowLeft className="size-4" aria-hidden />
            {node(PUBLIC.common.backHome)}
          </Link>
          <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-balance sm:text-4xl">{node(c.title)}</h1>
          <div className="mt-4 max-w-3xl space-y-2 text-lg leading-relaxed text-muted">
            <p>{node(c.intro)}</p>
            <p>{node(c.reuse)}</p>
          </div>

          <ol className="mt-10 flex flex-col gap-5">
            {PHOTOS.map((p) => {
              const licence = LICENCES[p.licence];
              return (
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
                      <h2 id={`photo-${p.file}`} className="text-lg leading-snug font-bold text-balance">
                        {node(p.subject)}
                      </h2>
                      <dl className="mt-3 grid gap-x-4 gap-y-2 text-sm sm:grid-cols-[8.5rem_1fr]">
                        <dt className="font-semibold text-muted">{node(c.author)}</dt>
                        <dd translate="no" className="min-w-0">
                          {p.author}
                        </dd>
                        <dt className="font-semibold text-muted">{node(c.source)}</dt>
                        <dd className="min-w-0">
                          <a
                            href={p.sourceUrl}
                            rel="noopener noreferrer"
                            className="inline-flex min-h-11 items-center gap-1.5 font-semibold text-primary underline underline-offset-4 sm:min-h-0"
                          >
                            {node(c.sourceLink)}
                            <ExternalLink className="size-3.5 shrink-0" aria-hidden />
                          </a>
                        </dd>
                        <dt className="font-semibold text-muted">{node(c.licence)}</dt>
                        <dd className="min-w-0">
                          {licence.url ? (
                            <a
                              href={licence.url}
                              rel="license noopener noreferrer"
                              className="inline-flex min-h-11 items-center gap-1.5 font-semibold text-primary underline underline-offset-4 sm:min-h-0"
                            >
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
                        <dd className="min-w-0">{node(p.changes)}</dd>
                      </dl>
                    </div>
                  </article>
                </li>
              );
            })}
          </ol>
        </div>
      </main>

      <PublicFooter tr={tr} voice={voice} />
    </>
  );
}
