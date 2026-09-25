import { saveAttendance } from "@/features/attendance/actions";
import { saveGrades } from "@/features/grades/actions";
import { sheetWriteWhere } from "@/features/grades/queries";
import { sendMessage } from "@/features/messages/actions";
import { replay, replayRequestSchema, type ReplayDeps } from "@/features/offline/replay";
import { findSubmission, recordRejected } from "@/features/offline/submission";
import type { OfflineKind, ReplayOutcome } from "@/features/offline/types";
import { classroomWhere } from "@/lib/auth/scope";
import { getCurrentUser, type CurrentUser } from "@/lib/auth/session";
import { isIsoDate, isoToDate } from "@/lib/domain/attendance";
import { db } from "@/lib/db";
import { assertWritable } from "@/lib/guards";
import { hitRateLimit } from "@/lib/rate-limit";

type User = NonNullable<CurrentUser>;

const MAX_BODY = 512 * 1024;

// Replays one entry typed without network (see src/features/offline). The
// session cookie authenticates the request again; the entry must belong to
// the signed in account; the same server action as the online save runs,
// after the conflict and writability checks of replay().
export async function POST(request: Request) {
  if (!sameOrigin(request)) return answer({ outcome: "rejected", reason: "Requête refusée." }, 403);
  if (!request.headers.get("content-type")?.startsWith("application/json")) return answer({ outcome: "rejected", reason: "Format refusé." }, 415);

  const text = await request.text();
  if (text.length > MAX_BODY) return answer({ outcome: "rejected", reason: "Saisie trop volumineuse pour être envoyée en une fois." }, 413);
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return answer({ outcome: "rejected", reason: "Saisie illisible." }, 400);
  }
  const parsed = replayRequestSchema.safeParse(json);
  if (!parsed.success) return answer({ outcome: "rejected", reason: "Saisie illisible." }, 400);

  const user = await getCurrentUser();
  if (user) {
    const limit = await hitRateLimit(`offline-replay:${user.id}`, 300, 15 * 60 * 1000);
    if (!limit.allowed) return answer({ outcome: "retry", reason: "Trop d'envois d'un coup. Nouvel essai dans quelques minutes." }, 429);
  }

  const outcome = await replay(parsed.data, user, user ? deps(user) : (undefined as never));
  const status = outcome.outcome === "auth" ? 401 : outcome.outcome === "other-user" ? 403 : outcome.outcome === "retry" ? 503 : 200;
  return answer(outcome, status);
}

function answer(outcome: ReplayOutcome, status = 200) {
  return Response.json(outcome, { status, headers: { "Cache-Control": "no-store" } });
}

// Cookies are SameSite=Lax, which already keeps them off cross site POST
// requests; the origin is still checked, as server actions do.
function sameOrigin(request: Request) {
  const site = request.headers.get("sec-fetch-site");
  if (site && site !== "same-origin") return false;
  const origin = request.headers.get("origin");
  if (!origin) return false;
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  try {
    return !!host && new URL(origin).host === host;
  } catch {
    return false;
  }
}

const ACTIONS: Record<OfflineKind, (prev: null, input: never) => ReturnType<typeof saveGrades>> = {
  grades: saveGrades as never,
  attendance: saveAttendance as never,
  message: sendMessage as never,
};

function deps(user: User): ReplayDeps {
  return {
    findSubmission,
    recordRejected,
    assertWritable: (target) => assertWritable(target),
    runAction: (kind, input) => ACTIONS[kind](null, input as never),

    loadGradeTarget: async (payload) => {
      const sheet = await db.gradeSheet.findFirst({
        where: { AND: [{ id: payload.sheetId }, sheetWriteWhere(user)] },
        select: { id: true, assignment: { select: { classroom: { select: { id: true, schoolId: true, academicYearId: true } } } } },
      });
      if (!sheet) return null;
      const ids = [...new Set(payload.cells.map((c) => c.enrollmentId))];
      const [grades, enrollments] = await Promise.all([
        db.grade.findMany({ where: { gradeSheetId: sheet.id, enrollmentId: { in: ids } }, select: { enrollmentId: true, type: true, sequence: true, value: true } }),
        db.enrollment.findMany({ where: { id: { in: ids }, classroomId: sheet.assignment.classroom.id }, select: { id: true, student: { select: { firstName: true, lastName: true } } } }),
      ]);
      return {
        schoolId: sheet.assignment.classroom.schoolId,
        academicYearId: sheet.assignment.classroom.academicYearId,
        grades: grades.map((g) => ({ enrollmentId: g.enrollmentId, type: g.type, sequence: g.sequence, value: Number(g.value) })),
        names: new Map(enrollments.map((e) => [e.id, `${e.student.firstName} ${e.student.lastName}`])),
      };
    },

    loadAttendanceTarget: async (payload) => {
      if (!isIsoDate(payload.date)) return null;
      const classroom = await db.classroom.findFirst({ where: { AND: [{ id: payload.classroomId }, classroomWhere(user)] }, select: { id: true, schoolId: true, academicYearId: true } });
      if (!classroom) return null;
      const ids = [...new Set(payload.records.map((r) => r.enrollmentId))];
      const [records, enrollments] = await Promise.all([
        db.studentAttendance.findMany({
          where: { enrollmentId: { in: ids }, date: isoToDate(payload.date), half: payload.half, enrollment: { classroomId: classroom.id } },
          select: { enrollmentId: true, status: true, reason: true },
        }),
        db.enrollment.findMany({ where: { id: { in: ids }, classroomId: classroom.id }, select: { id: true, student: { select: { firstName: true, lastName: true } } } }),
      ]);
      return {
        schoolId: classroom.schoolId,
        academicYearId: classroom.academicYearId,
        records,
        names: new Map(enrollments.map((e) => [e.id, `${e.student.firstName} ${e.student.lastName}`])),
      };
    },
  };
}
