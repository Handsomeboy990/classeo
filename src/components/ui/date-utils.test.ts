import { describe, expect, it } from "vitest";

import { addMonths, monthGrid, parseIso, parseTyped, spokenDate, toDisplay, todayIso, weekday } from "./date-utils";
import { fold } from "./popover-position";

describe("date utils", () => {
  it("rejects impossible dates", () => {
    expect(parseIso("2026-02-30")).toBeNull();
    expect(parseIso("2028-02-29")).toEqual({ y: 2028, m: 1, d: 29 });
  });

  it("reads what people type", () => {
    const now = new Date(Date.UTC(2026, 8, 25));
    expect(parseTyped("12/03/2026", now)).toBe("2026-03-12");
    expect(parseTyped("5-3-2026", now)).toBe("2026-03-05");
    expect(parseTyped("05.03.26", now)).toBe("2026-03-05");
    expect(parseTyped("12032014", now)).toBe("2014-03-12");
    expect(parseTyped("01/01/95", now)).toBe("1995-01-01");
    expect(parseTyped("31/02/2026", now)).toBeNull();
    expect(parseTyped("demain", now)).toBeNull();
  });

  it("starts weeks on Monday and keeps six rows", () => {
    expect(weekday("2026-09-28")).toBe(0); // a Monday
    expect(weekday("2026-09-27")).toBe(6); // a Sunday
    const grid = monthGrid(2026, 8);
    expect(grid).toHaveLength(6);
    expect(grid[0]![0]).toBe("2026-08-31");
    expect(grid.flat()).toContain("2026-09-30");
  });

  it("clamps the day when changing month", () => {
    expect(addMonths("2026-01-31", 1)).toBe("2026-02-28");
    expect(addMonths("2026-03-15", -12)).toBe("2025-03-15");
  });

  it("formats in French", () => {
    expect(toDisplay("2026-03-05")).toBe("05/03/2026");
    expect(spokenDate("2026-03-01")).toBe("dimanche 1er mars 2026");
    expect(todayIso(new Date("2026-09-25T23:30:00Z"))).toBe("2026-09-26");
  });

  it("searches without accents or case", () => {
    expect(fold("Élèves de l'École")).toBe("eleves de l'ecole");
  });
});
