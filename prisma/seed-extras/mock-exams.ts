import type { PrismaClient } from "../../src/generated/prisma/client";

import type { SeedContext } from "./index";

// Mock exams (examens blancs), deterministic:
// - a 3e exam decided by the Abomey-Calavi district, imposed on the schools
//   of the commune teaching 3e, already sat, with the results of CEG Godomey;
// - a CM2 exam proposed by CEG Godomey to two primary schools of its
//   commune, one accepted and one not answered yet, awaiting the district's
//   approval. CEG Godomey has no CM2 class: it coordinates without
//   candidates.

const DAY = 86_400_000;

function generator(seed: number) {
  let state = seed;
  return () => {
    state = (Math.imul(state, 1103515245) + 12345) >>> 0;
    return state / 2 ** 32;
  };
}

export async function seedMockExams(db: PrismaClient, ctx: SeedContext) {
  const year = await db.academicYear.findUniqueOrThrow({ where: { id: ctx.yearId }, select: { id: true, startDate: true } });
  const [district, levels, ceg] = await Promise.all([
    db.user.findUnique({ where: { username: "benedicta.zannou" }, select: { id: true, communeId: true, commune: { select: { departmentId: true } } } }),
    db.academicLevel.findMany({ where: { code: { in: ["CM2", "3E"] } }, select: { id: true, code: true } }),
    db.school.findUniqueOrThrow({ where: { id: ctx.schools.ceg }, select: { id: true, name: true, communeId: true, commune: { select: { departmentId: true } } } }),
  ]);
  if (!district?.communeId) throw new Error("mock exams seed: the Abomey-Calavi district account is missing");
  const level = Object.fromEntries(levels.map((l) => [l.code, l.id]));
  const at = (days: number, hours = 9) => new Date(year.startDate.getTime() + days * DAY + hours * 3_600_000);
  const day = (days: number) => new Date(year.startDate.getTime() + days * DAY);

  // 1. District exam, imposed, sat in the second week of the year.
  const subjects3e = ["FR", "MATH", "ANG", "HG", "SVT", "PCT"];
  const schools3e = await db.school.findMany({
    where: { communeId: district.communeId, isActive: true, classrooms: { some: { academicYearId: year.id, levelId: level["3E"] } } },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
  const imposed = await db.mockExam.create({
    data: {
      title: "Examen blanc du BEPC, circonscription d'Abomey-Calavi",
      levelId: level["3E"]!,
      academicYearId: year.id,
      organizerLevel: "COMMUNE",
      organizerCommuneId: district.communeId,
      organizerDepartmentId: district.commune?.departmentId ?? null,
      createdById: district.id,
      startDate: day(7),
      endDate: day(9),
      subjects: subjects3e,
      status: "APPROVED",
      decidedById: district.id,
      decidedAt: at(1),
      createdAt: at(1),
      participants: { createMany: { data: schools3e.map((s) => ({ schoolId: s.id, status: "IMPOSED" as const })) } },
    },
    select: { id: true, title: true },
  });

  const candidates = await db.enrollment.findMany({
    where: { schoolId: ceg.id, academicYearId: year.id, status: "ACTIVE", classroom: { levelId: level["3E"] } },
    select: { id: true },
    orderBy: { id: "asc" },
  });
  const rand = generator(20261003);
  const results = candidates.flatMap((c) => {
    const ability = 6 + rand() * 10;
    return subjects3e.map((code) => ({
      examId: imposed.id,
      enrollmentId: c.id,
      subjectCode: code,
      score: Math.max(0, Math.min(20, Math.round((ability + (rand() - 0.5) * 7) * 4) / 4)),
      enteredById: ctx.ids.teacher,
    }));
  });
  await db.mockExamResult.createMany({ data: results });

  // 2. CM2 exam proposed by CEG Godomey, awaiting the district.
  const primaries = await db.school.findMany({
    where: { communeId: ceg.communeId, isActive: true, classrooms: { some: { academicYearId: year.id, levelId: level.CM2 } } },
    select: { id: true, name: true },
    orderBy: { name: "desc" },
    take: 2,
  });
  if (primaries.length < 2) throw new Error("mock exams seed: two primary schools with CM2 are expected in Abomey-Calavi");
  const [accepted, pending] = primaries as [(typeof primaries)[number], (typeof primaries)[number]];
  const acceptedHead = await db.user.findFirst({ where: { schoolId: accepted.id, scopeLevel: "SCHOOL", role: { code: "SCHOOL_DIRECTOR" } }, select: { id: true } });
  const proposed = await db.mockExam.create({
    data: {
      title: "Examen blanc du CEP, réseau des écoles de Godomey",
      levelId: level.CM2!,
      academicYearId: year.id,
      organizerLevel: "SCHOOL",
      organizerSchoolId: ceg.id,
      organizerCommuneId: ceg.communeId,
      organizerDepartmentId: ceg.commune.departmentId,
      createdById: ctx.ids.director,
      startDate: day(64),
      endDate: day(65),
      subjects: ["P-FR", "P-MATH", "P-EST", "P-ES"],
      status: "PENDING_APPROVAL",
      createdAt: at(8),
      participants: {
        createMany: {
          data: [
            { schoolId: accepted.id, status: "ACCEPTED", respondedAt: at(9, 11), respondedById: acceptedHead?.id ?? null },
            { schoolId: pending.id, status: "INVITED" },
          ],
        },
      },
    },
    select: { id: true, title: true },
  });

  // The timeline of each exam, as the actions write it.
  await db.auditLog.createMany({
    data: [
      {
        userId: district.id,
        action: "create",
        resource: "mock_exam",
        resourceId: imposed.id,
        summary: `Examen blanc « ${imposed.title} » (3e) décidé, participation imposée à ${schools3e.length} établissements`,
        metadata: { step: "create", level: "3E", schools: schools3e.length, imposed: true },
        createdAt: at(1),
      },
      {
        userId: ctx.ids.teacher,
        action: "update",
        resource: "mock_exam",
        resourceId: imposed.id,
        schoolId: ceg.id,
        summary: `Examen blanc « ${imposed.title} » : ${results.length} notes enregistrées pour ${ceg.name}`,
        metadata: { step: "results" },
        createdAt: at(10, 16),
      },
      {
        userId: ctx.ids.director,
        action: "create",
        resource: "mock_exam",
        resourceId: proposed.id,
        schoolId: ceg.id,
        summary: `Examen blanc « ${proposed.title} » (CM2) créé, 2 établissements invités`,
        metadata: { step: "create", level: "CM2", schools: 2, imposed: false },
        createdAt: at(8),
      },
      {
        userId: acceptedHead?.id ?? null,
        action: "approve",
        resource: "mock_exam",
        resourceId: proposed.id,
        schoolId: accepted.id,
        summary: `Examen blanc « ${proposed.title} » : invitation acceptée par ${accepted.name}`,
        metadata: { step: "accept", schoolId: accepted.id },
        createdAt: at(9, 11),
      },
      {
        userId: ctx.ids.director,
        action: "update",
        resource: "mock_exam",
        resourceId: proposed.id,
        schoolId: ceg.id,
        summary: `Examen blanc « ${proposed.title} » soumis à la validation de la circonscription scolaire`,
        metadata: { step: "submit", approvalLevel: "COMMUNE" },
        createdAt: at(10, 8),
      },
    ],
  });
  await db.notification.createMany({
    data: [
      { userId: district.id, kind: "mock_exam", title: "Examen blanc à valider", body: `${ceg.name} propose « ${proposed.title} » (CM2) avec 2 établissements partenaires.`, link: `/espace/examens-blancs/${proposed.id}`, createdAt: at(10, 8) },
      ...(await db.user.findMany({ where: { schoolId: pending.id, scopeLevel: "SCHOOL", role: { code: "SCHOOL_DIRECTOR" } }, select: { id: true } })).map((u) => ({
        userId: u.id,
        kind: "mock_exam",
        title: "Invitation à un examen blanc",
        body: `${proposed.title} (CM2) : acceptez ou déclinez l'invitation.`,
        link: `/espace/examens-blancs/${proposed.id}`,
        createdAt: at(8),
      })),
    ],
  });
  console.log(`mock exams: 2 exams, ${results.length} results for ${ceg.name}`);
}
