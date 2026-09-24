import "server-only";

import { forbidden } from "next/navigation";

import type { PermissionCode } from "./permissions";
import { requireUser, type CurrentUser } from "./session";

export class ForbiddenError extends Error {
  constructor(message = "Vous n'avez pas le droit d'effectuer cette action.") {
    super(message);
    this.name = "ForbiddenError";
  }
}

type WithPermissions = { permissions: Set<PermissionCode> };

// Pure permission check. Used by the UI to decide what to show; the server
// never relies on it alone, see authorize().
export function can(user: WithPermissions | null | undefined, permission: PermissionCode) {
  return !!user && user.permissions.has(permission);
}

export function canAny(user: WithPermissions | null | undefined, permissions: PermissionCode[]) {
  return permissions.some((p) => can(user, p));
}

// The single server side choke point for actions. Throws when the permission
// is missing; the ownership part of the check is the caller's scoped query
// (see scope.ts), which must find the target row or fail.
export function authorize(user: CurrentUser | null, permission: PermissionCode): asserts user is NonNullable<CurrentUser> {
  if (!user) throw new ForbiddenError("Session expirée. Veuillez vous reconnecter.");
  if (!user.permissions.has(permission)) throw new ForbiddenError();
}

// For pages and layouts: renders the 403 page instead of throwing an error.
export async function requirePermission(permission: PermissionCode | PermissionCode[]) {
  const user = await requireUser();
  const list = Array.isArray(permission) ? permission : [permission];
  if (!canAny(user, list)) forbidden();
  return user;
}
