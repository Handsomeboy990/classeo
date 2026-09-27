// EPP Godomey Centre becomes a full primary school: its first three levels
// (CI, CP, CE1) join CE2, CM1 and CM2 this year, with one teacher per class
// (each with an account, like the rest of the school), pupils and their
// guardians, the first marks of the term and the roll calls since the start
// of the year. Everything is drawn with the history generator, after the
// rest of the current year, so no other current fact moves.

import type { Prisma } from "../../src/generated/prisma/client";
import { nextFreeUsername, usernameBase } from "../../src/lib/auth/username";
import { round2 } from "../../src/lib/domain/grades";
import { clamp, type Rng, shortId } from "../seed-lib/random";
import { PRIMARY_HOURS, PRIMARY_SUBJECTS } from "../seed-lib/reference";
import { people, slug } from "./people";
import type { HistoryInput, SchoolRef } from "./types";

const NEW_LEVELS: [string, number][] = [
  ["CI", 1.12],
  ["CP", 1.08],
  ["CE1", 1.05],
];

export async function expandEpp(input: HistoryInput, rng: Rng, epp: SchoolRef) {
  const { bulk } = input;
  const { person, phone, profession } = people(rng);
  const eppDirector = (await input.db.user.findFirst({ where: { schoolId: epp.id, role: { code: "SCHOOL_DIRECTOR" } }, orderBy: { username: "asc" }, select: { id: true } }))?.id ?? input.users.director;
  let teacherSeq = Math.max(...input.teachers.map((t) => Number.parseInt(String(t.matricule).slice(4), 10)));
  let studentSeq = input.students.length;

  const users: Prisma.UserCreateManyInput[] = [];
  const teachers: Prisma.TeacherCreateManyInput[] = [];
  const classrooms: Prisma.ClassroomCreateManyInput[] = [];
  const courses: Prisma.CourseAssignmentCreateManyInput[] = [];
  const students: Prisma.StudentCreateManyInput[] = [];
  const enrollments: Prisma.EnrollmentCreateManyInput[] = [];
  const guardians: Prisma.GuardianCreateManyInput[] = [];
  const links: Prisma.StudentGuardianCreateManyInput[] = [];
  const meta = new Map<string, { ability: number }>();
  const teacherOfSpec = new Map<string, string>();
  const userOfTeacher = new Map<string, string>();

  for (const [code, factor] of NEW_LEVELS) {
    const level = input.levels.get(code)!;
    const p = person();
    const teacherId = shortId();
    const matricule = `ENS-${String(++teacherSeq).padStart(5, "0")}`;
    const tel = phone();
    const username = nextFreeUsername(usernameBase(p.firstName, p.lastName), [...input.takenUsernames]);
    input.takenUsernames.add(username);
    const userId = shortId();
    users.push({
      id: userId,
      username,
      passwordHash: input.passwordHash,
      email: `${slug(p.firstName)}.${slug(p.lastName)}.${matricule.slice(-3)}@ecoles.classeo.bj`,
      firstName: p.firstName,
      lastName: p.lastName,
      gender: p.gender,
      phone: tel,
      roleId: input.roleIds.TEACHER!,
      scopeLevel: "SCHOOL",
      schoolId: epp.id,
    });
    teachers.push({ id: teacherId, userId, schoolId: epp.id, matricule, firstName: p.firstName, lastName: p.lastName, gender: p.gender, phone: tel, specialty: "Enseignement primaire" });
    teacherOfSpec.set(`${code}:A`, teacherId);
    userOfTeacher.set(teacherId, userId);

    const classroomId = shortId();
    const size = Math.round(clamp(rng.normal(52, 5) * factor, 44, 64));
    classrooms.push({ id: classroomId, schoolId: epp.id, academicYearId: input.year.id, levelId: level.id, name: `${level.name} A`, capacity: Math.max(size, 60), mainTeacherId: teacherId });
    for (const s of PRIMARY_SUBJECTS) courses.push({ id: shortId(), classroomId, subjectId: input.subjects.get(s.code)!, teacherId, coefficient: s.coef, weeklyHours: PRIMARY_HOURS[s.code]! });

    for (let k = 0; k < size; k++) {
      const c = person();
      const id = shortId();
      const age = 8 + (level.order - 4) + (rng.chance(0.2) ? 1 : 0);
      students.push({
        id,
        matricule: `BJ26${String(++studentSeq).padStart(6, "0")}`,
        firstName: c.firstName,
        lastName: c.lastName,
        gender: c.gender,
        birthDate: new Date(Date.UTC(2026 - age, rng.int(0, 11), rng.int(1, 28))),
        birthPlace: epp.communeName,
        disabilities: rng.chance(0.03) ? [rng.pick(["VISUAL", "HEARING", "MOTOR", "COGNITIVE"] as const)] : [],
      });
      enrollments.push({ id: shortId(), studentId: id, schoolId: epp.id, classroomId, academicYearId: input.year.id, isRepeating: code === "CP" && rng.chance(0.06), enrolledAt: input.year.startDate });
      meta.set(id, { ability: rng.normal(10.6 + epp.quality * 0.9 + (c.gender === "F" ? 0.15 : 0), 2.6) });
      const mother = rng.chance(0.6);
      const g = person(mother ? "F" : "M");
      const gid = shortId();
      guardians.push({ id: gid, firstName: g.firstName, lastName: c.lastName, phone: phone(), profession: profession(), preferredChannel: rng.pick(["APP", "SMS", "VOICE_CALL"] as const), prefersAudio: rng.chance(0.35) });
      links.push({ studentId: id, guardianId: gid, relationship: mother ? "Mère" : "Père", isPrimary: true });
    }
  }

  // The first interrogation and devoir of the first term, as in the rest of
  // the school; the roll calls since the start of the year.
  const term = input.periods.current.find((p) => p.periodicity === "TRIMESTER" && p.order === 1)!;
  const sheets: Prisma.GradeSheetCreateManyInput[] = [];
  const grades: Prisma.GradeCreateManyInput[] = [];
  const byClass = new Map<string, Prisma.EnrollmentCreateManyInput[]>();
  for (const e of enrollments) byClass.set(e.classroomId, [...(byClass.get(e.classroomId) ?? []), e]);
  for (const a of courses) {
    const sheetId = shortId();
    sheets.push({ id: sheetId, assignmentId: a.id!, periodId: term.id, formula: "OFFICIAL_2024", interrogationCount: 2, devoirCount: 2, compositionCount: 0 });
    const grader = userOfTeacher.get(a.teacherId!)!;
    for (const e of byClass.get(a.classroomId) ?? []) {
      const ability = meta.get(e.studentId)!.ability;
      grades.push({ id: shortId(), gradeSheetId: sheetId, enrollmentId: e.id!, type: "INTERROGATION", sequence: 1, value: round2(clamp(Math.round(rng.normal(ability, 3) * 2) / 2, 0, 20)), maxValue: 20, gradedById: grader });
      if (rng.chance(0.85)) grades.push({ id: shortId(), gradeSheetId: sheetId, enrollmentId: e.id!, type: "DEVOIR", sequence: 1, value: round2(clamp(Math.round(rng.normal(ability, 2.5) * 2) / 2, 0, 20)), maxValue: 20, gradedById: grader });
    }
  }
  const attendance: Prisma.StudentAttendanceCreateManyInput[] = [];
  for (const e of enrollments) {
    const risk = clamp(0.1 - (meta.get(e.studentId)!.ability - 10) * 0.012, 0.01, 0.25);
    for (const date of input.currentDays)
      for (const half of ["MORNING", "AFTERNOON"] as const) {
        const r = rng.rand();
        const status = r < risk ? "ABSENT" : r < risk + 0.04 ? "LATE" : "PRESENT";
        attendance.push({ id: shortId(), enrollmentId: e.id!, date, half, status, recordedById: eppDirector, reason: status === "ABSENT" && rng.chance(0.3) ? rng.pick(["Maladie", "Raison familiale", "Transport"]) : null });
      }
  }
  const teacherAttendance = teachers.flatMap((t) => input.currentDays.slice(-3).map((date) => ({ id: shortId(), teacherId: t.id!, date, status: rng.chance(0.05) ? ("ABSENT" as const) : ("PRESENT" as const) })));

  await bulk.insert("User", users);
  await bulk.insert("Teacher", teachers);
  await bulk.insert("Classroom", classrooms);
  await bulk.insert("CourseAssignment", courses);
  await bulk.insert("Student", students);
  await bulk.insert("Enrollment", enrollments);
  await bulk.insert("Guardian", guardians);
  await bulk.insert("StudentGuardian", links);
  await bulk.insert("GradeSheet", sheets);
  await bulk.insert("Grade", grades);
  await bulk.insert("StudentAttendance", attendance);
  await bulk.insert("TeacherAttendance", teacherAttendance);
  for (const [t, u] of userOfTeacher) input.teacherUserIds.set(t, u);
  return { classrooms, students, enrollments, meta, teachers, teacherOfSpec };
}
