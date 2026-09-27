// A user agent summarised as browser, system and kind of device, parsed
// without a library: only these three words are stored, never the raw
// string, which can single out a device. Pure, tested in
// connections.test.ts.

export type DeviceKind = "mobile" | "tablet" | "desktop" | "bot" | "unknown";

export type UserAgentSummary = { browser: string; os: string; device: DeviceKind };

export const DEVICE_LABELS: Record<DeviceKind, string> = {
  mobile: "Téléphone",
  tablet: "Tablette",
  desktop: "Ordinateur",
  bot: "Robot",
  unknown: "Inconnu",
};

// Order matters: several browsers announce "Chrome" and "Safari" as well.
const BROWSERS: [RegExp, string][] = [
  [/OPR\/|Opera Mini|OPiOS|Opera/i, "Opera"],
  [/Edg(?:e|A|iOS)?\//i, "Edge"],
  [/SamsungBrowser\//i, "Samsung Internet"],
  [/UCBrowser\/|UCWEB/i, "UC Browser"],
  [/YaBrowser\//i, "Yandex"],
  [/Firefox\/|FxiOS\//i, "Firefox"],
  [/CriOS\/|Chrome\/|Chromium\//i, "Chrome"],
  [/Version\/[\d.]+.*Safari\/|Mobile\/\w+ Safari/i, "Safari"],
];

const SYSTEMS: [RegExp, string][] = [
  [/KAIOS/i, "KaiOS"],
  [/Android/i, "Android"],
  [/iPhone|iPod|iPad|CPU OS \d/i, "iOS"],
  [/CrOS/i, "ChromeOS"],
  [/Windows/i, "Windows"],
  [/Mac OS X|Macintosh/i, "macOS"],
  [/Linux|X11/i, "Linux"],
];

const BOT = /bot\b|crawl|spider|slurp|facebookexternalhit|headless|lighthouse|curl\/|wget\/|python-requests|node-fetch|axios\//i;

export function parseUserAgent(ua: string | null | undefined): UserAgentSummary {
  const s = (ua ?? "").slice(0, 400);
  if (!s.trim()) return { browser: "Inconnu", os: "Inconnu", device: "unknown" };
  const browser = BROWSERS.find(([re]) => re.test(s))?.[1] ?? "Autre";
  const os = SYSTEMS.find(([re]) => re.test(s))?.[1] ?? "Autre";
  let device: DeviceKind;
  if (BOT.test(s)) device = "bot";
  else if (/KAIOS|Opera Mini|Windows Phone/i.test(s)) device = "mobile";
  else if (/iPad|Tablet|PlayBook|Silk\//i.test(s) || (/Android/i.test(s) && !/Mobile/i.test(s))) device = "tablet";
  else if (/Mobi|iPhone|iPod/i.test(s)) device = "mobile";
  else if (os === "Windows" || os === "macOS" || os === "Linux" || os === "ChromeOS") device = "desktop";
  else device = "unknown";
  return { browser, os, device };
}
