// Results of the past years: marks (at CEG Godomey and EPP Godomey Centre),
// published report cards for every period of the school's periodicity, and
// the class council decisions of each year end.
//
// The council decision comes first (the pupil is found the next year in
// the class above, in the same class, or has left), then the marks are
// drawn around the pupil's level and made consistent with it: in secondary
// school, passage needs a yearly average of at least 10/20 and repetition
// is below (order n° 029 of 2024, articles 59 to 62); in primary school the
// pupils of CI, CE1 and CM1 move up whatever the average. Subject averages
// follow the official formula (OFFICIAL_2024), general averages the
// coefficients, yearly averages the periodicity rule.

import type { Prisma } from "../../src/generated/prisma/client";
import { generalAverage, rankEntries, round2, subjectAverage, type GradeInput } from "../../src/lib/domain/grades";
import { yearlyAverage } from "../../src/lib/domain/periodicity";
import { clamp, shortId } from "../seed-lib/random";
import { PRIMARY_SUBJECTS, SECONDARY_SUBJECTS, coefficientOf } from "../seed-lib/reference";
import type { HistoryContext } from "./index";
import type { PeriodRef, Stint } from "./types";

// Average level of each year compared with the pupil's own level.
const YEAR_EFFECT = [-0.45, -0.25, -0.05, 0.1];
const AUTO = new Set(["CI", "CE1", "CM1"]);
const EXCLUSION_NOTES = [
  "Exclusion prononcée pour absences répétées non justifiées et indiscipline, après avis du conseil de discipline.",
  "Exclusion pour faute grave (violence envers un camarade), après avis du conseil de discipline.",
  "Exclusion pour résultats très insuffisants et absences répétées malgré les avertissements.",
];

const appreciation = (avg: number | null) =>
  avg === null ? null : avg >= 14 ? "Très bon travail, continuez ainsi." : avg >= 10 ? "Travail satisfaisant, peut mieux faire." : "Résultats insuffisants, un soutien est recommandé.";

type Line = { code: string; name: string; coefficient: number; avg: number; marks: number[] | null };
type Card = { stint: Stint; period: PeriodRef; lines: Line[]; general: number | null };

const half = (v: number) => clamp(Math.round(v * 2) / 2, 0, 20);

function averageOf(marks: number[]) {
  const grades: GradeInput[] = [
    { type: "INTERROGATION", value: marks[0]!, maxValue: 20 },
    { type: "INTERROGATION", value: marks[1]!, maxValue: 20 },
    { type: "DEVOIR", value: marks[2]!, maxValue: 20 },
    { type: "DEVOIR", value: marks[3]!, maxValue: 20 },
  ];
  return subjectAverage("OFFICIAL_2024", grades).average!;
}

