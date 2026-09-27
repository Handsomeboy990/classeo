// IP addresses of the connection statistics. Pure, tested in
// connections.test.ts.
//
// The full address is shown only to the accounts holding
// connection_ip:view and kept 90 days; everyone else, and every row older
// than that, sees the network part only: 196.47.x.x for IPv4, the first
// three groups for IPv6 (a /48, the size of a site).

const IPV4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;

export function truncateIp(ip: string | null | undefined): string | null {
  if (!ip) return null;
  const value = ip.trim();
  // "direct" (no trusted proxy) and "unknown" carry no address.
  if (value === "direct" || value === "unknown") return value;
  // Already truncated.
  if (/^\d{1,3}\.\d{1,3}\.x\.x$/.test(value) || value.endsWith(":x:x:x:x:x")) return value;
  const mapped = value.match(/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i);
  const v4 = (mapped?.[1] ?? value).match(IPV4);
  if (v4) return `${v4[1]}.${v4[2]}.x.x`;
  if (value.includes(":")) {
    const [head] = value.split("::");
    const groups = (head ?? "").split(":").filter(Boolean);
    const kept = [...groups, "0", "0", "0"].slice(0, 3).map((g) => g.toLowerCase());
    return `${kept.join(":")}:x:x:x:x:x`;
  }
  return "x.x.x.x";
}

// Whether an address is already truncated (or carries none).
export function isTruncated(ip: string | null | undefined) {
  return !ip || ip === "direct" || ip === "unknown" || ip.includes("x");
}

// The address shown to a viewer: full with the permission, truncated
// otherwise.
export function displayIp(ip: string | null | undefined, full: boolean) {
  if (!ip) return "–";
  return full ? ip : (truncateIp(ip) ?? "–");
}
