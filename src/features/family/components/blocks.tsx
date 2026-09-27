import type { LucideIcon } from "lucide-react";
import { ChevronRight } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { ReadAloud } from "@/components/kit/read-aloud";
import { cn } from "@/lib/utils";

import { spokenTime } from "../logic";

// Building blocks of the family space: audio first, few words, big targets.

// The sentence Kora speaks, behind a speaker button: the page already shows
// the same facts in its cards, so the sentence itself is not displayed.
// Screen readers still get it, once, as the summary of the section.
export function SpokenSummary({ text, label = "Écouter le résumé", className }: { text: string; label?: string; className?: string }) {
  return (
    <div className={cn("inline-flex shrink-0", className)}>
      <ReadAloud text={text} label={label} />
      {/* Built from the day's data (timetable, marks, absences): the
          translation layer translates it by template at run time, so the
          untranslated-text check treats it as generated content. */}
      <p className="sr-only" data-generated-summary>
        Résumé : {text}
      </p>
    </div>
  );
}

// One colour for every pastille (doc 4.4, no multicoloured tiles): the soft
// navy. Danger only for what needs the family's attention (an unread
// message, an absence).
const tones = {
  primary: "bg-primary-soft text-primary",
  danger: "bg-danger-soft text-danger",
} as const;

export type Tone = keyof typeof tones;

export function Pictogram({ icon: Icon, tone = "primary", size = "md" }: { icon: LucideIcon; tone?: Tone; size?: "sm" | "md" | "lg" }) {
  return (
    <span
      className={cn("flex shrink-0 items-center justify-center rounded-full", tones[tone], size === "lg" ? "size-14" : size === "sm" ? "size-9 sm:size-11" : "size-11")}
      aria-hidden
    >
      <Icon className={size === "lg" ? "size-7" : size === "sm" ? "size-5 sm:size-6" : "size-6"} />
    </span>
  );
}

// A pictogram card. The whole card is the link; the title names the
// destination for screen readers. "row" lays it out on one line below lg
// (a single figure beside the title, no empty height), as a card from lg.
export function PictoTile({
  icon,
  tone = "primary",
  title,
  href,
  children,
  footer,
  layout = "card",
}: {
  icon: LucideIcon;
  tone?: Tone;
  title: string;
  href?: string;
  children: ReactNode;
  footer?: ReactNode;
  // strip: a single line at every width (one figure beside the title).
  layout?: "card" | "row" | "strip";
}) {
  const row = layout === "row";
  const body = layout === "strip" ? (
    <div className="flex min-w-0 flex-1 items-center gap-3">
      <Pictogram icon={icon} tone={tone} />
      <h3 className="min-w-0 flex-1 text-[0.9375rem] font-bold text-text">{title}</h3>
      <div className="shrink-0 text-text">{children}</div>
      {href && <ChevronRight className="size-5 shrink-0 text-muted" aria-hidden />}
    </div>
  ) : row ? (
    <>
      <div className="flex min-w-0 flex-1 items-center gap-3 lg:flex-none">
        <Pictogram icon={icon} tone={tone} />
        <h3 className="min-w-0 flex-1 text-[0.9375rem] font-bold text-text">{title}</h3>
        {href && <ChevronRight className="size-5 shrink-0 text-muted max-lg:order-last" aria-hidden />}
        <div className="shrink-0 text-text lg:hidden">{children}</div>
      </div>
      <div className="mt-3 min-w-0 text-text max-lg:hidden">{children}</div>
    </>
  ) : (
    <>
      <div className="flex items-center gap-2.5 sm:gap-3">
        <Pictogram icon={icon} tone={tone} size="sm" />
        <h3 className="min-w-0 flex-1 text-sm leading-snug font-bold text-balance text-text sm:text-base">{title}</h3>
        {href && <ChevronRight className="ml-auto size-5 shrink-0 text-muted max-sm:hidden" aria-hidden />}
      </div>
      <div className="mt-3 min-w-0 text-text [&_.rounded-full]:flex-wrap">{children}</div>
      {footer && <div className="mt-auto pt-2 text-xs text-muted sm:pt-3 sm:text-sm">{footer}</div>}
    </>
  );
  const cls = {
    strip: "flex items-center rounded-card border border-border bg-surface p-3 shadow-card sm:p-4",
    row: "flex h-full items-center rounded-card border border-border bg-surface p-3 shadow-card sm:p-4 lg:min-h-40 lg:flex-col lg:items-stretch",
    card: "flex h-full min-h-32 flex-col rounded-card border border-border bg-surface p-3 shadow-card sm:min-h-40 sm:p-4",
  }[layout];
  return href ? (
    <Link href={href} className={cn(cls, "transition-[border-color,box-shadow] duration-150 hover:border-primary/40 hover:shadow-[var(--elevation-sm)]")}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

export function SectionTitle({ icon: Icon, children, action }: { icon?: LucideIcon; children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
      <h2 className="flex items-center gap-2 text-xl font-bold text-text">
        {Icon && <Icon className="size-5 text-primary" aria-hidden />}
        {children}
      </h2>
      {action}
    </div>
  );
}

// Calendar leaf: the day number large, the month short, read as one date.
export function DateLeaf({ date, className }: { date: Date; className?: string }) {
  const day = new Intl.DateTimeFormat("fr-FR", { day: "numeric", timeZone: "Africa/Porto-Novo" }).format(date);
  const month = new Intl.DateTimeFormat("fr-FR", { month: "short", timeZone: "Africa/Porto-Novo" }).format(date).replace(".", "");
  return (
    <span className={cn("flex w-14 shrink-0 flex-col items-center self-start overflow-hidden rounded-control border border-border-strong bg-surface text-center", className)} aria-hidden>
      <span className="w-full bg-primary py-0.5 font-display text-[0.6875rem] font-bold tracking-[0.08em] text-on-primary uppercase">{month}</span>
      <span className="py-1 font-display text-2xl leading-none font-bold text-text">{day}</span>
    </span>
  );
}

const dayFmt = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
// @db.Date values come back at UTC midnight: format them in UTC.
export function formatSchoolDate(d: Date) {
  const s = dayFmt.format(d);
  return s.charAt(0).toUpperCase() + s.slice(1);
}

const eventDay = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: "Africa/Porto-Novo" });
const eventTime = new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: "Africa/Porto-Novo" });
// "Samedi 10 octobre à 11 h", the way a time is said aloud.
export function formatEventDate(d: Date) {
  const s = `${eventDay.format(d)} à ${spokenTime(eventTime.format(d))}`;
  return s.charAt(0).toUpperCase() + s.slice(1);
}
