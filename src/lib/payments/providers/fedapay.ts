import { createHmac, timingSafeEqual } from "node:crypto";

import { ProviderError, SignatureError, type Checkout, type CheckoutInput, type OnlineStatus, type PaymentProvider, type ProviderTransaction, type WebhookEvent } from "./types";

// FedaPay, the Benin aggregator (MTN MoMo, Moov Money, Celtiis Cash, cards).
// Sources, read on 2026-09-25:
// - API: https://docs.fedapay.com/fr/integration-api/sending-requests.md
//   (servers sandbox-api.fedapay.com and api.fedapay.com, Bearer secret key)
// - Create a transaction, then its payment link:
//   https://docs.fedapay.com/api-reference/transactions/create.md and
//   https://docs.fedapay.com/api-reference/transactions/create-token.md
// - Statuses pending, approved, declined, canceled, refunded, transferred:
//   https://docs.fedapay.com/fr/integration-api/collects-management.md
// - Webhooks signed in the X-FEDAPAY-SIGNATURE header, "t=<unix>,s=<hex>",
//   HMAC-SHA256 of "<t>.<raw body>" with the endpoint secret, 5 minutes of
//   tolerance: https://docs.fedapay.com/fr/integration-api/webhooks.md and
//   src/Webhook.ts of the official fedapay-node library.
// No SDK dependency: three HTTPS calls and one HMAC.

type Env = Record<string, string | undefined>;
type Fetch = typeof fetch;

const TOLERANCE_SECONDS = 300;

export function fedapayConfig(env: Env = process.env) {
  const live = env.FEDAPAY_ENV?.trim().toLowerCase() === "live";
  return {
    live,
    apiBase: live ? "https://api.fedapay.com/v1" : "https://sandbox-api.fedapay.com/v1",
    secretKey: env.FEDAPAY_SECRET_KEY?.trim() || null,
    publicKey: env.FEDAPAY_PUBLIC_KEY?.trim() || null,
    webhookSecret: env.FEDAPAY_WEBHOOK_SECRET?.trim() || null,
  };
}

// FedaPay words to ours. "transferred" means approved and already moved to
// the merchant balance: paid for the school. canceled and declined are not
// final on FedaPay's side (the payer may retry), which nextStatus() allows.
export function mapFedapayStatus(status: string): OnlineStatus {
  switch (status) {
    case "approved":
    case "transferred":
      return "APPROVED";
    case "declined":
      return "DECLINED";
    case "canceled":
    case "cancelled":
      return "CANCELED";
    case "refunded":
      return "REFUNDED";
    default:
      return "PENDING";
  }
}

// Responses wrap the object under "v1/transaction" (see Resource.ts of the
// official library); a bare object is accepted too.
function unwrapTransaction(body: unknown): Record<string, unknown> {
  if (body && typeof body === "object") {
    const o = body as Record<string, unknown>;
    for (const key of ["v1/transaction", "transaction"]) if (o[key] && typeof o[key] === "object") return o[key] as Record<string, unknown>;
    if ("id" in o) return o;
  }
  throw new ProviderError("Réponse FedaPay inattendue.");
}

export function computeSignature(secret: string, timestamp: number, rawBody: string) {
  return createHmac("sha256", secret).update(`${timestamp}.${rawBody}`, "utf8").digest("hex");
}

export function verifyFedapaySignature(rawBody: string, header: string | null, secret: string, now = new Date()) {
  if (!header) throw new SignatureError("En-tête de signature absent.");
  let timestamp = -1;
  const signatures: string[] = [];
  for (const part of header.split(",")) {
    const [k, v] = part.split("=", 2).map((s) => s.trim());
    if (k === "t" && v) timestamp = Number.parseInt(v, 10);
    if (k === "s" && v) signatures.push(v);
  }
  if (!Number.isFinite(timestamp) || timestamp < 0 || !signatures.length) throw new SignatureError("En-tête de signature illisible.");
  const expected = Buffer.from(computeSignature(secret, timestamp, rawBody), "utf8");
  const ok = signatures.some((s) => {
    const given = Buffer.from(s, "utf8");
    return given.length === expected.length && timingSafeEqual(given, expected);
  });
  if (!ok) throw new SignatureError("Signature invalide.");
  const age = Math.floor(now.getTime() / 1000) - timestamp;
  if (age > TOLERANCE_SECONDS) throw new SignatureError("Signature trop ancienne.");
  if (age < -TOLERANCE_SECONDS) throw new SignatureError("Horodatage dans le futur.");
}

