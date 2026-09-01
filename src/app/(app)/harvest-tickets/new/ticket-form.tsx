"use client";

import { useActionState, useState } from "react";
import { createHarvestTicketAction } from "../actions";
import { Input, Select, FieldGroup } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useTranslations } from "@/lib/i18n/locale-context";
import type { Dictionary } from "@/lib/i18n/getDictionary";

type PlotLine = {
  stationNo?: string;
  plotValveGhNo?: string;
  varietyName?: string;
  cycleNumber?: string;
  plantingYear?: string;
  cutNo?: string;
  palletsCount?: string;
  cratesCount?: string;
  weightKg?: string;
};

// Festival is overwhelmingly the common variety planted -- defaulting to it
// saves retyping the same value on nearly every plot line, while staying a
// plain editable text value if a specific plot really is a different one.
const EMPTY_LINE: PlotLine = { varietyName: "Festival" };

type FieldOption = { station: string; valve: string };

type HarvestTicketsDict = Dictionary["harvestTickets"];

function complianceLevels(dict: HarvestTicketsDict, otherLabel: string) {
  return [
    ["GLOBALGAP", dict.complianceGlobalGap],
    ["SPRING", dict.complianceSpring],
    ["LEAF", dict.complianceLeaf],
    ["NURTURE", dict.complianceNurture],
    ["AH_DL_GROW", dict.complianceAhDlGrow],
    ["FAIRTRADE", dict.complianceFairtrade],
    ["ORGANIC_100", dict.complianceOrganic100],
    ["BIO_SUISSE", dict.complianceBioSuisse],
    ["OTHER", otherLabel],
  ] as const;
}

