import { settleOnlinePayment } from "@/features/online-payment/settle";
import { getCurrentUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { providerById } from "@/lib/payments/providers";
import { ProviderError } from "@/lib/payments/providers/types";

const noStore = { "Cache-Control": "no-store" };

// State of an online payment, polled by the return page. Only its payer
// reads it. While the provider has not answered through the webhook (a
// webhook cannot reach a local installation, for instance), the provider's
// API is asked directly, at most every ten seconds.
export async function GET(_request: Request, ctx: RouteContext<"/api/paiements/en-ligne/[id]">) {
  const { id } = await ctx.params;
  const user = await getCurrentUser();
  if (!user || id.length > 40) return new Response("Introuvable", { status: 404, headers: noStore });
  let op = await db.onlinePayment.findFirst({ where: { id, payerId: user.id } });
  if (!op) return new Response("Introuvable", { status: 404, headers: noStore });

  const waiting = op.status === "PENDING" || op.status === "CREATED";
  if (waiting && op.providerRef && Date.now() - op.updatedAt.getTime() > 10_000) {
    const provider = providerById(op.provider);
    if (provider?.isConfigured()) {
      try {
        await settleOnlinePayment(op.id, await provider.getTransaction(op.providerRef), "poll");
      } catch (error) {
        if (!(error instanceof ProviderError)) throw error;
        // Provider unreachable: the page keeps waiting, the webhook may
        // still come. Touch the row so the next poll waits ten seconds.
        await db.onlinePayment.update({ where: { id: op.id }, data: { updatedAt: new Date() } });
      }
      op = (await db.onlinePayment.findUnique({ where: { id: op.id } }))!;
    }
  }
  const payment = op.paymentId ? await db.payment.findUnique({ where: { id: op.paymentId }, select: { id: true, reference: true } }) : null;
  return Response.json({ status: op.status, amount: op.amount, invoiceId: op.invoiceId, payment }, { headers: noStore });
}
