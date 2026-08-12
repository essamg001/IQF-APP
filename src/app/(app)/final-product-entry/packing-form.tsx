"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { createPackedPalletAction } from "./actions";
import { Input, Select, FieldGroup } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CARTON_LOGO_OPTIONS } from "@/lib/cartonLogo";
import { FULL_PALLET_WEIGHT_TONNES, FULL_PALLET_CARTON_COUNT } from "@/lib/logistics";
import type { ProductionLot, Field, ColdRoom, QualityCheck, Pallet } from "@prisma/client";

type LotWithField = ProductionLot & { field: Field };
type PostFreezeCheck = QualityCheck & { pallet: Pallet | null };

export function PackingForm({
  lots,
  coldRooms,
  postFreezeChecks,
}: {
  lots: LotWithField[];
  coldRooms: ColdRoom[];
  postFreezeChecks: PostFreezeCheck[];
}) {
  const [state, formAction, pending] = useActionState(createPackedPalletAction, undefined);

  // Header fields carry over between consecutive pallets in the same packing run.
  const [packingDate, setPackingDate] = useState(new Date().toISOString().slice(0, 10));
  const [packingLocation, setPackingLocation] = useState("");
  const [packingSupervisor, setPackingSupervisor] = useState("");
  const [lotNumber, setLotNumber] = useState("");

  const isSuccess = typeof state === "string" && state.startsWith("ok:");
  const errorMessage = typeof state === "string" && !isSuccess ? state : undefined;

  const selectedLot = lots.find((l) => l.lotNumber.toLowerCase() === lotNumber.trim().toLowerCase());
  const lotChecks = useMemo(
    () => (selectedLot ? postFreezeChecks.filter((c) => c.lotId === selectedLot.id) : []),
    [postFreezeChecks, selectedLot]
  );

  if (lots.length === 0) {
    return <p className="text-sm text-slate-500">No production lots yet — nothing to pack against.</p>;
  }

  return (
    <form action={formAction} className="space-y-4">
      <Card className="space-y-4">
        <h2 className="text-sm font-semibold text-slate-900">Identification of Packed Pallets — GEN03115</h2>
        <div className="grid grid-cols-4 gap-3">
          <FieldGroup label="Packing Date">
            <Input
              name="packingDate"
              type="date"
              value={packingDate}
              onChange={(e) => setPackingDate(e.target.value)}
            />
          </FieldGroup>
          <FieldGroup label="Packing Location">
            <Select name="packingLocation" value={packingLocation} onChange={(e) => setPackingLocation(e.target.value)}>
              <option value="">—</option>
              <option value="IQF 1">IQF 1</option>
              <option value="IQF 2">IQF 2</option>
            </Select>
          </FieldGroup>
          <FieldGroup label="Supervisor">
            <Input name="packingSupervisor" value={packingSupervisor} onChange={(e) => setPackingSupervisor(e.target.value)} />
          </FieldGroup>
          <FieldGroup label="Lot number">
            <Input
              name="lotNumber"
              required
              list="lot-suggestions"
              placeholder="e.g. M41126146-1"
              value={lotNumber}
              onChange={(e) => setLotNumber(e.target.value)}
            />
            <datalist id="lot-suggestions">
              {lots.map((l) => (
                <option key={l.id} value={l.lotNumber} />
              ))}
            </datalist>
          </FieldGroup>
        </div>
      </Card>

      <PalletFields
        key={isSuccess ? state : "initial"}
        coldRooms={coldRooms}
        lotNumber={lotNumber || undefined}
        lotGrade={selectedLot?.grade}
        lotChecks={lotChecks}
      />

      {errorMessage && <p className="text-sm text-red-600">{errorMessage}</p>}
      {isSuccess && <p className="text-sm font-medium text-emerald-700">Saved — pallet recorded.</p>}
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Saving…" : "Record pallet"}
      </Button>
    </form>
  );
}

