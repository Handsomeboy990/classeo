import "server-only";

import { Prisma } from "@/generated/prisma/client";
import type { CurrentUser } from "@/lib/auth/session";
import { db } from "@/lib/db";

import { truncateIp } from "./ip";
import { connectionScope, connectionSql, connectionWhere, FAILURES, periodDays, periodStart, type ConnectionFilters } from "./scope";

type User = NonNullable<CurrentUser>;

// Days are counted in Benin time (UTC+1, no daylight saving).
const DAY = Prisma.sql`to_char(e."createdAt" + interval '1 hour', 'YYYY-MM-DD')`;
const FAILED = Prisma.sql`e."outcome" IN (${Prisma.join(FAILURES.map((o) => Prisma.sql`${o}::"ConnectionOutcome"`))})`;

type Count = { key: string | null; n: bigint };
const num = (n: bigint | number | null | undefined) => Number(n ?? 0);

async function countBy(where: Prisma.Sql, column: Prisma.Sql, options: { distinctUsers?: boolean; onlySuccess?: boolean; limit?: number } = {}) {
  const measure = options.distinctUsers ? Prisma.sql`count(DISTINCT e."userId")` : Prisma.sql`count(*)`;
  const success = options.onlySuccess ? Prisma.sql`AND e."outcome" = 'SUCCESS'` : Prisma.empty;
  const rows = await db.$queryRaw<Count[]>`
    SELECT ${column} AS key, ${measure} AS n FROM "ConnectionEvent" e
    WHERE ${where} ${success}
    GROUP BY 1 ORDER BY 2 DESC LIMIT ${options.limit ?? 50}`;
  return rows.map((r) => ({ key: r.key, value: num(r.n) })).filter((r) => r.value > 0);
}

// Everything the statistics page shows about sign ins, for the viewer's
// scope and the chosen filters.
export async function connectionOverview(user: User, f: ConnectionFilters, options: { fullIp: boolean }) {
  const scope = connectionScope(user);
  const where = connectionSql(scope, f);
  // Places one level below the viewer: departments for the nation, communes
  // for a department (or a department chosen by a national account).
  const placeColumn = scope.none || scope.departmentId || scope.communeId || f.departmentId ? Prisma.sql`e."communeId"` : Prisma.sql`e."departmentId"`;
  const placeLevel: "department" | "commune" = scope.none || scope.departmentId || scope.communeId || f.departmentId ? "commune" : "department";

  const [totals, perDay, byRole, byPlace, byOutcome, devices, browsers, systems, ips, lockedNow] = await Promise.all([
    db.$queryRaw<{ success: bigint; failed: bigint; users: bigint; first: bigint; demo: bigint }[]>`
      SELECT count(*) FILTER (WHERE e."outcome" = 'SUCCESS') AS success,
             count(*) FILTER (WHERE ${FAILED}) AS failed,
             count(DISTINCT e."userId") FILTER (WHERE e."outcome" = 'SUCCESS') AS users,
             count(*) FILTER (WHERE e."firstTime") AS first,
             count(*) FILTER (WHERE e."demo" AND e."outcome" = 'SUCCESS') AS demo
      FROM "ConnectionEvent" e WHERE ${where}`,
    db.$queryRaw<{ day: string; success: bigint; failed: bigint; users: bigint }[]>`
      SELECT ${DAY} AS day, count(*) FILTER (WHERE e."outcome" = 'SUCCESS') AS success,
             count(*) FILTER (WHERE ${FAILED}) AS failed,
             count(DISTINCT e."userId") FILTER (WHERE e."outcome" = 'SUCCESS') AS users
      FROM "ConnectionEvent" e WHERE ${where} GROUP BY 1 ORDER BY 1`,
    countBy(where, Prisma.sql`e."roleCode"`, { distinctUsers: true, onlySuccess: true }),
    countBy(where, placeColumn, { distinctUsers: true, onlySuccess: true, limit: 100 }),
    countBy(where, Prisma.sql`e."outcome"::text`),
    countBy(where, Prisma.sql`e."device"`, { onlySuccess: true }),
    countBy(where, Prisma.sql`e."browser"`, { onlySuccess: true, limit: 8 }),
    countBy(where, Prisma.sql`e."os"`, { onlySuccess: true, limit: 8 }),
    db.$queryRaw<{ ip: string | null; n: bigint; failed: bigint; users: bigint }[]>`
      SELECT e."ip" AS ip, count(*) AS n, count(*) FILTER (WHERE ${FAILED}) AS failed, count(DISTINCT e."userId") AS users
      FROM "ConnectionEvent" e WHERE ${where} AND e."ip" IS NOT NULL
      GROUP BY 1 ORDER BY 2 DESC LIMIT 200`,
    // Accounts locked right now among those seen in the scope.
    scope.none
      ? Promise.resolve([{ n: BigInt(0) }])
      : db.$queryRaw<{ n: bigint }[]>`
      SELECT count(*) AS n FROM "User" u WHERE u."lockedUntil" > now() AND EXISTS (
        SELECT 1 FROM "ConnectionEvent" e WHERE e."userId" = u."id" AND ${connectionSql(scope, { ...f, days: 90, outcome: null })})`,
  ]);

  const [roles, places] = await Promise.all([
    db.role.findMany({ where: { code: { in: byRole.map((r) => r.key).filter((k): k is string => !!k) } }, select: { code: true, name: true } }),
    placeLevel === "department"
      ? db.department.findMany({ where: { id: { in: byPlace.map((r) => r.key).filter((k): k is string => !!k) } }, select: { id: true, name: true } })
      : db.commune.findMany({ where: { id: { in: byPlace.map((r) => r.key).filter((k): k is string => !!k) } }, select: { id: true, name: true } }),
  ]);
  const roleName = new Map(roles.map((r) => [r.code, r.name]));
  const placeName = new Map(places.map((p) => [p.id, p.name]));

  // Addresses, merged by their truncated form for a viewer without the
  // permission, so two addresses of one network are one line.
  const ipRows = new Map<string, { ip: string; count: number; failed: number; users: number }>();
  for (const r of ips) {
    const shown = options.fullIp ? r.ip! : (truncateIp(r.ip) ?? "–");
    const row = ipRows.get(shown) ?? { ip: shown, count: 0, failed: 0, users: 0 };
    row.count += num(r.n);
    row.failed += num(r.failed);
    row.users += num(r.users);
    ipRows.set(shown, row);
  }

  const days = periodDays(f.days);
  const byDay = new Map(perDay.map((d) => [d.day, d]));
  const t = totals[0];
  return {
    placeLevel,
    totals: { success: num(t?.success), failed: num(t?.failed), users: num(t?.users), firstTime: num(t?.first), demo: num(t?.demo), lockedNow: num(lockedNow[0]?.n) },
    perDay: days.map((day) => ({ day, success: num(byDay.get(day)?.success), failed: num(byDay.get(day)?.failed), users: num(byDay.get(day)?.users) })),
    byRole: byRole.map((r) => ({ key: r.key, label: (r.key && roleName.get(r.key)) ?? "Sans rôle", value: r.value })),
    byPlace: byPlace.map((r) => ({ key: r.key, label: (r.key && placeName.get(r.key)) ?? "Non renseigné", value: r.value })),
    byOutcome,
    devices,
    browsers,
    systems,
    topIps: [...ipRows.values()].sort((a, b) => b.count - a.count).slice(0, 10),
  };
}

