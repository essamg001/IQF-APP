"use client";

import { useState } from "react";
import { useActionState } from "react";
import { createPreDecapCheckAction } from "./actions";
import { Input, Select, FieldGroup } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { VarietyField } from "@/components/variety-field";
import { QualityLimitWarning } from "@/components/ui/quality-limit-warning";
import { decodeActionResult, limitsFor } from "@/lib/qualityLimits";
import { useDefectTotal } from "@/lib/useDefectTotal";
import { PRE_DECAP_DEFECT_FIELDS } from "@/lib/defectFields";
import { cn } from "@/lib/cn";
import { useTranslations } from "@/lib/i18n/locale-context";

const TOTAL_DEFECTS_LIMIT = limitsFor("PRE_DECAP").find((r) => r.field === "totalDefectsPct")!.max!;

function Pct({
  name,
  label,
  value,
  onChange,
}: {
  name: string;
  label: string;
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <FieldGroup label={label}>
      <Input name={name} type="number" step="0.1" min="0" max="100" value={value} onChange={onChange} />
    </FieldGroup>
  );
}

type FieldOption = { id: string; name: string };

type PlotLineOption = {
  id: string;
  stationNo: string | null;
  plotValveGhNo: string | null;
  varietyName: string | null;
  field: { id: string; name: string } | null;
};

type HarvestTicketOption = {
  id: string;
  serialNumber: string;
  plotLines: PlotLineOption[];
};

export function PreDecapForm({
  fields,
  harvestTickets,
}: {
  fields: FieldOption[];
  harvestTickets: HarvestTicketOption[];
}) {
  const [state, formAction, pending] = useActionState(createPreDecapCheckAction, undefined);
  const dict = useTranslations().preDecapInspection;

  const isSuccess = typeof state === "string" && state.startsWith("ok:");
  const errorMessage = typeof state === "string" && !isSuccess ? state : undefined;
  const decoded = isSuccess ? decodeActionResult(state) : null;

  return (
    <form action={formAction} className="space-y-4">
      <SampleFields key={isSuccess ? state : "initial"} fields={fields} harvestTickets={harvestTickets} />

      {errorMessage && <p className="text-sm text-red-600">{errorMessage}</p>}
      {decoded && decoded.violations.length === 0 && (
        <p className="text-sm">
          <Badge color="green">{dict.acceptable}</Badge>
        </p>
      )}
      {decoded && <QualityLimitWarning violations={decoded.violations} />}
      {isSuccess && <p className="text-sm font-medium text-emerald-700">{dict.saved}</p>}
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? dict.saving : dict.logCheck}
      </Button>
    </form>
  );
}

function plotLineLabel(l: PlotLineOption, unmatchedSuffix: string) {
  const parts = [l.stationNo, l.plotValveGhNo, l.varietyName].filter(Boolean);
  const base = parts.length ? parts.join(" · ") : l.id;
  return l.field ? base : `${base} ${unmatchedSuffix}`;
}

function SerialPlotPicker({ tickets, fields }: { tickets: HarvestTicketOption[]; fields: FieldOption[] }) {
  const [serial, setSerial] = useState("");
  const matchedTicket = tickets.find((t) => t.serialNumber.trim().toLowerCase() === serial.trim().toLowerCase());
  const dict = useTranslations().preDecapInspection;

  return (
    <>
      <FieldGroup label={dict.harvestTicketSerial}>
        <Input
          name="receiptNoteNo"
          value={serial}
          onChange={(e) => setSerial(e.target.value)}
          list="ticket-serials"
          placeholder={dict.harvestTicketSerialPlaceholder}
        />
        <datalist id="ticket-serials">
          {tickets.map((t) => (
            <option key={t.id} value={t.serialNumber} />
          ))}
        </datalist>
      </FieldGroup>

      {matchedTicket ? (
        <FieldGroup label={dict.plotSampled}>
          <Select name="plotLineId" required defaultValue="">
            <option value="" disabled>
              {dict.plotSampledPlaceholder}
            </option>
            {matchedTicket.plotLines.map((l) => (
              <option key={l.id} value={l.id}>
                {plotLineLabel(l, dict.unmatchedField)}
              </option>
            ))}
          </Select>
        </FieldGroup>
      ) : (
        <FieldGroup label={dict.plotNumber}>
          <Input name="fieldName" required list="plot-suggestions" placeholder={dict.plotNumberPlaceholder} />
          <datalist id="plot-suggestions">
            {fields.map((f) => (
              <option key={f.id} value={f.name} />
            ))}
          </datalist>
        </FieldGroup>
      )}
    </>
  );
}

