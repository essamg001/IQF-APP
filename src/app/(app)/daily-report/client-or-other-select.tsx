"use client";

import { useState } from "react";
import { Input, Select } from "@/components/ui/field";
import { useTranslations } from "@/lib/i18n/locale-context";

const OTHER = "__other__";

// A client dropdown with a free-text fallback for rows that aren't a real
// sales client (lab/quality samples, etc.) -- submits clientId when a real
// client is picked, clientOther otherwise. Adapted from the SelectWithOther
// pattern in src/components/select-with-other.tsx for an ID-based relation
// rather than an opaque string value.
export function ClientOrOtherSelect({ clients }: { clients: { id: string; name: string }[] }) {
  const [mode, setMode] = useState<string>("");
  const dict = useTranslations().dailyReport;

  return (
    <div className="space-y-1">
      <Select value={mode} onChange={(e) => setMode(e.target.value)} className="w-48">
        <option value="">—</option>
        {clients.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
        <option value={OTHER}>{dict.otherClientOption}</option>
      </Select>
      <input type="hidden" name="clientId" value={mode === OTHER ? "" : mode} />
      {mode === OTHER && <Input name="clientOther" placeholder={dict.otherClientPlaceholder} className="w-48" />}
    </div>
  );
}
