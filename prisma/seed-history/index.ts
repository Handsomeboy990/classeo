// The past years of the demonstration data, 2022-2023 to 2025-2026, built
// backwards from the pupils and classes of the active year, so that every
// pupil keeps one identity (one matricule) across the years:
//
// - each pupil of a class this year sat last year in the class one level
//   below, in the same school, unless they repeat (same level, with the
//   council's REDOUBLEMENT behind them) or joined this year (entry levels,
//   families who moved, a transfer from another school of the commune);
// - pupils who are no longer here left: they finished the school's last
//   level, moved away, dropped out, were excluded by the council, or left
//   during the year (transferred or withdrawn);
// - every year has its classes, teachers (some joined recently, some have
//   left), results consistent with the council decisions and the official
//   rules, attendance, and, at CEG Godomey, fees and a timetable.
//
// Deterministic: one seeded generator, fixed dates. The current year is not
// touched, except EPP Godomey Centre, which gets its first three levels (CI,
// CP, CE1) so that the demonstration primary school takes its pupils in at
// CI.

import type { Prisma } from "../../src/generated/prisma/client";
import { createRng, shortId } from "../seed-lib/random";
import { PREV_CLOSED_AT, PAST_CALENDARS, day } from "./calendar";
import { expandEpp } from "./epp";
import { writeFees } from "./fees";
import { writeResults } from "./results";
import { writeAttendance } from "./attendance";
import { writeTimetables } from "./timetables";
import { writeTransfers, type BetweenYears } from "./transfers";
import { people } from "./people";
import { LEVELS, PRIMARY_HOURS, PRIMARY_SUBJECTS, SECONDARY_HOURS, SECONDARY_SUBJECTS, coefficientOf } from "../seed-lib/reference";
import type { HistoryInput, HYear, SchoolRef, Stint, StudentInfo } from "./types";

// Share of pupils flagged as repeating in each past year (they repeated the
// year before): repetition falls year after year, as the pass rate rises.
const REPEAT_FLAG = [0.2, 0.17, 0.14, 0.11];
// Share of the pupils of a school's last level who fail and leave.
const TOP_FAIL = [0.34, 0.3, 0.26, 0.22];
// Girls among the pupils who have left: a little lower in the older years.
const GIRLS = [0.43, 0.45, 0.46, 0.475];
// Newcomers at a level that is not a school's entry level: 2nde takes many
// pupils of the colleges without a second cycle.
const NEWCOMER: Record<string, number> = { "2NDE": 0.5 };
// Levels where a primary pupil moves up whatever the average.
const AUTO = new Set(["CI", "CE1", "CM1"]);
// Enrolment grows about 3.5 % a year: classes were smaller before.
const GROWTH = 0.965;

export const EPP_SPECS = ["CI:A", "CP:A", "CE1:A", "CE2:A", "CM1:A", "CM2:A"];
// CEG Godomey opened its second cycle one level a year from 2024-2025, and a
// second class of 6e in 2026-2027.
const CEG_SPECS = [
  ["6E:A", "5E:A", "4E:A", "3E:A"],
  ["6E:A", "5E:A", "4E:A", "3E:A"],
  ["6E:A", "5E:A", "4E:A", "3E:A", "2NDE:C"],
  ["6E:A", "5E:A", "4E:A", "3E:A", "2NDE:C", "1ERE:D"],
];

const levelOf = new Map(LEVELS.map((l) => [l.code as string, l]));
function prevLevel(code: string) {
  const l = levelOf.get(code)!;
  return LEVELS.find((x) => x.order === l.order - 1 && x.cycle === l.cycle)?.code ?? null;
}
function nextLevel(code: string) {
  const l = levelOf.get(code)!;
  return LEVELS.find((x) => x.order === l.order + 1 && x.cycle === l.cycle)?.code ?? null;
}

async function stage(name: string, run: () => Promise<void>) {
  const t = Date.now();
  await run();
  console.log(`history: ${name} ${((Date.now() - t) / 1000).toFixed(1)} s`);
}

