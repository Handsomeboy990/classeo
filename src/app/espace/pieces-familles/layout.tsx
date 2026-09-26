import { forbidden } from "next/navigation";

import { requirePermission } from "@/lib/auth/authorize";

// Section gate, checked before any loading boundary streams: school staff
// who examine family pieces, general or health ones.
export default async function Layout({ children }: LayoutProps<"/espace/pieces-familles">) {
  const user = await requirePermission(["family_document:approve", "health_document:approve"]);
  if (user.scope.level !== "SCHOOL") forbidden();
  return children;
}
