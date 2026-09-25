"use server";

import { randomUUID } from "node:crypto";

import type { Prisma } from "@/generated/prisma/client";
import { createAction } from "@/lib/action";
import { audit } from "@/lib/audit";
import { invalidate, tags } from "@/lib/cache";
import { db } from "@/lib/db";
import { formatReference, installmentStatus, invoiceStatus, planPercentError, splitByPlan } from "@/lib/domain/payments";
import { DomainError } from "@/lib/errors";
import { formatFcfa } from "@/lib/utils";

import { activeYear, feeTypeWhere, requireSchoolId, startOfToday } from "./access";
import { feeTypeSchema, generateSchema, idSchema, planSchema, updateFeeTypeSchema } from "./schema";

async function assertLevel(levelId: string | undefined) {
  if (!levelId) return;
  const found = await db.academicLevel.count({ where: { id: levelId } });
  if (!found) throw new DomainError("Ce niveau n'existe pas.");
}

// ---------------------------------------------------------------------------
// Fee types
// ---------------------------------------------------------------------------

export const createFeeType = createAction({
  permission: "fee:create",
  schema: feeTypeSchema,
  handler: async (input, user) => {
    const schoolId = requireSchoolId(user);
    const year = await activeYear();
    if (!year) throw new DomainError("Aucune année scolaire active.");
    await assertLevel(input.levelId);
    const feeType = await db.feeType.create({
      data: { schoolId, academicYearId: year.id, name: input.name, amount: input.amount, levelId: input.levelId ?? null, isActive: true },
    });
    await audit(user, {
      action: "create",
      resource: "fee",
      resourceId: feeType.id,
      summary: `Type de frais créé : ${feeType.name} (${formatFcfa(feeType.amount)})`,
      schoolId,
    });
    return `Type de frais « ${feeType.name} » créé.`;
  },
});

export const updateFeeType = createAction({
  permission: "fee:update",
  schema: updateFeeTypeSchema,
  handler: async (input, user) => {
    const current = await db.feeType.findFirst({ where: { AND: [{ id: input.id }, feeTypeWhere(user)] } });
    if (!current) throw new DomainError("Type de frais introuvable.");
    await assertLevel(input.levelId);
    const feeType = await db.feeType.update({
      where: { id: current.id },
      data: { name: input.name, amount: input.amount, levelId: input.levelId ?? null, isActive: input.isActive },
    });
    await audit(user, {
      action: "update",
      resource: "fee",
      resourceId: feeType.id,
      summary: `Type de frais modifié : ${feeType.name}`,
      metadata: { before: { name: current.name, amount: current.amount, levelId: current.levelId, isActive: current.isActive } },
      schoolId: feeType.schoolId,
    });
    return `Type de frais « ${feeType.name} » enregistré. Les factures déjà émises ne changent pas.`;
  },
});

export const deleteFeeType = createAction({
  permission: "fee:delete",
  schema: idSchema,
  handler: async (input, user) => {
    const feeType = await db.feeType.findFirst({
      where: { AND: [{ id: input.id }, feeTypeWhere(user)] },
      include: { _count: { select: { items: true } } },
    });
    if (!feeType) throw new DomainError("Type de frais introuvable.");
    if (feeType._count.items > 0)
      throw new DomainError(`Impossible de supprimer « ${feeType.name} » : il figure déjà sur ${feeType._count.items} facture(s). Désactivez-le plutôt.`);
    await db.$transaction([db.paymentPlan.deleteMany({ where: { feeTypeId: feeType.id } }), db.feeType.delete({ where: { id: feeType.id } })]);
    await audit(user, { action: "delete", resource: "fee", resourceId: feeType.id, summary: `Type de frais supprimé : ${feeType.name}`, schoolId: feeType.schoolId });
    return `Type de frais « ${feeType.name} » supprimé.`;
  },
});

// ---------------------------------------------------------------------------
// Payment plans
// ---------------------------------------------------------------------------

export const savePlan = createAction({
  permission: "fee:update",
  schema: planSchema,
  handler: async (input, user) => {
    const feeType = await db.feeType.findFirst({ where: { AND: [{ id: input.feeTypeId }, feeTypeWhere(user)] } });
    if (!feeType) throw new DomainError("Type de frais introuvable.");
    const error = planPercentError(input.percent);
    if (error) throw new DomainError(error);
    for (let i = 1; i < input.dueDate.length; i++)
      if (input.dueDate[i]! < input.dueDate[i - 1]!) throw new DomainError("Les échéances doivent se suivre dans l'ordre chronologique.");

    const installments = input.label.map((label, i) => ({
      label,
      order: i + 1,
      percent: input.percent[i]!,
      dueDate: new Date(`${input.dueDate[i]}T00:00:00Z`),
    }));

    const plan = await db.$transaction(async (tx) => {
      if (input.planId) {
        const existing = await tx.paymentPlan.findFirst({ where: { id: input.planId, feeTypeId: feeType.id } });
        if (!existing) throw new DomainError("Échéancier introuvable.");
        await tx.paymentPlanInstallment.deleteMany({ where: { planId: existing.id } });
        return tx.paymentPlan.update({ where: { id: existing.id }, data: { name: input.name, installments: { create: installments } } });
      }
      // One active plan per fee type: the new one replaces the previous.
      await tx.paymentPlan.updateMany({ where: { feeTypeId: feeType.id, isActive: true }, data: { isActive: false } });
      return tx.paymentPlan.create({
        data: {
          schoolId: feeType.schoolId,
          academicYearId: feeType.academicYearId,
          feeTypeId: feeType.id,
          name: input.name,
          isActive: true,
          installments: { create: installments },
        },
      });
    });
    await audit(user, {
      action: input.planId ? "update" : "create",
      resource: "fee",
      resourceId: plan.id,
      summary: `Échéancier « ${plan.name} » enregistré pour ${feeType.name} (${installments.map((i) => `${i.percent} %`).join(", ")})`,
      schoolId: feeType.schoolId,
    });
    return `Échéancier « ${plan.name} » enregistré.`;
  },
});

