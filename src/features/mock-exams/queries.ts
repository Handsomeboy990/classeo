import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { can } from "@/lib/auth/authorize";
import { classroomWhere, enrollmentWhere, isTeacherRole, schoolWhere } from "@/lib/auth/scope";
import type { CurrentUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { chainOfCycle, ministryName } from "@/lib/domain/chains";
import { institutionName } from "@/lib/domain/institutions";
import { param, type SearchParams } from "@/lib/list";

import { computeResults, EXAM_LEVEL_CODES, isExamStatus, isOrganizer, TAKES_PART, type ExamStatus, type Participation, type Territory } from "./rules";

type User = NonNullable<CurrentUser>;

const NOTHING: Prisma.MockExamWhereInput = { id: "__none__" };
const RUNNING: ExamStatus[] = ["APPROVED", "CLOSED"];

// Exams a user may read. Everything is visible to the ministry; a
// department or a commune sees the exams it organised and those where a
// school of its territory takes part; a school sees its own and those it is
// invited to; a teacher only the running exams of their school; a family
// only the running exams its children sit.
export async function examWhere(user: User): Promise<Prisma.MockExamWhereInput> {
  const s = user.scope;
  switch (s.level) {
    case "NATIONAL":
      return {};
    case "DEPARTMENT":
      // Its own exams and those of the schools of its department, within
      // its chain (a DDEMP does not follow the BEPC mock exams).
      return s.departmentId
        ? {
            OR: [
              { organizerDepartmentId: s.departmentId, organizerLevel: "DEPARTMENT", ...(s.cycles ? { participants: { some: { school: { cycle: { in: s.cycles } } } } } : {}) },
              { participants: { some: { school: { commune: { departmentId: s.departmentId }, ...(s.cycles ? { cycle: { in: s.cycles } } : {}) } } } },
            ],
          }
        : NOTHING;
    case "COMMUNE":
      return s.communeId
        ? { OR: [{ organizerCommuneId: s.communeId, organizerLevel: "COMMUNE" }, { participants: { some: { school: { communeId: s.communeId, ...(s.cycles ? { cycle: { in: s.cycles } } : {}) } } } }] }
        : NOTHING;
    case "SCHOOL":
      if (!s.schoolId) return NOTHING;
      if (isTeacherRole(user)) return { status: { in: RUNNING }, participants: { some: { schoolId: s.schoolId, status: { in: TAKES_PART } } } };
      return { OR: [{ organizerSchoolId: s.schoolId }, { participants: { some: { schoolId: s.schoolId } } }] };
    case "SELF": {
      const enrollments = await familyEnrollments(user);
      if (!enrollments.length) return NOTHING;
      return {
        status: { in: RUNNING },
        OR: enrollments.map((e) => ({ academicYearId: e.academicYearId, levelId: e.classroom.levelId, participants: { some: { schoolId: e.schoolId, status: { in: TAKES_PART } } } })),
      };
    }
  }
}

function familyEnrollments(user: User) {
  return db.enrollment.findMany({
    where: { AND: [enrollmentWhere(user), { status: "ACTIVE" }] },
    select: { id: true, schoolId: true, academicYearId: true, classroom: { select: { levelId: true, name: true } }, student: { select: { firstName: true, lastName: true } } },
    take: 20,
  });
}

// ---------------------------------------------------------------------------
// Reference data
// ---------------------------------------------------------------------------

export function examLevels() {
  return db.academicLevel.findMany({ where: { code: { in: [...EXAM_LEVEL_CODES] } }, select: { id: true, code: true, name: true, cycle: true }, orderBy: { order: "asc" } });
}

// Subjects offered for a level: approved subjects of the catalogue taught at
// that level this year.
export async function subjectsByLevel(yearId: string, levelIds: string[]) {
  const rows = await db.courseAssignment.findMany({
    where: { classroom: { academicYearId: yearId, levelId: { in: levelIds } }, subject: { status: "APPROVED" } },
    select: { classroom: { select: { levelId: true } }, subject: { select: { code: true, name: true } } },
    distinct: ["classroomId", "subjectId"],
    take: 20000,
  });
  const out: Record<string, { code: string; name: string }[]> = {};
  for (const r of rows) {
    const list = (out[r.classroom.levelId] ??= []);
    if (!list.some((s) => s.code === r.subject.code)) list.push(r.subject);
  }
  for (const list of Object.values(out)) list.sort((a, b) => a.name.localeCompare(b.name, "fr"));
  return out;
}

export async function subjectNames(codes: string[]) {
  const rows = await db.subject.findMany({ where: { code: { in: codes } }, select: { code: true, name: true } });
  const map = new Map(rows.map((r) => [r.code, r.name]));
  return codes.map((code) => ({ code, name: map.get(code) ?? code }));
}

export type CandidateSchool = { id: string; name: string; code: string; communeId: string; communeName: string; departmentId: string; departmentName: string; levelIds: string[] };

// Schools a creator can bring in, with the exam levels they teach this year.
// A school organiser looks among the schools of its department (its commune
// first); an authority among the schools of its territory.
export async function candidateSchools(user: User, yearId: string, levelIds: string[]): Promise<CandidateSchool[]> {
  const where: Prisma.SchoolWhereInput =
    user.scope.level === "SCHOOL"
      ? { commune: { departmentId: user.scope.departmentId ?? "__none__" }, id: { not: user.scope.schoolId ?? "__none__" } }
      : schoolWhere(user);
  const rows = await db.school.findMany({
    where: { AND: [where, { isActive: true, status: "ACTIVE" }, { classrooms: { some: { academicYearId: yearId, levelId: { in: levelIds } } } }] },
    select: {
      id: true,
      name: true,
      code: true,
      communeId: true,
      commune: { select: { name: true, departmentId: true, department: { select: { name: true } } } },
      classrooms: { where: { academicYearId: yearId, levelId: { in: levelIds } }, select: { levelId: true }, distinct: ["levelId"] },
    },
    orderBy: { name: "asc" },
    take: 3000,
  });
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    code: r.code,
    communeId: r.communeId,
    communeName: r.commune.name,
    departmentId: r.commune.departmentId,
    departmentName: r.commune.department.name,
    levelIds: r.classrooms.map((c) => c.levelId),
  }));
}

