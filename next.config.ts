import type { NextConfig } from "next";

import { baselinePolicy } from "./src/lib/security/csp";

const isDev = process.env.NODE_ENV !== "production";
// HTTPS only headers are sent where TLS is guaranteed (Vercel, or a reverse
// proxy that sets FORCE_HTTPS). A plain HTTP Docker run on a LAN would break
// otherwise.
const httpsOnly = !!process.env.VERCEL || process.env.FORCE_HTTPS === "true";

const analytics = !!process.env.NEXT_PUBLIC_GA_ID;

// Baseline Content Security Policy, enforced on every response. Pages also
// get the strict nonce based policy from src/proxy.ts (lib/security/csp.ts).
const csp = baselinePolicy({ dev: isDev, httpsOnly, analytics });

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  ...(httpsOnly ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" }] : []),
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // The microphone records voice notes; nothing else is used.
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(self), geolocation=(), payment=(), usb=(), serial=(), hid=(), bluetooth=(), midi=(), display-capture=(), browsing-topics=(), accelerometer=(), gyroscope=(), magnetometer=()",
  },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
];

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  experimental: {
    authInterrupts: true,
    // Visited pages are reused from the client cache for a minute, so going
    // back to a page is instant. Every server action refreshes the router,
    // which clears this cache, so users still see their own changes at once.
    staleTimes: { dynamic: 60, static: 300 },
    // Uploaded documents may reach 5 MB (src/lib/files.ts).
    serverActions: { bodySizeLimit: "6mb" },
  },
  // Browsers still ask for /favicon.ico: the PNG icon answers.
  async rewrites() {
    return [{ source: "/favicon.ico", destination: "/icons/icon-192.png" }];
  },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      // Never indexed, whatever a page says (lib/seo.ts).
      ...["/espace/:path*", "/espace", "/api/:path*", "/acces/:path*", "/changer-mot-de-passe"].map((source) => ({
        source,
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      })),
      // The service worker must never be held back by an HTTP cache, or an
      // update would wait for the cache to expire.
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
    ];
  },
};

export default nextConfig;