export function createFedapay(env: Env = process.env, fetchImpl: Fetch = fetch): PaymentProvider {
  const cfg = fedapayConfig(env);

  async function call(method: "GET" | "POST", path: string, body?: unknown) {
    if (!cfg.secretKey) throw new ProviderError("Paiement en ligne non configuré.");
    let res: Response;
    try {
      res = await fetchImpl(`${cfg.apiBase}${path}`, {
        method,
        headers: { Authorization: `Bearer ${cfg.secretKey}`, "Content-Type": "application/json", Accept: "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(15_000),
        cache: "no-store",
      });
    } catch {
      throw new ProviderError("FedaPay ne répond pas. Réessayez dans un instant.");
    }
    const text = await res.text();
    let json: unknown = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = null;
    }
    if (!res.ok) throw new ProviderError(`FedaPay a refusé la demande (${res.status}).`, res.status);
    return json;
  }

  function toTransaction(raw: Record<string, unknown>): ProviderTransaction {
    const meta = (raw.custom_metadata ?? raw.metadata) as Record<string, unknown> | undefined;
    const currency = raw.currency && typeof raw.currency === "object" ? String((raw.currency as Record<string, unknown>).iso ?? "XOF") : "XOF";
    return {
      providerRef: String(raw.id),
      status: mapFedapayStatus(String(raw.status ?? "pending")),
      amount: Number(raw.amount),
      currency,
      onlinePaymentId: typeof meta?.online_payment_id === "string" ? meta.online_payment_id : null,
    };
  }

  return {
    id: "fedapay",
    label: "FedaPay (Mobile Money, carte bancaire)",
    isConfigured: () => !!cfg.secretKey,

    async createCheckout(input: CheckoutInput): Promise<Checkout> {
      const phone = input.customer.phone?.replace(/\D/g, "");
      const created = unwrapTransaction(
        await call("POST", "/transactions", {
          description: input.description.slice(0, 250),
          amount: input.amount,
          currency: { iso: input.currency },
          callback_url: input.returnUrl,
          custom_metadata: { online_payment_id: input.onlinePaymentId },
          customer: {
            firstname: input.customer.firstName,
            lastname: input.customer.lastName,
            ...(input.customer.email ? { email: input.customer.email } : {}),
            ...(phone ? { phone_number: { number: phone, country: "bj" } } : {}),
          },
        }),
      );
      const providerRef = String(created.id);
      const token = (await call("POST", `/transactions/${encodeURIComponent(providerRef)}/token`)) as { url?: unknown } | null;
      if (!token || typeof token.url !== "string" || !/^https:\/\//.test(token.url)) throw new ProviderError("FedaPay n'a pas fourni de lien de paiement.");
      return { providerRef, checkoutUrl: token.url };
    },

    async getTransaction(providerRef: string) {
      if (!/^\d{1,20}$/.test(providerRef)) throw new ProviderError("Référence FedaPay invalide.");
      return toTransaction(unwrapTransaction(await call("GET", `/transactions/${providerRef}`)));
    },

    verifyWebhook(rawBody: string, headers: Headers, now = new Date()): WebhookEvent {
      if (!cfg.webhookSecret) throw new SignatureError("Secret de webhook non configuré.");
      verifyFedapaySignature(rawBody, headers.get("x-fedapay-signature"), cfg.webhookSecret, now);
      let event: Record<string, unknown>;
      try {
        event = JSON.parse(rawBody) as Record<string, unknown>;
      } catch {
        throw new SignatureError("Corps illisible.");
      }
      const name = String(event.name ?? event.type ?? "");
      const entity = event.entity;
      const isTransaction = name.startsWith("transaction.") && entity && typeof entity === "object" && "id" in entity;
      return { name, transaction: isTransaction ? toTransaction(entity as Record<string, unknown>) : null };
    },
  };
}
