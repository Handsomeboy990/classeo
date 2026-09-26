import "server-only";

import type { CurrentUser } from "@/lib/auth/session";
import { schoolWhere } from "@/lib/auth/scope";
import { db } from "@/lib/db";

type User = NonNullable<CurrentUser>;

// The school of the signed in head, with its payment accounts.
export async function getOwnSchoolSettings(user: User) {
  if (user.scope.level !== "SCHOOL" || !user.scope.schoolId) return null;
  return db.school.findFirst({
    where: { AND: [{ id: user.scope.schoolId }, schoolWhere(user)] },
    select: {
      id: true,
      code: true,
      name: true,
      motto: true,
      address: true,
      phone: true,
      email: true,
      postalBox: true,
      website: true,
      logoFileId: true,
      status: true,
      periodicity: true,
      allowsComposition: true,
      paymentAccounts: {
        orderBy: [{ isActive: "desc" }, { createdAt: "asc" }],
        select: { id: true, channel: true, provider: true, accountName: true, accountNumber: true, instructions: true, isActive: true },
      },
    },
  });
}

// Active accounts of a school, for the parent payment screens (another
// module). Safe to show: parents pay into them.
export function activePaymentAccounts(schoolId: string) {
  return db.schoolPaymentAccount.findMany({
    where: { schoolId, isActive: true },
    orderBy: { createdAt: "asc" },
    select: { id: true, channel: true, provider: true, accountName: true, accountNumber: true, instructions: true },
  });
}