export async function seedHistory(input: HistoryInput) {
  const { bulk } = input;
  const rng = createRng(20220912);
  const { person } = people(rng);
  const started = Date.now();

  // Years ---------------------------------------------------------------------
  const years: HYear[] = [];
  const yearRows: Prisma.AcademicYearCreateManyInput[] = [];
  const periodRows: Prisma.SchoolPeriodCreateManyInput[] = [];
  PAST_CALENDARS.forEach((c, index) => {
    const id = shortId();
    const periods = [
      ...c.trimesters.map(([name, s, e], i) => ({ id: shortId(), name, periodicity: "TRIMESTER" as const, order: i + 1, startDate: day(s), endDate: day(e) })),
      ...c.semesters.map(([name, s, e], i) => ({ id: shortId(), name, periodicity: "SEMESTER" as const, order: i + 1, startDate: day(s), endDate: day(e) })),
    ];
    yearRows.push({ id, label: c.label, startDate: day(c.start), endDate: day(c.end), isActive: false, closedAt: new Date(c.closedAt) });
    periodRows.push(...periods.map((p) => ({ ...p, academicYearId: id, isClosed: true })));
    years.push({ id, label: c.label, startDate: day(c.start), endDate: day(c.end), index, startYear: Number(c.label.slice(0, 4)), periods, closedAt: new Date(c.closedAt) });
  });
  years.push({ ...input.prevYear, index: 3, startYear: 2025, periods: input.periods.prev, closedAt: new Date(PREV_CLOSED_AT) });
  years.push({ ...input.year, index: 4, startYear: 2026, periods: input.periods.current, closedAt: null });
  await bulk.insert("AcademicYear", yearRows);
  await bulk.insert("SchoolPeriod", periodRows);
  await bulk.query(`UPDATE "AcademicYear" SET "closedAt" = $1 WHERE id = $2`, [PREV_CLOSED_AT, input.prevYear.id]);

  // Reference maps --------------------------------------------------------------
  const schools = input.schools;
  const schoolById = new Map(schools.map((s) => [s.id, s]));
  const ceg = schoolById.get(input.ceg)!;
  const epp = schoolById.get(input.epp)!;
  const levelById = new Map([...input.levels.values()].map((l) => [l.id, l]));
  const eppDirector = (await input.db.user.findFirst({ where: { schoolId: epp.id, role: { code: "SCHOOL_DIRECTOR" } }, orderBy: { username: "asc" }, select: { id: true } }))?.id ?? input.users.minister;
  const directorOf = (schoolId: string) => (schoolId === ceg.id ? input.users.director : schoolId === epp.id ? eppDirector : (input.users.heads.get(schoolId) ?? null));
  const chainDirector = (school: SchoolRef) => (school.cycle === "PRIMARY" ? input.users.ddemp[school.departmentName] : input.users.ddestfp[school.departmentName]) ?? input.users.minister;

  // Current year: EPP Godomey Centre gets CI, CP and CE1 ----------------------
  const eppNew = await expandEpp(input, rng, epp);

  const specsOf = (school: SchoolRef, y: number) => (school.id === epp.id ? EPP_SPECS : y === 4 ? school.classSpecs : school.id === ceg.id ? CEG_SPECS[y]! : school.classSpecs);
  const hasLevel = (school: SchoolRef, y: number, level: string) => specsOf(school, y).some((s) => s.startsWith(`${level}:`));
  const specFor = (school: SchoolRef, y: number, level: string, letter: string) => {
    const list = specsOf(school, y).filter((s) => s.startsWith(`${level}:`));
    return list.find((s) => s.endsWith(`:${letter}`)) ?? list[Math.floor(rng.rand() * list.length)]!;
  };

  // Current stints --------------------------------------------------------------
  const classKeyOf = new Map<string, string>(); // classroom id -> spec
  const classroomIds = new Map<string, string>(); // school|year|spec -> classroom id
  for (const c of [...input.classrooms, ...eppNew.classrooms]) {
    if (c.academicYearId !== input.year.id) continue;
    const level = levelById.get(c.levelId)!;
    const spec = `${level.code}:${c.name.split(" ").pop()}`;
    classKeyOf.set(c.id!, spec);
    classroomIds.set(`${c.schoolId}|4|${spec}`, c.id!);
  }
  const info = new Map<string, StudentInfo>();
  for (const s of [...input.students, ...eppNew.students]) {
    const meta = input.studentMeta.get(s.id!) ?? eppNew.meta.get(s.id!);
    info.set(s.id!, { gender: s.gender as "F" | "M", ability: meta!.ability, firstName: s.firstName, lastName: s.lastName, birthDate: s.birthDate as Date, past: false });
  }
  const stints: Stint[][] = [[], [], [], [], []];
  for (const e of [...input.enrollments, ...eppNew.enrollments]) {
    if (e.academicYearId !== input.year.id) continue;
    const spec = classKeyOf.get(e.classroomId)!;
    stints[4]!.push({
      id: e.id!,
      studentId: e.studentId,
      schoolId: e.schoolId,
      year: 4,
      spec,
      level: spec.split(":")[0]!,
      classroomId: e.classroomId,
      isRepeating: e.isRepeating ?? false,
      status: "ACTIVE",
      periodsDone: null,
      outcome: null,
      fate: "STAYED",
    });
  }
  const currentSize = new Map<string, number>();
  for (const s of stints[4]!) currentSize.set(`${s.schoolId}|${s.spec}`, (currentSize.get(`${s.schoolId}|${s.spec}`) ?? 0) + 1);
  const levelSize = (school: SchoolRef, level: string) => {
    const sizes = school.classSpecs.filter((s) => s.startsWith(`${level}:`)).map((s) => currentSize.get(`${school.id}|${s}`) ?? 0);
    return sizes.length ? sizes.reduce((a, b) => a + b, 0) / sizes.length : 50;
  };

  // Tracing back, year by year -------------------------------------------------
  const pastStudents: string[] = [];
  const between: BetweenYears[] = [];
  const colleaguesOf = new Map<string, SchoolRef[]>(); // communeId|cycle -> schools
  for (const s of schools) colleaguesOf.set(`${s.communeId}|${s.cycle}`, [...(colleaguesOf.get(`${s.communeId}|${s.cycle}`) ?? []), s]);
  const forced: Record<string, (y: number) => { school: SchoolRef; spec: string } | null> = {
    // Sènami: EPP Godomey Centre until CM2, then CEG Godomey from 6e.
    [input.demo.senami]: (y) => (y === 3 ? { school: ceg, spec: "4E:A" } : y === 2 ? { school: ceg, spec: "5E:A" } : y === 1 ? { school: ceg, spec: "6E:A" } : { school: epp, spec: "CM2:A" }),
    // Mahougnon: CI at EPP Godomey Centre in 2023-2024.
    [input.demo.mahougnon]: (y) => (y === 3 ? { school: epp, spec: "CE1:A" } : y === 2 ? { school: epp, spec: "CP:A" } : y === 1 ? { school: epp, spec: "CI:A" } : null),
  };

  const newPastStudent = (school: SchoolRef, level: string, y: number, abilityShift: number) => {
    const id = shortId();
    const p = person(undefined, GIRLS[y]);
    const sec = school.cycle === "SECONDARY";
    const order = levelOf.get(level)!.order;
    const age = (sec ? 11 : 8) + (order - (sec ? 7 : 4)) + (rng.chance(0.2) ? 1 : 0);
    const birthDate = new Date(Date.UTC(years[y]!.startYear - age, rng.int(0, 11), rng.int(1, 28)));
    info.set(id, { gender: p.gender, firstName: p.firstName, lastName: p.lastName, birthDate, ability: rng.normal(10.6 + school.quality * 0.9 + (p.gender === "F" ? 0.15 : 0), 2.6) + abilityShift, past: true });
    pastStudents.push(id);
    return id;
  };

  for (let y = 3; y >= 0; y--) {
    const members = new Map<string, Stint[]>();
    const add = (st: Stint) => {
      const k = `${st.schoolId}|${st.spec}`;
      members.set(k, [...(members.get(k) ?? []), st]);
      stints[y]!.push(st);
    };
    const make = (studentId: string, school: SchoolRef, spec: string, outcome: Stint["outcome"], fate: Stint["fate"]): Stint => ({
      id: shortId(),
      studentId,
      schoolId: school.id,
      year: y,
      spec,
      level: spec.split(":")[0]!,
      classroomId: "",
      isRepeating: false,
      status: "ACTIVE",
      periodsDone: null,
      outcome,
      fate,
    });

    for (const s of stints[y + 1]!) {
      const school = schoolById.get(s.schoolId)!;
      const letter = s.spec.split(":")[1]!;
      const f = forced[s.studentId];
      if (f) {
        const o = f(y);
        if (o) add(make(s.studentId, o.school, o.spec, "PROMOTED", "STAYED"));
        continue;
      }
      // The level the pupil was at in year y.
      const was = s.isRepeating ? s.level : prevLevel(s.level);
      if (!was) continue;
      if (s.isRepeating && !AUTO.has(s.level) && hasLevel(school, y, s.level) && !rng.chance(0.1)) {
        add(make(s.studentId, school, specFor(school, y, s.level, letter), "REPEAT", "STAYED"));
        continue;
      }
      if (!s.isRepeating && hasLevel(school, y, was) && !rng.chance(NEWCOMER[s.level] ?? 0.05)) {
        add(make(s.studentId, school, specFor(school, y, was, letter), "PROMOTED", "STAYED"));
        continue;
      }
      // A newcomer: from a primary school of the commune into 6e, from
      // another school of the commune (a transfer), or from outside.
      const outcome = s.isRepeating ? "REPEAT" : "PROMOTED";
      if (s.level === "6E" && !s.isRepeating) {
        const primaries = school.id === ceg.id ? (rng.chance(0.4) ? [epp] : []) : rng.chance(0.3) ? (colleaguesOf.get(`${school.communeId}|PRIMARY`) ?? []).filter((p) => hasLevel(p, y, "CM2")) : [];
        if (primaries.length) {
          const from = rng.pick(primaries);
          add(make(s.studentId, from, specFor(from, y, "CM2", "A"), "PROMOTED", "STAYED"));
        }
        continue;
      }
      if (AUTO.has(s.level) && s.isRepeating) continue;
      if (rng.chance(0.25)) {
        const others = (colleaguesOf.get(`${school.communeId}|${school.cycle}`) ?? []).filter((o) => o.id !== school.id && hasLevel(o, y, was));
        if (others.length) {
          const from = rng.pick(others);
          const st = make(s.studentId, from, specFor(from, y, was, letter), outcome, "STAYED");
          add(st);
          between.push({ from: st, to: s });
        }
      }
    }

    // Fill each class with the pupils who have left since.
    for (const school of schools) {
      const sec = school.cycle === "SECONDARY";
      for (const spec of specsOf(school, y)) {
        const level = spec.split(":")[0]!;
        const list = members.get(`${school.id}|${spec}`) ?? [];
        const base = currentSize.get(`${school.id}|${spec}`) ?? levelSize(school, level);
        const target = Math.round(base * GROWTH ** (4 - y) * (1 + rng.normal(0, 0.03)));
        const next = nextLevel(level);
        const top = !next || !hasLevel(school, y + 1, next);
        const count = top ? Math.max(target - list.length, 0) : Math.max(target - list.length, Math.round(list.length * 0.05));
        for (let i = 0; i < count; i++) {
          let fate: Stint["fate"];
          if (top) fate = rng.chance(0.04) ? "WITHDRAWN" : rng.chance(TOP_FAIL[y]!) ? "FAILED" : "COMPLETED";
          else {
            const r = rng.rand();
            fate = r < 0.4 ? "MOVED" : r < 0.62 ? "DROPPED" : r < 0.78 ? "WITHDRAWN" : r < 0.9 ? "TRANSFERRED" : "EXCLUDED";
            if (fate === "EXCLUDED" && !sec) fate = "DROPPED";
          }
          const weak = fate === "DROPPED" || fate === "EXCLUDED" || fate === "FAILED" ? -1.6 : fate === "WITHDRAWN" ? -0.8 : fate === "COMPLETED" ? 0.3 : 0;
          const sid = newPastStudent(school, level, y, weak);
          let outcome: Stint["outcome"] = fate === "MOVED" || fate === "COMPLETED" ? "PROMOTED" : fate === "DROPPED" || fate === "FAILED" ? "REPEAT" : fate === "EXCLUDED" ? "EXCLUDED" : null;
          if (outcome === "REPEAT" && !sec && AUTO.has(level)) outcome = "PROMOTED";
          const st = make(sid, school, spec, outcome, fate);
          if (fate === "WITHDRAWN" || fate === "TRANSFERRED") {
            st.status = fate;
            st.periodsDone = rng.int(1, school.periodicity === "SEMESTER" ? 1 : 2);
          }
          add(st);
        }
      }
    }
    // Who was repeating in year y.
    for (const st of stints[y]!) {
      if (forced[st.studentId] || AUTO.has(st.level)) continue;
      st.isRepeating = rng.chance(REPEAT_FLAG[y]!);
    }
  }

  // Teachers: who joined when, who has left ------------------------------------
  const teacherById = new Map([...input.teachers, ...eppNew.teachers].map((t) => [t.id!, t]));
  const demoTeacher = [...input.teacherUserIds.entries()].find(([, u]) => u === input.users.teacher)?.[0];
  const joined = new Map<string, number>(); // teacher id -> first year index
  const hiredRows: { id: string; h: string }[] = [];
  let teacherSeq = Math.max(...[...teacherById.values()].map((t) => Number.parseInt(String(t.matricule).slice(4), 10)));
  for (const t of [...input.teachers, ...eppNew.teachers]) {
    const recent = t.id !== demoTeacher && rng.chance(0.18);
    const first = recent ? rng.int(1, 4) : 0;
    joined.set(t.id!, first);
    const hired = recent ? new Date(Date.UTC(2022 + first, 8, 1)) : new Date(Date.UTC(rng.int(2004, 2021), rng.pick([8, 9]), rng.int(1, 28)));
    t.hiredAt = hired;
    hiredRows.push({ id: t.id!, h: hired.toISOString() });
  }
  const formerRows: Prisma.TeacherCreateManyInput[] = [];
  const formerOf = new Map<string, string>();
  const { phone } = people(rng);
  const former = (teacherId: string) => {
    let f = formerOf.get(teacherId);
    if (f) return f;
    const t = teacherById.get(teacherId)!;
    const p = person();
    const row: Prisma.TeacherCreateManyInput = {
      id: shortId(),
      schoolId: t.schoolId,
      matricule: `ENS-${String(++teacherSeq).padStart(5, "0")}`,
      firstName: p.firstName,
      lastName: p.lastName,
      gender: p.gender,
      phone: phone(),
      specialty: t.specialty,
      hiredAt: new Date(Date.UTC(rng.int(2002, 2016), 8, rng.int(1, 28))),
      isActive: false,
    };
    formerRows.push(row);
    teacherById.set(row.id!, row);
    formerOf.set(teacherId, row.id!);
    return row.id!;
  };
  const currentTeacher = (school: SchoolRef, spec: string, subject: string) => {
    if (school.id === epp.id && eppNew.teacherOfSpec.has(spec)) return eppNew.teacherOfSpec.get(spec)!;
    const index = school.classSpecs.indexOf(spec);
    return input.teacherOfBySchool.get(school.id)!.get(`${index}:${subject}`)!;
  };
  const teacherFor = (school: SchoolRef, spec: string, subject: string, y: number) => {
    const t = currentTeacher(school, spec, subject);
    return (joined.get(t) ?? 0) > y ? former(t) : t;
  };

  // Classes and courses of the past years ---------------------------------------
  const sizeOf = new Map<string, number>();
  for (let y = 0; y <= 3; y++) for (const st of stints[y]!) sizeOf.set(`${st.schoolId}|${y}|${st.spec}`, (sizeOf.get(`${st.schoolId}|${y}|${st.spec}`) ?? 0) + 1);
  const classRows: Prisma.ClassroomCreateManyInput[] = [];
  type Course = Prisma.CourseAssignmentCreateManyInput & { subjectCode: string; schoolId: string; year: number; spec: string };
  const courses: Course[] = [];
  for (let y = 0; y <= 3; y++) {
    for (const school of schools) {
      const sec = school.cycle === "SECONDARY";
      const subjectList = sec ? SECONDARY_SUBJECTS : PRIMARY_SUBJECTS;
      for (const spec of specsOf(school, y)) {
        const [code, letter] = spec.split(":") as [string, string];
        const level = input.levels.get(code)!;
        const id = shortId();
        classroomIds.set(`${school.id}|${y}|${spec}`, id);
        const size = sizeOf.get(`${school.id}|${y}|${spec}`) ?? 0;
        classRows.push({
          id,
          schoolId: school.id,
          academicYearId: years[y]!.id,
          levelId: level.id,
          name: `${level.name} ${letter}`,
          capacity: Math.max(size, sec ? 70 : 60),
          mainTeacherId: teacherFor(school, spec, sec ? "FR" : "P-FR", y),
        });
        for (const s of subjectList) {
          courses.push({
            id: shortId(),
            classroomId: id,
            subjectId: input.subjects.get(s.code)!,
            teacherId: teacherFor(school, spec, s.code, y),
            coefficient: coefficientOf(code, letter, s),
            weeklyHours: sec ? SECONDARY_HOURS[s.code]! : PRIMARY_HOURS[s.code]!,
            subjectCode: s.code,
            schoolId: school.id,
            year: y,
            spec,
          });
        }
      }
    }
  }
  for (let y = 0; y <= 3; y++) for (const st of stints[y]!) st.classroomId = classroomIds.get(`${st.schoolId}|${y}|${st.spec}`)!;

  // Students who have left: matricule of the year they first came -----------
  const firstYear = new Map<string, number>();
  const firstSchool = new Map<string, string>();
  for (let y = 3; y >= 0; y--)
    for (const st of stints[y]!) {
      firstYear.set(st.studentId, y);
      firstSchool.set(st.studentId, st.schoolId);
    }
  let studentSeq = input.students.length + eppNew.students.length;
  const pastRows: Prisma.StudentCreateManyInput[] = [];
  for (const sid of [...pastStudents].sort((a, b) => firstYear.get(a)! - firstYear.get(b)!)) {
    const s = info.get(sid)!;
    const school = schoolById.get(firstSchool.get(sid)!)!;
    pastRows.push({
      id: sid,
      matricule: `BJ${String(years[firstYear.get(sid)!]!.startYear).slice(2)}${String(++studentSeq).padStart(6, "0")}`,
      firstName: s.firstName,
      lastName: s.lastName,
      gender: s.gender,
      birthDate: s.birthDate,
      birthPlace: school.communeName,
      disabilities: rng.chance(0.03) ? [rng.pick(["VISUAL", "HEARING", "MOTOR", "COGNITIVE"] as const)] : [],
    });
  }

  await bulk.insert("Teacher", formerRows);
  await bulk.query(`UPDATE "Teacher" t SET "hiredAt" = v.h::timestamp(3) FROM unnest($1::text[], $2::text[]) AS v(id, h) WHERE t.id = v.id`, [hiredRows.map((r) => r.id), hiredRows.map((r) => r.h)]);
  await bulk.insert("Classroom", classRows);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  await bulk.insert("CourseAssignment", courses.map(({ subjectCode, schoolId, year, spec, ...c }) => c));
  await bulk.insert("Student", pastRows);
  const enrollmentRows: Prisma.EnrollmentCreateManyInput[] = [];
  for (let y = 0; y <= 3; y++)
    for (const st of stints[y]!)
      enrollmentRows.push({ id: st.id, studentId: st.studentId, schoolId: st.schoolId, classroomId: st.classroomId, academicYearId: years[y]!.id, status: st.status, isRepeating: st.isRepeating, enrolledAt: years[y]!.startDate });
  await bulk.insert("Enrollment", enrollmentRows);
  console.log(`history: ${pastRows.length} pupils who have left, ${enrollmentRows.length} past enrollments, ${classRows.length} classes, ${formerRows.length} former teachers (${Math.round((Date.now() - started) / 1000)} s)`);

  // Everything the years hold ----------------------------------------------------
  const ctx = { input, rng, years, stints, info, schoolById, ceg, epp, eppDirector, directorOf, chainDirector, teacherById, courses, classroomIds };
  await stage("writeResults", () => writeResults(ctx));
  await stage("writeAttendance", () => writeAttendance(ctx));
  await stage("writeFees", () => writeFees(ctx));
  await stage("writeTimetables", () => writeTimetables(ctx));
  await stage("writeTransfers", () => writeTransfers(ctx, between));
  console.log(`history: done in ${Math.round((Date.now() - started) / 1000)} s`);
}

export type HistoryContext = {
  input: HistoryInput;
  rng: ReturnType<typeof createRng>;
  years: HYear[];
  stints: Stint[][];
  info: Map<string, StudentInfo>;
  schoolById: Map<string, SchoolRef>;
  ceg: SchoolRef;
  epp: SchoolRef;
  eppDirector: string;
  directorOf: (schoolId: string) => string | null;
  chainDirector: (school: SchoolRef) => string;
  teacherById: Map<string, Prisma.TeacherCreateManyInput>;
  courses: (Prisma.CourseAssignmentCreateManyInput & { subjectCode: string; schoolId: string; year: number; spec: string })[];
  classroomIds: Map<string, string>;
};