export async function writeResults(ctx: HistoryContext) {
  const { input, rng, years, stints, info, schoolById, bulk } = { ...ctx, bulk: ctx.input.bulk };
  const detailedIds = new Set([ctx.ceg.id, ctx.epp.id]);
  // Subject lines of a published card. The two demonstration schools name
  // the teacher of each subject; elsewhere the application shows the teacher
  // assigned to the class. To keep the volume reasonable over the network,
  // the past cards carry their subject lines only in the Atlantique and the
  // Littoral, where the demonstration accounts work: elsewhere they hold the
  // general average and the rank, all the statistics need.
  const lineMode = (schoolId: string) => {
    const s = schoolById.get(schoolId)!;
    if (detailedIds.has(schoolId)) return "teacher";
    return s.departmentName === "Atlantique" || s.departmentName === "Littoral" ? "lines" : "none";
  };
  const courseOf = new Map(ctx.courses.map((c) => [`${c.classroomId}|${c.subjectCode}`, c]));
  const teacherName = (id: string | null | undefined) => {
    const t = id ? ctx.teacherById.get(id) : undefined;
    return t ? `${t.firstName} ${t.lastName}` : null;
  };

  const cards: Card[] = [];
  const decisions: Prisma.ClassCouncilDecisionCreateManyInput[] = [];
  for (let y = 0; y <= 3; y++) {
    const year = years[y]!;
    for (const st of stints[y]!) {
      const school = schoolById.get(st.schoolId)!;
      const sec = school.cycle === "SECONDARY";
      const detailed = detailedIds.has(school.id);
      const periods = year.periods.filter((p) => p.periodicity === school.periodicity).sort((a, b) => a.order - b.order);
      const done = st.periodsDone ?? periods.length;
      const me = info.get(st.studentId)!;
      const constrained = st.status === "ACTIVE" && (st.outcome === "PROMOTED" || st.outcome === "REPEAT") && (sec || !AUTO.has(st.level));

      let target = me.ability + YEAR_EFFECT[y]! + rng.normal(0, 0.8);
      if (constrained && st.outcome === "PROMOTED" && target < 10) target = 10 + rng.rand() * 0.9;
      if (constrained && st.outcome === "REPEAT" && target >= 10) target = 9.9 - rng.rand() * 1.5;
      if (st.outcome === "EXCLUDED") target = Math.min(target, 7.5 - rng.rand());
      target = clamp(target, 3, 18.5);

      // Period targets around the yearly one: a slow rise over the year.
      let goals: number[];
      if (periods.length === 3) {
        const d = [-0.3 + rng.normal(0, 0.5), rng.normal(0, 0.5), 0.3 + rng.normal(0, 0.5)];
        const m = (d[0]! + d[1]! + d[2]!) / 3;
        goals = d.map((x) => target + x - m);
      } else {
        const s1 = target - 0.2 + rng.normal(0, 0.4);
        goals = [s1, (3 * target - s1) / 2];
      }
      const subjectList = sec ? SECONDARY_SUBJECTS : PRIMARY_SUBJECTS;
      const [code, letter] = st.spec.split(":") as [string, string];
      const offsets = subjectList.map(() => rng.normal(0, 1.5));
      const coefs = subjectList.map((s) => coefficientOf(code, letter, s));
      const shift = offsets.reduce((a, o, j) => a + o * coefs[j]!, 0) / coefs.reduce((a, c) => a + c, 0);

      const mine: Card[] = periods.slice(0, done).map((period, k) => {
        const lines = subjectList.map((s, j) => {
          const t = clamp(goals[k]! + offsets[j]! - shift + rng.normal(0, 0.8), 1, 19.5);
          if (!detailed) return { code: s.code, name: s.name, coefficient: coefs[j]!, avg: round2(t), marks: null };
          const i1 = half(t + rng.normal(0, 2));
          const i2 = half(t + rng.normal(0, 2));
          const d1 = half(t + rng.normal(0, 1.6));
          const d2 = half(3 * t - (i1 + i2) / 2 - d1);
          const marks = [i1, i2, d1, d2];
          return { code: s.code, name: s.name, coefficient: coefs[j]!, avg: averageOf(marks), marks };
        });
        return { stint: st, period, lines, general: generalAverage(lines.map((l) => ({ average: l.avg, coefficient: l.coefficient }))) };
      });
      const yearly = () => yearlyAverage(mine.map((c) => ({ periodicity: c.period.periodicity, order: c.period.order, average: c.general })));

      // The council's decision holds: nudge the last marks until the yearly
      // average agrees with it, then all the marks if that is not enough.
      if (constrained) {
        const wrong = () => {
          const a = yearly();
          return a !== null && (st.outcome === "PROMOTED" ? a < 10 : a >= 10);
        };
        const up = st.outcome === "PROMOTED" ? 1 : -1;
        for (let step = 0; step < 60 && wrong(); step++) {
          for (const card of step < 20 ? mine.slice(-1) : mine) {
            for (const l of card.lines) {
              if (l.marks) {
                l.marks[3] = half(l.marks[3]! + 0.5 * up);
                l.marks[2] = step >= 10 ? half(l.marks[2]! + 0.5 * up) : l.marks[2]!;
                l.avg = averageOf(l.marks);
              } else l.avg = round2(clamp(l.avg + 0.25 * up, 0, 20));
            }
            card.general = generalAverage(card.lines.map((l) => ({ average: l.avg, coefficient: l.coefficient })));
          }
        }
      }
      cards.push(...mine);

      if (st.status === "ACTIVE" && st.outcome) {
        decisions.push({
          id: shortId(),
          enrollmentId: st.id,
          decision: st.outcome,
          yearlyAverage: yearly(),
          note: st.outcome === "EXCLUDED" ? rng.pick(EXCLUSION_NOTES) : null,
          decidedById: ctx.directorOf(st.schoolId) ?? input.users.minister,
          decidedAt: new Date(year.endDate.getTime() + 3 * 86_400_000 + 10 * 3600_000),
          updatedAt: new Date(year.endDate.getTime() + 3 * 86_400_000 + 10 * 3600_000),
        });
      }
    }
  }

  // Ranks per class and period, then the rows -----------------------------------
  const groups = new Map<string, Card[]>();
  for (const c of cards) {
    const k = `${c.stint.classroomId}|${c.period.id}`;
    const list = groups.get(k);
    if (list) list.push(c);
    else groups.set(k, [c]);
  }
  const reportCards: Prisma.ReportCardCreateManyInput[] = [];
  for (const list of groups.values()) {
    const ranks = rankEntries(list, (c) => c.general);
    const mode = lineMode(list[0]!.stint.schoolId);
    const subjectRanks = list[0]!.lines.map((_, j) => rankEntries(list, (c) => c.lines[j]!.avg));
    for (const c of list) {
      const publisher = ctx.directorOf(c.stint.schoolId) ?? input.users.minister;
      reportCards.push({
        id: shortId(),
        enrollmentId: c.stint.id,
        periodId: c.period.id,
        generalAverage: c.general,
        rank: ranks.get(c) ?? null,
        classSize: list.length,
        appreciation: appreciation(c.general),
        lines:
          mode === "none"
            ? []
            : c.lines.map((l, j) => ({
                subject: l.name,
                coefficient: l.coefficient,
                average: l.avg,
                rank: subjectRanks[j]!.get(c) ?? null,
                ...(mode === "teacher" ? { teacher: teacherName(courseOf.get(`${c.stint.classroomId}|${l.code}`)?.teacherId) } : {}),
              })),
        publishedAt: new Date(c.period.endDate.getTime() + 7 * 86_400_000 + 9 * 3600_000),
        publishedById: publisher,
      });
    }
  }
  await bulk.insert("ReportCard", reportCards, 4000);
  await bulk.insert("ClassCouncilDecision", decisions);

  // Marks of the two demonstration schools: one locked sheet per course and
  // period, two interrogations and two devoirs surveillés per pupil.
  const sheets: Prisma.GradeSheetCreateManyInput[] = [];
  const grades: Prisma.GradeCreateManyInput[] = [];
  const sheetOf = new Map<string, string>();
  const TYPES = [
    ["INTERROGATION", 1],
    ["INTERROGATION", 2],
    ["DEVOIR", 1],
    ["DEVOIR", 2],
  ] as const;
  for (const c of cards) {
    if (!detailedIds.has(c.stint.schoolId)) continue;
    for (const l of c.lines) {
      const course = courseOf.get(`${c.stint.classroomId}|${l.code}`)!;
      const key = `${course.id}|${c.period.id}`;
      let sheetId = sheetOf.get(key);
      const grader = input.teacherUserIds.get(course.teacherId!) ?? ctx.directorOf(c.stint.schoolId) ?? input.users.minister;
      if (!sheetId) {
        sheetId = shortId();
        sheetOf.set(key, sheetId);
        const lockedAt = new Date(c.period.endDate.getTime() + 5 * 86_400_000 + 15 * 3600_000);
        sheets.push({ id: sheetId, assignmentId: course.id!, periodId: c.period.id, formula: "OFFICIAL_2024", interrogationCount: 2, devoirCount: 2, compositionCount: 0, isLocked: true, lockedAt, lockedById: grader, createdAt: c.period.startDate, updatedAt: lockedAt });
      }
      TYPES.forEach(([type, sequence], i) =>
        grades.push({ id: shortId(), gradeSheetId: sheetId, enrollmentId: c.stint.id, type, sequence, value: l.marks![i]!, maxValue: 20, gradedById: grader, updatedAt: new Date(c.period.endDate.getTime() - (4 - i) * 12 * 86_400_000) }),
      );
    }
  }
  await bulk.insert("GradeSheet", sheets);
  await bulk.insert("Grade", grades, 8000);
  console.log(`history: ${reportCards.length} report cards, ${decisions.length} council decisions, ${grades.length} marks in ${sheets.length} sheets`);
}
