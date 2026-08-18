import type { Locale } from "@prisma/client";
import en from "./dictionaries/en";
import ar from "./dictionaries/ar";
import type { Dictionary } from "./dictionaries/en";

const dictionaries: Record<Locale, Dictionary> = { EN: en, AR: ar };

export function getDictionary(locale: Locale): Dictionary {
  return dictionaries[locale];
}

export type { Dictionary };
