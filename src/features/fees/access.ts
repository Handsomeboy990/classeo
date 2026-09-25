import "server-only";

import { forbidden } from "next/navigation";
import { cache } from "react";

import type { Prisma } from "@/generated/prisma/client";
import { requirePermission } from "@/lib/auth/authorize";
import type { PermissionCode } from "@/lib/auth/permissions";
import { enrollmentWhere, schoolWhere } from "@/lib/auth/scope";
import type { CurrentUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { DomainError } from "@/lib/errors";

type User = NonNullable<CurrentUser>;

// Invoices are reached through the enrollment they bill: school staff see
// their school, a parent only their children, never the whole school.
export function invoiceWhere(user: User): Prisma.InvoiceWhereInput {
  return { enrollment: enrollmentWhere(user) };
}

export function paymentWhere(user: User): Prisma.PaymentWhereInput {
  return { invoice: invoiceWhere(user) };
}

export function feeTypeWhere(user: User): Prisma.FeeTypeWhereInput {
  return { school: schoolWhere(user) };
}

export const activeYear = cache(async () => db.academicYear.findFirst({ where: { isActive: true } }));

// Fee management screens are for school and territorial staff. Families
// reach their own invoices from their space, not the accounting screens.
export async function requireFeeStaff(permission: PermissionCode | PermissionCode[]) {
  const user = await requirePermission(permission);
  if (user.scope.level === "SELF") forbidden();
  return user;
}

// Writes that create school data need a school: the account's own.
export function requireSchoolId(user: User) {
  if (!user.scope.schoolId) throw new DomainError("Cette opération se fait depuis un compte rattaché à un établissement.");
  return user.scope.schoolId;
}

export function startOfToday() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}
