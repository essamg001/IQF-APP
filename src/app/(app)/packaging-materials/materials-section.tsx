"use client";

import { useActionState, useRef } from "react";
import { addPackagingMaterialAction } from "./actions";
import { Input, FieldGroup } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { useTranslations } from "@/lib/i18n/locale-context";
import type { PackagingMaterial } from "@prisma/client";

export function MaterialsSection({ factoryId, materials }: { factoryId: string; materials: PackagingMaterial[] }) {
  const [state, formAction, pending] = useActionState(addPackagingMaterialAction, undefined);
  const formRef = useRef<HTMLFormElement>(null);
  const errorMessage = state && state !== "ok" ? state : undefined;
  const dict = useTranslations();
  const t = dict.packagingMaterials;

  return (
    <div>
      <h2 className="text-sm font-semibold text-slate-900">{t.materialsSectionTitle}</h2>

      {materials.length > 0 && (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-start text-sm">
            <thead className="border-b border-slate-200 text-slate-500 text-xs">
              <tr>
                <th className="px-3 py-1 font-medium">{t.materialNameLabel}</th>
                <th className="px-3 py-1 font-medium">{t.materialCodeLabel}</th>
                <th className="px-3 py-1 font-medium">{t.materialUnitLabel}</th>
                <th className="px-3 py-1 font-medium">{t.minStockLabel}</th>
                <th className="px-3 py-1 font-medium">{t.consumptionRatioLabel}</th>
              </tr>
            </thead>
            <tbody>
              {materials.map((m) => (
                <tr key={m.id} className="border-b border-slate-100 last:border-0">
                  <td className="px-3 py-1 font-medium text-slate-900">{m.name}</td>
                  <td className="px-3 py-1">{m.code ?? "—"}</td>
                  <td className="px-3 py-1">{m.unit ?? "—"}</td>
                  <td className="px-3 py-1">{m.minStockLevel ?? "—"}</td>
                  <td className="px-3 py-1">{m.consumptionRatioPerTon ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {materials.length === 0 && <p className="mt-3 text-sm text-slate-400">{t.noMaterialsYet}</p>}

      <form
        ref={formRef}
        action={async (formData) => {
          await formAction(formData);
          formRef.current?.reset();
        }}
        className="mt-4 grid grid-cols-5 gap-3 border-t border-slate-100 pt-4"
      >
        <input type="hidden" name="factoryId" value={factoryId} />
        <FieldGroup label={t.materialNameLabel}>
          <Input name="name" required className="px-2 py-1 text-xs" />
        </FieldGroup>
        <FieldGroup label={t.materialCodeLabel}>
          <Input name="code" className="px-2 py-1 text-xs" />
        </FieldGroup>
        <FieldGroup label={t.materialUnitLabel}>
          <Input name="unit" className="px-2 py-1 text-xs" />
        </FieldGroup>
        <FieldGroup label={t.minStockLabel}>
          <Input name="minStockLevel" type="number" min="0" step="any" className="px-2 py-1 text-xs" />
        </FieldGroup>
        <FieldGroup label={t.consumptionRatioLabel}>
          <Input
            name="consumptionRatioPerTon"
            type="number"
            min="0"
            step="any"
            title={t.consumptionRatioHint}
            placeholder={t.consumptionRatioHint}
            className="px-2 py-1 text-xs"
          />
        </FieldGroup>
        <div className="col-span-5 flex items-center gap-3">
          <Button type="submit" variant="secondary" disabled={pending} className="px-2 py-1 text-xs">
            {pending ? dict.common.saving : t.addMaterial}
          </Button>
          {errorMessage && <p className="text-xs text-red-600">{errorMessage}</p>}
        </div>
      </form>
    </div>
  );
}
