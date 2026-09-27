// Mail settings read from the environment. Pure, so the fallback rules are
// unit tested without a server.

type Env = Record<string, string | undefined>;

export const DEFAULT_FROM = "Classéo <no-reply@classeo.bj>";

export type MailConfig =
  | { enabled: false; from: string }
  | { enabled: true; from: string; host: string; port: number; secure: boolean; user: string | null; password: string | null };

// Without SMTP_HOST the platform runs with no mail at all: every message is
// summarised in the server log and nothing is sent.
export function readMailConfig(env: Env): MailConfig {
  const from = env.MAIL_FROM?.trim() || DEFAULT_FROM;
  const host = env.SMTP_HOST?.trim();
  if (!host) return { enabled: false, from };
  const parsed = Number.parseInt(env.SMTP_PORT ?? "", 10);
  const port = Number.isInteger(parsed) && parsed > 0 && parsed < 65536 ? parsed : 587;
  // Implicit TLS on 465 by default; other ports upgrade with STARTTLS when the
  // server offers it.
  const secure = env.SMTP_SECURE ? env.SMTP_SECURE.trim().toLowerCase() === "true" : port === 465;
  const user = env.SMTP_USER?.trim() || null;
  return { enabled: true, from, host, port, secure, user, password: user ? (env.SMTP_PASSWORD ?? null) : null };
}

// Public address of the platform, used for the links inside e-mails and the
// canonical addresses of the public pages (src/lib/seo.ts). It is never
// taken from the request Host header, which the client controls.
export function appUrl(env: Env): string {
  for (const explicit of [env.APP_URL?.trim(), env.NEXT_PUBLIC_APP_URL?.trim()]) {
    if (explicit && /^https?:\/\//.test(explicit)) return explicit.replace(/\/+$/, "");
  }
  const vercel = env.VERCEL_PROJECT_PRODUCTION_URL?.trim() || env.VERCEL_URL?.trim();
  if (vercel) return `https://${vercel.replace(/\/+$/, "")}`;
  return "http://localhost:3000";
}

// Joins a platform path to the public address. Anything that is not a same
// site absolute path falls back to the home of the private space.
export function absoluteUrl(base: string, path: string | undefined | null): string {
  const safe = path && path.startsWith("/") && !path.startsWith("//") && !path.startsWith("/\\") ? path : "/espace";
  return `${base}${safe}`;
}

// "secretaire@classeo.bj" becomes "se***@classeo.bj": enough for an operator
// to follow a delivery in the log without printing the full address.
export function maskAddress(address: string): string {
  const at = address.lastIndexOf("@");
  if (at < 1) return "***";
  const local = address.slice(0, at);
  return `${local.slice(0, Math.min(2, local.length))}***${address.slice(at)}`;
}
