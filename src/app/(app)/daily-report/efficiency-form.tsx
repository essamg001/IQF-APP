"use client";

import { useActionState } from "react";
import { updateLineEfficiencyAction } from "./actions";
import { Input, FieldGroup } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { useTranslations } from "@/lib/i18n/locale-context";

function toTimeInput(d: Date | null) {
  if (!d) return "";
  return d.toTimeString().slice(0, 5);
}

export function EfficiencyForm({
  factoryId,
  date,
  shiftType,
  efficiency,
}: {
  factoryId: string;
  date: string;
  shiftType: "DAY" | "NIGHT";
  efficiency: {
    uptimeFrom: Date | null;
    uptimeTo: Date | null;
    lineCapacityTonPerHour: number | null;
    expectedQuantityTon: number | null;
    actualQuantityTon: number | null;
  } | null;
}) {
  const [state, formAction, pending] = useActionState(updateLineEfficiencyAction, undefined);
  const errorMessage = state && state !== "ok" ? state : undefined;
  const fullDict = useTranslations();
  const dict = fullDict.dailyReport;

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="factoryId" value={factoryId} />
      <input type="hidden" name="date" value={date} />
      <input type="hidden" name="shiftType" value={shiftType} />
      <FieldGroup label={dict.uptimeFromLabel}>
        <Input name="uptimeFrom" type="time" defaultValue={toTimeInput(efficiency?.uptimeFrom ?? null)} className="w-28" />
      </FieldGroup>
      <FieldGroup label={dict.uptimeToLabel}>
        <Input name="uptimeTo" type="time" defaultValue={toTimeInput(efficiency?.uptimeTo ?? null)} className="w-28" />
      </FieldGroup>
      <FieldGroup label={dict.lineCapacityLabel}>
        <Input
          name="lineCapacityTonPerHour"
          type="number"
          step="0.1"
          defaultValue={efficiency?.lineCapacityTonPerHour ?? ""}
          className="w-24"
        />
      </FieldGroup>
      <FieldGroup label={dict.expectedQtyLabel}>
        <Input
          name="expectedQuantityTon"
          type="number"
          step="0.1"
          defaultValue={efficiency?.expectedQuantityTon ?? ""}
          className="w-24"
        />
      </FieldGroup>
      <FieldGroup label={dict.actualQtyLabel}>
        <Input
          name="actualQuantityTon"
          type="number"
          step="0.1"
          defaultValue={efficiency?.actualQuantityTon ?? ""}
          className="w-24"
        />
      </FieldGroup>
      <Button type="submit" variant="secondary" disabled={pending}>
        {pending ? fullDict.common.saving : fullDict.common.save}
      </Button>
      {errorMessage && <p className="w-full text-sm text-red-600">{errorMessage}</p>}
    </form>
  );
}
