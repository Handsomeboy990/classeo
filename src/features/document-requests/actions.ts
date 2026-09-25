"use server";

import { z } from "zod";

import { createAction } from "@/lib/action";
import { audit } from "@/lib/audit";
import { schoolWhere } from "@/lib/auth/scope";
import type { CurrentUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { DomainError } from "@/lib/errors";
import { saveUpload } from "@/lib/files";
import { notify } from "@/lib/notify";
import { formatDate } from "@/lib/utils";

import { endOfBeninDay, ISO_DATE, isoToUtc } from "../calendar/rules";
import { MAX_DOCUMENT_BYTES, MAX_FILES_PER_REQUEST, schoolCanAnswer } from "./labels";
import { docWhere } from "./queries";

type User = NonNullable<CurrentUser>;

const id = z.string().trim().min(1).max(64);
const AUTHORITY = ["NATIONAL", "DEPARTMENT", "COMMUNE"];

async function staffToAlert(schoolIds: string[]) {
  const users = await db.user.findMany({
    where: { isActive: true, scopeLevel: "SCHOOL", schoolId: { in: schoolIds }, role: { permissions: { some: { permission: { code: "document_request:update" } } } } },
    select: { id: true },
    take: 2000,
  });
  return users.map((u) => u.id);
}

// The school side: the request must belong to the user's own school.
async function ownRequest(user: User, requestId: string) {
  if (user.scope.level !== "SCHOOL") throw new DomainError("Seul l'établissement concerné répond à cette demande.");
  const request = await db.documentRequest.findFirst({
    where: { AND: [{ id: requestId }, docWhere(user), { schoolId: user.scope.schoolId ?? "__none__" }] },
    select: { id: true, title: true, status: true, schoolId: true, requestedById: true, _count: { select: { files: true } } },
  });
  if (!request) throw new DomainError("Demande introuvable pour votre établissement.");
  return request;
}

export const createDocRequests = createAction({
  permission: "document_request:create",
  schema: z.object({
    title: z.string().trim().min(5, "Le titre compte au moins 5 caractères.").max(150, "150 caractères au maximum."),
    description: z.string().trim().min(10, "Précisez les pièces attendues (10 caractères minimum).").max(2000, "2 000 caractères au maximum."),
    dueDate: z
      .string()
      .trim()
      .optional()
      .transform((v) => v || null)
      .refine((v) => v === null || ISO_DATE.test(v), "Date invalide."),
    schoolIds: z
      .union([z.array(id), id])
      .optional()
      .transform((v) => (v === undefined ? [] : Array.isArray(v) ? v : [v]))
      .pipe(z.array(id).min(1, "Choisissez au moins un établissement.").max(500, "500 établissements au maximum par envoi.")),
  }),
  handler: async (input, user) => {
    if (!AUTHORITY.includes(user.scope.level)) throw new DomainError("Seule la tutelle (commune, département ou ministère) demande des pièces.");
    if (input.dueDate && endOfBeninDay(input.dueDate) < new Date()) throw new DomainError("La date limite doit être aujourd'hui ou plus tard.");
    const ids = [...new Set(input.schoolIds)];
    const schools = await db.school.findMany({ where: { AND: [{ id: { in: ids } }, schoolWhere(user)] }, select: { id: true, name: true } });
    if (schools.length !== ids.length) throw new DomainError("Un établissement choisi est hors de votre périmètre.");
    const dueDate = input.dueDate ? isoToUtc(input.dueDate) : null;
    await db.documentRequest.createMany({
      data: schools.map((s) => ({ schoolId: s.id, title: input.title, description: input.description, dueDate, requestedById: user.id })),
    });
    await audit(user, {
      action: "create",
      resource: "document_request",
      summary: `Pièces demandées « ${input.title} » à ${schools.length === 1 ? schools[0]!.name : `${schools.length} établissements`}`,
      metadata: { schoolIds: ids, dueDate: input.dueDate },
      schoolId: schools.length === 1 ? schools[0]!.id : null,
    });
    await notify(await staffToAlert(schools.map((s) => s.id)), {
      kind: "request",
      title: "Pièces demandées par la tutelle",
      body: `${input.title}${dueDate ? `, à fournir avant le ${formatDate(dueDate)}` : ""}.`,
      link: "/espace/pieces-demandees?statut=PENDING",
    });
    return `Demande envoyée à ${schools.length === 1 ? schools[0]!.name : `${schools.length} établissements`}.`;
  },
});

// Documents answer the ministry chain, including for a suspended school
// (an inquiry often needs them): assertWritable is not applied here.
export const uploadDocFile = createAction({
  permission: "document_request:update",
  schema: z.object({
    requestId: id,
    file: z.instanceof(File, { message: "Choisissez un fichier." }).refine((f) => f.size > 0, "Choisissez un fichier.").refine((f) => f.size <= MAX_DOCUMENT_BYTES, "Fichier trop lourd : 950 Ko au maximum."),
  }),
  handler: async ({ requestId, file }, user) => {
    const request = await ownRequest(user, requestId);
    if (!schoolCanAnswer(request.status)) throw new DomainError("Cette demande n'attend plus de pièce.");
    if (request._count.files >= MAX_FILES_PER_REQUEST) throw new DomainError(`${MAX_FILES_PER_REQUEST} fichiers au maximum par demande.`);
    const fileId = await saveUpload(user, "document", file);
    await db.documentRequestFile.create({ data: { requestId: request.id, fileId, uploadedById: user.id } });
    await audit(user, { action: "create", resource: "document_request", resourceId: request.id, schoolId: request.schoolId, summary: `Pièce ajoutée à « ${request.title} » : ${file.name.slice(0, 80)}` });
    return "Fichier ajouté. Transmettez la demande quand toutes les pièces y sont.";
  },
});

export const removeDocFile = createAction({
  permission: "document_request:update",
  schema: z.object({ requestId: id, fileId: id }),
  handler: async ({ requestId, fileId }, user) => {
    const request = await ownRequest(user, requestId);
    if (!schoolCanAnswer(request.status)) throw new DomainError("Les pièces transmises ne se retirent plus.");
    const link = await db.documentRequestFile.findFirst({ where: { requestId: request.id, fileId }, select: { id: true, file: { select: { fileName: true } } } });
    if (!link) throw new DomainError("Fichier introuvable dans cette demande.");
    // Deleting the blob removes the link through its cascade.
    await db.fileBlob.delete({ where: { id: fileId } });
    await audit(user, { action: "delete", resource: "document_request", resourceId: request.id, schoolId: request.schoolId, summary: `Pièce retirée de « ${request.title} » : ${link.file.fileName}` });
    return "Fichier retiré.";
  },
});

export const submitDocRequest = createAction({
  permission: "document_request:update",
  schema: z.object({ requestId: id }),
  handler: async ({ requestId }, user) => {
    const request = await ownRequest(user, requestId);
    if (!schoolCanAnswer(request.status)) throw new DomainError("Cette demande a déjà été transmise.");
    if (!request._count.files) throw new DomainError("Ajoutez au moins un fichier avant de transmettre.");
    const { count } = await db.documentRequest.updateMany({ where: { id: request.id, status: request.status }, data: { status: "SUBMITTED" } });
    if (!count) throw new DomainError("Cette demande vient d'être modifiée. Rechargez la page.");
    await audit(user, { action: "update", resource: "document_request", resourceId: request.id, schoolId: request.schoolId, summary: `Pièces transmises pour « ${request.title} » (${request._count.files} fichier${request._count.files > 1 ? "s" : ""})` });
    const school = await db.school.findUnique({ where: { id: request.schoolId }, select: { name: true } });
    await notify([request.requestedById], { kind: "request", title: "Pièces reçues", body: `${school?.name ?? "Un établissement"} a transmis « ${request.title} ».`, link: `/espace/pieces-demandees/${request.id}` });
    return "Pièces transmises. Vous serez prévenu de la réponse.";
  },
});

export const reviewDocRequest = createAction({
  permission: "document_request:approve",
  schema: z
    .object({
      requestId: id,
      decision: z.enum(["ACCEPTED", "REJECTED"], "Choisissez une décision."),
      note: z
        .string()
        .trim()
        .max(1000, "1 000 caractères au maximum.")
        .optional()
        .transform((v) => v || null),
    })
    .superRefine((v, ctx) => {
      if (v.decision === "REJECTED" && (!v.note || v.note.length < 5)) ctx.addIssue({ code: "custom", path: ["note"], message: "Dites à l'établissement ce qu'il doit compléter (5 caractères minimum)." });
    }),
  handler: async ({ requestId, decision, note }, user) => {
    if (!AUTHORITY.includes(user.scope.level)) throw new DomainError("Seule la tutelle examine les pièces.");
    const request = await db.documentRequest.findFirst({ where: { AND: [{ id: requestId }, docWhere(user)] }, select: { id: true, title: true, status: true, schoolId: true, requestedById: true } });
    if (!request) throw new DomainError("Demande introuvable dans votre périmètre.");
    // The agent who asked examines the answer; the ministry may always.
    if (request.requestedById !== user.id && user.scope.level !== "NATIONAL") throw new DomainError("Seul l'auteur de la demande, ou le ministère, examine ces pièces.");
    if (request.status !== "SUBMITTED") throw new DomainError("Ces pièces n'attendent pas d'examen.");
    const { count } = await db.documentRequest.updateMany({
      where: { id: request.id, status: "SUBMITTED" },
      data: { status: decision, responseNote: note, reviewedById: user.id, reviewedAt: new Date() },
    });
    if (!count) throw new DomainError("Ces pièces viennent d'être examinées par un autre agent.");
    const accepted = decision === "ACCEPTED";
    await audit(user, { action: "approve", resource: "document_request", resourceId: request.id, schoolId: request.schoolId, summary: `Pièces « ${request.title} » ${accepted ? "acceptées" : "renvoyées à l'établissement"}`, metadata: { decision } });
    await notify(await staffToAlert([request.schoolId]), {
      kind: "request",
      title: accepted ? "Pièces acceptées" : "Pièces à compléter",
      body: accepted ? `« ${request.title} » est acceptée.${note ? ` ${note}` : ""}` : `« ${request.title} » : ${note}`,
      link: `/espace/pieces-demandees/${request.id}`,
    });
    return accepted ? "Pièces acceptées. L'établissement est prévenu." : "Demande renvoyée à l'établissement avec votre note.";
  },
});
