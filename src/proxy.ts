import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import type { Station } from "@prisma/client";

// Users with a Station set are locked to one single-purpose screen and can't
// reach the rest of the app, even by typing a URL directly.
const STATION_HOME: Record<Station, string> = {
  ARRIVAL_INSPECTION: "/arrival-inspection",
  POST_FREEZE_INSPECTION: "/post-freeze-inspection",
  LOAD_OUT: "/logistics",
};

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
    if (!req.nextUrl.pathname.startsWith(home)) {
      return NextResponse.redirect(new URL(home, req.nextUrl));
    }
  }
});

export const config = {
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico).*)"],
};
