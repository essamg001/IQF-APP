"use client";

import { Badge } from "@/components/ui/badge";
import { ConfirmSubmitButton } from "@/components/ui/confirm-submit-button";
import { removeDecapWeighingAction } from "./actions";
import { WeighingForm } from "./weighing-form";
import { useTranslations } from "@/lib/i18n/locale-context";
import type { DecapWeighing, DecapWeighingType } from "@prisma/client";

const TYPE_COLOR: Record<DecapWeighingType, "blue" | "green" | "slate" | "amber"> = {
  INTAKE: "blue",
  PRODUCT_EXIT: "green",
  CALYX: "slate",
  REJECTED: "amber",
};

export function ShiftSection({
  date,
  shiftType,
  shiftLabel,
  weighings,
  netWeights,
}: {
  date: string;
  shiftType: "DAY" | "NIGHT";
  shiftLabel: string;
  weighings: DecapWeighing[];
  netWeights: Record<string, number | null>;
}) {
  const dict = useTranslations();
  const t = dict.decapWeighing;
  const TYPE_LABEL: Record<DecapWeighingType, string> = {
    INTAKE: t.typeIntake,
    PRODUCT_EXIT: t.typeProductExit,
    CALYX: t.typeCalyx,
    REJECTED: t.typeRejected,
  };

  return (
    <div>
      <h3 className="text-sm font-semibold text-slate-900">{shiftLabel}</h3>

      {weighings.length > 0 && (
        <div className="mt-2 overflow-x-auto">
          <table className="w-full text-start text-sm">
            <thead className="border-b border-slate-200 text-slate-500 text-xs">
              <tr>
                <th className="px-2 py-1 font-medium">{t.weighingTypeLabel}</th>
                <th className="px-2 py-1 font-medium">{t.packHouseLabel}</th>
                <th className="px-2 py-1 font-medium">{t.vehicleNumberLabel}</th>
                <th className="px-2 py-1 font-medium">{t.colNetWeight}</th>
                <th className="px-2 py-1 font-medium">{t.farmSupplierLabel}</th>
                <th className="no-print px-2 py-1 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {weighings.map((w) => (
                <tr key={w.id} className="border-b border-slate-100 last:border-0">
                  <td className="px-2 py-1">
                    <Badge color={TYPE_COLOR[w.weighingType]}>{TYPE_LABEL[w.weighingType]}</Badge>
                  </td>
                  <td className="px-2 py-1 text-slate-600">{w.packHouse ?? "—"}</td>
                  <td className="px-2 py-1 text-slate-600">{w.vehicleNumber ?? "—"}</td>
                  <td className="px-2 py-1 font-medium text-slate-900">
                    {netWeights[w.id] != null ? `${netWeights[w.id]!.toFixed(1)} kg` : "—"}
                  </td>
                  <td className="px-2 py-1 text-slate-600">{w.farmSupplierName ?? "—"}</td>
                  <td className="no-print px-2 py-1">
                    <form action={removeDecapWeighingAction.bind(null, w.id)}>
                      <ConfirmSubmitButton confirmMessage={t.removeConfirm}>{dict.common.remove}</ConfirmSubmitButton>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {weighings.length === 0 && <p className="mt-2 text-sm text-slate-400">{t.noWeighingsYet}</p>}

      <WeighingForm date={date} shiftType={shiftType} />
    </div>
  );
}
