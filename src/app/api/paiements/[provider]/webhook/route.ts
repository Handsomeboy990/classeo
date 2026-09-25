import { settleOnlinePayment } from "@/features/online-payment/settle";
import { db } from "@/lib/db";
import { providerById } from "@/lib/payments/providers";
import { SignatureError } from "@/lib/payments/providers/types";

// Notifications of the payment provider (FedaPay: /api/paiements/fedapay/
// webhook, to declare in its dashboard). Public, so nothing is trusted
// before the signature of the raw body is verified; the transaction is then
// matched to our record by its provider reference, and applied once.
export async function POST(request: Request, ctx: RouteContext<"/api/paiements/[provider]/webhook">) {
  const { provider: id } = await ctx.params;
  const provider = providerById(id);
  if (!provider) return new Response("Inconnu", { status: 404 });

  const raw = await request.text();
  if (raw.length > 100_000) return new Response("Trop volumineux", { status: 413 });
  let event;
  try {
    event = provider.verifyWebhook(raw, request.headers);
  } catch (error) {
    if (error instanceof SignatureError) return Response.json({ error: error.message }, { status: 400 });
    throw error;
  }

  const t = event.transaction;
  if (!t) return Response.json({ received: true, ignored: event.name });
  const op = await db.onlinePayment.findUnique({ where: { providerRef: t.providerRef }, select: { id: true, provider: true } });
  // Unknown to us (another application on the same merchant account, or a
  // metadata mismatch): acknowledged, so the provider does not retry.
  if (!op || op.provider !== provider.id || (t.onlinePaymentId && t.onlinePaymentId !== op.id)) return Response.json({ received: true, ignored: "unknown transaction" });

  const result = await settleOnlinePayment(op.id, t, "webhook");
  return Response.json({ received: true, status: result.after, recorded: result.recorded });
}
