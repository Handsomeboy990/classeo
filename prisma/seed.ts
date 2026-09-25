// Classeo demonstration data.
// Real territory (12 departments, 77 communes), fictitious schools and people.
// Deterministic: the same seed always produces the same data.
//
// Safety: refuses to run on a database that already has users unless
// SEED_RESET=true is set, because it truncates every table first.

import "dotenv/config";

import { randomUUID } from "node:crypto";

import { hash } from "@node-rs/argon2";
import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient, type Prisma } from "../src/generated/prisma/client";
import { DEFAULT_ROLES, PERMISSIONS } from "../src/lib/auth/permissions";
import { DEMO_PASSWORD } from "../src/lib/demo/accounts";
import { generalAverage, rankEntries, round2 } from "../src/lib/domain/grades";

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });

// ---------------------------------------------------------------------------
// Deterministic randomness
// ---------------------------------------------------------------------------

let state = 20260925;
function rand() {
  state |= 0;
  state = (state + 0x6d2b79f5) | 0;
  let t = Math.imul(state ^ (state >>> 15), 1 | state);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const int = (min: number, max: number) => min + Math.floor(rand() * (max - min + 1));
const pick = <T,>(list: readonly T[]) => list[Math.floor(rand() * list.length)]!;
function normal(mean: number, sd: number) {
  const u = 1 - rand();
  const v = rand();
  return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}
const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));
const id = () => randomUUID();
const slug = (s: string) =>
  s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

// ---------------------------------------------------------------------------
// Reference data
// ---------------------------------------------------------------------------

const TERRITORY: { code: string; name: string; communes: string[] }[] = [
  { code: "AL", name: "Alibori", communes: ["Banikoara", "Gogounou", "Kandi", "Karimama", "Malanville", "Segbana"] },
  { code: "AK", name: "Atacora", communes: ["Boukoumbé", "Cobly", "Kérou", "Kouandé", "Matéri", "Natitingou", "Péhunco", "Tanguiéta", "Toucountouna"] },
  { code: "AQ", name: "Atlantique", communes: ["Abomey-Calavi", "Allada", "Kpomassè", "Ouidah", "Sô-Ava", "Toffo", "Tori-Bossito", "Zè"] },
  { code: "BO", name: "Borgou", communes: ["Bembèrèkè", "Kalalé", "N'Dali", "Nikki", "Parakou", "Pèrèrè", "Sinendé", "Tchaourou"] },
  { code: "CO", name: "Collines", communes: ["Bantè", "Dassa-Zoumè", "Glazoué", "Ouèssè", "Savalou", "Savè"] },
  { code: "KO", name: "Couffo", communes: ["Aplahoué", "Djakotomey", "Dogbo", "Klouékanmè", "Lalo", "Toviklin"] },
  { code: "DO", name: "Donga", communes: ["Bassila", "Copargo", "Djougou", "Ouaké"] },
  { code: "LI", name: "Littoral", communes: ["Cotonou"] },
  { code: "MO", name: "Mono", communes: ["Athiémé", "Bopa", "Comè", "Grand-Popo", "Houéyogbé", "Lokossa"] },
  { code: "OU", name: "Ouémé", communes: ["Adjarra", "Adjohoun", "Aguégués", "Akpro-Missérété", "Avrankou", "Bonou", "Dangbo", "Porto-Novo", "Sèmè-Kpodji"] },
  { code: "PL", name: "Plateau", communes: ["Adja-Ouèrè", "Ifangni", "Kétou", "Pobè", "Sakété"] },
  { code: "ZO", name: "Zou", communes: ["Abomey", "Agbangnizoun", "Bohicon", "Covè", "Djidja", "Ouinhi", "Za-Kpota", "Zagnanado", "Zogbodomey"] },
];

// Rough weight of each commune in school population, for realistic contrasts.
const BIG_COMMUNES: Record<string, number> = { Cotonou: 4, "Abomey-Calavi": 4, "Porto-Novo": 3, Parakou: 3, Djougou: 2, Bohicon: 2, "Sèmè-Kpodji": 2, Kandi: 2 };

const LEVELS = [
  { code: "CI", name: "CI", cycle: "PRIMARY", order: 1 },
  { code: "CP", name: "CP", cycle: "PRIMARY", order: 2 },
  { code: "CE1", name: "CE1", cycle: "PRIMARY", order: 3 },
  { code: "CE2", name: "CE2", cycle: "PRIMARY", order: 4 },
  { code: "CM1", name: "CM1", cycle: "PRIMARY", order: 5 },
  { code: "CM2", name: "CM2", cycle: "PRIMARY", order: 6 },
  { code: "6E", name: "6e", cycle: "SECONDARY", order: 7 },
  { code: "5E", name: "5e", cycle: "SECONDARY", order: 8 },
  { code: "4E", name: "4e", cycle: "SECONDARY", order: 9 },
  { code: "3E", name: "3e", cycle: "SECONDARY", order: 10 },
  { code: "2NDE", name: "2nde", cycle: "SECONDARY", order: 11 },
  { code: "1ERE", name: "1ère", cycle: "SECONDARY", order: 12 },
  { code: "TLE", name: "Tle", cycle: "SECONDARY", order: 13 },
] as const;

const SECONDARY_SUBJECTS = [
  { code: "FR", name: "Français", coef: 3 },
  { code: "MATH", name: "Mathématiques", coef: 3 },
  { code: "ANG", name: "Anglais", coef: 2 },
  { code: "HG", name: "Histoire-Géographie", coef: 2 },
  { code: "SVT", name: "Sciences de la vie et de la terre", coef: 2 },
  { code: "PCT", name: "Physique, chimie et technologie", coef: 2 },
  { code: "EPS", name: "Éducation physique et sportive", coef: 1 },
];
const PRIMARY_SUBJECTS = [
  { code: "P-FR", name: "Français", coef: 3 },
  { code: "P-MATH", name: "Mathématiques", coef: 3 },
  { code: "P-EST", name: "Éducation scientifique et technologique", coef: 2 },
  { code: "P-ES", name: "Éducation sociale", coef: 2 },
  { code: "P-EA", name: "Éducation artistique", coef: 1 },
  { code: "P-EPS", name: "Éducation physique et sportive", coef: 1 },
];

