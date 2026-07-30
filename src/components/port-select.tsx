"use client";

import { useState } from "react";
import { Input, Select } from "@/components/ui/field";
import { EGYPT_COMMERCIAL_PORTS } from "@/lib/ports";

const OTHER = "__other__";

// A dropdown of Egypt's real commercial ports, with a free-text fallback so
// an unlisted port never blocks entry -- used for departure port (always
// Egypt) on both container creation and the later edit form.
export function PortInput({ name, defaultValue }: { name: string; defaultValue?: string }) {
  const isKnownPort = !defaultValue || (EGYPT_COMMERCIAL_PORTS as readonly string[]).includes(defaultValue);
  const [mode, setMode] = useState<string>(defaultValue && !isKnownPort ? OTHER : defaultValue ?? "");

  if (mode === OTHER) {
    return (
      <div className="space-y-1">
        <Select value={OTHER} onChange={(e) => setMode(e.target.value)}>
          <option value="">—</option>
          {EGYPT_COMMERCIAL_PORTS.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
          <option value={OTHER}>Other (type below)</option>
        </Select>
        <Input name={name} defaultValue={isKnownPort ? "" : defaultValue} placeholder="Type the port name" />
      </div>
    );
  }

  return (
    <Select name={name} value={mode} onChange={(e) => setMode(e.target.value)}>
      <option value="">—</option>
      {EGYPT_COMMERCIAL_PORTS.map((p) => (
        <option key={p} value={p}>
          {p}
        </option>
      ))}
      <option value={OTHER}>Other (type below)</option>
    </Select>
  );
}
