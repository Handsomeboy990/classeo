import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import type { CurrentUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { PAYMENT_METHODS, type PaymentMethodCode } from "@/lib/domain/payments";

import { activeYear, paymentWhere } from "@/features/fees/access";

type User = NonNullable<CurrentUser>;

export type PaymentFilters = { q: string; method?: string; skip: number; take: number };

export async function paymentListWhere(user: User, f: Pick<PaymentFilters, "q" | "method">): Promise<Prisma.PaymentWhereInput> {
  const year = await activeYear();
  const terms = f.q.split(/\s+/).filter(Boolean).slice(0, 4);
  const method = PAYMENT_METHODS.includes(f.method as PaymentMethodCode) ? (f.method as PaymentMethodCode) : undefined;
  return {
    AND: [
      paymentWhere(user),
      year ? { invoice: { enrollment: { academicYearId: year.id } } } : {},
      method ? { method } : {},
      ...terms.map((t) => ({
        OR: [
          { reference: { contains: t, mode: "insensitive" as const } },
          { transactionId: { contains: t, mode: "insensitive" as const } },
          { invoice: { number: { contains: t, mode: "insensitive" as const } } },
          { invoice: { enrollment: { student: { firstName: { contains: t, mode: "insensitive" as const } } } } },
          { invoice: { enrollment: { student: { lastName: { contains: t, mode: "insensitive" as const } } } } },
        ],
      })),
    ],
  };
}

const paymentSelect = {
  id: true,
  reference: true,
  amount: true,
  method: true,
  transactionId: true,
  paidAt: true,
  recordedBy: { select: { firstName: true, lastName: true } },
  invoice: {
    select: {
      id: true,
      number: true,
      enrollment: { select: { student: { select: { firstName: true, lastName: true, matricule: true } }, classroom: { select: { name: true } } } },
    },
  },
} satisfies Prisma.PaymentSelect;

export async function listPayments(user: User, f: PaymentFilters) {
  const where = await paymentListWhere(user, f);
  const [rows, total, sum] = await Promise.all([
    db.payment.findMany({ where, select: paymentSelect, orderBy: [{ paidAt: "desc" }, { reference: "desc" }], skip: f.skip, take: f.take }),
    db.payment.count({ where }),
    db.payment.aggregate({ where, _sum: { amount: true } }),
  ]);
  return { rows, total, sum: sum._sum.amount ?? 0 };
}

export async function exportPayments(user: User, f: Pick<PaymentFilters, "q" | "method">) {
  const where = await paymentListWhere(user, f);
  return db.payment.findMany({ where, select: paymentSelect, orderBy: [{ paidAt: "asc" }, { reference: "asc" }], take: 20000 });
}

export async function getReceipt(user: User, id: string) {
  return db.payment.findFirst({
    where: { AND: [{ id }, paymentWhere(user)] },
    include: {
      recordedBy: { select: { firstName: true, lastName: true } },
      invoice: {
        select: {
          id: true,
          number: true,
          totalAmount: true,
          paidAmount: true,
          school: { select: { name: true, address: true, phone: true, email: true } },
          items: { select: { description: true, quantity: true, unitPrice: true } },
          enrollment: {
            select: {
              student: { select: { firstName: true, lastName: true, matricule: true } },
              classroom: { select: { name: true } },
              academicYear: { select: { label: true } },
            },
          },
        },
      },
    },
  });
}
