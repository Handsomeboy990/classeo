import {
  ArrowRight,
  BadgeCheck,
  Building2,
  ChartColumn,
  ChevronRight,
  ClipboardCheck,
  KeyRound,
  Languages,
  MonitorSmartphone,
  UsersRound,
  Volume2,
  type LucideIcon,
} from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

import { FlagStripe } from "@/components/brand/flag";
import { ReadAloud } from "@/components/kit/read-aloud";
import { AccessibilityLink } from "@/features/public-pages/footer-controls";
import { photo, shortCredit, type PhotoFile } from "@/features/public-pages/photos";
import { PHOTO_IMAGES } from "@/features/public-pages/photo-images";
import { PublicFooter, PublicHeader, PublicMain } from "@/features/public-pages/public-frame";
import { publicTranslator } from "@/features/public-pages/server";
import { listenText, PUBLIC, PUBLIC_SPEECH } from "@/features/public-pages/texts";
import { publicChoice, withChoice, type PublicTranslator } from "@/features/public-pages/translate";

export const metadata: Metadata = {
  title: { absolute: "Classéo · Le système éducatif, à portée de main" },
  description:
    "Classéo, la plateforme de gestion scolaire pour le Bénin : inscriptions, notes, bulletins, présences, frais et messages, pour l'équipe de l'établissement, les enseignants et les familles.",
};

// Captions are fragments: a full stop added by the translation is dropped.
const fragment = (text: string) => text.replace(/[.\s]+$/u, "");

const HERO: PhotoFile = "classe-lecture.webp";
const BAND: PhotoFile[] = ["chemin-de-l-ecole.webp", "lecture-a-plusieurs.webp", "cour-de-recreation.webp"];

const L = PUBLIC.landing;

// The services, one tile per audience, as on the e-services portals: all
// behind the sign in, except the document check and the lost password.
const SERVICES: {
  icon: LucideIcon;
  title: string;
  body: string;
  href: "/connexion" | "/verifier" | "/mot-de-passe-oublie";
}[] = [
  {
    icon: Building2,
    title: L.schoolTitle,
    body: L.schoolBody,
    href: "/connexion",
  },
  {
    icon: ClipboardCheck,
    title: L.teacherTitle,
    body: L.teacherBody,
    href: "/connexion",
  },
  {
    icon: UsersRound,
    title: L.familyTitle,
    body: L.familyBody,
    href: "/connexion",
  },
  {
    icon: ChartColumn,
    title: L.territoryTitle,
    body: L.territoryBody,
    href: "/connexion",
  },
  {
    icon: BadgeCheck,
    title: PUBLIC.common.verify,
    body: L.verifyBody,
    href: "/verifier",
  },
  {
    icon: KeyRound,
    title: L.accountTitle,
    body: L.accountBody,
    href: "/mot-de-passe-oublie",
  },
];