export const deletePlan = createAction({
  permission: "fee:update",
  schema: idSchema,
  handler: async (input, user) => {
    const plan = await db.paymentPlan.findFirst({ where: { id: input.id, feeType: feeTypeWhere(user) } });
    if (!plan) throw new DomainError("Échéancier introuvable.");
    await db.paymentPlan.delete({ where: { id: plan.id } });
    await audit(user, { action: "delete", resource: "fee", resourceId: plan.id, summary: `Échéancier supprimé : ${plan.name}`, schoolId: plan.schoolId });
    return "Échéancier supprimé. Les factures déjà émises gardent leurs tranches.";
  },
});

// ---------------------------------------------------------------------------
// Invoice generation
// ---------------------------------------------------------------------------

const INVOICE_LOCK = "classeo:invoice-number";

export const generateInvoices = createAction({
  permission: "fee:create",
  schema: generateSchema,
  handler: async (input, user) => {
    const feeType = await db.feeType.findFirst({
      where: { AND: [{ id: input.feeTypeId }, feeTypeWhere(user)] },
      include: { plans: { where: { isActive: true }, include: { installments: { orderBy: { order: "asc" } } }, take: 1 } },
    });
    if (!feeType) throw new DomainError("Type de frais introuvable.");
    if (!feeType.isActive) throw new DomainError("Ce type de frais est désactivé.");

    const today = startOfToday();
    const plan = feeType.plans[0];
    let schedule: { label: string; order: number; amount: number; dueDate: Date }[];
    if (plan && plan.installments.length) {
      const shares = splitByPlan(feeType.amount, plan.installments.map((i) => i.percent));
      schedule = plan.installments.map((i, k) => ({ label: i.label, order: i.order, amount: shares[k]!, dueDate: i.dueDate }));
    } else {
      if (!input.dueDate) throw new DomainError("Sans échéancier, choisissez la date limite de paiement.");
      const due = new Date(`${input.dueDate}T00:00:00Z`);
      if (due < today) throw new DomainError("La date limite ne peut pas être dans le passé.");
      schedule = [{ label: "Paiement unique", order: 1, amount: feeType.amount, dueDate: due }];
    }
    const dueDate = schedule.reduce((max, s) => (s.dueDate > max ? s.dueDate : max), schedule[0]!.dueDate);
    const year = today.getUTCFullYear();
    const prefix = `FAC-${year}-`;

    const created = await db.$transaction(
      async (tx) => {
        // Serialises numbering across concurrent generations and payments.
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${INVOICE_LOCK}))`;

        const enrollments = await tx.enrollment.findMany({
          where: {
            schoolId: feeType.schoolId,
            academicYearId: feeType.academicYearId,
            status: "ACTIVE",
            ...(feeType.levelId ? { classroom: { levelId: feeType.levelId } } : {}),
            invoices: { none: { status: { not: "CANCELLED" }, items: { some: { feeTypeId: feeType.id } } } },
          },
          orderBy: [{ classroom: { name: "asc" } }, { student: { lastName: "asc" } }, { student: { firstName: "asc" } }],
          select: { id: true },
        });
        if (!enrollments.length) return 0;

        const [{ max }] = await tx.$queryRaw<{ max: number }[]>`
          SELECT COALESCE(MAX(CAST(split_part("number", '-', 3) AS INTEGER)), 0)::int AS max
          FROM "Invoice" WHERE "number" LIKE ${prefix + "%"}`;

        const invoices: Prisma.InvoiceCreateManyInput[] = [];
        const items: Prisma.InvoiceItemCreateManyInput[] = [];
        const installments: Prisma.InvoiceInstallmentCreateManyInput[] = [];
        enrollments.forEach((e, i) => {
          const id = randomUUID();
          invoices.push({
            id,
            number: formatReference("FAC", year, max + i + 1, 4),
            schoolId: feeType.schoolId,
            enrollmentId: e.id,
            totalAmount: feeType.amount,
            paidAmount: 0,
            status: invoiceStatus({ totalAmount: feeType.amount, paidAmount: 0, dueDate, installments: schedule.map((s) => ({ ...s, paidAmount: 0 })), today }),
            issueDate: today,
            dueDate,
          });
          items.push({ invoiceId: id, feeTypeId: feeType.id, description: feeType.name, quantity: 1, unitPrice: feeType.amount });
          for (const s of schedule)
            installments.push({ invoiceId: id, label: s.label, order: s.order, amount: s.amount, paidAmount: 0, dueDate: s.dueDate, status: installmentStatus(s.amount, 0, s.dueDate, today) });
        });
        await tx.invoice.createMany({ data: invoices });
        await tx.invoiceItem.createMany({ data: items });
        await tx.invoiceInstallment.createMany({ data: installments });
        return invoices.length;
      },
      { timeout: 60_000, maxWait: 10_000 },
    );

    if (created === 0) throw new DomainError("Aucune facture à créer : tous les élèves concernés sont déjà facturés.");
    await audit(user, {
      action: "create",
      resource: "fee",
      resourceId: feeType.id,
      summary: `${created} facture(s) générée(s) pour ${feeType.name}, total ${formatFcfa(created * feeType.amount)}`,
      schoolId: feeType.schoolId,
    });
    invalidate(tags.stats);
    return { message: `${created} facture(s) créée(s) pour « ${feeType.name} ».`, data: { created } };
  },
});
