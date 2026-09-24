import { GraduationCap, Landmark, LayoutGrid, UserSquare2 } from "lucide-react";

import { PageHeader } from "@/components/kit/page-header";
import { StatCard, StatGrid } from "@/components/kit/stat-card";
import { classroomWhere, enrollmentWhere, schoolWhere } from "@/lib/auth/scope";
import type { CurrentUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { formatNumber } from "@/lib/utils";

// Dashboard for ministry, departmental, communal and school staff.
// Owned by the ministry and statistics module.
export async function StaffDashboard({ user }: { user: NonNullable<CurrentUser> }) {
  const year = await db.academicYear.findFirst({ where: { isActive: true } });
  const yearFilter = year ? { academicYearId: year.id } : {};

  const [schools, students, classes, teachers] = await Promise.all([
    db.school.count({ where: schoolWhere(user) }),
    db.enrollment.count({ where: { AND: [enrollmentWhere(user), yearFilter, { status: "ACTIVE" }] } }),
    db.classroom.count({ where: { AND: [classroomWhere(user), yearFilter] } }),
    db.teacher.count({ where: { school: schoolWhere(user), isActive: true } }),
  ]);

  return (
    <>
      <PageHeader title={`Bonjour, ${user.firstName}`} description={`${user.role.name} · ${user.scope.label} · Année scolaire ${year?.label ?? ""}`} />
      <StatGrid>
        <StatCard label="Établissements" value={formatNumber(schools)} icon={Landmark} />
        <StatCard label="Élèves inscrits" value={formatNumber(students)} icon={GraduationCap} tone="info" />
        <StatCard label="Classes" value={formatNumber(classes)} icon={LayoutGrid} tone="accent" />
        <StatCard label="Enseignants" value={formatNumber(teachers)} icon={UserSquare2} tone="warning" />
      </StatGrid>
    </>
  );
}