// ---------------------------------------------------------------------------
// Lists
// ---------------------------------------------------------------------------

export type ExamFilters = { q: string; status: ExamStatus | null };

export function examFilters(sp: SearchParams): ExamFilters {
  const statut = param(sp, "statut");
  return { q: (param(sp, "q") ?? "").trim().slice(0, 100), status: isExamStatus(statut) ? statut : null };
}

const listSelect = {
  id: true,
  title: true,
  levelId: true,
  status: true,
  organizerLevel: true,
  organizerSchoolId: true,
  organizerCommuneId: true,
  organizerDepartmentId: true,
  organizerSchool: { select: { name: true } },
  startDate: true,
  endDate: true,
  subjects: true,
  createdAt: true,
  _count: { select: { participants: true } },
} as const;

export async function listExams(user: User, f: ExamFilters, page: { skip: number; take: number }) {
  const scope = await examWhere(user);
  const and: Prisma.MockExamWhereInput[] = [scope];
  if (f.q) and.push({ OR: [{ title: { contains: f.q, mode: "insensitive" } }, { organizerSchool: { name: { contains: f.q, mode: "insensitive" } } }] });
  if (f.status) and.push({ status: f.status });
  const where = { AND: and };
  const [rows, total, counts, levels] = await Promise.all([
    db.mockExam.findMany({ where, select: listSelect, orderBy: [{ startDate: "desc" }, { createdAt: "desc" }], skip: page.skip, take: page.take }),
    db.mockExam.count({ where }),
    db.mockExam.groupBy({ by: ["status"], where: scope, _count: { _all: true } }),
    examLevels(),
  ]);
  const organizers = await organizerNames(rows);
  const levelName = new Map(levels.map((l) => [l.id, l.name]));
  const byStatus = Object.fromEntries(counts.map((c) => [c.status, c._count._all])) as Partial<Record<ExamStatus, number>>;
  return { rows: rows.map((r) => ({ ...r, levelName: levelName.get(r.levelId) ?? "", organizerName: organizers(r) })), total, byStatus };
}

