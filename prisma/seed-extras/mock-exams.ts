import type { PrismaClient } from "../../src/generated/prisma/client";

import type { SeedContext } from "./index";

// Mock exams (examens blancs), deterministic, organised where they are in
// Benin: the BEPC mock by the DDESTFP of the department, the CEP mock by the
// circonscription scolaire, both in the months before the June exams.
// - every past year, 2022-2023 to 2025-2026: the departmental BEPC mock of
//   the Atlantique, sat in May and closed, with the results of the 3e pupils
//   of every participating college, and the CEP mock of the circonscription
//   of Abomey-Calavi with the results of the CM2 pupils of its schools. A
//   pupil's scores follow the yearly average the class council recorded;
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
  const [ddestfp, district, levels] = await Promise.all([
    db.user.findUnique({ where: { username: "aristide.gbaguidi" }, select: { id: true, departmentId: true } }),
    db.user.findUnique({ where: { username: "benedicta.zannou" }, select: { id: true, communeId: true, commune: { select: { departmentId: true } } } }),
    db.academicLevel.findMany({ where: { code: { in: ["CM2", "3E"] } }, select: { id: true, code: true } }),
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

  // 1. The mock exams of the past years, sat and closed.
  const pastYears = await db.academicYear.findMany({ where: { startDate: { lt: year.startDate } }, orderBy: { startDate: "asc" }, select: { id: true, label: true } });
  const rand = generator(20260512);
  const primariesOf = (academicYearId: string) =>
    db.school.findMany({
      where: { communeId: district.communeId!, cycle: { in: ["PRESCHOOL", "PRIMARY"] }, isActive: true, classrooms: { some: { academicYearId, levelId: level.CM2 } } },
      select: { id: true },
      orderBy: { code: "asc" },
    });
  // The candidates of an exam: the pupils of the level, with the yearly
  // average of their council decision and the teacher of each subject.
  const candidatesOf = (academicYearId: string, levelId: string, schoolIds: string[]) =>
    db.enrollment.findMany({
      where: { academicYearId, status: "ACTIVE", schoolId: { in: schoolIds }, classroom: { levelId } },
      select: { id: true, schoolId: true, councilDecision: { select: { yearlyAverage: true } }, classroom: { select: { assignments: { select: { subject: { select: { code: true } }, teacher: { select: { userId: true } } } } } } },
      orderBy: { id: "asc" },
    });
  type Past = { id: string; title: string; schools: number; results: number; organizer: string; level: string; createdAt: Date; closedAt: Date };
  const past: Past[] = [];
  const results: { examId: string; enrollmentId: string; subjectCode: string; score: number; enteredById: string }[] = [];
  const directors = new Map((await db.user.findMany({ where: { scopeLevel: "SCHOOL", role: { code: "SCHOOL_DIRECTOR" } }, select: { id: true, schoolId: true }, orderBy: { username: "asc" } })).map((u) => [u.schoolId!, u.id]));
  const score = (average: number, spread: number) => Math.max(0, Math.min(20, Math.round((average - 0.6 + (rand() - 0.5) * spread) * 4) / 4));
  for (const y of pastYears) {
    const end = Number(y.label.slice(5));
    for (const kind of ["BEPC", "CEP"] as const) {
      const bepc = kind === "BEPC";
      const schools = bepc ? await collegesWith3e(y.id) : await primariesOf(y.id);
      const subjects = bepc ? subjects3e : ["P-FR", "P-MATH", "P-EST", "P-ES"];
      const createdAt = at(`${end}-03-${bepc ? "10" : "12"}T09:00:00Z`);
      const exam = await db.mockExam.create({
        data: {
          title: bepc ? `Examen blanc départemental du BEPC ${end}, Atlantique` : `Examen blanc du CEP ${end}, circonscription d'Abomey-Calavi`,
          levelId: bepc ? level["3E"]! : level.CM2!,
          academicYearId: y.id,
          organizerLevel: bepc ? "DEPARTMENT" : "COMMUNE",
          organizerCommuneId: bepc ? null : district.communeId,
          organizerDepartmentId: bepc ? ddestfp.departmentId : (district.commune?.departmentId ?? null),
          createdById: bepc ? ddestfp.id : district.id,
          startDate: at(`${end}-05-${bepc ? "12" : "19"}T00:00:00Z`),
          endDate: at(`${end}-05-${bepc ? "14" : "21"}T00:00:00Z`),
          subjects,
          status: "CLOSED",
          decidedById: bepc ? ddestfp.id : district.id,
          decidedAt: createdAt,
          createdAt,
          participants: { createMany: { data: schools.map((s) => ({ schoolId: s.id, status: "IMPOSED" as const })) } },
        },
        select: { id: true, title: true },
      });
      const candidates = await candidatesOf(y.id, bepc ? level["3E"]! : level.CM2!, schools.map((s) => s.id));
      let count = 0;
      for (const c of candidates) {
        const average = c.councilDecision?.yearlyAverage === null || c.councilDecision === null ? 9 + rand() * 4 : Number(c.councilDecision.yearlyAverage);
        const teacherOf = new Map(c.classroom.assignments.map((a) => [a.subject.code, a.teacher?.userId ?? null]));
        for (const code of subjects) {
          results.push({ examId: exam.id, enrollmentId: c.id, subjectCode: code, score: score(average, bepc ? 6 : 5), enteredById: teacherOf.get(code) ?? directors.get(c.schoolId) ?? ctx.ids.minister });
          count++;
        }
      }
      past.push({ id: exam.id, title: exam.title, schools: schools.length, results: count, organizer: bepc ? ddestfp.id : district.id, level: bepc ? "3E" : "CM2", createdAt, closedAt: at(`${end}-05-${bepc ? "28" : "29"}T15:00:00Z`) });
    }
  }
  for (let i = 0; i < results.length; i += 5000) await db.mockExamResult.createMany({ data: results.slice(i, i + 5000) });

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
      ...past.flatMap((p) => [
        {
          userId: p.organizer,
          action: "create",
          resource: "mock_exam",
          resourceId: p.id,
          summary: `Examen blanc « ${p.title} » (${p.level === "3E" ? "3e" : "CM2"}) décidé, participation imposée à ${p.schools} ${p.level === "3E" ? "établissements" : "écoles"}`,
          metadata: { step: "create", level: p.level, schools: p.schools, imposed: true },
          createdAt: p.createdAt,
        },
        {
          userId: p.organizer,
          action: "update",
          resource: "mock_exam",
          resourceId: p.id,
          summary: `Examen blanc « ${p.title} » clôturé : ${p.results} notes enregistrées`,
          metadata: { step: "close" },
          createdAt: p.closedAt,
        },
      ]),
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
  console.log(`mock exams: ${past.length + 2} exams, ${results.length} results over ${pastYears.length} past years`);
}
