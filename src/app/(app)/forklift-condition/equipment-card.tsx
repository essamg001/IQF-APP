"use client";

import { useActionState, useRef } from "react";
import { addForkliftConditionCheckAction } from "./actions";
import { Input, FieldGroup } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { useTranslations } from "@/lib/i18n/locale-context";
import type { ForkliftEquipment, ForkliftConditionCheck } from "@prisma/client";

export function EquipmentCard({
  equipment,
  checks,
  month,
  year,
  typeLabel,
}: {
  equipment: ForkliftEquipment;
  checks: ForkliftConditionCheck[];
  month: number;
  year: number;
  typeLabel: string;
}) {
  const [state, formAction, pending] = useActionState(addForkliftConditionCheckAction, undefined);
  const formRef = useRef<HTMLFormElement>(null);
  const errorMessage = state && state !== "ok" ? state : undefined;
  const todayStr = `${year}-${String(month).padStart(2, "0")}-${String(new Date().getDate()).padStart(2, "0")}`;
  const dict = useTranslations();
  const t = dict.forkliftCondition;

  return (
    <Card>
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">
            {typeLabel} — #{equipment.equipmentNumber}
          </h2>
          <p className="text-xs text-slate-500">
            {t.glassPlasticPieces.replace("{n}", String(equipment.glassPlasticPartsCount ?? "?"))}
            {equipment.glassPlasticPartsDescription && ` — ${equipment.glassPlasticPartsDescription}`}
          </p>
        </div>
      </div>

      {checks.length > 0 && (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-start text-xs">
            <thead className="border-b border-slate-200 text-slate-500">
              <tr>
                <th className="px-3 py-1 font-medium">{t.colDate}</th>
                <th className="px-3 py-1 font-medium">{t.colGlassPlastic}</th>
                <th className="px-3 py-1 font-medium">{t.colMaterials}</th>
                <th className="px-3 py-1 font-medium">{t.colConcentration}</th>
                <th className="px-3 py-1 font-medium">{t.colCleanedBy}</th>
                <th className="px-3 py-1 font-medium">{t.colCheckedBy}</th>
                <th className="px-3 py-1 font-medium">{t.colNotes}</th>
              </tr>
            </thead>
            <tbody>
              {checks.map((c) => (
                <tr key={c.id} className="border-b border-slate-100 last:border-0">
                  <td className="px-3 py-1 whitespace-nowrap">{format(c.date, "dd MMM")}</td>
                  <td className="px-3 py-1">
                    <Badge color={c.glassPlasticIntact ? "green" : "red"}>
                      {c.glassPlasticIntact ? t.intact : t.notIntact}
                    </Badge>
                  </td>
                  <td className="px-3 py-1">{c.cleaningMaterialsUsed ?? "—"}</td>
                  <td className="px-3 py-1">{c.concentrationUsed ?? "—"}</td>
                  <td className="px-3 py-1">{c.cleanedByName ?? "—"}</td>
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
        <input type="hidden" name="equipmentId" value={equipment.id} />
        <FieldGroup label={dict.common.date}>
          <Input name="date" type="date" required defaultValue={todayStr} className="px-2 py-1 text-xs" />
        </FieldGroup>
        <label className="mb-1 flex items-end gap-2 pb-2 text-xs text-slate-700">
          <input type="checkbox" name="glassPlasticIntact" defaultChecked /> {t.glassPlasticIntactLabel}
        </label>
        <FieldGroup label={t.cleaningMaterialsLabel}>
          <Input name="cleaningMaterialsUsed" className="px-2 py-1 text-xs" />
        </FieldGroup>
        <FieldGroup label={t.concentrationLabel}>
          <Input name="concentrationUsed" className="px-2 py-1 text-xs" />
        </FieldGroup>
        <FieldGroup label={t.cleanedByLabel}>
          <Input name="cleanedByName" className="px-2 py-1 text-xs" />
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
