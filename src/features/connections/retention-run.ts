import "server-only";

import { db } from "@/lib/db";

import { PURGE_EVERY_MS, purgeExpired, type PurgeReport, type RetentionStore } from "./retention";

const MARKER = "retention";

const store: RetentionStore = {
  eventsWithFullIp: (before, take) => db.connectionEvent.findMany({ where: { createdAt: { lt: before }, ipTruncated: false }, select: { id: true, ip: true }, take }),
  truncateEvents: async (ids, ip) => {
    await db.connectionEvent.updateMany({ where: { id: { in: ids } }, data: { ip, ipTruncated: true } });
  },
  markEventsTruncated: async (ids) => {
    await db.connectionEvent.updateMany({ where: { id: { in: ids } }, data: { ipTruncated: true } });
  },
  auditWithFullIp: (before, take) =>
    db.auditLog.findMany({
      where: { createdAt: { lt: before }, ip: { not: null, notIn: ["direct", "unknown"] }, NOT: { ip: { contains: "x" } } },
      select: { id: true, ip: true },
      take,
    }),
  truncateAudit: async (ids, ip) => {
    await db.auditLog.updateMany({ where: { id: { in: ids } }, data: { ip } });
  },
  deleteEvents: async (before) => (await db.connectionEvent.deleteMany({ where: { createdAt: { lt: before } } })).count,
  deleteSessions: async (before) => (await db.session.deleteMany({ where: { expiresAt: { lt: before } } })).count,
  deleteRateLimits: async (before) => (await db.rateLimit.deleteMany({ where: { windowStart: { lt: before } } })).count,
  deletePageViews: async (before) => (await db.pageViewDaily.deleteMany({ where: { day: { lt: before } } })).count,
};

// Claims today's run: true for the one caller that moved the marker, false
// when the purge already ran in the last 24 hours (on any instance).
async function claimRun(now: Date) {
  const rows = await db.$queryRaw<{ key: string }[]>`
    INSERT INTO "MaintenanceMarker" ("key", "ranAt") VALUES (${MARKER}, ${now})
    ON CONFLICT ("key") DO UPDATE SET "ranAt" = EXCLUDED."ranAt"
    WHERE "MaintenanceMarker"."ranAt" < ${new Date(now.getTime() - PURGE_EVERY_MS)}
    RETURNING "key"`;
  return rows.length > 0;
}

// The retention purge, at most once a day: called after a successful sign
// in (after the answer has left) and by the cron route, whichever comes
// first. Never throws: a failure is logged, and the next day's run catches
// up (every step works on what is past its date, in batches).
export async function runRetention(): Promise<PurgeReport | null> {
  const now = new Date();
  try {
    if (!(await claimRun(now))) return null;
    const report = await purgeExpired(store, now);
    console.info("retention purge", report);
    return report;
  } catch (error) {
    console.error("retention purge failed", error instanceof Error ? error.message : "unknown error");
    return null;
  }
}
