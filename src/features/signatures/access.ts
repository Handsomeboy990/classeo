// Who signs. Derived from the rights, never from a role name: a school head
// is the school account that publishes report cards and edits the school
// (the head's default role); a territorial signer is the communal,
// departmental or national official who decides requests. Pure, tested.

import type { PermissionCode } from "@/lib/auth/permissions";

type Signer = { permissions: Set<PermissionCode>; scope: { level: "NATIONAL" | "DEPARTMENT" | "COMMUNE" | "SCHOOL" | "SELF"; schoolId: string | null } };

export type SignerKind = "school" | "territory";

export function signerKind(user: Signer): SignerKind | null {
  const p = user.permissions;
  if (user.scope.level === "SCHOOL") return user.scope.schoolId && p.has("report_card:publish") && p.has("school:update") ? "school" : null;
  if (user.scope.level === "SELF") return null;
  return p.has("request:approve") ? "territory" : null;
}

// Only the school head signs school documents (attestation, certificate,
// report card). Territorial officials keep a signature for the documents
// their level issues.
export function canSignSchoolDocuments(user: Signer) {
  return signerKind(user) === "school";
}

export const SIGNER_LABELS: Record<SignerKind, string> = {
  school: "Chef d'établissement",
  territory: "Autorité territoriale",
};
