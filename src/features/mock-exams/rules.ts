// Mock examination (examen blanc) rules. Pure functions shared by the pages,
// the actions and the results sheet, fully unit tested. No database access.

import { cycleInScope, type CycleCode } from "@/lib/domain/chains";
import { isPassing, rankEntries, round2 } from "@/lib/domain/grades";

// The classes that end with a national examination: CEP (CM2), BEPC (3e)
// and baccalauréat (Tle). Mock exams exist only for them.
export const EXAM_LEVEL_CODES = ["CM2", "3E", "TLE"] as const;
export type ExamLevelCode = (typeof EXAM_LEVEL_CODES)[number];
export const isExamLevel = (code: string): code is ExamLevelCode => (EXAM_LEVEL_CODES as readonly string[]).includes(code);

export const EXAM_LEVEL_DIPLOMA: Record<ExamLevelCode, string> = { CM2: "CEP", "3E": "BEPC", TLE: "baccalauréat" };

export type Territory = "SCHOOL" | "COMMUNE" | "DEPARTMENT" | "NATIONAL";
export type ScopeLevel = "NATIONAL" | "DEPARTMENT" | "COMMUNE" | "SCHOOL" | "SELF";
export type ExamStatus = "DRAFT" | "PENDING_APPROVAL" | "APPROVED" | "REJECTED" | "CLOSED";
export type Participation = "INVITED" | "ACCEPTED" | "DECLINED" | "IMPOSED";

const RANK: Record<Territory, number> = { SCHOOL: 0, COMMUNE: 1, DEPARTMENT: 2, NATIONAL: 3 };

// The organiser level follows the creator's scope, never a form field.
export function organizerLevelOf(scope: ScopeLevel): Territory | null {
  return scope === "SELF" ? null : scope;
}

type ExamSchool = { communeId: string; departmentId: string; cycle?: CycleCode };

// Who approves a school initiated exam: the circonscription scolaire when
// every school taking part is a nursery or primary school of one commune,
// the departmental direction (DDEMP or DDESTFP) when they span communes of
// one department or when colleges take part (the secondary chain has no
// circonscription), the ministry beyond.
export function approvalLevel(schools: ExamSchool[]): Exclude<Territory, "SCHOOL"> {
  const primaryOnly = schools.every((s) => s.cycle === undefined || s.cycle === "PRESCHOOL" || s.cycle === "PRIMARY");
  if (primaryOnly && new Set(schools.map((s) => s.communeId)).size <= 1) return "COMMUNE";
  if (new Set(schools.map((s) => s.departmentId)).size <= 1) return "DEPARTMENT";
  return "NATIONAL";
}

// An authority may decide when it sits at the required level or above and
// every school taking part is inside its territory and its chain.
export function canDecideAt(
  scope: { level: ScopeLevel; communeId: string | null; departmentId: string | null; cycles?: readonly CycleCode[] | null },
  required: Exclude<Territory, "SCHOOL">,
  schools: ExamSchool[],
) {
  if (scope.level === "SELF" || scope.level === "SCHOOL") return false;
  if (RANK[scope.level] < RANK[required]) return false;
  if (scope.cycles && !schools.every((s) => cycleInScope(scope.cycles, s.cycle))) return false;
  if (scope.level === "NATIONAL") return true;
  if (scope.level === "DEPARTMENT") return !!scope.departmentId && schools.every((s) => s.departmentId === scope.departmentId);
  return !!scope.communeId && schools.every((s) => s.communeId === scope.communeId);
}

// The organiser acts on its own exam only: the school that created it, or
// the commune, department or ministry service at the same level.
export function isOrganizer(
  scope: { level: ScopeLevel; schoolId: string | null; communeId: string | null; departmentId: string | null },
  exam: { organizerLevel: Territory; organizerSchoolId: string | null; organizerCommuneId: string | null; organizerDepartmentId: string | null },
) {
  if (scope.level !== exam.organizerLevel) return false;
  switch (exam.organizerLevel) {
    case "SCHOOL":
      return !!scope.schoolId && scope.schoolId === exam.organizerSchoolId;
    case "COMMUNE":
      return !!scope.communeId && scope.communeId === exam.organizerCommuneId;
    case "DEPARTMENT":
      return !!scope.departmentId && scope.departmentId === exam.organizerDepartmentId;
    case "NATIONAL":
      return true;
  }
}

