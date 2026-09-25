"use server";

import { z } from "zod";

import { createAction } from "@/lib/action";
import { audit } from "@/lib/audit";
import { schoolWhere } from "@/lib/auth/scope";
import { invalidate, tags } from "@/lib/cache";
import { db } from "@/lib/db";
import { DomainError } from "@/lib/errors";
import { notify } from "@/lib/notify";

import { REQUEST_TYPE_LABELS, REQUEST_TYPES } from "./labels";

export const createRequest = createAction({
  permission: "request:create",
  schema: z.object({
    type: z.enum(REQUEST_TYPES, "Choisissez un type de demande."),
    subject: z.string().trim().min(5, "L'objet doit compter au moins 5 caractères.").max(150, "150 caractères maximum."),
    body: z.string().trim().min(20, "Détaillez votre demande (20 caractères minimum).").max(4000, "4 000 caractères maximum."),
  }),
  handler: async (input, user) => {
    // A request is filed by a school, for that school only: the school comes
    // from the session, never from the form.
    const schoolId = user.scope.level === "SCHOOL" ? user.scope.schoolId : null;
    if (!schoolId) throw new DomainError("Seul un établissement peut déposer une demande.");
    const school = await db.school.findFirst({ where: { AND: [{ id: schoolId }, schoolWhere(user)] }, select: { id: true, name: true, communeId: true } });
    if (!school) throw new DomainError("Établissement introuvable.");

    const request = await db.schoolRequest.create({ data: { ...input, schoolId: school.id, authorId: user.id }, select: { id: true } });
    await audit(user, {
      action: "create",
      resource: "request",
      resourceId: request.id,
      schoolId: school.id,
      summary: `Demande « ${input.subject} » (${REQUEST_TYPE_LABELS[input.type]})`,
    });

    // The communal inspectors of the school's commune are the first to decide.
    const inspectors = await db.user.findMany({
      where: { isActive: true, scopeLevel: "COMMUNE", communeId: school.communeId, role: { permissions: { some: { permission: { code: "request:approve" } } } } },
      select: { id: true },
    });
    await notify(
      inspectors.map((u) => u.id),
      { kind: "request", title: "Nouvelle demande d'établissement", body: `${school.name} : ${input.subject}`, link: `/espace/demandes/${request.id}` },
    );
    invalidate(tags.stats);
    return { message: "Demande transmise. Vous serez notifié de la décision.", data: { id: request.id } };
  },
});

export const decideRequest = createAction({
  permission: "request:approve",
  schema: z.object({
    id: z.string().min(1).max(64),
    decision: z.enum(["APPROVED", "REJECTED"], "Choisissez une décision."),
    note: z.string().trim().min(5, "Motivez la décision (5 caractères minimum).").max(2000, "2 000 caractères maximum."),
  }),
  handler: async ({ id, decision, note }, user) => {
    // The ministry chain decides, not the school itself.
    if (!["NATIONAL", "DEPARTMENT", "COMMUNE"].includes(user.scope.level)) throw new DomainError("Seule la tutelle peut statuer sur une demande.");
    const request = await db.schoolRequest.findFirst({
      where: { AND: [{ id }, { school: schoolWhere(user) }] },
      select: { id: true, status: true, subject: true, authorId: true, schoolId: true },
    });
    if (!request) throw new DomainError("Demande introuvable dans votre périmètre.");
    if (request.status !== "PENDING") throw new DomainError("Cette demande a déjà été traitée.");

    // Conditional update: if two agents decide at the same time, only the
    // first one wins.
    const { count } = await db.schoolRequest.updateMany({
      where: { id: request.id, status: "PENDING" },
      data: { status: decision, decisionNote: note, deciderId: user.id, decidedAt: new Date() },
    });
    if (!count) throw new DomainError("Cette demande vient d'être traitée par un autre agent.");

    const verdict = decision === "APPROVED" ? "accordée" : "refusée";
    await audit(user, {
      action: "approve",
      resource: "request",
      resourceId: request.id,
      schoolId: request.schoolId,
      summary: `Demande « ${request.subject} » ${verdict}`,
      metadata: { decision },
    });
    await notify([request.authorId], {
      kind: "request",
      title: `Demande ${verdict}`,
      body: `« ${request.subject} » : ${note.slice(0, 180)}`,
      link: `/espace/demandes/${request.id}`,
    });
    invalidate(tags.stats);
    return `Demande ${verdict}. L'établissement est notifié.`;
  },
});
