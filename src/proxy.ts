import { NextResponse, type NextRequest } from "next/server";

// Optimistic check only: a request to the private space without a session
// cookie is sent to the sign in page. The real verification (signature,
// revocation, expiry, permissions) happens on the server for every page and
// action.
export function proxy(request: NextRequest) {
  if (!request.cookies.has("classeo_session")) {
    const url = new URL("/connexion", request.url);
    url.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = { matcher: ["/espace/:path*"] };