const recentSelect = {
  id: true,
  createdAt: true,
  outcome: true,
  roleCode: true,
  departmentId: true,
  communeId: true,
  ip: true,
  browser: true,
  os: true,
  device: true,
  demo: true,
  firstTime: true,
  user: { select: { firstName: true, lastName: true, username: true, role: { select: { name: true } } } },
} as const;

async function withPlaces<T extends { departmentId: string | null; communeId: string | null }>(rows: T[]) {
  const [deps, communes] = await Promise.all([
    db.department.findMany({ where: { id: { in: [...new Set(rows.map((r) => r.departmentId).filter((x): x is string => !!x))] } }, select: { id: true, name: true } }),
    db.commune.findMany({ where: { id: { in: [...new Set(rows.map((r) => r.communeId).filter((x): x is string => !!x))] } }, select: { id: true, name: true } }),
  ]);
  const dep = new Map(deps.map((d) => [d.id, d.name]));
  const com = new Map(communes.map((c) => [c.id, c.name]));
  return rows.map((r) => ({ ...r, department: r.departmentId ? (dep.get(r.departmentId) ?? null) : null, commune: r.communeId ? (com.get(r.communeId) ?? null) : null }));
}

export async function recentConnections(user: User, f: ConnectionFilters, page: { skip: number; take: number }) {
  const where = connectionWhere(connectionScope(user), f);
  const [rows, total] = await Promise.all([
    db.connectionEvent.findMany({ where, select: recentSelect, orderBy: { createdAt: "desc" }, skip: page.skip, take: page.take }),
    db.connectionEvent.count({ where }),
  ]);
  return { rows: await withPlaces(rows), total };
}

export async function exportConnections(user: User, f: ConnectionFilters) {
  const rows = await db.connectionEvent.findMany({ where: connectionWhere(connectionScope(user), f), select: recentSelect, orderBy: { createdAt: "desc" }, take: 10000 });
  return withPlaces(rows);
}

// Roles and departments present in the scope, for the filters.
export async function connectionFilterOptions(user: User) {
  const scope = connectionScope(user);
  const [roles, departments] = await Promise.all([
    db.role.findMany({ select: { code: true, name: true }, orderBy: { name: "asc" } }),
    !scope.none && user.scope.level === "NATIONAL" ? db.department.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }) : Promise.resolve([]),
  ]);
  return { roles, departments };
}

// Page views of the whole platform: the daily counts carry no territory, so
// only national accounts read them.
export async function visitOverview(days: number) {
  const since = periodStart(days);
  const sinceDay = new Date(since.getTime() + 60 * 60 * 1000).toISOString().slice(0, 10);
  const rows = await db.$queryRaw<{ day: string; dimension: string; key: string; n: bigint }[]>`
    SELECT to_char(p."day", 'YYYY-MM-DD') AS day, p."dimension", p."key", p."count"::bigint AS n
    FROM "PageViewDaily" p WHERE p."day" >= ${sinceDay}::date`;
  const sum = (dimension: string) => {
    const m = new Map<string, number>();
    for (const r of rows) if (r.dimension === dimension) m.set(r.key, (m.get(r.key) ?? 0) + num(r.n));
    return [...m].map(([key, value]) => ({ key, value })).sort((a, b) => b.value - a.value);
  };
  const perDay = periodDays(days).map((day) => {
    const of = (key: string) => rows.filter((r) => r.day === day && r.dimension === "audience" && r.key === key).reduce((s, r) => s + num(r.n), 0);
    return { day, public: of("public"), signedIn: of("signed_in") };
  });
  const audience = sum("audience");
  return {
    total: audience.reduce((s, a) => s + a.value, 0),
    perDay,
    audience,
    pages: sum("path").slice(0, 15),
    referrers: sum("referrer").slice(0, 10),
    languages: sum("language"),
    devices: sum("device"),
    roles: sum("role"),
  };
}
