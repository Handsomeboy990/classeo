import { PageHeader } from "@/components/kit/page-header";
import type { CurrentUser } from "@/lib/auth/session";

// Dashboard for parents and students. Owned by the family and inclusion module.
export async function FamilyDashboard({ user }: { user: NonNullable<CurrentUser> }) {
  return <PageHeader title={`Bonjour, ${user.firstName}`} description={user.role.name} />;
}
