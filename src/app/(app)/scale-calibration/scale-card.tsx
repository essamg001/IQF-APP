"use client";

import { useActionState, useRef } from "react";
import { addScaleCalibrationCheckAction } from "./actions";
import { Input, FieldGroup } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { useTranslations } from "@/lib/i18n/locale-context";
import type { WeighingScale, ScaleCalibrationCheck } from "@prisma/client";

export function ScaleCard({
  scale,
  checks,
  month,
  year,
}: {
  scale: WeighingScale;
  checks: ScaleCalibrationCheck[];
  month: number;
  year: number;
}) {
  const [state, formAction, pending] = useActionState(addScaleCalibrationCheckAction, undefined);
  const formRef = useRef<HTMLFormElement>(null);
  const errorMessage = state && state !== "ok" ? state : undefined;
  // Only defaults to today when the page is actually viewing the current
  // month/year -- combining a past/future month selection with today's
  // real day-of-month produced a nonsensical date (e.g. viewing August
  // while it's really September silently defaulted new checks to "Aug 6"),
  // so a non-current month leaves the field blank for a deliberate pick.
  const now = new Date();
  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth() + 1;
  const todayStr = isCurrentMonth ? now.toISOString().slice(0, 10) : undefined;
  const dict = useTranslations();
  const t = dict.scaleCalibration;

  return (
    <Card>
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">
            {t.scaleLabel} #{scale.scaleNumber}
          </h2>
          <p className="text-xs text-slate-500">
            {scale.location && `${scale.location} — `}
            {t.targetWeightLabel}: {scale.targetWeightKg}kg
            {scale.sensitivity && ` — ${t.sensitivityLabel}: ${scale.sensitivity}`}
            {" — "}
            {t.maxErrorLabel}: ±{scale.maxPermissibleErrorG}g
          </p>
        </div>
      </div>

      {checks.length > 0 && (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-start text-xs">
            <thead className="border-b border-slate-200 text-slate-500">
              <tr>
                <th className="px-3 py-1 font-medium">{dict.common.date}</th>
                <th className="px-3 py-1 font-medium">{t.colDeviation}</th>
                <th className="px-3 py-1 font-medium">{dict.common.status}</th>
                <th className="px-3 py-1 font-medium">{t.colVerifiedBy}</th>
                <th className="px-3 py-1 font-medium">{dict.common.notes}</th>
              </tr>
            </thead>
            <tbody>
              {checks.map((c) => {
                const outOfTolerance = Math.abs(c.deviationG) > scale.maxPermissibleErrorG;
                return (
                  <tr key={c.id} className="border-b border-slate-100 last:border-0">
                    <td className="px-3 py-1 whitespace-nowrap">{format(c.date, "dd MMM")}</td>
                    <td className="px-3 py-1">{c.deviationG}g</td>
                    <td className="px-3 py-1">
                      <Badge color={outOfTolerance ? "red" : "green"}>
                        {outOfTolerance ? t.outOfTolerance : t.inTolerance}
                      </Badge>
                    </td>
                    <td className="px-3 py-1">{c.verifiedByName ?? "—"}</td>
                    <td className="px-3 py-1">{c.notes ?? "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {checks.length === 0 && <p className="mt-3 text-sm text-slate-400">{t.noChecksThisMonth}</p>}

      <form
        ref={formRef}
        action={async (formData) => {
          await formAction(formData);
          formRef.current?.reset();
        }}
        className="mt-4 grid grid-cols-4 gap-3 border-t border-slate-100 pt-4"
      >
        <input type="hidden" name="scaleId" value={scale.id} />
        <FieldGroup label={dict.common.date}>
          <Input name="date" type="date" required defaultValue={todayStr} className="px-2 py-1 text-xs" />
        </FieldGroup>
        <FieldGroup label={t.deviationLabel}>
          <Input name="deviationG" type="number" step="0.1" defaultValue={0} className="px-2 py-1 text-xs" />
        </FieldGroup>
        <FieldGroup label={t.verifiedByLabel}>
          <Input name="verifiedByName" className="px-2 py-1 text-xs" />
        </FieldGroup>
        <FieldGroup label={dict.common.notes}>
          <Input name="notes" className="px-2 py-1 text-xs" />
        </FieldGroup>
        <div className="flex items-end">
          <Button type="submit" variant="secondary" disabled={pending} className="px-2 py-1 text-xs">
            {pending ? dict.common.saving : t.logCheck}
          </Button>
        </div>
        {errorMessage && <p className="col-span-4 text-xs text-red-600">{errorMessage}</p>}
      </form>
    </Card>
  );
}
