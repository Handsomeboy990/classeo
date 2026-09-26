import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { schoolWhere } from "@/lib/auth/scope";
import type { CurrentUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { param, type SearchParams } from "@/lib/list";

import { maskPhone, SQL_ACCENTS_FROM, SQL_ACCENTS_TO, type RegistryQuery } from "./registry-rules";

type User = NonNullable<CurrentUser>;

// Profiles matching a registry search, accent insensitive on names. The
// query is parameterised; the patterns are escaped by parseRegistryQuery.
async function matchingProfileIds(q: RegistryQuery, take: number) {
  const patterns = q.names.map((n) => `%${n}%`);
  const rows = await db.$queryRaw<{ id: string }[]>`
    SELECT p.id
    FROM "TeacherProfile" p
    WHERE (${q.npi}::text IS NOT NULL AND p.npi = ${q.npi}::text)
       OR (${q.phone}::text IS NOT NULL AND right(regexp_replace(coalesce(p.phone, ''), '\\D', '', 'g'), 8) = ${q.phone}::text)
       OR (cardinality(${patterns}::text[]) > 0
           AND translate(lower(p."firstName" || ' ' || p."lastName"), ${SQL_ACCENTS_FROM}, ${SQL_ACCENTS_TO}) LIKE ALL (${patterns}::text[]))
    ORDER BY p."lastName", p."firstName"
    LIMIT ${take}`;
  return rows.map((r) => r.id);
}

export type RegistryMatch = Awaited<ReturnType<typeof searchRegistry>>[number];

// What a school head sees of a registry entry before appointing: names, NPI,
// a masked phone and the schools where the person teaches. Nothing else.
export async function searchRegistry(q: RegistryQuery, schoolId: string) {
  const ids = await matchingProfileIds(q, 10);
  if (!ids.length) return [];
  const profiles = await db.teacherProfile.findMany({
    where: { id: { in: ids } },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      gender: true,
      npi: true,
      phone: true,
      userId: true,
      stateStatus: true,
      teachers: { select: { schoolId: true, isActive: true, specialty: true, school: { select: { name: true, commune: { select: { name: true } } } } } },
    },
  });
  const order = new Map(ids.map((id, i) => [id, i]));
  return profiles
    .sort((a, b) => order.get(a.id)! - order.get(b.id)!)
    .map((p) => ({
      id: p.id,
      firstName: p.firstName,
      lastName: p.lastName,
      gender: p.gender,
      npi: p.npi,
      phone: maskPhone(p.phone),
      hasAccount: !!p.userId,
      stateStatus: p.stateStatus,
      specialty: p.teachers.find((t) => t.specialty)?.specialty ?? null,
      schools: p.teachers.filter((t) => t.isActive).map((t) => `${t.school.name} (${t.school.commune.name})`),
      // Appointed here already, active or not.
      here: p.teachers.find((t) => t.schoolId === schoolId) ? (p.teachers.find((t) => t.schoolId === schoolId)!.isActive ? "active" : "inactive") : null,
    }));
}

export type RegistryFilters = { q: string; departmentId: string | null; communeId: string | null; multi: boolean };

export function registryFilters(sp: SearchParams): RegistryFilters {
  return {
    q: (param(sp, "q") ?? "").trim().slice(0, 100),
    departmentId: param(sp, "departement") || null,
    communeId: param(sp, "commune") || null,
    multi: param(sp, "plusieurs") === "oui",
  };
}

// Active appointments inside the viewer's territory, narrowed by the filters
// (which can only narrow: they are combined with the scope).
function appointmentWhere(user: User, f: RegistryFilters): Prisma.TeacherWhereInput {
  return {
    isActive: true,
    school: {
      AND: [schoolWhere(user), f.departmentId ? { commune: { departmentId: f.departmentId } } : {}, f.communeId ? { communeId: f.communeId } : {}],
    },
  };
}

async function registryWhere(user: User, f: RegistryFilters): Promise<Prisma.TeacherProfileWhereInput> {
  // The ministry also sees the agents of the State it has recorded and who
  // are not appointed anywhere yet.
  const unappointed = user.scope.level === "NATIONAL" && !f.departmentId && !f.communeId && !f.multi;
  const and: Prisma.TeacherProfileWhereInput[] = [
    unappointed ? { OR: [{ teachers: { some: appointmentWhere(user, f) } }, { stateStatus: { not: null }, teachers: { none: { isActive: true } } }] } : { teachers: { some: appointmentWhere(user, f) } },
  ];
  if (f.q)
    and.push({
      OR: [
        { lastName: { contains: f.q, mode: "insensitive" } },
        { firstName: { contains: f.q, mode: "insensitive" } },
        { npi: { contains: f.q } },
        { stateMatricule: { contains: f.q.toUpperCase() } },
      ],
    });
  if (f.multi) {
    // People appointed in more than one school, wherever the schools are.
    const rows = await db.$queryRaw<{ profileId: string }[]>`
      SELECT "profileId" FROM "Teacher"
      WHERE "isActive" AND "profileId" IS NOT NULL
      GROUP BY "profileId" HAVING count(DISTINCT "schoolId") > 1`;
    and.push({ id: { in: rows.map((r) => r.profileId) } });
  }
  return { AND: and };
}

function registrySelect(user: User, f: RegistryFilters) {
  return {
    id: true,
    npi: true,
    firstName: true,
    lastName: true,
    gender: true,
    phone: true,
    userId: true,
    stateStatus: true,
    stateMatricule: true,
    teachers: {
      where: appointmentWhere(user, { ...f, departmentId: null, communeId: null }),
      select: { id: true, matricule: true, specialty: true, school: { select: { id: true, name: true, commune: { select: { name: true, department: { select: { name: true } } } } } } },
      orderBy: { school: { name: "asc" } },
    },
    _count: { select: { teachers: { where: { isActive: true } } } },
  } satisfies Prisma.TeacherProfileSelect;
}

export async function listRegistry(user: User, f: RegistryFilters, page: { skip: number; take: number }) {
  const where = await registryWhere(user, f);
  const [rows, total] = await Promise.all([
    db.teacherProfile.findMany({ where, select: registrySelect(user, f), orderBy: [{ lastName: "asc" }, { firstName: "asc" }], skip: page.skip, take: page.take }),
    db.teacherProfile.count({ where }),
  ]);
  return { rows, total };
}

export async function exportRegistry(user: User, f: RegistryFilters) {
  const where = await registryWhere(user, f);
  return db.teacherProfile.findMany({ where, select: registrySelect(user, f), orderBy: [{ lastName: "asc" }, { firstName: "asc" }], take: 20000 });
}

// Filter options: departments and communes of the viewer's territory.
export async function registryFilterOptions(user: User) {
  const s = user.scope;
  const [departments, communes] = await Promise.all([
    s.level === "NATIONAL" ? db.department.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }) : Promise.resolve([]),
    s.level === "NATIONAL" || s.level === "DEPARTMENT"
      ? db.commune.findMany({
          where: s.level === "NATIONAL" ? {} : { departmentId: s.departmentId ?? "__none__" },
          select: { id: true, name: true, department: { select: { name: true } } },
          orderBy: [{ department: { name: "asc" } }, { name: "asc" }],
        })
      : Promise.resolve([]),
  ]);
  return {
    departments: departments.map((d) => ({ value: d.id, label: d.name })),
    communes: communes.map((c) => ({ value: c.id, label: c.name, group: c.department.name })),
  };
}
