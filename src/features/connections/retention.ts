// Retention of the connection data. Pure rules and a purge that takes its
// store as a parameter, so the tests run it without a database
// (connections.test.ts); the server passes Prisma (retention-run.ts).
//
// - Connection events, the activity log and sessions keep the full IP
//   address 90 days, then only its network part (196.47.x.x).
// - Connection events are deleted after 13 months, the daily page view
//   counts too; no row per page view is ever kept.
// - Sessions ended more than 90 days ago are deleted (they hold the IP and
//   the browser of a sign in).
// - Rate limit windows older than two days are deleted (the longest window
//   is one day).

import { isTruncated, truncateIp } from "./ip";

const DAY_MS = 24 * 60 * 60 * 1000;
export const FULL_IP_DAYS = 90;
export const EVENT_DAYS = 396; // 13 months
export const SESSION_DAYS = 90;
export const RATE_LIMIT_DAYS = 2;
// The purge runs at most once a day, on a sign in or from the cron route.
export const PURGE_EVERY_MS = DAY_MS;
// Rows rewritten per batch, and batches per run: a run stays short, the
// next one picks up the rest.
export const BATCH = 500;
export const MAX_BATCHES = 20;

export function retentionCutoffs(now: Date) {
  const ago = (days: number) => new Date(now.getTime() - days * DAY_MS);
  return { fullIp: ago(FULL_IP_DAYS), events: ago(EVENT_DAYS), sessions: ago(SESSION_DAYS), rateLimits: ago(RATE_LIMIT_DAYS), pageViews: ago(EVENT_DAYS) };
}

// Rows with an address, grouped by their truncated form, so each group is
// one update.
export function truncationGroups(rows: readonly { id: string; ip: string | null }[]) {
  const groups = new Map<string, string[]>();
  for (const r of rows) {
    if (isTruncated(r.ip)) continue;
    const t = truncateIp(r.ip)!;
    groups.set(t, [...(groups.get(t) ?? []), r.id]);
  }
  return groups;
}

type Rows = { id: string; ip: string | null }[];

// What the purge needs from the database, one method per statement.
export type RetentionStore = {
  eventsWithFullIp(before: Date, take: number): Promise<Rows>;
  truncateEvents(ids: string[], ip: string): Promise<void>;
  markEventsTruncated(ids: string[]): Promise<void>;
  auditWithFullIp(before: Date, take: number): Promise<Rows>;
  truncateAudit(ids: string[], ip: string): Promise<void>;
  deleteEvents(before: Date): Promise<number>;
  deleteSessions(before: Date): Promise<number>;
  deleteRateLimits(before: Date): Promise<number>;
  deletePageViews(before: Date): Promise<number>;
};

export type PurgeReport = { eventsTruncated: number; auditTruncated: number; eventsDeleted: number; sessionsDeleted: number; rateLimitsDeleted: number; pageViewsDeleted: number };

export async function purgeExpired(store: RetentionStore, now = new Date()): Promise<PurgeReport> {
  const cut = retentionCutoffs(now);
  const report: PurgeReport = { eventsTruncated: 0, auditTruncated: 0, eventsDeleted: 0, sessionsDeleted: 0, rateLimitsDeleted: 0, pageViewsDeleted: 0 };

  for (let n = 0; n < MAX_BATCHES; n++) {
    const rows = await store.eventsWithFullIp(cut.fullIp, BATCH);
    if (!rows.length) break;
    for (const [ip, ids] of truncationGroups(rows)) await store.truncateEvents(ids, ip);
    // Rows without a real address are marked too, so they are not read again.
    const untouched = rows.filter((r) => isTruncated(r.ip)).map((r) => r.id);
    if (untouched.length) await store.markEventsTruncated(untouched);
    report.eventsTruncated += rows.length;
    if (rows.length < BATCH) break;
  }
  for (let n = 0; n < MAX_BATCHES; n++) {
    const rows = await store.auditWithFullIp(cut.fullIp, BATCH);
    const groups = truncationGroups(rows);
    if (!groups.size) break;
    for (const [ip, ids] of groups) await store.truncateAudit(ids, ip);
    report.auditTruncated += [...groups.values()].reduce((s, ids) => s + ids.length, 0);
    if (rows.length < BATCH) break;
  }
  report.eventsDeleted = await store.deleteEvents(cut.events);
  report.sessionsDeleted = await store.deleteSessions(cut.sessions);
  report.rateLimitsDeleted = await store.deleteRateLimits(cut.rateLimits);
  report.pageViewsDeleted = await store.deletePageViews(cut.pageViews);
  return report;
}
