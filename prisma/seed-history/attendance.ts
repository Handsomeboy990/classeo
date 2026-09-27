// Roll calls of the past years, lighter than this year's: at CEG Godomey and
// EPP Godomey Centre, both halves of twelve days spread over the year; in
// every other school, two half days (one in each half of the year; one in
// the older years outside the Atlantique and the Littoral), enough for the
// absence rate of each year. Absences fall slowly year after year.

import type { Prisma } from "../../src/generated/prisma/client";
import { clamp, shortId } from "../seed-lib/random";
import { schoolDaysOf, spread } from "./calendar";
import type { HistoryContext } from "./index";

const ABSENCE_BASE = [0.125, 0.117, 0.109, 0.102];
const REASONS = ["Maladie", "Raison familiale", "Transport"];

export async function writeAttendance(ctx: HistoryContext) {
  const { rng, years, stints, info, schoolById, input } = ctx;
  const rows: Prisma.StudentAttendanceCreateManyInput[] = [];
  for (let y = 0; y <= 3; y++) {
    const year = years[y]!;
    const terms = year.periods.filter((p) => p.periodicity === "TRIMESTER").sort((a, b) => a.order - b.order);
    const allDays = schoolDaysOf(terms);
    const detailedDays = spread(allDays, 12, 0.4);
    // Each school its own two days, so the dates vary across the country.
    const daysOf = new Map<string, Date[]>();
    for (const st of stints[y]!) {
      const school = schoolById.get(st.schoolId)!;
      const detailed = school.id === ctx.ceg.id || school.id === ctx.epp.id;
      let days = daysOf.get(school.id);
      if (!days) {
        const n = allDays.length;
        const first = allDays[Math.floor(n * (0.15 + rng.rand() * 0.25))]!;
        const second = allDays[Math.floor(n * (0.6 + rng.rand() * 0.3))]!;
        // Outside the Atlantique and the Littoral, one half day in the older
        // years: enough for the rates, lighter over the network.
        const light = y < 3 && school.departmentName !== "Atlantique" && school.departmentName !== "Littoral";
        days = detailed ? detailedDays : light ? [rng.chance(0.5) ? first : second] : [first, second];
        daysOf.set(school.id, days);
      }
      // A pupil who left during the year is on the rolls until then.
      const periods = year.periods.filter((p) => p.periodicity === school.periodicity).sort((a, b) => a.order - b.order);
      const until = st.periodsDone ? periods[st.periodsDone - 1]!.endDate : year.endDate;
      const risk = clamp(ABSENCE_BASE[y]! - (info.get(st.studentId)!.ability - 10) * 0.012, 0.01, 0.3);
      const recordedById = ctx.directorOf(school.id) ?? input.users.minister;
      days.forEach((date, i) => {
        if (date > until) return;
        const halves = detailed ? (["MORNING", "AFTERNOON"] as const) : ([i % 2 ? "AFTERNOON" : "MORNING"] as const);
        for (const half of halves) {
          const r = rng.rand();
          let status: "PRESENT" | "ABSENT" | "LATE" | "EXCUSED" = r < risk ? "ABSENT" : r < risk + 0.04 ? "LATE" : "PRESENT";
          let reason: string | null = null;
          if (status === "ABSENT" && rng.chance(0.3)) reason = rng.pick(REASONS);
          // Justified later by the family: excused.
          if (status === "ABSENT" && reason && rng.chance(0.6)) status = "EXCUSED";
          rows.push({ id: shortId(), enrollmentId: st.id, date, half, status, reason, recordedById, createdAt: new Date(date.getTime() + (half === "MORNING" ? 8 : 15) * 3600_000) });
        }
      });
    }
  }
  await input.bulk.insert("StudentAttendance", rows, 10000);
  console.log(`history: ${rows.length} roll call marks`);
}
