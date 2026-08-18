"use client";

import { useState } from "react";
import { useActionState } from "react";
import { createMetalDetectorCheckAction, updateMetalDetectorMaintenanceAction, reopenMetalDetectorMaintenanceAction } from "./actions";
import { Input, FieldGroup } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ConfirmSubmitButton } from "@/components/ui/confirm-submit-button";
import { HourCoverageGrid } from "./hour-coverage-grid";
import { SHIFT_HOURS, hourSlotDate, toDateTimeLocalValue } from "@/lib/shiftHours";
import { parseLocalDateOnly } from "@/lib/dates";
import { isMetalDetectorMaintenanceLocked } from "@/lib/equipmentVerification";
import type { MetalDetectorCheck, MetalDetectorMaintenanceCheck, ShiftType } from "@prisma/client";
import { useTranslations } from "@/lib/i18n/locale-context";

export function MetalDetectorSection({
  factoryId,
  date,
  shiftType,
  checks,
  maintenanceCheck,
  currentUserLabel,
  now,
}: {
  factoryId: string;
  date: string;
  shiftType: ShiftType;
  checks: MetalDetectorCheck[];
  maintenanceCheck: MetalDetectorMaintenanceCheck | null;
  currentUserLabel: string | null;
  now: Date;
}) {
  const [presetHour, setPresetHour] = useState<number | null>(null);
  const shiftDate = parseLocalDateOnly(date) ?? now;
  const hours = SHIFT_HOURS[shiftType];

  const latestByHour = new Map<number, MetalDetectorCheck>();
  for (const c of checks) latestByHour.set(c.recordedAt.getHours(), c);
  const dict = useTranslations().metalDetector;

  return (
    <div className="rounded-md border border-slate-200 p-3">
      <h5 className="text-xs font-semibold text-slate-700">{dict.title}</h5>

      <MaintenanceChecklist factoryId={factoryId} date={date} shiftType={shiftType} record={maintenanceCheck} />

      <div className="mt-2">
        <HourCoverageGrid
          hours={hours}
          hasCheck={(h) => latestByHour.has(h)}
          elapsed={(h) => hourSlotDate(shiftDate, shiftType, h) <= now}
          onPick={setPresetHour}
        />
      </div>

      {checks.length > 0 && (
        <table className="mt-3 w-full text-start text-[11px]">
          <thead className="border-b border-slate-200 text-slate-500">
            <tr>
              <th className="py-1 pr-2 font-medium">{dict.colTime}</th>
              <th className="py-1 pr-2 font-medium">{dict.colFe}</th>
              <th className="py-1 pr-2 font-medium">{dict.colNonFe}</th>
              <th className="py-1 pr-2 font-medium">{dict.colSs}</th>
              <th className="py-1 pr-2 font-medium">{dict.colReleased}</th>
              <th className="py-1 pr-2 font-medium">{dict.colBy}</th>
            </tr>
          </thead>
          <tbody>
            {checks.map((c) => (
              <tr key={c.id} className="border-b border-slate-100 last:border-0">
                <td className="py-1 pr-2 text-slate-600">
                  {c.recordedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </td>
                <td className="py-1 pr-2">
                  {c.ferrousDetected == null ? "—" : c.ferrousDetected ? "✓" : "✗"}
                  {c.ferrousDiameterMm != null && ` (${c.ferrousDiameterMm}mm)`}
                </td>
                <td className="py-1 pr-2">
                  {c.nonFerrousDetected == null ? "—" : c.nonFerrousDetected ? "✓" : "✗"}
                  {c.nonFerrousDiameterMm != null && ` (${c.nonFerrousDiameterMm}mm)`}
                </td>
                <td className="py-1 pr-2">
                  {c.stainlessDetected == null ? "—" : c.stainlessDetected ? "✓" : "✗"}
                  {c.stainlessDiameterMm != null && ` (${c.stainlessDiameterMm}mm)`}
                </td>
                <td className="py-1 pr-2">
                  {c.productReleased == null ? (
                    "—"
                  ) : c.productReleased ? (
                    <Badge color="green">{dict.released}</Badge>
                  ) : (
                    <Badge color="red">{dict.held}</Badge>
                  )}
                </td>
                <td className="py-1 pr-2 text-slate-500">{c.checkedByName ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <MetalDetectorCheckForm
        factoryId={factoryId}
        date={date}
        shiftType={shiftType}
        currentUserLabel={currentUserLabel}
        presetHour={presetHour}
        shiftDate={shiftDate}
      />
    </div>
  );
}

function MaintenanceChecklist({
  factoryId,
  date,
  shiftType,
  record,
}: {
  factoryId: string;
  date: string;
  shiftType: ShiftType;
  record: MetalDetectorMaintenanceCheck | null;
}) {
  const locked = isMetalDetectorMaintenanceLocked(record);
  const [state, formAction, pending] = useActionState(updateMetalDetectorMaintenanceAction, undefined);
  const errorMessage = state && state !== "ok" ? state : undefined;
  const reopenAction = reopenMetalDetectorMaintenanceAction.bind(null, factoryId, date, shiftType);
  const [reopenState, reopenFormAction, reopenPending] = useActionState(reopenAction, undefined);
  const reopenError = reopenState && reopenState !== "ok" ? reopenState : undefined;
  const dict = useTranslations().metalDetector;

  if (locked && record) {
    const items = [
      [dict.sensitivityThreeSides, record.sensitivityCheckedThreeSides],
      [dict.alarmAudioVisual, record.alarmCheckedAudioVisual],
      [dict.electricalPanel, record.electricalPanelChecked],
      [dict.beltRollersClean, record.beltRollersCleanChecked],
    ] as const;
    return (
      <div className="mt-2 rounded bg-slate-50 p-2 text-[11px] text-slate-600">
        <p className="font-medium text-slate-700">
          {dict.maintenanceChecklistConfirmedBy.replace("{name}", record.checkedByName ?? dict.confirmedFallback)}
        </p>
        <ul className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
          {items.map(([label, ok]) => (
            <li key={label} className={ok ? "text-emerald-700" : "text-red-600"}>
              {ok ? "✓" : "✗"} {label}
            </li>
          ))}
        </ul>
        <form action={reopenFormAction} className="mt-2 flex flex-wrap items-end gap-2 border-t border-slate-200 pt-2">
          <FieldGroup label={dict.reopenReasonLabel}>
            <Input name="reason" required className="w-56 px-1.5 py-1 text-xs" placeholder={dict.reopenReasonPlaceholder} />
          </FieldGroup>
          <ConfirmSubmitButton
            confirmMessage={dict.reopenConfirm}
            disabled={reopenPending}
            className="inline-flex items-center justify-center gap-2 rounded-md bg-amber-600 px-2 py-1 text-[11px] font-medium text-white transition-colors hover:bg-amber-700 disabled:opacity-50 disabled:pointer-events-none"
          >
            {reopenPending ? dict.reopening : dict.reopen}
          </ConfirmSubmitButton>
          {reopenError && <p className="w-full text-[11px] text-red-600">{reopenError}</p>}
        </form>
      </div>
    );
  }

  return (
    <form action={formAction} className="mt-2 space-y-1 rounded bg-slate-50 p-2">
      <input type="hidden" name="factoryId" value={factoryId} />
      <input type="hidden" name="date" value={date} />
      <input type="hidden" name="shiftType" value={shiftType} />
      <p className="text-[11px] font-medium text-slate-600">
        {record ? dict.maintenanceChecklistReopened : dict.maintenanceChecklistOncePerShift}
      </p>
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-700">
        <label className="flex items-center gap-1">
          <input type="checkbox" name="sensitivityCheckedThreeSides" defaultChecked={record?.sensitivityCheckedThreeSides ?? false} /> {dict.sensitivityThreeSides}
        </label>
        <label className="flex items-center gap-1">
          <input type="checkbox" name="alarmCheckedAudioVisual" defaultChecked={record?.alarmCheckedAudioVisual ?? false} /> {dict.alarmAudioVisual}
        </label>
        <label className="flex items-center gap-1">
          <input type="checkbox" name="electricalPanelChecked" defaultChecked={record?.electricalPanelChecked ?? false} /> {dict.electricalPanel}
        </label>
        <label className="flex items-center gap-1">
          <input type="checkbox" name="beltRollersCleanChecked" defaultChecked={record?.beltRollersCleanChecked ?? false} /> {dict.beltRollersClean}
        </label>
      </div>
      <Button type="submit" variant="secondary" disabled={pending} className="px-2 py-1 text-[11px]">
        {pending ? dict.confirming : dict.confirmChecklist}
      </Button>
      {errorMessage && <p className="text-[11px] text-red-600">{errorMessage}</p>}
    </form>
  );
}

function MetalDetectorCheckForm({
  factoryId,
  date,
  shiftType,
  currentUserLabel,
  presetHour,
  shiftDate,
}: {
  factoryId: string;
  date: string;
  shiftType: ShiftType;
  currentUserLabel: string | null;
  presetHour: number | null;
  shiftDate: Date;
}) {
  const [state, formAction, pending] = useActionState(createMetalDetectorCheckAction, undefined);
  const errorMessage = state && state !== "ok" ? state : undefined;
  const defaultRecordedAt = presetHour != null ? toDateTimeLocalValue(hourSlotDate(shiftDate, shiftType, presetHour)) : "";
  const dict = useTranslations().metalDetector;
  const DETECTION_LABELS = {
    ferrousDetected: dict.ferrousDetected,
    nonFerrousDetected: dict.nonFerrousDetected,
    stainlessDetected: dict.stainlessDetected,
  } as const;

  return (
    <form action={formAction} className="mt-2 space-y-2 border-t border-slate-100 pt-2">
      <input type="hidden" name="factoryId" value={factoryId} />
      <input type="hidden" name="date" value={date} />
      <input type="hidden" name="shiftType" value={shiftType} />
      <FieldGroup label={dict.timeDefaultNow}>
        <Input
          key={presetHour ?? "now"}
          name="recordedAt"
          type="datetime-local"
          defaultValue={defaultRecordedAt}
          className="px-1.5 py-1 text-xs"
        />
      </FieldGroup>
      <div className="grid grid-cols-3 gap-1.5">
        {(
          [
            ["ferrousDetected", "ferrousDiameterMm"],
            ["nonFerrousDetected", "nonFerrousDiameterMm"],
            ["stainlessDetected", "stainlessDiameterMm"],
          ] as const
        ).map(([detectedName, diameterName]) => (
          <div key={detectedName} className="space-y-1">
            <label className="flex items-center gap-1 text-[11px] text-slate-700">
              <input type="checkbox" name={detectedName} defaultChecked /> {DETECTION_LABELS[detectedName]}
            </label>
            <Input name={diameterName} type="number" step="0.1" placeholder="mm" className="px-1.5 py-1 text-xs" />
          </div>
        ))}
      </div>
      <div className="flex items-center gap-3">
        <label className="flex items-center gap-1 text-[11px] text-slate-700">
          <input type="checkbox" name="productReleased" defaultChecked /> {dict.productReleased}
        </label>
      </div>
      <FieldGroup label={dict.correctiveActionIfHeld}>
        <Input name="correctiveAction" className="px-1.5 py-1 text-xs" />
      </FieldGroup>
      <Button type="submit" variant="secondary" disabled={pending} className="px-2 py-1 text-[11px]">
        {pending ? dict.logging : dict.logCheck}
      </Button>
      {currentUserLabel && (
        <span className="ms-2 text-[11px] text-slate-400">{dict.asUser.replace("{name}", currentUserLabel)}</span>
      )}
      {errorMessage && <p className="text-[11px] text-red-600">{errorMessage}</p>}
    </form>
  );
}
