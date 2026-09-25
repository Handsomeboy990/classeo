import { addDays, DAYS, fromMinutes, gridBounds, gridRows } from "@/lib/domain/timetable";
import { cn } from "@/lib/utils";

import type { SlotView } from "../queries";

import { SlotCard, type SlotRights } from "./slot-card";

const ROW = 0.95; // rem per 15 minutes

const dayDate = new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "2-digit", timeZone: "UTC" });

// Weekly grid, Monday to Saturday, one list per day placed on a shared time
// scale. Each day is a labelled list, so screen readers get the courses in
// order instead of a maze of cells.
export function WeekGrid({
  slots,
  monday,
  todayIso,
  showClass,
  rights,
  assignments,
  className,
}: {
  slots: SlotView[];
  monday: Date;
  todayIso: string;
  showClass: boolean;
  rights: SlotRights;
  assignments: { id: string; label: string }[];
  className?: string;
}) {
  const { start, end, rows } = gridBounds(slots);
  const hours: number[] = [];
  for (let m = start; m < end; m += 60) hours.push(m);
  const rowsStyle = { gridTemplateRows: `repeat(${rows}, ${ROW}rem)` };
  const lines = { backgroundImage: `repeating-linear-gradient(to bottom, var(--color-border) 0 1px, transparent 1px ${ROW * 4}rem)` };

  return (
    <div className={cn("overflow-x-auto rounded-card border border-border bg-surface", className)}>
      <div className="grid min-w-[52rem] grid-cols-[3.5rem_repeat(6,minmax(0,1fr))]">
        <div className="border-b border-border" aria-hidden />
        {DAYS.map((d) => {
          const iso = addDays(monday, d.value - 1).toISOString().slice(0, 10);
          const isToday = iso === todayIso;
          return (
            <div key={d.value} className={cn("border-b border-l border-border px-2 py-2 text-center text-sm", isToday && "bg-primary-soft")} aria-hidden>
              <span className="font-semibold">{d.label}</span>{" "}
              <span className="text-muted">{dayDate.format(addDays(monday, d.value - 1))}</span>
              {isToday && <span className="block text-xs font-semibold text-primary">Aujourd&apos;hui</span>}
            </div>
          );
        })}

        <div className="grid" style={rowsStyle} aria-hidden>
          {hours.map((m) => (
            <div key={m} className="row-span-4 pt-0.5 pr-1.5 text-right text-xs text-muted tabular-nums">
              {fromMinutes(m)}
            </div>
          ))}
        </div>

        {DAYS.map((d) => {
          const daySlots = slots.filter((s) => s.dayOfWeek === d.value);
          const sessionDate = addDays(monday, d.value - 1).toISOString().slice(0, 10);
          return (
            <ol key={d.value} aria-label={`${d.label}, ${daySlots.length} cours`} className="grid gap-y-0 border-l border-border px-1" style={{ ...rowsStyle, ...lines }}>
              {daySlots.map((s) => {
                const { from, to } = gridRows(s, start);
                return (
                  <li key={s.id} className="py-0.5" style={{ gridRow: `${from} / ${to}`, gridColumn: 1 }}>
                    <SlotCard slot={s} showClass={showClass} rights={rights} assignments={assignments} sessionDate={sessionDate} compact={to - from < 4} />
                  </li>
                );
              })}
            </ol>
          );
        })}
      </div>
    </div>
  );
}
