import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import type { CurrentUser } from "@/lib/auth/session";
import { schoolWhere } from "@/lib/auth/scope";
import { db } from "@/lib/db";

import { activeYear, invoiceWhere } from "@/features/fees/access";

type User = NonNullable<CurrentUser>;

const accountSelect = { id: true, channel: true, provider: true, accountName: true, accountNumber: true, instructions: true, isActive: true } as const;

// The invoices a parent can pay: their children's, active year, not
// cancelled, with the school's active payment accounts.
export async function payerInvoices(user: User) {
  const year = await activeYear();
  return db.invoice.findMany({
    where: { AND: [invoiceWhere(user), { status: { not: "CANCELLED" } }, year ? { enrollment: { academicYearId: year.id } } : {}] },
    orderBy: [{ enrollment: { student: { firstName: "asc" } } }, { issueDate: "desc" }],
    select: {
      id: true,
      number: true,
      totalAmount: true,
      paidAmount: true,
      status: true,
      dueDate: true,
      enrollment: { select: { student: { select: { id: true, firstName: true, lastName: true } }, classroom: { select: { name: true } } } },
      school: { select: { name: true } },
      declarations: { where: { status: "PENDING" }, select: { id: true, amount: true } },
    },
  });
}

// One invoice to pay, through invoiceWhere(): a parent reaches only their
// children's invoices.
export async function payableInvoice(user: User, id: string) {
  if (typeof id !== "string" || id.length > 40) return null;
  return db.invoice.findFirst({
    where: { AND: [{ id }, invoiceWhere(user)] },
    select: {
      id: true,
      number: true,
      totalAmount: true,
      paidAmount: true,
      status: true,
      dueDate: true,
      schoolId: true,
      school: { select: { name: true, address: true, phone: true, paymentAccounts: { where: { isActive: true }, orderBy: [{ channel: "asc" }, { provider: "asc" }], select: accountSelect } } },
      enrollment: { select: { academicYearId: true, student: { select: { id: true, firstName: true, lastName: true } }, classroom: { select: { name: true } }, academicYear: { select: { label: true } } } },
      installments: { orderBy: { order: "asc" }, select: { id: true, order: true, label: true, amount: true, paidAmount: true, dueDate: true } },
      declarations: {
        orderBy: { createdAt: "desc" },
        select: { id: true, amount: true, method: true, transactionRef: true, status: true, note: true, createdAt: true, decidedAt: true, paymentId: true, proofFileId: true },
      },
    },
  });
}

export async function onlinePaymentsOf(user: User, invoiceId: string) {
  return db.onlinePayment.findMany({
    where: { invoiceId, payerId: user.id },
    orderBy: { createdAt: "desc" },
    take: 10,
    select: { id: true, amount: true, status: true, createdAt: true, paymentId: true },
  });
}

// The accountant's queue: declarations of the school awaiting a check,
// then the latest decided ones and the latest online payments.
const declarationSelect = {
  id: true,
  amount: true,
  method: true,
  payerPhone: true,
  transactionRef: true,
  proofFileId: true,
  status: true,
  note: true,
  createdAt: true,
  decidedAt: true,
  accountId: true,
  paymentId: true,
  invoice: {
    select: {
      id: true,
      number: true,
      totalAmount: true,
      paidAmount: true,
      enrollment: { select: { student: { select: { firstName: true, lastName: true, matricule: true } }, classroom: { select: { name: true } } } },
    },
  },
} satisfies Prisma.PaymentDeclarationSelect;

export async function declarationQueue(user: User) {
  const where = { invoice: invoiceWhere(user) };
  const [pending, decided, online, accounts] = await Promise.all([
    db.paymentDeclaration.findMany({ where: { ...where, status: "PENDING" }, orderBy: { createdAt: "asc" }, take: 100, select: declarationSelect }),
    db.paymentDeclaration.findMany({ where: { ...where, status: { not: "PENDING" } }, orderBy: { decidedAt: "desc" }, take: 20, select: declarationSelect }),
    onlinePaymentsInScope(user),
    db.schoolPaymentAccount.findMany({ where: { school: schoolWhere(user) }, select: { id: true, provider: true, accountNumber: true } }),
  ]);
  const accountName = new Map(accounts.map((a) => [a.id, `${a.provider} · ${a.accountNumber}`]));
  const decorate = <T extends { accountId: string | null }>(d: T) => ({ ...d, account: d.accountId ? (accountName.get(d.accountId) ?? null) : null });
  return { pending: pending.map(decorate), decided: decided.map(decorate), online };
}

// OnlinePayment has no relation to Invoice in the schema: the scope is
// applied through the invoices the user reaches.
async function onlinePaymentsInScope(user: User) {
  const invoices = await db.invoice.findMany({
    where: invoiceWhere(user),
    select: { id: true, number: true, enrollment: { select: { student: { select: { firstName: true, lastName: true } } } } },
  });
  const byId = new Map(invoices.map((i) => [i.id, i]));
  const rows = await db.onlinePayment.findMany({
    where: { invoiceId: { in: [...byId.keys()] } },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: { id: true, provider: true, providerRef: true, invoiceId: true, amount: true, status: true, createdAt: true, paymentId: true, lastEvent: true },
  });
  return rows.map((r) => ({ ...r, invoice: byId.get(r.invoiceId)! }));
}

export async function pendingDeclarationCount(user: User) {
  return db.paymentDeclaration.count({ where: { status: "PENDING", invoice: invoiceWhere(user) } });
}

export async function paymentAccounts(user: User) {
  return db.schoolPaymentAccount.findMany({ where: { school: schoolWhere(user) }, orderBy: [{ isActive: "desc" }, { channel: "asc" }, { provider: "asc" }], select: accountSelect });
}

// School accounts that confirm payments: they are told about declarations
// and online payments.
export async function paymentStaffIds(schoolId: string) {
  const users = await db.user.findMany({
    where: { schoolId, isActive: true, role: { permissions: { some: { permission: { code: "payment:create" } } } } },
    select: { id: true },
  });
  return users.map((u) => u.id);
}
