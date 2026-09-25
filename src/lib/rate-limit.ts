import "server-only";

import { db } from "@/lib/db";

// Fixed window counter stored in PostgreSQL, so the limit holds across every
// serverless instance without an extra service.
export async function hitRateLimit(key: string, limit: number, windowMs: number) {
  const now = new Date();
  const windowStart = new Date(now.getTime() - windowMs);
  const row = await db.$transaction(async (tx) => {
    const current = await tx.rateLimit.findUnique({ where: { key } });
    if (!current || current.windowStart < windowStart) {
      return tx.rateLimit.upsert({
        where: { key },
        create: { key, count: 1, windowStart: now },
        update: { count: 1, windowStart: now },
      });
    }
    return tx.rateLimit.update({ where: { key }, data: { count: { increment: 1 } } });
  });
  const retryAfterMs = row.windowStart.getTime() + windowMs - now.getTime();
  return { allowed: row.count <= limit, count: row.count, retryAfterMs: Math.max(0, retryAfterMs) };
}

export async function resetRateLimit(key: string) {
  await db.rateLimit.deleteMany({ where: { key } });
}
