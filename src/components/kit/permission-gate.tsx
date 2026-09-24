import type { ReactNode } from "react";

import { canAny } from "@/lib/auth/authorize";
import type { PermissionCode } from "@/lib/auth/permissions";
import { getCurrentUser } from "@/lib/auth/session";

// Hides UI the user may not use. Presentation only: the server action behind
// the control still calls authorize().
export async function PermissionGate({ permission, children, fallback = null }: { permission: PermissionCode | PermissionCode[]; children: ReactNode; fallback?: ReactNode }) {
  const user = await getCurrentUser();
  return canAny(user, Array.isArray(permission) ? permission : [permission]) ? children : fallback;
}
