import { ChevronDown } from "lucide-react";
import Link from "next/link";

import { ReadAloud } from "@/components/kit/read-aloud";
import { cn } from "@/lib/utils";

import { FAQ, guideText, type Guide } from "./guides";

export function GuideSteps({ guide, headingLevel = 2 }: { guide: Guide; headingLevel?: 2 | 3 }) {
  const H = headingLevel === 2 ? "h2" : "h3";
  return (
    <section aria-labelledby={`guide-${guide.key}`} className="rounded-card border border-border bg-surface p-4 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <H id={`guide-${guide.key}`} className="text-xl font-bold sm:text-2xl">
            {guide.title}
          </H>
          <p className="text-sm text-muted">{guide.audience}</p>
        </div>
        <ReadAloud text={guideText(guide)} label="Écouter le guide" />
      </div>
      <ol className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {guide.steps.map((s, i) => {
          const body = (
            <>
              <span className="flex items-center gap-3">
                <span className="relative flex size-12 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary" aria-hidden>
                  <s.icon className="size-6" />
                  <span className="absolute -top-1.5 -left-1.5 flex size-6 items-center justify-center rounded-full border-2 border-surface bg-primary font-display text-xs font-bold text-on-primary">{i + 1}</span>
                </span>
                <span className="min-w-0 font-display text-[0.9375rem] font-bold break-words hyphens-auto">
                  <span className="sr-only">Étape {i + 1} : </span>
                  {s.title}
                </span>
              </span>
              <span className="mt-2 block text-muted">{s.text}</span>
            </>
          );
          const cls = "block h-full rounded-card border border-border bg-surface p-4 shadow-card";
          return (
            <li key={s.title}>
              {s.href ? (
                <Link href={s.href} className={cn(cls, "transition-[border-color,box-shadow] duration-150 hover:border-primary/40 hover:shadow-[var(--elevation-sm)]")}>
                  {body}
                </Link>
              ) : (
                <div className={cls}>{body}</div>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}

export function Faq() {
  return (
    <ul className="flex flex-col gap-2">
      {FAQ.map((f) => (
        <li key={f.q}>
          <details className="group rounded-card border border-border bg-surface">
            <summary className="flex min-h-14 list-none items-center gap-3 px-4 py-3 font-semibold [&::-webkit-details-marker]:hidden">
              <f.icon className="size-5 shrink-0 text-primary" aria-hidden />
              <span className="flex-1">{f.q}</span>
              <ChevronDown className="size-5 shrink-0 text-muted transition-transform group-open:rotate-180" aria-hidden />
            </summary>
            <div className="flex flex-col gap-3 border-t border-border px-4 py-3">
              <p>{f.a}</p>
              <ReadAloud text={`${f.q} ${f.a}`} label="Écouter la réponse" className="self-start" />
            </div>
          </details>
        </li>
      ))}
    </ul>
  );
}
