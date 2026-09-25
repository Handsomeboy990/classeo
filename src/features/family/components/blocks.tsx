import type { LucideIcon } from "lucide-react";
import { AudioLines, ChevronRight } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { ReadAloud } from "@/components/kit/read-aloud";
import { cn } from "@/lib/utils";

import { spokenTime } from "../logic";

// Building blocks of the family space: audio first, few words, big targets.

// The sentence Kora speaks, also shown in full so that a deaf or hard of
// hearing reader gets exactly the same information.
export function SpokenSummary({ text, label = "Écouter le résumé", className }: { text: string; label?: string; className?: string }) {
  return (
    <div className={cn("flex flex-col gap-3 rounded-card border border-primary/30 bg-primary-soft p-4 sm:flex-row sm:items-center sm:gap-4", className)}>
      <ReadAloud
        text={text}
        label={label}
        className="h-12 shrink-0 justify-center self-start border-primary bg-primary px-4 text-base text-on-primary hover:bg-primary-hover sm:self-center"
      />
      <p className="flex min-w-0 gap-2 text-base text-text">
        <AudioLines className="mt-1 size-4 shrink-0 text-primary" aria-hidden />
        <span>
          <span className="sr-only">Résumé : </span>
          {text}
        </span>
      </p>
    </div>
  );
}

const tones = {
  primary: "bg-primary-soft text-primary",
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  danger: "bg-danger-soft text-danger",
  info: "bg-info-soft text-info",
  accent: "bg-accent-soft text-on-accent",
} as const;

export type Tone = keyof typeof tones;

export function Pictogram({ icon: Icon, tone = "primary", size = "md" }: { icon: LucideIcon; tone?: Tone; size?: "md" | "lg" }) {
  return (
    <span className={cn("flex shrink-0 items-center justify-center rounded-xl", tones[tone], size === "lg" ? "size-14" : "size-11")} aria-hidden>
      <Icon className={size === "lg" ? "size-7" : "size-6"} />
    </span>
  );
}

// A big pictogram card. The whole card is the link; the label names the
// destination for screen readers.
export function PictoTile({
  icon,
  tone = "primary",
  title,
  href,
  children,
  footer,
}: {
  icon: LucideIcon;
  tone?: Tone;
  title: string;
  href?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const body = (
    <>
      <div className="flex items-center gap-3">
        <Pictogram icon={icon} tone={tone} />
        <h3 className="font-sans text-base font-bold text-text">{title}</h3>
        {href && <ChevronRight className="ml-auto size-5 shrink-0 text-muted" aria-hidden />}
      </div>
      <div className="mt-3 min-w-0 text-text [&>span]:whitespace-nowrap">{children}</div>
      {footer && <div className="mt-auto pt-3 text-sm text-muted">{footer}</div>}
    </>
  );
  const cls = "flex h-full min-h-40 flex-col rounded-card border border-border bg-surface p-4";
  return href ? (
    <Link href={href} className={cn(cls, "transition-colors hover:border-primary hover:bg-surface-2")}>
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
    <span className={cn("flex w-14 shrink-0 flex-col items-center overflow-hidden rounded-lg border border-border-strong bg-surface text-center", className)} aria-hidden>
      <span className="w-full bg-primary py-0.5 text-xs font-bold text-on-primary uppercase">{month}</span>
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
