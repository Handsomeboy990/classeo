import { notFound, redirect } from "next/navigation";

import { requirePermission } from "@/lib/auth/authorize";

// Menu shortcut for school staff: their own school page.
export default async function MySchoolPage() {
  const user = await requirePermission("school:view");
  if (!user.scope.schoolId) notFound();
  redirect(`/espace/etablissements/${user.scope.schoolId}`);
}
