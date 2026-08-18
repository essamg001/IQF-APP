"use client";

import { createContext, useContext } from "react";
import type { Locale } from "@prisma/client";
import type { Dictionary } from "./dictionaries/en";

const LocaleContext = createContext<{ locale: Locale; dict: Dictionary } | null>(null);

export function LocaleProvider({
  locale,
  dict,
  children,
}: {
  locale: Locale;
  dict: Dictionary;
  children: React.ReactNode;
}) {
  return <LocaleContext.Provider value={{ locale, dict }}>{children}</LocaleContext.Provider>;
}

export function useTranslations() {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error("useTranslations must be used within a LocaleProvider");
  return ctx.dict;
}

export function useLocale() {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error("useLocale must be used within a LocaleProvider");
  return ctx.locale;
}
