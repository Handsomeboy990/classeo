import { cookies, headers } from "next/headers";
import { z } from "zod";

import { parseUserAgent } from "@/features/connections/user-agent";
import { normalisePath, referrerHost, visitCounters, visitLanguage } from "@/features/connections/visits";
import { Prisma } from "@/generated/prisma/client";
import { clientIp, readSessionId, SESSION_COOKIE } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { hitRateLimit } from "@/lib/rate-limit";

// First party, cookieless page view count. The beacon of the root layout
// (features/connections/visit-beacon.tsx) posts the page, the host it came
// from and the language; everything else is decided here: the path is
// normalised again, the device read from the user agent, whether the
// visitor is signed in and their role read from the session. No account
// identifier, no address, no row per visit: each view adds one to a few
// daily counters (model PageViewDaily).

const Body = z.object({
  path: z.string().min(1).max(2000),
  referrer: z.string().max(2000).optional(),
  lang: z.string().max(16).optional(),
});

const empty = () => new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });

async function roleOf(token: string | undefined) {
  const sid = await readSessionId(token);
  if (!sid) return null;
  const session = await db.session.findUnique({
    where: { id: sid },
    select: { revokedAt: true, expiresAt: true, user: { select: { isActive: true, role: { select: { code: true } } } } },
  });
  if (!session || session.revokedAt || session.expiresAt < new Date() || !session.user.isActive) return null;
  return session.user.role.code;
}

export async function POST(request: Request) {
  const h = await headers();
  // Same site only: another site cannot inflate the counts from its pages.
  const site = h.get("sec-fetch-site");
  if (site && site !== "same-origin") return new Response(null, { status: 403 });
  const origin = h.get("origin");
  const host = h.get("host");
  const originHost = origin ? URL.parse(origin)?.host : null;
  if (origin && host && originHost !== host && originHost !== h.get("x-forwarded-host")) return new Response(null, { status: 403 });

  const ip = clientIp(h);
  // Per address; every caller shares one larger bucket without a trusted
  // proxy (clientIp answers "direct").
  const limit = ip === "direct" ? await hitRateLimit("visit:direct", 3000, 60_000) : await hitRateLimit(`visit:ip:${ip}`, 120, 60_000);
  if (!limit.allowed) return new Response(null, { status: 429, headers: { "Retry-After": String(Math.ceil(limit.retryAfterMs / 1000)) } });

  const raw = await request.text().catch(() => "");
  if (raw.length > 4000) return new Response(null, { status: 413 });
  let json: unknown = null;
  try {
    json = JSON.parse(raw);
  } catch {
    return new Response(null, { status: 400 });
  }
  const parsed = Body.safeParse(json);
  if (!parsed.success) return new Response(null, { status: 400 });
  const path = normalisePath(parsed.data.path);
  if (!path) return new Response(null, { status: 400 });

  const agent = parseUserAgent(h.get("user-agent"));
  // Robots are not visitors.
  if (agent.device === "bot") return empty();

  const role = await roleOf((await cookies()).get(SESSION_COOKIE)?.value);
  const counters = visitCounters({
    path,
    signedIn: !!role,
    role,
    device: agent.device,
    language: visitLanguage(parsed.data.lang),
    referrer: referrerHost(parsed.data.referrer, host),
  });
  // One statement, days in Benin time; concurrent views add up safely.
  await db.$executeRaw`
    INSERT INTO "PageViewDaily" ("day", "dimension", "key", "count")
    VALUES ${Prisma.join(counters.map((c) => Prisma.sql`((now() AT TIME ZONE 'Africa/Porto-Novo')::date, ${c.dimension}, ${c.key.slice(0, 200)}, 1)`))}
    ON CONFLICT ("day", "dimension", "key") DO UPDATE SET "count" = "PageViewDaily"."count" + 1`;
  return empty();
}