const FIRST_F = ["Afiavi", "Akouavi", "Sènami", "Ayaba", "Houéfa", "Nafissatou", "Rachidatou", "Chimène", "Grâce", "Mireille", "Pélagie", "Bénédicta", "Esther", "Fifamè", "Sèdami", "Aïcha", "Mariam", "Rosine", "Carine", "Estelle", "Laurelle", "Fadilatou", "Olga", "Prisca", "Ruth"];
const FIRST_M = ["Koffi", "Codjo", "Comlan", "Mahougnon", "Arnaud", "Ulrich", "Romaric", "Fiacre", "Brice", "Ibrahim", "Moussa", "Soulé", "Saka", "Orou", "Sabi", "Yacoubou", "Kamarou", "Rodrigue", "Gildas", "Jonas", "Aristide", "Mathias", "Florentin", "Sèdjro", "Rachad"];
const LAST = ["Adjovi", "Agossou", "Ahouandjinou", "Akpovi", "Amoussou", "Assogba", "Avocè", "Azonhiho", "Dossou", "Gbaguidi", "Hounkpatin", "Houngbédji", "Kiki", "Kpadonou", "Lokossou", "Sossou", "Tossou", "Houénou", "Agbodjogbé", "Adéoti", "Akanni", "Olatoundji", "Idrissou", "Adékambi", "Sanni", "Chabi", "Worou", "Gounou", "Bani", "Issifou", "Alassane", "Salifou", "Mama", "Yessoufou", "Dègbo", "Zannou", "Hounsa", "Tchibozo", "Ahouansou", "Kakpo"];
const PROFESSIONS = ["Commerçante", "Agriculteur", "Enseignante", "Couturière", "Mécanicien", "Infirmière", "Conducteur de taxi-moto", "Fonctionnaire", "Artisan", "Pêcheur", "Revendeuse", "Menuisier"];

function person(gender?: "F" | "M") {
  const g = gender ?? (rand() < 0.49 ? "F" : "M");
  return { gender: g, firstName: pick(g === "F" ? FIRST_F : FIRST_M), lastName: pick(LAST) } as const;
}
const phone = () => `01${pick(["90", "91", "94", "95", "96", "97", "61", "62", "66", "67"])}${String(int(0, 999999)).padStart(6, "0")}`;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function chunked<T>(rows: T[], size: number, insert: (batch: T[]) => Promise<unknown>) {
  for (let i = 0; i < rows.length; i += size) await insert(rows.slice(i, i + size));
}