// Schools that sit the exam: accepted or imposed. The organiser school,
// when it teaches the level, is registered as accepted.
export const TAKES_PART: Participation[] = ["ACCEPTED", "IMPOSED"];
export const takesPart = (p: Participation) => TAKES_PART.includes(p);

// An invited school answers once, before the decision is final and before
// the exam starts. An imposed participation is never answered.
export function canRespond(exam: { status: ExamStatus; startDate: Date }, participation: Participation, now = new Date()) {
  if (participation !== "INVITED") return false;
  if (exam.status === "REJECTED" || exam.status === "CLOSED") return false;
  return startOfDay(now) < startOfDay(exam.startDate);
}

// The organiser school submits once at least one invited school accepted.
export function canSubmit(exam: { status: ExamStatus; organizerLevel: Territory }, participants: { status: Participation; isOrganizer: boolean }[]) {
  if (exam.organizerLevel !== "SCHOOL") return false;
  if (exam.status !== "DRAFT" && exam.status !== "REJECTED") return false;
  return participants.some((p) => !p.isOrganizer && p.status === "ACCEPTED");
}

// Only an approved exam runs: results are entered from its first day until
// the organiser closes it.
export function resultsOpen(exam: { status: ExamStatus; startDate: Date }, now = new Date()) {
  return exam.status === "APPROVED" && startOfDay(exam.startDate) <= startOfDay(now);
}

