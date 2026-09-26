import type { PrismaClient } from "../../src/generated/prisma/client";

import type { SeedContext } from "./index";

// Identity and delegation demonstration data. Deterministic: every value is
// derived from rows the main seed already wrote.
//
// - One national registry entry (TeacherProfile) per seeded teacher, with an
//   NPI for most of them, so a school head can find a teacher before adding
//   one.
// - The demonstration teacher also teaches in a second school of her commune
//   (a second Teacher row, same account and profile, one course), so the
//   school switcher can be shown.
// - A role created by CEG Godomey for its own staff.
// - Two password help requests: a teacher to the school head, a school head
//   to the communal district.
export async function seedIdentity(db: PrismaClient, ctx: SeedContext) {
  const teachers = await db.teacher.findMany({
    select: { id: true, userId: true, matricule: true, firstName: true, lastName: true, gender: true, phone: true, user: { select: { email: true } } },
    orderBy: { matricule: "asc" },
  });
  const profiles = teachers.map((t) => {
    const n = Number.parseInt(t.matricule.slice(4), 10);
    return {
      id: `tp-${t.id}`,
      userId: t.userId,
      // The NPI is optional: one teacher in four has none yet.
      npi: n % 4 === 0 ? null : String(2_000_000_000 + n),
      firstName: t.firstName,
      lastName: t.lastName,
      gender: t.gender,
      phone: t.phone,
      email: t.user?.email ?? null,
    };
  });
  for (let i = 0; i < profiles.length; i += 2000) await db.teacherProfile.createMany({ data: profiles.slice(i, i + 2000) });
  await db.$executeRaw`UPDATE "Teacher" SET "profileId" = 'tp-' || "id" WHERE "profileId" IS NULL`;

  // Second appointment of the demonstration teacher.
  const demo = await db.teacher.findFirst({ where: { userId: ctx.ids.teacher, schoolId: ctx.schools.ceg }, select: { id: true, profileId: true, firstName: true, lastName: true, gender: true, phone: true, school: { select: { communeId: true } } } });
  if (demo) {
    const second = await db.school.findFirst({
      where: { communeId: demo.school.communeId, cycle: "SECONDARY", id: { not: ctx.schools.ceg }, classrooms: { some: { academicYearId: ctx.yearId } } },
      orderBy: { name: "asc" },
      select: { id: true },
    });
    const schoolId = second?.id ?? ctx.schools.epp;
    const last = teachers.reduce((max, t) => (/^ENS-\d+$/.test(t.matricule) ? Math.max(max, Number.parseInt(t.matricule.slice(4), 10)) : max), 0);
    const appointment = await db.teacher.create({
      data: {
        userId: ctx.ids.teacher,
        profileId: demo.profileId,
        schoolId,
        matricule: `ENS-${String(last + 1).padStart(5, "0")}`,
        firstName: demo.firstName,
        lastName: demo.lastName,
        gender: demo.gender,
        phone: demo.phone,
        specialty: "Mathématiques",
      },
      select: { id: true },
    });
    // One mathematics course of the youngest class, taken over from the
    // teacher who held it.
    const course = await db.courseAssignment.findFirst({
      where: { classroom: { schoolId, academicYearId: ctx.yearId }, subject: { code: { in: ["MATH", "P-MATH"] } } },
      orderBy: [{ classroom: { level: { order: "asc" } } }, { classroom: { name: "asc" } }],
      select: { id: true },
    });
    if (course) await db.courseAssignment.update({ where: { id: course.id }, data: { teacherId: appointment.id } });
  }

  // Teacher statuses. In public schools most teachers are agents of the
  // State recorded in the ministry registry (six in ten APE, two ACE, one
  // AME, derived from the matricule), the others vacataires; private and
  // confessional schools employ their own teachers, community schools
  // vacataires. The State matricule follows the teacher's matricule.
  await db.$executeRaw`
    UPDATE "Teacher" t SET "status" = (CASE
      WHEN s."sector" IN ('PRIVATE', 'CONFESSIONAL') THEN 'PRIVATE'
      WHEN s."sector" = 'COMMUNITY' THEN 'VACATAIRE'
      WHEN right(t."matricule", 1)::int < 6 THEN 'APE'
      WHEN right(t."matricule", 1)::int < 8 THEN 'ACE'
      WHEN right(t."matricule", 1)::int = 8 THEN 'AME'
      ELSE 'VACATAIRE' END)::"TeacherStatus"
    FROM "School" s WHERE s.id = t."schoolId"`;
  await db.$executeRaw`
    UPDATE "TeacherProfile" p SET "stateStatus" = t."status", "stateMatricule" = '1' || lpad(substring(t."matricule" from 5), 5, '0')
    FROM "Teacher" t WHERE t."profileId" = p.id AND t."status" IN ('APE', 'ACE', 'AME') AND t."matricule" = (SELECT min(x."matricule") FROM "Teacher" x WHERE x."profileId" = p.id)`;
  // An agent of the State keeps that status in every public school where
  // they teach (the demonstration teacher's second appointment).
  await db.$executeRaw`
    UPDATE "Teacher" t SET "status" = p."stateStatus"
    FROM "TeacherProfile" p, "School" s
    WHERE p.id = t."profileId" AND s.id = t."schoolId" AND s."sector" = 'PUBLIC' AND p."stateStatus" IS NOT NULL`;

  // A role of CEG Godomey, for its own staff only.
  const codes = ["school:view", "class:view", "student:view", "attendance:view", "attendance:create", "attendance:update", "timetable:view", "message:view", "message:create"];
  const permissions = await db.permission.findMany({ where: { code: { in: codes } }, select: { id: true } });
  await db.role.create({
    data: {
      code: "CUSTOM_SURVEILLANT_GENERAL_CEGGOD",
      name: "Surveillant général",
      description: "Suit les présences et la discipline des élèves de CEG Godomey.",
      scopeLevel: "SCHOOL",
      isSystem: false,
      ownerSchoolId: ctx.schools.ceg,
      permissions: { create: permissions.map((p) => ({ permissionId: p.id })) },
    },
  });

  // Password help requests waiting for their handler.
  const colleague = await db.user.findFirst({
    where: { schoolId: ctx.schools.ceg, role: { code: "TEACHER" }, id: { not: ctx.ids.teacher } },
    orderBy: { username: "asc" },
    select: { id: true },
  });
  const eppHead = await db.user.findFirst({ where: { schoolId: ctx.schools.epp, role: { code: "SCHOOL_DIRECTOR" } }, select: { id: true } });
  const now = Date.UTC(2026, 8, 25, 7, 30);
  if (colleague) await db.passwordHelpRequest.create({ data: { userId: colleague.id, contact: "0197451230", createdAt: new Date(now) } });
  if (eppHead) await db.passwordHelpRequest.create({ data: { userId: eppHead.id, contact: "0166203318", createdAt: new Date(now + 45 * 60_000) } });
}
