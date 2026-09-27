// The timetable of CEG Godomey for each past year: the classes and teachers
// of that year, placed without conflict like this year's.
import { planWeek, SPLIT, type Lesson } from "../seed-lib/timetable";
import type { HistoryContext } from "./index";
import { shortId } from "../seed-lib/random";

export async function writeTimetables(ctx: HistoryContext) {
  let count = 0;
  for (let y = 0; y <= 3; y++) {
    const lessons: Lesson[] = [];
    for (const c of ctx.courses) {
      if (c.year !== y || c.schoolId !== ctx.ceg.id) continue;
      const [code, letter] = c.spec.split(":") as [string, string];
      const className = `${ctx.input.levels.get(code)!.name} ${letter}`;
      for (const hours of SPLIT[c.weeklyHours!]!) lessons.push({ classroomId: c.classroomId, className, assignmentId: c.id!, teacherId: c.teacherId!, subjectCode: c.subjectCode, hours });
    }
    const slots = planWeek(lessons, ctx.rng.rand, shortId);
    count += await ctx.input.bulk.insert("TimetableSlot", slots);
  }
  console.log(`history: ${count} timetable slots at CEG Godomey`);
}
