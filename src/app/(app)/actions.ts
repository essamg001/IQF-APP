"use server";

import { signOut, auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { LOCALE_COOKIE } from "@/lib/i18n/localeCookie";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import type { Locale } from "@prisma/client";

export async function logoutAction() {
  await signOut({ redirectTo: "/login" });
}

// Every user's own preference -- no requireOwner() gate, unlike the
// isHeadOf*/station flags an admin manages for someone else. Sets the
// cookie so it takes effect on this browser immediately (the JWT session
// only refreshes on next sign-in) and updates the DB so it's the standing
// preference used the next time they log in anywhere.
export async function setLocaleAction(locale: Locale) {
  const session = await auth();
  if (!session?.user) return;

  const cookieStore = await cookies();
  cookieStore.set(LOCALE_COOKIE, locale, { path: "/", maxAge: 31536000 });

  await prisma.user.update({ where: { id: session.user.id }, data: { locale } });
  revalidatePath("/");
}
