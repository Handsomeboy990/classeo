import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { classroomWhere, rosterClassroomWhere, schoolWhere } from "@/lib/auth/scope";
import type { CurrentUser } from "@/lib/auth/session";
import { db } from "@/lib/db";

import { getActiveYear } from "./academic";

type User = NonNullable<CurrentUser>;

// Classes of the active year the user may see.
export async function activeClassroomWhere(user: User): Promise<Prisma.ClassroomWhereInput> {
  const year = await getActiveYear();
  return { AND: [classroomWhere(user), { academicYearId: year?.id ?? "__none__" }] };
}

export async function listClassrooms(user: User, opts: { q: string; levelId?: string; skip: number; take: number }) {
  const where: Prisma.ClassroomWhereInput = {
    AND: [
      await activeClassroomWhere(user),
      opts.q ? { OR: [{ name: { contains: opts.q, mode: "insensitive" } }, { school: { name: { contains: opts.q, mode: "insensitive" } } }] } : {},
      opts.levelId ? { levelId: opts.levelId } : {},
    ],
  };
  const [rows, total] = await Promise.all([
    db.classroom.findMany({
      where,
      orderBy: [{ school: { name: "asc" } }, { level: { order: "asc" } }, { name: "asc" }],
      skip: opts.skip,
      take: opts.take,
      select: {
        id: true,
        name: true,
        capacity: true,
        school: { select: { name: true } },
        level: { select: { id: true, name: true } },
        mainTeacher: { select: { id: true, firstName: true, lastName: true } },
        _count: { select: { enrollments: { where: { status: "ACTIVE" } }, assignments: true } },
      },
    }),
    db.classroom.count({ where }),
  ]);
  return { rows, total };
}

// Simple list for selectors (attendance, report cards, student forms).
export async function classroomOptions(user: User) {
  return db.classroom.findMany({
    where: await activeClassroomWhere(user),
    orderBy: [{ level: { order: "asc" } }, { name: "asc" }],
    select: { id: true, name: true, capacity: true, school: { select: { name: true } }, _count: { select: { enrollments: { where: { status: "ACTIVE" } } } } },
    take: 500,
  });
}

export async function getClassroom(user: User, id: string) {
  return db.classroom.findFirst({
    where: { AND: [{ id }, rosterClassroomWhere(user)] },
    include: {
      school: { select: { id: true, name: true, cycle: true } },
      academicYear: { select: { id: true, label: true, isActive: true } },
      level: true,
      mainTeacher: { select: { id: true, firstName: true, lastName: true, phone: true } },
      assignments: {
        orderBy: [{ coefficient: "desc" }, { subject: { name: "asc" } }],
        include: { subject: true, teacher: { select: { id: true, firstName: true, lastName: true } }, _count: { select: { gradeSheets: true } } },
      },
      enrollments: {
        where: { status: "ACTIVE" },
        orderBy: [{ student: { lastName: "asc" } }, { student: { firstName: "asc" } }],
        select: {
          id: true,
          isRepeating: true,
          student: { select: { id: true, matricule: true, firstName: true, lastName: true, gender: true, birthDate: true, disabilities: true } },
        },
      },
    },
  });
}

// Reference data for the class and assignment forms, limited to the user's
// school.
export async function classFormOptions(user: User) {
  const schoolId = user.scope.schoolId;
  if (!schoolId) return { levels: [], teachers: [], subjects: [] };
  const school = await db.school.findFirst({ where: { AND: [{ id: schoolId }, schoolWhere(user)] }, select: { cycle: true } });
  if (!school) return { levels: [], teachers: [], subjects: [] };
  const [levels, teachers, usedSubjects] = await Promise.all([
    db.academicLevel.findMany({ where: { cycle: school.cycle }, orderBy: { order: "asc" } }),
    db.teacher.findMany({
      where: { schoolId, isActive: true },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      select: { id: true, firstName: true, lastName: true, specialty: true },
    }),
    // Subjects taught in schools of the same cycle: primary and secondary
    // curricula differ.
    db.subject.findMany({ where: { status: "APPROVED", assignments: { some: { classroom: { school: { cycle: school.cycle } } } } }, orderBy: { name: "asc" } }),
  ]);
  const subjects = usedSubjects.length ? usedSubjects : await db.subject.findMany({ where: { status: "APPROVED" }, orderBy: { name: "asc" } });
  return { levels, teachers, subjects };
}