function SampleFields({ fields, harvestTickets }: { fields: FieldOption[]; harvestTickets: HarvestTicketOption[] }) {
  const { total: defectTotal, bind } = useDefectTotal(PRE_DECAP_DEFECT_FIELDS);
  const dict = useTranslations().preDecapInspection;

  return (
    <>
      <Card className="space-y-4">
        <h2 className="text-sm font-semibold text-slate-900">{dict.deliveryIdentityTitle}</h2>
        <div className="grid grid-cols-4 gap-3">
          <SerialPlotPicker tickets={harvestTickets} fields={fields} />
          <VarietyField />
          <FieldGroup label={dict.sampleNo}>
            <Input name="sampleNo" required />
          </FieldGroup>
          <FieldGroup label={dict.cratesReceived}>
            <Input name="numberOfBoxesReceived" type="number" step="1" min="0" />
          </FieldGroup>
          <FieldGroup label={dict.sampleCollectionTime}>
            <Input name="sampleCollectionTime" type="datetime-local" />
          </FieldGroup>
          <FieldGroup label={dict.sampleWeightKg}>
            <Input name="sampleWeightKg" type="number" step="0.01" />
          </FieldGroup>
          <FieldGroup label={dict.temperature}>
            <Input name="productTemperatureC" type="number" step="0.1" />
          </FieldGroup>
          <FieldGroup label={dict.harvestSupervisor}>
            <Input name="harvestSupervisor" placeholder={dict.harvestSupervisorPlaceholder} />
          </FieldGroup>
        </div>
      </Card>

      <Card className="space-y-4">
        <h2 className="text-sm font-semibold text-slate-900">{dict.physicalMeasurementsTitle}</h2>
        <div className="grid grid-cols-4 gap-3">
          <FieldGroup label={dict.brix}>
            <Input name="brix" type="number" step="0.1" required />
          </FieldGroup>
          <Pct name="fruitColorPct" label={dict.fruitColor} />
          <Pct name="internalQualityPct" label={dict.internalQuality} />
          <FieldGroup label={dict.cleaningGoodCrates}>
            <label className="flex h-9 items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" name="cleaningGoodCratesOk" defaultChecked className="h-4 w-4 rounded border-slate-300" />
              {dict.ok}
            </label>
          </FieldGroup>
        </div>
      </Card>

      <Card className="space-y-4">
        <h2 className="text-sm font-semibold text-slate-900">{dict.defectsTitle}</h2>
        <div className="grid grid-cols-4 gap-3">
          <Pct name="overmaturePct" label={dict.overmature} {...bind("overmaturePct")} />
          <Pct name="diameterUnder22mmPct" label={dict.diameterUnder22mm} {...bind("diameterUnder22mmPct")} />
          <Pct name="botrytisPct" label={dict.botrytis} {...bind("botrytisPct")} />
          <Pct name="earlyBotrytisPct" label={dict.earlyBotrytis} {...bind("earlyBotrytisPct")} />
          <Pct name="pestDiseasePct" label={dict.pestDisease} {...bind("pestDiseasePct")} />
          <Pct name="insectDamagePct" label={dict.insectDamage} {...bind("insectDamagePct")} />
          <Pct name="wormEatenPct" label={dict.wormEaten} {...bind("wormEatenPct")} />
          <Pct name="birdTracesPct" label={dict.birdTraces} {...bind("birdTracesPct")} />
          <Pct name="leavesStalksPct" label={dict.leavesStalks} {...bind("leavesStalksPct")} />
          <Pct name="bruisesPct" label={dict.bruises} {...bind("bruisesPct")} />
          <Pct name="shapeDeformitiesPct" label={dict.shapeDeformities} {...bind("shapeDeformitiesPct")} />
          <Pct name="sandDustPct" label={dict.sandDust} {...bind("sandDustPct")} />
          <Pct name="foreignBodiesPct" label={dict.foreignBodies} {...bind("foreignBodiesPct")} />
        </div>
        <p className={cn("text-xs font-medium", defectTotal > TOTAL_DEFECTS_LIMIT ? "text-red-600" : "text-slate-400")}>
          {dict.runningTotal.replace("{total}", defectTotal.toFixed(1)).replace("{limit}", String(TOTAL_DEFECTS_LIMIT))}
        </p>
      </Card>

      <Card className="space-y-4">
        <FieldGroup label={dict.reasonOptional}>
          <Input name="notes" />
        </FieldGroup>
      </Card>
    </>
  );
}
