"use client";

import { useState, useEffect, type FormEvent } from "react";
import { useActionState } from "react";
import { createMetalDetectorCheckAction, updateMetalDetectorMaintenanceAction, reopenMetalDetectorMaintenanceAction } from "./actions";
import { Input, Select, FieldGroup } from "@/components/ui/field";
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
              <th className="py-1 pr-2 font-medium">{dict.colEquipment}</th>
              <th className="py-1 pr-2 font-medium">{dict.colTraceability}</th>
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
                    <Badge color="slate">{dict.notApplicable}</Badge>
                  ) : c.productReleased ? (
                    <Badge color="green">{dict.released}</Badge>
                  ) : (
                    <Badge color="red">{dict.held}</Badge>
                  )}
                </td>
                <td className="py-1 pr-2 text-slate-500">{c.equipmentNumber ?? "—"}</td>
                <td className="py-1 pr-2 text-slate-500">{c.traceabilityCode ?? "—"}</td>
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

const RELEASE_STATUS = ["RELEASED", "HELD", "NOT_APPLICABLE"] as const;
type ReleaseStatus = (typeof RELEASE_STATUS)[number];

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

  // Every field here is controlled (rather than defaultValue/defaultChecked)
  // so a validation error -- e.g. submitting "Held" with no corrective
  // action -- doesn't wipe the mm readings the person already typed. Only
  // presetHour (clicking an hour shortcut) should reset recordedAt; nothing
  // else should ever silently clear this form.
  const [recordedAt, setRecordedAt] = useState(defaultRecordedAt);
  useEffect(() => setRecordedAt(defaultRecordedAt), [defaultRecordedAt]);
  const [equipmentNumber, setEquipmentNumber] = useState("");
  const [traceabilityCode, setTraceabilityCode] = useState("");
  const [ferrousDetected, setFerrousDetected] = useState(true);
  const [ferrousDiameterMm, setFerrousDiameterMm] = useState("");
  const [nonFerrousDetected, setNonFerrousDetected] = useState(true);
  const [nonFerrousDiameterMm, setNonFerrousDiameterMm] = useState("");
  const [stainlessDetected, setStainlessDetected] = useState(true);
  const [stainlessDiameterMm, setStainlessDiameterMm] = useState("");
  const [releaseStatus, setReleaseStatus] = useState<ReleaseStatus>("RELEASED");
  const [correctiveAction, setCorrectiveAction] = useState("");
  const [clientError, setClientError] = useState<string | null>(null);

  // Checked before the server action ever fires, not just as a duplicate of
  // it -- some browsers reset a native <select>'s displayed value as part of
  // a form submission round trip, even one this component intercepts and
  // re-renders as controlled. Catching this client-side means "Held" never
  // has to survive that round trip at all for the one validation rule that
  // doesn't need the server.
  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    if (releaseStatus === "HELD" && !correctiveAction.trim()) {
      e.preventDefault();
      setClientError(dict.correctiveActionRequiredError);
      return;
    }
    setClientError(null);
  }

  const DETECTED = {
    ferrousDetected: [ferrousDetected, setFerrousDetected] as const,
    nonFerrousDetected: [nonFerrousDetected, setNonFerrousDetected] as const,
    stainlessDetected: [stainlessDetected, setStainlessDetected] as const,
  };
  const DIAMETER = {
    ferrousDiameterMm: [ferrousDiameterMm, setFerrousDiameterMm] as const,
    nonFerrousDiameterMm: [nonFerrousDiameterMm, setNonFerrousDiameterMm] as const,
    stainlessDiameterMm: [stainlessDiameterMm, setStainlessDiameterMm] as const,
  };

  return (
    <form action={formAction} onSubmit={handleSubmit} className="mt-2 space-y-2 border-t border-slate-100 pt-2">
      <input type="hidden" name="factoryId" value={factoryId} />
      <input type="hidden" name="date" value={date} />
      <input type="hidden" name="shiftType" value={shiftType} />
      <div className="grid grid-cols-3 gap-1.5">
        <FieldGroup label={dict.timeDefaultNow}>
          <Input
            name="recordedAt"
            type="datetime-local"
            value={recordedAt}
            onChange={(e) => setRecordedAt(e.target.value)}
            className="px-1.5 py-1 text-xs"
          />
        </FieldGroup>
        <FieldGroup label={dict.equipmentNumberLabel}>
          <Input
            name="equipmentNumber"
            value={equipmentNumber}
            onChange={(e) => setEquipmentNumber(e.target.value)}
            className="px-1.5 py-1 text-xs"
          />
        </FieldGroup>
        <FieldGroup label={dict.traceabilityCodeLabel}>
          <Input
            name="traceabilityCode"
            value={traceabilityCode}
            onChange={(e) => setTraceabilityCode(e.target.value)}
            className="px-1.5 py-1 text-xs"
          />
        </FieldGroup>
      </div>
      <div className="grid grid-cols-3 gap-1.5">
        {(
          [
            ["ferrousDetected", "ferrousDiameterMm"],
            ["nonFerrousDetected", "nonFerrousDiameterMm"],
            ["stainlessDetected", "stainlessDiameterMm"],
          ] as const
        ).map(([detectedName, diameterName]) => {
          const [detected, setDetected] = DETECTED[detectedName];
          const [diameter, setDiameter] = DIAMETER[diameterName];
          return (
            <div key={detectedName} className="space-y-1">
              <label className="flex items-center gap-1 text-[11px] text-slate-700">
                <input
                  type="checkbox"
                  name={detectedName}
                  checked={detected}
                  onChange={(e) => setDetected(e.target.checked)}
                />{" "}
                {DETECTION_LABELS[detectedName]}
              </label>
              <Input
                name={diameterName}
                type="number"
                step="0.1"
                placeholder="mm"
                value={diameter}
                onChange={(e) => setDiameter(e.target.value)}
                className="px-1.5 py-1 text-xs"
              />
            </div>
          );
        })}
      </div>
      <FieldGroup label={dict.releaseStatusLabel}>
        <Select
          name="productReleased"
          value={releaseStatus}
          onChange={(e) => setReleaseStatus(e.target.value as ReleaseStatus)}
          className="px-1.5 py-1 text-xs"
        >
          <option value="RELEASED">{dict.releaseStatusReleased}</option>
          <option value="HELD">{dict.releaseStatusHeld}</option>
          <option value="NOT_APPLICABLE">{dict.releaseStatusNotApplicable}</option>
        </Select>
      </FieldGroup>
      <FieldGroup label={dict.correctiveActionIfHeld}>
        <Input
          name="correctiveAction"
          value={correctiveAction}
          onChange={(e) => setCorrectiveAction(e.target.value)}
          className="px-1.5 py-1 text-xs"
        />
      </FieldGroup>
      <Button type="submit" variant="secondary" disabled={pending} className="px-2 py-1 text-[11px]">
        {pending ? dict.logging : dict.logCheck}
      </Button>
      {currentUserLabel && (
        <span className="ms-2 text-[11px] text-slate-400">{dict.asUser.replace("{name}", currentUserLabel)}</span>
      )}
      {(clientError || errorMessage) && <p className="text-[11px] text-red-600">{clientError ?? errorMessage}</p>}
    </form>
  );
}
