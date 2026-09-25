"use server";

import { z } from "zod";

import { createAction } from "@/lib/action";
import { audit } from "@/lib/audit";
import { ForbiddenError } from "@/lib/auth/authorize";
import { db } from "@/lib/db";
import { DomainError } from "@/lib/errors";
import { assertWritable } from "@/lib/guards";

import { canRevoke } from "./queries";

const revokeSchema = z.object({
  id: z.string().trim().min(1).max(40),
  reason: z.string().trim().min(5, "Indiquez le motif en quelques mots.").max(300, "300 caractères au maximum."),
});

// Revoking a document marks it invalid on the public page (a report card
// corrected after printing, a receipt of a cancelled payment, a copy
// reported lost). A signed document loses its signature too: the next copy
// is printed unsigned until the head signs again.
export const revokeDocument = createAction({
  permission: null,
  schema: revokeSchema,
  handler: async (input, user) => {
    const doc = await db.issuedDocument.findUnique({ where: { id: input.id }, select: { id: true, reference: true, kind: true, title: true, schoolId: true, signatureId: true, revokedAt: true } });
    if (!doc) throw new DomainError("Document introuvable.");
    if (!(await canRevoke(user, doc))) throw new ForbiddenError("Vous ne pouvez pas révoquer ce document.");
    if (doc.revokedAt) throw new DomainError("Ce document est déjà révoqué.");
    await assertWritable({ schoolId: doc.schoolId });
    const now = new Date();
    await db.$transaction([
      db.issuedDocument.update({ where: { id: doc.id }, data: { revokedAt: now, revokedReason: input.reason } }),
      ...(doc.signatureId ? [db.documentSignature.update({ where: { id: doc.signatureId }, data: { revokedAt: now } })] : []),
    ]);
    await audit(user, {
      action: "revoke",
      resource: "document",
      resourceId: doc.id,
      summary: `Document ${doc.reference} (${doc.title}) révoqué : ${input.reason}`,
      metadata: { reference: doc.reference, kind: doc.kind, signed: !!doc.signatureId },
      schoolId: doc.schoolId,
    });
    return `Document ${doc.reference} révoqué. La page de vérification l'indique désormais.`;
  },
});
