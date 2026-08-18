"use client";

import { useActionState, useState } from "react";
import { loginAction } from "./actions";
import { Input, Label } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { LOCALE_COOKIE } from "@/lib/i18n/localeCookie";
import en from "@/lib/i18n/dictionaries/en";
import ar from "@/lib/i18n/dictionaries/ar";
import type { Locale } from "@prisma/client";

function readCookieLocale(): Locale {
  if (typeof document === "undefined") return "EN";
  const match = document.cookie.match(new RegExp(`${LOCALE_COOKIE}=(EN|AR)`));
  return (match?.[1] as Locale) ?? "EN";
}

export default function LoginPage() {
  const [error, formAction, pending] = useActionState(loginAction, undefined);
  const [locale, setLocale] = useState<Locale>(readCookieLocale);
  const dict = locale === "AR" ? ar : en;
  const isArabic = locale === "AR";

  function selectLocale(next: Locale) {
    setLocale(next);
    document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=31536000`;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div dir={isArabic ? "rtl" : "ltr"} className="w-full max-w-sm rounded-lg border border-slate-200 bg-white p-8 shadow-sm">
        <div className="flex items-center justify-end gap-1 text-xs">
          <button
            type="button"
            onClick={() => selectLocale("EN")}
            className={locale === "EN" ? "font-semibold text-emerald-700" : "text-slate-400 hover:text-slate-600"}
          >
            English
          </button>
          <span className="text-slate-300">·</span>
          <button
            type="button"
            onClick={() => selectLocale("AR")}
            className={locale === "AR" ? "font-semibold text-emerald-700" : "text-slate-400 hover:text-slate-600"}
          >
            العربية
          </button>
        </div>

        <h1 className="mt-3 text-lg font-semibold text-slate-900">{dict.login.title}</h1>
        <p className="mt-1 text-sm text-slate-500">{dict.login.subtitle}</p>

        <form action={formAction} className="mt-6 space-y-4">
          <input type="hidden" name="locale" value={locale} />
          <div>
            <Label htmlFor="email">{dict.login.email}</Label>
            <Input id="email" name="email" type="email" required autoComplete="email" />
          </div>
          <div>
            <Label htmlFor="password">{dict.login.password}</Label>
            <Input id="password" name="password" type="password" required autoComplete="current-password" />
          </div>
          {error && <p className="text-sm text-red-600">{error === "INVALID_CREDENTIALS" ? dict.login.invalidCredentials : error}</p>}
          <Button type="submit" disabled={pending} className="w-full">
            {pending ? dict.login.signingIn : dict.login.signIn}
          </Button>
        </form>
      </div>
    </div>
  );
}
