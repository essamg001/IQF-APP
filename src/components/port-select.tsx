"use client";

import { SelectWithOther } from "@/components/select-with-other";
import { EGYPT_COMMERCIAL_PORTS } from "@/lib/ports";

// A dropdown of Egypt's real commercial ports, with a free-text fallback so
// an unlisted port never blocks entry -- used for departure port (always
// Egypt) on both container creation and the later edit form.
export function PortInput({ name, defaultValue }: { name: string; defaultValue?: string }) {
  return (
    <SelectWithOther
      name={name}
      defaultValue={defaultValue}
      options={EGYPT_COMMERCIAL_PORTS}
      otherPlaceholder="Type the port name"
    />
  );
}
