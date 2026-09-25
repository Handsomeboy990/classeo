import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { getActiveYear } from "@/features/classes/academic";
import { studentWhere } from "@/features/students/queries";
import { enrollmentWhere } from "@/lib/auth/scope";
import type { CurrentUser } from "@/lib/auth/session";
import { db } from "@/lib/db";

type User = NonNullable<CurrentUser>;

// Guardians have no school of their own: they are in scope through a child
// the user can see.
export function guardianWhere(user: User): Prisma.GuardianWhereInput {
  return { students: { some: { student: studentWhere(user) } } };
}

export async function listGuardians(user: User, opts: { q: string; skip: number; take: number }) {
  const where: Prisma.GuardianWhereInput = {
    AND: [
      guardianWhere(user),
      opts.q
        ? {
            OR: [
              { lastName: { contains: opts.q, mode: "insensitive" } },
              { firstName: { contains: opts.q, mode: "insensitive" } },
              { phone: { contains: opts.q.replace(/\s/g, "") } },
              { students: { some: { student: { lastName: { contains: opts.q, mode: "insensitive" } } } } },
            ],
          }
        : {},
    ],
  };
  const [rows, total] = await Promise.all([
    db.guardian.findMany({
      where,
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      skip: opts.skip,
      take: opts.take,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        phone: true,
        preferredChannel: true,
        prefersAudio: true,
        userId: true,
        students: { where: { student: studentWhere(user) }, select: { relationship: true, student: { select: { id: true, firstName: true, lastName: true } } } },
      },
    }),
    db.guardian.count({ where }),
  ]);
  return { rows, total };
}

export async function getGuardian(user: User, id: string) {
  const year = await getActiveYear();
  return db.guardian.findFirst({
    where: { AND: [{ id }, guardianWhere(user)] },
    include: {
      user: { select: { email: true, lastLoginAt: true } },
      students: {
        where: { student: studentWhere(user) },
        include: {
          student: {
            select: {
              id: true,
              matricule: true,
              firstName: true,
              lastName: true,
              _count: { select: { guardians: true } },
              enrollments: {
                where: { AND: [enrollmentWhere(user), { academicYearId: year?.id ?? "__none__" }] },
                select: { status: true, classroom: { select: { id: true, name: true } } },
              },
            },
          },
        },
      },
    },
  });
}

// Students of the active year the user may link to a guardian.
export async function studentChoices(user: User) {
  const year = await getActiveYear();
  return db.enrollment.findMany({
    where: { AND: [enrollmentWhere(user), { academicYearId: year?.id ?? "__none__", status: "ACTIVE" }] },
    orderBy: [{ student: { lastName: "asc" } }, { student: { firstName: "asc" } }],
    select: { student: { select: { id: true, firstName: true, lastName: true, matricule: true } }, classroom: { select: { name: true } } },
    take: 1500,
  });
}
