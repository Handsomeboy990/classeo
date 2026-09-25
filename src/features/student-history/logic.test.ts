import { describe, expect, it } from "vitest";

import { historyReach, reaches, recordAccessValid, schoolAt } from "./logic";

const now = new Date("2026-10-10T12:00:00Z");

describe("historyReach", () => {
  it("opens the whole record to the family and the ministry", () => {
    expect(historyReach({ kind: "family" }, ["a"], now)).toEqual({ all: true });
    expect(historyReach({ kind: "national" }, ["a"], now)).toEqual({ all: true });
  });

  it("limits a school without access to its own walls", () => {
    const reach = historyReach({ kind: "school", schoolId: "b", access: null }, ["a", "b"], now)!;
    expect(reach.all).toBe(false);
    expect(reaches(reach, "b")).toBe(true);
    expect(reaches(reach, "a")).toBe(false);
  });

  it("refuses a school the pupil never attended", () => {
    expect(historyReach({ kind: "school", schoolId: "z", access: null }, ["a", "b"], now)).toBeNull();
  });

  it("opens everything to a school with a valid access, not an expired one", () => {
    expect(historyReach({ kind: "school", schoolId: "z", access: { expiresAt: null } }, ["a"], now)).toEqual({ all: true });
    expect(historyReach({ kind: "school", schoolId: "z", access: { expiresAt: new Date("2026-12-01") } }, ["a"], now)).toEqual({ all: true });
    expect(historyReach({ kind: "school", schoolId: "z", access: { expiresAt: new Date("2026-10-01") } }, ["a"], now)).toBeNull();
  });

  it("limits a territory to its schools", () => {
    const reach = historyReach({ kind: "territory", schoolIds: new Set(["a"]) }, ["a", "b"], now)!;
    expect(reaches(reach, "a")).toBe(true);
    expect(reaches(reach, "b")).toBe(false);
    expect(historyReach({ kind: "territory", schoolIds: new Set(["c"]) }, ["a", "b"], now)).toBeNull();
  });
});

describe("recordAccessValid", () => {
  it("treats a missing expiry as permanent", () => {
    expect(recordAccessValid({ expiresAt: null }, now)).toBe(true);
    expect(recordAccessValid(null, now)).toBe(false);
  });
});

describe("schoolAt", () => {
  it("gives the previous school before a move of the year", () => {
    const moves = [{ at: new Date("2026-10-05"), fromSchoolId: "a", toSchoolId: "b" }];
    expect(schoolAt("b", moves, new Date("2026-09-20"))).toBe("a");
    expect(schoolAt("b", moves, new Date("2026-10-06"))).toBe("b");
    expect(schoolAt("b", [], new Date("2026-09-20"))).toBe("b");
  });
});
