import { beforeEach, describe, expect, it, vi } from "vitest";

// The student file lookup must never reach a student outside the user's
// scope, whatever identifier is sent (IDOR). The database is replaced by a
// fake that records the filter and applies it to a tiny data set.

vi.mock("server-only", () => ({}));

type Row = { id: string; studentId: string; academicYearId: string; guardianIds: string[] };
const rows: Row[] = [
  { id: "e1", studentId: "senami", academicYearId: "y", guardianIds: ["g-afiavi"] },
  { id: "e2", studentId: "mahougnon", academicYearId: "y", guardianIds: ["g-afiavi"] },
  { id: "e3", studentId: "stranger", academicYearId: "y", guardianIds: ["g-other"] },
];

// Evaluates the subset of Prisma filters the scope layer produces.
function matches(row: Row, where: Record<string, unknown>): boolean {
  return Object.entries(where).every(([key, value]) => {
    if (key === "AND") return (value as Record<string, unknown>[]).every((w) => matches(row, w));
    if (key === "id") return row.id === value;
    if (key === "studentId") return row.studentId === value;
    if (key === "academicYearId") return row.academicYearId === value;
    if (key === "student") {
      const gid = (value as { guardians: { some: { guardianId: string } } }).guardians.some.guardianId;
      return row.guardianIds.includes(gid);
    }
    throw new Error(`Unexpected filter ${key}`);
  });
}

const calls: unknown[] = [];
vi.mock("@/lib/db", () => ({
  db: {
    academicYear: { findFirst: vi.fn(async () => ({ id: "y", periods: [] })) },
    enrollment: {
      findFirst: vi.fn(async ({ where }: { where: Record<string, unknown> }) => {
        calls.push(where);
        return rows.find((r) => matches(r, where)) ?? null;
      }),
    },
  },
}));

const { scopedEnrollment } = await import("./queries");

const base = {
  id: "u",
  role: { id: "r", code: "PARENT", name: "Parent" },
  permissions: new Set(),
  scope: { level: "SELF", departmentId: null, communeId: null, schoolId: null, label: "" },
  teacherId: null,
} as const;
const parent = { ...base, guardianId: "g-afiavi", studentId: null } as never;
const student = { ...base, role: { id: "r", code: "STUDENT", name: "Élève" }, guardianId: null, studentId: "senami" } as never;

describe("scopedEnrollment (IDOR guard)", () => {
  beforeEach(() => {
    calls.length = 0;
  });

  it("lets a parent open each of their children", async () => {
    expect((await scopedEnrollment(parent, "senami"))?.id).toBe("e1");
    expect((await scopedEnrollment(parent, "mahougnon"))?.id).toBe("e2");
  });

  it("refuses a parent another family's child", async () => {
    expect(await scopedEnrollment(parent, "stranger")).toBeNull();
    expect(JSON.stringify(calls[0])).toContain("g-afiavi");
  });

  it("lets a student open only their own file", async () => {
    expect((await scopedEnrollment(student, "senami"))?.id).toBe("e1");
    expect(await scopedEnrollment(student, "mahougnon")).toBeNull();
  });

  it("fails closed for a family account without a link", async () => {
    const orphan = { ...base, guardianId: null, studentId: null } as never;
    expect(await scopedEnrollment(orphan, "senami")).toBeNull();
  });
});
