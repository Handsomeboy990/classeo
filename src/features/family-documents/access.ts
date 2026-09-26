import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { can } from "@/lib/auth/authorize";
import { enrollmentWhere } from "@/lib/auth/scope";
import type { CurrentUser } from "@/lib/auth/session";
import { db } from "@/lib/db";

import { familyMayRead, isHealthDoc, reviewPermission } from "./rules";

type User = NonNullable<CurrentUser>;

const NOTHING = { id: "__none__" } as const;

// The pieces a member of staff may examine: those of their own school, for
// the kinds their rights cover. Health pieces need health_document:approve;
// the others family_document:approve. Teachers hold neither by default.
export function staffDocWhere(user: User): Prisma.FamilyDocumentWhereInput {
  if (user.scope.level !== "SCHOOL" || !user.scope.schoolId) return NOTHING;
  const general = can(user, "family_document:approve");
  const health = can(user, "health_document:approve");
  if (!general && !health) return NOTHING;
  const healthWhere: Prisma.FamilyDocumentWhereInput = { OR: [{ kind: "MEDICAL" }, { requiredPiece: { isHealth: true } }] };
  const kinds: Prisma.FamilyDocumentWhereInput[] = [];
  if (health) kinds.push(healthWhere);
  if (general) kinds.push({ NOT: healthWhere });
  return { schoolId: user.scope.schoolId, OR: kinds };
}

// The pieces a family account sees: those of its own children (or its
// own, for a student), without the health pieces for a student.
export function familyDocWhere(user: User): Prisma.FamilyDocumentWhereInput {
  if (user.scope.level !== "SELF") return NOTHING;
  const own: Prisma.FamilyDocumentWhereInput = { enrollment: enrollmentWhere(user) };
  if (user.guardianId) return own;
  if (user.studentId) return { AND: [own, { kind: { not: "MEDICAL" } }, { OR: [{ requiredPieceId: null }, { requiredPiece: { isHealth: false } }] }] };
  return NOTHING;
}

// Read check of the file route (/api/files/[id]) for a family piece.
export async function canReadFamilyFile(user: User, fileId: string): Promise<{ allowed: boolean; health: boolean }> {
  const doc = await db.familyDocument.findFirst({
    where: { fileId },
    select: { kind: true, schoolId: true, enrollmentId: true, requiredPiece: { select: { isHealth: true } } },
  });
  if (!doc) return { allowed: false, health: false };
  const health = isHealthDoc(doc);
  if (user.scope.level === "SELF") {
    if (!familyMayRead(user, { health })) return { allowed: false, health };
    const own = await db.enrollment.count({ where: { AND: [{ id: doc.enrollmentId }, enrollmentWhere(user)] } });
    return { allowed: own > 0, health };
  }
  const staff = user.scope.level === "SCHOOL" && user.scope.schoolId === doc.schoolId && can(user, reviewPermission({ health }));
  return { allowed: staff, health };
}
