import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { SignInPage } from "@/features/auth/sign-in-page";
import { clientIp, getCurrentUser } from "@/lib/auth/session";
import { demoAccessToken, isDemoAccessToken } from "@/lib/demo/access";
import { resolveDemoPassword } from "@/lib/demo/password";
import { hitRateLimit, isRateLimited } from "@/lib/rate-limit";

// Never indexed, never followed, and the address (which holds the token) is
// not sent as a referrer to the pages it links to.
export const metadata: Metadata = {
  title: "Connexion",
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
  referrer: "no-referrer",
};

// Rendered on every request, never cached: the answer depends on the token
// and on the caller's attempts.
export const dynamic = "force-dynamic";

// Wrong tokens allowed per address and window before the page answers 404
// even to the right one. Without a trusted proxy every caller shares the
// "direct" bucket.
const WRONG_LIMIT = 10;
const WINDOW_MS = 15 * 60 * 1000;

// The sign in page with the demonstration panel, at /acces/<DEMO_ACCESS_TOKEN>.
// The owner sends this address to the people invited to try the platform;
// nothing links to it. Without the variable, or with a wrong token, it
// answers the regular 404 page, with no hint.
export default async function DemoAccessPage({ params, searchParams }: PageProps<"/acces/[token]">) {
  if (!demoAccessToken()) {
    if (process.env.DEMO_ACCESS_TOKEN) console.error("DEMO_ACCESS_TOKEN needs at least 32 letters, digits, - or _: the demo access page stays closed.");
    notFound();
  }
  const { token } = await params;
  const key = `demo-access:ip:${clientIp(await headers())}`;
  if (await isRateLimited(key, WRONG_LIMIT, WINDOW_MS)) notFound();
  if (!isDemoAccessToken(token)) {
    await hitRateLimit(key, WRONG_LIMIT, WINDOW_MS);
    notFound();
  }

  if (await getCurrentUser()) redirect("/espace");
  return <SignInPage searchParams={await searchParams} demo={{ password: resolveDemoPassword() }} />;
}
