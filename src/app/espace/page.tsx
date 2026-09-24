import type { Metadata } from "next";

import { FamilyDashboard } from "@/features/family/family-dashboard";
import { TeacherDashboard } from "@/features/grades/teacher-dashboard";
import { StaffDashboard } from "@/features/statistics/staff-dashboard";
import { requireUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Tableau de bord" };

// One entry point, one dashboard per kind of user.
export default async function DashboardPage() {
  const user = await requireUser();
  if (user.scope.level === "SELF") return <FamilyDashboard user={user} />;
  if (user.role.code === "TEACHER") return <TeacherDashboard user={user} />;
  return <StaffDashboard user={user} />;
}
