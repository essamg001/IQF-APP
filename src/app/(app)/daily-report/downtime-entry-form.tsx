"use client";

import { useActionState } from "react";
import { addDowntimeEventAction } from "./actions";
import { Input, Select, FieldGroup } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { useTranslations } from "@/lib/i18n/locale-context";

export function DowntimeEntryForm({ factoryId, date }: { factoryId: string; date: string }) {
  const fullDict = useTranslations();
  const dict = fullDict.dailyReport;
  const [state, formAction, pending] = useActionState(addDowntimeEventAction, undefined);
  const errorMessage = state && state !== "ok" ? state : undefined;

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="factoryId" value={factoryId} />
      <input type="hidden" name="date" value={date} />
      <FieldGroup label={dict.shift}>
        <Select name="shiftType" required className="w-28">
          <option value="DAY">{dict.shift1Short}</option>
          <option value="NIGHT">{dict.shift2Short}</option>
        </Select>
      </FieldGroup>
      <FieldGroup label={dict.fromLabel}>
        <Input name="fromTime" type="time" step="60" required className="w-28" />
      </FieldGroup>
      <FieldGroup label={dict.toLabel}>
        <Input name="toTime" type="time" step="60" required className="w-28" />
      </FieldGroup>
      <FieldGroup label={dict.reasonLabel}>
        <Input name="reason" required placeholder={dict.reasonPlaceholder} className="w-48" />
      </FieldGroup>
      <Button type="submit" variant="secondary" disabled={pending}>
        {pending ? fullDict.common.saving : fullDict.common.add}
      </Button>
      {errorMessage && <p className="w-full text-sm text-red-600">{errorMessage}</p>}
    </form>
  );
}
