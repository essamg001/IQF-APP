"use client";

import { useActionState } from "react";
import { Input, Select, FieldGroup } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useTranslations } from "@/lib/i18n/locale-context";
import type { CropProtectionEntry } from "@prisma/client";

type ActionFn = (prevState: string | undefined, formData: FormData) => Promise<string | undefined>;

export function EntryForm({ planId, entry, action }: { planId: string; entry?: CropProtectionEntry; action: ActionFn }) {
  const [error, formAction, pending] = useActionState(action, undefined);
  const dict = useTranslations().cropProtectionPlan;

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="planId" value={planId} />

      <Card className="space-y-4">
        <h2 className="text-sm font-semibold text-slate-900">{dict.sectionPestThreshold}</h2>
        <div className="grid grid-cols-2 gap-3">
          <FieldGroup label={dict.colTarget}>
            <Input name="targetPestOrDisease" required defaultValue={entry?.targetPestOrDisease} />
          </FieldGroup>
          <FieldGroup label={dict.pestStageLabel}>
            <Input name="pestStage" defaultValue={entry?.pestStage ?? ""} />
          </FieldGroup>
          <FieldGroup label={dict.economicThresholdLabel}>
            <Input name="economicInjuryThreshold" defaultValue={entry?.economicInjuryThreshold ?? ""} />
          </FieldGroup>
          <FieldGroup label={dict.colGrowthStage}>
            <Input name="plantGrowthStage" defaultValue={entry?.plantGrowthStage ?? ""} />
          </FieldGroup>
        </div>
      </Card>

      <Card className="space-y-4">
        <h2 className="text-sm font-semibold text-slate-900">{dict.sectionProductId}</h2>
        <div className="grid grid-cols-2 gap-3">
          <FieldGroup label={dict.colMethod}>
            <Select name="treatmentMethod" defaultValue={entry?.treatmentMethod ?? ""}>
              <option value="">—</option>
              <option value="SPRAYING">{dict.methodSpraying}</option>
              <option value="INJECTION">{dict.methodInjection}</option>
              <option value="DUSTING">{dict.methodDusting}</option>
              <option value="FUMIGATION">{dict.methodFumigation}</option>
              <option value="STERILIZATION">{dict.methodSterilization}</option>
              <option value="DISTRIBUTION_OF_NATURAL_ENEMIES">{dict.methodDistribution}</option>
            </Select>
          </FieldGroup>
          <FieldGroup label={dict.colCategory}>
            <Select name="category" defaultValue={entry?.category ?? ""}>
              <option value="">—</option>
              <option value="BIOLOGICAL">{dict.categoryBiological}</option>
              <option value="CHEMICAL">{dict.categoryChemical}</option>
              <option value="NATURAL_ENEMIES">{dict.categoryNaturalEnemies}</option>
            </Select>
          </FieldGroup>
          <FieldGroup label={dict.formulationLabel}>
            <Input name="formulationCode" defaultValue={entry?.formulationCode ?? ""} />
          </FieldGroup>
          <FieldGroup label={dict.activeIngredientLabel}>
            <Input name="activeIngredient" defaultValue={entry?.activeIngredient ?? ""} />
          </FieldGroup>
          <FieldGroup label={dict.colProduct}>
            <Input name="commercialProductName" required defaultValue={entry?.commercialProductName} />
          </FieldGroup>
          <FieldGroup label={dict.registrationNumberLabel}>
            <Input name="registrationNumber" defaultValue={entry?.registrationNumber ?? ""} />
          </FieldGroup>
          <FieldGroup label={dict.manufacturerLabel}>
            <Input name="manufacturer" defaultValue={entry?.manufacturer ?? ""} />
          </FieldGroup>
          <FieldGroup label={dict.concentrationLabel}>
            <Input name="activeIngredientConcentrationPct" defaultValue={entry?.activeIngredientConcentrationPct ?? ""} />
          </FieldGroup>
        </div>
      </Card>

      <Card className="space-y-4">
        <h2 className="text-sm font-semibold text-slate-900">{dict.sectionDosing}</h2>
        <div className="grid grid-cols-2 gap-3">
          <FieldGroup label={dict.dosePer100LLabel}>
            <Input name="dosePer100L" defaultValue={entry?.dosePer100L ?? ""} />
          </FieldGroup>
          <FieldGroup label={dict.waterVolumeLabel}>
            <Input name="waterVolumePerFeddan" defaultValue={entry?.waterVolumePerFeddan ?? ""} />
          </FieldGroup>
          <FieldGroup label={dict.dosePerFeddanLabel}>
            <Input name="dosePerFeddan" defaultValue={entry?.dosePerFeddan ?? ""} />
          </FieldGroup>
          <FieldGroup label={dict.colWindow}>
            <Input name="applicationTimeWindow" defaultValue={entry?.applicationTimeWindow ?? ""} />
          </FieldGroup>
          <FieldGroup label={dict.maxTreatmentsLabel}>
            <Input name="maxTreatmentsPerSeason" defaultValue={entry?.maxTreatmentsPerSeason ?? ""} />
          </FieldGroup>
        </div>
      </Card>

      <Card className="space-y-4">
        <h2 className="text-sm font-semibold text-slate-900">{dict.sectionSafetyLimits}</h2>
        <div className="grid grid-cols-2 gap-3">
          <FieldGroup label={dict.colPhi}>
            <Input name="proposedPhiDays" defaultValue={entry?.proposedPhiDays ?? ""} />
          </FieldGroup>
          <FieldGroup label={dict.reEntryLabel}>
            <Input name="reEntryPeriodHours" defaultValue={entry?.reEntryPeriodHours ?? ""} />
          </FieldGroup>
          <FieldGroup label={dict.colMrl}>
            <Input name="strictestMrlLimitMgKg" defaultValue={entry?.strictestMrlLimitMgKg ?? ""} />
          </FieldGroup>
          <FieldGroup label={dict.euArfdLabel}>
            <Input name="euArfdMgKg" defaultValue={entry?.euArfdMgKg ?? ""} />
          </FieldGroup>
          <FieldGroup label={dict.fairtradeClassLabel}>
            <Input name="fairtradeHazardClass" defaultValue={entry?.fairtradeHazardClass ?? ""} />
          </FieldGroup>
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" name="isPending" defaultChecked={entry?.isPending} /> {dict.isPendingLabel}
        </label>
        <FieldGroup label={dict.notesLabel}>
          <Input name="notes" defaultValue={entry?.notes ?? ""} />
        </FieldGroup>
      </Card>

      {error && <p className="text-sm text-red-600">{error}</p>}
      <Button type="submit" disabled={pending}>
        {pending ? dict.saving : dict.saveEntry}
      </Button>
    </form>
  );
}
