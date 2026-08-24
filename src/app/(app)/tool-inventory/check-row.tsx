"use client";

import { useActionState } from "react";
import { checkInToolInventoryAction, checkOutToolInventoryAction } from "./actions";
import { Input, FieldGroup } from "@/components/ui/field";
import { ConfirmSubmitButton } from "@/components/ui/confirm-submit-button";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { useTranslations } from "@/lib/i18n/locale-context";
import type { ToolInventoryItem, ToolInventoryShiftCheck } from "@prisma/client";

export function ToolShiftRow({
  item,
  check,
  factoryId,
  date,
  shiftType,
}: {
  item: ToolInventoryItem;
  check: ToolInventoryShiftCheck | null;
  factoryId: string;
  date: string;
  shiftType: "DAY" | "NIGHT";
}) {
  const checkInAction = checkInToolInventoryAction.bind(null, item.id, factoryId, date, shiftType);
  const [checkInState, checkInFormAction, checkInPending] = useActionState(checkInAction, undefined);
  const checkInError = checkInState && checkInState !== "ok" ? checkInState : undefined;

  const checkOutAction = check ? checkOutToolInventoryAction.bind(null, check.id) : undefined;
  const [checkOutState, checkOutFormAction, checkOutPending] = useActionState(
    checkOutAction ?? (async () => undefined),
    undefined
  );
  const checkOutError = checkOutState && checkOutState !== "ok" ? checkOutState : undefined;

  const dict = useTranslations();
  const t = dict.toolInventory;

  const shortfall = (intact?: number | null, broken?: number | null) =>
    intact != null && broken != null ? intact + broken < item.count : false;

  return (
    <tr className="border-b border-slate-100 last:border-0 align-top">
      <td className="px-4 py-2">
        <p className="font-medium text-slate-900">{item.name}</p>
        <p className="text-xs text-slate-500">{t.registeredCount.replace("{count}", String(item.count))}</p>
      </td>
      <td className="px-4 py-2 text-sm">
        {!check && (
          <form action={checkInFormAction} className="space-y-1">
            <FieldGroup label={t.intactLabel}>
              <Input name="startIntactCount" type="number" min="0" defaultValue={item.count} className="w-20 px-2 py-1 text-xs" />
            </FieldGroup>
            <FieldGroup label={t.brokenLabel}>
              <Input name="startBrokenCount" type="number" min="0" defaultValue={0} className="w-20 px-2 py-1 text-xs" />
            </FieldGroup>
            <ConfirmSubmitButton
              confirmMessage={t.checkInConfirm.replace("{name}", item.name)}
              disabled={checkInPending}
              className="inline-flex items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-900 transition-colors hover:bg-slate-50 disabled:opacity-50"
            >
              {checkInPending ? dict.common.saving : t.checkIn}
            </ConfirmSubmitButton>
            {checkInError && <p className="mt-1 text-xs text-red-600">{checkInError}</p>}
          </form>
        )}
        {check && (
          <div>
            <p className="text-xs text-slate-500">
              {t.inLabel}: {format(check.checkedInAt, "HH:mm")} — {check.checkedInByName}
            </p>
            {check.startIntactCount != null && (
              <p className="mt-1 text-xs text-slate-600">
                {t.intactLabel}: {check.startIntactCount} · {t.brokenLabel}: {check.startBrokenCount ?? 0}
              </p>
            )}
          </div>
        )}
      </td>
      <td className="px-4 py-2 text-sm">
        {check && !check.checkedOutAt && (
          <form action={checkOutFormAction} className="space-y-1">
            <FieldGroup label={t.intactLabel}>
              <Input name="endIntactCount" type="number" min="0" defaultValue={item.count} className="w-20 px-2 py-1 text-xs" />
            </FieldGroup>
            <FieldGroup label={t.brokenLabel}>
              <Input name="endBrokenCount" type="number" min="0" defaultValue={0} className="w-20 px-2 py-1 text-xs" />
            </FieldGroup>
            <FieldGroup label={dict.common.notes}>
              <Input name="notes" className="w-48 px-2 py-1 text-xs" />
            </FieldGroup>
            <ConfirmSubmitButton
              confirmMessage={t.checkOutConfirm.replace("{name}", item.name)}
              disabled={checkOutPending}
              className="inline-flex items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-900 transition-colors hover:bg-slate-50 disabled:opacity-50"
            >
              {checkOutPending ? dict.common.saving : t.checkOut}
            </ConfirmSubmitButton>
            {checkOutError && <p className="text-xs text-red-600">{checkOutError}</p>}
          </form>
        )}
        {check?.checkedOutAt && (
          <div>
            <p className="text-xs text-slate-500">
              {t.outLabel}: {format(check.checkedOutAt, "HH:mm")} — {check.checkedOutByName}
            </p>
            <p className="mt-1 text-xs text-slate-600">
              {t.intactLabel}: {check.endIntactCount ?? "—"} · {t.brokenLabel}: {check.endBrokenCount ?? "—"}
              {shortfall(check.endIntactCount, check.endBrokenCount) && (
                <Badge color="red" className="ms-2">
                  {t.discrepancy}
                </Badge>
              )}
            </p>
            {check.notes && <p className="mt-0.5 text-xs text-slate-400">{check.notes}</p>}
          </div>
        )}
        {!check && <span className="text-xs text-slate-300">—</span>}
      </td>
    </tr>
  );
}
