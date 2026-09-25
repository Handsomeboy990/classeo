import {
  ArrowRight,
  Backpack,
  Captions,
  Contrast,
  HandHeart,
  Handshake,
  Keyboard,
  Landmark,
  LogIn,
  Map as MapIcon,
  MapPin,
  Presentation,
  School,
  Shapes,
  Volume2,
  WifiOff,
  Zap,
  type LucideIcon,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";

import { Logo } from "@/components/brand/logo";
import { ReadAloud } from "@/components/kit/read-aloud";
import { AccessibilityButton } from "@/components/shell/accessibility-button";
import { cached, tags } from "@/lib/cache";
import { db } from "@/lib/db";
import { cn, formatNumber } from "@/lib/utils";

export const metadata: Metadata = {
  title: { absolute: "Classéo, l'école béninoise du ministère à la maison" },
  description:
    "Plateforme nationale inclusive de l'éducation au Bénin : ministère, directions départementales, circonscriptions, écoles, enseignants, parents et élèves sur un seul système. Lecture à voix haute, pictogrammes, hors ligne.",
};

// ---------------------------------------------------------------------------
// Live national figures: aggregated counts only, cached for every visitor.
// ---------------------------------------------------------------------------

const nationalFigures = cached(
  async () => {
    const year = await db.academicYear.findFirst({ where: { isActive: true }, select: { id: true, label: true } });
    const [schools, students, teachers, departments, communes] = await Promise.all([
      db.school.count({ where: { isActive: true } }),
      year ? db.enrollment.count({ where: { academicYearId: year.id, status: "ACTIVE" } }) : 0,
      db.teacher.count({ where: { isActive: true } }),
      db.department.count(),
      db.commune.count(),
    ]);
    return { year: year?.label ?? null, schools, students, teachers, departments, communes };
  },
  ["landing-national-figures"],
  { tags: [tags.stats], revalidate: 300 },
);

async function Figures() {
  await connection();
  let figures: Awaited<ReturnType<typeof nationalFigures>> | null = null;
  try {
    figures = await nationalFigures();
  } catch {
    figures = null;
  }
  if (!figures) {
    return <p className="text-sidebar-muted">Les chiffres sont momentanément indisponibles. Réessayez dans quelques minutes.</p>;
  }
  const items = [
    { label: "établissements", value: figures.schools },
    { label: `élèves inscrits${figures.year ? ` en ${figures.year}` : ""}`, value: figures.students },
    { label: "enseignants", value: figures.teachers },
    { label: "départements", value: figures.departments },
    { label: "communes", value: figures.communes },
  ];
  return (
    <>
      <dl className="grid grid-cols-1 gap-x-8 gap-y-8 min-[420px]:grid-cols-2 lg:grid-cols-5">
        {items.map((i) => (
          <div key={i.label} className="border-t-2 border-accent/60 pt-4">
            <dd className="font-display text-4xl leading-none font-extrabold text-accent tabular-nums sm:text-5xl">{formatNumber(i.value)}</dd>
            <dt className="mt-2 text-sidebar-text">{i.label}</dt>
          </div>
        ))}
      </dl>
      <ReadAloud
        className="mt-8 border-sidebar-muted bg-transparent text-sidebar-text hover:bg-sidebar-hover"
        label="Écouter les chiffres"
        text={`Classéo en chiffres : ${items.map((i) => `${formatNumber(i.value)} ${i.label}`).join(", ")}.`}
      />
    </>
  );
}

function FiguresSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-8 min-[420px]:grid-cols-2 lg:grid-cols-5" role="status" aria-label="Chargement des chiffres">
      {Array.from({ length: 5 }, (_, i) => (
        <div key={i} className="border-t-2 border-accent/30 pt-4">
          <div className="h-10 w-28 rounded-md bg-sidebar-hover" />
          <div className="mt-3 h-4 w-24 rounded-md bg-sidebar-hover" />
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Content
// ---------------------------------------------------------------------------

type Actor = { icon: LucideIcon; name: string; promise: string; does: string[] };

const STEERING: Actor[] = [
  {
    icon: Landmark,
    name: "Ministère",
    promise: "Pilote l'éducation nationale avec des chiffres consolidés, du pays jusqu'à l'école.",
    does: ["Tableaux de bord nationaux", "Rôles et droits", "Annonces à tout le pays"],
  },
  {
    icon: MapIcon,
    name: "Directions départementales",
    promise: "Suivent les douze départements, comparent leurs communes et arbitrent les demandes.",
    does: ["Statistiques du département", "Demandes des écoles"],
  },
  {
    icon: MapPin,
    name: "Circonscriptions scolaires",
    promise: "Accompagnent les écoles de leur commune au plus près du terrain.",
    does: ["Suivi école par école", "Présences et résultats"],
  },
];

const FIELD: Actor[] = [
  {
    icon: School,
    name: "Écoles",
    promise: "Inscriptions, classes, bulletins, frais et emploi du temps au même endroit.",
    does: ["Bulletins publiés en un clic", "Frais et échéanciers"],
  },
  {
    icon: Presentation,
    name: "Enseignants",
    promise: "Font l'appel, saisissent les notes et partagent leurs cours, même depuis un téléphone.",
    does: ["Notes et moyennes calculées", "Ressources avec transcription"],
  },
  {
    icon: HandHeart,
    name: "Parents",
    promise: "Suivent chaque enfant en écoutant l'essentiel, même sans savoir lire.",
    does: ["Résumé parlé", "Absences signalées le jour même"],
  },
  {
    icon: Backpack,
    name: "Élèves",
    promise: "Retrouvent leurs notes, leur journée de cours et les ressources de leur classe.",
    does: ["Emploi du temps du jour", "Fiches de révision"],
  },
];

const PARTNERS: Actor = {
  icon: Handshake,
  name: "Partenaires",
  promise: "ONG, partenaires techniques et financiers consultent des statistiques agrégées, jamais de données personnelles.",
  does: ["Lecture seule", "Données anonymes"],
};

const COMMITMENTS: { icon: LucideIcon; title: string; text: string }[] = [
  { icon: Shapes, title: "Pictogrammes et peu de mots", text: "Chaque information a son image, sa couleur et son mot. Jamais la couleur seule." },
  { icon: Contrast, title: "Contraste élevé et grand texte", text: "Un réglage suffit : contraste renforcé, texte agrandi jusqu'à 150 %, thème sombre." },
  { icon: Captions, title: "Transcriptions pour tous", text: "Toute vidéo ou tout audio publié est accompagné de son texte. Les alertes sont écrites." },
  { icon: WifiOff, title: "Fonctionne hors ligne", text: "Les pages déjà ouvertes restent lisibles sans réseau : bulletins, notes, emploi du temps." },
  { icon: Zap, title: "Pages légères", text: "Pas d'image lourde, pas de vidéo automatique. Pensé pour la 3G et les petits forfaits." },
  { icon: Keyboard, title: "Utilisable au clavier", text: "Tout se fait sans souris, avec un repère visible à chaque étape et des lecteurs d'écran." },
];

const PITCH =
  "Classéo relie le ministère, les directions départementales, les circonscriptions, les écoles, les enseignants, les parents et les élèves du Bénin sur un seul système. Chaque écran peut être lu à voix haute par Kora, fonctionne hors ligne et s'adapte aux personnes qui voient mal, qui entendent mal ou qui lisent peu.";

const KORA_SAMPLE = "Sènami, classe de 3e A. Dernier bulletin : 13,25 sur 20, assez bien. Une absence cette semaine. Aujourd'hui, le premier cours est mathématiques, à 7 heures.";

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function LandingPage() {
  return (
    <>
      <header className="bg-sidebar text-sidebar-text">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-5 py-4 sm:px-8">
          <Link href="/" aria-label="Classéo, accueil" className="rounded-lg">
            <Logo tone="inverse" />
          </Link>
          <nav aria-label="Sections de la page" className="ml-6 hidden md:block">
            <ul className="flex gap-1 text-sm font-semibold">
              {[
                ["#acteurs", "Acteurs"],
                ["#inclusion", "Inclusion"],
                ["#chiffres", "Chiffres"],
              ].map(([href, label]) => (
                <li key={href}>
                  <a href={href} className="inline-flex min-h-11 items-center rounded-lg px-3 hover:bg-sidebar-hover">
                    {label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <AccessibilityButton />
            <Link
              href="/connexion"
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-accent px-4 text-sm font-bold text-on-accent hover:brightness-95"
            >
              <LogIn className="size-4" aria-hidden />
              <span>Se connecter</span>
            </Link>
          </div>
        </div>
      </header>

      <main id="page-content" tabIndex={-1} className="outline-none">
        {/* Hero ---------------------------------------------------------- */}
        <section aria-labelledby="hero-title" className="relative isolate overflow-hidden bg-sidebar text-sidebar-text">
          <SunriseMotif className="pointer-events-none absolute -right-24 bottom-3 -z-10 w-[32rem] opacity-25 sm:-right-10 sm:opacity-40 lg:right-0 lg:w-[44rem] lg:opacity-100" />
          <div className="mx-auto max-w-7xl px-5 pt-10 pb-20 sm:px-8 sm:pt-16 lg:pt-24 lg:pb-32">
            <p className="text-sm font-bold tracking-[0.14em] text-accent uppercase">République du Bénin · Plateforme nationale de l&apos;éducation</p>
            <h1 id="hero-title" className="mt-5 max-w-3xl break-words hyphens-auto text-[2.6rem] leading-[1.02] font-extrabold tracking-tight sm:text-6xl lg:text-7xl">
              L&apos;école béninoise, du ministère <span className="text-accent">à la maison.</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg text-sidebar-muted sm:text-xl">
              Un seul système pour ceux qui pilotent, ceux qui enseignent et ceux qui apprennent. Écouté, compris et utilisé par tous, même sans réseau.
            </p>
            <div className="mt-8 flex flex-col gap-3 min-[420px]:flex-row min-[420px]:flex-wrap">
              <Link
                href="/connexion"
                className="inline-flex h-13 items-center justify-center gap-2 rounded-xl bg-accent px-6 text-base font-bold text-on-accent hover:brightness-95"
              >
                Accéder à mon espace
                <ArrowRight className="size-5" aria-hidden />
              </Link>
              <ReadAloud
                text={PITCH}
                label="Écouter la présentation"
                className="h-13 justify-center rounded-xl border-sidebar-muted bg-transparent px-5 text-base text-sidebar-text hover:bg-sidebar-hover"
              />
            </div>
            <ul className="mt-10 flex flex-wrap gap-2 text-sm" aria-label="En bref">
              {[
                [Volume2, "Voix Kora sur chaque écran"],
                [WifiOff, "Lecture hors ligne"],
                [Contrast, "Contraste élevé"],
              ].map(([Icon, label]) => {
                const I = Icon as LucideIcon;
                return (
                  <li key={label as string} className="inline-flex items-center gap-2 rounded-full border border-sidebar-muted/50 px-3 py-1.5">
                    <I className="size-4 text-accent" aria-hidden />
                    {label as string}
                  </li>
                );
              })}
            </ul>
          </div>
          <FlagStripe />
        </section>

        {/* Actors -------------------------------------------------------- */}
        <section id="acteurs" aria-labelledby="actors-title" className="scroll-mt-4 bg-bg">
          <div className="mx-auto grid max-w-7xl grid-cols-1 gap-10 px-5 py-16 sm:px-8 lg:grid-cols-[22rem_1fr] lg:gap-16 lg:py-24">
            <div className="lg:sticky lg:top-8 lg:self-start">
              <p className="text-sm font-bold tracking-[0.14em] text-primary uppercase">Qui utilise Classéo</p>
              <h2 id="actors-title" className="mt-3 text-3xl leading-tight font-extrabold sm:text-4xl">
                Du bureau du ministre à la cour de l&apos;école.
              </h2>
              <p className="mt-4 text-muted">
                Chacun voit ce qui le concerne, rien de plus. Les droits suivent la carte du pays : nation, département, commune, école, famille.
              </p>
            </div>
            <div className="flex flex-col gap-10">
              <ActorGroup title="Pilotage" actors={STEERING} />
              <ActorGroup title="Sur le terrain" actors={FIELD} />
              <ActorGroup title="En appui" actors={[PARTNERS]} />
            </div>
          </div>
        </section>

        {/* Inclusion ----------------------------------------------------- */}
        <section id="inclusion" aria-labelledby="inclusion-title" className="scroll-mt-4 border-y border-border bg-surface">
          <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8 lg:py-24">
            <div className="max-w-2xl">
              <p className="text-sm font-bold tracking-[0.14em] text-primary uppercase">Nos engagements</p>
              <h2 id="inclusion-title" className="mt-3 text-3xl leading-tight font-extrabold sm:text-4xl">
                Personne ne reste à la porte de l&apos;école.
              </h2>
              <p className="mt-4 text-muted">Classéo est conçu dès le départ pour les personnes aveugles ou malvoyantes, sourdes ou malentendantes, et pour celles qui lisent peu.</p>
            </div>

            <div className="mt-10 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,26rem)_1fr]">
              <article aria-labelledby="kora-title" className="relative overflow-hidden rounded-2xl bg-sidebar p-6 text-sidebar-text sm:p-8">
                <span className="flex size-14 items-center justify-center rounded-2xl bg-accent text-on-accent" aria-hidden>
                  <Volume2 className="size-7" />
                </span>
                <h3 id="kora-title" className="mt-5 text-2xl font-extrabold">
                  Kora lit chaque écran à voix haute
                </h3>
                <p className="mt-2 text-sidebar-muted">Bulletins, absences, annonces : un bouton, et la voix de Classéo explique l&apos;essentiel en français. Sans téléchargement, même hors ligne.</p>
                <figure className="mt-6 rounded-xl border border-sidebar-muted/40 bg-sidebar-hover p-4">
                  <figcaption className="text-xs font-bold tracking-wider text-accent uppercase">Exemple pour un parent</figcaption>
                  <blockquote className="mt-2 text-lg leading-snug">« {KORA_SAMPLE} »</blockquote>
                </figure>
                <ReadAloud text={KORA_SAMPLE} label="Écouter Kora" className="relative mt-5 h-12 border-accent bg-accent px-5 text-base text-on-accent hover:bg-accent hover:brightness-95" />
              </article>

              <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {COMMITMENTS.map((c) => (
                  <li key={c.title} className="flex gap-4 rounded-2xl border border-border bg-bg p-5">
                    <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary" aria-hidden>
                      <c.icon className="size-6" />
                    </span>
                    <div className="min-w-0 break-words hyphens-auto">
                      <h3 className="font-sans text-lg font-bold">{c.title}</h3>
                      <p className="mt-1 text-muted">{c.text}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* Figures ------------------------------------------------------- */}
        <section id="chiffres" aria-labelledby="figures-title" className="scroll-mt-4 bg-sidebar text-sidebar-text">
          <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8 lg:py-24">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-sm font-bold tracking-[0.14em] text-accent uppercase">En direct</p>
                <h2 id="figures-title" className="mt-3 text-3xl leading-tight font-extrabold sm:text-4xl">
                  Le système éducatif, sur un seul écran.
                </h2>
              </div>
              <p className="max-w-sm text-sm text-sidebar-muted">Chiffres agrégés de la plateforme de démonstration, actualisés toutes les cinq minutes. Aucune donnée personnelle.</p>
            </div>
            <div className="mt-10">
              <Suspense fallback={<FiguresSkeleton />}>
                <Figures />
              </Suspense>
            </div>
          </div>
        </section>

        {/* Closing call -------------------------------------------------- */}
        <section aria-labelledby="cta-title" className="bg-bg">
          <div className="mx-auto flex max-w-7xl flex-col items-start gap-6 px-5 py-16 sm:px-8 md:flex-row md:items-center md:justify-between lg:py-20">
            <div>
              <h2 id="cta-title" className="text-3xl leading-tight font-extrabold sm:text-4xl">
                Votre espace vous attend.
              </h2>
              <p className="mt-2 max-w-xl text-muted">Connectez-vous avec l&apos;adresse et le mot de passe remis par votre établissement ou votre direction.</p>
            </div>
            <Link href="/connexion" className="inline-flex h-13 shrink-0 items-center gap-2 rounded-xl bg-primary px-6 text-base font-bold text-on-primary hover:bg-primary-hover">
              Se connecter
              <ArrowRight className="size-5" aria-hidden />
            </Link>
          </div>
        </section>
      </main>

      <footer className="bg-sidebar text-sidebar-text">
        <FlagStripe />
        <div className="mx-auto flex max-w-7xl flex-col gap-8 px-5 py-10 sm:px-8 md:flex-row md:justify-between">
          <div className="max-w-sm">
            <Logo tone="inverse" />
            <p className="mt-3 text-sm text-sidebar-muted">Plateforme nationale inclusive de l&apos;éducation. Prototype présenté au défi EduTech Bénin, 2026.</p>
          </div>
          <nav aria-label="Liens du pied de page">
            <ul className="grid gap-1 text-sm font-semibold">
              <li>
                <Link href="/connexion" className="inline-flex min-h-11 items-center hover:underline">
                  Se connecter
                </Link>
              </li>
              <li>
                <a href="#inclusion" className="inline-flex min-h-11 items-center hover:underline">
                  Accessibilité et inclusion
                </a>
              </li>
              <li>
                <Link href="/hors-ligne" className="inline-flex min-h-11 items-center hover:underline">
                  Utiliser Classéo hors ligne
                </Link>
              </li>
            </ul>
          </nav>
        </div>
      </footer>
    </>
  );
}

function ActorGroup({ title, actors }: { title: string; actors: Actor[] }) {
  return (
    <div>
      <h3 className="mb-4 flex items-center gap-3 font-sans text-sm font-bold tracking-[0.14em] text-muted uppercase">
        {title}
        <span className="h-px flex-1 bg-border" aria-hidden />
      </h3>
      <ol className="relative flex flex-col gap-3">
        {actors.map((a, i) => (
          <li key={a.name} className="group relative flex gap-4 rounded-2xl border border-border bg-surface p-5">
            {i < actors.length - 1 && <span className="absolute top-[4.25rem] bottom-[-0.8rem] left-[2.7rem] w-0.5 bg-primary/25" aria-hidden />}
            <span className="relative flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary text-on-primary" aria-hidden>
              <a.icon className="size-6" />
            </span>
            <div className="min-w-0 break-words hyphens-auto">
              <h4 className="font-display text-xl font-bold">{a.name}</h4>
              <p className="mt-1 text-text">{a.promise}</p>
              <ul className="mt-3 flex flex-wrap gap-2">
                {a.does.map((d) => (
                  <li key={d} className="rounded-full bg-surface-2 px-3 py-1 text-sm text-muted">
                    {d}
                  </li>
                ))}
              </ul>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

function FlagStripe() {
  return (
    <div className="flex h-1.5" aria-hidden>
      <span className="w-2/5 bg-[#008751]" />
      <span className="w-2/5 bg-accent" />
      <span className="w-1/5 bg-[#e8112d]" />
    </div>
  );
}

// The rising sun of the logo, drawn as a horizon: decorative only.
function SunriseMotif({ className, still = false }: { className?: string; still?: boolean }) {
  const rays = Array.from({ length: 11 }, (_, i) => -75 + i * 15);
  return (
    <svg viewBox="0 0 400 210" className={className} aria-hidden focusable="false">
      <g className={cn(!still && "classeo-rise")}>
        <g stroke="#fcd116" strokeWidth="7" strokeLinecap="round" className={cn(!still && "classeo-rays")}>
          {rays.map((deg) => {
            const r = (deg * Math.PI) / 180;
            const x1 = 200 + Math.sin(r) * 128;
            const y1 = 205 - Math.cos(r) * 128;
            const x2 = 200 + Math.sin(r) * 168;
            const y2 = 205 - Math.cos(r) * 168;
            return <line key={deg} x1={x1.toFixed(1)} y1={y1.toFixed(1)} x2={x2.toFixed(1)} y2={y2.toFixed(1)} />;
          })}
        </g>
        <path d="M95 205a105 105 0 0 1 210 0z" fill="#fcd116" />
      </g>
    </svg>
  );
}
