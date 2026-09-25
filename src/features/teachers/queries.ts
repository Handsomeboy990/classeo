import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { getActiveYear } from "@/features/classes/academic";
import { schoolWhere } from "@/lib/auth/scope";
import type { CurrentUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { sortByName } from "@/lib/utils";

type User = NonNullable<CurrentUser>;

export function teacherWhere(user: User): Prisma.TeacherWhereInput {
  return { school: schoolWhere(user) };
}

export async function listTeachers(user: User, opts: { q: string; active: boolean | null; skip: number; take: number }) {
  const year = await getActiveYear();
  const where: Prisma.TeacherWhereInput = {
    AND: [
      teacherWhere(user),
      opts.active === null ? {} : { isActive: opts.active },
      opts.q
        ? {
            OR: [
              { lastName: { contains: opts.q, mode: "insensitive" } },
              { firstName: { contains: opts.q, mode: "insensitive" } },
              { matricule: { contains: opts.q, mode: "insensitive" } },
              { specialty: { contains: opts.q, mode: "insensitive" } },
            ],
          }
        : {},
    ],
  };
  // French alphabetical order whatever the database collation: the names of
  // every matching teacher are sorted here, then only the requested page is
  // loaded in full (see listStudents).
  const keys = sortByName(await db.teacher.findMany({ where, orderBy: { id: "asc" }, select: { id: true, lastName: true, firstName: true } }), (t) => t);
  const pageIds = keys.slice(opts.skip, opts.skip + opts.take).map((k) => k.id);
  const position = new Map(pageIds.map((id, i) => [id, i]));
  const page = await db.teacher.findMany({
    where: { id: { in: pageIds } },
    select: {
      id: true,
      matricule: true,
      firstName: true,
      lastName: true,
      phone: true,
      specialty: true,
      isActive: true,
      userId: true,
      schoolId: true,
      school: { select: { name: true } },
      // The person's other appointments, from the national registry.
      profile: { select: { npi: true, teachers: { where: { isActive: true }, select: { schoolId: true, school: { select: { name: true } } } } } },
      assignments: { where: { classroom: { academicYearId: year?.id ?? "__none__" } }, select: { weeklyHours: true, classroom: { select: { name: true } } } },
      mainClasses: { where: { academicYearId: year?.id ?? "__none__" }, select: { name: true } },
    },
  });
  const rows = page.sort((a, b) => position.get(a.id)! - position.get(b.id)!);
  return { rows, total: keys.length };
}

export async function getTeacher(user: User, id: string) {
  const year = await getActiveYear();
  return db.teacher.findFirst({
    where: { AND: [{ id }, teacherWhere(user)] },
    include: {
      user: { select: { username: true, email: true, lastLoginAt: true } },
      school: { select: { name: true } },
      profile: { select: { npi: true, teachers: { where: { isActive: true }, select: { id: true, schoolId: true, school: { select: { name: true } } } } } },
      assignments: {
        where: { classroom: { academicYearId: year?.id ?? "__none__" } },
        orderBy: [{ classroom: { level: { order: "asc" } } }, { classroom: { name: "asc" } }],
        include: {
          subject: true,
          classroom: { select: { id: true, name: true, _count: { select: { enrollments: { where: { status: "ACTIVE" } } } } } },
          gradeSheets: { select: { id: true, isLocked: true, period: { select: { name: true } } }, orderBy: { period: { order: "asc" } } },
        },
      },
      mainClasses: { where: { academicYearId: year?.id ?? "__none__" }, select: { id: true, name: true } },
      attendances: { orderBy: { date: "desc" }, take: 10, select: { date: true, status: true, reason: true } },
    },
  });
}
