"use client";

import { SelectWithOther } from "@/components/select-with-other";
import { CONTAINER_CARRIERS } from "@/lib/carriers";

// A dropdown of major container shipping lines, with a free-text fallback
// for anything unlisted.
export function CarrierInput({ name, defaultValue }: { name: string; defaultValue?: string }) {
  return (
    <SelectWithOther
      name={name}
      defaultValue={defaultValue}
      options={CONTAINER_CARRIERS}
      otherPlaceholder="Type the carrier name"
    />
  );
}
