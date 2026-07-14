"use client";

import { useActionState, useState } from "react";
import { createPackedPalletAction } from "./actions";
import { Input, Select, FieldGroup } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { ProductionLot, Field, ColdRoom } from "@prisma/client";

type LotWithField = ProductionLot & { field: Field };

export function PackingForm({ lots, coldRooms }: { lots: LotWithField[]; coldRooms: ColdRoom[] }) {
  const [state, formAction, pending] = useActionState(createPackedPalletAction, undefined);

  // Header fields carry over between consecutive pallets in the same packing run.
  const [packingDate, setPackingDate] = useState(new Date().toISOString().slice(0, 10));
  const [packingLocation, setPackingLocation] = useState("");
  const [packingSupervisor, setPackingSupervisor] = useState("");
  const [lotId, setLotId] = useState(lots[0]?.id ?? "");

  const isSuccess = typeof state === "string" && state.startsWith("ok:");
  const errorMessage = typeof state === "string" && !isSuccess ? state : undefined;

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
            <Input name="packingLocation" value={packingLocation} onChange={(e) => setPackingLocation(e.target.value)} />
          </FieldGroup>
          <FieldGroup label="Supervisor">
            <Input name="packingSupervisor" value={packingSupervisor} onChange={(e) => setPackingSupervisor(e.target.value)} />
          </FieldGroup>
          <FieldGroup label="Lot">
            <Select name="lotId" required value={lotId} onChange={(e) => setLotId(e.target.value)}>
              {lots.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.lotNumber} — {l.field.name} (Grade {l.grade})
                </option>
              ))}
            </Select>
          </FieldGroup>
        </div>
      </Card>

      <PalletFields key={isSuccess ? state : "initial"} coldRooms={coldRooms} lotNumber={lots.find((l) => l.id === lotId)?.lotNumber} />

      {errorMessage && <p className="text-sm text-red-600">{errorMessage}</p>}
      {isSuccess && <p className="text-sm font-medium text-emerald-700">Saved — pallet recorded.</p>}
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Saving…" : "Record pallet"}
      </Button>
    </form>
  );
}

function PalletFields({ coldRooms, lotNumber }: { coldRooms: ColdRoom[]; lotNumber?: string }) {
  const [isMixedVariety, setIsMixedVariety] = useState(false);

  return (
    <Card className="space-y-4">
      <div className="grid grid-cols-4 gap-3">
        <FieldGroup label="Pallet No.">
          <Input name="palletNumber" required placeholder={lotNumber ? `${lotNumber}-P1` : undefined} />
        </FieldGroup>
        <FieldGroup label="Carton Logo">
          <Input name="cartonLogo" />
        </FieldGroup>
        <FieldGroup label="Size">
          <Input name="cartonSize" />
        </FieldGroup>
        <FieldGroup label="Variety">
          <Input name="variety" />
        </FieldGroup>
        <FieldGroup label="Traceability Code / Lot">
          <Input name="traceabilityCode" defaultValue={lotNumber} />
        </FieldGroup>
        <FieldGroup label="Client / Quality Grade">
          <Input name="clientSpecNote" placeholder="Client name / spec, if known" />
        </FieldGroup>
        <FieldGroup label="Total No. of Cartons">
          <Input name="totalCartons" type="number" min="1" />
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
        <FieldGroup label="Parcels">
          <Select name="parcelStatus" defaultValue="FULL">
            <option value="FULL">Full pallet</option>
            <option value="PARTIAL">Partial</option>
          </Select>
        </FieldGroup>
        <FieldGroup label="Beginning of Palletization">
          <Input name="palletizationStart" type="datetime-local" />
        </FieldGroup>
        <FieldGroup label="End of Palletization">
          <Input name="palletizationEnd" type="datetime-local" />
        </FieldGroup>
      </div>
    </Card>
  );
}
