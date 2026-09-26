import { describe, expect, it, vi } from "vitest";

// The scope filters are the object level authorization of every query. These
// tests pin the cases that must fail closed.

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({ db: {} }));

const { assignmentWriteWhere, classroomWhere, enrollmentWhere, rosterClassroomWhere, schoolWhere } = await import("./scope");

type Fake = Parameters<typeof classroomWhere>[0];

function account(role: string, over: Partial<Record<"teacherId" | "guardianId" | "studentId", string | null>> & { level?: string; cycles?: string[] | null } = {}): Fake {
  return {
    id: "u",
    role: { id: "r", code: role, name: role },
    permissions: new Set(),
    scope: { level: over.level ?? "SCHOOL", departmentId: "d1", communeId: "c1", schoolId: "s1", label: "", cycles: over.cycles ?? null },
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

describe("class rosters", () => {
  it("never opens a whole class to a parent or a student", () => {
    const parent = account("PARENT", { level: "SELF", guardianId: "g1" });
    const student = account("STUDENT", { level: "SELF", studentId: "st1" });
    expect(rosterClassroomWhere(parent)).toEqual({ id: "__none__" });
    expect(rosterClassroomWhere(student)).toEqual({ id: "__none__" });
    // Their own child stays reachable through the enrollment filter.
    expect(enrollmentWhere(parent)).toEqual({ student: { guardians: { some: { guardianId: "g1" } } } });
  });

  it("matches the class scope for staff and teachers", () => {
    const director = account("SCHOOL_DIRECTOR");
    const teacher = account("TEACHER", { teacherId: "t1" });
    expect(rosterClassroomWhere(director)).toEqual(classroomWhere(director));
    expect(rosterClassroomWhere(teacher)).toEqual(classroomWhere(teacher));
  });
});

describe("administrative chains", () => {
  it("keeps a department without a chain on every school of the department", () => {
    expect(schoolWhere(account("DEPARTMENT_DIRECTOR", { level: "DEPARTMENT" }))).toEqual({ commune: { departmentId: "d1" } });
  });

  it("limits a DDEMP to nursery and primary schools, a DDESTFP to secondary ones", () => {
    const ddemp = account("DEPARTMENT_DIRECTOR", { level: "DEPARTMENT", cycles: ["PRESCHOOL", "PRIMARY"] });
    const ddestfp = account("DEPARTMENT_DIRECTOR", { level: "DEPARTMENT", cycles: ["SECONDARY", "TECHNICAL"] });
    expect(schoolWhere(ddemp)).toEqual({ commune: { departmentId: "d1" }, cycle: { in: ["PRESCHOOL", "PRIMARY"] } });
    expect(schoolWhere(ddestfp)).toEqual({ commune: { departmentId: "d1" }, cycle: { in: ["SECONDARY", "TECHNICAL"] } });
    // Classes and enrollments follow, since they compose the school filter.
    expect(classroomWhere(ddestfp)).toEqual({ school: schoolWhere(ddestfp) });
    expect(enrollmentWhere(ddemp)).toEqual({ school: schoolWhere(ddemp) });
  });

  it("limits a circonscription to the nursery and primary schools of its commune", () => {
    const district = account("COMMUNE_INSPECTOR", { level: "COMMUNE", cycles: ["PRESCHOOL", "PRIMARY"] });
    expect(schoolWhere(district)).toEqual({ communeId: "c1", cycle: { in: ["PRESCHOOL", "PRIMARY"] } });
  });

  it("still fails closed on an incomplete territory", () => {
    const lost = { ...account("DEPARTMENT_DIRECTOR", { level: "DEPARTMENT", cycles: ["SECONDARY"] }) };
    (lost.scope as { departmentId: string | null }).departmentId = null;
    expect(schoolWhere(lost)).toEqual({ id: "__none__" });
  });
});