// Public home page, in the official grammar of the e-services portals: the
// slogan and the way in, the services for each audience, real photographs
// of Beninese schools, then accessibility and languages. Shown in French,
// Fongbe or Yoruba (?lang=), rendered here from the prepared translations;
// the voice reads the French source in the language chosen (?voix=).
export default async function LandingPage({ searchParams }: PageProps<"/">) {
  const { lang, voice } = publicChoice(await searchParams);
  const tr = await publicTranslator(lang);
  const { t, node } = tr;
  const hero = photo(HERO);

  return (
    <>
      <PublicHeader tr={tr} voice={voice} current="home" />

      <PublicMain lang={lang}>
        <section aria-labelledby="hero-title" className="border-b border-border bg-surface">
          <div className="mx-auto grid max-w-[80rem] gap-8 px-5 py-8 sm:px-6 sm:py-10 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:items-center lg:gap-14 lg:px-8 lg:py-16">
            <div>
              <p className="font-display text-[0.6875rem] leading-tight font-bold tracking-[0.08em] text-primary uppercase">{node(L.kicker)}</p>
              <FlagStripe className="mt-3 h-1 w-16" />
              <h1
                id="hero-title"
                className="mt-4 max-w-[20em] text-[1.75rem] leading-[1.2] font-extrabold tracking-[-0.01em] text-balance text-text hyphens-none lg:text-[2.25rem] lg:leading-[1.15]"
              >
                {node(L.title)}
              </h1>
              <p className="mt-4 max-w-xl text-base leading-relaxed text-muted sm:text-lg">{node(L.purpose)}</p>
              <div className="mt-7 grid grid-cols-[minmax(0,1fr)_auto] gap-3 sm:flex sm:flex-wrap sm:items-center">
                <Link
                  href={withChoice("/connexion", lang, voice)}
                  className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-control bg-primary px-6 font-display text-base font-semibold text-on-primary hover:bg-primary-hover max-sm:col-span-2"
                >
                  {t(L.enter)}
                  <ArrowRight className="size-5" aria-hidden />
                </Link>
                <Link
                  href="/verifier"
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-control border border-primary/40 bg-surface px-5 font-display text-base font-semibold text-primary hover:border-primary hover:bg-primary-soft"
                >
                  <BadgeCheck className="size-5" aria-hidden />
                  {node(PUBLIC.common.verify)}
                </Link>
                <ReadAloud text={PUBLIC_SPEECH.landing} lang={voice} label={t(listenText(voice))} translatable={false} className="size-12" />
              </div>
            </div>
            <figure>
              <div className="relative aspect-[16/10] overflow-hidden rounded-card bg-surface-2 lg:aspect-[4/3]">
                <Image
                  src={PHOTO_IMAGES[HERO]}
                  alt={t(hero.alt)}
                  fill
                  priority
                  sizes="(min-width: 1280px) 34rem, (min-width: 1024px) 42vw, 100vw"
                  className="object-cover object-[50%_35%]"
                  placeholder="blur"
                />
              </div>
              {/* Phones: the caption stops short of the floating
                  accessibility button, which sits over its end on the first
                  screen. */}
              <figcaption className="mt-2 text-xs text-muted max-lg:pr-[calc(var(--fab-size)+0.5rem)]">
                {fragment(t(hero.caption))}. {t(PUBLIC.common.photo)} : <span translate="no">{shortCredit(hero)}</span>.
              </figcaption>
            </figure>
          </div>
        </section>

        <section aria-labelledby="services-title">
          <div className="mx-auto max-w-[80rem] px-5 py-12 sm:px-6 lg:px-8 lg:py-16">
            <SectionTitle id="services-title">{node(L.servicesTitle)}</SectionTitle>
            <p className="mt-3 max-w-3xl leading-relaxed text-muted">{node(L.audience)}</p>
            <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:gap-6">
              {SERVICES.map((s) => (
                <ServiceTile key={s.title} icon={s.icon} title={s.title} body={s.body} href={s.href === "/verifier" ? s.href : withChoice(s.href, lang, voice)} tr={tr} />
              ))}
            </ul>
          </div>
        </section>

        <section aria-labelledby="band-title" className="border-y border-border bg-surface">
          <div className="mx-auto max-w-[80rem] px-5 py-12 sm:px-6 lg:px-8 lg:py-16">
            <SectionTitle id="band-title">{node(L.bandTitle)}</SectionTitle>
            <ul className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {BAND.map((file, i) => {
                const p = photo(file);
                return (
                  <li key={file} className={i === 0 ? "sm:col-span-2 lg:col-span-1" : undefined}>
                    <figure>
                      <div className="relative aspect-[3/2] overflow-hidden rounded-card bg-surface-2">
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
                      <figcaption className="mt-2 flex flex-col gap-0.5 text-sm">
                        <span className="font-semibold text-text">
                          {fragment(t(p.caption))}
                          {p.place && <span translate="no">, {p.place}</span>}
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

        <section aria-labelledby="a11y-title">
          <div className="mx-auto max-w-[80rem] px-5 py-12 sm:px-6 lg:px-8 lg:py-16">
            <SectionTitle id="a11y-title">{node(L.a11yTitle)}</SectionTitle>
            <ul className="mt-8 grid gap-4 md:grid-cols-3 lg:gap-6">
              <Feature icon={Volume2} title={node(L.voiceTitle)}>
                {node(L.a11yVoice)}
              </Feature>
              <Feature icon={MonitorSmartphone} title={node(L.displayTitle)}>
                {node(L.a11yBody)}
              </Feature>
              <Feature icon={Languages} title={node(L.languagesTitle)}>
                {node(L.languagesBody)}
              </Feature>
            </ul>
            <div className="mt-6 flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:gap-4">
              <p className="text-muted">{node(L.a11ySettings)}</p>
              <AccessibilityLink className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-control border border-primary/40 bg-surface px-4 font-display text-sm font-semibold text-primary hover:border-primary hover:bg-primary-soft">
                {node(L.openSettings)}
              </AccessibilityLink>
            </div>
          </div>
        </section>
      </PublicMain>

      <PublicFooter tr={tr} voice={voice} />
    </>
  );
}

// A section title with the short tricolour rule of the official sites.
function SectionTitle({ id, children }: { id: string; children: ReactNode }) {
  return (
    <div>
      <h2 id={id} className="text-[1.375rem] leading-tight font-bold text-balance text-text lg:text-[1.625rem]">
        {children}
      </h2>
      <FlagStripe className="mt-3 h-1 w-12" />
    </div>
  );
}

// Service tile (design source of truth, 4.4): one navy tint for every
// pastille. The title is the link; the whole tile answers the pointer.
function ServiceTile({ icon: Icon, title, body, href, tr }: { icon: LucideIcon; title: string; body: string; href: string; tr: PublicTranslator }) {
  const { node } = tr;
  return (
    // min-w-0 and the breaks: with a very large text on a phone, a long word
    // wraps instead of widening the tile, then the page.
    <li className="relative flex min-w-0 gap-4 rounded-card border border-border bg-surface p-5 break-words hyphens-auto shadow-xs transition-[border-color,box-shadow] hover:border-primary/40 hover:shadow-sm has-[a:focus-visible]:outline-3 has-[a:focus-visible]:outline-offset-2 has-[a:focus-visible]:outline-focus lg:p-6">
      <span className="flex size-14 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary">
        <Icon className="size-6" aria-hidden />
      </span>
      <div className="flex min-w-0 flex-col">
        <h3 className="text-base leading-snug font-bold text-text">
          <Link href={href} className="outline-none! after:absolute after:inset-0 after:rounded-card">
            {node(title)}
          </Link>
        </h3>
        <p className="mt-1.5 text-sm leading-relaxed text-muted">{node(body)}</p>
        <span aria-hidden className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-link">
          {node(PUBLIC.landing.access)}
          <ChevronRight className="size-4" />
        </span>
      </div>
    </li>
  );
}

function Feature({ icon: Icon, title, children }: { icon: LucideIcon; title: ReactNode; children: ReactNode }) {
  return (
    <li className="flex min-w-0 gap-4 rounded-card border border-border bg-surface p-5 break-words hyphens-auto shadow-xs lg:p-6">
      <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary">
        <Icon className="size-6" aria-hidden />
      </span>
      <div className="min-w-0">
        <h3 className="text-base leading-snug font-bold text-text">{title}</h3>
        <p className="mt-1.5 text-sm leading-relaxed text-muted">{children}</p>
      </div>
    </li>
  );
}
