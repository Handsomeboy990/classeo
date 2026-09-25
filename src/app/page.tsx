import { ArrowRight } from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { BeninFlag } from "@/components/brand/flag";
import { Logo } from "@/components/brand/logo";
import { ReadAloud } from "@/components/kit/read-aloud";

import chemin from "../../public/images/chemin-de-l-ecole.webp";
import classe from "../../public/images/classe-lecture.webp";
import cour from "../../public/images/cour-de-recreation.webp";
import lecture from "../../public/images/lecture-a-plusieurs.webp";

export const metadata: Metadata = {
  title: { absolute: "Classéo, l'école béninoise du ministère à la maison" },
  description:
    "Plateforme nationale de l'éducation au Bénin : le ministère, les directions départementales, les écoles, les enseignants, les parents et les élèves travaillent sur les mêmes données.",
};

const PURPOSE =
  "Classéo réunit le ministère, les directions départementales, les écoles et les familles autour des mêmes informations sur chaque élève, pour que chacun voie ce qui le concerne, au bon moment.";

const BAND = [
  { src: chemin, alt: "Trois élèves en uniforme marchent vers l'école avec une femme, dans une rue de ville.", caption: "Sur le chemin de l'école", credit: "DEGAN Gabin, CC BY-SA 4.0" },
  { src: lecture, alt: "Des élèves allongés sur un carrelage lisent ensemble des livres illustrés.", caption: "Lire à plusieurs, Grand-Popo", credit: "Kulttuurinavigaattori, CC BY-SA 4.0" },
  { src: cour, alt: "Une cour d'école en sable, des élèves en uniforme kaki ; au premier plan, une petite fille avec son cartable salue.", caption: "Cour de l'EPP Savi, Godomey", credit: "Rofik Adam, CC BY-SA 4.0" },
];

