import Link from "next/link";

import { EmptyState } from "@/components/kit/states";
import { addDays, DAYS } from "@/lib/domain/timetable";

import { overlapCount } from "../layout";
import type { SlotView } from "../queries";

import { SlotCard, type SlotRights } from "./slot-card";

// Phone layout: one day at a time, as a list, with day tabs kept in the URL.
export function DayList({
  slots,
  monday,
  day,
  dayHref,
  showClass,
  rights,
  assignments,
  className,
}: {
  slots: SlotView[];
  monday: Date;
  day: number;
  dayHref: (day: number) => string;
  showClass: boolean;
  rights: SlotRights;
  assignments: { id: string; label: string }[];
  className?: string;
}) {
  const daySlots = slots.filter((s) => s.dayOfWeek === day);
  const current = DAYS[day - 1]!;
  const sessionDate = addDays(monday, day - 1).toISOString().slice(0, 10);
  return (
    <div className={className}>
      <nav aria-label="Jour affiché" className="ds-segmented mb-3 grid w-full grid-cols-6">
        {DAYS.map((d) => (
          <Link
            key={d.value}
            href={dayHref(d.value)}
            scroll={false}
            aria-current={d.value === day ? "page" : undefined}
            className="px-1"
          >
            <span aria-hidden>{d.short}</span>
            <span className="sr-only">{d.label}</span>
          </Link>
        ))}
      </nav>
      <h2 className="mb-2 text-lg font-bold">
        {current.label} {sessionDate.split("-").reverse().slice(0, 2).join("/")}
      </h2>
      {daySlots.length === 0 ? (
        <div className="rounded-card border border-border bg-surface">
          <EmptyState title="Pas de cours ce jour-là" />
        </div>
      ) : (
        <ol aria-label={`Cours du ${current.label.toLowerCase()}`} className="flex flex-col gap-2">
          {daySlots.map((s) => (
            <li key={s.id}>
              <SlotCard slot={s} showClass={showClass} rights={rights} assignments={assignments} sessionDate={sessionDate} overlapping={overlapCount(s, daySlots)} className="p-3" />
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
