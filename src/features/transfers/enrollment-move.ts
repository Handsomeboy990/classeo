import "server-only";

import type { Prisma } from "@/generated/prisma/client";

// Where an accepted transfer puts the pupil for the rest of the year.
//
// The data model allows one enrollment per pupil and school year
// (Enrollment @@unique([studentId, academicYearId])). Until it allows a
// second one, the enrollment of the year moves to the new class and, for a
// school change, to the new school: its grades, attendance and report cards
// stay attached to it, and the StudentTransfer row keeps where the pupil
// came from and when (the history splits the year at that date). With a
// second enrollment allowed, a school change should instead mark this one
// TRANSFERRED and create the new one here.
export async function moveEnrollment(
  tx: Prisma.TransactionClient,
  enrollmentId: string,
  // enrolledAt: set on arrival in a new school, kept on a class change.
  to: { schoolId: string; classroomId: string; enrolledAt?: Date },
) {
  await tx.enrollment.update({
    where: { id: enrollmentId },
    data: { schoolId: to.schoolId, classroomId: to.classroomId, status: "ACTIVE", ...(to.enrolledAt ? { enrolledAt: to.enrolledAt } : {}) },
  });
}
