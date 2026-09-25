import "server-only";

import { forbidden } from "next/navigation";

import { can } from "@/lib/auth/authorize";
import type { PermissionCode } from "@/lib/auth/permissions";
import { requireUser, type CurrentUser } from "@/lib/auth/session";

import { canSignSchoolDocuments, signerKind } from "./access";

type User = NonNullable<CurrentUser>;

// The register lists every document of the school: kept to the office
// (head, secretary, accountant), not to every account holding one of the
// revoking rights (a teacher records attendance, and revokes nothing).
export const REGISTER_PERMISSIONS: PermissionCode[] = ["report_card:publish", "student:update", "payment:delete", "fee:update"];

export function canSeeRegister(user: User) {
  return user.scope.level !== "SELF" && REGISTER_PERMISSIONS.some((p) => can(user, p));
}

export function signatureTabs(user: User) {
  return [
    { href: "/espace/signature", label: "Ma signature", show: !!signerKind(user) },
    { href: "/espace/signature/documents", label: "Documents à signer", show: canSignSchoolDocuments(user) },
    { href: "/espace/signature/registre", label: "Documents délivrés", show: canSeeRegister(user) },
  ]
    .filter((t) => t.show)
    .map(({ href, label }) => ({ href, label }));
}

// Page gates, checked before anything streams.
export async function requireSigner() {
  const user = await requireUser();
  if (!signerKind(user)) forbidden();
  return user;
}

export async function requireSchoolSigner() {
  const user = await requireUser();
  if (!canSignSchoolDocuments(user)) forbidden();
  return user;
}

export async function requireRegister() {
  const user = await requireUser();
  if (!canSeeRegister(user)) forbidden();
  return user;
}
