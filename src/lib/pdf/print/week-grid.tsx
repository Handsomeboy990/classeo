import { DAYS, toMinutes } from "@/lib/domain/timetable";

import { duration } from "../format";
import { COLORS, SUBJECT_TINTS } from "../theme";
import { mergeSimultaneous, placeSlots, weeklyMinutes, type WeekSlot } from "../week";

const TINTS = SUBJECT_TINTS;

const time = (t: string) => t.replace(":", " h ");

// The week as a time scaled grid, the HTML twin of the timetable PDF. On
// screen it scrolls sideways on narrow widths; on paper it fills a landscape
// page.
export function PrintWeekGrid({ slots }: { slots: WeekSlot[] }) {
  if (!slots.length) return <p className="doc-muted py-10 text-center">Aucun cours planifié.</p>;
  const merged = mergeSimultaneous(slots);
  const placed = placeSlots(merged);
  const from = Math.floor(Math.min(...slots.map((s) => toMinutes(s.startTime)), 8 * 60) / 60) * 60;
  const to = Math.ceil(Math.max(...slots.map((s) => toMinutes(s.endTime)), 12 * 60) / 60) * 60;
  const span = to - from;
  const hours: number[] = [];
  for (let m = from; m <= to; m += 60) hours.push(m);
  const subjects = [...new Set(slots.map((s) => s.subject))].sort((a, b) => a.localeCompare(b, "fr"));
  const totals = weeklyMinutes(merged);
  const all = [...totals.values()].reduce((a, b) => a + b, 0);
  const pct = (m: number) => `${((m - from) / span) * 100}%`;

  return (
    <div className="doc-keep">
      <div className="overflow-x-auto">
        <div className="min-w-[720px]">
          <div className="ml-10 grid grid-cols-6 border-b-[1.5px]" style={{ borderColor: COLORS.primary, background: COLORS.primarySoft }}>
            {DAYS.map((d) => (
              <div key={d.value} className="doc-title py-1.5 text-center text-[10px] tracking-wide uppercase" style={{ color: COLORS.primaryDark }}>
                {d.label}
              </div>
            ))}
          </div>
          <div className="relative flex h-[520px] print:h-[94mm]">
            <div className="relative w-10 shrink-0" aria-hidden>
              {hours.map((m) => (
                <span key={m} className="doc-muted absolute right-1.5 -translate-y-1/2 text-[10px]" style={{ top: pct(m) }}>
                  {String(m / 60).padStart(2, "0")} h
                </span>
              ))}
            </div>
            <div className="grid flex-1 grid-cols-6">
              {DAYS.map((d) => (
                <div key={d.value} className="relative border-b border-l" style={{ borderColor: COLORS.border }}>
                  {hours.slice(1, -1).map((m) => (
                    <div key={m} className="absolute inset-x-0 border-t" style={{ top: pct(m), borderColor: COLORS.rule }} aria-hidden />
                  ))}
                  {placed
                    .filter((s) => s.dayOfWeek === d.value)
                    .map((s, i) => {
                      const [bg, edge] = TINTS[subjects.indexOf(s.subject) % TINTS.length]!;
                      return (
                        <div
                          key={i}
                          className="absolute overflow-hidden rounded-sm border-r-2 border-white px-1.5 py-1 text-[10px] leading-tight"
                          style={{
                            top: `calc(${pct(toMinutes(s.startTime))} + 1px)`,
                            height: `calc(${((toMinutes(s.endTime) - toMinutes(s.startTime)) / span) * 100}% - 2px)`,
                            left: `${(s.lane / s.lanes) * 100}%`,
                            width: `${100 / s.lanes}%`,
                            background: s.cancelledOn ? COLORS.soft : bg,
                            borderLeft: `3px solid ${s.cancelledOn ? COLORS.faint : edge}`,
                          }}
                        >
                          <p className="doc-muted">
                            {time(s.startTime)} à {time(s.endTime)}
                            {s.room && !s.room.includes(", ") ? ` · ${s.room}` : ""}
                          </p>
                          <p className="text-[11px] font-bold">{s.subject}</p>
                          {s.detail && <p className="doc-muted">{s.detail}</p>}
                          {s.cancelledOn && <p className="font-bold" style={{ color: COLORS.danger }}>
                              Annulé cette semaine
                            </p>}
                        </div>
                      );
                    })}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
        <span className="doc-title">Volume hebdomadaire : {duration(all)}</span>
        {[...totals.entries()]
          .sort((a, b) => b[1] - a[1])
          .map(([subject, minutes]) => (
            <span key={subject} className="doc-muted">
              {subject} {duration(minutes)}
            </span>
          ))}
      </p>
    </div>
  );
}
