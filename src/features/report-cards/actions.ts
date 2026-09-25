"use server";

import { z } from "zod";

import { id } from "@/features/classes/academic";
import { createAction } from "@/lib/action";
import { audit } from "@/lib/audit";
import { classroomWhere } from "@/lib/auth/scope";
import { invalidate, tags } from "@/lib/cache";
import { db } from "@/lib/db";
import { DomainError } from "@/lib/errors";
import { guardianUserIds, notify } from "@/lib/notify";

import { computeClassCards } from "./compute";

// Publishes the report cards of a class for a period: computes them from the
// grades, writes one snapshot per student (republishing replaces it), then
// tells families.
export const publishReportCards = createAction({
  permission: "report_card:publish",
  schema: z.object({ classroomId: id, periodId: id }),
  handler: async (input, user) => {
    const classroom = await db.classroom.findFirst({
      where: { AND: [{ id: input.classroomId }, classroomWhere(user)] },
      select: { id: true, name: true, schoolId: true, academicYearId: true },
    });
    if (!classroom) throw new DomainError("Classe introuvable ou hors de votre périmètre.");
    const period = await db.schoolPeriod.findFirst({ where: { id: input.periodId, academicYearId: classroom.academicYearId } });
    if (!period) throw new DomainError("Cette période n'appartient pas à l'année de la classe.");

    const { cards } = await computeClassCards(classroom.id, period.id);
    if (!cards.length) throw new DomainError("Aucun élève inscrit dans cette classe.");
    if (cards.every((c) => c.generalAverage === null)) throw new DomainError("Aucune note n'a encore été saisie : il n'y a rien à publier.");

    const publishedAt = new Date();
    await db.$transaction(
      cards.map((c) => {
        const data = {
          generalAverage: c.generalAverage,
          rank: c.rank,
          classSize: cards.length,
          appreciation: c.appreciation,
          lines: c.lines,
          publishedAt,
          publishedById: user.id,
        };
        return db.reportCard.upsert({
          where: { enrollmentId_periodId: { enrollmentId: c.enrollmentId, periodId: period.id } },
          create: { enrollmentId: c.enrollmentId, periodId: period.id, ...data },
          update: data,
        });
      }),
    );

    const enrollmentIds = cards.map((c) => c.enrollmentId);
    const recipients = [...(await guardianUserIds(enrollmentIds)), ...cards.map((c) => c.student.userId).filter((u): u is string => !!u)];
    await notify(recipients, {
      kind: "report_card",
      title: `Bulletin du ${period.name} disponible`,
      body: `Le bulletin du ${period.name} de la ${classroom.name} est publié. Ouvrez-le pour voir les moyennes et l'appréciation, ou écoutez-le.`,
      link: "/espace/suivi",
    });
    await audit(user, {
      action: "publish",
      resource: "report_card",
      resourceId: classroom.id,
      summary: `Publication de ${cards.length} bulletins, ${classroom.name}, ${period.name}`,
      metadata: { periodId: period.id, notified: new Set(recipients).size },
      schoolId: classroom.schoolId,
    });
    invalidate(tags.stats);
    const notified = new Set(recipients).size;
    return `${cards.length} bulletins publiés pour la ${classroom.name}. ${
      notified ? `${notified} compte${notified > 1 ? "s" : ""} parent ou élève prévenu${notified > 1 ? "s" : ""}.` : "Aucun compte parent ou élève à prévenir dans cette classe."
    }`;
  },
});
