// Classeo demonstration data.
// Real territory (12 departments, 77 communes), fictitious schools and people.
// Deterministic: the same seed always produces the same data.
//
// Safety: refuses to run on a database that already has users unless
// SEED_RESET=true is set, because it truncates every table first.
//
// The demo accounts get the password of DEMO_PASSWORD. Without it, a local
// run uses the development fallback of src/lib/demo/password.ts and a
// production run (NODE_ENV=production) refuses to start.

import "dotenv/config";

import { randomUUID } from "node:crypto";

import { hash } from "@node-rs/argon2";
import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient, type Prisma } from "../src/generated/prisma/client";
import { DEFAULT_ROLES, PERMISSIONS } from "../src/lib/auth/permissions";
import { nextFreeUsername, usernameBase } from "../src/lib/auth/username";
import { DEMO_ACCOUNTS } from "../src/lib/demo/accounts";
import { resolveDemoPassword } from "../src/lib/demo/password";
import { seedExtras } from "./seed-extras";
import { generalAverage, rankEntries, round2 } from "../src/lib/domain/grades";
import { defaultPeriodicity } from "../src/lib/domain/periodicity";
import { describeConflict, findConflicts, slotTimeError, type PlannedSlot } from "../src/lib/domain/timetable";

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

// Approximate population of each commune, in thousands (2013 census order of
// magnitude). The number of seeded classes follows it, so the maps and
// rankings contrast the way the real country does.
const POPULATION: Record<string, number> = {
  Banikoara: 248, Gogounou: 117, Kandi: 177, Karimama: 66, Malanville: 168, Segbana: 88,
  Boukoumbé: 82, Cobly: 68, Kérou: 100, Kouandé: 112, Matéri: 114, Natitingou: 104, Péhunco: 78, Tanguiéta: 75, Toucountouna: 41,
  "Abomey-Calavi": 656, Allada: 127, Kpomassè: 67, Ouidah: 162, "Sô-Ava": 118, Toffo: 100, "Tori-Bossito": 64, Zè: 106,
  Bembèrèkè: 128, Kalalé: 168, "N'Dali": 114, Nikki: 152, Parakou: 255, Pèrèrè: 78, Sinendé: 92, Tchaourou: 223,
  Bantè: 107, "Dassa-Zoumè": 112, Glazoué: 124, Ouèssè: 142, Savalou: 144, Savè: 88,
  Aplahoué: 171, Djakotomey: 134, Dogbo: 103, Klouékanmè: 128, Lalo: 119, Toviklin: 89,
  Bassila: 131, Copargo: 71, Djougou: 267, Ouaké: 69,
  Cotonou: 679,
  Athiémé: 56, Bopa: 97, Comè: 80, "Grand-Popo": 57, Houéyogbé: 98, Lokossa: 104,
  Adjarra: 97, Adjohoun: 76, Aguégués: 47, "Akpro-Missérété": 128, Avrankou: 128, Bonou: 45, Dangbo: 98, "Porto-Novo": 264, "Sèmè-Kpodji": 222,
  "Adja-Ouèrè": 118, Ifangni: 106, Kétou: 157, Pobè: 124, Sakété: 115,
  Abomey: 92, Agbangnizoun: 72, Bohicon: 171, Covè: 51, Djidja: 124, Ouinhi: 59, "Za-Kpota": 132, Zagnanado: 55, Zogbodomey: 92,
};
// Urban communes: higher enrolment rates and schools that draw pupils from
// the surrounding communes. Cotonou concentrates the most.
const URBAN: Record<string, number> = {
  Cotonou: 2.6, "Abomey-Calavi": 1.5, "Porto-Novo": 2, Parakou: 2, Djougou: 1.6, Bohicon: 2, "Sèmè-Kpodji": 1.6, Ouidah: 1.8, Kandi: 1.7, Natitingou: 2.4, Lokossa: 2.4, Abomey: 2.6,
};
// Current year classes seeded outside the two detailed schools.
const CLASS_BUDGET = 290;

