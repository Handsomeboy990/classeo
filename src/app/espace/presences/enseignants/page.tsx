import { CalendarCheck, CalendarDays, UserX } from "lucide-react";
import type { Metadata } from "next";

import { PageHeader } from "@/components/kit/page-header";
import { StatCard, StatGrid } from "@/components/kit/stat-card";
import { EmptyState } from "@/components/kit/states";
import { saveTeacherAttendance } from "@/features/attendance/actions";
import { AttendanceRegister } from "@/features/attendance/components/attendance-register";
import { RegisterFilters } from "@/features/attendance/components/register-filters";
import { teacherRegister, teacherStats } from "@/features/attendance/queries";
import { can, requirePermission } from "@/lib/auth/authorize";
import { isIsoDate, todayIso } from "@/lib/domain/attendance";
import { param } from "@/lib/list";
import { formatDate, formatNumber, formatPercent } from "@/lib/utils";

export const metadata: Metadata = { title: "Présence des enseignants" };

export default async function TeacherAttendancePage(props: PageProps<"/espace/presences/enseignants">) {
  const user = await requirePermission("attendance:view");
  // Seeing staff attendance also needs access to the teacher list.
  const staff = await requirePermission("teacher:view");
  const sp = await props.searchParams;
  const today = todayIso();
  const raw = param(sp, "date") ?? "";
  const date = isIsoDate(raw) && raw <= today ? raw : today;
  const [rows, stats] = await Promise.all([teacherRegister(staff, date), teacherStats(user, date)]);
  const editable = can(user, "attendance:create") && can(user, "teacher:update");

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: "Présences", href: `/espace/presences?date=${date}` }, { label: "Enseignants" }]} title="Présence des enseignants" description={`Journée du ${formatDate(date)}.`} />
      <RegisterFilters action="/espace/presences/enseignants" date={date} maxDate={today} />
      <StatGrid>
        <StatCard label="Présence du jour" value={formatPercent(stats.dayRate)} icon={CalendarCheck} />
        <StatCard label="Présence de la semaine" value={formatPercent(stats.weekRate)} icon={CalendarDays} tone="info" hint={`Du ${formatDate(stats.week.from)} au ${formatDate(stats.week.to)}`} />
        <StatCard label="Absents du jour" value={formatNumber(stats.absentToday)} icon={UserX} tone="danger" />
        <StatCard label="Enseignants" value={formatNumber(rows.length)} tone="accent" />
      </StatGrid>
      <div className="mt-6">
        {rows.length ? (
          <AttendanceRegister
            rows={rows.map((r) => ({ id: r.id, name: r.name, detail: r.detail, status: r.status, reason: r.reason }))}
            action={saveTeacherAttendance}
            payload={{ date }}
            idKey="teacherId"
            editable={editable}
            caption="Présence des enseignants"
          />
        ) : (
          <EmptyState title="Aucun enseignant actif" />
        )}
      </div>
    </>
  );
}