// Public home page. Calm and institutional: one sentence of purpose, the way
// in, real photographs of Beninese schools, and a word on accessibility. The
// features are for the presentation, not for this page.
export default function LandingPage() {
  return (
    <>
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-5 py-3 sm:px-8">
          <Link href="/" aria-label="Classéo, accueil" className="min-w-0 rounded-lg">
            <Logo />
          </Link>
          <Link
            href="/connexion"
            className="ml-auto inline-flex min-h-11 items-center gap-2 rounded-control bg-primary px-4 text-sm font-bold whitespace-nowrap text-on-primary hover:bg-primary-hover"
          >
            Se connecter
          </Link>
        </div>
      </header>

      <main id="page-content" tabIndex={-1} className="outline-none">
        <section aria-labelledby="hero-title" className="bg-surface">
          <div className="mx-auto grid max-w-7xl gap-8 px-5 pt-8 pb-12 sm:px-8 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:items-center lg:gap-14 lg:pt-14 lg:pb-20">
            <div className="order-2 lg:order-1">
              <p className="flex items-center gap-2.5 text-sm font-semibold text-muted">
                <BeninFlag className="h-4" />
                République du Bénin
              </p>
              <h1
                id="hero-title"
                className="mt-4 text-[min(2.25rem,10.5vw)] leading-[1.06] font-extrabold tracking-tight text-balance hyphens-auto sm:text-5xl lg:text-[3.5rem]"
              >
                L&apos;école béninoise, du ministère à la maison.
              </h1>
              <p className="mt-5 max-w-xl text-lg leading-relaxed text-muted">{PURPOSE}</p>
              <div className="mt-8 flex flex-col gap-3 min-[420px]:flex-row min-[420px]:flex-wrap min-[420px]:items-center">
                <Link
                  href="/connexion"
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-control bg-primary px-6 text-base font-bold text-on-primary shadow-xs hover:bg-primary-hover"
                >
                  Accéder à mon espace
                  <ArrowRight className="size-5" aria-hidden />
                </Link>
                <ReadAloud text={`L'école béninoise, du ministère à la maison. ${PURPOSE}`} label="Écouter" className="min-h-12 justify-center px-5 text-base" />
              </div>
            </div>
            <figure className="order-1 lg:order-2">
              <div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-surface-2 sm:aspect-[16/10] lg:aspect-[4/5]">
                <Image
                  src={classe}
                  alt="Une classe de lecture au Bénin : au tableau, « ada va à l'école » écrit à la craie, des élèves assis sur des bancs de bois."
                  fill
                  priority
                  sizes="(min-width: 1024px) 40rem, 100vw"
                  className="object-cover object-[50%_35%]"
                  placeholder="blur"
                />
              </div>
              <figcaption className="mt-2 text-xs text-muted">Leçon de lecture dans une école béninoise. Photo : Thomas Dorn, Commission européenne, CC BY 4.0.</figcaption>
            </figure>
          </div>
        </section>

        {/* The ministry context and who it serves, in one line. */}
        <section aria-label="Pour qui" className="border-y border-border bg-bg">
          <p className="mx-auto max-w-7xl px-5 py-5 text-center text-[0.9375rem] leading-relaxed text-balance text-muted sm:px-8">
            Pour le ministère, les directions départementales, les circonscriptions scolaires, les écoles, les enseignants et les familles
            <span className="text-text"> · prototype présenté au défi EduTech Bénin 2026</span>
          </p>
        </section>

        <section aria-labelledby="band-title" className="bg-bg">
          <div className="mx-auto max-w-7xl px-5 py-12 sm:px-8 lg:py-16">
            <h2 id="band-title" className="sr-only">
              L&apos;école au Bénin, en images
            </h2>
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {BAND.map((p, i) => (
                <li key={p.caption} className={i === 0 ? "sm:col-span-2 lg:col-span-1" : undefined}>
                  <figure>
                    <div className="relative aspect-[3/2] overflow-hidden rounded-xl bg-surface-2">
                      <Image src={p.src} alt={p.alt} fill sizes="(min-width: 1024px) 26rem, (min-width: 640px) 50vw, 100vw" className="object-cover" placeholder="blur" data-decorative />
                    </div>
                    <figcaption className="mt-2 flex flex-wrap items-baseline justify-between gap-x-3 text-sm">
                      <span className="font-semibold text-text">{p.caption}</span>
                      <span className="text-xs text-muted">Photo : {p.credit}</span>
                    </figcaption>
                  </figure>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section aria-labelledby="a11y-title" className="border-t border-border bg-surface">
          <div className="mx-auto grid max-w-7xl gap-4 px-5 py-12 sm:px-8 md:grid-cols-[16rem_1fr] md:gap-10 lg:py-16">
            <h2 id="a11y-title" className="text-2xl font-extrabold text-balance">
              Accessible à tous
            </h2>
            <p className="max-w-3xl text-lg leading-relaxed text-muted">
              Chaque écran peut être lu à voix haute. Le texte s&apos;agrandit, le contraste se renforce et tout se fait au clavier, avec un lecteur d&apos;écran ou sur un
              petit téléphone. Les pages déjà ouvertes restent lisibles sans réseau. Les réglages se trouvent sous le bouton rond, en bas à droite de chaque écran.
            </p>
          </div>
        </section>
      </main>

      <footer className="border-t border-border bg-bg">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 px-5 py-8 sm:px-8 md:flex-row md:items-center md:justify-between">
          <div>
            <Logo />
            <p className="mt-2 text-sm text-muted">Plateforme nationale de l&apos;éducation, prototype présenté au défi EduTech Bénin, 2026.</p>
          </div>
          <nav aria-label="Liens du pied de page">
            <ul className="flex flex-wrap gap-x-5 gap-y-1 text-sm font-semibold">
              <li>
                <Link href="/connexion" className="inline-flex min-h-11 items-center hover:underline">
                  Se connecter
                </Link>
              </li>
              <li>
                <Link href="/hors-ligne" className="inline-flex min-h-11 items-center hover:underline">
                  Utiliser Classéo hors ligne
                </Link>
              </li>
              <li>
                <a href="/images/CREDITS.md" className="inline-flex min-h-11 items-center hover:underline">
                  Crédits photos
                </a>
              </li>
            </ul>
          </nav>
        </div>
      </footer>
    </>
  );
}
