import { describe, expect, it } from "vitest";

import {
  beninToday,
  countWord,
  parseReportLines,
  presenceRate,
  rankLabel,
  reportSentence,
  spokenSummary,
  spokenTime,
  summariseAttendance,
  timetableGrid,
  weekRange,
} from "./logic";

describe("beninToday", () => {
  it("uses UTC+1: 23:30 UTC on Thursday is already Friday in Cotonou", () => {
    expect(beninToday(new Date("2026-09-24T23:30:00Z"))).toEqual({ iso: "2026-09-25", dayOfWeek: 5 });
  });

  it("numbers Sunday 7, like TimetableSlot.dayOfWeek", () => {
    expect(beninToday(new Date("2026-09-27T10:00:00Z")).dayOfWeek).toBe(7);
  });
});

describe("weekRange", () => {
  it("runs from Monday to the next Monday", () => {
    const { start, end } = weekRange({ iso: "2026-09-25", dayOfWeek: 5 });
    expect(start.toISOString()).toBe("2026-09-21T00:00:00.000Z");
    expect(end.toISOString()).toBe("2026-09-28T00:00:00.000Z");
  });
});

describe("attendance", () => {
  const d = new Date("2026-09-24T00:00:00Z");
  const records = [
    { date: d, half: "MORNING" as const, status: "ABSENT" as const, reason: null },
    { date: d, half: "AFTERNOON" as const, status: "PRESENT" as const, reason: null },
    { date: d, half: "AFTERNOON" as const, status: "LATE" as const, reason: null },
    { date: d, half: "MORNING" as const, status: "EXCUSED" as const, reason: "Maladie" },
  ];

  it("counts each status", () => {
    expect(summariseAttendance(records)).toEqual({ absences: 1, lates: 1, excused: 1, recorded: 4 });
  });

  it("leaves excused half days out of the presence rate", () => {
    expect(presenceRate(summariseAttendance(records))).toBeCloseTo(2 / 3);
    expect(presenceRate(summariseAttendance([]))).toBeNull();
  });
});

describe("words", () => {
  it("says counts the way they are spoken", () => {
    expect(countWord(0, "absence", "absences")).toBe("Aucune absence");
    expect(countWord(1, "absence", "absences")).toBe("Une absence");
    expect(countWord(3, "absence", "absences")).toBe("3 absences");
    expect(spokenTime("07:00")).toBe("7 h");
    expect(spokenTime("09:15")).toBe("9 h 15");
    expect(rankLabel(1, 34)).toBe("1er sur 34");
    expect(rankLabel(26)).toBe("26e");
    expect(rankLabel(null)).toBe("–");
  });
});

describe("spokenSummary", () => {
  it("gives the essentials in short sentences", () => {
    const s = spokenSummary({
      firstName: "Sènami",
      classroom: "3e A",
      lastReport: { average: 13.25, periodLabel: "Trimestre 3 2025-2026" },
      weekAbsences: 1,
      todayCourses: [{ subject: "Mathématiques", startTime: "07:00" }],
    });
    expect(s).toBe(
      "Sènami, classe de 3e A. Dernier bulletin, Trimestre 3 2025-2026 : 13,25 sur 20, Assez bien. Une absence cette semaine. Aujourd'hui, 1 cours. Le premier : Mathématiques à 7 h.",
    );
  });

  it("says when nothing is published yet and when there is no school", () => {
    const s = spokenSummary({ firstName: "Mahougnon", classroom: "CE2 A", lastReport: null, weekAbsences: 0, todayCourses: [], isWeekend: true });
    expect(s).toContain("Pas encore de bulletin publié.");
    expect(s).toContain("Aucune absence cette semaine.");
    expect(s).toContain("Pas de cours aujourd'hui.");
  });

  it("reads a report card with rank and appreciation", () => {
    expect(reportSentence({ firstName: "Sènami", periodLabel: "Trimestre 1 2025-2026", average: 9, rank: 26, classSize: 34, appreciation: "Peut mieux faire." })).toBe(
      "Bulletin de Sènami, Trimestre 1 2025-2026. Moyenne générale : 9,00 sur 20, Insuffisant. Rang : 26e sur 34. Appréciation : Peut mieux faire.",
    );
  });
});

describe("parseReportLines", () => {
  it("keeps valid lines and ignores malformed JSON", () => {
    expect(parseReportLines(null)).toEqual([]);
    expect(parseReportLines([{ subject: "Français", coefficient: 3, average: 12.5, rank: 4 }, { nope: true }, "x"])).toEqual([
      { subject: "Français", coefficient: 3, average: 12.5, rank: 4 },
    ]);
  });
});

describe("timetableGrid", () => {
  it("builds time bands and always shows Monday to Friday", () => {
    const slots = [
      { dayOfWeek: 2, startTime: "09:15", endTime: "11:15", subject: "Français" },
      { dayOfWeek: 1, startTime: "07:00", endTime: "09:00", subject: "Maths" },
    ];
    const grid = timetableGrid(slots);
    expect(grid.bands.map((b) => b.start)).toEqual(["07:00", "09:15"]);
    expect(grid.days).toEqual([1, 2, 3, 4, 5]);
    expect(grid.cell(1, "07:00", "09:00")?.subject).toBe("Maths");
    expect(grid.cell(3, "07:00", "09:00")).toBeNull();
  });
});
