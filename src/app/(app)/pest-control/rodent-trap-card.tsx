"use client";

import { useActionState, useRef } from "react";
import { addRodentTrapCheckAction } from "./actions";
import { Input, Select, FieldGroup } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { useTranslations } from "@/lib/i18n/locale-context";
import type { RodentTrap, RodentTrapCheck, RodentTrapStatus } from "@prisma/client";
import type { Dictionary } from "@/lib/i18n/dictionaries/en";

const STATUS_KEYS: { value: RodentTrapStatus; labelKey: keyof Dictionary["pestControl"] }[] = [
  { value: "INTACT", labelKey: "statusIntact" },
  { value: "WET", labelKey: "statusWet" },
  { value: "SPOILED", labelKey: "statusSpoiled" },
  { value: "EATEN_TRACE", labelKey: "statusEatenTrace" },
  { value: "MISSING", labelKey: "statusMissing" },
  { value: "BROKEN", labelKey: "statusBroken" },
  { value: "DISPLACED", labelKey: "statusDisplaced" },
  { value: "LIVE_RODENT", labelKey: "statusLiveRodent" },
  { value: "DEAD_RODENT", labelKey: "statusDeadRodent" },
  { value: "GOOD", labelKey: "statusGood" },
  { value: "NOT_GOOD", labelKey: "statusNotGood" },
  { value: "OTHER", labelKey: "statusOther" },
];

export function RodentTrapCard({
  trap,
  checks,
  month,
  year,
}: {
  trap: RodentTrap;
  checks: RodentTrapCheck[];
  month: number;
  year: number;
}) {
  const [state, formAction, pending] = useActionState(addRodentTrapCheckAction, undefined);
  const formRef = useRef<HTMLFormElement>(null);
  const errorMessage = state && state !== "ok" ? state : undefined;
  const todayStr = `${year}-${String(month).padStart(2, "0")}-${String(new Date().getDate()).padStart(2, "0")}`;
  const dict = useTranslations();
  const t = dict.pestControl;
  const STATUS_LABEL: Record<RodentTrapStatus, string> = Object.fromEntries(
    STATUS_KEYS.map((s) => [s.value, t[s.labelKey]])
  ) as Record<RodentTrapStatus, string>;

  const severeStatus = (s: RodentTrapStatus) => s === "LIVE_RODENT" || s === "DEAD_RODENT";

  return (
    <Card>
      <h3 className="text-sm font-semibold text-slate-900">
        {trap.trapType === "BAIT_STATION" ? t.trapTypeBaitStation : t.trapTypeGlueTrap} #{trap.trapNumber}
        {trap.location && <span className="ms-2 text-xs font-normal text-slate-500">{trap.location}</span>}
      </h3>

      {checks.length > 0 && (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-start text-xs">
            <thead className="border-b border-slate-200 text-slate-500">
              <tr>
                <th className="px-3 py-1 font-medium">{dict.common.date}</th>
                <th className="px-3 py-1 font-medium">{dict.common.status}</th>
                <th className="px-3 py-1 font-medium">{t.checkedByLabel}</th>
                <th className="px-3 py-1 font-medium">{dict.common.notes}</th>
              </tr>
            </thead>
            <tbody>
              {checks.map((c) => (
                <tr key={c.id} className="border-b border-slate-100 last:border-0">
                  <td className="px-3 py-1 whitespace-nowrap">{format(c.date, "dd MMM")}</td>
                  <td className="px-3 py-1">
                    <Badge color={severeStatus(c.status) ? "red" : c.status === "GOOD" || c.status === "INTACT" ? "green" : "amber"}>
                      {STATUS_LABEL[c.status]}
                    </Badge>
                  </td>
                  <td className="px-3 py-1">{c.checkedByName ?? "—"}</td>
                  <td className="px-3 py-1">{c.notes ?? "—"}</td>
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
        className="mt-4 grid grid-cols-4 gap-3 border-t border-slate-100 pt-4"
      >
        <input type="hidden" name="trapId" value={trap.id} />
        <FieldGroup label={dict.common.date}>
          <Input name="date" type="date" required defaultValue={todayStr} className="px-2 py-1 text-xs" />
        </FieldGroup>
        <FieldGroup label={dict.common.status}>
          <Select name="status" defaultValue="INTACT" className="px-2 py-1 text-xs">
            {STATUS_KEYS.map((s) => (
              <option key={s.value} value={s.value}>
                {t[s.labelKey]}
              </option>
            ))}
          </Select>
        </FieldGroup>
        <FieldGroup label={t.checkedByLabel}>
          <Input name="checkedByName" className="px-2 py-1 text-xs" />
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
