"use client";

import { useState } from "react";
import { useActionState } from "react";
import { logTemperatureBatchAction } from "./actions";
import { Input, FieldGroup } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { isTemperatureOutOfLimit, type TemperatureLocation } from "@/lib/dailyReportLocations";
import { cn } from "@/lib/cn";
import { useTranslations } from "@/lib/i18n/locale-context";

// One small box per location so a full round of readings can be typed in
// and logged in a single submit, instead of picking one location at a time
// from a dropdown -- matches how someone actually walks the factory with a
// clipboard and then enters everything at once.
export function LogTemperatureForm({
  factoryId,
  factoryCode,
  locations,
}: {
  factoryId: string;
  factoryCode: string | null;
  locations: TemperatureLocation[];
}) {
  const fullDict = useTranslations();
  const dict = fullDict.dailyReport;
  const [state, formAction, pending] = useActionState(logTemperatureBatchAction, undefined);
  const errorMessage = state && state !== "ok" ? state : undefined;
  const [values, setValues] = useState<Record<string, string>>({});

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="factoryId" value={factoryId} />
      <input type="hidden" name="factoryCode" value={factoryCode ?? ""} />
      <div className="flex flex-wrap items-end gap-3">
        <FieldGroup label={dict.timeDefaultsNowLabel}>
          <Input name="recordedAt" type="datetime-local" className="w-48" />
        </FieldGroup>
        <FieldGroup label={dict.notesOptionalRoundLabel}>
          <Input name="notes" placeholder={dict.notesPlaceholder} className="w-56" />
        </FieldGroup>
        <Button type="submit" variant="secondary" disabled={pending}>
          {pending ? dict.loggingButton : dict.logReadingsButton}
        </Button>
      </div>
      <div className="flex flex-wrap gap-2">
        {locations.map((l) => {
          const raw = values[l.name] ?? "";
          const parsed = raw.trim() === "" ? null : Number(raw);
          const outOfLimit = parsed != null && !Number.isNaN(parsed) && isTemperatureOutOfLimit(parsed, l.limits);
          return (
            <div key={l.name} className="w-24">
              <label className="mb-1 block truncate text-[11px] font-medium text-slate-600" title={l.name}>
                {l.name}
              </label>
              <Input
                name={l.name}
                type="number"
                step="0.1"
                placeholder="°C"
                value={raw}
                onChange={(e) => setValues((v) => ({ ...v, [l.name]: e.target.value }))}
                className={cn(
                  "px-2 py-1.5 text-sm",
                  outOfLimit && "border-red-500 bg-red-50 text-red-600 font-semibold"
                )}
              />
            </div>
          );
        })}
      </div>
      {errorMessage && <p className="text-sm text-red-600">{errorMessage}</p>}
    </form>
  );
}
