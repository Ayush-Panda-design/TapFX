import { NextResponse, type NextRequest } from "next/server";

/**
 * Cheap, optimistic gate: visitors with no session cookie are sent to /login before any dashboard
 * code runs. This is NOT the security boundary: every page and action re-validates the session
 * against the database (requireUser).
 */
export function proxy(req: NextRequest) {
  if (!req.cookies.has("sid")) {
    const url = new URL("/login", req.url);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = { matcher: ["/dashboard/:path*"] };
