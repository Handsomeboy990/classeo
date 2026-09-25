import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { school, academicYear, yearExtension } = vi.hoisted(() => ({
  school: { findUnique: vi.fn() },
  academicYear: { findUnique: vi.fn(), findFirst: vi.fn() },
  yearExtension: { count: vi.fn() },
}));
vi.mock("@/lib/db", () => ({ db: { school, academicYear, yearExtension } }));

import { assertWritable, isYearClosed } from "./guards";

const now = new Date("2026-10-01T10:00:00Z");
const openYear = { id: "y1", label: "2026-2027", endDate: new Date("2027-07-02"), closedAt: null };
const pastYear = { id: "y0", label: "2025-2026", endDate: new Date("2026-07-03"), closedAt: new Date("2026-07-10") };

beforeEach(() => {
  school.findUnique.mockResolvedValue({ status: "ACTIVE", statusReason: null });
  academicYear.findUnique.mockResolvedValue(openYear);
  academicYear.findFirst.mockResolvedValue(openYear);
  yearExtension.count.mockResolvedValue(0);
});

describe("isYearClosed", () => {
  it("keeps the year open through its last day", () => {
    const year = { endDate: new Date("2027-07-02T00:00:00Z"), closedAt: null };
    expect(isYearClosed(year, new Date("2027-07-02T18:00:00Z"))).toBe(false);
    expect(isYearClosed(year, new Date("2027-07-03T00:00:00Z"))).toBe(true);
  });
  it("closes early when the ministry closed it", () => {
    expect(isYearClosed({ endDate: new Date("2027-07-02"), closedAt: new Date("2026-09-30") }, now)).toBe(true);
    expect(isYearClosed({ endDate: new Date("2027-07-02"), closedAt: new Date("2026-10-05") }, now)).toBe(false);
  });
});

describe("assertWritable", () => {
  it("lets an active school write in an open year", async () => {
    await expect(assertWritable({ schoolId: "s1", academicYearId: "y1", now })).resolves.toBeUndefined();
  });
  it("refuses a suspended school with its reason, and a closed school", async () => {
    school.findUnique.mockResolvedValueOnce({ status: "SUSPENDED", statusReason: "Enquête administrative" });
    await expect(assertWritable({ schoolId: "s1", academicYearId: "y1", now })).rejects.toThrow(/suspendu.*Enquête administrative/);
    school.findUnique.mockResolvedValueOnce({ status: "CLOSED", statusReason: "Fusion" });
    await expect(assertWritable({ schoolId: "s1", academicYearId: "y1", now })).rejects.toThrow(/fermé/);
  });
  it("refuses a closed year without an extension", async () => {
    academicYear.findUnique.mockResolvedValue(pastYear);
    await expect(assertWritable({ schoolId: "s1", academicYearId: "y0", now })).rejects.toThrow(/2025-2026 est close/);
  });
  it("accepts a closed year covered by an extension of the school or of every school", async () => {
    academicYear.findUnique.mockResolvedValue(pastYear);
    yearExtension.count.mockResolvedValue(1);
    await expect(assertWritable({ schoolId: "s1", academicYearId: "y0", now })).resolves.toBeUndefined();
    const where = yearExtension.count.mock.calls.at(-1)![0].where;
    expect(where).toMatchObject({ academicYearId: "y0", status: "ACTIVE", until: { gte: now }, OR: [{ schoolId: null }, { schoolId: "s1" }] });
  });
  it("checks the active year when no year is given", async () => {
    await assertWritable({ schoolId: null, now });
    expect(academicYear.findFirst).toHaveBeenCalled();
    expect(school.findUnique).not.toHaveBeenCalledWith(expect.objectContaining({ where: { id: null } }));
  });
});