function startOfDay(d: Date) {
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

export function datesError(start: Date, end: Date, year: { startDate: Date; endDate: Date }): string | null {
  if (end < start) return "La date de fin doit suivre la date de début.";
  if (start < year.startDate || end > year.endDate) return "Les épreuves doivent se tenir pendant l'année scolaire.";
  if ((end.getTime() - start.getTime()) / 86_400_000 > 14) return "Un examen blanc dure au plus deux semaines.";
  return null;
}

// ---------------------------------------------------------------------------
// Results
// ---------------------------------------------------------------------------

export type Candidate = { enrollmentId: string; schoolId: string };
export type Score = { enrollmentId: string; subjectCode: string; score: number };

export type CandidateResult<C extends Candidate> = C & {
  scores: Record<string, number>;
  // Mean of the subjects entered, equal weights.
  average: number | null;
  // Every subject of the exam has a score. Only complete candidates are
  // ranked, so a missing paper never lifts or sinks a rank.
  complete: boolean;
  schoolRank: number | null;
  schoolTied: boolean;
  overallRank: number | null;
  overallTied: boolean;
};

export type SchoolSummary = {
  schoolId: string;
  candidates: number;
  complete: number;
  average: number | null;
  passRate: number | null;
  subjectAverages: Record<string, number | null>;
  rank: number | null;
  tied: boolean;
};

function mean(values: number[]): number | null {
  return values.length ? round2(values.reduce((a, b) => a + b, 0) / values.length) : null;
}

function ranksWithTies<T>(entries: T[], value: (e: T) => number | null) {
  const ranks = rankEntries(entries, value);
  const counts = new Map<number, number>();
  for (const r of ranks.values()) if (r !== null) counts.set(r, (counts.get(r) ?? 0) + 1);
  return (e: T) => {
    const rank = ranks.get(e) ?? null;
    return { rank, tied: rank !== null && (counts.get(rank) ?? 0) > 1 };
  };
}

export function computeResults<C extends Candidate>(candidates: C[], subjects: string[], scores: Score[]) {
  const byEnrollment = new Map<string, Record<string, number>>();
  const allowed = new Set(subjects);
  for (const s of scores) {
    if (!allowed.has(s.subjectCode)) continue;
    const row = byEnrollment.get(s.enrollmentId) ?? {};
    row[s.subjectCode] = s.score;
    byEnrollment.set(s.enrollmentId, row);
  }

  const base = candidates.map((c) => {
    const own = byEnrollment.get(c.enrollmentId) ?? {};
    const values = subjects.map((code) => own[code]).filter((v): v is number => v !== undefined);
    return { candidate: c, scores: own, average: mean(values), complete: subjects.length > 0 && values.length === subjects.length };
  });

  const overall = ranksWithTies(base, (b) => (b.complete ? b.average : null));
  const bySchool = new Map<string, typeof base>();
  for (const b of base) bySchool.set(b.candidate.schoolId, [...(bySchool.get(b.candidate.schoolId) ?? []), b]);
  const schoolRankers = new Map([...bySchool].map(([id, rows]) => [id, ranksWithTies(rows, (b) => (b.complete ? b.average : null))]));

  const results: CandidateResult<C>[] = base.map((b) => {
    const o = overall(b);
    const s = schoolRankers.get(b.candidate.schoolId)!(b);
    return { ...b.candidate, scores: b.scores, average: b.average, complete: b.complete, schoolRank: s.rank, schoolTied: s.tied, overallRank: o.rank, overallTied: o.tied };
  });

  const subjectAverages = Object.fromEntries(subjects.map((code) => [code, mean(results.map((r) => r.scores[code]).filter((v): v is number => v !== undefined))]));

  const schools: SchoolSummary[] = [...bySchool.keys()].map((schoolId) => {
    const rows = results.filter((r) => r.schoolId === schoolId);
    const averages = rows.map((r) => r.average).filter((v): v is number => v !== null);
    return {
      schoolId,
      candidates: rows.length,
      complete: rows.filter((r) => r.complete).length,
      average: mean(averages),
      passRate: averages.length ? round2(averages.filter((a) => isPassing(a)).length / averages.length) : null,
      subjectAverages: Object.fromEntries(subjects.map((code) => [code, mean(rows.map((r) => r.scores[code]).filter((v): v is number => v !== undefined))])),
      rank: null,
      tied: false,
    };
  });
  const schoolRank = ranksWithTies(schools, (s) => s.average);
  for (const s of schools) Object.assign(s, schoolRank(s));
  schools.sort((a, b) => (a.rank ?? Infinity) - (b.rank ?? Infinity));

  const averages = results.map((r) => r.average).filter((v): v is number => v !== null);
  return {
    results,
    schools,
    subjectAverages,
    overall: {
      candidates: results.length,
      complete: results.filter((r) => r.complete).length,
      average: mean(averages),
      passRate: averages.length ? round2(averages.filter((a) => isPassing(a)).length / averages.length) : null,
    },
  };
}

// ---------------------------------------------------------------------------
// Labels
// ---------------------------------------------------------------------------

export const STATUS_LABELS: Record<ExamStatus, string> = {
  DRAFT: "Invitations en cours",
  PENDING_APPROVAL: "En attente de validation",
  APPROVED: "Validé",
  REJECTED: "Refusé",
  CLOSED: "Clôturé",
};

export const STATUS_TONES = { DRAFT: "info", PENDING_APPROVAL: "warning", APPROVED: "success", REJECTED: "danger", CLOSED: "neutral" } as const;

export const PARTICIPATION_LABELS: Record<Participation, string> = {
  INVITED: "Invitation en attente",
  ACCEPTED: "Acceptée",
  DECLINED: "Déclinée",
  IMPOSED: "Participation imposée",
};

export const PARTICIPATION_TONES = { INVITED: "warning", ACCEPTED: "success", DECLINED: "danger", IMPOSED: "info" } as const;

export const ORGANIZER_LABELS: Record<Territory, string> = {
  SCHOOL: "Établissement",
  COMMUNE: "Circonscription scolaire",
  DEPARTMENT: "Direction départementale",
  NATIONAL: "Ministère",
};

export const APPROVER_LABELS: Record<Exclude<Territory, "SCHOOL">, string> = {
  COMMUNE: "la circonscription scolaire",
  DEPARTMENT: "la direction départementale",
  NATIONAL: "le ministère",
};

export const EXAM_STATUSES = Object.keys(STATUS_LABELS) as ExamStatus[];
export const isExamStatus = (v: unknown): v is ExamStatus => typeof v === "string" && (EXAM_STATUSES as string[]).includes(v);
