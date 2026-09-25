"use server";

import { z } from "zod";

import { createAction } from "@/lib/action";
import { audit } from "@/lib/audit";
import { schoolWhere } from "@/lib/auth/scope";
import { invalidate, tags } from "@/lib/cache";
import { db } from "@/lib/db";
import { DomainError } from "@/lib/errors";
import { notify } from "@/lib/notify";

import { SCHOOL_STATUS_LABELS, SCHOOL_STATUSES } from "./labels";

// The ministry, a department or a commune suspends, closes or reactivates a
// school of its territory, always with a reason. Writes of a suspended or
// closed school are then refused by assertWritable (lib/guards.ts).
export const setSchoolStatus = createAction({
  permission: "school:lock",
  schema: z.object({
    id: z.string().trim().min(1).max(64),
    status: z.enum(SCHOOL_STATUSES, "Choisissez un statut."),
    reason: z.string().trim().min(10, "Motivez la décision (10 caractères minimum).").max(500, "500 caractères au maximum."),
  }),
  handler: async ({ id, status, reason }, user) => {
    if (!["NATIONAL", "DEPARTMENT", "COMMUNE"].includes(user.scope.level)) throw new DomainError("Seule la tutelle (commune, département ou ministère) décide du statut d'un établissement.");
    const school = await db.school.findFirst({ where: { AND: [{ id }, schoolWhere(user)] }, select: { id: true, name: true, status: true } });
    if (!school) throw new DomainError("Établissement introuvable dans votre périmètre.");
    if (school.status === status) return `${school.name} est déjà « ${SCHOOL_STATUS_LABELS[status].toLowerCase()} ».`;

    // Conditional on the status read, so two agents deciding at once cannot
    // overwrite each other silently.
    const { count } = await db.school.updateMany({
      where: { id: school.id, status: school.status },
      data: { status, statusReason: status === "ACTIVE" ? null : reason, statusChangedAt: new Date(), isActive: status === "ACTIVE" },
    });
    if (!count) throw new DomainError("Le statut de cet établissement vient d'être modifié par un autre agent. Rechargez la page.");

    const verb = status === "ACTIVE" ? "Réactivation" : status === "SUSPENDED" ? "Suspension" : "Fermeture";
    await audit(user, {
      action: status === "ACTIVE" ? "activate" : "deactivate",
      resource: "school",
      resourceId: school.id,
      schoolId: school.id,
      summary: `${verb} de l'établissement ${school.name} : ${reason}`,
      metadata: { from: school.status, to: status, reason },
    });
    const staff = await db.user.findMany({ where: { isActive: true, schoolId: school.id, scopeLevel: "SCHOOL" }, select: { id: true }, take: 500 });
    await notify(
      staff.map((u) => u.id),
      {
        kind: "request",
        title: status === "ACTIVE" ? "Établissement réactivé" : status === "SUSPENDED" ? "Établissement suspendu" : "Établissement fermé",
        body: status === "ACTIVE" ? `${school.name} peut de nouveau modifier ses données. ${reason}` : `${school.name} ne peut plus modifier ses données. Motif : ${reason}`,
        link: `/espace/etablissements/${school.id}`,
      },
    );
    invalidate(tags.schools, tags.school(school.id), tags.stats, tags.territory);
    return status === "ACTIVE" ? `${school.name} est réactivé.` : `${school.name} est ${status === "SUSPENDED" ? "suspendu" : "fermé"}. Son personnel est prévenu.`;
  },
});
