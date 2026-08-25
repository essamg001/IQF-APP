"use client";

import { useActionState, useRef } from "react";
import { addBladeIncidentReportAction } from "./actions";
import { Input, FieldGroup } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { useTranslations } from "@/lib/i18n/locale-context";
import type { BladeIncidentReport } from "@prisma/client";

export function IncidentSection({
  factoryId,
  date,
  incidents,
}: {
  factoryId: string;
  date: string;
  incidents: BladeIncidentReport[];
}) {
  const [state, formAction, pending] = useActionState(addBladeIncidentReportAction, undefined);
  const formRef = useRef<HTMLFormElement>(null);
  const errorMessage = state && state !== "ok" ? state : undefined;
  const dict = useTranslations();
  const t = dict.bladeControl;

  return (
    <div>
      <h2 className="text-sm font-semibold text-slate-900">{t.part3Title}</h2>
      <p className="mt-1 text-xs text-slate-500">{t.part3Subtitle}</p>

      {incidents.length > 0 && (
        <ul className="mt-3 divide-y divide-slate-100">
          {incidents.map((i) => (
            <li key={i.id} className="py-2 text-sm">
              <p>
                <span className="font-medium text-slate-900">{format(i.reportedAt, "HH:mm")}</span> —{" "}
                {i.reportedByName}: {i.report}
              </p>
              {i.relatedReference && (
                <p className="text-xs text-slate-500">
                  {t.clientShipmentLabel}: {i.relatedReference}
                </p>
              )}
              {i.correctiveAction && (
                <p className="text-xs text-slate-500">
                  {t.actionTakenLabel}: {i.correctiveAction}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
      {incidents.length === 0 && <p className="mt-3 text-sm text-slate-400">{t.noIncidentsToday}</p>}

      <form
        ref={formRef}
        action={async (formData) => {
          await formAction(formData);
          formRef.current?.reset();
        }}
        className="mt-4 space-y-2 border-t border-slate-100 pt-4"
      >
        <input type="hidden" name="factoryId" value={factoryId} />
        <input type="hidden" name="date" value={date} />
        <div className="grid grid-cols-2 gap-3">
          <FieldGroup label={t.reportedByLabel}>
            <Input name="reportedByName" required className="px-2 py-1 text-xs" />
          </FieldGroup>
          <FieldGroup label={t.clientShipmentAffectedLabel}>
            <Input id="blade-incident-related-reference" name="relatedReference" className="px-2 py-1 text-xs" />
          </FieldGroup>
        </div>
        <FieldGroup label={t.reportLabel}>
          <Input
            id="blade-incident-report"
            name="report"
            required
            placeholder={t.reportPlaceholder}
            className="px-2 py-1 text-xs"
          />
        </FieldGroup>
        <FieldGroup label={t.correctiveActionLabel}>
          <Input name="correctiveAction" className="px-2 py-1 text-xs" />
        </FieldGroup>
        <Button type="submit" variant="secondary" disabled={pending} className="px-2 py-1 text-xs">
          {pending ? dict.common.saving : t.reportIncident}
        </Button>
        {errorMessage && <p className="text-xs text-red-600">{errorMessage}</p>}
      </form>
    </div>
  );
}
