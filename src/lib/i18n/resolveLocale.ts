import { cache } from "react";
import { cookies } from "next/headers";
import { auth } from "@/lib/auth";
import type { Locale } from "@prisma/client";
import { LOCALE_COOKIE } from "./localeCookie";

export { LOCALE_COOKIE };

function isLocale(value: string | undefined): value is Locale {
  return value === "EN" || value === "AR";
}

// Cookie wins over the session's stored preference so a change made via the
// sidebar switcher (src/app/(app)/actions.ts's setLocaleAction) takes effect
// immediately on this browser, without waiting on the JWT to refresh (which
// only happens on next sign-in). The DB value (session.user.locale) is the
// standing preference used on a fresh login / a different device where no
// cookie has been set yet.
export const resolveLocale = cache(async (): Promise<Locale> => {
  const cookieStore = await cookies();
  const cookieLocale = cookieStore.get(LOCALE_COOKIE)?.value;
  if (isLocale(cookieLocale)) return cookieLocale;

  const session = await auth();
  return session?.user.locale ?? "EN";
});
