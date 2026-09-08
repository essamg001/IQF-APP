"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { createArrivalCheckAction } from "./actions";
import { Input, Select, FieldGroup } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { QualityLimitWarning } from "@/components/ui/quality-limit-warning";
import { DEFAULT_VARIETY } from "@/components/variety-field";
import { decodeActionResult, limitsFor } from "@/lib/qualityLimits";
import { useDefectTotal } from "@/lib/useDefectTotal";
import { DECAP_SHARED_DEFECT_FIELDS } from "@/lib/defectFields";
import { QC_NUMBERS } from "@/lib/qc";
import { cn } from "@/lib/cn";
import { useTranslations } from "@/lib/i18n/locale-context";

const TOTAL_DEFECTS_LIMIT = limitsFor("RAW_MATERIAL").find((r) => r.field === "totalDefectsPct")!.max!;

function Pct({
  name,
  label,
  limit,
  value,
  onChange,
}: {
  name: string;
  label: string;
  limit: string;
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  const dict = useTranslations();
  return (
    <FieldGroup label={`${label} (${dict.common.limit} ${limit})`}>
      <Input name={name} type="number" step="0.1" min="0" max="100" value={value} onChange={onChange} />
    </FieldGroup>
  );
}

type TodaysCheck = { receiptNoteNo: string | null; appliesToWholeDelivery: boolean };
type HarvestTicketOption = {
  id: string;
  serialNumber: string;
  vehicleNo: string | null;
  authorizedGrower: string | null;
  plotLines: { varietyName: string | null }[];
};

export function ArrivalInspectionForm({
  todaysChecks,
  harvestTickets,
  factories,
}: {
  todaysChecks: TodaysCheck[];
  harvestTickets: HarvestTicketOption[];
  factories: { id: string; name: string }[];
}) {
  const [state, formAction, pending] = useActionState(createArrivalCheckAction, undefined);
  const fullDict = useTranslations();
  const dict = fullDict.arrivalInspection;

  // Shift/delivery header fields carry over between consecutive samples from
  // the same truck; only the per-pallet fields (in SampleFields below) reset.
  const [factoryId, setFactoryId] = useState(factories[0]?.id ?? "");
  const [shiftType, setShiftType] = useState("DAY");
  const [shiftNumber, setShiftNumber] = useState("");
  const [source, setSource] = useState("");
  // Every delivery comes from the same single farm (MAFA 4 / farm code M4),
  // and ~95% of the crop is the Festival variety -- pre-filling both means
  // the common case needs no typing, while both stay freely editable for the
  // rare exception (and the ticket auto-fill below only touches a field
  // that's still blank, so these defaults don't fight it).
  const [farmCode, setFarmCode] = useState("M4");
  const [decapPackHouse, setDecapPackHouse] = useState("");
  const [decapQcApprover, setDecapQcApprover] = useState("");
  const [vehicleNo, setVehicleNo] = useState("");
  const [receiptNoteNo, setReceiptNoteNo] = useState("");
  const [varietyName, setVarietyName] = useState(DEFAULT_VARIETY);
  const [palletsReceived, setPalletsReceived] = useState("");

  const matchedTicket = useMemo(() => {
    const typed = receiptNoteNo.trim().toLowerCase();
    if (!typed) return undefined;
    return harvestTickets.find((t) => t.serialNumber.toLowerCase() === typed);
  }, [harvestTickets, receiptNoteNo]);

  // Auto-fills once per matched ticket (not on every keystroke) and only into
  // fields still blank, so it doesn't fight the "carries over between
  // consecutive samples" behavior these same fields already have.
  const lastAutoFilledTicketId = useRef<string | null>(null);
  useEffect(() => {
    if (!matchedTicket || lastAutoFilledTicketId.current === matchedTicket.id) return;
    lastAutoFilledTicketId.current = matchedTicket.id;
    const ticketVarieties = [...new Set(matchedTicket.plotLines.map((l) => l.varietyName).filter(Boolean))];
    setVehicleNo((v) => v || matchedTicket.vehicleNo || v);
    setFarmCode((v) => v || matchedTicket.authorizedGrower || v);
    if (ticketVarieties.length === 1) setVarietyName((v) => v || ticketVarieties[0]!);
  }, [matchedTicket]);

  const isSuccess = typeof state === "string" && state.startsWith("ok:");
  const errorMessage = typeof state === "string" && !isSuccess ? state : undefined;
  const decoded = isSuccess ? decodeActionResult(state) : null;

  const inspectedCount = receiptNoteNo
    ? todaysChecks.filter((c) => c.receiptNoteNo === receiptNoteNo && !c.appliesToWholeDelivery).length
    : 0;
  const palletsReceivedNum = Number(palletsReceived) || 0;

  return (
    <form action={formAction} className="space-y-4">
      <Card className="space-y-4">
        <h2 className="text-sm font-semibold text-slate-900">{dict.formTitle}</h2>
        <div className="grid grid-cols-3 gap-3">
          <FieldGroup label={dict.factoryLabel}>
            <Select name="factoryId" value={factoryId} onChange={(e) => setFactoryId(e.target.value)}>
              {factories.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </Select>
          </FieldGroup>
          <FieldGroup label={dict.shiftTypeLabel}>
            <Select name="shiftType" value={shiftType} onChange={(e) => setShiftType(e.target.value)}>
              <option value="DAY">{dict.shiftTypeDay}</option>
              <option value="NIGHT">{dict.shiftTypeNight}</option>
            </Select>
          </FieldGroup>
          <FieldGroup label={dict.shiftNumber}>
            <Input name="shiftNumber" value={shiftNumber} onChange={(e) => setShiftNumber(e.target.value)} />
          </FieldGroup>
          <FieldGroup label={dict.rawMaterialSource}>
            <Input name="rawMaterialSource" value={source} onChange={(e) => setSource(e.target.value)} />
          </FieldGroup>
          <FieldGroup label={dict.farmCode}>
            <Input name="farmCode" value={farmCode} onChange={(e) => setFarmCode(e.target.value)} />
          </FieldGroup>
          <FieldGroup label={dict.decapPackHouse}>
            <Input
              name="decapPackHouse"
              value={decapPackHouse}
              onChange={(e) => setDecapPackHouse(e.target.value)}
              placeholder={dict.decapPackHousePlaceholder}
            />
          </FieldGroup>
          <FieldGroup label={dict.qcApprover}>
            <Select
              name="decapQcApprover"
              value={decapQcApprover}
              onChange={(e) => setDecapQcApprover(e.target.value)}
            >
              <option value="">{dict.qcApproverPlaceholder}</option>
              {QC_NUMBERS.map((qc) => (
                <option key={qc} value={qc}>
                  {qc}
                </option>
              ))}
            </Select>
          </FieldGroup>
          <FieldGroup label={dict.transportVehicleNo}>
            <Input name="transportVehicleNo" value={vehicleNo} onChange={(e) => setVehicleNo(e.target.value)} />
          </FieldGroup>
          <FieldGroup label={dict.harvestTicketSerial}>
            <Input
              name="receiptNoteNo"
              list="harvest-ticket-suggestions"
              value={receiptNoteNo}
              onChange={(e) => setReceiptNoteNo(e.target.value)}
            />
            <datalist id="harvest-ticket-suggestions">
              {harvestTickets.map((t) => (
                <option key={t.id} value={t.serialNumber} />
              ))}
            </datalist>
            {receiptNoteNo.trim() &&
              (matchedTicket ? (
                <p className="mt-1 text-xs font-medium text-emerald-700">
                  {dict.matchedTicket
                    .replace("{vehicle}", matchedTicket.vehicleNo ?? "—")
                    .replace("{farm}", matchedTicket.authorizedGrower ?? "—")}
                </p>
              ) : (
                <p className="mt-1 text-xs font-medium text-red-600">{dict.noMatchingTicket}</p>
              ))}
          </FieldGroup>
          <FieldGroup label={dict.variety}>
            <Input name="varietyName" value={varietyName} onChange={(e) => setVarietyName(e.target.value)} />
          </FieldGroup>
          <FieldGroup label={dict.numberOfPallets}>
            <Input
              name="numberOfBoxesReceived"
              type="number"
              min="0"
              value={palletsReceived}
              onChange={(e) => setPalletsReceived(e.target.value)}
            />
          </FieldGroup>
        </div>
        {palletsReceivedNum > 0 && (
          <p className="text-xs text-slate-500">
            {dict.cratesNote}{" "}
            <Badge color={inspectedCount >= palletsReceivedNum ? "green" : "amber"}>
              {dict.cratesBadge
                .replace("{inspected}", String(inspectedCount))
                .replace("{total}", String(palletsReceivedNum))}
            </Badge>
          </p>
        )}
      </Card>

      {/* Remounts (resetting to defaults) whenever a new save succeeds. */}
      <SampleFields key={isSuccess ? state : "initial"} />

      {errorMessage && <p className="text-sm text-red-600">{errorMessage}</p>}
      {decoded && (
        <p className="text-sm">
          <Badge color={decoded.decision === "ACCEPTED" ? "green" : "red"}>
            {decoded.decision === "ACCEPTED" ? dict.acceptable : dict.unacceptable}
          </Badge>
        </p>
      )}
      {decoded && <QualityLimitWarning violations={decoded.violations} />}
      {isSuccess && <p className="text-sm font-medium text-emerald-700">{dict.saved}</p>}
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? fullDict.common.saving : dict.logSample}
      </Button>
    </form>
  );
}

function SampleFields() {
  const [wholeDelivery, setWholeDelivery] = useState(false);
  const { total: defectTotal, bind } = useDefectTotal(DECAP_SHARED_DEFECT_FIELDS);
  const dict = useTranslations().arrivalInspection;

  return (
    <>
      <Card className="space-y-4">
        <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
          <input
            type="checkbox"
            name="appliesToWholeDelivery"
            checked={wholeDelivery}
            onChange={(e) => setWholeDelivery(e.target.checked)}
          />
          {dict.rejectWholeDelivery}
        </label>
      </Card>

      {!wholeDelivery && (
        <>
          <Card className="space-y-4">
            <h2 className="text-sm font-semibold text-slate-900">{dict.sampleIdentityTitle}</h2>
            <div className="grid grid-cols-4 gap-3">
              <FieldGroup label={dict.sampleNo}>
                <Input name="sampleNo" required />
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
              <FieldGroup label={dict.ph}>
                <Input name="acidityPh" type="number" step="0.01" />
              </FieldGroup>
            </div>
          </Card>

          <Card className="space-y-4">
            <h2 className="text-sm font-semibold text-slate-900">{dict.physicalMeasurementsTitle}</h2>
            <div className="grid grid-cols-4 gap-3">
              <FieldGroup label={dict.crateWeight}>
                <Input name="crateWeightKg" type="number" step="0.1" />
              </FieldGroup>
              <FieldGroup label={dict.sizeCaliber}>
                <Input name="sizeCaliber" placeholder={dict.sizeCaliberPlaceholder} />
              </FieldGroup>
              <FieldGroup label={dict.brix}>
                <Input name="brix" type="number" step="0.1" required />
              </FieldGroup>
              <FieldGroup label={dict.fruitColor}>
                <Input name="fruitColorPct" type="number" step="0.1" min="0" max="100" />
              </FieldGroup>
              <FieldGroup label={dict.internalQuality}>
                <Input name="internalQualityPct" type="number" step="0.1" min="0" max="100" />
              </FieldGroup>
              <FieldGroup label={dict.foreignOdor}>
                <Input name="foreignOdor" placeholder={dict.nilPlaceholder} />
              </FieldGroup>
              <FieldGroup label={dict.foreignTaste}>
                <Input name="foreignTaste" placeholder={dict.nilPlaceholder} />
              </FieldGroup>
            </div>
          </Card>

          <Card className="space-y-4">
            <h2 className="text-sm font-semibold text-slate-900">{dict.defectsTitle}</h2>
            <div className="grid grid-cols-4 gap-3">
              <Pct name="incompleteMaturityPct" label={dict.incompleteMaturity} limit="1%" {...bind("incompleteMaturityPct")} />
              <Pct name="moldSignsPct" label={dict.moldSigns} limit="1%" {...bind("moldSignsPct")} />
              <Pct name="mouldPct" label={dict.mould} limit="0%" {...bind("mouldPct")} />
              <Pct name="capsuleRemainsPct" label={dict.capsuleRemains} limit="2%" {...bind("capsuleRemainsPct")} />
              <Pct name="birdFoodPct" label={dict.birdFood} limit="2%" {...bind("birdFoodPct")} />
              <Pct name="overmaturePct" label={dict.overmature} limit="5%" {...bind("overmaturePct")} />
              <Pct name="skinDamagePct" label={dict.skinDeformities} limit="2%" {...bind("skinDamagePct")} />
              <Pct name="shapeDeformitiesPct" label={dict.shapeDeformities} limit="3%" {...bind("shapeDeformitiesPct")} />
              <Pct name="seedClusteringPct" label={dict.seedClustering} limit="1%" {...bind("seedClusteringPct")} />
              <Pct name="bruisesPct" label={dict.bruises} limit="1%" {...bind("bruisesPct")} />
              <Pct name="dryCavitiesPct" label={dict.dryCavities} limit="1%" {...bind("dryCavitiesPct")} />
              <Pct name="overDecappingPct" label={dict.overDecapping} limit="1%" {...bind("overDecappingPct")} />
              <Pct name="oxidationPct" label={dict.oxidation} limit="4%" {...bind("oxidationPct")} />
              <Pct name="sandDustPct" label={dict.sandDust} limit="1%" {...bind("sandDustPct")} />
              <Pct name="insectsLarvaePct" label={dict.insectsLarvae} limit="0%" {...bind("insectsLarvaePct")} />
              <Pct name="foreignBodiesPct" label={dict.foreignBodies} limit="0%" {...bind("foreignBodiesPct")} />
              <FieldGroup label={dict.leafStemRemains}>
                <Input name="leafStemRemainsCount" type="number" step="0.1" min="0" />
              </FieldGroup>
              <Pct name="brokenUncleanPalletsPct" label={dict.brokenUncleanPallets} limit="0%" {...bind("brokenUncleanPalletsPct")} />
              <Pct name="unfumigatedPalletsPct" label={dict.unfumigatedPallets} limit="0%" {...bind("unfumigatedPalletsPct")} />
              <Pct name="brokenUncleanCratesPct" label={dict.brokenUncleanCrates} limit="0%" {...bind("brokenUncleanCratesPct")} />
            </div>
            <p className={cn("text-xs font-medium", defectTotal > TOTAL_DEFECTS_LIMIT ? "text-red-600" : "text-slate-400")}>
              {dict.runningTotal.replace("{total}", defectTotal.toFixed(1)).replace("{limit}", String(TOTAL_DEFECTS_LIMIT))}
            </p>
          </Card>
        </>
      )}

      <Card className="space-y-4">
        <FieldGroup label={dict.reasonOptional}>
          <Input name="notes" />
        </FieldGroup>
      </Card>
    </>
  );
}
