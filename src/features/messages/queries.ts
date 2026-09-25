import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { enrollmentWhere, schoolWhere } from "@/lib/auth/scope";
import type { CurrentUser } from "@/lib/auth/session";
import { db } from "@/lib/db";

import { activeYearId } from "../contents/queries";

type User = NonNullable<CurrentUser>;

export type Contact = { id: string; name: string; group: string; detail: string };

const contactSelect = {
  id: true,
  firstName: true,
  lastName: true,
  role: { select: { name: true } },
  school: { select: { name: true } },
} satisfies Prisma.UserSelect;

type ContactRow = Prisma.UserGetPayload<{ select: typeof contactSelect }>;

// A director is identified by what they may do, not by a role name: school
// level accounts allowed to manage the school.
const isDirector: Prisma.UserWhereInput = { scopeLevel: "SCHOOL", role: { permissions: { some: { permission: { code: "school:update" } } } } };

const LIMIT = 300;

async function users(where: Prisma.UserWhereInput, group: (u: ContactRow) => string): Promise<Contact[]> {
  const rows = await db.user.findMany({ where: { AND: [where, { isActive: true }] }, select: contactSelect, orderBy: [{ lastName: "asc" }, { firstName: "asc" }], take: LIMIT });
  return rows.map((u) => ({ id: u.id, name: `${u.firstName} ${u.lastName}`, group: group(u), detail: [u.role.name, u.school?.name].filter(Boolean).join(", ") }));
}

// Who the user may start a conversation with.
// - parent: teachers of their children's classes and directors of those schools
// - student: teachers of their class
// - teacher: guardians of their students and staff of their school
// - school staff: users of their school and guardians of its students
// - commune, department, nation: school directors in their scope
export async function allowedContacts(user: User): Promise<Contact[]> {
  const yearId = await activeYearId();
  const notMe = { id: { not: user.id } };
  const byRole = (u: ContactRow) => u.role.name;
  let lists: Contact[][] = [];

  if (user.scope.level === "SELF") {
    const who: Prisma.EnrollmentWhereInput | null = user.guardianId
      ? { student: { guardians: { some: { guardianId: user.guardianId } } } }
      : user.studentId
        ? { studentId: user.studentId }
        : null;
    if (!who) return [];
    const enrollments = await db.enrollment.findMany({ where: { AND: [who, { academicYearId: yearId, status: "ACTIVE" }] }, select: { classroomId: true, schoolId: true } });
    const classroomIds = enrollments.map((e) => e.classroomId);
    const schoolIds = [...new Set(enrollments.map((e) => e.schoolId))];
    if (!classroomIds.length) return [];
    const teachers = users(
      { AND: [notMe, { teacher: { OR: [{ assignments: { some: { classroomId: { in: classroomIds } } } }, { mainClasses: { some: { id: { in: classroomIds } } } }] } }] },
      () => "Enseignants",
    );
    lists = await Promise.all(user.guardianId ? [teachers, users({ AND: [notMe, isDirector, { schoolId: { in: schoolIds } }] }, () => "Direction")] : [teachers]);
  } else if (user.scope.level === "SCHOOL") {
    const schoolId = user.scope.schoolId ?? "__none__";
    const guardianWhere: Prisma.UserWhereInput = {
      guardian: { students: { some: { student: { enrollments: { some: { AND: [enrollmentWhere(user), { academicYearId: yearId, status: "ACTIVE" }] } } } } } },
    };
    lists = await Promise.all([
      users({ AND: [notMe, { schoolId, scopeLevel: "SCHOOL" }] }, byRole),
      users(guardianWhere, () => (user.teacherId ? "Parents de vos élèves" : "Parents d'élèves")),
    ]);
  } else {
    lists = [await users({ AND: [notMe, isDirector, { school: schoolWhere(user) }] }, () => "Chefs d'établissement")];
  }

  const seen = new Set<string>();
  return lists.flat().filter((c) => (seen.has(c.id) ? false : (seen.add(c.id), true)));
}

export async function listConversations(user: User) {
  return db.conversation.findMany({
    where: { participants: { some: { userId: user.id } } },
    orderBy: { updatedAt: "desc" },
    take: 100,
    include: {
      participants: { select: { userId: true, lastReadAt: true, user: { select: { firstName: true, lastName: true, gender: true, role: { select: { name: true } } } } } },
      messages: { orderBy: { createdAt: "desc" }, take: 1, select: { body: true, createdAt: true, senderId: true } },
    },
  });
}

// Only a participant can reach a thread: the filter is part of the lookup.
export async function getThread(user: User, id: string) {
  return db.conversation.findFirst({
    where: { id, participants: { some: { userId: user.id } } },
    include: {
      participants: { select: { userId: true, lastReadAt: true, user: { select: { firstName: true, lastName: true, gender: true, role: { select: { name: true } }, school: { select: { name: true } } } } } },
      messages: {
        orderBy: { createdAt: "desc" },
        take: 200,
        select: { id: true, body: true, createdAt: true, senderId: true, sender: { select: { firstName: true, lastName: true } } },
      },
    },
  });
}

export async function markThreadRead(user: User, conversationId: string) {
  const now = new Date();
  await db.$transaction([
    db.conversationParticipant.update({ where: { conversationId_userId: { conversationId, userId: user.id } }, data: { lastReadAt: now } }),
    db.notification.updateMany({ where: { userId: user.id, readAt: null, link: `/espace/messages/${conversationId}` }, data: { readAt: now } }),
  ]);
}
