// Contract of an online payment provider (aggregator). Classéo speaks to
// this interface only: FedaPay implements it today, TrésorPay or another
// aggregator can replace it by adding a file next to fedapay.ts and naming it
// in the "payments.online" option (featureConfig().provider).

// Statuses of the OnlinePayment model, the provider's own words mapped once.
export type OnlineStatus = "PENDING" | "APPROVED" | "DECLINED" | "CANCELED" | "REFUNDED";

export type CheckoutInput = {
  // Our OnlinePayment id, sent as metadata so the provider's record points
  // back to ours.
  onlinePaymentId: string;
  amount: number; // integer, XOF
  currency: "XOF";
  description: string;
  // Where the payer's browser comes back after paying.
  returnUrl: string;
  customer: { firstName: string; lastName: string; email?: string | null; phone?: string | null };
};

export type Checkout = { providerRef: string; checkoutUrl: string };

export type ProviderTransaction = {
  providerRef: string;
  status: OnlineStatus;
  amount: number;
  currency: string;
  onlinePaymentId: string | null;
};

// A verified event. For transaction events, the transaction as the
// provider signed it.
export type WebhookEvent = { name: string; transaction: ProviderTransaction | null };

export class ProviderError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
    this.name = "ProviderError";
  }
}

export class SignatureError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SignatureError";
  }
}

export interface PaymentProvider {
  readonly id: string;
  readonly label: string;
  // Keys present: the online button is shown only then.
  isConfigured(): boolean;
  createCheckout(input: CheckoutInput): Promise<Checkout>;
  // The authoritative state, read from the provider's API: never trust a
  // status carried by a return address or an unverified message.
  getTransaction(providerRef: string): Promise<ProviderTransaction>;
  // Verifies the signature of a webhook call on its raw body and returns
  // the event. Throws SignatureError when it is not authentic.
  verifyWebhook(rawBody: string, headers: Headers, now?: Date): WebhookEvent;
}
