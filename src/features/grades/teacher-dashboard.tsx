import { PageHeader } from "@/components/kit/page-header";
import type { CurrentUser } from "@/lib/auth/session";

// Dashboard for teachers. Owned by the pedagogy module.
export async function TeacherDashboard({ user }: { user: NonNullable<CurrentUser> }) {
  return <PageHeader title={`Bonjour, ${user.firstName}`} description={`${user.role.name} · ${user.scope.label}`} />;
}
