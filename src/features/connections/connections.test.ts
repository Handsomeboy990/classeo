import { describe, expect, it } from "vitest";

import { displayIp, isTruncated, truncateIp } from "./ip";
import { BATCH, purgeExpired, retentionCutoffs, truncationGroups, type RetentionStore } from "./retention";
import { connectionFilters, connectionScope, connectionSql, connectionWhere, periodDays, periodStart } from "./scope";
import { parseUserAgent } from "./user-agent";
import { isPrivatePath, normalisePath, optedOut, referrerHost, visitCounters, visitLanguage } from "./visits";

describe("parseUserAgent", () => {
  it.each([
    ["Mozilla/5.0 (Linux; Android 13; SM-A145F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36", "Chrome", "Android", "mobile"],
    ["Mozilla/5.0 (Linux; Android 12; SAMSUNG SM-A125F) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/24.0 Chrome/117.0.0.0 Mobile Safari/537.36", "Samsung Internet", "Android", "mobile"],
    ["Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1", "Safari", "iOS", "mobile"],
    ["Mozilla/5.0 (iPad; CPU OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/124.0 Mobile/15E148 Safari/604.1", "Chrome", "iOS", "tablet"],
    ["Mozilla/5.0 (Linux; Android 11; Lenovo TB-X606F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36", "Chrome", "Android", "tablet"],
    ["Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 Edg/124.0.0.0", "Edge", "Windows", "desktop"],
    ["Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0", "Firefox", "Windows", "desktop"],
    ["Mozilla/5.0 (Macintosh; Intel Mac OS X 14_4) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15", "Safari", "macOS", "desktop"],
    ["Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36 OPR/109.0", "Opera", "Linux", "desktop"],
    ["Mozilla/5.0 (Mobile; LYF/F300B/LYF-F300B-001-01-15-130718-i;Android; rv:48.0) Gecko/48.0 Firefox/48.0 KAIOS/2.5", "Firefox", "KaiOS", "mobile"],
    ["Opera/9.80 (Android; Opera Mini/36.2.2254/119.132; U; id) Presto/2.12.423 Version/12.16", "Opera", "Android", "mobile"],
    ["Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)", "Autre", "Autre", "bot"],
    ["curl/8.5.0", "Autre", "Autre", "bot"],
  ])("%s", (ua, browser, os, device) => {
    expect(parseUserAgent(ua)).toEqual({ browser, os, device });
  });

  it("handles a missing or empty user agent", () => {
    expect(parseUserAgent(null)).toEqual({ browser: "Inconnu", os: "Inconnu", device: "unknown" });
    expect(parseUserAgent("   ")).toEqual({ browser: "Inconnu", os: "Inconnu", device: "unknown" });
  });
});

describe("truncateIp", () => {
  it("keeps the network part of IPv4 and IPv6 addresses", () => {
    expect(truncateIp("196.47.12.34")).toBe("196.47.x.x");
    expect(truncateIp("::ffff:41.85.160.3")).toBe("41.85.x.x");
    expect(truncateIp("2001:db8:85a3::8a2e:370:7334")).toBe("2001:db8:85a3:x:x:x:x:x");
    expect(truncateIp("2001:DB8::1")).toBe("2001:db8:0:x:x:x:x:x");
    expect(truncateIp("2c0f:f5c0:0441:0002:0000:0000:0000:0001")).toBe("2c0f:f5c0:0441:x:x:x:x:x");
  });

  it("leaves the markers of an unknown address and refuses garbage", () => {
    expect(truncateIp("direct")).toBe("direct");
    expect(truncateIp("unknown")).toBe("unknown");
    expect(truncateIp(null)).toBeNull();
    expect(truncateIp("not an ip")).toBe("x.x.x.x");
  });

  it("is idempotent and says when an address is already truncated", () => {
    expect(truncateIp(truncateIp("196.47.12.34"))).toBe("196.47.x.x");
    expect(isTruncated("196.47.x.x")).toBe(true);
    expect(isTruncated("196.47.12.34")).toBe(false);
    expect(isTruncated("direct")).toBe(true);
  });

  it("shows the full address only with the permission", () => {
    expect(displayIp("196.47.12.34", true)).toBe("196.47.12.34");
    expect(displayIp("196.47.12.34", false)).toBe("196.47.x.x");
    expect(displayIp(null, true)).toBe("–");
  });
});