function schoolDays(from: string, to: string) {
  const days: Date[] = [];
  for (let d = new Date(`${from}T00:00:00Z`); d <= new Date(`${to}T00:00:00Z`); d = new Date(d.getTime() + 86400000)) {
    const wd = d.getUTCDay();
    if (wd !== 0 && wd !== 6) days.push(d);
  }
  return days;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const existing = await db.user.count().catch(() => 0);
  if (existing > 0 && process.env.SEED_RESET !== "true") {
    console.log(`Database already holds ${existing} users. Set SEED_RESET=true to wipe and reseed. Nothing done.`);
    return;
  }

  console.time("seed");
  const tables = await db.$queryRaw<{ tablename: string }[]>`SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  if (tables.length) await db.$executeRawUnsafe(`TRUNCATE TABLE ${tables.map((t) => `"${t.tablename}"`).join(", ")} CASCADE`);

  const passwordHash = await hash(DEMO_PASSWORD, { memoryCost: 19456, timeCost: 2, parallelism: 1 });

  // Permissions and roles --------------------------------------------------
  await db.permission.createMany({ data: PERMISSIONS.map((p) => ({ ...p, id: id() })) });
  const permIds = new Map((await db.permission.findMany()).map((p) => [p.code, p.id]));
  const roleIds: Record<string, string> = {};
  for (const role of DEFAULT_ROLES) {
    const r = await db.role.create({
      data: { code: role.code, name: role.name, description: role.description, scopeLevel: role.scopeLevel, isSystem: true },
    });
    roleIds[role.code] = r.id;
    await db.rolePermission.createMany({ data: role.permissions.map((code) => ({ roleId: r.id, permissionId: permIds.get(code)! })) });
  }

  // Territory ----------------------------------------------------------------
  const communes: { id: string; name: string; departmentId: string; departmentName: string }[] = [];
  const departments: Record<string, string> = {};
  for (const dep of TERRITORY) {
    const d = await db.department.create({ data: { code: dep.code, name: dep.name } });
    departments[dep.name] = d.id;
    for (const name of dep.communes) communes.push({ id: id(), name, departmentId: d.id, departmentName: dep.name });
  }
  await db.commune.createMany({ data: communes.map(({ id, name, departmentId }) => ({ id, name, departmentId })) });
  const communeByName = new Map(communes.map((c) => [c.name, c]));

  // Calendar -----------------------------------------------------------------
  const prevYear = await db.academicYear.create({
    data: { label: "2025-2026", startDate: new Date("2025-09-22"), endDate: new Date("2026-07-03"), isActive: false },
  });
  const year = await db.academicYear.create({
    data: { label: "2026-2027", startDate: new Date("2026-09-14"), endDate: new Date("2027-07-02"), isActive: true },
  });
  const prevPeriods = await Promise.all(
    [
      ["Trimestre 1", "2025-09-22", "2025-12-19"],
      ["Trimestre 2", "2026-01-05", "2026-03-27"],
      ["Trimestre 3", "2026-04-13", "2026-07-03"],
    ].map(([name, s, e], i) =>
      db.schoolPeriod.create({ data: { academicYearId: prevYear.id, name: name!, order: i + 1, startDate: new Date(s!), endDate: new Date(e!), isClosed: true } }),
    ),
  );
  const periods = await Promise.all(
    [
      ["Trimestre 1", "2026-09-14", "2026-12-18"],
      ["Trimestre 2", "2027-01-04", "2027-03-26"],
      ["Trimestre 3", "2027-04-12", "2027-07-02"],
    ].map(([name, s, e], i) =>
      db.schoolPeriod.create({ data: { academicYearId: year.id, name: name!, order: i + 1, startDate: new Date(s!), endDate: new Date(e!) } }),
    ),
  );

  await db.academicLevel.createMany({ data: LEVELS.map((l) => ({ ...l, id: id() })) });
  const levels = new Map((await db.academicLevel.findMany()).map((l) => [l.code, l]));
  await db.subject.createMany({ data: [...SECONDARY_SUBJECTS, ...PRIMARY_SUBJECTS].map(({ code, name }) => ({ id: id(), code, name })) });
  const subjects = new Map((await db.subject.findMany()).map((s) => [s.code, s.id]));

  // Schools ------------------------------------------------------------------
  type SchoolPlan = { id: string; code: string; name: string; cycle: "PRIMARY" | "SECONDARY"; communeId: string; communeName: string; detailed: boolean; quality: number };
  const schools: SchoolPlan[] = [];
  let seq = 0;
  const pushSchool = (commune: (typeof communes)[number], cycle: "PRIMARY" | "SECONDARY", name: string, detailed = false) => {
    seq++;
    // School level effect on results: urban schools slightly ahead, but with
    // real spread, so the maps and rankings have something to show.
    const urban = BIG_COMMUNES[commune.name] ? 0.6 : 0;
    schools.push({ id: id(), code: `BJ-${String(seq).padStart(4, "0")}`, name, cycle, communeId: commune.id, communeName: commune.name, detailed, quality: normal(urban, 1.1) });
  };

  const godomey = communeByName.get("Abomey-Calavi")!;
  pushSchool(godomey, "SECONDARY", "CEG Godomey", true);
  pushSchool(godomey, "PRIMARY", "EPP Godomey Centre", true);

  const QUARTERS = ["Centre", "Nord", "Sud", "Plateau", "Zongo", "Gare", "Marché", "Kpota", "Houédo", "Agla"];
  for (const commune of communes) {
    const weight = BIG_COMMUNES[commune.name] ?? 1;
    for (let i = 0; i < weight; i++) {
      const suffix = weight > 1 ? ` ${QUARTERS[i % QUARTERS.length]}` : "";
      if (!(commune.name === "Abomey-Calavi" && i === 0)) {
        pushSchool(commune, "SECONDARY", `CEG ${commune.name}${suffix}`);
        pushSchool(commune, "PRIMARY", `EPP ${commune.name}${suffix}`);
      }
    }
  }
  await db.school.createMany({
    data: schools.map((s) => ({
      id: s.id,
      code: s.code,
      name: s.name,
      sector: s.detailed ? "PUBLIC" : pick(["PUBLIC", "PUBLIC", "PUBLIC", "PRIVATE", "CONFESSIONAL", "COMMUNITY"] as const),
      cycle: s.cycle,
      communeId: s.communeId,
      phone: phone(),
      email: `${slug(s.name)}@ecoles.classeo.bj`,
    })),
  });
  const ceg = schools[0]!;
  const epp = schools[1]!;

  // Staff users (created before teachers so the demo teacher can be linked)
  const users: Prisma.UserCreateManyInput[] = [];
  const addUser = (u: Omit<Prisma.UserCreateManyInput, "passwordHash" | "id"> & { id?: string }) => {
    const row = { id: u.id ?? id(), passwordHash, ...u };
    users.push(row);
    return row.id;
  };
  const ministerId = addUser({ email: "ministre@classeo.bj", firstName: "Adjoa", lastName: "Houngbédji", gender: "F", roleId: roleIds.NATIONAL_ADMIN!, scopeLevel: "NATIONAL" });
  addUser({ email: "analyste@classeo.bj", firstName: "Rodrigue", lastName: "Kpadonou", gender: "M", roleId: roleIds.NATIONAL_ANALYST!, scopeLevel: "NATIONAL" });
  addUser({ email: "partenaire@classeo.bj", firstName: "Estelle", lastName: "Amoussou", gender: "F", roleId: roleIds.PARTNER!, scopeLevel: "NATIONAL" });
  const ddempIds: Record<string, string> = {};
  for (const dep of TERRITORY) {
    const p = person();
    ddempIds[dep.name] = addUser({
      email: `ddemp.${slug(dep.name)}@classeo.bj`,
      firstName: p.firstName,
      lastName: p.lastName,
      gender: p.gender,
      roleId: roleIds.DEPARTMENT_DIRECTOR!,
      scopeLevel: "DEPARTMENT",
      departmentId: departments[dep.name],
    });
  }
  for (const name of ["Abomey-Calavi", "Cotonou", "Parakou"]) {
    const p = person();
    addUser({
      email: `cs.${slug(name)}@classeo.bj`,
      firstName: p.firstName,
      lastName: p.lastName,
      gender: p.gender,
      roleId: roleIds.COMMUNE_INSPECTOR!,
      scopeLevel: "COMMUNE",
      communeId: communeByName.get(name)!.id,
    });
  }
  const directorId = addUser({ email: "directeur@classeo.bj", firstName: "Florentin", lastName: "Agossou", gender: "M", roleId: roleIds.SCHOOL_DIRECTOR!, scopeLevel: "SCHOOL", schoolId: ceg.id });
  addUser({ email: "secretaire@classeo.bj", firstName: "Pélagie", lastName: "Tossou", gender: "F", roleId: roleIds.SECRETARY!, scopeLevel: "SCHOOL", schoolId: ceg.id });
  const accountantId = addUser({ email: "comptable@classeo.bj", firstName: "Gildas", lastName: "Sossou", gender: "M", roleId: roleIds.ACCOUNTANT!, scopeLevel: "SCHOOL", schoolId: ceg.id });
  addUser({ email: "directrice.epp@classeo.bj", firstName: "Mireille", lastName: "Dossou", gender: "F", roleId: roleIds.SCHOOL_DIRECTOR!, scopeLevel: "SCHOOL", schoolId: epp.id });

  // Classes, teachers, students ----------------------------------------------
  const SECONDARY_CLASSES = ["6E", "5E", "4E", "3E"];
  const PRIMARY_CLASSES = ["CE2", "CM1", "CM2"];
  const CEG_DETAILED = ["6E:A", "6E:B", "5E:A", "4E:A", "3E:A", "2NDE:C", "1ERE:D", "TLE:D"];

  const teachers: Prisma.TeacherCreateManyInput[] = [];
  const classrooms: Prisma.ClassroomCreateManyInput[] = [];
  const assignments: (Prisma.CourseAssignmentCreateManyInput & { schoolId: string; subjectCode: string })[] = [];
  const students: Prisma.StudentCreateManyInput[] = [];
  const enrollments: Prisma.EnrollmentCreateManyInput[] = [];
  const studentMeta = new Map<string, { ability: number; schoolId: string; classroomId: string; enrollmentId: string; prevEnrollmentId?: string; prevClassroomId?: string }>();
  let teacherSeq = 0;
  let studentSeq = 0;
  let demoTeacherId = "";
  let demoStudentId = "";

  const prevClassroomOf = new Map<string, string>(); // current classroom -> previous year classroom

  for (const school of schools) {
    const isSec = school.cycle === "SECONDARY";
    const subjectList = isSec ? SECONDARY_SUBJECTS : PRIMARY_SUBJECTS;
    const classSpecs = school.id === ceg.id ? CEG_DETAILED : (isSec ? SECONDARY_CLASSES : PRIMARY_CLASSES).map((c) => `${c}:A`);

    // Secondary: one teacher per subject. Primary: one teacher per class.
    const subjectTeacher = new Map<string, string>();
    if (isSec) {
      for (const s of subjectList) {
        const p = person();
        const tId = id();
        teachers.push({ id: tId, schoolId: school.id, matricule: `ENS-${String(++teacherSeq).padStart(5, "0")}`, firstName: p.firstName, lastName: p.lastName, gender: p.gender, phone: phone(), specialty: s.name });
        subjectTeacher.set(s.code, tId);
        if (school.id === ceg.id && s.code === "MATH") demoTeacherId = tId;
      }
    }

    for (const spec of classSpecs) {
      const [levelCode, letter] = spec.split(":") as [string, string];
      const level = levels.get(levelCode)!;
      const classroomId = id();
      let classTeacher: string | undefined;
      if (!isSec) {
        const p = person();
        classTeacher = id();
        teachers.push({ id: classTeacher, schoolId: school.id, matricule: `ENS-${String(++teacherSeq).padStart(5, "0")}`, firstName: p.firstName, lastName: p.lastName, gender: p.gender, phone: phone(), specialty: "Enseignement primaire" });
      }
      classrooms.push({
        id: classroomId,
        schoolId: school.id,
        academicYearId: year.id,
        levelId: level.id,
        name: `${level.name} ${letter}`,
        capacity: isSec ? 60 : 50,
        mainTeacherId: classTeacher ?? subjectTeacher.get(isSec ? pick(["FR", "MATH", "HG"]) : "")!,
      });
      for (const s of subjectList) {
        assignments.push({ id: id(), classroomId, subjectId: subjects.get(s.code)!, teacherId: isSec ? subjectTeacher.get(s.code)! : classTeacher!, coefficient: s.coef, weeklyHours: s.coef + 1, schoolId: school.id, subjectCode: s.code });
      }

      // Previous year classroom one level below, same school, for history.
      const prevLevel = LEVELS.find((l) => l.order === level.order - 1 && l.cycle === level.cycle);
      let prevClassroomId: string | undefined;
      if (prevLevel) {
        prevClassroomId = id();
        classrooms.push({ id: prevClassroomId, schoolId: school.id, academicYearId: prevYear.id, levelId: levels.get(prevLevel.code)!.id, name: `${prevLevel.name} ${letter}`, capacity: 60 });
        prevClassroomOf.set(classroomId, prevClassroomId);
      }

      const size = school.detailed ? int(30, 38) : int(14, 24);
      for (let k = 0; k < size; k++) {
        const p = person();
        const studentId = id();
        const age = (isSec ? 11 : 8) + (level.order - (isSec ? 7 : 4)) + (rand() < 0.2 ? 1 : 0);
        const disabilities: ("VISUAL" | "HEARING" | "MOTOR" | "COGNITIVE")[] = rand() < 0.035 ? [pick(["VISUAL", "HEARING", "MOTOR", "COGNITIVE"] as const)] : [];
        students.push({
          id: studentId,
          matricule: `BJ${year.label.slice(2, 4)}${String(++studentSeq).padStart(6, "0")}`,
          firstName: p.firstName,
          lastName: p.lastName,
          gender: p.gender,
          birthDate: new Date(Date.UTC(2026 - age, int(0, 11), int(1, 28))),
          birthPlace: school.communeName,
          disabilities,
        });
        const enrollmentId = id();
        enrollments.push({ id: enrollmentId, studentId, schoolId: school.id, classroomId, academicYearId: year.id, isRepeating: rand() < 0.08 });
        const meta: { ability: number; schoolId: string; classroomId: string; enrollmentId: string; prevEnrollmentId?: string; prevClassroomId?: string } = {
          ability: normal(10.6 + school.quality * 0.9 + (p.gender === "F" ? 0.15 : 0), 2.6),
          schoolId: school.id,
          classroomId,
          enrollmentId,
        };
        if (prevClassroomId) {
          meta.prevEnrollmentId = id();
          meta.prevClassroomId = prevClassroomId;
          enrollments.push({ id: meta.prevEnrollmentId, studentId, schoolId: school.id, classroomId: prevClassroomId, academicYearId: prevYear.id });
        }
        studentMeta.set(studentId, meta);
        if (school.id === ceg.id && levelCode === "3E" && k === 0) demoStudentId = studentId;
      }
    }
  }

  // Link the demo teacher to a user account; other CEG Godomey teachers get
  // accounts too so messaging works across the school.
  const teacherUserIds = new Map<string, string>();
  for (const t of teachers.filter((t) => t.schoolId === ceg.id || t.schoolId === epp.id)) {
    const isDemo = t.id === demoTeacherId;
    const uid = addUser({
      email: isDemo ? "enseignant@classeo.bj" : `${slug(t.firstName)}.${slug(t.lastName)}.${String(t.matricule).slice(-3)}@ecoles.classeo.bj`,
      firstName: t.firstName,
      lastName: t.lastName,
      gender: t.gender,
      phone: t.phone,
      roleId: roleIds.TEACHER!,
      scopeLevel: "SCHOOL",
      schoolId: t.schoolId,
    });
    teacherUserIds.set(t.id!, uid);
    t.userId = uid;
  }

  // Demo family: the demo student (3e A, CEG Godomey) and a younger sibling
  // at EPP Godomey Centre, both followed by the demo parent.
  const demoStudent = students.find((s) => s.id === demoStudentId)!;
  demoStudent.firstName = "Sènami";
  demoStudent.lastName = "Hounkpatin";
  demoStudent.gender = "F";
  const sibling = students.find((s) => studentMeta.get(s.id!)?.schoolId === epp.id && students.indexOf(s) % 7 === 3)!;
  sibling.firstName = "Mahougnon";
  sibling.lastName = "Hounkpatin";
  sibling.gender = "M";
  const studentUserId = addUser({ email: "eleve@classeo.bj", firstName: "Sènami", lastName: "Hounkpatin", gender: "F", roleId: roleIds.STUDENT!, scopeLevel: "SELF" });
  demoStudent.userId = studentUserId;
  const parentUserId = addUser({ email: "parent@classeo.bj", firstName: "Afiavi", lastName: "Hounkpatin", gender: "F", phone: "0196123456", roleId: roleIds.PARENT!, scopeLevel: "SELF" });

  await chunked(users, 500, (b) => db.user.createMany({ data: b }));
  await chunked(teachers, 2000, (b) => db.teacher.createMany({ data: b }));
  await chunked(classrooms, 2000, (b) => db.classroom.createMany({ data: b }));
  await chunked(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    assignments.map(({ schoolId, subjectCode, ...a }) => a),
    3000,
    (b) => db.courseAssignment.createMany({ data: b }),
  );
  await chunked(students, 3000, (b) => db.student.createMany({ data: b }));
  await chunked(enrollments, 3000, (b) => db.enrollment.createMany({ data: b }));
  console.log(`schools ${schools.length}, teachers ${teachers.length}, students ${students.length}, enrollments ${enrollments.length}`);

  // Guardians for the detailed schools, the demo parent first ----------------
  const guardians: Prisma.GuardianCreateManyInput[] = [];
  const links: Prisma.StudentGuardianCreateManyInput[] = [];
  const demoGuardianId = id();
  guardians.push({ id: demoGuardianId, userId: parentUserId, firstName: "Afiavi", lastName: "Hounkpatin", phone: "0196123456", profession: "Commerçante", preferredChannel: "VOICE_CALL", prefersAudio: true });
  links.push({ studentId: demoStudent.id!, guardianId: demoGuardianId, relationship: "Mère", isPrimary: true });
  links.push({ studentId: sibling.id!, guardianId: demoGuardianId, relationship: "Mère", isPrimary: true });
  for (const s of students) {
    const meta = studentMeta.get(s.id!)!;
    if ((meta.schoolId !== ceg.id && meta.schoolId !== epp.id) || s.id === demoStudent.id || s.id === sibling.id) continue;
    const gId = id();
    const mother = rand() < 0.6;
    const p = person(mother ? "F" : "M");
    guardians.push({ id: gId, firstName: p.firstName, lastName: s.lastName, phone: phone(), profession: pick(PROFESSIONS), preferredChannel: pick(["APP", "SMS", "VOICE_CALL"] as const), prefersAudio: rand() < 0.35 });
    links.push({ studentId: s.id!, guardianId: gId, relationship: mother ? "Mère" : "Père", isPrimary: true });
  }
  await chunked(guardians, 2000, (b) => db.guardian.createMany({ data: b }));
  await chunked(links, 2000, (b) => db.studentGuardian.createMany({ data: b }));

  // Last year's published report cards, three terms, every school -----------
  const reportCards: Prisma.ReportCardCreateManyInput[] = [];
  const byPrevClass = new Map<string, string[]>();
  for (const [sid, m] of studentMeta) if (m.prevClassroomId) byPrevClass.set(m.prevClassroomId, [...(byPrevClass.get(m.prevClassroomId) ?? []), sid]);
  const classSchool = new Map(classrooms.map((c) => [c.id!, c.schoolId]));
  const schoolCycle = new Map(schools.map((s) => [s.id, s.cycle]));
  for (const [prevClassId, sids] of byPrevClass) {
    const subjectList = schoolCycle.get(classSchool.get(prevClassId)!) === "SECONDARY" ? SECONDARY_SUBJECTS : PRIMARY_SUBJECTS;
    prevPeriods.forEach((period, pIndex) => {
      const rows = sids.map((sid) => {
        const m = studentMeta.get(sid)!;
        const lines = subjectList.map((s) => ({ subject: s.name, coefficient: s.coef, average: round2(clamp(normal(m.ability + pIndex * 0.25, 2.2), 1, 19.5)), rank: null as number | null }));
        return { sid, m, lines, avg: generalAverage(lines) };
      });
      const ranks = rankEntries(rows, (r) => r.avg);
      for (const s of subjectList) {
        const subjectRanks = rankEntries(rows, (r) => r.lines.find((l) => l.subject === s.name)!.average);
        rows.forEach((r) => (r.lines.find((l) => l.subject === s.name)!.rank = subjectRanks.get(r)!));
      }
      for (const r of rows) {
        reportCards.push({
          id: id(),
          enrollmentId: r.m.prevEnrollmentId!,
          periodId: period.id,
          generalAverage: r.avg,
          rank: ranks.get(r) ?? null,
          classSize: rows.length,
          appreciation: r.avg === null ? null : r.avg >= 14 ? "Très bon travail, continuez ainsi." : r.avg >= 10 ? "Travail satisfaisant, peut mieux faire." : "Résultats insuffisants, un soutien est recommandé.",
          lines: r.lines,
          publishedAt: new Date(period.endDate.getTime() + 7 * 86400000),
          publishedById: ministerId,
        });
      }
    });
  }
  await chunked(reportCards, 2500, (b) => db.reportCard.createMany({ data: b }));
  console.log(`report cards ${reportCards.length}`);

  // Current term grade sheets for the two detailed schools -------------------
  // Interrogation 1 and the devoir are entered, the rest is left for the
  // live demonstration.
  const detailedAssignments = assignments.filter((a) => a.schoolId === ceg.id || a.schoolId === epp.id);
  const t1 = periods[0]!;
  const sheets: Prisma.GradeSheetCreateManyInput[] = [];
  const grades: Prisma.GradeCreateManyInput[] = [];
  const studentsByClass = new Map<string, string[]>();
  for (const [sid, m] of studentMeta) studentsByClass.set(m.classroomId, [...(studentsByClass.get(m.classroomId) ?? []), sid]);
  for (const a of detailedAssignments) {
    const sheetId = id();
    sheets.push({ id: sheetId, assignmentId: a.id!, periodId: t1.id, formula: "WEIGHTED_STANDARD", interrogationCount: 2, devoirCount: 1, compositionCount: 1 });
    const graderId = teacherUserIds.get(a.teacherId!) ?? directorId;
    for (const sid of studentsByClass.get(a.classroomId) ?? []) {
      const m = studentMeta.get(sid)!;
      grades.push({ id: id(), gradeSheetId: sheetId, enrollmentId: m.enrollmentId, type: "INTERROGATION", sequence: 1, value: round2(clamp(Math.round(normal(m.ability, 3) * 2) / 2, 0, 20)), maxValue: 20, gradedById: graderId });
      if (rand() < 0.85)
        grades.push({ id: id(), gradeSheetId: sheetId, enrollmentId: m.enrollmentId, type: "DEVOIR", sequence: 1, value: round2(clamp(Math.round(normal(m.ability, 2.5) * 2) / 2, 0, 20)), maxValue: 20, gradedById: graderId });
    }
  }
  await chunked(sheets, 2000, (b) => db.gradeSheet.createMany({ data: b }));
  await chunked(grades, 4000, (b) => db.grade.createMany({ data: b }));

  // Attendance: every school day since the start of term for the detailed
  // schools, the last three days everywhere else ------------------------------
  const attendance: Prisma.StudentAttendanceCreateManyInput[] = [];
  const allDays = schoolDays("2026-09-14", "2026-09-25");
  const recentDays = allDays.slice(-3);
  const absences: { sid: string; date: Date }[] = [];
  for (const [sid, m] of studentMeta) {
    const detailed = m.schoolId === ceg.id || m.schoolId === epp.id;
    const absentRisk = clamp(0.1 - (m.ability - 10) * 0.012, 0.01, 0.25);
    for (const date of detailed ? allDays : recentDays) {
      for (const half of ["MORNING", "AFTERNOON"] as const) {
        const r = rand();
        const status = r < absentRisk ? "ABSENT" : r < absentRisk + 0.04 ? "LATE" : "PRESENT";
        if (sid === demoStudent.id && half === "MORNING" && date.getTime() === allDays[allDays.length - 2]!.getTime()) {
          attendance.push({ id: id(), enrollmentId: m.enrollmentId, date, half, status: "ABSENT", recordedById: directorId });
          absences.push({ sid, date });
          continue;
        }
        attendance.push({ id: id(), enrollmentId: m.enrollmentId, date, half, status, recordedById: detailed ? directorId : ministerId, reason: status === "ABSENT" && rand() < 0.3 ? pick(["Maladie", "Raison familiale", "Transport"]) : null });
      }
    }
  }
  await chunked(attendance, 5000, (b) => db.studentAttendance.createMany({ data: b }));
  const teacherAttendance: Prisma.TeacherAttendanceCreateManyInput[] = [];
  for (const t of teachers) for (const date of recentDays) teacherAttendance.push({ id: id(), teacherId: t.id!, date, status: rand() < 0.05 ? "ABSENT" : "PRESENT" });
  await chunked(teacherAttendance, 5000, (b) => db.teacherAttendance.createMany({ data: b }));
  console.log(`attendance ${attendance.length}`);

  // Content ------------------------------------------------------------------
  const now = new Date("2026-09-25T08:00:00Z");
  const demoClassroomId = studentMeta.get(demoStudent.id!)!.classroomId;
  await db.content.createMany({
    data: [
      {
        type: "ANNOUNCEMENT",
        title: "Rentrée scolaire 2026-2027",
        easyRead: "L'école a repris le lundi 14 septembre. Les inscriptions restent ouvertes jusqu'au 9 octobre.",
        body: "Le ministère informe les parents, les élèves et les enseignants que la rentrée scolaire 2026-2027 a eu lieu le lundi 14 septembre 2026 sur toute l'étendue du territoire national. Les inscriptions et réinscriptions se poursuivent jusqu'au vendredi 9 octobre 2026 dans tous les établissements publics et privés.",
        audience: "EVERYONE",
        mediaType: "AUDIO",
        mediaUrl: null,
        transcript: "Chers parents, chers élèves, chers enseignants. La rentrée scolaire 2026-2027 a eu lieu le lundi 14 septembre. Les inscriptions se poursuivent jusqu'au 9 octobre. Bonne année scolaire à toutes et à tous.",
        status: "PUBLISHED",
        publishedAt: new Date("2026-09-10T09:00:00Z"),
        authorId: ministerId,
      },
      {
        type: "ANNOUNCEMENT",
        title: "Campagne nationale de vaccination en milieu scolaire",
        easyRead: "Une équipe de santé passera dans les écoles du 5 au 16 octobre. La vaccination est gratuite.",
        body: "En partenariat avec le ministère de la Santé, une campagne de vaccination gratuite sera organisée dans les établissements du 5 au 16 octobre 2026. Les parents qui ne souhaitent pas faire vacciner leur enfant doivent en informer le chef d'établissement.",
        audience: "PARENTS",
        status: "PUBLISHED",
        publishedAt: new Date("2026-09-22T10:00:00Z"),
        authorId: ministerId,
      },
      {
        type: "ANNOUNCEMENT",
        title: "Conférence pédagogique départementale",
        easyRead: "Les enseignants de l'Atlantique se réunissent le samedi 3 octobre à Allada.",
        body: "La direction départementale de l'Atlantique convie tous les enseignants du premier cycle à la conférence pédagogique de rentrée, le samedi 3 octobre 2026 à 9 heures, au CEG Allada.",
        audience: "TEACHERS",
        status: "PUBLISHED",
        publishedAt: new Date("2026-09-20T08:00:00Z"),
        departmentId: departments["Atlantique"],
        authorId: ddempIds["Atlantique"]!,
      },
      {
        type: "EVENT",
        title: "Réunion des parents d'élèves",
        easyRead: "Réunion des parents le samedi 10 octobre à 10 heures, dans la cour du collège.",
        body: "Le chef d'établissement invite tous les parents d'élèves à la réunion de rentrée le samedi 10 octobre 2026 à 10 heures. Ordre du jour : organisation de l'année, élection du bureau de l'association des parents, questions diverses. Une interprétation en fon et en langue des signes sera assurée.",
        audience: "PARENTS",
        status: "PUBLISHED",
        publishedAt: new Date("2026-09-24T12:00:00Z"),
        eventDate: new Date("2026-10-10T09:00:00Z"), // 10:00 in Benin (UTC+1)
        schoolId: ceg.id,
        authorId: directorId,
      },
      {
        type: "RESOURCE",
        title: "Fiche de révision : les nombres relatifs",
        easyRead: "Une fiche pour revoir l'addition et la soustraction des nombres relatifs.",
        body: "Cette fiche reprend les règles de calcul sur les nombres relatifs vues en classe : addition, soustraction, règle des signes. Des exercices corrigés sont proposés à la fin.",
        subjectLabel: "Mathématiques",
        audience: "STUDENTS",
        mediaType: "VIDEO",
        transcript: "Bonjour à tous. Aujourd'hui nous revoyons les nombres relatifs. Un nombre relatif est un nombre positif ou négatif. Pour additionner deux nombres de même signe, on additionne leurs distances à zéro et on garde le signe...",
        status: "PUBLISHED",
        publishedAt: new Date("2026-09-23T15:00:00Z"),
        schoolId: ceg.id,
        classroomId: demoClassroomId,
        authorId: teacherUserIds.get(demoTeacherId)!,
      },
      {
        type: "ANNOUNCEMENT",
        title: "Projet de calendrier des compositions du premier trimestre",
        body: "Brouillon en cours de validation par le conseil des professeurs.",
        audience: "STAFF",
        status: "DRAFT",
        schoolId: ceg.id,
        authorId: directorId,
      },
    ],
  });

  // Messaging and notifications ----------------------------------------------
  const conv = await db.conversation.create({
    data: {
      subject: "Suivi de Sènami en mathématiques",
      participants: { create: [{ userId: parentUserId }, { userId: teacherUserIds.get(demoTeacherId)! }] },
    },
  });
  await db.message.createMany({
    data: [
      { conversationId: conv.id, senderId: teacherUserIds.get(demoTeacherId)!, body: "Bonjour Madame Hounkpatin. Sènami a bien commencé l'année, mais elle a manqué le cours de mercredi matin. Pouvez-vous me dire si tout va bien ?", createdAt: new Date("2026-09-24T16:10:00Z") },
      { conversationId: conv.id, senderId: parentUserId, body: "Bonjour Monsieur. Elle était malade, elle va mieux. Merci de m'avoir prévenue.", createdAt: new Date("2026-09-24T18:42:00Z") },
    ],
  });
  await db.notification.createMany({
    data: [
      ...absences.map((a) => ({ userId: parentUserId, kind: "absence", title: "Absence signalée", body: `Sènami était absente le ${a.date.toLocaleDateString("fr-FR", { timeZone: "UTC" })} au matin.`, link: "/espace/suivi", createdAt: new Date(a.date.getTime() + 11 * 3600000) })),
      { userId: parentUserId, kind: "message", title: "Nouveau message", body: "Le professeur de mathématiques vous a écrit.", link: `/espace/messages/${conv.id}`, createdAt: new Date("2026-09-24T16:10:00Z") },
      { userId: parentUserId, kind: "report_card", title: "Bulletin disponible", body: "Le bulletin du 3e trimestre 2025-2026 de Sènami est disponible.", link: "/espace/suivi", readAt: now, createdAt: new Date("2026-07-10T09:00:00Z") },
      { userId: directorId, kind: "request", title: "Demande en cours d'examen", body: "Votre demande d'enseignants supplémentaires est en cours d'examen par la circonscription.", link: "/espace/demandes" },
    ],
  });

  // Requests from schools up the ministry chain ------------------------------
  const atlanticSchools = schools.filter((s) => communeByName.get(s.communeName)!.departmentName === "Atlantique").slice(0, 6);
  await db.schoolRequest.createMany({
    data: [
      { schoolId: ceg.id, type: "STAFFING", subject: "Besoin de deux enseignants de SVT", body: "Les effectifs de 6e ont augmenté de 25 %. Nous sollicitons l'affectation de deux enseignants de SVT pour couvrir toutes les classes.", authorId: directorId, createdAt: new Date("2026-09-18T09:00:00Z") },
      ...atlanticSchools.slice(2).map((s, i) => ({
        schoolId: s.id,
        type: pick(["INFRASTRUCTURE", "YEAR_EXTENSION", "NEW_SUBJECT", "OTHER"] as const),
        subject: ["Réfection de la toiture de deux salles", "Prolongation du premier trimestre", "Ouverture d'une classe d'informatique", "Dotation en tables-bancs"][i % 4]!,
        body: "Demande transmise par le chef d'établissement, pièces justificatives disponibles sur demande.",
        authorId: directorId,
        status: i === 0 ? ("APPROVED" as const) : ("PENDING" as const),
        deciderId: i === 0 ? ddempIds["Atlantique"] : null,
        decidedAt: i === 0 ? new Date("2026-09-21T10:00:00Z") : null,
        decisionNote: i === 0 ? "Accordé, travaux programmés pendant les congés de Toussaint." : null,
      })),
    ],
  });

  // W2: fees, invoices and payments for CEG Godomey --------------------------
  const cegClassLevels = classrooms.filter((c) => c.schoolId === ceg.id && c.academicYearId === year.id);
  const contribution = await db.feeType.create({ data: { schoolId: ceg.id, academicYearId: year.id, name: "Contribution scolaire", amount: 15000 } });
  const ape = await db.feeType.create({ data: { schoolId: ceg.id, academicYearId: year.id, name: "Cotisation APE", amount: 5000 } });
  const plan = await db.paymentPlan.create({
    data: {
      schoolId: ceg.id,
      academicYearId: year.id,
      feeTypeId: contribution.id,
      name: "Contribution en trois tranches",
      installments: {
        create: [
          { label: "Tranche 1", order: 1, percent: 50, dueDate: new Date("2026-10-09") },
          { label: "Tranche 2", order: 2, percent: 30, dueDate: new Date("2027-01-15") },
          { label: "Tranche 3", order: 3, percent: 20, dueDate: new Date("2027-04-16") },
        ],
      },
    },
  });
  void plan;
  let invoiceSeq = 0;
  let paymentSeq = 0;
  for (const c of cegClassLevels) {
    for (const sid of studentsByClass.get(c.id!) ?? []) {
      const m = studentMeta.get(sid)!;
      const total = contribution.amount + ape.amount;
      const r = rand();
      const paid = r < 0.35 ? total : r < 0.7 ? 7500 + ape.amount : r < 0.85 ? ape.amount : 0;
      const invoice = await db.invoice.create({
        data: {
          number: `FAC-2026-${String(++invoiceSeq).padStart(4, "0")}`,
          schoolId: ceg.id,
          enrollmentId: m.enrollmentId,
          totalAmount: total,
          paidAmount: paid,
          status: paid === 0 ? "PENDING" : paid >= total ? "PAID" : "PARTIALLY_PAID",
          issueDate: new Date("2026-09-14"),
          dueDate: new Date("2027-04-16"),
          items: {
            create: [
              { feeTypeId: contribution.id, description: contribution.name, unitPrice: contribution.amount },
              { feeTypeId: ape.id, description: ape.name, unitPrice: ape.amount },
            ],
          },
          installments: {
            create: [
              { label: "Tranche 1 et APE", order: 1, amount: 7500 + ape.amount, paidAmount: Math.min(paid, 7500 + ape.amount), dueDate: new Date("2026-10-09"), status: paid >= 7500 + ape.amount ? "PAID" : paid > 0 ? "PARTIALLY_PAID" : "PENDING" },
              { label: "Tranche 2", order: 2, amount: 4500, paidAmount: Math.max(0, Math.min(4500, paid - 12500)), dueDate: new Date("2027-01-15"), status: paid >= 17000 ? "PAID" : "PENDING" },
              { label: "Tranche 3", order: 3, amount: 3000, paidAmount: Math.max(0, paid - 17000), dueDate: new Date("2027-04-16"), status: paid >= total ? "PAID" : "PENDING" },
            ],
          },
          payments:
            paid > 0
              ? {
                  create: [
                    {
                      reference: `PAY-2026-${String(++paymentSeq).padStart(5, "0")}`,
                      amount: paid,
                      method: pick(["CASH", "MOBILE_MONEY", "MOBILE_MONEY"] as const),
                      paidAt: new Date(Date.UTC(2026, 8, int(14, 25), int(7, 15))),
                      recordedById: accountantId,
                    },
                  ],
                }
              : undefined,
        },
      });
      void invoice;
    }
  }

  // W2: timetable for CEG Godomey --------------------------------------------
  const SLOTS = [
    ["07:00", "09:00"],
    ["09:15", "11:15"],
    ["11:15", "12:15"],
    ["15:00", "17:00"],
  ] as const;
  const slots: Prisma.TimetableSlotCreateManyInput[] = [];
  for (const c of cegClassLevels) {
    const classAssignments = assignments.filter((a) => a.classroomId === c.id);
    let cursor = 0;
    for (let day = 1; day <= 5; day++) {
      for (const [start, end] of SLOTS) {
        if (day === 3 && start === "15:00") continue; // Wednesday afternoon off
        const a = classAssignments[cursor++ % classAssignments.length]!;
        slots.push({ id: id(), assignmentId: a.id!, dayOfWeek: day, startTime: start, endTime: end, room: `Salle ${c.name}` });
      }
    }
  }
  await db.timetableSlot.createMany({ data: slots });

  await db.auditLog.create({ data: { userId: ministerId, action: "seed", resource: "system", summary: "Initialisation des données de démonstration" } });
  console.timeEnd("seed");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
