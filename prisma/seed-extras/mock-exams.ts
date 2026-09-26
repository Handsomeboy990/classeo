import type { PrismaClient } from "../../src/generated/prisma/client";

import type { SeedContext } from "./index";

// Mock exams (examens blancs), deterministic, organised where they are in
// Benin: the BEPC mock by the DDESTFP of the department, the CEP mock by the
// circonscription scolaire, both in the months before the June exams.
// - 2025-2026: the departmental BEPC mock of the Atlantique, sat in May 2026
//   and closed, with the results of the 3e classes of CEG Godomey;
// - 2026-2027: the first departmental BEPC mock of the Atlantique, planned
//   in February 2027, imposed on every college of the department teaching
//   3e;
// - 2026-2027: the CEP mock of the circonscription of Abomey-Calavi,
//   planned in May 2027, imposed on its schools teaching CM2.

function generator(seed: number) {
  let state = seed;
  return () => {
    state = (Math.imul(state, 1103515245) + 12345) >>> 0;
    return state / 2 ** 32;
  };
}

export async function seedMockExams(db: PrismaClient, ctx: SeedContext) {
  const year = await db.academicYear.findUniqueOrThrow({ where: { id: ctx.yearId }, select: { id: true, startDate: true } });
  const prevYear = await db.academicYear.findFirst({ where: { startDate: { lt: year.startDate } }, orderBy: { startDate: "desc" }, select: { id: true } });
  const [ddestfp, district, levels, ceg] = await Promise.all([
    db.user.findUnique({ where: { username: "aristide.gbaguidi" }, select: { id: true, departmentId: true } }),
    db.user.findUnique({ where: { username: "benedicta.zannou" }, select: { id: true, communeId: true, commune: { select: { departmentId: true } } } }),
    db.academicLevel.findMany({ where: { code: { in: ["CM2", "3E"] } }, select: { id: true, code: true } }),
    db.school.findUniqueOrThrow({ where: { id: ctx.schools.ceg }, select: { id: true, name: true, communeId: true, commune: { select: { departmentId: true } } } }),
  ]);
  if (!ddestfp?.departmentId || !district?.communeId || !prevYear) throw new Error("mock exams seed: the Atlantique DDESTFP, the Abomey-Calavi circonscription or last year is missing");
  const level = Object.fromEntries(levels.map((l) => [l.code, l.id]));
  const at = (iso: string) => new Date(iso);
  const subjects3e = ["FR", "MATH", "ANG", "HG", "SVT", "PCT"];
  const collegesWith3e = (academicYearId: string) =>
    db.school.findMany({
      where: { commune: { departmentId: ddestfp.departmentId! }, cycle: "SECONDARY", isActive: true, classrooms: { some: { academicYearId, levelId: level["3E"] } } },
      select: { id: true },
      orderBy: { code: "asc" },
    });

  // 1. Last year's departmental BEPC mock, sat and closed.
  const lastSchools = await collegesWith3e(prevYear.id);
  const last = await db.mockExam.create({
    data: {
      title: "Examen blanc départemental du BEPC 2026, Atlantique",
      levelId: level["3E"]!,
      academicYearId: prevYear.id,
      organizerLevel: "DEPARTMENT",
      organizerDepartmentId: ddestfp.departmentId,
      createdById: ddestfp.id,
      startDate: at("2026-05-12T00:00:00Z"),
      endDate: at("2026-05-14T00:00:00Z"),
      subjects: subjects3e,
      status: "CLOSED",
      decidedById: ddestfp.id,
      decidedAt: at("2026-03-10T09:00:00Z"),
      createdAt: at("2026-03-10T09:00:00Z"),
      participants: { createMany: { data: lastSchools.map((s) => ({ schoolId: s.id, status: "IMPOSED" as const })) } },
    },
    select: { id: true, title: true },
  });
  const candidates = await db.enrollment.findMany({
    where: { schoolId: ceg.id, academicYearId: prevYear.id, classroom: { levelId: level["3E"] } },
    select: { id: true },
    orderBy: { id: "asc" },
  });
  const rand = generator(20260512);
  const results = candidates.flatMap((c) => {
    const ability = 6 + rand() * 10;
    return subjects3e.map((code) => ({
      examId: last.id,
      enrollmentId: c.id,
      subjectCode: code,
      score: Math.max(0, Math.min(20, Math.round((ability + (rand() - 0.5) * 7) * 4) / 4)),
      enteredById: ctx.ids.teacher,
    }));
  });
  await db.mockExamResult.createMany({ data: results });

  // 2. This year's first departmental BEPC mock, before the February pause.
  const schools3e = await collegesWith3e(year.id);
  const bepc = await db.mockExam.create({
    data: {
      title: "Premier examen blanc départemental du BEPC, Atlantique",
      levelId: level["3E"]!,
      academicYearId: year.id,
      organizerLevel: "DEPARTMENT",
      organizerDepartmentId: ddestfp.departmentId,
      createdById: ddestfp.id,
      startDate: at("2027-02-09T00:00:00Z"),
      endDate: at("2027-02-11T00:00:00Z"),
      subjects: subjects3e,
      status: "APPROVED",
      decidedById: ddestfp.id,
      decidedAt: at("2026-09-18T10:00:00Z"),
      createdAt: at("2026-09-18T10:00:00Z"),
      participants: { createMany: { data: schools3e.map((s) => ({ schoolId: s.id, status: "IMPOSED" as const })) } },
    },
    select: { id: true, title: true },
  });

  // 3. The CEP mock of the circonscription, three weeks before the CEP.
  const primaries = await db.school.findMany({
    where: { communeId: district.communeId, cycle: { in: ["PRESCHOOL", "PRIMARY"] }, isActive: true, classrooms: { some: { academicYearId: year.id, levelId: level.CM2 } } },
    select: { id: true },
    orderBy: { code: "asc" },
  });
  const cep = await db.mockExam.create({
    data: {
      title: "Examen blanc du CEP, circonscription d'Abomey-Calavi",
      levelId: level.CM2!,
      academicYearId: year.id,
      organizerLevel: "COMMUNE",
      organizerCommuneId: district.communeId,
      organizerDepartmentId: district.commune?.departmentId ?? null,
      createdById: district.id,
      startDate: at("2027-05-18T00:00:00Z"),
      endDate: at("2027-05-20T00:00:00Z"),
      subjects: ["P-FR", "P-MATH", "P-EST", "P-ES"],
      status: "APPROVED",
      decidedById: district.id,
      decidedAt: at("2026-09-21T09:00:00Z"),
      createdAt: at("2026-09-21T09:00:00Z"),
      participants: { createMany: { data: primaries.map((s) => ({ schoolId: s.id, status: "IMPOSED" as const })) } },
    },
    select: { id: true, title: true },
  });

  // The timeline of each exam, as the actions write it.
  await db.auditLog.createMany({
    data: [
      {
        userId: ddestfp.id,
        action: "create",
        resource: "mock_exam",
        resourceId: last.id,
        summary: `Examen blanc « ${last.title} » (3e) décidé, participation imposée à ${lastSchools.length} établissements`,
        metadata: { step: "create", level: "3E", schools: lastSchools.length, imposed: true },
        createdAt: at("2026-03-10T09:00:00Z"),
      },
      {
        userId: ctx.ids.teacher,
        action: "update",
        resource: "mock_exam",
        resourceId: last.id,
        schoolId: ceg.id,
        summary: `Examen blanc « ${last.title} » : ${results.length} notes enregistrées pour ${ceg.name}`,
        metadata: { step: "results" },
        createdAt: at("2026-05-20T15:00:00Z"),
      },
      {
        userId: ddestfp.id,
        action: "create",
        resource: "mock_exam",
        resourceId: bepc.id,
        summary: `Examen blanc « ${bepc.title} » (3e) décidé, participation imposée à ${schools3e.length} établissements`,
        metadata: { step: "create", level: "3E", schools: schools3e.length, imposed: true },
        createdAt: at("2026-09-18T10:00:00Z"),
      },
      {
        userId: district.id,
        action: "create",
        resource: "mock_exam",
        resourceId: cep.id,
        summary: `Examen blanc « ${cep.title} » (CM2) décidé, participation imposée à ${primaries.length} écoles`,
        metadata: { step: "create", level: "CM2", schools: primaries.length, imposed: true },
        createdAt: at("2026-09-21T09:00:00Z"),
      },
    ],
  });
  await db.notification.createMany({
    data: (await db.user.findMany({ where: { schoolId: { in: schools3e.map((s) => s.id) }, scopeLevel: "SCHOOL", role: { code: "SCHOOL_DIRECTOR" } }, select: { id: true } })).map((u) => ({
      userId: u.id,
      kind: "mock_exam",
      title: "Examen blanc imposé",
      body: `${bepc.title} (3e), du 9 au 11 février 2027 : vos classes de 3e y participent.`,
      link: `/espace/examens-blancs/${bepc.id}`,
      createdAt: at("2026-09-18T10:00:00Z"),
    })),
  });
  console.log(`mock exams: 3 exams, ${results.length} results for ${ceg.name} in 2025-2026`);
}
