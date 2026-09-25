// Sections of a student file and the right each one needs. Seeing a student
// (accountant, secretary) is not reading their grades or attendance: every
// section checks the permission of what it shows. Pure, unit tested.

import type { PermissionCode } from "@/lib/auth/permissions";

export const SECTION_PERMISSIONS = {
  bulletins: "report_card:view",
  notes: "grade:view",
  presences: "attendance:view",
  "emploi-du-temps": "timetable:view",
  frais: "fee:view",
} as const satisfies Record<string, PermissionCode>;

export type StudentFileSection = keyof typeof SECTION_PERMISSIONS;

export function allowedSections(permissions: { has(code: PermissionCode): boolean }): StudentFileSection[] {
  return (Object.keys(SECTION_PERMISSIONS) as StudentFileSection[]).filter((s) => permissions.has(SECTION_PERMISSIONS[s]));
}
