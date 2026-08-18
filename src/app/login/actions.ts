"use server";

import { signIn } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AuthError } from "next-auth";
import type { Locale } from "@prisma/client";

export async function loginAction(_prevState: string | undefined, formData: FormData) {
  const email = formData.get("email") as string | undefined;
  const locale = formData.get("locale") as Locale | undefined;

  // Persisted up front, not after signIn() -- a successful signIn() throws
  // Next.js's redirect signal (that's how redirectTo navigates), so nothing
  // placed after a successful call would ever run.
  if (email && (locale === "EN" || locale === "AR")) {
    await prisma.user.updateMany({ where: { email }, data: { locale } });
  }

  try {
    await signIn("credentials", {
      email,
      password: formData.get("password"),
      redirectTo: "/",
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return "INVALID_CREDENTIALS";
    }
    throw error;
  }
}
