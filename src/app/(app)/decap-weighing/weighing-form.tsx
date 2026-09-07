"use client";

import { useActionState, useRef, useState } from "react";
import { addDecapWeighingAction } from "./actions";
import { Input, Select, FieldGroup } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { useTranslations } from "@/lib/i18n/locale-context";

const WEIGHING_TYPES = ["INTAKE", "PRODUCT_EXIT", "CALYX", "REJECTED"] as const;
const TWO_STAGE_TYPES = new Set(["INTAKE", "PRODUCT_EXIT"]);

export function WeighingForm({ date, shiftType }: { date: string; shiftType: "DAY" | "NIGHT" }) {
  const [state, formAction, pending] = useActionState(addDecapWeighingAction, undefined);
  const formRef = useRef<HTMLFormElement>(null);
  const errorMessage = state && state !== "ok" ? state : undefined;
  const dict = useTranslations();
  const t = dict.decapWeighing;

  const [weighingType, setWeighingType] = useState<(typeof WEIGHING_TYPES)[number]>("PRODUCT_EXIT");
  const isTwoStage = TWO_STAGE_TYPES.has(weighingType);

  const TYPE_LABEL: Record<(typeof WEIGHING_TYPES)[number], string> = {
    INTAKE: t.typeIntake,
    PRODUCT_EXIT: t.typeProductExit,
    CALYX: t.typeCalyx,
    REJECTED: t.typeRejected,
  };

  return (
    <form
      ref={formRef}
      action={async (formData) => {
        await formAction(formData);
        formRef.current?.reset();
        setWeighingType("PRODUCT_EXIT");
      }}
      className="mt-3 space-y-3 border-t border-slate-100 pt-4"
    >
      <input type="hidden" name="date" value={date} />
      <input type="hidden" name="shiftType" value={shiftType} />

      <div className="grid grid-cols-4 gap-3">
        <FieldGroup label={t.weighingTypeLabel}>
          <Select
            name="weighingType"
            value={weighingType}
            onChange={(e) => setWeighingType(e.target.value as (typeof WEIGHING_TYPES)[number])}
            className="px-2 py-1 text-xs"
          >
            {WEIGHING_TYPES.map((wt) => (
              <option key={wt} value={wt}>
                {TYPE_LABEL[wt]}
              </option>
            ))}
          </Select>
        </FieldGroup>
        <FieldGroup label={t.packHouseLabel}>
          <Input name="packHouse" className="px-2 py-1 text-xs" placeholder={t.packHousePlaceholder} />
        </FieldGroup>
        <FieldGroup label={t.serialNumberLabel}>
          <Input name="serialNumber" className="px-2 py-1 text-xs" />
        </FieldGroup>
        <FieldGroup label={t.vehicleNumberLabel}>
          <Input name="vehicleNumber" className="px-2 py-1 text-xs" />
        </FieldGroup>
      </div>

      <div className="grid grid-cols-4 gap-3">
        <FieldGroup label={isTwoStage ? t.firstWeightLabel : t.singleWeightLabel}>
          <Input name="firstWeightKg" type="number" min="0" step="any" className="px-2 py-1 text-xs" />
        </FieldGroup>
        {isTwoStage && (
          <FieldGroup label={t.secondWeightLabel}>
            <Input name="secondWeightKg" type="number" min="0" step="any" className="px-2 py-1 text-xs" />
          </FieldGroup>
        )}
        <FieldGroup label={t.cratesDeductionLabel}>
          <Input name="emptyCratesDeductionKg" type="number" min="0" step="any" className="px-2 py-1 text-xs" />
        </FieldGroup>
        <FieldGroup label={t.recordedByLabel}>
          <Input name="recordedByName" className="px-2 py-1 text-xs" />
        </FieldGroup>
      </div>

      <div className="grid grid-cols-4 gap-3">
        <FieldGroup label={t.farmSupplierLabel}>
          <Input name="farmSupplierName" className="px-2 py-1 text-xs" />
        </FieldGroup>
        <FieldGroup label={t.varietyLabel}>
          <Input name="varietyName" className="px-2 py-1 text-xs" />
        </FieldGroup>
        <FieldGroup label={t.cratesInLabel}>
          <Input name="cratesIn" type="number" min="0" className="px-2 py-1 text-xs" />
        </FieldGroup>
        <FieldGroup label={t.cratesOutLabel}>
          <Input name="cratesOut" type="number" min="0" className="px-2 py-1 text-xs" />
        </FieldGroup>
      </div>

      <div className="flex items-center gap-3">
        <Button type="submit" variant="secondary" disabled={pending} className="px-2 py-1 text-xs">
          {pending ? dict.common.saving : t.addWeighing}
        </Button>
        {errorMessage && <p className="text-xs text-red-600">{errorMessage}</p>}
      </div>
    </form>
  );
}