describe("normalisePath", () => {
  it("replaces identifiers and codes by [id]", () => {
    expect(normalisePath("/espace/eleves/cmfz3k2q80001abcd1234efgh")).toBe("/espace/eleves/[id]");
    expect(normalisePath("/espace/bulletins/cmabc123/cmdef456")).toBe("/espace/bulletins/[id]/[id]");
    expect(normalisePath("/verifier/K7QD4-M2XPH")).toBe("/verifier/[id]");
    expect(normalisePath("/espace/messages/123")).toBe("/espace/messages/[id]");
  });

  it("never keeps the token of the demo page", () => {
    expect(normalisePath("/acces/0123456789abcdef0123456789abcdef0123456789abcdef")).toBe("/acces/[id]");
    expect(normalisePath("/acces/abcdefghijklmnopqrstuvwxyzabcdefghijkl")).toBe("/acces/[id]");
  });

  it("keeps page names and drops the query and the fragment", () => {
    expect(normalisePath("/")).toBe("/");
    expect(normalisePath("/espace/pieces-familles?statut=PENDING#top")).toBe("/espace/pieces-familles");
    expect(normalisePath("/connexion?lang=fon")).toBe("/connexion");
  });

  it("refuses what is not a path of the site and bounds the result", () => {
    expect(normalisePath("https://evil.example/x")).toBeNull();
    expect(normalisePath("//evil.example")).toBeNull();
    expect(normalisePath("")).toBeNull();
    expect(normalisePath(undefined)).toBeNull();
    expect(normalisePath("/%E0%A4%A")).toBe("/[id]");
    expect(normalisePath("/Espace/<script>")).toBe("/[id]/[id]");
    expect(normalisePath(`/${"a/".repeat(50)}`)!.split("/").length).toBe(9);
  });

  it("tells the signed in space from the public pages", () => {
    expect(isPrivatePath("/espace/eleves")).toBe(true);
    expect(isPrivatePath("/espace")).toBe(true);
    expect(isPrivatePath("/connexion")).toBe(false);
  });
});

describe("referrer, language and opt out", () => {
  it("keeps the host only, never Classéo itself", () => {
    expect(referrerHost("https://www.google.com/search?q=classeo+bulletin")).toBe("google.com");
    expect(referrerHost("https://classeo.bj/espace", "classeo.bj")).toBeNull();
    expect(referrerHost("http://127.0.0.1:3000/connexion", "127.0.0.1:3000")).toBeNull();
    expect(referrerHost("javascript:alert(1)")).toBeNull();
    expect(referrerHost("not a url")).toBeNull();
    expect(referrerHost("")).toBeNull();
  });

  it("counts the interface languages and nothing else", () => {
    expect(visitLanguage("fon")).toBe("fon");
    expect(visitLanguage("YO")).toBe("yo");
    expect(visitLanguage("en")).toBe("other");
    expect(visitLanguage(undefined)).toBe("fr");
  });

  it("respects Do Not Track and Global Privacy Control", () => {
    expect(optedOut({ doNotTrack: "1" })).toBe(true);
    expect(optedOut({ globalPrivacyControl: true })).toBe(true);
    expect(optedOut({ doNotTrack: null }, { doNotTrack: "1" })).toBe(true);
    expect(optedOut({ doNotTrack: "0", globalPrivacyControl: false })).toBe(false);
  });

  it("adds one to daily counters, with no account identifier", () => {
    const signedOut = visitCounters({ path: "/", signedIn: false, role: "PARENT", device: "mobile", language: "fon", referrer: null });
    expect(signedOut).toEqual([
      { dimension: "path", key: "/" },
      { dimension: "audience", key: "public" },
      { dimension: "referrer", key: "(direct)" },
      { dimension: "language", key: "fon" },
      { dimension: "device", key: "mobile" },
      { dimension: "role", key: "anonymous" },
    ]);
    const signedIn = visitCounters({ path: "/espace", signedIn: true, role: "PARENT", device: "desktop", language: "fr", referrer: "google.com" });
    expect(signedIn.find((c) => c.dimension === "role")?.key).toBe("PARENT");
  });
});

