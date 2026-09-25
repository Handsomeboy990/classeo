import { describe, expect, it, vi } from "vitest";

// The scope filters are the object level authorization of every query. These
// tests pin the cases that must fail closed.

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({ db: {} }));

const { assignmentWriteWhere, classroomWhere, enrollmentWhere } = await import("./scope");

type Fake = Parameters<typeof classroomWhere>[0];

function account(role: string, over: Partial<Record<"teacherId" | "guardianId" | "studentId", string | null>> & { level?: string } = {}): Fake {
  return {
    id: "u",
    role: { id: "r", code: role, name: role },
    permissions: new Set(),
    scope: { level: over.level ?? "SCHOOL", departmentId: "d1", communeId: "c1", schoolId: "s1", label: "" },
    teacherId: over.teacherId ?? null,
    guardianId: over.guardianId ?? null,
    studentId: over.studentId ?? null,
  } as unknown as Fake;
}

// True when the filter can only match rows tied to the given teacher id.
function limitedToTeacher(where: unknown, teacherId: string) {
  const json = JSON.stringify(where);
  return json.includes(`"teacherId":"${teacherId}"`) && !json.includes('"school":{"id":"s1"}');
}

describe("teacher accounts", () => {
  it("limits a linked teacher to their own classes and assignments", () => {
    const teacher = account("TEACHER", { teacherId: "t1" });
    expect(limitedToTeacher(classroomWhere(teacher), "t1")).toBe(true);
    expect(limitedToTeacher(enrollmentWhere(teacher), "t1")).toBe(true);
    expect(assignmentWriteWhere(teacher)).toEqual({ teacherId: "t1" });
  });

  it("gives an unlinked teacher account no class instead of the whole school", () => {
    const unlinked = account("TEACHER");
    expect(limitedToTeacher(classroomWhere(unlinked), "__none__")).toBe(true);
    expect(limitedToTeacher(enrollmentWhere(unlinked), "__none__")).toBe(true);
    expect(assignmentWriteWhere(unlinked)).toEqual({ teacherId: "__none__" });
  });

  it("keeps school staff on their whole school", () => {
    const director = account("SCHOOL_DIRECTOR");
    expect(classroomWhere(director)).toEqual({ school: { id: "s1" } });
    expect(assignmentWriteWhere(director)).toEqual({ classroom: { school: { id: "s1" } } });
  });
});
