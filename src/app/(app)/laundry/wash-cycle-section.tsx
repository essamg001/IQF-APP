"use client";

import { useActionState, useRef } from "react";
import { createLaundryWashCycleAction } from "./actions";
import { Input, FieldGroup } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import type { LaundryWashCycle } from "@prisma/client";

export function WashCycleSection({
  date,
  location,
  cycles,
  knownItemTypes,
  knownAgents,
  knownPurposes,
}: {
  date: string;
  location: string;
  cycles: LaundryWashCycle[];
  knownItemTypes: string[];
  knownAgents: string[];
  knownPurposes: string[];
}) {
  const [state, formAction, pending] = useActionState(createLaundryWashCycleAction, undefined);
  const formRef = useRef<HTMLFormElement>(null);
  const errorMessage = state && state !== "ok" ? state : undefined;

  return (
    <div>
      <h3 className="text-sm font-semibold text-slate-900">Wash Cycle Log — HSE03293</h3>
      <p className="mt-0.5 text-xs text-slate-500">Washing details for each batch/load laundered today.</p>

      {cycles.length > 0 && (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left text-[11px]">
            <thead className="border-b border-slate-200 text-slate-500">
              <tr>
                <th className="py-1 pr-2 font-medium">Type / Item</th>
                <th className="py-1 pr-2 font-medium">Count</th>
                <th className="py-1 pr-2 font-medium">Purpose</th>
                <th className="py-1 pr-2 font-medium">Water Temp (°C)</th>
                <th className="py-1 pr-2 font-medium">Agent</th>
                <th className="py-1 pr-2 font-medium">Concentration</th>
                <th className="py-1 pr-2 font-medium">Time</th>
                <th className="py-1 pr-2 font-medium">Amount of Agent</th>
                <th className="py-1 pr-2 font-medium">Dryer Temp (°C)</th>
                <th className="py-1 pr-2 font-medium">By</th>
              </tr>
            </thead>
            <tbody>
              {cycles.map((c) => (
                <tr key={c.id} className="border-b border-slate-100 last:border-0">
                  <td className="py-1 pr-2 font-medium text-slate-900">{c.itemType}</td>
                  <td className="py-1 pr-2">{c.count ?? "—"}</td>
                  <td className="py-1 pr-2 text-slate-600">{c.purpose ?? "—"}</td>
                  <td className="py-1 pr-2">{c.waterTemperatureC ?? "—"}</td>
                  <td className="py-1 pr-2 text-slate-600">{c.agent ?? "—"}</td>
                  <td className="py-1 pr-2 text-slate-600">{c.concentration ?? "—"}</td>
                  <td className="py-1 pr-2 text-slate-600">
                    {c.timeFrom || c.timeTo ? `${c.timeFrom ?? "—"}–${c.timeTo ?? "—"}` : "—"}
                  </td>
                  <td className="py-1 pr-2 text-slate-600">{c.amountOfAgent ?? "—"}</td>
                  <td className="py-1 pr-2">{c.dryerTemperatureC ?? "—"}</td>
                  <td className="py-1 pr-2 text-slate-500">{c.recordedByName ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <form
        ref={formRef}
        action={async (formData) => {
          await formAction(formData);
          formRef.current?.reset();
        }}
        className="mt-3 space-y-2 border-t border-slate-100 pt-3"
      >
        <input type="hidden" name="date" value={date} />
        <input type="hidden" name="location" value={location} />
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-5">
          <FieldGroup label="Type / Item">
            <Input name="itemType" list="laundry-item-types" required className="px-2 py-1 text-xs" />
            <datalist id="laundry-item-types">
              {knownItemTypes.map((t) => (
                <option key={t} value={t} />
              ))}
            </datalist>
          </FieldGroup>
          <FieldGroup label="Count">
            <Input name="count" type="number" step="1" className="px-2 py-1 text-xs" />
          </FieldGroup>
          <FieldGroup label="Purpose">
            <Input name="purpose" list="laundry-purposes" className="px-2 py-1 text-xs" />
            <datalist id="laundry-purposes">
              {knownPurposes.map((p) => (
                <option key={p} value={p} />
              ))}
            </datalist>
          </FieldGroup>
          <FieldGroup label="Water Temp (°C)">
            <Input name="waterTemperatureC" type="number" step="0.1" className="px-2 py-1 text-xs" />
          </FieldGroup>
          <FieldGroup label="Agent">
            <Input name="agent" list="laundry-agents" className="px-2 py-1 text-xs" />
            <datalist id="laundry-agents">
              {knownAgents.map((a) => (
                <option key={a} value={a} />
              ))}
            </datalist>
          </FieldGroup>
          <FieldGroup label="Concentration">
            <Input name="concentration" className="px-2 py-1 text-xs" />
          </FieldGroup>
          <FieldGroup label="Time From">
            <Input name="timeFrom" type="time" className="px-2 py-1 text-xs" />
          </FieldGroup>
          <FieldGroup label="Time To">
            <Input name="timeTo" type="time" className="px-2 py-1 text-xs" />
          </FieldGroup>
          <FieldGroup label="Amount of Agent">
            <Input name="amountOfAgent" className="px-2 py-1 text-xs" />
          </FieldGroup>
          <FieldGroup label="Dryer Temp (°C)">
            <Input name="dryerTemperatureC" type="number" step="0.1" className="px-2 py-1 text-xs" />
          </FieldGroup>
        </div>
        <Button type="submit" variant="secondary" disabled={pending} className="px-2 py-1 text-xs">
          {pending ? "Saving…" : "Add Wash Cycle"}
        </Button>
        {errorMessage && <p className="text-xs text-red-600">{errorMessage}</p>}
      </form>
    </div>
  );
}
