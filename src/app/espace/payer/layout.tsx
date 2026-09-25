import { forbidden } from "next/navigation";

import { requirePermission } from "@/lib/auth/authorize";

// Parents only: the accounting screens record payments for staff. Checked
// before any loading boundary streams, so a refusal is a real 403.
export default async function Layout({ children }: LayoutProps<"/espace/payer">) {
  const user = await requirePermission("fee:view");
  if (user.scope.level !== "SELF" || !user.guardianId) forbidden();
  return children;
}
