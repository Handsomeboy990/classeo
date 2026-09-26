import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";

import { ForbiddenError } from "./authorize";
import type { CurrentUser } from "./session";

// Territorial scope. Every query that reads or writes school data composes
// one of these filters, so a user can never reach a row outside their scope,
// whatever identifier they send. An impossible filter is used when a scope is
// incomplete, which fails closed.

type User = NonNullable<CurrentUser>;

const NOTHING = { id: "__none__" } as const;

// The administrative chain narrows a territory to the school cycles it
// supervises: a DDEMP and a circonscription reach nursery and primary
// schools, a DDESTFP secondary ones (lib/domain/chains.ts). No cycles, no
// narrowing: the ministry, a school, or an account without a chain.
export function chainWhere(user: User): Prisma.SchoolWhereInput {
  const cycles = user.scope.cycles;
  return cycles ? { cycle: { in: [...cycles] } } : {};
}

export function schoolWhere(user: User): Prisma.SchoolWhereInput {
  const s = user.scope;
  switch (s.level) {
    case "NATIONAL":
      return chainWhere(user);
    case "DEPARTMENT":
      return s.departmentId ? { commune: { departmentId: s.departmentId }, ...chainWhere(user) } : NOTHING;
    case "COMMUNE":
      return s.communeId ? { communeId: s.communeId, ...chainWhere(user) } : NOTHING;
    case "SCHOOL":
      return s.schoolId ? { id: s.schoolId } : NOTHING;
    case "SELF":
      if (user.guardianId)
        return { enrollments: { some: { student: { guardians: { some: { guardianId: user.guardianId } } } } } };
      if (user.studentId) return { enrollments: { some: { studentId: user.studentId } } };
      return NOTHING;
  }
}

export function communeWhere(user: User): Prisma.CommuneWhereInput {
  const s = user.scope;
  switch (s.level) {
    case "NATIONAL":
      return {};
    case "DEPARTMENT":
      return s.departmentId ? { departmentId: s.departmentId } : NOTHING;
    default:
      return s.communeId ? { id: s.communeId } : NOTHING;
  }
}

export function departmentWhere(user: User): Prisma.DepartmentWhereInput {
  const s = user.scope;
  if (s.level === "NATIONAL") return {};
  return s.departmentId ? { id: s.departmentId } : NOTHING;
}

// A teacher account is limited to its own classes. The limit follows the
// role, not the link to a teacher record: an account created with the
// teacher role but not yet linked to a record reaches no class at all,
// instead of falling back to the whole school.
export function isTeacherRole(user: Pick<User, "role">) {
  return user.role.code === "TEACHER";
}

function ownTeacherId(user: User) {
  return user.teacherId ?? "__none__";
}

// Classes a user may see. A teacher sees the classes they teach or lead.
export function classroomWhere(user: User): Prisma.ClassroomWhereInput {
  if (isTeacherRole(user))
    return {
      schoolId: user.scope.schoolId ?? "__none__",
      OR: [{ assignments: { some: { teacherId: ownTeacherId(user) } } }, { mainTeacherId: ownTeacherId(user) }],
    };
  if (user.scope.level === "SELF") return { enrollments: { some: enrollmentWhere(user) } };
  return { school: schoolWhere(user) };
}

// Classes whose whole roster a user may read: the grades, attendance and
// report cards of every student of the class. Families follow their own
// child through enrollmentWhere and never see the classmates.
export function rosterClassroomWhere(user: User): Prisma.ClassroomWhereInput {
  if (user.scope.level === "SELF") return NOTHING;
  return classroomWhere(user);
}

export function enrollmentWhere(user: User): Prisma.EnrollmentWhereInput {
  if (isTeacherRole(user)) return { classroom: classroomWhere(user) };
  if (user.scope.level === "SELF") {
    if (user.guardianId) return { student: { guardians: { some: { guardianId: user.guardianId } } } };
    if (user.studentId) return { studentId: user.studentId };
    return NOTHING;
  }
  return { school: schoolWhere(user) };
}

// Course assignments a user may write grades or attendance on. A teacher only
// on their own; school staff on their school.
export function assignmentWriteWhere(user: User): Prisma.CourseAssignmentWhereInput {
  if (isTeacherRole(user)) return { teacherId: ownTeacherId(user) };
  return { classroom: { school: schoolWhere(user) } };
}

export async function assertSchoolInScope(user: User, schoolId: string) {
  const found = await db.school.count({ where: { AND: [{ id: schoolId }, schoolWhere(user)] } });
  if (!found) throw new ForbiddenError("Cet établissement est hors de votre périmètre.");
}

// Stable key for caching data that depends on the scope, never on the user.
export function scopeKey(user: User) {
  const s = user.scope;
  switch (s.level) {
    case "NATIONAL":
      return "nation";
    case "DEPARTMENT":
      return `dep:${s.departmentId}`;
    case "COMMUNE":
      return `com:${s.communeId}`;
    case "SCHOOL":
      return `sch:${s.schoolId}`;
    case "SELF":
      return `self:${user.id}`;
  }
}
