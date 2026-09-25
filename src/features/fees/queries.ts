import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { classroomWhere, scopeKey } from "@/lib/auth/scope";
import type { CurrentUser } from "@/lib/auth/session";
import { cached, tags } from "@/lib/cache";
import { db } from "@/lib/db";
import { invoiceStatus, splitByPlan, type InvoiceStatusCode } from "@/lib/domain/payments";

import { activeYear, feeTypeWhere, invoiceWhere, paymentWhere, startOfToday } from "./access";

type User = NonNullable<CurrentUser>;

// ---------------------------------------------------------------------------
// Overview
// ---------------------------------------------------------------------------

export type FeesOverview = {
  expected: number;
  collected: number;
  remaining: number;
  rate: number | null;
  invoiceCount: number;
  paidCount: number;
  overdueCount: number;
  byClass: { id: string; name: string; expected: number; collected: number; rate: number }[];
};

async function computeOverview(user: User, yearId: string, todayIso: string): Promise<FeesOverview> {
  const today = new Date(todayIso);
  const rows = await db.invoice.findMany({
    where: { AND: [invoiceWhere(user), { status: { not: "CANCELLED" } }, { enrollment: { academicYearId: yearId } }] },
    select: {
      totalAmount: true,
      paidAmount: true,
      dueDate: true,
      installments: { select: { amount: true, paidAmount: true, dueDate: true } },
      enrollment: { select: { classroom: { select: { id: true, name: true, level: { select: { order: true } } } } } },
    },
  });
  let expected = 0;
  let collected = 0;
  let paidCount = 0;
  let overdueCount = 0;
  const classes = new Map<string, { id: string; name: string; order: number; expected: number; collected: number }>();
  for (const r of rows) {
    expected += r.totalAmount;
    collected += r.paidAmount;
    const status = invoiceStatus({ ...r, today });
    if (status === "PAID") paidCount++;
    if (status === "OVERDUE") overdueCount++;
    const c = r.enrollment.classroom;
    const entry = classes.get(c.id) ?? { id: c.id, name: c.name, order: c.level.order, expected: 0, collected: 0 };
    entry.expected += r.totalAmount;
    entry.collected += r.paidAmount;
    classes.set(c.id, entry);
  }
  return {
    expected,
    collected,
    remaining: Math.max(0, expected - collected),
    rate: expected > 0 ? collected / expected : null,
    invoiceCount: rows.length,
    paidCount,
    overdueCount,
    byClass: [...classes.values()]
      .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name, "fr"))
      .map(({ id, name, expected, collected }) => ({ id, name, expected, collected, rate: expected > 0 ? collected / expected : 0 })),
  };
}

// Cached per territorial scope and per day, invalidated by every payment and
// invoice generation (tag stats).
export async function getFeesOverview(user: User) {
  const year = await activeYear();
  if (!year) return { year: null, overview: null };
  const todayIso = startOfToday().toISOString();
  const overview = await cached(() => computeOverview(user, year.id, todayIso), ["fees-overview", scopeKey(user), year.id, todayIso], {
    tags: [tags.stats],
  })();
  return { year, overview };
}

export async function getRecentPayments(user: User, take = 8) {
  return db.payment.findMany({
    where: paymentWhere(user),
    orderBy: [{ paidAt: "desc" }, { createdAt: "desc" }],
    take,
    select: {
      id: true,
      reference: true,
      amount: true,
      method: true,
      paidAt: true,
      invoice: {
        select: {
          id: true,
          number: true,
          enrollment: { select: { student: { select: { firstName: true, lastName: true } }, classroom: { select: { name: true } } } },
        },
      },
    },
  });
}

// ---------------------------------------------------------------------------
// Fee types and payment plans
// ---------------------------------------------------------------------------

