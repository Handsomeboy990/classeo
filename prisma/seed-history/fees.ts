// Fees of the past years at CEG Godomey. Before 2026-2027 every pupil of a
// public college paid the contribution scolaire, girls included (their
// exemption starts with 2026-2027); the parents' association dues come on
// top. Three installments, paid at the counter or by Mobile Money (more and
// more over the years); most families paid everything, some left a balance.
// EPP Godomey Centre, a public primary school, never bills anything.
import type { Prisma } from "../../src/generated/prisma/client";
import { distributePaid, invoiceStatus } from "../../src/lib/domain/payments";
import { weekDays } from "./calendar";
import type { HistoryContext } from "./index";
import { shortId } from "../seed-lib/random";

const CONTRIBUTION = 15_000;
const APE = 5_000;
const MOBILE_MONEY = [0.2, 0.3, 0.42, 0.55];
const TODAY = new Date("2026-09-25T00:00:00Z");

export async function writeFees(ctx: HistoryContext) {
  const { rng, years, stints, input } = ctx;
  const feeTypes: Prisma.FeeTypeCreateManyInput[] = [];
  const plans: Prisma.PaymentPlanCreateManyInput[] = [];
  const planSteps: Prisma.PaymentPlanInstallmentCreateManyInput[] = [];
  const invoices: Prisma.InvoiceCreateManyInput[] = [];
  const items: Prisma.InvoiceItemCreateManyInput[] = [];
  const installments: Prisma.InvoiceInstallmentCreateManyInput[] = [];
  const payments: Prisma.PaymentCreateManyInput[] = [];

  for (let y = 0; y <= 3; y++) {
    const year = years[y]!;
    const s = year.startYear;
    const due = [new Date(Date.UTC(s, 9, 9)), new Date(Date.UTC(s + 1, 0, 15)), new Date(Date.UTC(s + 1, 3, 16))];
    const contributionId = shortId();
    const apeId = shortId();
    feeTypes.push(
      { id: contributionId, schoolId: ctx.ceg.id, academicYearId: year.id, name: "Contribution scolaire", kind: "SCHOOL_CONTRIBUTION", amount: CONTRIBUTION },
      { id: apeId, schoolId: ctx.ceg.id, academicYearId: year.id, name: "Cotisation APE", kind: "APE_DUES", amount: APE },
    );
    const planId = shortId();
    plans.push({ id: planId, schoolId: ctx.ceg.id, academicYearId: year.id, feeTypeId: contributionId, name: "Contribution en trois tranches" });
    [50, 30, 20].forEach((percent, i) => planSteps.push({ id: shortId(), planId, label: `Tranche ${i + 1}`, order: i + 1, percent, dueDate: due[i]! }));

    // When families paid: a school day of each window, 7 h to 16 h.
    const windows = [
      weekDays(year.startDate, new Date(Date.UTC(s, 9, 30))),
      weekDays(new Date(Date.UTC(s + 1, 0, 5)), new Date(Date.UTC(s + 1, 1, 13))),
      weekDays(new Date(Date.UTC(s + 1, 2, 16)), new Date(Date.UTC(s + 1, 4, 8))),
    ];
    const when = (w: number) => new Date(rng.pick(windows[w]!).getTime() + 6 * 3600_000 + rng.int(0, 9 * 60) * 60_000);
    const method = () => (rng.chance(MOBILE_MONEY[y]!) ? ("MOBILE_MONEY" as const) : rng.chance(0.03) ? ("BANK_TRANSFER" as const) : ("CASH" as const));

    let seq = 0;
    const pupils = stints[y]!.filter((st) => st.schoolId === ctx.ceg.id).sort((a, b) => a.spec.localeCompare(b.spec) || a.studentId.localeCompare(b.studentId));
    for (const st of pupils) {
      const invoiceId = shortId();
      seq++;
      const amounts = [7_500 + APE, 4_500, 3_000];
      // What the family paid, tranche by tranche.
      const r = rng.rand();
      const left = st.status !== "ACTIVE";
      let paidSteps: number[];
      if (left) paidSteps = r < 0.7 ? [amounts[0]!] : [];
      else if (r < 0.64) paidSteps = rng.chance(0.35) ? [20_000] : amounts;
      else if (r < 0.84) paidSteps = rng.chance(0.5) ? [amounts[0]!, amounts[1]!] : [amounts[0]!];
      else if (r < 0.95) paidSteps = [rng.chance(0.5) ? APE : 7_500];
      else paidSteps = [];
      const paid = paidSteps.reduce((a, b) => a + b, 0);
      const steps = amounts.map((amount, i) => ({ id: shortId(), order: i + 1, amount, dueDate: due[i]! }));
      const allocation = distributePaid(steps, paid, TODAY);
      const byId = new Map(allocation.map((a) => [a.id, a]));
      invoices.push({
        id: invoiceId,
        number: `FAC-${s}-${String(seq).padStart(4, "0")}`,
        schoolId: ctx.ceg.id,
        enrollmentId: st.id,
        totalAmount: CONTRIBUTION + APE,
        paidAmount: paid,
        status: invoiceStatus({ totalAmount: CONTRIBUTION + APE, paidAmount: paid, dueDate: due[2]!, installments: steps.map((x) => ({ ...x, paidAmount: byId.get(x.id)!.paidAmount })), today: TODAY }),
        issueDate: year.startDate,
        dueDate: due[2]!,
        createdAt: new Date(year.startDate.getTime() + 6 * 3600_000 + seq * 1000),
      });
      items.push(
        { id: shortId(), invoiceId, feeTypeId: contributionId, description: "Contribution scolaire", unitPrice: CONTRIBUTION },
        { id: shortId(), invoiceId, feeTypeId: apeId, description: "Cotisation APE", unitPrice: APE },
      );
      steps.forEach((x, i) =>
        installments.push({ id: x.id, invoiceId, label: ["Tranche 1 et APE", "Tranche 2", "Tranche 3"][i]!, order: x.order, amount: x.amount, paidAmount: byId.get(x.id)!.paidAmount, dueDate: x.dueDate, status: byId.get(x.id)!.status }),
      );
      paidSteps.forEach((amount, i) => {
        const paidAt = when(Math.min(i, 2));
        const m = method();
        payments.push({
          id: shortId(),
          // Numbered by calendar year once every payment is written.
          reference: `TMP-${shortId()}`,
          invoiceId,
          amount,
          method: m,
          transactionId: m === "MOBILE_MONEY" ? `MP${paidAt.toISOString().slice(2, 10).replace(/-/g, "")}${String(rng.int(0, 99_999_999)).padStart(8, "0")}` : null,
          paidAt,
          createdAt: paidAt,
          recordedById: input.users.accountant,
        });
      });
    }
  }
  const { bulk } = input;
  await bulk.insert("FeeType", feeTypes);
  await bulk.insert("PaymentPlan", plans);
  await bulk.insert("PaymentPlanInstallment", planSteps);
  await bulk.insert("Invoice", invoices);
  await bulk.insert("InvoiceItem", items);
  await bulk.insert("InvoiceInstallment", installments);
  await bulk.insert("Payment", payments);
  // Receipt numbers follow the order in which the money came in, per
  // calendar year, as the application numbers them (PAY-2026-00001...).
  await bulk.query(`UPDATE "Payment" SET reference = 'TMP-' || id`);
  await bulk.query(`
    UPDATE "Payment" p SET reference = 'PAY-' || x.y || '-' || lpad(x.n::text, 5, '0')
    FROM (SELECT id, extract(year FROM "paidAt")::int AS y, row_number() OVER (PARTITION BY extract(year FROM "paidAt") ORDER BY "paidAt", id) AS n FROM "Payment") x
    WHERE x.id = p.id`);
  console.log(`history: ${invoices.length} invoices, ${payments.length} payments at CEG Godomey`);
}