function PalletFields({
  coldRooms,
  lotNumber,
  lotGrade,
  lotChecks,
}: {
  coldRooms: ColdRoom[];
  lotNumber?: string;
  lotGrade?: "A" | "B";
  lotChecks: PostFreezeCheck[];
}) {
  const [isMixedVariety, setIsMixedVariety] = useState(false);
  const [palletNumber, setPalletNumber] = useState("");
  const [parcelStatus, setParcelStatus] = useState<"FULL" | "PARTIAL">("FULL");
  const isFull = parcelStatus === "FULL";

  // Post-Freeze Inspection is the first stage that ties produce to this
  // pallet number, so its variety, client, full/partial call, and fruit
  // diameter grading all carry over here rather than being re-typed --
  // matched once the pallet number matches that check's pallet exactly.
  const matchedCheck = useMemo(() => {
    const typed = palletNumber.trim().toLowerCase();
    if (typed) {
      const exact = lotChecks.find((c) => c.pallet?.palletNumber.toLowerCase() === typed);
      if (exact) return exact;
    }
    return lotChecks.find((c) => !c.palletId) ?? null;
  }, [lotChecks, palletNumber]);

  useEffect(() => {
    setParcelStatus(matchedCheck?.fullPallet === false ? "PARTIAL" : "FULL");
  }, [matchedCheck]);

  return (
    <Card className="space-y-4">
      <div className="grid grid-cols-4 gap-3">
        <FieldGroup label="Pallet No.">
          <Input
            name="palletNumber"
            required
            list="pending-pallet-suggestions"
            placeholder={lotNumber ? `${lotNumber}-P1` : undefined}
            value={palletNumber}
            onChange={(e) => setPalletNumber(e.target.value)}
          />
          <datalist id="pending-pallet-suggestions">
            {lotChecks
              .filter((c) => c.pallet && c.pallet.totalCartons == null)
              .map((c) => (
                <option key={c.pallet!.id} value={c.pallet!.palletNumber} />
              ))}
          </datalist>
        </FieldGroup>
        <FieldGroup label="Carton Logo">
          <Select name="cartonLogo" defaultValue="">
            <option value="">—</option>
            {CARTON_LOGO_OPTIONS.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </Select>
        </FieldGroup>
        <FieldGroup label="Size">
          <Input name="cartonSize" />
        </FieldGroup>
        <FieldGroup label="Variety">
          <Input key={matchedCheck?.id ?? "none-variety"} name="variety" defaultValue={matchedCheck?.varietyName ?? ""} />
        </FieldGroup>
        <FieldGroup label="Client">
          <Input
            key={matchedCheck?.id ?? "none-client"}
            name="clientSpecNote"
            placeholder="Client name, if known"
            defaultValue={matchedCheck?.clientName ?? ""}
          />
        </FieldGroup>
        <FieldGroup label="Quality Grade">
          <Select name="qualityGrade" defaultValue={lotGrade ?? ""}>
            <option value="">—</option>
            <option value="A">Grade A</option>
            <option value="B">Grade B</option>
          </Select>
        </FieldGroup>
        <FieldGroup label="Parcels">
          <Select
            name="parcelStatus"
            value={parcelStatus}
            onChange={(e) => setParcelStatus(e.target.value as "FULL" | "PARTIAL")}
          >
            <option value="FULL">Full pallet</option>
            <option value="PARTIAL">Partial</option>
          </Select>
        </FieldGroup>
        <FieldGroup label="Total No. of Cartons">
          {isFull ? (
            <>
              <input type="hidden" name="totalCartons" value={FULL_PALLET_CARTON_COUNT} />
              <p className="flex h-9 items-center text-sm text-slate-600">{FULL_PALLET_CARTON_COUNT} (full pallet)</p>
            </>
          ) : (
            <Input name="totalCartons" type="number" min="1" />
          )}
        </FieldGroup>
        <FieldGroup label="Weight (tonnes)">
          {isFull ? (
            <>
              <input type="hidden" name="weightTonnes" value={FULL_PALLET_WEIGHT_TONNES} />
              <p className="flex h-9 items-center text-sm text-slate-600">{FULL_PALLET_WEIGHT_TONNES} t (full pallet)</p>
            </>
          ) : (
            <Input name="weightTonnes" type="number" step="0.01" min="0" required />
          )}
        </FieldGroup>
        <FieldGroup label="Cold Room">
          <Select name="coldRoomId" defaultValue="">
            <option value="">—</option>
            {coldRooms.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </FieldGroup>
        <FieldGroup label="Product">
          <Select
            name="isMixedVariety"
            value={isMixedVariety ? "on" : "off"}
            onChange={(e) => setIsMixedVariety(e.target.value === "on")}
          >
            <option value="off">One variety</option>
            <option value="on">Mixed varieties</option>
          </Select>
        </FieldGroup>
        <FieldGroup label="Beginning of Palletization">
          <Input name="palletizationStart" type="datetime-local" />
        </FieldGroup>
        <FieldGroup label="End of Palletization">
          <Input name="palletizationEnd" type="datetime-local" />
        </FieldGroup>
      </div>

      <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
        <p className="mb-2 text-xs font-semibold text-slate-600">Fruit Diameter</p>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" name="fruitDiameterCalibrated" className="h-4 w-4 rounded border-slate-300" />
          Calibrated (unchecked = Uncalibrated)
        </label>
      </div>
    </Card>
  );
}
