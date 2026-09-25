import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";
// HTTPS only headers are sent where TLS is guaranteed (Vercel, or a reverse
// proxy that sets FORCE_HTTPS). A plain HTTP Docker run on a LAN would break
// otherwise.
const httpsOnly = !!process.env.VERCEL || process.env.FORCE_HTTPS === "true";

// Strict CSP. 'unsafe-inline' on scripts is needed for the pre paint
// preferences script and Next.js inline bootstrap; no third party origin is
// allowed anywhere.
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  // Media and images from https sources: teachers link hosted audio, video
  // and pictures. Scripts, styles and connections stay same origin.
  "img-src 'self' data: blob: https:",
  "font-src 'self'",
  "connect-src 'self'",
  "media-src 'self' data: blob: https:",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  ...(httpsOnly ? ["upgrade-insecure-requests"] : []),
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  ...(httpsOnly ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" }] : []),
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(self), geolocation=(), payment=(), usb=()" },
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
  },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
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
