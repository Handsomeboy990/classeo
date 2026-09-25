import { shortDate } from "@/features/students/labels";
import { classroomWhere } from "@/lib/auth/scope";
import { ATTENDANCE_LABELS, addDays, isIsoDate, isoToDate, todayIso } from "@/lib/domain/attendance";
import { db } from "@/lib/db";
import { exportCsv } from "@/lib/export";

// Attendance records of a class between two dates (31 days at most).
export async function GET(request: Request) {
  const sp = new URL(request.url).searchParams;
  const classroomId = sp.get("classe") ?? "";
  const au = sp.get("au") ?? "";
  const du = sp.get("du") ?? "";
  const to = isIsoDate(au) ? au : todayIso();
  const fromRaw = isIsoDate(du) ? du : addDays(to, -6);
  const from = fromRaw < addDays(to, -30) ? addDays(to, -30) : fromRaw;

  return exportCsv({
    permission: "attendance:export",
    resource: "attendance",
    filename: `presences-${from}-${to}.csv`,
    load: async (user) =>
      db.studentAttendance.findMany({
        where: { date: { gte: isoToDate(from), lte: isoToDate(to) }, enrollment: { classroomId, classroom: classroomWhere(user) } },
        orderBy: [{ date: "asc" }, { half: "asc" }, { enrollment: { student: { lastName: "asc" } } }],
        select: {
          date: true,
          half: true,
          status: true,
          reason: true,
          enrollment: { select: { classroom: { select: { name: true } }, student: { select: { matricule: true, firstName: true, lastName: true } } } },
        },
        take: 20000,
      }),
    columns: [
      { header: "Date", value: (r) => shortDate(r.date) },
      { header: "Demi-journée", value: (r) => (r.half === "MORNING" ? "Matin" : "Après-midi") },
      { header: "Classe", value: (r) => r.enrollment.classroom.name },
      { header: "Matricule", value: (r) => r.enrollment.student.matricule },
      { header: "Élève", value: (r) => `${r.enrollment.student.lastName} ${r.enrollment.student.firstName}` },
      { header: "Statut", value: (r) => ATTENDANCE_LABELS[r.status] },
      { header: "Motif", value: (r) => r.reason ?? "" },
    ],
  });
}
