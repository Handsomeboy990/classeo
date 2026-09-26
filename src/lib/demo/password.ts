// The shared password of the demonstration accounts.
//
// It comes from the server variable DEMO_PASSWORD. The constant below is only
// the fallback of a local development machine, where the seed and the demo
// panel need a known value without any setup; a production run never uses
// it. Read by the seed, scripts/set-demo-password.ts, the sign in pages (on
// the server) and the end to end suite, so this module stays free of
// "server-only" and is never imported by a client component.

export const LOCAL_DEMO_PASSWORD = "Classeo2026";

type Env = Readonly<Record<string, string | undefined>>;

// A production run: the Node.js production mode, or the production
// deployment of Vercel.
export function isProductionRun(env: Env = process.env) {
  return env.NODE_ENV === "production" || env.VERCEL_ENV === "production";
}

// DEMO_PASSWORD when it is set; otherwise the local fallback outside
// production; otherwise null (production without DEMO_PASSWORD: the seed
// refuses to run and the panel shows the identifiers only).
export function resolveDemoPassword(env: Env = process.env): string | null {
  const configured = env.DEMO_PASSWORD;
  if (configured) return configured;
  return isProductionRun(env) ? null : LOCAL_DEMO_PASSWORD;
}
