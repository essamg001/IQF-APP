import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import type { Station } from "@prisma/client";

// Users with a Station set are locked to one single-purpose screen and can't
// reach the rest of the app, even by typing a URL directly.
const STATION_HOME: Record<Station, string> = {
  ARRIVAL_INSPECTION: "/arrival-inspection",
  POST_FREEZE_INSPECTION: "/post-freeze-inspection",
  LOAD_OUT: "/logistics",
  FINAL_PRODUCT_ENTRY: "/final-product-entry",
  LAB: "/lab",
};

// Station users still need to fetch files (e.g. a certificate they just
// uploaded) regardless of which screen they're locked to.
const STATION_LOCK_EXEMPT_PREFIXES = ["/api/files"];

export default auth((req) => {
  const isLoggedIn = !!req.auth;
  const isLoginPage = req.nextUrl.pathname === "/login";

  if (!isLoggedIn && !isLoginPage) {
    return NextResponse.redirect(new URL("/login", req.nextUrl));
  }
  if (isLoggedIn && isLoginPage) {
    return NextResponse.redirect(new URL("/", req.nextUrl));
  }

  const station = req.auth?.user?.station;
  if (isLoggedIn && station) {
    const home = STATION_HOME[station];
    const exempt = STATION_LOCK_EXEMPT_PREFIXES.some((p) => req.nextUrl.pathname.startsWith(p));
    if (!exempt && !req.nextUrl.pathname.startsWith(home)) {
      return NextResponse.redirect(new URL(home, req.nextUrl));
    }
  }
});

export const config = {
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico).*)"],
};