export async function getFeeTypes(user: User) {
  const year = await activeYear();
  if (!year) return { year: null, feeTypes: [], levels: [] };
  const [feeTypes, levels] = await Promise.all([
    db.feeType.findMany({
      where: { AND: [feeTypeWhere(user), { academicYearId: year.id }] },
      orderBy: [{ isActive: "desc" }, { name: "asc" }],
      include: {
        level: { select: { id: true, name: true } },
        school: { select: { name: true } },
        plans: { where: { isActive: true }, include: { installments: { orderBy: { order: "asc" } } }, take: 1 },
        _count: { select: { items: true } },
      },
    }),
    // Levels actually taught in the user's school this year.
    db.academicLevel.findMany({
      where: { classrooms: { some: { AND: [classroomWhere(user), { academicYearId: year.id }] } } },
      orderBy: { order: "asc" },
      select: { id: true, name: true },
    }),
  ]);
  return { year, feeTypes, levels };
}

export type FeeTypeRow = Awaited<ReturnType<typeof getFeeTypes>>["feeTypes"][number];

// Dry run of the invoice generation: who would be billed, who already is.
export async function getGenerationPreview(user: User, feeTypeId: string) {
  const feeType = await db.feeType.findFirst({
    where: { AND: [{ id: feeTypeId }, feeTypeWhere(user)] },
    include: {
      level: { select: { name: true } },
      academicYear: { select: { label: true } },
      plans: { where: { isActive: true }, include: { installments: { orderBy: { order: "asc" } } }, take: 1 },
    },
  });
  if (!feeType) return null;

  const enrollments = await db.enrollment.findMany({
    where: {
      schoolId: feeType.schoolId,
      academicYearId: feeType.academicYearId,
      status: "ACTIVE",
      ...(feeType.levelId ? { classroom: { levelId: feeType.levelId } } : {}),
    },
    select: {
      id: true,
      invoices: { where: { status: { not: "CANCELLED" }, items: { some: { feeTypeId: feeType.id } } }, select: { id: true }, take: 1 },
      classroom: { select: { id: true, name: true, level: { select: { order: true } } } },
    },
  });

  const byClass = new Map<string, { id: string; name: string; order: number; toCreate: number; skipped: number }>();
  let toCreate = 0;
  for (const e of enrollments) {
    const c = byClass.get(e.classroom.id) ?? { id: e.classroom.id, name: e.classroom.name, order: e.classroom.level.order, toCreate: 0, skipped: 0 };
    if (e.invoices.length) c.skipped++;
    else {
      c.toCreate++;
      toCreate++;
    }
    byClass.set(c.id, c);
  }

  const plan = feeType.plans[0] ?? null;
  const shares = plan ? splitByPlan(feeType.amount, plan.installments.map((i) => i.percent)) : [feeType.amount];

  return {
    feeType,
    plan,
    schedule: plan
      ? plan.installments.map((i, k) => ({ label: i.label, percent: i.percent, dueDate: i.dueDate, amount: shares[k]! }))
      : null,
    classes: [...byClass.values()].sort((a, b) => a.order - b.order || a.name.localeCompare(b.name, "fr")),
    concerned: enrollments.length,
    toCreate,
    skipped: enrollments.length - toCreate,
    total: toCreate * feeType.amount,
  };
}

// ---------------------------------------------------------------------------
// Invoices
// ---------------------------------------------------------------------------

export type InvoiceFilters = { q: string; status?: string; classe?: string; skip: number; take: number };

function overdueCondition(today: Date): Prisma.InvoiceWhereInput {
  return {
    status: { notIn: ["PAID", "CANCELLED"] },
    installments: { some: { dueDate: { lt: today }, status: { not: "PAID" } } },
  };
}

function statusCondition(status: string | undefined, today: Date): Prisma.InvoiceWhereInput {
  switch (status) {
    case "OVERDUE":
      return { OR: [{ status: "OVERDUE" }, overdueCondition(today)] };
    case "PENDING":
    case "PARTIALLY_PAID":
      return { status, NOT: overdueCondition(today) };
    case "PAID":
    case "CANCELLED":
      return { status };
    default:
      return {};
  }
}