describe("retention", () => {
  const now = new Date("2026-09-27T10:00:00Z");

  it("computes the cutoffs", () => {
    const c = retentionCutoffs(now);
    expect(c.fullIp.toISOString()).toBe("2026-06-29T10:00:00.000Z");
    expect(c.sessions.toISOString()).toBe("2026-06-29T10:00:00.000Z");
    expect(c.rateLimits.toISOString()).toBe("2026-09-25T10:00:00.000Z");
    expect(c.events.getTime()).toBeLessThan(new Date("2025-09-01").getTime());
  });

  it("groups rows by truncated address and skips the ones without an address", () => {
    const groups = truncationGroups([
      { id: "a", ip: "196.47.12.34" },
      { id: "b", ip: "196.47.99.1" },
      { id: "c", ip: "41.85.1.1" },
      { id: "d", ip: "direct" },
      { id: "e", ip: null },
    ]);
    expect(Object.fromEntries(groups)).toEqual({ "196.47.x.x": ["a", "b"], "41.85.x.x": ["c"] });
  });

  it("truncates old addresses, deletes expired rows and reports it", async () => {
    const events = [
      { id: "e1", ip: "196.47.12.34", truncated: false },
      { id: "e2", ip: "direct", truncated: false },
    ];
    const audit = [{ id: "a1", ip: "41.85.1.1" }];
    const calls: string[] = [];
    const store: RetentionStore = {
      eventsWithFullIp: async (_before, take) => events.filter((e) => !e.truncated).slice(0, take),
      truncateEvents: async (ids, ip) => {
        for (const e of events) if (ids.includes(e.id)) Object.assign(e, { ip, truncated: true });
      },
      markEventsTruncated: async (ids) => {
        for (const e of events) if (ids.includes(e.id)) e.truncated = true;
      },
      auditWithFullIp: async () => audit.filter((a) => !isTruncated(a.ip)),
      truncateAudit: async (ids, ip) => {
        for (const a of audit) if (ids.includes(a.id)) a.ip = ip;
      },
      deleteEvents: async (before) => {
        calls.push(`events<${before.toISOString().slice(0, 10)}`);
        return 3;
      },
      deleteSessions: async () => 2,
      deleteRateLimits: async () => 5,
      deletePageViews: async () => 0,
    };
    const report = await purgeExpired(store, now);
    expect(events).toEqual([
      { id: "e1", ip: "196.47.x.x", truncated: true },
      { id: "e2", ip: "direct", truncated: true },
    ]);
    expect(audit[0]!.ip).toBe("41.85.x.x");
    expect(report).toEqual({ eventsTruncated: 2, auditTruncated: 1, eventsDeleted: 3, sessionsDeleted: 2, rateLimitsDeleted: 5, pageViewsDeleted: 0 });
    expect(calls).toEqual(["events<2025-08-27"]);
  });

  it("works in bounded batches", async () => {
    let reads = 0;
    const full = Array.from({ length: BATCH }, (_, i) => ({ id: `r${i}`, ip: `10.0.${i % 250}.1` }));
    const store: RetentionStore = {
      eventsWithFullIp: async () => {
        reads++;
        return full;
      },
      truncateEvents: async () => undefined,
      markEventsTruncated: async () => undefined,
      auditWithFullIp: async () => [],
      truncateAudit: async () => undefined,
      deleteEvents: async () => 0,
      deleteSessions: async () => 0,
      deleteRateLimits: async () => 0,
      deletePageViews: async () => 0,
    };
    await purgeExpired(store, now);
    expect(reads).toBe(20);
  });
});

describe("connection scope", () => {
  const viewer = (level: "NATIONAL" | "DEPARTMENT" | "COMMUNE" | "SCHOOL" | "SELF", extra: Partial<{ departmentId: string; communeId: string; schoolId: string; chain: "PRIMARY" | "SECONDARY" }> = {}) => ({
    scope: { level, departmentId: extra.departmentId ?? null, communeId: extra.communeId ?? null, schoolId: extra.schoolId ?? null, chain: extra.chain ?? null },
  });

  it("limits each level to its territory and chain, and fails closed", () => {
    expect(connectionScope(viewer("NATIONAL"))).toEqual({ none: false, chain: undefined });
    expect(connectionScope(viewer("NATIONAL", { chain: "PRIMARY" }))).toEqual({ none: false, chain: "PRIMARY" });
    expect(connectionScope(viewer("DEPARTMENT", { departmentId: "dep1", chain: "SECONDARY" }))).toEqual({ none: false, departmentId: "dep1", chain: "SECONDARY" });
    expect(connectionScope(viewer("DEPARTMENT"))).toEqual({ none: true });
    expect(connectionScope(viewer("COMMUNE", { communeId: "c1" }))).toEqual({ none: false, communeId: "c1", chain: "PRIMARY" });
    expect(connectionScope(viewer("SELF"))).toEqual({ none: true });
  });

  it("reads the filters, and lets only a national account choose a department", () => {
    const sp = { periode: "90", role: "PARENT", departement: "cmdep00000001", resultat: "LOCKED" };
    expect(connectionFilters(sp, "NATIONAL")).toEqual({ days: 90, role: "PARENT", departmentId: "cmdep00000001", outcome: "LOCKED" });
    expect(connectionFilters(sp, "DEPARTMENT").departmentId).toBeNull();
    expect(connectionFilters({ periode: "12", role: "x'; DROP", resultat: "HACK" }, "NATIONAL")).toEqual({ days: 30, role: null, departmentId: null, outcome: null });
  });

  it("keeps a departmental viewer in its department whatever the filters say", () => {
    const scope = connectionScope(viewer("DEPARTMENT", { departmentId: "dep1", chain: "PRIMARY" }));
    const where = connectionWhere(scope, { days: 7, role: null, departmentId: "other", outcome: null }, new Date("2026-09-27T10:00:00Z"));
    expect(where).toMatchObject({ departmentId: "dep1", chain: "PRIMARY" });
    expect(connectionWhere({ none: true }, { days: 7, role: null, departmentId: null, outcome: null })).toEqual({ id: "__none__" });
    const sql = connectionSql(scope, { days: 7, role: "PARENT", departmentId: null, outcome: null });
    expect(sql.sql).toContain('e."departmentId" = ?');
    expect(sql.values).toContain("dep1");
    expect(sql.values).toContain("PARENT");
  });

  it("counts days in Benin time", () => {
    const now = new Date("2026-09-27T23:30:00Z"); // 00:30 on the 28th in Cotonou
    expect(periodStart(1, now).toISOString()).toBe("2026-09-27T23:00:00.000Z");
    expect(periodDays(3, now)).toEqual(["2026-09-26", "2026-09-27", "2026-09-28"]);
  });
});
