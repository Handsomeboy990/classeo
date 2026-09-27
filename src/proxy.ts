import { NextResponse, type NextRequest } from "next/server";

import { newNonce, strictHeaderName, strictPolicy } from "@/lib/security/csp";

const isDev = process.env.NODE_ENV !== "production";
const httpsOnly = !!process.env.VERCEL || process.env.FORCE_HTTPS === "true";
const analytics = !!process.env.NEXT_PUBLIC_GA_ID;

// Runs before every page (not the API, the build files or the icons):
//
// - the strict Content Security Policy, with a fresh nonce that Next.js puts
//   on its own scripts while rendering (lib/security/csp.ts), report only
//   unless CSP_STRICT=enforce;
// - an optimistic check of the private space: a request without a session
//   cookie is sent to the sign in page. The real verification (signature,
//   revocation, expiry, permissions) happens on the server for every page
//   and action.
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if ((pathname === "/espace" || pathname.startsWith("/espace/")) && !request.cookies.has("classeo_session")) {
    const url = new URL("/connexion", request.url);
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  const nonce = newNonce();
  const policy = strictPolicy({ nonce, dev: isDev, httpsOnly, analytics });
  const header = strictHeaderName(process.env);
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  // Next.js reads the nonce from the policy of the request.
  requestHeaders.set(header, policy);
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set(header, policy);
  return response;
}

export const config = {
  matcher: [
    {
      // Pages only: not the API, the build files, the generated icons, the
      // service worker, the offline page (rendered ahead of time, so it has
      // no nonce) or any file with an extension.
      source: "/((?!api/|_next/|icons/|hors-ligne|sw\\.js|.*\\.[a-z0-9]+$).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
    // The private space, prefetches included, for the session check.
    "/espace/:path*",
  ],
};
