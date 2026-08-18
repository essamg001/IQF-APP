// Split out from resolveLocale.ts so client components (the login page's
// language toggle) can import just the cookie name without pulling in
// next/headers / auth(), which are server-only.
export const LOCALE_COOKIE = "NEXT_LOCALE";
