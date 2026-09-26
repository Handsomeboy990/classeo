import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { schoolWhere } from "@/lib/auth/scope";
import type { CurrentUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { param, type SearchParams } from "@/lib/list";

import { isSchoolStatus, type SchoolStatus } from "../school-status/labels";
import { isCycle, isSector, type Cycle, type Sector } from "./labels";

type User = NonNullable<CurrentUser>;

export type SchoolFilters = {
  q: string;
  departmentId: string | null;
  communeId: string | null;
  sector: Sector | null;
  cycle: Cycle | null;
  status: SchoolStatus | null;
};

export function schoolFilters(sp: SearchParams): SchoolFilters {
  const statut = param(sp, "statut");
  return {
    q: (param(sp, "q") ?? "").trim().slice(0, 100),
    departmentId: param(sp, "departement") || null,
    communeId: param(sp, "commune") || null,
    sector: isSector(param(sp, "secteur")) ? (param(sp, "secteur") as Sector) : null,
    cycle: isCycle(param(sp, "cycle")) ? (param(sp, "cycle") as Cycle) : null,
    status: isSchoolStatus(statut) ? statut : null,
  };
}

// The user's scope always comes first: filters only narrow it.
export function schoolListWhere(user: User, f: SchoolFilters): Prisma.SchoolWhereInput {
  const and: Prisma.SchoolWhereInput[] = [schoolWhere(user)];
  if (f.q) and.push({ OR: [{ name: { contains: f.q, mode: "insensitive" } }, { code: { contains: f.q, mode: "insensitive" } }] });
  if (f.departmentId) and.push({ commune: { departmentId: f.departmentId } });
  if (f.communeId) and.push({ communeId: f.communeId });
  if (f.sector) and.push({ sector: f.sector });
  if (f.cycle) and.push({ cycle: f.cycle });
  if (f.status) and.push({ status: f.status });
  return { AND: and };
}

const listSelect = {
  id: true,
  code: true,
  name: true,
  sector: true,
  cycle: true,
  isActive: true,
  status: true,
  statusReason: true,
  statusChangedAt: true,
  address: true,
  phone: true,
  email: true,
  communeId: true,
  commune: { select: { name: true, department: { select: { name: true } } } },
} as const;

export async function listSchools(user: User, f: SchoolFilters, page: { skip: number; take: number }) {
  const where = schoolListWhere(user, f);
  const [rows, total] = await Promise.all([
    db.school.findMany({ where, select: listSelect, orderBy: [{ name: "asc" }], skip: page.skip, take: page.take }),
    db.school.count({ where }),
  ]);
  return { rows, total };
}

// Bounded export of the same list.
export function exportSchools(user: User, f: SchoolFilters) {
  return db.school.findMany({ where: schoolListWhere(user, f), select: listSelect, orderBy: [{ name: "asc" }], take: 5000 });
}

// Detail of a school. The caller has checked it is inside the user's scope;
// the scoped where is applied again so this function is safe on its own.
// yearId: the year whose classes are listed (closed years stay readable).
export async function getSchoolDetail(user: User, id: string, yearId: string | null) {
  const school = await db.school.findFirst({
    where: { AND: [{ id }, schoolWhere(user)] },
    select: { ...listSelect, latitude: true, longitude: true, createdAt: true, updatedAt: true, motto: true, website: true, postalBox: true, logoFileId: true, periodicity: true, allowsComposition: true, denomination: true, isBilingual: true, authorizationRef: true, authorizationDate: true, promoter: true },
  });
  if (!school) return null;
  const [classes, staffUsers, teachers, director] = await Promise.all([
    db.classroom.findMany({
      where: { schoolId: id, academicYearId: yearId ?? "__none__" },
      select: {
        id: true,
        name: true,
        capacity: true,
        level: { select: { name: true, order: true } },
        mainTeacher: { select: { firstName: true, lastName: true } },
        _count: { select: { enrollments: { where: { status: "ACTIVE" } } } },
      },
      orderBy: [{ level: { order: "asc" } }, { name: "asc" }],
    }),
    db.user.count({ where: { schoolId: id, isActive: true } }),
    db.teacher.count({ where: { schoolId: id, isActive: true } }),
    db.user.findFirst({
      where: { schoolId: id, role: { code: "SCHOOL_DIRECTOR" }, isActive: true },
      select: { firstName: true, lastName: true, email: true, phone: true },
      orderBy: { createdAt: "asc" },
    }),
  ]);
  return { school, classes, staffUsers, teachers, director };
}

// Communes the user may attach a school to, grouped for a select.
export async function communeOptions(user: User) {
  const s = user.scope;
  const where: Prisma.CommuneWhereInput =
    s.level === "NATIONAL" ? {} : s.level === "DEPARTMENT" ? { departmentId: s.departmentId ?? "__none__" } : { id: s.communeId ?? "__none__" };
  return db.commune.findMany({
    where,
    select: { id: true, name: true, department: { select: { id: true, name: true } } },
    orderBy: [{ department: { name: "asc" } }, { name: "asc" }],
  });
}
