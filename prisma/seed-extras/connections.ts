import type { Prisma, PrismaClient } from "../../src/generated/prisma/client";
import { chainOfCycle } from "../../src/lib/domain/chains";

import type { SeedContext } from "./index";

// Demonstration data of the connection statistics: sixty days of sign ins
// of the demo accounts and a sample of the others, with some failures, and
// the daily page view counters. Deterministic (a fixed pseudo random
// sequence); addresses come from the ranges reserved for documentation
// (RFC 5737), never real ones.

const DAY_MS = 24 * 60 * 60 * 1000;
const DAYS = 60;

function sequence(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

const AGENTS = [
  { browser: "Chrome", os: "Android", device: "mobile", weight: 46 },
  { browser: "Samsung Internet", os: "Android", device: "mobile", weight: 10 },
  { browser: "Opera", os: "Android", device: "mobile", weight: 8 },
  { browser: "Safari", os: "iOS", device: "mobile", weight: 6 },
  { browser: "Chrome", os: "Windows", device: "desktop", weight: 18 },
  { browser: "Edge", os: "Windows", device: "desktop", weight: 5 },
  { browser: "Firefox", os: "Linux", device: "desktop", weight: 3 },
  { browser: "Chrome", os: "Android", device: "tablet", weight: 4 },
] as const;

const NETWORKS = ["192.0.2", "198.51.100", "203.0.113"];

const PUBLIC_PAGES = ["/", "/connexion", "/mot-de-passe-oublie", "/credits", "/verifier"];
const PRIVATE_PAGES = ["/espace", "/espace/suivi", "/espace/notes", "/espace/presences", "/espace/messages", "/espace/contenus", "/espace/eleves", "/espace/statistiques", "/espace/bulletins/[id]/[id]", "/espace/eleves/[id]"];
const REFERRERS = ["(direct)", "google.com", "facebook.com", "gouv.bj", "wa.me"];

function pick<T extends { weight: number }>(items: readonly T[], r: number) {
  const total = items.reduce((s, i) => s + i.weight, 0);
  let x = r * total;
  for (const item of items) if ((x -= item.weight) < 0) return item;
  return items[items.length - 1]!;
}

export async function seedConnections(db: PrismaClient, ctx: SeedContext) {
  const rand = sequence(20260927);
  const users = await db.user.findMany({
    where: { isActive: true },
    orderBy: { username: "asc" },
    select: {
      id: true,
      scopeLevel: true,
      chain: true,
      departmentId: true,
      communeId: true,
      role: { select: { code: true } },
      commune: { select: { departmentId: true } },
      school: { select: { id: true, cycle: true, communeId: true, commune: { select: { departmentId: true } } } },
      guardian: { select: { students: { take: 1, select: { student: { select: { enrollments: { take: 1, select: { school: { select: { id: true, cycle: true, communeId: true, commune: { select: { departmentId: true } } } } } } } } } } } },
    },
  });
  const demo = new Set(Object.values(ctx.ids));
  const now = Date.now();
  const today = now - (now % DAY_MS);
  const events: Prisma.ConnectionEventCreateManyInput[] = [];

  for (const [index, u] of users.entries()) {
    const school = u.school ?? u.guardian?.students[0]?.student.enrollments[0]?.school ?? null;
    const territorial = u.scopeLevel === "NATIONAL" || u.scopeLevel === "DEPARTMENT" || u.scopeLevel === "COMMUNE";
    const scope = {
      userId: u.id,
      roleCode: u.role.code,
      scopeLevel: u.scopeLevel,
      departmentId: territorial ? (u.departmentId ?? u.commune?.departmentId ?? null) : (school?.commune.departmentId ?? null),
      communeId: territorial ? u.communeId : (school?.communeId ?? null),
      schoolId: territorial ? null : (school?.id ?? null),
      chain: territorial ? (u.scopeLevel === "COMMUNE" ? ("PRIMARY" as const) : u.chain) : school ? chainOfCycle(school.cycle) : null,
    };
    // Demo accounts sign in most days, the others now and then.
    const rate = demo.has(u.id) ? 0.7 : 0.18;
    const { browser, os, device } = pick(AGENTS, rand());
    const agent = { browser, os, device };
    const ip = `${NETWORKS[index % NETWORKS.length]}.${1 + (index % 250)}`;
    let first = true;
    for (let d = DAYS; d >= 1; d--) {
      if (rand() > rate) continue;
      const at = new Date(today - d * DAY_MS + (6 + Math.floor(rand() * 14)) * 60 * 60 * 1000 + Math.floor(rand() * 3600) * 1000);
      if (rand() < 0.08) events.push({ ...scope, ...agent, outcome: "WRONG_PASSWORD", ip, createdAt: new Date(at.getTime() - 60_000) });
      events.push({ ...scope, ...agent, outcome: "SUCCESS", ip, firstTime: first, createdAt: at, demo: demo.has(u.id) && rand() < 0.3 });
      first = false;
      if (rand() < 0.4) events.push({ ...scope, ...agent, outcome: "SIGN_OUT", ip, createdAt: new Date(at.getTime() + 25 * 60_000) });
    }
  }
  // Attempts on unknown identifiers from one address: what an intrusion
  // attempt looks like in the table of addresses.
  for (let i = 0; i < 14; i++) events.push({ outcome: "UNKNOWN_ACCOUNT", ip: "203.0.113.66", browser: "Autre", os: "Linux", device: "desktop", createdAt: new Date(today - 3 * DAY_MS + i * 40_000) });

  for (let i = 0; i < events.length; i += 1000) await db.connectionEvent.createMany({ data: events.slice(i, i + 1000) });

  // Daily page views: public pages every day, the signed in space mostly on
  // school days.
  const rows: { day: Date; dimension: string; key: string; count: number }[] = [];
  for (let d = DAYS; d >= 0; d--) {
    const day = new Date(today - d * DAY_MS);
    const weekday = day.getUTCDay();
    const add = (dimension: string, key: string, count: number) => count > 0 && rows.push({ day, dimension, key, count });
    const pub = PUBLIC_PAGES.map((p, i) => ({ p, n: Math.round((40 - i * 7) * (0.6 + rand())) }));
    const priv = PRIVATE_PAGES.map((p, i) => ({ p, n: Math.round((90 - i * 7) * (weekday === 0 ? 0.3 : 0.7 + rand())) }));
    for (const { p, n } of [...pub, ...priv]) add("path", p, n);
    const publicViews = pub.reduce((s, x) => s + x.n, 0);
    const privateViews = priv.reduce((s, x) => s + x.n, 0);
    const total = publicViews + privateViews;
    add("audience", "public", publicViews);
    add("audience", "signed_in", privateViews);
    add("language", "fr", Math.round(total * 0.8));
    add("language", "fon", Math.round(total * 0.14));
    add("language", "yo", total - Math.round(total * 0.8) - Math.round(total * 0.14));
    add("device", "mobile", Math.round(total * 0.68));
    add("device", "desktop", Math.round(total * 0.27));
    add("device", "tablet", total - Math.round(total * 0.68) - Math.round(total * 0.27));
    add("referrer", "(direct)", Math.round(total * 0.7));
    for (const [i, r] of REFERRERS.slice(1).entries()) add("referrer", r, Math.round(total * (0.12 - i * 0.025)));
    add("role", "anonymous", publicViews);
    add("role", "PARENT", Math.round(privateViews * 0.45));
    add("role", "TEACHER", Math.round(privateViews * 0.3));
    add("role", "SCHOOL_DIRECTOR", privateViews - Math.round(privateViews * 0.45) - Math.round(privateViews * 0.3));
  }
  await db.pageViewDaily.createMany({ data: rows, skipDuplicates: true });
  console.log(`connections: ${events.length} connection events, ${rows.length} daily page view counters`);
}
