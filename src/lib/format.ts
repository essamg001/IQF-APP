import type { Format } from "@prisma/client";

export const FORMAT_LABEL: Record<Format, string> = {
  WHOLE: "Whole",
  SLICED: "Sliced",
  DICED: "Diced",
};
