"use client";

import { useActionState } from "react";
import { createMetalDetectorCheckAction, updateMetalDetectorMaintenanceAction } from "./actions";
import { Input, FieldGroup } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { MetalDetectorCheck, MetalDetectorMaintenanceCheck, ShiftType } from "@prisma/client";

export function MetalDetectorSection({
  factoryId,
  date,
  shiftType,
  checks,
  maintenanceCheck,
  currentUserLabel,
}: {
  factoryId: string;
  date: string;
  shiftType: ShiftType;
  checks: MetalDetectorCheck[];
  maintenanceCheck: MetalDetectorMaintenanceCheck | null;
  currentUserLabel: string | null;
}) {
  return (
    <div className="rounded-md border border-slate-200 p-3">
      <h5 className="text-xs font-semibold text-slate-700">Metal Detector — CAL03607</h5>

      <MaintenanceChecklist factoryId={factoryId} date={date} shiftType={shiftType} record={maintenanceCheck} />

      {checks.length > 0 && (
        <table className="mt-3 w-full text-left text-[11px]">
          <thead className="border-b border-slate-200 text-slate-500">
            <tr>
              <th className="py-1 pr-2 font-medium">Time</th>
              <th className="py-1 pr-2 font-medium">Fe</th>
              <th className="py-1 pr-2 font-medium">Non-Fe</th>
              <th className="py-1 pr-2 font-medium">SS</th>
              <th className="py-1 pr-2 font-medium">Released</th>
              <th className="py-1 pr-2 font-medium">By</th>
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
                    <Badge color="green">Released</Badge>
                  ) : (
                    <Badge color="red">Held</Badge>
                  )}
                </td>
                <td className="py-1 pr-2 text-slate-500">{c.checkedByName ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <MetalDetectorCheckForm factoryId={factoryId} date={date} shiftType={shiftType} currentUserLabel={currentUserLabel} />
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
  if (record) {
    const items = [
      ["Sensitivity checked (3 sides)", record.sensitivityCheckedThreeSides],
      ["Alarm checked (audio/visual)", record.alarmCheckedAudioVisual],
      ["Electrical panel checked", record.electricalPanelChecked],
      ["Belt/rollers clean", record.beltRollersCleanChecked],
    ] as const;
    return (
      <div className="mt-2 rounded bg-slate-50 p-2 text-[11px] text-slate-600">
        <p className="font-medium text-slate-700">
          Shift maintenance checklist — {record.checkedByName ?? "confirmed"}
        </p>
        <ul className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
          {items.map(([label, ok]) => (
            <li key={label} className={ok ? "text-emerald-700" : "text-red-600"}>
              {ok ? "✓" : "✗"} {label}
            </li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <form action={updateMetalDetectorMaintenanceAction} className="mt-2 space-y-1 rounded bg-slate-50 p-2">
      <input type="hidden" name="factoryId" value={factoryId} />
      <input type="hidden" name="date" value={date} />
      <input type="hidden" name="shiftType" value={shiftType} />
      <p className="text-[11px] font-medium text-slate-600">Shift maintenance checklist (once per shift)</p>
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-700">
        <label className="flex items-center gap-1">
          <input type="checkbox" name="sensitivityCheckedThreeSides" /> Sensitivity (3 sides)
        </label>
        <label className="flex items-center gap-1">
          <input type="checkbox" name="alarmCheckedAudioVisual" /> Alarm audio/visual
        </label>
        <label className="flex items-center gap-1">
          <input type="checkbox" name="electricalPanelChecked" /> Electrical panel
        </label>
        <label className="flex items-center gap-1">
          <input type="checkbox" name="beltRollersCleanChecked" /> Belt/rollers clean
        </label>
      </div>
      <Button type="submit" variant="secondary" className="px-2 py-1 text-[11px]">
        Confirm checklist
      </Button>
    </form>
  );
}

function MetalDetectorCheckForm({
  factoryId,
  date,
  shiftType,
  currentUserLabel,
}: {
  factoryId: string;
  date: string;
  shiftType: ShiftType;
  currentUserLabel: string | null;
}) {
  const [state, formAction, pending] = useActionState(createMetalDetectorCheckAction, undefined);
  const errorMessage = state && state !== "ok" ? state : undefined;

  return (
    <form action={formAction} className="mt-2 space-y-2 border-t border-slate-100 pt-2">
      <input type="hidden" name="factoryId" value={factoryId} />
      <input type="hidden" name="date" value={date} />
      <input type="hidden" name="shiftType" value={shiftType} />
      <div className="grid grid-cols-3 gap-1.5">
        {(
          [
            ["ferrousDetected", "ferrousDiameterMm", "Ferrous"],
            ["nonFerrousDetected", "nonFerrousDiameterMm", "Non-Ferrous"],
            ["stainlessDetected", "stainlessDiameterMm", "Stainless"],
          ] as const
        ).map(([detectedName, diameterName, label]) => (
          <div key={detectedName} className="space-y-1">
            <label className="flex items-center gap-1 text-[11px] text-slate-700">
              <input type="checkbox" name={detectedName} defaultChecked /> {label} detected
            </label>
            <Input name={diameterName} type="number" step="0.1" placeholder="mm" className="px-1.5 py-1 text-xs" />
          </div>
        ))}
      </div>
      <div className="flex items-center gap-3">
        <label className="flex items-center gap-1 text-[11px] text-slate-700">
          <input type="checkbox" name="productReleased" defaultChecked /> Product released
        </label>
      </div>
      <FieldGroup label="Corrective action (if held)">
        <Input name="correctiveAction" className="px-1.5 py-1 text-xs" />
      </FieldGroup>
      <Button type="submit" variant="secondary" disabled={pending} className="px-2 py-1 text-[11px]">
        {pending ? "Logging…" : "Log check"}
      </Button>
      {currentUserLabel && <span className="ml-2 text-[11px] text-slate-400">as {currentUserLabel}</span>}
      {errorMessage && <p className="text-[11px] text-red-600">{errorMessage}</p>}
    </form>
  );
}
