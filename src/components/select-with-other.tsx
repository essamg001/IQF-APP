"use client";

import { useState } from "react";
import { Input, Select } from "@/components/ui/field";

const OTHER = "__other__";

// A dropdown of known options with a free-text fallback, so a value not on
// the list never blocks entry -- shared by PortInput and CarrierInput.
export function SelectWithOther({
  name,
  defaultValue,
  options,
  otherPlaceholder,
}: {
  name: string;
  defaultValue?: string;
  options: readonly string[];
  otherPlaceholder?: string;
}) {
  // Case/whitespace-insensitive so real historical data ("MAERSK", "Maersk ")
  // still matches its canonical option instead of always falling to Other;
  // matched mode is set to the canonical spelling, which quietly normalizes
  // it the next time this record is saved.
  const normalizedMatch = defaultValue
    ? options.find((o) => o.trim().toLowerCase() === defaultValue.trim().toLowerCase())
    : undefined;
  const isKnown = !defaultValue || !!normalizedMatch;
  const [mode, setMode] = useState<string>(defaultValue && !isKnown ? OTHER : normalizedMatch ?? defaultValue ?? "");

  if (mode === OTHER) {
    return (
      <div className="space-y-1">
        <Select value={OTHER} onChange={(e) => setMode(e.target.value)}>
          <option value="">—</option>
          {options.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
          <option value={OTHER}>Other (type below)</option>
        </Select>
        <Input name={name} defaultValue={isKnown ? "" : defaultValue} placeholder={otherPlaceholder ?? "Type here"} />
      </div>
    );
  }

  return (
    <Select name={name} value={mode} onChange={(e) => setMode(e.target.value)}>
      <option value="">—</option>
      {options.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
      <option value={OTHER}>Other (type below)</option>
    </Select>
  );
}