// Weekly hours of each secondary subject, roughly by coefficient.
const SECONDARY_HOURS: Record<string, number> = { FR: 5, MATH: 5, ANG: 3, HG: 3, SVT: 3, PCT: 2, EPS: 2 };

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
// Official coefficients (MESTFP order n° 029 of 2024, annex 2): every
// subject at 1 in 6e and 5e; the national grid in 4e and 3e (Mathématiques
// 3, PCT 2, SVT 2, Français 2 for reading and 2 for writing, Anglais 2,
// Histoire-Géographie 2, EPS 1); a grid per series in the second cycle. The
// seed has a single Français subject, given the reading coefficient. The
// second cycle values other than Mathématiques 6 and PCT 5 in série C come
// from common practice and are to be checked against the annex.
const SERIES_COEFFICIENTS: Record<string, Record<string, number>> = {
  C: { FR: 2, MATH: 6, ANG: 2, HG: 2, SVT: 2, PCT: 5, EPS: 1 },
  D: { FR: 2, MATH: 4, ANG: 2, HG: 2, SVT: 5, PCT: 4, EPS: 1 },
};
const FIRST_CYCLE_UPPER: Record<string, number> = { FR: 2, MATH: 3, ANG: 2, HG: 2, SVT: 2, PCT: 2, EPS: 1 };
function coefficientOf(levelCode: string, stream: string, subject: { code: string; coef: number }) {
  if (levelCode === "6E" || levelCode === "5E") return 1;
  if (levelCode === "4E" || levelCode === "3E") return FIRST_CYCLE_UPPER[subject.code] ?? 1;
  if (levelCode === "2NDE" || levelCode === "1ERE" || levelCode === "TLE") return SERIES_COEFFICIENTS[stream]?.[subject.code] ?? 1;
  return subject.coef;
}

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
  const demoPassword = resolveDemoPassword();
  if (!demoPassword) {
    console.error("DEMO_PASSWORD is not set. A production seed needs the demo account password in DEMO_PASSWORD. Nothing done.");
    process.exitCode = 1;
    return;
  }
  const existing = await db.user.count().catch(() => 0);
  if (existing > 0 && process.env.SEED_RESET !== "true") {
    console.log(`Database already holds ${existing} users. Set SEED_RESET=true to wipe and reseed. Nothing done.`);
    return;
  }

  console.time("seed");
  const tables = await db.$queryRaw<{ tablename: string }[]>`SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  if (tables.length) await db.$executeRawUnsafe(`TRUNCATE TABLE ${tables.map((t) => `"${t.tablename}"`).join(", ")} CASCADE`);

  const passwordHash = await hash(demoPassword, { memoryCost: 19456, timeCost: 2, parallelism: 1 });

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
  // The national calendars of the interministerial orders of 19 June 2025
  // and 28 July 2026: three terms for the holidays, no break before
  // Christmas, a pause in February. Schools graded by semester use the two
  // semesters, split at that February pause.
  const prevYear = await db.academicYear.create({
    data: { label: "2025-2026", startDate: new Date("2025-09-15"), endDate: new Date("2026-06-26"), isActive: false },
  });
  const year = await db.academicYear.create({
    data: { label: "2026-2027", startDate: new Date("2026-09-14"), endDate: new Date("2027-06-25"), isActive: true },
  });
  const createPeriods = (yearId: string, closed: boolean, list: [string, string, string][], periodicity: "TRIMESTER" | "SEMESTER") =>
    Promise.all(
      list.map(([name, s, e], i) =>
        db.schoolPeriod.create({ data: { academicYearId: yearId, name, periodicity, order: i + 1, startDate: new Date(s), endDate: new Date(e), isClosed: closed } }),
      ),
    );
  const prevPeriods = await createPeriods(
    prevYear.id,
    true,
    [
      ["Trimestre 1", "2025-09-15", "2025-12-19"],
      ["Trimestre 2", "2026-01-05", "2026-04-01"],
      ["Trimestre 3", "2026-04-16", "2026-06-26"],
    ],
    "TRIMESTER",
  );
  const prevSemesters = await createPeriods(
    prevYear.id,
    true,
    [
      ["Semestre 1", "2025-09-15", "2026-02-19"],
      ["Semestre 2", "2026-03-02", "2026-06-26"],
    ],
    "SEMESTER",
  );
  const periods = await createPeriods(
    year.id,
    false,
    [
      ["Trimestre 1", "2026-09-14", "2026-12-18"],
      ["Trimestre 2", "2027-01-04", "2027-03-24"],
      ["Trimestre 3", "2027-04-08", "2027-06-25"],
    ],
    "TRIMESTER",
  );
  const semesters = await createPeriods(
    year.id,
    false,
    [
      ["Semestre 1", "2026-09-14", "2027-02-18"],
      ["Semestre 2", "2027-03-01", "2027-06-25"],
    ],
    "SEMESTER",
  );

  await db.academicLevel.createMany({ data: LEVELS.map((l) => ({ ...l, id: id() })) });
  const levels = new Map((await db.academicLevel.findMany()).map((l) => [l.code, l]));
  await db.subject.createMany({ data: [...SECONDARY_SUBJECTS, ...PRIMARY_SUBJECTS].map(({ code, name }) => ({ id: id(), code, name })) });
  const subjects = new Map((await db.subject.findMany()).map((s) => [s.code, s.id]));

  // Schools ------------------------------------------------------------------
  type SchoolPlan = {
    id: string;
    code: string;
    name: string;
    cycle: "PRIMARY" | "SECONDARY";
    communeId: string;
    communeName: string;
    detailed: boolean;
    urban: boolean;
    quality: number;
    classSpecs: string[]; // "6E:A"
  };
  const schools: SchoolPlan[] = [];
  let seq = 0;
  const SEC_LEVELS = ["6E", "5E", "4E", "3E"];
  const PRIM_LEVELS = ["CE2", "CM1", "CM2"];
  const STREAMS = ["A", "B", "C"];
  const specsFor = (levelsList: string[], streams: number) => levelsList.flatMap((l) => STREAMS.slice(0, streams).map((s) => `${l}:${s}`));
  const pushSchool = (commune: (typeof communes)[number], cycle: "PRIMARY" | "SECONDARY", name: string, classSpecs: string[], detailed = false) => {
    seq++;
    // School level effect on results: urban schools slightly ahead, but with
    // real spread, so the maps and rankings have something to show.
    const urban = URBAN[commune.name] !== undefined;
    schools.push({
      id: id(),
      code: `BJ-${String(seq).padStart(4, "0")}`,
      name,
      cycle,
      communeId: commune.id,
      communeName: commune.name,
      detailed,
      urban,
      quality: normal(urban ? 0.6 : 0, 1.1),
      classSpecs,
    });
  };

  const godomey = communeByName.get("Abomey-Calavi")!;
  pushSchool(godomey, "SECONDARY", "CEG Godomey", ["6E:A", "6E:B", "5E:A", "4E:A", "3E:A", "2NDE:C", "1ERE:D", "TLE:D"], true);
  pushSchool(godomey, "PRIMARY", "EPP Godomey Centre", specsFor(PRIM_LEVELS, 1), true);

  // Classes per commune, proportional to its weighted population, at least
  // one school. Secondary classes come by streams of four levels (6e to 3e),
  // primary ones by streams of three (CE2 to CM2).
  const QUARTERS = ["Centre", "Zongo", "Gare", "Marché", "Plateau", "Houénoussou", "Agla", "Kpota", "Sud", "Nord"];
  const weightOf = (name: string) => (POPULATION[name] ?? 80) * (URBAN[name] ?? 0.8);
  const totalWeight = communes.reduce((a, c) => a + weightOf(c.name), 0);
  let singleSchool = 0;
  for (const commune of communes) {
    let budget = Math.max(3, Math.round((weightOf(commune.name) / totalWeight) * CLASS_BUDGET));
    if (URBAN[commune.name] !== undefined) budget = Math.max(8, budget); // a town has at least a CEG and an EPP
    if (commune.name === "Abomey-Calavi") budget = Math.max(3, budget - 11); // the detailed schools count
    let secStreams: number;
    let primStreams: number;
    if (budget < 7) {
      // A single seeded school: a CEG where the budget allows it, otherwise
      // one commune in two gets a CEG and the other an EPP, so that every
      // department has rural colleges and primary schools.
      secStreams = budget >= 4 || singleSchool++ % 2 === 0 ? 1 : 0;
      primStreams = secStreams ? 0 : 1;
    } else {
      secStreams = Math.max(1, Math.round((budget * 0.55) / 4));
      primStreams = Math.max(1, Math.round((budget - secStreams * 4) / 3));
    }
    // Split the streams into schools of one to three streams.
    const split = (streams: number, max: number) => {
      const out: number[] = [];
      let left = streams;
      while (left > 0) {
        const n = Math.min(left, left > max ? int(1, max) : left > 1 && rand() < 0.5 ? int(1, left) : left);
        out.push(n);
        left -= n;
      }
      return out;
    };
    const urban = URBAN[commune.name] !== undefined;
    const secSchools = split(secStreams, urban ? 3 : 2);
    const primSchools = split(primStreams, urban ? 2 : 1);
    const named = (kind: string, count: number, i: number) => (count > 1 ? `${kind} ${commune.name} ${QUARTERS[i % QUARTERS.length]}` : `${kind} ${commune.name}`);
    secSchools.forEach((streams, i) => pushSchool(commune, "SECONDARY", named("CEG", secSchools.length, i), specsFor(SEC_LEVELS, streams)));
    primSchools.forEach((streams, i) => pushSchool(commune, "PRIMARY", named("EPP", primSchools.length, i), specsFor(PRIM_LEVELS, streams)));
  }
  // Sectors are drawn in the same order as always, so every later draw (and
  // the names the journeys rely on) stays the same. CEG and EPP are public
  // names: a private, confessional or community school gets a name of its
  // kind, chosen without drawing.
  // Each school draws its sector then its phone number, in that order.
  const drawn = schools.map((s) => ({ sector: s.detailed ? ("PUBLIC" as const) : pick(["PUBLIC", "PUBLIC", "PUBLIC", "PRIVATE", "CONFESSIONAL", "COMMUNITY"] as const), phone: phone() }));
  const sectors = drawn.map((d) => d.sector);
  const denominations = new Map<string, "CATHOLIC" | "PROTESTANT" | "ISLAMIC" | "FRANCO_ARABIC">();
  let privateSeq = 0;
  let bilingualDone = false;
  const bilingual = new Set<string>();
  schools.forEach((sc, i) => {
    const sector = sectors[i]!;
    if (sector === "PUBLIC") return;
    const n = privateSeq++;
    const place = sc.name.replace(/^(CEG|EPP) /, "");
    const of = /^[AEIOUYÀÂÉÈÊÎÏÔÛ]/i.test(place) ? `d'${place}` : `de ${place}`;
    const sec = sc.cycle === "SECONDARY";
    if (sector === "PRIVATE") {
      if (sec && !bilingualDone && sc.urban) {
        bilingualDone = true;
        bilingual.add(sc.id);
        sc.name = `Complexe scolaire bilingue Les Lauriers ${of}`;
      } else sc.name = `${(sec ? ["Collège privé La Réussite", "Complexe scolaire Les Lauriers", "Collège privé L'Excellence", "Complexe scolaire La Source"] : ["École primaire privée Les Bambins", "École privée La Colombe", "École primaire privée Les Petits Génies", "École privée Le Savoir"])[n % 4]} ${of}`;
    } else if (sector === "CONFESSIONAL") {
      const faith = (["CATHOLIC", "PROTESTANT", "ISLAMIC", "FRANCO_ARABIC"] as const)[n % 4];
      denominations.set(sc.id, faith);
      const names = sec
        ? { CATHOLIC: "Collège catholique Notre-Dame", PROTESTANT: "Collège protestant La Grâce", ISLAMIC: "Complexe scolaire islamique Al-Hidaya", FRANCO_ARABIC: "Collège franco-arabe An-Nour" }
        : { CATHOLIC: "École catholique Sainte-Thérèse", PROTESTANT: "École protestante Béthel", ISLAMIC: "École islamique Al-Falah", FRANCO_ARABIC: "École franco-arabe Al-Amine" };
      sc.name = `${names[faith]} ${of}`;
    } else sc.name = `${sec ? "Collège communautaire" : "École communautaire"} ${of}`;
  });
  await db.school.createMany({
    data: schools.map((s, i) => ({
      id: s.id,
      code: s.code,
      name: s.name,
      sector: sectors[i]!,
      cycle: s.cycle,
      periodicity: defaultPeriodicity({ sector: sectors[i]!, cycle: s.cycle }),
      denomination: denominations.get(s.id) ?? null,
      isBilingual: bilingual.has(s.id),
      communeId: s.communeId,
      phone: drawn[i]!.phone,
      email: `${slug(s.name)}@ecoles.classeo.bj`,
    })),
  });
  const periodicityOf = new Map(schools.map((s, i) => [s.id, defaultPeriodicity({ sector: sectors[i]!, cycle: s.cycle })]));
  const ceg = schools[0]!;
  const epp = schools[1]!;

  // Staff users (created before teachers so the demo teacher can be linked)
  const users: Prisma.UserCreateManyInput[] = [];
  // Sign in identifiers come from the names ("afiavi.hounkpatin"); the demo
  // accounts listed on the sign in page reserve theirs first so a random
  // namesake can never take them.
  const takenUsernames = new Set<string>(DEMO_ACCOUNTS.map((a) => a.username));
  const addUser = (u: Omit<Prisma.UserCreateManyInput, "passwordHash" | "id" | "username"> & { id?: string; username?: string }) => {
    const username = u.username ?? nextFreeUsername(usernameBase(u.firstName, u.lastName), [...takenUsernames]);
    takenUsernames.add(username);
    const row = { id: u.id ?? id(), passwordHash, ...u, username };
    users.push(row);
    return row.id;
  };
  const ministerId = addUser({ username: "adjoa.houngbedji", email: "ministre@classeo.bj", firstName: "Adjoa", lastName: "Houngbédji", gender: "F", roleId: roleIds.NATIONAL_ADMIN!, scopeLevel: "NATIONAL" });
  addUser({ username: "rodrigue.kpadonou", email: "analyste@classeo.bj", firstName: "Rodrigue", lastName: "Kpadonou", gender: "M", roleId: roleIds.NATIONAL_ANALYST!, scopeLevel: "NATIONAL" });
  addUser({ username: "estelle.amoussou", email: "partenaire@classeo.bj", firstName: "Estelle", lastName: "Amoussou", gender: "F", roleId: roleIds.PARTNER!, scopeLevel: "NATIONAL" });
  // Two directions per department: the DDEMP (nursery and primary schools)
  // and the DDESTFP (secondary schools). The Atlantique directors are
  // demonstration accounts: Aristide Gbaguidi at the DDESTFP, which
  // supervises CEG Godomey, and Clarisse Akpovi at the DDEMP. Elsewhere the
  // DDEMP director is drawn here and the DDESTFP one at the end, so the
  // draws of the other people do not move.
  const ddempIds: Record<string, string> = {};
  const ddestfpIds: Record<string, string> = {};
  for (const dep of TERRITORY) {
    const atlantique = dep.name === "Atlantique";
    const p = atlantique ? ({ firstName: "Aristide", lastName: "Gbaguidi", gender: "M" } as const) : person();
    const uid = addUser({
      username: atlantique ? "aristide.gbaguidi" : undefined,
      email: `${atlantique ? "ddestfp" : "ddemp"}.${slug(dep.name)}@classeo.bj`,
      firstName: p.firstName,
      lastName: p.lastName,
      gender: p.gender,
      roleId: roleIds.DEPARTMENT_DIRECTOR!,
      scopeLevel: "DEPARTMENT",
      chain: atlantique ? "SECONDARY" : "PRIMARY",
      departmentId: departments[dep.name],
    });
    if (atlantique) ddestfpIds[dep.name] = uid;
    else ddempIds[dep.name] = uid;
  }
  ddempIds["Atlantique"] = addUser({
    username: "clarisse.akpovi",
    email: "ddemp.atlantique@classeo.bj",
    firstName: "Clarisse",
    lastName: "Akpovi",
    gender: "F",
    roleId: roleIds.DEPARTMENT_DIRECTOR!,
    scopeLevel: "DEPARTMENT",
    chain: "PRIMARY",
    departmentId: departments["Atlantique"],
  });
  for (const name of ["Abomey-Calavi", "Cotonou", "Parakou"]) {
    const p = name === "Abomey-Calavi" ? ({ firstName: "Bénédicta", lastName: "Zannou", gender: "F" } as const) : person();
    addUser({
      username: name === "Abomey-Calavi" ? "benedicta.zannou" : undefined,
      email: `cs.${slug(name)}@classeo.bj`,
      firstName: p.firstName,
      lastName: p.lastName,
      gender: p.gender,
      roleId: roleIds.COMMUNE_INSPECTOR!,
      scopeLevel: "COMMUNE",
      communeId: communeByName.get(name)!.id,
    });
  }
  const directorId = addUser({ username: "florentin.agossou", email: "directeur@classeo.bj", firstName: "Florentin", lastName: "Agossou", gender: "M", roleId: roleIds.SCHOOL_DIRECTOR!, scopeLevel: "SCHOOL", schoolId: ceg.id });
  addUser({ username: "pelagie.tossou", email: "secretaire@classeo.bj", firstName: "Pélagie", lastName: "Tossou", gender: "F", roleId: roleIds.SECRETARY!, scopeLevel: "SCHOOL", schoolId: ceg.id });
  const accountantId = addUser({ username: "gildas.sossou", email: "comptable@classeo.bj", firstName: "Gildas", lastName: "Sossou", gender: "M", roleId: roleIds.ACCOUNTANT!, scopeLevel: "SCHOOL", schoolId: ceg.id });
  addUser({ email: "directrice.epp@classeo.bj", firstName: "Mireille", lastName: "Dossou", gender: "F", roleId: roleIds.SCHOOL_DIRECTOR!, scopeLevel: "SCHOOL", schoolId: epp.id });

  // Classes, teachers, students ----------------------------------------------
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

  // Teachers of last year's classes, subject code to teacher id: the teacher
  // of the class of the same name this year (teachers keep their levels),
  // otherwise the teacher of the cohort's current class.
  const prevClassTeachers = new Map<string, Map<string, string>>();
  const teacherById = new Map<string, Prisma.TeacherCreateManyInput>();
  const addTeacher = (schoolId: string, specialty: string) => {
    const p = person();
    const t: Prisma.TeacherCreateManyInput = {
      id: id(),
      schoolId,
      matricule: `ENS-${String(++teacherSeq).padStart(5, "0")}`,
      firstName: p.firstName,
      lastName: p.lastName,
      gender: p.gender,
      phone: phone(),
      specialty,
    };
    teachers.push(t);
    teacherById.set(t.id!, t);
    return t;
  };
  // Teachers per subject at CEG Godomey, sized for its eight classes so the
  // timetable can be built without any teacher in two places at once.
  const DETAILED_TEACHERS: Record<string, number> = { FR: 3, MATH: 3, ANG: 2, HG: 2, SVT: 2, PCT: 2, EPS: 1 };
  const PRIMARY_HOURS: Record<string, number> = { "P-FR": 7, "P-MATH": 6, "P-EST": 3, "P-ES": 3, "P-EA": 2, "P-EPS": 2 };
  const LEVEL_FACTOR: Record<string, number> = { "6E": 1.08, "5E": 1.03, "4E": 0.97, "3E": 0.92, "2NDE": 0.9, "1ERE": 0.85, TLE: 0.82, CE2: 1.03, CM1: 1, CM2: 0.96 };

  const classSize = (school: SchoolPlan, levelCode: string) => {
    const f = LEVEL_FACTOR[levelCode] ?? 1;
    if (school.cycle === "SECONDARY") return school.urban || school.detailed ? Math.round(clamp(normal(57, 6) * f, 44, 70)) : Math.round(clamp(normal(47, 6) * f, 34, 60));
    return school.urban || school.detailed ? Math.round(clamp(normal(52, 5) * f, 42, 60)) : Math.round(clamp(normal(46, 5) * f, 34, 58));
  };

  for (const school of schools) {
    const isSec = school.cycle === "SECONDARY";
    const subjectList = isSec ? SECONDARY_SUBJECTS : PRIMARY_SUBJECTS;
    const specs = school.classSpecs;
    const classIds = specs.map(() => id());
    // Teacher of each (class index, subject code).
    const teacherOf = new Map<string, string>();

    if (isSec) {
      // Secondary: each subject is shared by one or several teachers, each
      // taking a contiguous group of classes. Small colleges sometimes have a
      // single science teacher for SVT and PCT.
      const sharedScience = !school.detailed && specs.length <= 4 && rand() < 0.4;
      for (const s of subjectList) {
        if (sharedScience && s.code === "PCT") {
          for (let c = 0; c < specs.length; c++) teacherOf.set(`${c}:PCT`, teacherOf.get(`${c}:SVT`)!);
          continue;
        }
        const hours = SECONDARY_HOURS[s.code]! * specs.length;
        const n = school.detailed ? DETAILED_TEACHERS[s.code]! : clamp(Math.round(hours / int(15, 21)), 1, specs.length);
        const specialty = sharedScience && s.code === "SVT" ? "Sciences de la vie et de la terre, physique et chimie" : s.name;
        const group = Array.from({ length: n }, () => addTeacher(school.id, specialty).id!);
        for (let c = 0; c < specs.length; c++) teacherOf.set(`${c}:${s.code}`, group[Math.min(n - 1, Math.floor((c * n) / specs.length))]!);
      }
    } else {
      // Primary: one teacher per class, for every subject.
      for (let c = 0; c < specs.length; c++) {
        const t = addTeacher(school.id, "Enseignement primaire").id!;
        for (const s of subjectList) teacherOf.set(`${c}:${s.code}`, t);
      }
    }

    if (school.id === ceg.id) {
      demoTeacherId = teacherOf.get(`${specs.indexOf("3E:A")}:MATH`)!;
      // The demonstration teacher is a woman, Madame Issifou.
      Object.assign(teacherById.get(demoTeacherId)!, { firstName: "Nafissatou", lastName: "Issifou", gender: "F" });
    }

    const specIndex = new Map(specs.map((s, i) => [s, i]));
    specs.forEach((spec, c) => {
      const [levelCode, letter] = spec.split(":") as [string, string];
      const level = levels.get(levelCode)!;
      const classroomId = classIds[c]!;
      const size = classSize(school, levelCode);
      const mainTeacherId = teacherOf.get(`${c}:${isSec ? pick(["FR", "MATH", "HG"]) : "P-FR"}`)!;
      classrooms.push({
        id: classroomId,
        schoolId: school.id,
        academicYearId: year.id,
        levelId: level.id,
        name: `${level.name} ${letter}`,
        capacity: Math.max(size, isSec ? 70 : 60),
        mainTeacherId,
      });
      for (const s of subjectList) {
        assignments.push({
          id: id(),
          classroomId,
          subjectId: subjects.get(s.code)!,
          teacherId: teacherOf.get(`${c}:${s.code}`)!,
          coefficient: coefficientOf(levelCode, letter, s),
          weeklyHours: isSec ? SECONDARY_HOURS[s.code]! : PRIMARY_HOURS[s.code]!,
          schoolId: school.id,
          subjectCode: s.code,
        });
      }

      // Previous year classroom one level below, same school, for history.
      const prevLevel = LEVELS.find((l) => l.order === level.order - 1 && l.cycle === level.cycle);
      let prevClassroomId: string | undefined;
      if (prevLevel) {
        prevClassroomId = id();
        const sameName = specIndex.get(`${prevLevel.code}:${letter}`);
        const source = sameName ?? c;
        const taught = new Map(subjectList.map((s) => [s.code, teacherOf.get(`${source}:${s.code}`)!]));
        prevClassTeachers.set(prevClassroomId, taught);
        classrooms.push({
          id: prevClassroomId,
          schoolId: school.id,
          academicYearId: prevYear.id,
          levelId: levels.get(prevLevel.code)!.id,
          name: `${prevLevel.name} ${letter}`,
          capacity: Math.max(size, isSec ? 70 : 60),
          mainTeacherId: taught.get(isSec ? pick(["FR", "MATH", "HG"]) : "P-FR")!,
        });
      }

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
        enrollments.push({ id: enrollmentId, studentId, schoolId: school.id, classroomId, academicYearId: year.id, isRepeating: rand() < 0.08, enrolledAt: year.startDate });
        const meta: { ability: number; schoolId: string; classroomId: string; enrollmentId: string; prevEnrollmentId?: string; prevClassroomId?: string } = {
          ability: normal(10.6 + school.quality * 0.9 + (p.gender === "F" ? 0.15 : 0), 2.6),
          schoolId: school.id,
          classroomId,
          enrollmentId,
        };
        if (prevClassroomId) {
          meta.prevEnrollmentId = id();
          meta.prevClassroomId = prevClassroomId;
          enrollments.push({ id: meta.prevEnrollmentId, studentId, schoolId: school.id, classroomId: prevClassroomId, academicYearId: prevYear.id, enrolledAt: prevYear.startDate });
        }
        studentMeta.set(studentId, meta);
        if (school.id === ceg.id && levelCode === "3E" && k === 0) demoStudentId = studentId;
      }
    });
  }

  // Link the demo teacher to a user account; other CEG Godomey teachers get
  // accounts too so messaging works across the school.
  const teacherUserIds = new Map<string, string>();
  for (const t of teachers.filter((t) => t.schoolId === ceg.id || t.schoolId === epp.id)) {
    const isDemo = t.id === demoTeacherId;
    const uid = addUser({
      username: isDemo ? "nafissatou.issifou" : undefined,
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
  const studentUserId = addUser({ username: "senami.hounkpatin", email: "eleve@classeo.bj", firstName: "Sènami", lastName: "Hounkpatin", gender: "F", roleId: roleIds.STUDENT!, scopeLevel: "SELF" });
  demoStudent.userId = studentUserId;
  const parentUserId = addUser({ username: "afiavi.hounkpatin", email: "parent@classeo.bj", firstName: "Afiavi", lastName: "Hounkpatin", gender: "F", phone: "0196123456", roleId: roleIds.PARENT!, scopeLevel: "SELF" });

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
  console.timeLog("seed", `schools ${schools.length}, teachers ${teachers.length}, students ${students.length}, enrollments ${enrollments.length}`);

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

  // Last year's published report cards, every school: three terms, or two
  // semesters where the school is graded by semester. The subject averages
  // are drawn per term in every case (the same draws as always); a first
  // semester takes the mean of the first two terms, the second the third.
  const reportCards: Prisma.ReportCardCreateManyInput[] = [];
  const teacherNameOf = (teacherId: string | undefined) => {
    const t = teacherId ? teacherById.get(teacherId) : undefined;
    return t ? `${t.firstName} ${t.lastName}` : null;
  };
  const byPrevClass = new Map<string, string[]>();
  for (const [sid, m] of studentMeta) if (m.prevClassroomId) byPrevClass.set(m.prevClassroomId, [...(byPrevClass.get(m.prevClassroomId) ?? []), sid]);
  const classById = new Map(classrooms.map((c) => [c.id!, c]));
  const levelCodeById = new Map([...levels.values()].map((l) => [l.id, l.code]));
  const schoolCycle = new Map(schools.map((s) => [s.id, s.cycle]));
  for (const [prevClassId, sids] of byPrevClass) {
    const klass = classById.get(prevClassId)!;
    const subjectList = schoolCycle.get(klass.schoolId) === "SECONDARY" ? SECONDARY_SUBJECTS : PRIMARY_SUBJECTS;
    const levelCode = levelCodeById.get(klass.levelId)!;
    const stream = klass.name.slice(-1);
    const taught = prevClassTeachers.get(prevClassId);
    const drawnTerms = prevPeriods.map((_, pIndex) =>
      sids.map((sid) => {
        const m = studentMeta.get(sid)!;
        return subjectList.map(() => round2(clamp(normal(m.ability + pIndex * 0.25, 2.2), 1, 19.5)));
      }),
    );
    const semesterSchool = periodicityOf.get(klass.schoolId) === "SEMESTER";
    const published = semesterSchool
      ? [
          { period: prevSemesters[0]!, averages: drawnTerms[0]!.map((row, k) => row.map((v, j) => round2((v + drawnTerms[1]![k]![j]!) / 2))) },
          { period: prevSemesters[1]!, averages: drawnTerms[2]! },
        ]
      : prevPeriods.map((period, pIndex) => ({ period, averages: drawnTerms[pIndex]! }));
    for (const { period, averages } of published) {
      const rows = sids.map((sid, k) => {
        const m = studentMeta.get(sid)!;
        const lines = subjectList.map((s, j) => ({
          subject: s.name,
          coefficient: coefficientOf(levelCode, stream, s),
          average: averages[k]![j]!,
          rank: null as number | null,
          teacher: teacherNameOf(taught?.get(s.code)),
        }));
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
    }
  }
  await chunked(reportCards, 2500, (b) => db.reportCard.createMany({ data: b }));
  console.timeLog("seed", `report cards ${reportCards.length}`);

  // Current period grade sheets for the two detailed schools ----------------
  // National formula: two interrogations écrites and two devoirs surveillés.
  // The first interrogation and the first devoir are entered, the rest is
  // left for the live demonstration. CEG Godomey is graded by semester, EPP
  // Godomey Centre by term.
  const detailedAssignments = assignments.filter((a) => a.schoolId === ceg.id || a.schoolId === epp.id);
  const currentPeriodOf = (schoolId: string) => (periodicityOf.get(schoolId) === "SEMESTER" ? semesters[0]! : periods[0]!);
  const sheets: Prisma.GradeSheetCreateManyInput[] = [];
  const grades: Prisma.GradeCreateManyInput[] = [];
  const studentsByClass = new Map<string, string[]>();
  for (const [sid, m] of studentMeta) studentsByClass.set(m.classroomId, [...(studentsByClass.get(m.classroomId) ?? []), sid]);
  for (const a of detailedAssignments) {
    const sheetId = id();
    sheets.push({ id: sheetId, assignmentId: a.id!, periodId: currentPeriodOf(a.schoolId).id, formula: "OFFICIAL_2024", interrogationCount: 2, devoirCount: 2, compositionCount: 0 });
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
  console.timeLog("seed", `attendance ${attendance.length}`);

  // Content ------------------------------------------------------------------
  const now = new Date("2026-09-25T08:00:00Z");
  const demoClassroomId = studentMeta.get(demoStudent.id!)!.classroomId;
  const alladaCollege = schools.find((s) => s.communeName === "Allada" && s.cycle === "SECONDARY");
  const alladaVenue = alladaCollege ? `au ${alladaCollege.name}` : "à la mairie d'Allada";
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
        easyRead: "Les professeurs des collèges de l'Atlantique se réunissent le samedi 3 octobre à Allada.",
        body: `La direction départementale des enseignements secondaire, technique et de la formation professionnelle de l'Atlantique convie les professeurs du premier cycle des collèges publics et privés à la conférence pédagogique de rentrée, le samedi 3 octobre 2026 à 9 h, ${alladaVenue}.`,
        audience: "TEACHERS",
        status: "PUBLISHED",
        publishedAt: new Date("2026-09-20T08:00:00Z"),
        departmentId: departments["Atlantique"],
        authorId: ddestfpIds["Atlantique"]!,
      },
      {
        type: "EVENT",
        title: "Réunion des parents d'élèves",
        easyRead: "Réunion des parents le samedi 10 octobre à 10 h, dans la cour du collège.",
        body: "Le chef d'établissement invite tous les parents d'élèves à la réunion de rentrée le samedi 10 octobre 2026 à 10 h, dans la cour du collège. Ordre du jour : organisation de l'année, élection du bureau de l'association des parents, questions diverses. Une interprétation en fon et en langue des signes sera assurée.",
        audience: "PARENTS",
        status: "PUBLISHED",
        publishedAt: new Date("2026-09-24T12:00:00Z"),
        eventDate: new Date("2026-10-10T09:00:00Z"), // 10 h in Benin (UTC+1), as the title and body say
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
        title: "Projet de calendrier des devoirs surveillés du premier semestre",
        body: "Brouillon en cours de validation par le conseil des professeurs.",
        audience: "STAFF",
        status: "DRAFT",
        schoolId: ceg.id,
        authorId: directorId,
      },
    ],
  });

  // Messaging and notifications ----------------------------------------------
  // The demo teacher is Madame Issifou; the demo parent is Sènami's mother.
  const demoTeacherUserId = teacherUserIds.get(demoTeacherId)!;
  const absenceDay = allDays[allDays.length - 2]!;
  const longDay = (d: Date) => d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
  const at = (iso: string) => new Date(iso);
  const conversation = async (subject: string, messages: { from: string; body: string; at: Date }[], participants: string[], unreadBy: string[] = []) => {
    const last = messages[messages.length - 1]!;
    const c = await db.conversation.create({
      data: {
        subject,
        createdAt: messages[0]!.at,
        participants: {
          create: participants.map((userId) => ({
            userId,
            // Everyone has read the thread except the recipients of the last
            // message listed in unreadBy.
            lastReadAt: unreadBy.includes(userId) ? ([...messages].reverse().find((m) => m.from === userId)?.at ?? null) : last.at,
          })),
        },
      },
    });
    await db.message.createMany({ data: messages.map((m) => ({ conversationId: c.id, senderId: m.from, body: m.body, createdAt: m.at })) });
    await db.conversation.update({ where: { id: c.id }, data: { updatedAt: last.at } });
    return c;
  };

  const conv = await conversation(
    "Suivi de Sènami en mathématiques",
    [
      {
        from: demoTeacherUserId,
        body: `Bonjour Madame Hounkpatin. Sènami a bien commencé l'année, mais elle a été notée absente ce matin, ${longDay(absenceDay)}. Pouvez-vous me dire si tout va bien ? Madame Issifou, professeure de mathématiques`,
        at: new Date(absenceDay.getTime() + 15 * 3600000 + 10 * 60000),
      },
      {
        from: parentUserId,
        body: "Bonjour Madame Issifou. Elle était malade, elle va mieux et sera en classe demain. Merci de m'avoir prévenue.",
        at: new Date(absenceDay.getTime() + 17 * 3600000 + 42 * 60000),
      },
    ],
    [parentUserId, demoTeacherUserId],
  );

  // Figures quoted in the messages come from the seeded data itself.
  // The DDESTFP answers for the secondary schools of the department.
  const atlanticSchoolIds = new Set(schools.filter((s) => communeByName.get(s.communeName)!.departmentName === "Atlantique").map((s) => s.id));
  const atlanticColleges = new Set(schools.filter((s) => atlanticSchoolIds.has(s.id) && s.cycle === "SECONDARY").map((s) => s.id));
  const atlanticPupils = enrollments.filter((e) => e.academicYearId === year.id && atlanticColleges.has(e.schoolId)).length;
  const genderOf = new Map(students.map((s) => [s.id!, s.gender]));
  const atlanticGirls = enrollments.filter((e) => e.academicYearId === year.id && atlanticColleges.has(e.schoolId) && genderOf.get(e.studentId) === "F").length;
  const fr = (n: number) => new Intl.NumberFormat("fr-FR").format(n);
  await conversation(
    "Statistiques de rentrée de l'Atlantique",
    [
      {
        from: ministerId,
        body: "Bonjour Monsieur le Directeur départemental. Pouvez-vous me confirmer les effectifs de rentrée des collèges et lycées de l'Atlantique avant la réunion de cabinet de lundi ? Je souhaite aussi savoir si tous les établissements ont fait l'appel cette semaine.",
        at: at("2026-09-22T09:30:00Z"),
      },
      {
        from: ddestfpIds["Atlantique"]!,
        body: `Bonjour Madame la Ministre. À ce jour, ${fr(atlanticColleges.size)} établissements secondaires du département ont saisi leurs inscriptions, soit ${fr(atlanticPupils)} élèves, dont ${fr(atlanticGirls)} filles. L'appel est fait tous les jours dans les établissements suivis ; je vous transmets le détail par commune dans Classéo.`,
        at: at("2026-09-22T14:05:00Z"),
      },
      {
        from: ministerId,
        body: "Merci. Les inscriptions restent ouvertes jusqu'au 9 octobre : faites un nouveau point à cette date.",
        at: at("2026-09-23T08:15:00Z"),
      },
    ],
    [ministerId, ddestfpIds["Atlantique"]!],
  );
  await conversation(
    "Demande d'enseignants de SVT au CEG Godomey",
    [
      {
        from: ddestfpIds["Atlantique"]!,
        body: "Bonjour Monsieur le Directeur. J'ai bien reçu votre demande de deux enseignants de SVT. Pouvez-vous me préciser le nombre d'heures de SVT non assurées chaque semaine ?",
        at: at("2026-09-21T10:20:00Z"),
      },
      {
        from: directorId,
        body: "Bonjour Monsieur le Directeur départemental. Depuis l'ouverture d'une seconde classe de 6e, nos deux professeurs de SVT ont chacun quatre classes, de la 6e à la terminale, et ne peuvent plus assurer les travaux pratiques ni le soutien des élèves de 3e.",
        at: at("2026-09-21T15:45:00Z"),
      },
      {
        from: ddestfpIds["Atlantique"]!,
        body: "Merci pour ces précisions. La demande est à l'étude avec le service des affectations ; je vous tiens informé d'ici la fin du mois.",
        at: at("2026-09-23T11:00:00Z"),
      },
    ],
    [ddestfpIds["Atlantique"]!, directorId],
    [directorId],
  );

  await db.notification.createMany({
    data: [
      ...absences.map((a) => ({ userId: parentUserId, kind: "absence", title: "Absence signalée", body: `Sènami était absente le ${longDay(a.date)} au matin.`, link: "/espace/suivi", createdAt: new Date(a.date.getTime() + 11 * 3600000) })),
      { userId: parentUserId, kind: "message", title: "Nouveau message", body: "Madame Issifou, professeure de mathématiques, vous a écrit.", link: `/espace/messages/${conv.id}`, createdAt: new Date(absenceDay.getTime() + 15 * 3600000 + 10 * 60000) },
      { userId: parentUserId, kind: "report_card", title: "Bulletin disponible", body: "Le bulletin du second semestre 2025-2026 de Sènami est disponible.", link: "/espace/suivi", readAt: now, createdAt: new Date("2026-07-10T09:00:00Z") },
      { userId: directorId, kind: "request", title: "Demande en cours d'examen", body: "Votre demande d'enseignants de SVT est en cours d'examen par la DDESTFP de l'Atlantique.", link: "/espace/demandes", createdAt: at("2026-09-21T10:25:00Z") },
    ],
  });

  // Requests from schools up the ministry chain ------------------------------
  // Each requesting school has its own head, who files the request; the
  // titles match the request type.
  const atlanticOthers = schools.filter((s) => atlanticSchoolIds.has(s.id) && !s.detailed);
  const colleges = atlanticOthers.filter((s) => s.cycle === "SECONDARY");
  const primaries = atlanticOthers.filter((s) => s.cycle === "PRIMARY");
  const requestPlans: { school: SchoolPlan; type: "YEAR_EXTENSION" | "NEW_SUBJECT" | "STAFFING" | "INFRASTRUCTURE" | "OTHER"; subject: string; body: string; createdAt: string; decision?: { status: "APPROVED" | "REJECTED"; at: string; note: string } }[] = [
    {
      school: colleges[0]!,
      type: "INFRASTRUCTURE",
      subject: "Réfection de la toiture de deux salles de classe",
      body: "La toiture des salles de 5e et de 4e a été arrachée par l'orage du 8 septembre. Les deux classes sont installées sous le préau en attendant les travaux. Devis joint.",
      createdAt: "2026-09-10T08:30:00Z",
      decision: { status: "APPROVED", at: "2026-09-21T10:00:00Z", note: "Accordé. Les travaux sont programmés pendant les congés de fin de premier trimestre, du 19 décembre au 3 janvier ; les classes restent sous le préau d'ici là." },
    },
    {
      school: primaries[0]!,
      type: "INFRASTRUCTURE",
      subject: "Dotation en tables-bancs",
      body: "Il manque 40 tables-bancs pour les classes de CE2 et de CM1 : des élèves suivent les cours assis à trois par table.",
      createdAt: "2026-09-15T09:10:00Z",
    },
    {
      school: colleges[1] ?? colleges[0]!,
      type: "YEAR_EXTENSION",
      subject: "Prolongation du premier trimestre d'une semaine",
      body: "L'établissement a été fermé du 15 au 18 septembre à cause des inondations. Nous demandons de prolonger le premier trimestre d'une semaine pour rattraper les cours.",
      createdAt: "2026-09-21T11:40:00Z",
    },
    {
      school: colleges[2] ?? colleges[0]!,
      type: "NEW_SUBJECT",
      subject: "Ouverture d'une classe de 2nde",
      body: "Nos élèves de 3e doivent changer de commune pour entrer en seconde. Nous demandons l'ouverture d'une classe de 2nde dès la rentrée prochaine ; une salle et deux enseignants sont disponibles.",
      createdAt: "2026-09-16T10:00:00Z",
      decision: { status: "REJECTED", at: "2026-09-23T09:30:00Z", note: "Refusé pour cette année : la carte scolaire 2026-2027 est arrêtée. Merci de renouveler la demande en mars 2027 pour la rentrée suivante." },
    },
    {
      school: primaries[1] ?? primaries[0]!,
      type: "STAFFING",
      subject: "Remplacement d'un enseignant admis à la retraite",
      body: "Le maître de la classe de CM2 part à la retraite le 31 octobre 2026. Nous demandons l'affectation d'un enseignant pour le remplacer dès le lundi 2 novembre.",
      createdAt: "2026-09-17T08:00:00Z",
    },
    {
      school: colleges[3] ?? colleges[0]!,
      type: "OTHER",
      subject: "Autorisation de sortie pédagogique à la Route des Esclaves",
      body: "Les élèves de 4e préparent un exposé d'histoire. Nous sollicitons l'autorisation d'une sortie à Ouidah le samedi 17 octobre, encadrée par quatre enseignants.",
      createdAt: "2026-09-22T12:15:00Z",
    },
  ];
  const heads = new Map<string, string>();
  const headRows: Prisma.UserCreateManyInput[] = [];
  for (const r of requestPlans) {
    if (heads.has(r.school.id)) continue;
    const p = person();
    const uid = id();
    heads.set(r.school.id, uid);
    const username = nextFreeUsername(usernameBase(p.firstName, p.lastName), [...takenUsernames]);
    takenUsernames.add(username);
    headRows.push({ id: uid, passwordHash, username, email: `direction.${slug(r.school.name)}@ecoles.classeo.bj`, firstName: p.firstName, lastName: p.lastName, gender: p.gender, roleId: roleIds.SCHOOL_DIRECTOR!, scopeLevel: "SCHOOL", schoolId: r.school.id });
  }
  await db.user.createMany({ data: headRows });

  // The DDESTFP directors of the other departments, named with their own
  // generator after everyone else, so no earlier name or identifier moves.
  let alt = 20260728;
  const altPick = <T,>(list: readonly T[]) => {
    alt = (Math.imul(alt, 1103515245) + 12345) >>> 0;
    return list[alt % list.length]!;
  };
  const directionRows: Prisma.UserCreateManyInput[] = [];
  for (const dep of TERRITORY) {
    if (dep.name === "Atlantique") continue;
    const gender = altPick(["F", "M"] as const);
    const firstName = altPick(gender === "F" ? FIRST_F : FIRST_M);
    const lastName = altPick(LAST);
    const username = nextFreeUsername(usernameBase(firstName, lastName), [...takenUsernames]);
    takenUsernames.add(username);
    const uid = id();
    ddestfpIds[dep.name] = uid;
    directionRows.push({
      id: uid,
      passwordHash,
      username,
      email: `ddestfp.${slug(dep.name)}@classeo.bj`,
      firstName,
      lastName,
      gender,
      roleId: roleIds.DEPARTMENT_DIRECTOR!,
      scopeLevel: "DEPARTMENT",
      chain: "SECONDARY",
      departmentId: departments[dep.name],
    });
  }
  await db.user.createMany({ data: directionRows });
  await db.schoolRequest.createMany({
    data: [
      {
        schoolId: ceg.id,
        type: "STAFFING",
        subject: "Besoin de deux enseignants de SVT",
        body: "Les effectifs de 6e ont augmenté de 25 % et une seconde classe de 6e a été ouverte. Nous sollicitons l'affectation de deux enseignants de SVT pour couvrir toutes les classes.",
        authorId: directorId,
        createdAt: at("2026-09-18T09:00:00Z"),
      },
      ...requestPlans.map((r) => ({
        schoolId: r.school.id,
        type: r.type,
        subject: r.subject,
        body: r.body,
        authorId: heads.get(r.school.id)!,
        createdAt: at(r.createdAt),
        status: r.decision?.status ?? ("PENDING" as const),
        // Each request goes up its own chain.
        deciderId: r.decision ? (r.school.cycle === "SECONDARY" ? ddestfpIds["Atlantique"] : ddempIds["Atlantique"]) : null,
        decidedAt: r.decision ? at(r.decision.at) : null,
        decisionNote: r.decision?.note ?? null,
      })),
    ],
  });

  // W2: fees, invoices and payments for CEG Godomey --------------------------
  const cegClassLevels = classrooms.filter((c) => c.schoolId === ceg.id && c.academicYearId === year.id);
  // Contribution scolaire of 15 000 FCFA for the boys (the 2026 amount is to
  // be confirmed); the girls of a public college are exempt from 2026-2027
  // (order of 30 July 2026) and are billed the parents' association dues
  // only. EPP Godomey Centre, a public primary school, bills nothing.
  const contribution = await db.feeType.create({ data: { schoolId: ceg.id, academicYearId: year.id, name: "Contribution scolaire", kind: "SCHOOL_CONTRIBUTION", amount: 15000 } });
  const ape = await db.feeType.create({ data: { schoolId: ceg.id, academicYearId: year.id, name: "Cotisation APE", kind: "APE_DUES", amount: 5000 } });
  await db.paymentPlan.create({
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
  const invoices: Prisma.InvoiceCreateManyInput[] = [];
  const invoiceItems: Prisma.InvoiceItemCreateManyInput[] = [];
  const invoiceInstallments: Prisma.InvoiceInstallmentCreateManyInput[] = [];
  const payments: Prisma.PaymentCreateManyInput[] = [];
  // Payments are taken at the counter on school days, 14 to 25 September,
  // 7 h to 16 h in Benin; none after the morning of the 25th.
  const counterDays = schoolDays("2026-09-14", "2026-09-25");
  const paymentTime = () => {
    const day = pick(counterDays);
    const last = day.getTime() === counterDays[counterDays.length - 1]!.getTime();
    const minutes = last ? int(0, 50) : int(0, 9 * 60);
    return new Date(day.getTime() + 6 * 3600000 + minutes * 60000); // 7 h Benin is 06:00Z
  };
  let invoiceSeq = 0;
  for (const c of cegClassLevels) {
    for (const sid of studentsByClass.get(c.id!) ?? []) {
      const m = studentMeta.get(sid)!;
      const exempt = genderOf.get(sid) === "F";
      const total = exempt ? ape.amount : contribution.amount + ape.amount;
      // One draw per pupil either way, so the rest of the data stays the same.
      const r = rand();
      const paid = exempt ? (r < 0.85 ? ape.amount : 0) : r < 0.35 ? total : r < 0.7 ? 7500 + ape.amount : r < 0.85 ? ape.amount : 0;
      const invoiceId = id();
      invoiceSeq++;
      invoices.push({
        id: invoiceId,
        number: `FAC-2026-${String(invoiceSeq).padStart(4, "0")}`,
        schoolId: ceg.id,
        enrollmentId: m.enrollmentId,
        totalAmount: total,
        paidAmount: paid,
        status: paid === 0 ? "PENDING" : paid >= total ? "PAID" : "PARTIALLY_PAID",
        issueDate: new Date("2026-09-14"),
        dueDate: new Date(exempt ? "2026-10-09" : "2027-04-16"),
        // Generated in one batch on the first day, in number order.
        createdAt: new Date(Date.parse("2026-09-14T06:00:00Z") + invoiceSeq * 1000),
      });
      if (exempt) {
        invoiceItems.push({ id: id(), invoiceId, feeTypeId: ape.id, description: ape.name, unitPrice: ape.amount });
        invoiceInstallments.push({ id: id(), invoiceId, label: "Cotisation APE", order: 1, amount: ape.amount, paidAmount: paid, dueDate: new Date("2026-10-09"), status: paid >= ape.amount ? "PAID" : "PENDING" });
      } else {
        invoiceItems.push(
          { id: id(), invoiceId, feeTypeId: contribution.id, description: contribution.name, unitPrice: contribution.amount },
          { id: id(), invoiceId, feeTypeId: ape.id, description: ape.name, unitPrice: ape.amount },
        );
        invoiceInstallments.push(
          { id: id(), invoiceId, label: "Tranche 1 et APE", order: 1, amount: 7500 + ape.amount, paidAmount: Math.min(paid, 7500 + ape.amount), dueDate: new Date("2026-10-09"), status: paid >= 7500 + ape.amount ? "PAID" : paid > 0 ? "PARTIALLY_PAID" : "PENDING" },
          { id: id(), invoiceId, label: "Tranche 2", order: 2, amount: 4500, paidAmount: Math.max(0, Math.min(4500, paid - 12500)), dueDate: new Date("2027-01-15"), status: paid >= 17000 ? "PAID" : "PENDING" },
          { id: id(), invoiceId, label: "Tranche 3", order: 3, amount: 3000, paidAmount: Math.max(0, paid - 17000), dueDate: new Date("2027-04-16"), status: paid >= total ? "PAID" : "PENDING" },
        );
      }
      if (paid > 0) {
        const paidAt = paymentTime();
        payments.push({ id: id(), reference: "", invoiceId, amount: paid, method: pick(["CASH", "MOBILE_MONEY", "MOBILE_MONEY"] as const), paidAt, createdAt: paidAt, recordedById: accountantId });
      }
    }
  }
  // Receipt references follow the order in which the money came in.
  payments.sort((a, b) => (a.paidAt as Date).getTime() - (b.paidAt as Date).getTime());
  payments.forEach((p, i) => (p.reference = `PAY-2026-${String(i + 1).padStart(5, "0")}`));
  await chunked(invoices, 1000, (b) => db.invoice.createMany({ data: b }));
  await chunked(invoiceItems, 2000, (b) => db.invoiceItem.createMany({ data: b }));
  await chunked(invoiceInstallments, 2000, (b) => db.invoiceInstallment.createMany({ data: b }));
  await chunked(payments, 1000, (b) => db.payment.createMany({ data: b }));

  // W2: timetable for CEG Godomey --------------------------------------------
  // Blocks of the week: two hour blocks at 7 h, 9 h 15 and 15 h (no class on
  // Wednesday afternoon), a one hour block at 11 h 15. Every lesson of every
  // class is placed so that neither a class nor a teacher is ever in two
  // places at once, then the result is checked with the application rules.
  const BLOCKS: { key: string; day: number; start: string; end: string; hours: number }[] = [];
  for (let day = 1; day <= 5; day++) {
    BLOCKS.push({ key: `${day}-0700`, day, start: "07:00", end: "09:00", hours: 2 });
    BLOCKS.push({ key: `${day}-0915`, day, start: "09:15", end: "11:15", hours: 2 });
    BLOCKS.push({ key: `${day}-1115`, day, start: "11:15", end: "12:15", hours: 1 });
    if (day !== 3) BLOCKS.push({ key: `${day}-1500`, day, start: "15:00", end: "17:00", hours: 2 });
  }
  // Weekly hours split into blocks: 5 h = 2 + 2 + 1, 3 h = 2 + 1, 2 h = 2.
  const SPLIT: Record<number, number[]> = { 5: [2, 2, 1], 3: [2, 1], 2: [2] };
  type Lesson = { classroomId: string; className: string; assignmentId: string; teacherId: string; subjectCode: string; hours: number };
  const lessons: Lesson[] = [];
  for (const c of cegClassLevels) {
    for (const a of assignments.filter((x) => x.classroomId === c.id)) {
      for (const hours of SPLIT[a.weeklyHours!]!) lessons.push({ classroomId: c.id!, className: c.name, assignmentId: a.id!, teacherId: a.teacherId!, subjectCode: a.subjectCode, hours });
    }
  }
  const busy = new Set<string>();
  const placed = new Map<Lesson, (typeof BLOCKS)[number]>();
  const free = (l: Lesson, b: (typeof BLOCKS)[number]) =>
    b.hours === l.hours && !busy.has(`c:${l.classroomId}:${b.key}`) && !busy.has(`t:${l.teacherId}:${b.key}`) && !busy.has(`s:${l.classroomId}:${l.subjectCode}:${b.day}`);
  const mark = (l: Lesson, b: (typeof BLOCKS)[number], on: boolean) => {
    for (const k of [`c:${l.classroomId}:${b.key}`, `t:${l.teacherId}:${b.key}`, `s:${l.classroomId}:${l.subjectCode}:${b.day}`]) {
      if (on) busy.add(k);
      else busy.delete(k);
    }
  };
  let steps = 0;
  const solve = (): boolean => {
    if (++steps > 200000) throw new Error("Timetable: no conflict free placement found.");
    let best: Lesson | null = null;
    let bestOptions: (typeof BLOCKS)[number][] = [];
    for (const l of lessons) {
      if (placed.has(l)) continue;
      const options = BLOCKS.filter((b) => free(l, b));
      if (!best || options.length < bestOptions.length) {
        best = l;
        bestOptions = options;
        if (!options.length) return false;
      }
    }
    if (!best) return true;
    // Deterministic shuffle so the week does not look mechanical.
    const order = bestOptions.map((b) => ({ b, r: rand() })).sort((x, y) => x.r - y.r).map((x) => x.b);
    for (const b of order) {
      placed.set(best, b);
      mark(best, b, true);
      if (solve()) return true;
      mark(best, b, false);
      placed.delete(best);
    }
    return false;
  };
  if (!solve()) throw new Error("Timetable: no conflict free placement found.");
  const slots: Prisma.TimetableSlotCreateManyInput[] = [];
  const planned: PlannedSlot[] = [];
  for (const l of lessons) {
    const b = placed.get(l)!;
    const slotId = id();
    slots.push({ id: slotId, assignmentId: l.assignmentId, dayOfWeek: b.day, startTime: b.start, endTime: b.end, room: l.subjectCode === "EPS" ? "Terrain de sport" : `Salle ${l.className}` });
    planned.push({ id: slotId, dayOfWeek: b.day, startTime: b.start, endTime: b.end, classroomId: l.classroomId, teacherId: l.teacherId, label: `${l.className} ${l.subjectCode}` });
  }
  // Checked with the rules the application enforces when a slot is edited.
  for (const s of planned) {
    const timeError = slotTimeError(s);
    if (timeError) throw new Error(`Timetable slot ${s.label}: ${timeError}`);
    const conflicts = findConflicts(s, planned);
    if (conflicts.length) throw new Error(`Timetable conflict for ${s.label}: ${conflicts.map(describeConflict).join(" ")}`);
  }
  await db.timetableSlot.createMany({ data: slots });
  console.timeLog("seed", `timetable ${slots.length} slots, no class or teacher conflict`);

  await db.auditLog.create({ data: { userId: ministerId, action: "seed", resource: "system", summary: "Initialisation des données de démonstration" } });
  await seedExtras(db, {
    passwordHash,
    ids: { minister: ministerId, director: directorId, accountant: accountantId, parent: parentUserId, student: studentUserId, teacher: demoTeacherUserId },
    schools: { ceg: ceg.id, epp: epp.id },
    yearId: year.id,
  });
  console.timeEnd("seed");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
