"use client";

import { useActionState, useMemo, useState } from "react";
import { createPostFreezeCheckAction } from "./actions";
import { Input, Select, FieldGroup } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { ProductionLot, Field, Pallet } from "@prisma/client";

type LotWithRelations = ProductionLot & { field: Field; pallets: Pallet[] };

export function PostFreezeInspectionForm({ lots }: { lots: LotWithRelations[] }) {
  const [state, formAction, pending] = useActionState(createPostFreezeCheckAction, undefined);
  const [lotId, setLotId] = useState(lots[0]?.id ?? "");

  const pallets = useMemo(() => lots.find((l) => l.id === lotId)?.pallets ?? [], [lots, lotId]);

  const isSuccess = typeof state === "string" && state.startsWith("ok:");
  const errorMessage = typeof state === "string" && !isSuccess ? state : undefined;

  if (lots.length === 0) {
    return <p className="text-sm text-slate-500">No production lots yet — nothing to inspect.</p>;
  }

  return (
    <form action={formAction} className="space-y-4">
      <Card className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <FieldGroup label="Lot">
            <Select name="lotId" required value={lotId} onChange={(e) => setLotId(e.target.value)}>
              {lots.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.lotNumber} — {l.field.name} (Grade {l.grade})
                </option>
              ))}
            </Select>
          </FieldGroup>
          <FieldGroup label="Pallet (optional — this specific pallet's sample)">
            {/* Remounts on each successful save so it doesn't stick to the last pallet picked. */}
            <PalletSelect key={isSuccess ? state : "initial"} pallets={pallets} />
          </FieldGroup>
        </div>
      </Card>

      <MeasurementFields key={isSuccess ? state : "initial"} />

      {errorMessage && <p className="text-sm text-red-600">{errorMessage}</p>}
      {isSuccess && <p className="text-sm font-medium text-emerald-700">Saved — logged.</p>}
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Saving…" : "Log check"}
      </Button>
    </form>
  );
}

function PalletSelect({ pallets }: { pallets: Pallet[] }) {
  return (
    <Select name="palletId" defaultValue="">
      <option value="">— Lot-level check —</option>
      {pallets.map((p) => (
        <option key={p.id} value={p.id}>
          {p.palletNumber}
        </option>
      ))}
    </Select>
  );
}

function MeasurementFields() {
  return (
    <Card className="space-y-4">
      <h2 className="text-sm font-semibold text-slate-900">Final Product (Frozen) — STR03111 / STR03116</h2>
      <div className="grid grid-cols-4 gap-3">
        <FieldGroup label="Brix">
          <Input name="brix" type="number" step="0.1" required />
        </FieldGroup>
        <FieldGroup label="Size Caliber">
          <Input name="sizeCaliber" placeholder="25-40mm" />
        </FieldGroup>
        <FieldGroup label="Fruit Color (%)">
          <Input name="fruitColorPct" type="number" step="0.1" min="0" max="100" defaultValue={0} />
        </FieldGroup>
        <FieldGroup label="Internal Quality (%)">
          <Input name="internalQualityPct" type="number" step="0.1" min="0" max="100" defaultValue={0} />
        </FieldGroup>
        <FieldGroup label="Mould (%)">
          <Input name="mouldPct" type="number" step="0.1" min="0" max="100" defaultValue={0} />
        </FieldGroup>
        <FieldGroup label="Skin Damage (%)">
          <Input name="skinDamagePct" type="number" step="0.1" min="0" max="100" defaultValue={0} />
        </FieldGroup>
        <FieldGroup label="Overmature / Soft Texture (%)">
          <Input name="overmaturePct" type="number" step="0.1" />
        </FieldGroup>
        <FieldGroup label="Foreign Odor">
          <Input name="foreignOdor" placeholder="NIL" />
        </FieldGroup>
        <FieldGroup label="Foreign Taste">
          <Input name="foreignTaste" placeholder="NIL" />
        </FieldGroup>
      </div>
      <div className="flex gap-6">
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" name="fullPallet" /> Full pallet
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" name="packageClosureOk" /> Package closure OK
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" name="dataLabelReviewOk" /> Data label review OK
        </label>
      </div>
      <FieldGroup label="Notes (optional)">
        <Input name="notes" />
      </FieldGroup>
    </Card>
  );
}
