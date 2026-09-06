"use client";

import { useActionState, useRef } from "react";
import { addLightTrapCheckAction } from "./actions";
import { Input, FieldGroup } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { format } from "date-fns";
import { useTranslations } from "@/lib/i18n/locale-context";
import type { LightTrap, LightTrapCheck } from "@prisma/client";

export function LightTrapCard({
  trap,
  checks,
  month,
  year,
}: {
  trap: LightTrap;
  checks: LightTrapCheck[];
  month: number;
  year: number;
}) {
  const [state, formAction, pending] = useActionState(addLightTrapCheckAction, undefined);
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
  const t = dict.pestControl;

  return (
    <Card>
      <h3 className="text-sm font-semibold text-slate-900">
        {t.trapLabel} #{trap.trapNumber}
        {trap.location && <span className="ms-2 text-xs font-normal text-slate-500">{trap.location}</span>}
      </h3>

      {checks.length > 0 && (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-start text-xs">
            <thead className="border-b border-slate-200 text-slate-500">
              <tr>
                <th className="px-3 py-1 font-medium">{dict.common.date}</th>
                <th className="px-3 py-1 font-medium">{t.colFlies}</th>
                <th className="px-3 py-1 font-medium">{t.colBees}</th>
                <th className="px-3 py-1 font-medium">{t.colWasps}</th>
                <th className="px-3 py-1 font-medium">{t.colMoths}</th>
                <th className="px-3 py-1 font-medium">{t.colMosquitoes}</th>
                <th className="px-3 py-1 font-medium">{t.colOther}</th>
                <th className="px-3 py-1 font-medium">{t.colStickyPadChanged}</th>
                <th className="px-3 py-1 font-medium">{t.colCheckedBy}</th>
              </tr>
            </thead>
            <tbody>
              {checks.map((c) => (
                <tr key={c.id} className="border-b border-slate-100 last:border-0">
                  <td className="px-3 py-1 whitespace-nowrap">{format(c.date, "dd MMM")}</td>
                  <td className="px-3 py-1">{c.fliesCount}</td>
                  <td className="px-3 py-1">{c.beesCount}</td>
                  <td className="px-3 py-1">{c.waspsCount}</td>
                  <td className="px-3 py-1">{c.mothsCount}</td>
                  <td className="px-3 py-1">{c.mosquitoesCount}</td>
                  <td className="px-3 py-1">{c.otherCount}</td>
                  <td className="px-3 py-1">{c.stickyPadChanged ? dict.common.yes : dict.common.no}</td>
                  <td className="px-3 py-1">{c.checkedByName ?? "—"}</td>
                </tr>
              ))}
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
        className="mt-4 grid grid-cols-4 gap-3 border-t border-slate-100 pt-4 md:grid-cols-8"
      >
        <input type="hidden" name="trapId" value={trap.id} />
        <FieldGroup label={dict.common.date}>
          <Input name="date" type="date" required defaultValue={todayStr} className="px-2 py-1 text-xs" />
        </FieldGroup>
        <FieldGroup label={t.colFlies}>
          <Input name="fliesCount" type="number" min="0" defaultValue={0} className="px-2 py-1 text-xs" />
        </FieldGroup>
        <FieldGroup label={t.colBees}>
          <Input name="beesCount" type="number" min="0" defaultValue={0} className="px-2 py-1 text-xs" />
        </FieldGroup>
        <FieldGroup label={t.colWasps}>
          <Input name="waspsCount" type="number" min="0" defaultValue={0} className="px-2 py-1 text-xs" />
        </FieldGroup>
        <FieldGroup label={t.colMoths}>
          <Input name="mothsCount" type="number" min="0" defaultValue={0} className="px-2 py-1 text-xs" />
        </FieldGroup>
        <FieldGroup label={t.colMosquitoes}>
          <Input name="mosquitoesCount" type="number" min="0" defaultValue={0} className="px-2 py-1 text-xs" />
        </FieldGroup>
        <FieldGroup label={t.colOther}>
          <Input name="otherCount" type="number" min="0" defaultValue={0} className="px-2 py-1 text-xs" />
        </FieldGroup>
        <FieldGroup label={t.checkedByLabel}>
          <Input name="checkedByName" className="px-2 py-1 text-xs" />
        </FieldGroup>
        <label className="mb-1 flex items-end gap-2 pb-2 text-xs text-slate-700">
          <input type="checkbox" name="stickyPadChanged" /> {t.stickyPadChangedLabel}
        </label>
        <div className="flex items-end">
          <Button type="submit" variant="secondary" disabled={pending} className="px-2 py-1 text-xs">
            {pending ? dict.common.saving : t.logCheck}
          </Button>
        </div>
        {errorMessage && <p className="col-span-4 text-xs text-red-600 md:col-span-8">{errorMessage}</p>}
      </form>
    </Card>
  );
}