function PlotLineCard({
  line,
  onChange,
  onRemove,
  dict,
  fields,
}: {
  line: PlotLine;
  onChange: (next: PlotLine) => void;
  onRemove: () => void;
  dict: HarvestTicketsDict;
  fields: FieldOption[];
}) {
  const set = (key: keyof PlotLine, value: string) => onChange({ ...line, [key]: value });
  const stations = [...new Set(fields.map((f) => f.station))];
  const valvesForStation = fields.filter((f) => !line.stationNo || f.station === line.stationNo).map((f) => f.valve);
  const valves = [...new Set(valvesForStation)];

  return (
    <div className="rounded-md border border-slate-200 p-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-slate-500">{dict.plotLine}</p>
        <button type="button" onClick={onRemove} className="text-xs text-red-600 hover:underline">
          {dict.remove}
        </button>
      </div>
      <div className="mt-3 grid grid-cols-4 gap-3">
        <FieldGroup label={dict.stationNo}>
          <Select
            value={line.stationNo ?? ""}
            onChange={(e) => {
              // Changing station clears a now-mismatched valve pick rather
              // than silently submitting a station/valve pair that was
              // never a real field.
              onChange({ ...line, stationNo: e.target.value, plotValveGhNo: "" });
            }}
          >
            <option value="">—</option>
            {stations.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
        </FieldGroup>
        <FieldGroup label={dict.plotValveGhNo}>
          <Select value={line.plotValveGhNo ?? ""} onChange={(e) => set("plotValveGhNo", e.target.value)}>
            <option value="">—</option>
            {valves.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </Select>
        </FieldGroup>
        <FieldGroup label={dict.variety}>
          <Input value={line.varietyName ?? ""} onChange={(e) => set("varietyName", e.target.value)} />
        </FieldGroup>
        <FieldGroup label={dict.cycleNo}>
          <Input value={line.cycleNumber ?? ""} onChange={(e) => set("cycleNumber", e.target.value)} />
        </FieldGroup>
        <FieldGroup label={dict.plantingYear}>
          <Input value={line.plantingYear ?? ""} onChange={(e) => set("plantingYear", e.target.value)} />
        </FieldGroup>
        <FieldGroup label={dict.cutNo}>
          <Input value={line.cutNo ?? ""} onChange={(e) => set("cutNo", e.target.value)} />
        </FieldGroup>
        <FieldGroup label={dict.pallets}>
          <Input type="number" step="1" value={line.palletsCount ?? ""} onChange={(e) => set("palletsCount", e.target.value)} />
        </FieldGroup>
        <FieldGroup label={dict.crates}>
          <Input type="number" step="1" value={line.cratesCount ?? ""} onChange={(e) => set("cratesCount", e.target.value)} />
        </FieldGroup>
        <FieldGroup label={dict.weightKg}>
          <Input type="number" step="0.1" value={line.weightKg ?? ""} onChange={(e) => set("weightKg", e.target.value)} />
        </FieldGroup>
      </div>
    </div>
  );
}

export function TicketForm({ fields }: { fields: FieldOption[] }) {
  const [error, formAction, pending] = useActionState(createHarvestTicketAction, undefined);
  const [lines, setLines] = useState<PlotLine[]>([{ ...EMPTY_LINE }]);
  const [productType, setProductType] = useState("");
  const fullDict = useTranslations();
  const dict = fullDict.harvestTickets;
  const COMPLIANCE_LEVELS = complianceLevels(dict, dict.complianceOtherOption);

  return (
    <form action={formAction} className="space-y-4">
      <Card className="space-y-4">
        <h2 className="text-sm font-semibold text-slate-900">{dict.deliveryIdentityTitle}</h2>
        <div className="grid grid-cols-4 gap-3">
          <FieldGroup label={dict.serialNumberLabel}>
            <Input name="serialNumber" required />
          </FieldGroup>
          <FieldGroup label={dict.ggn}>
            <Input name="ggn" />
          </FieldGroup>
          <FieldGroup label={dict.complianceLevel}>
            <Select name="complianceLevel" defaultValue="">
              <option value="">—</option>
              {COMPLIANCE_LEVELS.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </FieldGroup>
          <FieldGroup label={dict.complianceOther}>
            <Input name="complianceOther" />
          </FieldGroup>
          <FieldGroup label={dict.productType}>
            <Select name="productType" value={productType} onChange={(e) => setProductType(e.target.value)}>
              <option value="">—</option>
              <option value="RAW">{dict.productTypeRaw}</option>
              <option value="FINAL">{dict.productTypeFinal}</option>
              <option value="REWORK">{dict.productTypeRework}</option>
            </Select>
          </FieldGroup>
          {productType === "REWORK" && (
            <FieldGroup label={dict.reworkReason}>
              <Input name="reworkReason" />
            </FieldGroup>
          )}
        </div>
      </Card>

      <Card className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-900">{dict.conformityChecklistTitle}</h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" name="fruitConformityOk" /> {dict.fruitConformityOk}
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" name="fruitSafetyOk" /> {dict.fruitSafetyOk}
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" name="cratesCleanlinessOk" /> {dict.cratesCleanlinessOk}
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" name="fieldCleanlinessOk" /> {dict.fieldCleanlinessOk}
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" name="vehicleCleanlinessOk" /> {dict.vehicleCleanlinessOk}
          </label>
        </div>
      </Card>

      <Card className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-900">{dict.presenceChecklistTitle}</h2>
        <div className="space-y-3">
          <div className="grid grid-cols-2 items-start gap-3">
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" name="petsPresent" /> {dict.petsPresent}
            </label>
            <Input name="petsPresentAction" placeholder={dict.correctiveActionIfFlagged} />
          </div>
          <div className="grid grid-cols-2 items-start gap-3">
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" name="animalProductionNearby" /> {dict.animalProductionNearby}
            </label>
            <Input name="animalProductionNearbyAction" placeholder={dict.correctiveActionIfFlagged} />
          </div>
          <div className="grid grid-cols-2 items-start gap-3">
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" name="wildDomesticAnimalActivity" /> {dict.wildDomesticAnimalActivity}
            </label>
            <Input name="wildDomesticAnimalActivityAction" placeholder={dict.correctiveActionIfFlagged} />
          </div>
          <div className="grid grid-cols-2 items-start gap-3">
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" name="rodentDogActivity" /> {dict.rodentDogActivity}
            </label>
            <Input name="rodentDogActivityAction" placeholder={dict.correctiveActionIfFlagged} />
          </div>
        </div>
      </Card>

      <Card className="space-y-4">
        <h2 className="text-sm font-semibold text-slate-900">{dict.deliveryHarvestDetailsTitle}</h2>
        <div className="grid grid-cols-4 gap-3">
          <FieldGroup label={dict.loadingSupervisor}>
            <Input name="loadingSupervisor" />
          </FieldGroup>
          <FieldGroup label={dict.loadingTime}>
            <Input name="loadingTime" type="datetime-local" />
          </FieldGroup>
          <FieldGroup label={dict.transferredBy}>
            <Input name="transferredBy" />
          </FieldGroup>
          <FieldGroup label={dict.vehicleNo}>
            <Input name="vehicleNo" />
          </FieldGroup>
          <FieldGroup label={dict.authorizedGrower}>
            <Input name="authorizedGrower" defaultValue="MAFA 4" />
          </FieldGroup>
          <FieldGroup label={dict.cropName}>
            <Input name="cropName" />
          </FieldGroup>
          <FieldGroup label={dict.harvestTime}>
            <Input name="harvestTime" type="datetime-local" />
          </FieldGroup>
          <FieldGroup label={dict.harvestSupervisor}>
            <Input name="harvestSupervisor" />
          </FieldGroup>
          <FieldGroup label={dict.harvestDate}>
            <Input name="harvestDate" type="date" defaultValue={new Date().toISOString().slice(0, 10)} />
          </FieldGroup>
        </div>
      </Card>

      <Card className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900">{dict.plotsSuppliedTitle}</h2>
          <Button type="button" variant="secondary" onClick={() => setLines([...lines, { ...EMPTY_LINE }])}>
            {dict.addPlot}
          </Button>
        </div>
        <div className="space-y-3">
          {lines.map((line, i) => (
            <PlotLineCard
              key={i}
              line={line}
              onChange={(next) => setLines(lines.map((l, j) => (j === i ? next : l)))}
              onRemove={() => setLines(lines.filter((_, j) => j !== i))}
              dict={dict}
              fields={fields}
            />
          ))}
          {lines.length === 0 && <p className="text-sm text-slate-400">{dict.noPlotsAddedYet}</p>}
        </div>
      </Card>

      <input type="hidden" name="plotLinesJson" value={JSON.stringify(lines)} />

      {error && <p className="text-sm text-red-600">{error}</p>}
      <Button type="submit" disabled={pending}>
        {pending ? fullDict.common.saving : dict.saveTicket}
      </Button>
    </form>
  );
}
