// Mail sender built around a transport factory, so the delivery rules (log
// only fallback, timeouts, never throwing) are tested without an SMTP server.
// The application uses the instance from ./index.ts.

import { maskAddress, type MailConfig } from "./config";

export type MailMessage = {
  to: string;
  subject: string;
  html: string;
  text: string;
  // Short label for the log, for example "account_created".
  tag: string;
};

// "sent": accepted by the SMTP server. "skipped": no SMTP configured, only
// logged. "failed": the server refused it or could not be reached.
export type MailStatus = "sent" | "skipped" | "failed";

type SendOptions = { from: string; to: string; subject: string; html: string; text: string };
export type TransportLike = { sendMail(options: SendOptions): Promise<unknown> };

export type TransportOptions = {
  host: string;
  port: number;
  secure: boolean;
  auth?: { user: string; pass: string };
  pool: boolean;
  maxConnections: number;
  connectionTimeout: number;
  greetingTimeout: number;
  socketTimeout: number;
};

type Logger = { info(message: string): void; error(message: string): void };

// A slow or unreachable SMTP server must not hold a request for long.
export const SMTP_TIMEOUT_MS = 10_000;

export function transportOptions(config: Extract<MailConfig, { enabled: true }>): TransportOptions {
  return {
    host: config.host,
    port: config.port,
    secure: config.secure,
    ...(config.user ? { auth: { user: config.user, pass: config.password ?? "" } } : {}),
    pool: true,
    maxConnections: 3,
    connectionTimeout: SMTP_TIMEOUT_MS,
    greetingTimeout: SMTP_TIMEOUT_MS,
    socketTimeout: SMTP_TIMEOUT_MS,
  };
}

// Last resort bound on one message, above the socket timeouts.
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`no answer from the SMTP server after ${ms} ms`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

export function createMailer(deps: {
  config: MailConfig;
  createTransport: (options: TransportOptions) => TransportLike;
  logger?: Logger;
  timeoutMs?: number;
}) {
  const { config } = deps;
  const logger = deps.logger ?? { info: (m: string) => console.info(m), error: (m: string) => console.error(m) };
  let transport: TransportLike | null = null;

  // The body is never logged: it can hold a temporary password or a code.
  const summary = (m: MailMessage) => `[${m.tag}] to ${maskAddress(m.to)}, subject "${m.subject}"`;

  async function send(message: MailMessage): Promise<MailStatus> {
    if (!config.enabled) {
      logger.info(`mail not sent (SMTP_HOST is not set) ${summary(message)}`);
      return "skipped";
    }
    try {
      transport ??= deps.createTransport(transportOptions(config));
      await withTimeout(
        transport.sendMail({ from: config.from, to: message.to, subject: message.subject, html: message.html, text: message.text }),
        deps.timeoutMs ?? SMTP_TIMEOUT_MS * 2,
      );
      logger.info(`mail sent ${summary(message)}`);
      return "sent";
    } catch (error) {
      const reason = error instanceof Error ? error.message.slice(0, 200) : "unknown error";
      logger.error(`mail failed ${summary(message)}: ${reason}`);
      return "failed";
    }
  }

  return { enabled: config.enabled, send };
}
