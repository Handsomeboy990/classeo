import { describe, expect, it, vi } from "vitest";

import { computeSignature, createFedapay, fedapayConfig, mapFedapayStatus, verifyFedapaySignature } from "./fedapay";
import { SignatureError } from "./types";

const SECRET = "wh_sandbox_test_secret";
const env = { FEDAPAY_ENV: "sandbox", FEDAPAY_SECRET_KEY: "sk_sandbox_test", FEDAPAY_WEBHOOK_SECRET: SECRET };

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

// A header as FedaPay builds it (fedapay-node, Webhook.generateTestHeaderString).
function header(body: string, at: Date, secret = SECRET) {
  const t = Math.floor(at.getTime() / 1000);
  return `t=${t},s=${computeSignature(secret, t, body)}`;
}

describe("fedapayConfig", () => {
  it("uses the sandbox unless live is asked", () => {
    expect(fedapayConfig({}).apiBase).toBe("https://sandbox-api.fedapay.com/v1");
    expect(fedapayConfig({ FEDAPAY_ENV: "live" }).apiBase).toBe("https://api.fedapay.com/v1");
  });

  it("is not configured without a secret key", () => {
    expect(createFedapay({}).isConfigured()).toBe(false);
    expect(createFedapay(env).isConfigured()).toBe(true);
  });
});

describe("mapFedapayStatus", () => {
  it("maps every documented status", () => {
    expect(["pending", "approved", "declined", "canceled", "refunded", "transferred"].map(mapFedapayStatus)).toEqual(["PENDING", "APPROVED", "DECLINED", "CANCELED", "REFUNDED", "APPROVED"]);
    expect(mapFedapayStatus("something new")).toBe("PENDING");
  });
});

describe("verifyFedapaySignature", () => {
  const body = JSON.stringify({ name: "transaction.approved", entity: { id: 42, status: "approved", amount: 25000 } });
  const now = new Date("2026-09-25T12:00:00Z");

  it("accepts the signature FedaPay computes", () => {
    expect(() => verifyFedapaySignature(body, header(body, now), SECRET, now)).not.toThrow();
  });

  it("refuses a body changed after signing", () => {
    const h = header(body, now);
    expect(() => verifyFedapaySignature(body.replace("25000", "250"), h, SECRET, now)).toThrow(SignatureError);
  });

  it("refuses another secret, a missing or malformed header", () => {
    expect(() => verifyFedapaySignature(body, header(body, now, "other"), SECRET, now)).toThrow(/invalide/);
    expect(() => verifyFedapaySignature(body, null, SECRET, now)).toThrow(/absent/);
    expect(() => verifyFedapaySignature(body, "bad_header", SECRET, now)).toThrow(/illisible/);
  });

  it("refuses a replay older than five minutes", () => {
    const old = new Date(now.getTime() - 6 * 60 * 1000);
    expect(() => verifyFedapaySignature(body, header(body, old), SECRET, now)).toThrow(/ancienne/);
  });
});

describe("createFedapay", () => {
  it("creates the transaction, then asks for its payment link", async () => {
    const fetchMock = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      const u = String(url);
      if (u.endsWith("/transactions") && init?.method === "POST") return json({ "v1/transaction": { id: 1234, status: "pending", amount: 25000 } }, 201);
      if (u.endsWith("/transactions/1234/token")) return json({ token: "tok", url: "https://sandbox-process.fedapay.com/tok" });
      return json({}, 404);
    });
    const p = createFedapay(env, fetchMock as unknown as typeof fetch);
    const out = await p.createCheckout({
      onlinePaymentId: "op1",
      amount: 25000,
      currency: "XOF",
      description: "Frais scolaires",
      returnUrl: "https://classeo.bj/espace/payer/retour?op=op1",
      customer: { firstName: "Afiavi", lastName: "Hounkpatin", phone: "01 97 00 00 00" },
    });
    expect(out).toEqual({ providerRef: "1234", checkoutUrl: "https://sandbox-process.fedapay.com/tok" });

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toBe("https://sandbox-api.fedapay.com/v1/transactions");
    expect((init!.headers as Record<string, string>).Authorization).toBe("Bearer sk_sandbox_test");
    const sent = JSON.parse(String(init!.body));
    expect(sent).toMatchObject({ amount: 25000, currency: { iso: "XOF" }, custom_metadata: { online_payment_id: "op1" }, customer: { phone_number: { number: "0197000000", country: "bj" } } });
  });

  it("reads the authoritative status of a transaction", async () => {
    const fetchMock = vi.fn(async () => json({ "v1/transaction": { id: 1234, status: "transferred", amount: 25000, currency: { iso: "XOF" }, custom_metadata: { online_payment_id: "op1" } } }));
    const t = await createFedapay(env, fetchMock as unknown as typeof fetch).getTransaction("1234");
    expect(t).toEqual({ providerRef: "1234", status: "APPROVED", amount: 25000, currency: "XOF", onlinePaymentId: "op1" });
  });

  it("turns HTTP failures into a readable error", async () => {
    const p = createFedapay(env, (async () => json({ message: "Unauthorized" }, 401)) as unknown as typeof fetch);
    await expect(p.getTransaction("1")).rejects.toThrow(/401/);
    await expect(p.getTransaction("../1")).rejects.toThrow(/invalide/);
  });

  it("returns the signed transaction of a webhook", () => {
    const now = new Date();
    const body = JSON.stringify({ name: "transaction.approved", entity: { id: 99, status: "approved", amount: 5000, currency: { iso: "XOF" }, custom_metadata: { online_payment_id: "op9" } } });
    const headers = new Headers({ "x-fedapay-signature": header(body, now) });
    expect(createFedapay(env).verifyWebhook(body, headers, now)).toEqual({ name: "transaction.approved", transaction: { providerRef: "99", status: "APPROVED", amount: 5000, currency: "XOF", onlinePaymentId: "op9" } });
    expect(() => createFedapay({ FEDAPAY_SECRET_KEY: "k" }).verifyWebhook(body, headers, now)).toThrow(/non configuré/);
  });
});
