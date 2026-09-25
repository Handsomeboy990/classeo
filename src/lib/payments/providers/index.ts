import "server-only";

import { featureConfig, isEnabled } from "@/lib/features";

import { createFedapay } from "./fedapay";
import type { PaymentProvider } from "./types";

// Registered providers. Adding one (TrésorPay, another aggregator) means a
// file implementing PaymentProvider and a line here; the "payments.online"
// option then names it, without touching the payment flow.
const PROVIDERS: Record<string, () => PaymentProvider> = {
  fedapay: () => createFedapay(),
};

export function providerById(id: string): PaymentProvider | null {
  return PROVIDERS[id]?.() ?? null;
}

// The provider parents pay with, or null when online payment is switched
// off or its keys are missing (the page then offers the declaration of a
// transfer, or the school's cash desk).
export async function onlineProvider(): Promise<PaymentProvider | null> {
  if (!(await isEnabled("payments.online"))) return null;
  const { provider } = await featureConfig("payments.online");
  const p = providerById(String(provider));
  return p && p.isConfigured() ? p : null;
}
