import "server-only";

import type { CurrentUser } from "@/lib/auth/session";
import { db } from "@/lib/db";

// Names the translation layer must keep as they are and treat as values of
// a template ("Bulletin de Sènami" is looked up as "Bulletin de 2"): the
// reader, the children they follow and their other guardians, the classes,
// schools and places of those children, their teachers and the staff of
// those schools (who sign report cards and receipts, publish
// announcements), and the people the reader exchanges messages with.
export async function namesFor(user: NonNullable<CurrentUser>): Promise<string[]> {
  const [enrollments, contacts] = await Promise.all([
    db.enrollment.findMany({
      where: {
        academicYear: { isActive: true },
        status: "ACTIVE",
        student: { OR: [{ userId: user.id }, { guardians: { some: { guardian: { userId: user.id } } } }] },
      },
      select: {
        student: { select: { firstName: true, lastName: true, birthPlace: true, guardians: { select: { guardian: { select: { firstName: true, lastName: true } } } } } },
        classroom: {
          select: {
            name: true,
            mainTeacher: { select: { firstName: true, lastName: true } },
            assignments: { select: { teacher: { select: { firstName: true, lastName: true } } } },
          },
        },
        school: { select: { id: true, name: true, commune: { select: { name: true, department: { select: { name: true } } } } } },
      },
      take: 20,
    }),
    db.conversationParticipant.findMany({
      where: { userId: { not: user.id }, conversation: { participants: { some: { userId: user.id } } } },
      select: { user: { select: { firstName: true, lastName: true } } },
      take: 200,
    }),
  ]);
  const staff = await db.user.findMany({
    where: { scopeLevel: "SCHOOL", schoolId: { in: [...new Set(enrollments.map((e) => e.school.id))] } },
    select: { firstName: true, lastName: true },
    take: 300,
  });
  const people: { firstName: string; lastName: string }[] = [user, ...contacts.map((c) => c.user), ...staff];
  const places: string[] = [];
  for (const e of enrollments) {
    people.push(e.student, ...e.student.guardians.map((g) => g.guardian));
    if (e.classroom.mainTeacher) people.push(e.classroom.mainTeacher);
    for (const a of e.classroom.assignments) if (a.teacher) people.push(a.teacher);
    places.push(e.classroom.name, e.school.name, e.school.commune.name, e.school.commune.department.name);
    if (e.student.birthPlace) places.push(e.student.birthPlace);
  }
  const out = new Set(places);
  for (const p of people) {
    // "Sènami Hounkpatin", "HOUNKPATIN Sènami" on documents, and each part.
    out.add(`${p.firstName} ${p.lastName}`);
    out.add(`${p.lastName.toUpperCase()} ${p.firstName}`);
    out.add(`${p.lastName} ${p.firstName}`);
    out.add(p.firstName);
    out.add(p.lastName);
    out.add(p.lastName.toUpperCase());
  }
  return [...out].sort();
}
