import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";

import { formatDate } from "@/lib/utils";

const STEP = "inline-flex size-11 shrink-0 items-center justify-center rounded-lg border border-border-strong bg-surface hover:bg-surface-2";

// Week shown by the timetable: previous, the week, next, then back to the
// current week. Nothing has a fixed width: with very large text the week
// label wraps between the arrows and "Cette semaine" takes its own line, so
// the page never scrolls sideways.
export function WeekNav({ monday, previousHref, nextHref, currentHref, isCurrent }: { monday: Date; previousHref: string; nextHref: string; currentHref: string; isCurrent: boolean }) {
  return (
    <nav aria-label="Semaine affichée" className="flex min-w-0 flex-wrap items-center gap-2 max-sm:w-full">
      <Link href={previousHref} className={STEP} aria-label="Semaine précédente">
        <ChevronLeft className="size-5" aria-hidden />
      </Link>
      <p className="min-w-0 flex-1 text-center text-sm font-semibold text-balance sm:min-w-44" aria-live="polite">
        Semaine du {formatDate(monday)}
      </p>
      <Link href={nextHref} className={STEP} aria-label="Semaine suivante">
        <ChevronRight className="size-5" aria-hidden />
      </Link>
      {!isCurrent && (
        <Link
          href={currentHref}
          className="inline-flex min-h-11 items-center justify-center rounded-lg px-2 text-sm font-semibold text-primary hover:underline max-sm:basis-full"
        >
          Cette semaine
        </Link>
      )}
    </nav>
  );
}
