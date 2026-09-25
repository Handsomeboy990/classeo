import { AlertTriangle } from "lucide-react";

import { addDays, DAYS, fromMinutes, gridBounds, gridRows } from "@/lib/domain/timetable";
import { cn } from "@/lib/utils";

import { layoutDay } from "../layout";
import type { SlotView } from "../queries";

import { SlotCard, type SlotRights } from "./slot-card";

const ROW = 0.95; // rem per 15 minutes

const dayDate = new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "2-digit", timeZone: "UTC" });

// Weekly grid, Monday to Saturday, one list per day placed on a shared time
// scale. Each day is a labelled list, so screen readers get the courses in
// order instead of a maze of cells.
//
// Courses at the same time are never drawn on top of each other: two share
// the slot side by side; three or more become one conflict cell: a warning
// badge with the count and the hours, then one chip per course naming its
// class, each opening the course as a card would (see ../layout.ts).
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
            <ol key={d.value} aria-label={`${d.label}, ${daySlots.length} cours`} className="grid min-w-0 grid-cols-[minmax(0,1fr)] border-l border-border px-1" style={{ ...rowsStyle, ...lines }}>
              {layoutDay(daySlots).map((item) => {
                if (item.kind === "slot") {
                  const s = item.slot;
                  const { from, to } = gridRows(s, start);
                  const width = 100 / item.lanes;
                  return (
                    <li
                      key={s.id}
                      className={cn("min-w-0 py-0.5", item.lanes > 1 && "px-px")}
                      style={{ gridRow: `${from} / ${to}`, gridColumn: 1, marginLeft: `${item.lane * width}%`, width: `${width}%` }}
                    >
                      <SlotCard
                        slot={s}
                        showClass={showClass}
                        rights={rights}
                        assignments={assignments}
                        sessionDate={sessionDate}
                        compact={to - from <= 4 || item.lanes > 1}
                      />
                    </li>
                  );
                }
                const { from, to } = gridRows({ ...item.slots[0]!, startTime: item.startTime, endTime: item.endTime }, start);
                return (
                  <li key={item.slots[0]!.id} className="min-w-0 py-0.5" style={{ gridRow: `${from} / ${to}`, gridColumn: 1 }}>
                    <div className="flex h-full min-h-0 flex-col gap-1 rounded-lg border border-warning/40 bg-warning-soft p-1.5">
                      <p className="flex items-start gap-1 px-0.5 text-xs leading-snug font-semibold text-warning">
                        <AlertTriangle className="mt-px size-3.5 shrink-0" aria-hidden />
                        <span className="min-w-0">
                          {item.slots.length} cours en même temps, {item.startTime} à {item.endTime}
                        </span>
                      </p>
                      {/* Scrolls if the chips outgrow the slot; focusable so the keyboard can scroll it too. */}
                      <ol
                        tabIndex={0}
                        aria-label={`${item.slots.length} cours en même temps, de ${item.startTime} à ${item.endTime}`}
                        className="flex min-h-0 flex-1 flex-wrap content-start gap-1 overflow-y-auto overscroll-contain rounded-md"
                      >
                        {item.slots.map((s) => (
                          <li key={s.id} className="max-w-full">
                            <SlotCard
                              slot={s}
                              showClass={showClass}
                              rights={rights}
                              assignments={assignments}
                              sessionDate={sessionDate}
                              line
                              overlapping={item.slots.length - 1}
                            />
                          </li>
                        ))}
                      </ol>
                    </div>
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
