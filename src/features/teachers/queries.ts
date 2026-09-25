import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { getActiveYear } from "@/features/classes/academic";
import { schoolWhere } from "@/lib/auth/scope";
import type { CurrentUser } from "@/lib/auth/session";
import { db } from "@/lib/db";

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
  const [rows, total] = await Promise.all([
    db.teacher.findMany({
      where,
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      skip: opts.skip,
      take: opts.take,
      select: {
        id: true,
        matricule: true,
        firstName: true,
        lastName: true,
        phone: true,
        specialty: true,
        isActive: true,
        userId: true,
        school: { select: { name: true } },
        assignments: { where: { classroom: { academicYearId: year?.id ?? "__none__" } }, select: { weeklyHours: true, classroom: { select: { name: true } } } },
        mainClasses: { where: { academicYearId: year?.id ?? "__none__" }, select: { name: true } },
      },
    }),
    db.teacher.count({ where }),
  ]);
  return { rows, total };
}

export async function getTeacher(user: User, id: string) {
  const year = await getActiveYear();
  return db.teacher.findFirst({
    where: { AND: [{ id }, teacherWhere(user)] },
    include: {
      user: { select: { email: true, lastLoginAt: true } },
      school: { select: { name: true } },
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
