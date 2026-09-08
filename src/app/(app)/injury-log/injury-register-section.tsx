"use client";

import { useActionState, useRef } from "react";
import { addInjuryRecordAction } from "./actions";
import { Input, Select, FieldGroup } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { useTranslations } from "@/lib/i18n/locale-context";
import type { InjuryRecord } from "@prisma/client";

export function InjuryRegisterSection({
  factoryId,
  records,
  bluePlasterBalances,
  glovesBalances,
  knownNames,
}: {
  factoryId: string;
  records: InjuryRecord[];
  bluePlasterBalances: (number | null)[];
  glovesBalances: (number | null)[];
  knownNames: string[];
}) {
  const [state, formAction, pending] = useActionState(addInjuryRecordAction, undefined);
  const formRef = useRef<HTMLFormElement>(null);
  const errorMessage = state && state !== "ok" ? state : undefined;
  const dict = useTranslations();
  const t = dict.injuryLog;

  return (
    <div>
      <h2 className="text-sm font-semibold text-slate-900">{t.injuriesThisMonth}</h2>

      {records.length > 0 && (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-start text-xs">
            <thead className="border-b border-slate-200 text-slate-500">
              <tr>
                <th className="py-1 pe-3 font-medium">{t.colDate}</th>
                <th className="py-1 pe-3 font-medium">{t.colName}</th>
                <th className="py-1 pe-3 font-medium">{t.colInjury}</th>
                <th className="py-1 pe-3 font-medium">{t.colInOut}</th>
                <th className="py-1 pe-3 font-medium">{t.colSickLeave}</th>
                <th className="py-1 pe-3 font-medium">{t.colInHouseClinic}</th>
                <th className="py-1 pe-3 font-medium">{t.colBluePlasterBal}</th>
                <th className="py-1 pe-3 font-medium">{t.colGlovesBal}</th>
                <th className="py-1 pe-3 font-medium">{t.colEodConfirmed}</th>
              </tr>
            </thead>
            <tbody>
              {records.map((r, i) => (
                <tr key={r.id} className="border-b border-slate-100 last:border-0">
                  <td className="py-1 pe-3 whitespace-nowrap">{format(r.date, "dd MMM")}</td>
                  <td className="py-1 pe-3 font-medium text-slate-900">{r.employeeName}</td>
                  <td className="py-1 pe-3 text-slate-600">{r.injuryDescription}</td>
                  <td className="py-1 pe-3">{r.occurredInWork ? t.inWork : t.outOfWork}</td>
                  <td className="py-1 pe-3">{r.sickLeaveDays ?? "—"}</td>
                  <td className="py-1 pe-3">{r.referredToInHouseClinic ? dict.common.yes : dict.common.no}</td>
                  <td className="py-1 pe-3">{bluePlasterBalances[i] ?? "—"}</td>
                  <td className="py-1 pe-3">{glovesBalances[i] ?? "—"}</td>
                  <td className="py-1 pe-3">{r.endOfDayConfirmed ? dict.common.yes : dict.common.no}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {records.length === 0 && <p className="mt-3 text-sm text-slate-400">{t.noInjuries}</p>}

      <form
        ref={formRef}
        action={async (formData) => {
          await formAction(formData);
          formRef.current?.reset();
        }}
        className="mt-4 space-y-3 border-t border-slate-100 pt-4"
      >
        <input type="hidden" name="factoryId" value={factoryId} />
        <div className="grid grid-cols-3 gap-3">
          <FieldGroup label={dict.common.date}>
            <Input name="date" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} />
          </FieldGroup>
          <FieldGroup label={t.colName}>
            <Input name="employeeName" list="injury-employee-names" required />
            <datalist id="injury-employee-names">
              {knownNames.map((n) => (
                <option key={n} value={n} />
              ))}
            </datalist>
          </FieldGroup>
          <FieldGroup label={t.packingGroupLabel}>
            <Input name="packingGroupNumber" />
          </FieldGroup>
        </div>
        <FieldGroup label={t.injuryLabel}>
          <Input name="injuryDescription" required placeholder={t.injuryPlaceholder} />
        </FieldGroup>
        <div className="grid grid-cols-4 gap-3">
          <FieldGroup label={t.inOutLabel}>
            <Select name="occurredInWork" defaultValue="true">
              <option value="true">{t.inWork}</option>
              <option value="false">{t.outOfWork}</option>
            </Select>
          </FieldGroup>
          <FieldGroup label={t.sickLeaveDaysLabel}>
            <Input name="sickLeaveDays" type="number" min="0" />
          </FieldGroup>
          <FieldGroup label={t.returnToWorkLabel}>
            <Input name="returnToWorkDate" type="date" />
          </FieldGroup>
          <label className="mb-1 flex items-end gap-2 pb-2 text-sm text-slate-700">
            <input type="checkbox" name="referredToInHouseClinic" /> {t.referredToInHouseClinicLabel}
          </label>
        </div>
        <div className="grid grid-cols-4 gap-3">
          <FieldGroup label={t.bluePlasterReleaseTimeLabel}>
            <Input name="bluePlasterReleaseTime" placeholder="e.g. 14:30" />
          </FieldGroup>
          <FieldGroup label={t.bluePlasterItemsReleasedLabel}>
            <Input name="bluePlasterItemsReleased" type="number" min="0" />
          </FieldGroup>
          <FieldGroup label={t.glovesReleaseTimeLabel}>
            <Input name="glovesReleaseTime" placeholder="e.g. 14:30" />
          </FieldGroup>
          <FieldGroup label={t.glovesItemsReleasedLabel}>
            <Input name="glovesItemsReleased" type="number" min="0" />
          </FieldGroup>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <label className="mb-1 flex items-end gap-2 pb-2 text-sm text-slate-700">
            <input type="checkbox" name="endOfDayConfirmed" /> {t.eodConfirmedLabel}
          </label>
          <FieldGroup label={t.confirmationTimeLabel}>
            <Input name="endOfDayConfirmedTime" placeholder="e.g. 19:00" />
          </FieldGroup>
          <FieldGroup label={t.supervisorSignatureLabel}>
            <Input name="firstAidSupervisorSignature" />
          </FieldGroup>
        </div>
        <FieldGroup label={t.correctiveActionLabel}>
          <Input name="correctiveAction" />
        </FieldGroup>
        <Button type="submit" variant="secondary" disabled={pending}>
          {pending ? dict.common.saving : t.addInjury}
        </Button>
        {errorMessage && <p className="text-sm text-red-600">{errorMessage}</p>}
      </form>
    </div>
  );
}
