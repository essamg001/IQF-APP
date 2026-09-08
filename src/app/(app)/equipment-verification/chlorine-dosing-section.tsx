"use client";

import { useState } from "react";
import { useActionState } from "react";
import { createChlorineDosingCheckAction, updateChlorineSetPointAction } from "./actions";
import { Input, Select, FieldGroup } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { HourCoverageGrid } from "./hour-coverage-grid";
import { SHIFT_HOURS, hourSlotDate, toDateTimeLocalValue, isCurrentHourSlot } from "@/lib/shiftHours";
import { parseLocalDateOnly } from "@/lib/dates";
import type { ChlorineDosingCheck, ShiftType } from "@prisma/client";
import { useTranslations } from "@/lib/i18n/locale-context";

export function ChlorineDosingSection({
  factoryId,
  date,
  shiftType,
  checks,
  currentUserLabel,
  now,
  setPointPpm,
}: {
  factoryId: string;
  date: string;
  shiftType: ShiftType;
  checks: ChlorineDosingCheck[];
  currentUserLabel: string | null;
  now: Date;
  setPointPpm: number | null;
}) {
  const [presetHour, setPresetHour] = useState<number | null>(null);
  const [dosingAgent, setDosingAgent] = useState<"CHLORINE" | "PERACETIC_ACID" | "OTHER">("CHLORINE");
  const [dosingAgentOther, setDosingAgentOther] = useState("");
  const [freeChlorineInput, setFreeChlorineInput] = useState("");
  const shiftDate = parseLocalDateOnly(date) ?? now;
  const hours = SHIFT_HOURS[shiftType];

  const latestByHour = new Map<number, ChlorineDosingCheck>();
  for (const c of checks) latestByHour.set(c.recordedAt.getHours(), c);

  const defaultRecordedAt =
    presetHour != null ? toDateTimeLocalValue(hourSlotDate(shiftDate, shiftType, presetHour)) : "";

  const [state, formAction, pending] = useActionState(createChlorineDosingCheckAction, undefined);
  const errorMessage = state && state !== "ok" ? state : undefined;
  const fullDict = useTranslations();
  const dict = fullDict.equipmentVerification;

  return (
    <div className="rounded-md border border-slate-200 p-3">
      <h5 className="text-xs font-semibold text-slate-700">{dict.chlorineTitle}</h5>
      <p className="mt-0.5 text-[11px] text-slate-400">{dict.chlorineSubtitle}</p>
      <form action={updateChlorineSetPointAction.bind(null, factoryId)} className="mt-1 flex items-end gap-1.5">
        <FieldGroup label={dict.chlorineSetPointLabel}>
          <Input
            name="chlorineSetPointPpm"
            type="number"
            step="0.01"
            defaultValue={setPointPpm ?? ""}
            className="w-20 px-1.5 py-1 text-[11px]"
          />
        </FieldGroup>
        <Button type="submit" variant="secondary" className="px-2 py-1 text-[11px]">
          {fullDict.common.save}
        </Button>
      </form>

      <div className="mt-2">
        <HourCoverageGrid
          hours={hours}
          hasCheck={(h) => latestByHour.has(h)}
          elapsed={(h) => hourSlotDate(shiftDate, shiftType, h) <= now}
          isCurrent={(h) => isCurrentHourSlot(hourSlotDate(shiftDate, shiftType, h), now)}
          onPick={setPresetHour}
        />
      </div>

      {checks.length > 0 && (
        <table className="mt-2 w-full text-start text-[11px]">
          <thead className="border-b border-slate-200 text-slate-500">
            <tr>
              <th className="py-1 pr-2 font-medium">{dict.colTime}</th>
              <th className="py-1 pr-2 font-medium">{dict.colPh}</th>
              <th className="py-1 pr-2 font-medium">{dict.colCl2}</th>
              <th className="py-1 pr-2 font-medium">{dict.colTransit}</th>
              <th className="py-1 pr-2 font-medium">{fullDict.common.status}</th>
              <th className="py-1 pr-2 font-medium">{dict.colBy}</th>
            </tr>
          </thead>
          <tbody>
            {checks.map((c) => (
              <tr key={c.id} className="border-b border-slate-100 last:border-0">
                <td className="py-1 pr-2 text-slate-600">
                  {c.recordedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </td>
                <td className="py-1 pr-2">{c.phLevel ?? "—"}</td>
                <td className="py-1 pr-2">
                  {c.freeChlorinePpm ?? "—"}
                  {c.freeChlorinePpm != null && setPointPpm != null && (
                    <span
                      className={
                        Math.abs(c.freeChlorinePpm - setPointPpm) > setPointPpm * 0.1
                          ? "font-medium text-red-600"
                          : "text-emerald-600"
                      }
                    >
                      {" "}
                      ({dict.vsSetPoint.replace(
                        "{delta}",
                        (c.freeChlorinePpm - setPointPpm >= 0 ? "+" : "") + (c.freeChlorinePpm - setPointPpm).toFixed(2)
                      )})
                    </span>
                  )}
                </td>
                <td className="py-1 pr-2">{c.fruitTransitSeconds ?? "—"}</td>
                <td className="py-1 pr-2">
                  {c.deviationOccurred == null ? (
                    "—"
                  ) : c.deviationOccurred ? (
                    <Badge color="red">{dict.deviation}</Badge>
                  ) : (
                    <Badge color="green">{dict.ok}</Badge>
                  )}
                </td>
                <td className="py-1 pr-2 text-slate-500">{c.verifiedByName ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

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
        <div className="grid grid-cols-2 gap-1.5">
          <FieldGroup label={dict.dosingAgentLabel}>
            <Select
              name="dosingAgent"
              value={dosingAgent}
              onChange={(e) => setDosingAgent(e.target.value as typeof dosingAgent)}
              className="px-1.5 py-1 text-xs"
            >
              <option value="CHLORINE">{dict.dosingAgentChlorine}</option>
              <option value="PERACETIC_ACID">{dict.dosingAgentPeraceticAcid}</option>
              <option value="OTHER">{dict.dosingAgentOther}</option>
            </Select>
          </FieldGroup>
          {dosingAgent === "OTHER" && (
            <FieldGroup label={dict.dosingAgentOtherLabel}>
              <Input
                name="dosingAgentOther"
                value={dosingAgentOther}
                onChange={(e) => setDosingAgentOther(e.target.value)}
                className="px-1.5 py-1 text-xs"
              />
            </FieldGroup>
          )}
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          <FieldGroup label={dict.colPh}>
            <Input name="phLevel" type="number" step="0.01" className="px-1.5 py-1 text-xs" />
          </FieldGroup>
          <FieldGroup
            label={
              (setPointPpm != null ? `${dict.freeChlorine} (${dict.setPointShortLabel} ${setPointPpm})` : dict.freeChlorine) +
              (dosingAgent !== "CHLORINE" ? ` — ${dict.dosingAgentReadingNote}` : "")
            }
          >
            <Input
              name="freeChlorinePpm"
              type="number"
              step="0.01"
              value={freeChlorineInput}
              onChange={(e) => setFreeChlorineInput(e.target.value)}
              className="px-1.5 py-1 text-xs"
            />
          </FieldGroup>
          <FieldGroup label={dict.fruitTransit}>
            <Input name="fruitTransitSeconds" type="number" step="1" className="px-1.5 py-1 text-xs" />
          </FieldGroup>
        </div>

        {setPointPpm != null && freeChlorineInput !== "" && !Number.isNaN(Number(freeChlorineInput)) && (
          (() => {
            const delta = Number(freeChlorineInput) - setPointPpm;
            const outOfTolerance = Math.abs(delta) > setPointPpm * 0.1;
            return (
              <div
                className={`rounded-md border p-2 text-[11px] ${
                  outOfTolerance ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"
                }`}
              >
                <p className="font-medium uppercase tracking-wide">{dict.deltaFromSetPoint}</p>
                <p className="mt-0.5 text-sm font-semibold">
                  {(delta >= 0 ? "+" : "") + delta.toFixed(2)} ppm
                  <span className="ms-1.5 font-normal">
                    ({outOfTolerance ? dict.deltaOutOfTolerance : dict.deltaWithinTolerance})
                  </span>
                </p>
              </div>
            );
          })()
        )}
        {(setPointPpm == null || freeChlorineInput === "") && (
          <p className="text-[11px] text-slate-400">{dict.deltaFromSetPointHint}</p>
        )}

        <div className="flex items-center gap-3">
          <label className="flex items-center gap-1 text-[11px] text-slate-700">
            <input type="checkbox" name="deviationOccurred" /> {dict.deviationOccurred}
          </label>
          <label className="flex items-center gap-1 text-[11px] text-slate-700">
            <input type="checkbox" name="verifiedOk" defaultChecked /> {dict.verified}
          </label>
        </div>
        <FieldGroup label={dict.correctiveActionIfDeviation}>
          <Input name="correctiveAction" className="px-1.5 py-1 text-xs" />
        </FieldGroup>
        <Button type="submit" variant="secondary" disabled={pending} className="px-2 py-1 text-[11px]">
          {pending ? dict.logging : dict.logReading}
        </Button>
        {currentUserLabel && (
          <span className="ms-2 text-[11px] text-slate-400">{dict.asUser.replace("{name}", currentUserLabel)}</span>
        )}
        {errorMessage && <p className="text-[11px] text-red-600">{errorMessage}</p>}
      </form>
    </div>
  );
}
