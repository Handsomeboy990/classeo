import { forbidden } from "next/navigation";

import { requirePermission } from "@/lib/auth/authorize";
import { isTeacherRole } from "@/lib/auth/scope";

// Checked before the loading skeleton streams, so a refused account gets a
// real 403: only organisers (school management, district, department,
// ministry) create an exam.
export default async function Layout({ children }: LayoutProps<"/espace/examens-blancs/nouveau">) {
  const user = await requirePermission("mock_exam:create");
  if (user.scope.level === "SELF" || isTeacherRole(user)) forbidden();
  return children;
}
