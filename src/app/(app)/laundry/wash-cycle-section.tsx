"use client";

import { useActionState, useRef, useState } from "react";
import { createLaundryWashCycleAction } from "./actions";
import { Input, FieldGroup } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import type { LaundryWashCycle, LaundryWashCycleAgent } from "@prisma/client";
import { useTranslations } from "@/lib/i18n/locale-context";

type CycleWithAgents = LaundryWashCycle & { agents: LaundryWashCycleAgent[] };

type AgentRow = {
  agentName?: string;
  concentrationValue?: string;
  concentrationUnit?: string;
  amountOfAgent?: string;
};

const EMPTY_AGENT: AgentRow = {};

const CONCENTRATION_UNITS = ["%", "ppm", "ml/L", "g/L"];

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
  cycles: CycleWithAgents[];
  knownItemTypes: string[];
  knownAgents: string[];
  knownPurposes: string[];
}) {
  const [state, formAction, pending] = useActionState(createLaundryWashCycleAction, undefined);
  const [agentRows, setAgentRows] = useState<AgentRow[]>([{ ...EMPTY_AGENT }]);
  const formRef = useRef<HTMLFormElement>(null);
  const errorMessage = state && state !== "ok" ? state : undefined;
  const fullDict = useTranslations();
  const dict = fullDict.laundry;

  return (
    <div>
      <h3 className="text-sm font-semibold text-slate-900">{dict.washCycleTitle}</h3>
      <p className="mt-0.5 text-xs text-slate-500">{dict.washCycleSubtitle}</p>

      {cycles.length > 0 && (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-start text-[11px]">
            <thead className="border-b border-slate-200 text-slate-500">
              <tr>
                <th className="py-1 pr-2 font-medium">{dict.colTypeItem}</th>
                <th className="py-1 pr-2 font-medium">{dict.colCount}</th>
                <th className="py-1 pr-2 font-medium">{dict.colPurpose}</th>
                <th className="py-1 pr-2 font-medium">{dict.colWaterTemp}</th>
                <th className="py-1 pr-2 font-medium">{dict.colAgents}</th>
                <th className="py-1 pr-2 font-medium">{dict.colTime}</th>
                <th className="py-1 pr-2 font-medium">{dict.colDryerTemp}</th>
                <th className="py-1 pr-2 font-medium">{dict.colBy}</th>
              </tr>
            </thead>
            <tbody>
              {cycles.map((c) => (
                <tr key={c.id} className="border-b border-slate-100 last:border-0">
                  <td className="py-1 pr-2 font-medium text-slate-900">{c.itemType}</td>
                  <td className="py-1 pr-2">{c.count ?? "—"}</td>
                  <td className="py-1 pr-2 text-slate-600">{c.purpose ?? "—"}</td>
                  <td className="py-1 pr-2">{c.waterTemperatureC ?? "—"}</td>
                  <td className="py-1 pr-2 text-slate-600">
                    {c.agents.length === 0
                      ? "—"
                      : c.agents
                          .map((a) =>
                            [
                              a.agentName,
                              a.concentrationValue != null
                                ? `${a.concentrationValue}${a.concentrationUnit ?? ""}`
                                : a.concentrationUnit,
                              a.amountOfAgent ? `(${a.amountOfAgent})` : null,
                            ]
                              .filter(Boolean)
                              .join(" ")
                          )
                          .join(", ")}
                  </td>
                  <td className="py-1 pr-2 text-slate-600">
                    {c.timeFrom || c.timeTo ? `${c.timeFrom ?? "—"}–${c.timeTo ?? "—"}` : "—"}
                  </td>
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
          setAgentRows([{ ...EMPTY_AGENT }]);
        }}
        className="mt-3 space-y-3 border-t border-slate-100 pt-3"
      >
        <input type="hidden" name="date" value={date} />
        <input type="hidden" name="location" value={location} />
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-5">
          <FieldGroup label={dict.colTypeItem}>
            <Input name="itemType" list="laundry-item-types" required className="px-2 py-1 text-xs" />
            <datalist id="laundry-item-types">
              {knownItemTypes.map((t) => (
                <option key={t} value={t} />
              ))}
            </datalist>
          </FieldGroup>
          <FieldGroup label={dict.colCount}>
            <Input name="count" type="number" step="1" className="px-2 py-1 text-xs" />
          </FieldGroup>
          <FieldGroup label={dict.colPurpose}>
            <Input name="purpose" list="laundry-purposes" className="px-2 py-1 text-xs" />
            <datalist id="laundry-purposes">
              {knownPurposes.map((p) => (
                <option key={p} value={p} />
              ))}
            </datalist>
          </FieldGroup>
          <FieldGroup label={dict.colWaterTemp}>
            <Input name="waterTemperatureC" type="number" step="0.1" className="px-2 py-1 text-xs" />
          </FieldGroup>
          <FieldGroup label={dict.timeFrom}>
            <Input name="timeFrom" type="time" className="px-2 py-1 text-xs" />
          </FieldGroup>
          <FieldGroup label={dict.timeTo}>
            <Input name="timeTo" type="time" className="px-2 py-1 text-xs" />
          </FieldGroup>
          <FieldGroup label={dict.colDryerTemp}>
            <Input name="dryerTemperatureC" type="number" step="0.1" className="px-2 py-1 text-xs" />
          </FieldGroup>
        </div>

        <div className="rounded-md border border-slate-200 p-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-slate-700">{dict.colAgents}</p>
            <button
              type="button"
              className="text-xs text-emerald-700 hover:underline"
              onClick={() => setAgentRows([...agentRows, { ...EMPTY_AGENT }])}
            >
              {dict.addAgent}
            </button>
          </div>
          <div className="mt-2 space-y-2">
            {agentRows.map((row, i) => (
              <div key={i} className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                <FieldGroup label={dict.colAgent}>
                  <Input
                    list="laundry-agents"
                    className="px-2 py-1 text-xs"
                    value={row.agentName ?? ""}
                    onChange={(e) => setAgentRows(agentRows.map((r, j) => (j === i ? { ...r, agentName: e.target.value } : r)))}
                  />
                </FieldGroup>
                <FieldGroup label={dict.colConcentrationValue}>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    className="px-2 py-1 text-xs"
                    value={row.concentrationValue ?? ""}
                    onChange={(e) =>
                      setAgentRows(agentRows.map((r, j) => (j === i ? { ...r, concentrationValue: e.target.value } : r)))
                    }
                  />
                </FieldGroup>
                <FieldGroup label={dict.colConcentrationUnit}>
                  <Input
                    list="laundry-concentration-units"
                    className="px-2 py-1 text-xs"
                    value={row.concentrationUnit ?? ""}
                    onChange={(e) =>
                      setAgentRows(agentRows.map((r, j) => (j === i ? { ...r, concentrationUnit: e.target.value } : r)))
                    }
                  />
                </FieldGroup>
                <FieldGroup label={dict.colAmountOfAgent}>
                  <Input
                    className="px-2 py-1 text-xs"
                    value={row.amountOfAgent ?? ""}
                    onChange={(e) => setAgentRows(agentRows.map((r, j) => (j === i ? { ...r, amountOfAgent: e.target.value } : r)))}
                  />
                </FieldGroup>
                <div className="flex items-end">
                  <button
                    type="button"
                    className="px-2 py-1 text-xs text-red-600 hover:underline"
                    onClick={() => setAgentRows(agentRows.filter((_, j) => j !== i))}
                  >
                    {dict.removeAgent}
                  </button>
                </div>
              </div>
            ))}
            {agentRows.length === 0 && <p className="text-xs text-slate-400">{dict.noAgentsAddedYet}</p>}
          </div>
          <datalist id="laundry-agents">
            {knownAgents.map((a) => (
              <option key={a} value={a} />
            ))}
          </datalist>
          <datalist id="laundry-concentration-units">
            {CONCENTRATION_UNITS.map((u) => (
              <option key={u} value={u} />
            ))}
          </datalist>
        </div>

        <input
          type="hidden"
          name="agentsJson"
          value={JSON.stringify(
            agentRows
              .filter((r) => r.agentName?.trim())
              .map((r) => ({
                agentName: r.agentName,
                concentrationValue: r.concentrationValue || undefined,
                concentrationUnit: r.concentrationUnit || undefined,
                amountOfAgent: r.amountOfAgent || undefined,
              }))
          )}
        />

        <Button type="submit" variant="secondary" disabled={pending} className="px-2 py-1 text-xs">
          {pending ? fullDict.common.saving : dict.addWashCycle}
        </Button>
        {errorMessage && <p className="text-xs text-red-600">{errorMessage}</p>}
      </form>
    </div>
  );
}