type OrganizerRow = { levelId: string; organizerLevel: Territory; organizerSchool: { name: string } | null; organizerCommuneId: string | null; organizerDepartmentId: string | null };

// An authority is named by the chain of the exam class: the CEP (CM2)
// belongs to the MEMP chain, the BEPC and the baccalauréat to the MESTFP.
async function organizerNames(rows: OrganizerRow[]) {
  const levels = await examLevels();
  const chainOf = new Map(levels.map((l) => [l.id, chainOfCycle(l.cycle)]));
  const communeIds = [...new Set(rows.filter((r) => r.organizerLevel === "COMMUNE").map((r) => r.organizerCommuneId!).filter(Boolean))];
  const departmentIds = [...new Set(rows.filter((r) => r.organizerLevel === "DEPARTMENT").map((r) => r.organizerDepartmentId!).filter(Boolean))];
  const [communes, departments] = await Promise.all([
    communeIds.length ? db.commune.findMany({ where: { id: { in: communeIds } }, select: { id: true, name: true } }) : [],
    departmentIds.length ? db.department.findMany({ where: { id: { in: departmentIds } }, select: { id: true, name: true } }) : [],
  ]);
  const c = new Map(communes.map((x) => [x.id, x.name]));
  const d = new Map(departments.map((x) => [x.id, x.name]));
  return (r: OrganizerRow) => {
    switch (r.organizerLevel) {
      case "SCHOOL":
        return r.organizerSchool?.name ?? "Établissement";
      case "COMMUNE":
        return institutionName("COMMUNE", c.get(r.organizerCommuneId ?? "") ?? null);
      case "DEPARTMENT":
        return institutionName("DEPARTMENT", d.get(r.organizerDepartmentId ?? "") ?? null, chainOf.get(r.levelId) ?? null);
      case "NATIONAL":
        return ministryName(chainOf.get(r.levelId) ?? null);
    }
  };
}

// What waits for this user: invitations to answer (school) and exams to
// decide (hierarchy).
export async function pendingForUser(user: User) {
  const scope = await examWhere(user);
  if (user.scope.level === "SCHOOL" && user.scope.schoolId && can(user, "mock_exam:approve"))
    return db.mockExam.findMany({
      where: { AND: [scope, { status: { in: ["DRAFT", "PENDING_APPROVAL", "APPROVED"] }, participants: { some: { schoolId: user.scope.schoolId, status: "INVITED" } } }] },
      select: { id: true, title: true, startDate: true, organizerSchool: { select: { name: true } } },
      orderBy: { startDate: "asc" },
      take: 10,
    });
  if (["NATIONAL", "DEPARTMENT", "COMMUNE"].includes(user.scope.level) && can(user, "mock_exam:approve"))
    return db.mockExam.findMany({
      where: { AND: [scope, { status: "PENDING_APPROVAL" }] },
      select: { id: true, title: true, startDate: true, organizerSchool: { select: { name: true } } },
      orderBy: { startDate: "asc" },
      take: 10,
    });
  return [];
}

// ---------------------------------------------------------------------------
// One exam
// ---------------------------------------------------------------------------

const participantSelect = {
  id: true,
  schoolId: true,
  status: true,
  respondedAt: true,
  respondedById: true,
  school: { select: { id: true, name: true, code: true, communeId: true, cycle: true, commune: { select: { name: true, departmentId: true, department: { select: { name: true } } } } } },
} as const;

