"use client";

import { useActionState, useRef } from "react";
import { addBladeEquipmentCheckAction, addBladeWashEventAction } from "./actions";
import { Input, FieldGroup } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { useTranslations } from "@/lib/i18n/locale-context";
import type { BladeEquipmentCheck, BladeWashEvent } from "@prisma/client";

type EquipmentCheckWithEvents = BladeEquipmentCheck & { washEvents: BladeWashEvent[] };

export function EquipmentSection({
  factoryId,
  date,
  shiftType,
  equipmentChecks,
}: {
  factoryId: string;
  date: string;
  shiftType: "DAY" | "NIGHT";
  equipmentChecks: EquipmentCheckWithEvents[];
}) {
  const [state, formAction, pending] = useActionState(addBladeEquipmentCheckAction, undefined);
  const formRef = useRef<HTMLFormElement>(null);
  const errorMessage = state && state !== "ok" ? state : undefined;
  const dict = useTranslations();
  const t = dict.bladeControl;

  return (
    <div>
      <h2 className="text-sm font-semibold text-slate-900">{t.part1Title}</h2>
      <p className="mt-1 text-xs text-slate-500">{t.part1Subtitle}</p>

      {equipmentChecks.map((eq) => (
        <div key={eq.id} className="mt-3 rounded-md border border-slate-200 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-sm font-medium text-slate-900">{eq.equipmentName}</p>
              <p className="text-xs text-slate-500">
                {eq.bladeType ?? "—"}
                {eq.replaceableBladeCount != null && ` · ${t.replaceablePieces.replace("{n}", String(eq.replaceableBladeCount))}`}
              </p>
            </div>
            <div className="flex gap-2 text-xs">
              <span className={eq.soundAtInstallation ? "text-emerald-700" : "text-slate-400"}>
                {t.soundAtInstall}: {eq.soundAtInstallation ? dict.common.yes : dict.common.no}
              </span>
              <span className={eq.soundAtEndOfOperation ? "text-emerald-700" : "text-slate-400"}>
                {t.soundAtEnd}: {eq.soundAtEndOfOperation ? dict.common.yes : dict.common.no}
              </span>
            </div>
          </div>
          {eq.notes && <p className="mt-1 text-xs text-slate-500">{eq.notes}</p>}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {eq.washEvents.map((w) => (
              <span key={w.id} className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                {format(w.recordedAt, "HH:mm")}
              </span>
            ))}
            <form action={addBladeWashEventAction.bind(null, eq.id)}>
              <Button type="submit" variant="secondary" className="px-2 py-1 text-xs">
                {t.logWashTime}
              </Button>
            </form>
          </div>
        </div>
      ))}
      {equipmentChecks.length === 0 && <p className="mt-3 text-sm text-slate-400">{t.noEquipmentYet}</p>}

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
        <input type="hidden" name="shiftType" value={shiftType} />
        <div className="grid grid-cols-3 gap-3">
          <FieldGroup label={t.equipmentNameLabel}>
            <Input name="equipmentName" required className="px-2 py-1 text-xs" />
          </FieldGroup>
          <FieldGroup label={t.bladeTypeLabel}>
            <Input name="bladeType" className="px-2 py-1 text-xs" />
          </FieldGroup>
          <FieldGroup label={t.replaceablePieceCountLabel}>
            <Input name="replaceableBladeCount" type="number" min="0" className="px-2 py-1 text-xs" />
          </FieldGroup>
        </div>
        <div className="flex items-center gap-4 text-xs text-slate-700">
          <label className="flex items-center gap-1.5">
            <input type="checkbox" name="soundAtInstallation" /> {t.soundAtInstallationLabel}
          </label>
          <label className="flex items-center gap-1.5">
            <input type="checkbox" name="soundAtEndOfOperation" /> {t.soundAtEndOfOperationLabel}
          </label>
        </div>
        <FieldGroup label={dict.common.notes}>
          <Input name="notes" className="px-2 py-1 text-xs" />
        </FieldGroup>
        <Button type="submit" variant="secondary" disabled={pending} className="px-2 py-1 text-xs">
          {pending ? dict.common.saving : t.addEquipment}
        </Button>
        {errorMessage && <p className="text-xs text-red-600">{errorMessage}</p>}
      </form>
    </div>
  );
}
