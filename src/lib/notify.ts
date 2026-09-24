import "server-only";

import { db } from "@/lib/db";

type NotificationInput = { kind: string; title: string; body: string; link?: string };

// Shared by every module that alerts someone (absence, published report card,
// new message, decided request). Never throws: a failed notification must not
// undo the action that caused it.
export async function notify(userIds: string[], input: NotificationInput) {
  const unique = [...new Set(userIds.filter(Boolean))];
  if (!unique.length) return;
  try {
    await db.notification.createMany({ data: unique.map((userId) => ({ userId, ...input })) });
  } catch (error) {
    console.error("notification failed", error);
  }
}

// User accounts of the guardians of the students behind these enrollments.
export async function guardianUserIds(enrollmentIds: string[]) {
  const links = await db.studentGuardian.findMany({
    where: { student: { enrollments: { some: { id: { in: enrollmentIds } } } }, guardian: { userId: { not: null } } },
    select: { guardian: { select: { userId: true } } },
  });
  return links.map((l) => l.guardian.userId!);
}