export async function getExam(user: User, id: string) {
  if (id.length > 64) return null;
  const exam = await db.mockExam.findFirst({
    where: { AND: [{ id }, await examWhere(user)] },
    select: {
      ...listSelect,
      academicYearId: true,
      academicYear: { select: { label: true } },
      createdById: true,
      decidedById: true,
      decidedAt: true,
      decisionNote: true,
      participants: { select: participantSelect, orderBy: { school: { name: "asc" } } },
    },
  });
  if (!exam) return null;
  const userIds = [exam.createdById, exam.decidedById, ...exam.participants.map((p) => p.respondedById)].filter((v): v is string => !!v);
  const [people, level, subjects, organizers] = await Promise.all([
    db.user.findMany({ where: { id: { in: [...new Set(userIds)] } }, select: { id: true, firstName: true, lastName: true, role: { select: { name: true } } } }),
    db.academicLevel.findUnique({ where: { id: exam.levelId }, select: { id: true, code: true, name: true } }),
    subjectNames(exam.subjects),
    organizerNames([exam]),
  ]);
  const person = new Map(people.map((p) => [p.id, { name: `${p.firstName} ${p.lastName}`, role: p.role.name }]));
  return {
    ...exam,
    level,
    subjectList: subjects,
    organizerName: organizers(exam),
    createdBy: person.get(exam.createdById) ?? null,
    decidedBy: exam.decidedById ? (person.get(exam.decidedById) ?? null) : null,
    participants: exam.participants.map((p) => ({
      ...p,
      isOrganizer: p.schoolId === exam.organizerSchoolId,
      respondedBy: p.respondedById ? (person.get(p.respondedById) ?? null) : null,
    })),
    viewerIsOrganizer: isOrganizer(user.scope, exam),
  };
}

export type ExamDetail = NonNullable<Awaited<ReturnType<typeof getExam>>>;

const TIMELINE_STEPS = ["create", "invite", "accept", "decline", "submit", "approve", "reject", "close"] as const;
export type TimelineStep = (typeof TIMELINE_STEPS)[number];