function searchCondition(q: string): Prisma.InvoiceWhereInput {
  const terms = q.split(/\s+/).filter(Boolean).slice(0, 4);
  if (!terms.length) return {};
  return {
    AND: terms.map((t) => ({
      OR: [
        { number: { contains: t, mode: "insensitive" as const } },
        { enrollment: { student: { firstName: { contains: t, mode: "insensitive" as const } } } },
        { enrollment: { student: { lastName: { contains: t, mode: "insensitive" as const } } } },
        { enrollment: { student: { matricule: { contains: t, mode: "insensitive" as const } } } },
      ],
    })),
  };
}

export async function invoiceListWhere(user: User, f: Pick<InvoiceFilters, "q" | "status" | "classe">): Promise<Prisma.InvoiceWhereInput> {
  const year = await activeYear();
  return {
    AND: [
      invoiceWhere(user),
      year ? { enrollment: { academicYearId: year.id } } : {},
      f.classe ? { enrollment: { classroomId: f.classe } } : {},
      statusCondition(f.status, startOfToday()),
      searchCondition(f.q),
    ],
  };
}

const invoiceListSelect = {
  id: true,
  number: true,
  totalAmount: true,
  paidAmount: true,
  status: true,
  dueDate: true,
  issueDate: true,
  installments: { select: { amount: true, paidAmount: true, dueDate: true } },
  enrollment: {
    select: {
      student: { select: { firstName: true, lastName: true, matricule: true } },
      classroom: { select: { name: true } },
    },
  },
} satisfies Prisma.InvoiceSelect;

export async function listInvoices(user: User, f: InvoiceFilters) {
  const where = await invoiceListWhere(user, f);
  const [rows, total] = await Promise.all([
    db.invoice.findMany({ where, select: invoiceListSelect, orderBy: [{ number: "desc" }], skip: f.skip, take: f.take }),
    db.invoice.count({ where }),
  ]);
  const today = startOfToday();
  return { rows: rows.map((r) => ({ ...r, effectiveStatus: effectiveStatus(r, today) })), total };
}

export async function exportInvoices(user: User, f: Pick<InvoiceFilters, "q" | "status" | "classe">) {
  const where = await invoiceListWhere(user, f);
  const rows = await db.invoice.findMany({ where, select: invoiceListSelect, orderBy: [{ number: "asc" }], take: 20000 });
  const today = startOfToday();
  return rows.map((r) => ({ ...r, effectiveStatus: effectiveStatus(r, today) }));
}

export function effectiveStatus(
  r: { status: string; totalAmount: number; paidAmount: number; dueDate: Date; installments: { amount: number; paidAmount: number; dueDate: Date }[] },
  today: Date,
): InvoiceStatusCode {
  return invoiceStatus({ ...r, cancelled: r.status === "CANCELLED", today });
}

export async function getInvoice(user: User, id: string) {
  const invoice = await db.invoice.findFirst({
    where: { AND: [{ id }, invoiceWhere(user)] },
    include: {
      school: { select: { name: true, address: true, phone: true } },
      enrollment: {
        select: {
          student: { select: { id: true, firstName: true, lastName: true, matricule: true } },
          classroom: { select: { id: true, name: true } },
          academicYear: { select: { label: true } },
        },
      },
      items: { orderBy: { description: "asc" } },
      installments: { orderBy: [{ dueDate: "asc" }, { order: "asc" }] },
      payments: {
        orderBy: [{ paidAt: "desc" }, { createdAt: "desc" }],
        include: { recordedBy: { select: { firstName: true, lastName: true } } },
      },
    },
  });
  if (!invoice) return null;
  return { ...invoice, effectiveStatus: effectiveStatus(invoice, startOfToday()) };
}

export async function getClassOptions(user: User) {
  const year = await activeYear();
  return db.classroom.findMany({
    where: { AND: [classroomWhere(user), year ? { academicYearId: year.id } : {}] },
    orderBy: [{ level: { order: "asc" } }, { name: "asc" }],
    select: { id: true, name: true },
  });
}