// The history of an exam, read from the activity log entries its actions
// wrote (each one tagged with its step).
export async function examTimeline(examId: string) {
  const rows = await db.auditLog.findMany({
    where: { resource: "mock_exam", resourceId: examId, action: { in: ["create", "update", "approve", "lock"] } },
    select: { id: true, createdAt: true, summary: true, metadata: true, user: { select: { firstName: true, lastName: true, role: { select: { name: true } } } } },
    orderBy: { createdAt: "asc" },
    take: 200,
  });
  return rows
    .map((r) => {
      const step = (r.metadata as { step?: string } | null)?.step;
      return TIMELINE_STEPS.includes(step as TimelineStep) ? { ...r, step: step as TimelineStep } : null;
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);
}

// ---------------------------------------------------------------------------
// Results
// ---------------------------------------------------------------------------

// Rankings are computed over every candidate of every school taking part;
// names are shown only where the user may see them: their own school (a
// teacher: their classes), the schools of their territory, a family its
// own child. Other schools appear as figures.
export async function examResults(user: User, exam: Pick<ExamDetail, "id" | "academicYearId" | "levelId" | "subjects" | "participants">) {
  const schoolIds = exam.participants.filter((p) => TAKES_PART.includes(p.status as Participation)).map((p) => p.schoolId);
  const [enrollments, scores] = await Promise.all([
    db.enrollment.findMany({
      where: { schoolId: { in: schoolIds }, academicYearId: exam.academicYearId, status: "ACTIVE", classroom: { levelId: exam.levelId } },
      select: { id: true, schoolId: true, classroomId: true, classroom: { select: { name: true } }, student: { select: { id: true, firstName: true, lastName: true, matricule: true } } },
      take: 60000,
    }),
    db.mockExamResult.findMany({ where: { examId: exam.id }, select: { enrollmentId: true, subjectCode: true, score: true }, take: 500000 }),
  ]);
  const computed = computeResults(
    enrollments.map((e) => ({
      enrollmentId: e.id,
      schoolId: e.schoolId,
      classroomId: e.classroomId,
      classroomName: e.classroom.name,
      studentId: e.student.id,
      name: `${e.student.lastName} ${e.student.firstName}`,
      matricule: e.student.matricule,
    })),
    exam.subjects,
    scores.map((s) => ({ enrollmentId: s.enrollmentId, subjectCode: s.subjectCode, score: Number(s.score) })),
  );

  const visible = await visibleEnrollmentIds(user, enrollments.map((e) => e.id));
  const named = computed.results.filter((r) => visible.has(r.enrollmentId)).sort((a, b) => (a.overallRank ?? Infinity) - (b.overallRank ?? Infinity) || a.name.localeCompare(b.name, "fr"));
  const schoolName = new Map(exam.participants.map((p) => [p.schoolId, p.school.name]));
  return { ...computed, schools: computed.schools.map((s) => ({ ...s, name: schoolName.get(s.schoolId) ?? "" })), named };
}

export type ExamResults = Awaited<ReturnType<typeof examResults>>;

async function visibleEnrollmentIds(user: User, ids: string[]) {
  if (!ids.length) return new Set<string>();
  const where: Prisma.EnrollmentWhereInput =
    user.scope.level === "SELF" ? enrollmentWhere(user) : isTeacherRole(user) ? { classroom: classroomWhere(user) } : { school: schoolWhere(user) };
  const rows = await db.enrollment.findMany({ where: { AND: [{ id: { in: ids } }, where] }, select: { id: true }, take: 60000 });
  return new Set(rows.map((r) => r.id));
}

// ---------------------------------------------------------------------------
// Entry
// ---------------------------------------------------------------------------

// Classes where this user enters results, with the subjects they may enter
// in each: a teacher their own subjects of their own classes, the school
// management every subject of the exam in the school's classes.
export async function writableClassrooms(user: User, exam: Pick<ExamDetail, "academicYearId" | "levelId" | "subjects" | "participants">) {
  const schoolId = user.scope.level === "SCHOOL" ? user.scope.schoolId : null;
  if (!schoolId || !can(user, "mock_exam:update")) return [];
  if (!exam.participants.some((p) => p.schoolId === schoolId && TAKES_PART.includes(p.status as Participation))) return [];
  const teacher = isTeacherRole(user);
  const rooms = await db.classroom.findMany({
    where: { AND: [classroomWhere(user), { schoolId, academicYearId: exam.academicYearId, levelId: exam.levelId }] },
    select: {
      id: true,
      name: true,
      schoolId: true,
      assignments: { where: { subject: { code: { in: exam.subjects } } }, select: { teacherId: true, subject: { select: { code: true } } } },
    },
    orderBy: { name: "asc" },
  });
  return rooms
    .map((r) => ({
      id: r.id,
      name: r.name,
      schoolId: r.schoolId,
      subjects: teacher ? r.assignments.filter((a) => a.teacherId === user.teacherId).map((a) => a.subject.code) : [...exam.subjects],
    }))
    .filter((r) => r.subjects.length > 0);
}

export async function entryRows(examId: string, classroomId: string) {
  const enrollments = await db.enrollment.findMany({
    where: { classroomId, status: "ACTIVE" },
    select: { id: true, student: { select: { id: true, firstName: true, lastName: true, matricule: true } } },
    orderBy: [{ student: { lastName: "asc" } }, { student: { firstName: "asc" } }],
  });
  const own = await db.mockExamResult.findMany({
    where: { examId, enrollmentId: { in: enrollments.map((e) => e.id) } },
    select: { enrollmentId: true, subjectCode: true, score: true },
  });
  const values = new Map<string, Record<string, string>>();
  for (const s of own) {
    const row = values.get(s.enrollmentId) ?? {};
    row[s.subjectCode] = Number(s.score).toString().replace(".", ",");
    values.set(s.enrollmentId, row);
  }
  return enrollments.map((e) => ({
    enrollmentId: e.id,
    studentId: e.student.id,
    name: `${e.student.lastName} ${e.student.firstName}`,
    matricule: e.student.matricule,
    values: values.get(e.id) ?? {},
  }));
}

// A family sees the results of its own children only.
export async function familyResults(user: User, exam: Pick<ExamDetail, "academicYearId" | "levelId">, results: ExamResults) {
  const enrollments = await familyEnrollments(user);
  const mine = enrollments.filter((e) => e.academicYearId === exam.academicYearId && e.classroom.levelId === exam.levelId);
  return mine.map((e) => ({
    enrollmentId: e.id,
    name: `${e.student.firstName} ${e.student.lastName}`,
    classroom: e.classroom.name,
    result: results.results.find((r) => r.enrollmentId === e.id) ?? null,
    school: results.schools.find((s) => s.schoolId === e.schoolId) ?? null,
  }));
}
