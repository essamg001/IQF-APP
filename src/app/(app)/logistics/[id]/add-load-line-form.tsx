"use client";

import { useActionState, useState } from "react";
import { addPalletLoadLineAction } from "../actions";
import { decodeSpecBlock } from "@/lib/specCompliance";
import { SpecExceptionForm } from "./spec-exception-form";
import { Input, Select, FieldGroup } from "@/components/ui/field";
import { ConfirmSubmitButton } from "@/components/ui/confirm-submit-button";

type EligiblePallet = { id: string; palletNumber: string; remaining: number; lotNumber: string };

export function AddLoadLineForm({
  containerId,
  pallets,
  canSignOffSpecException,
}: {
  containerId: string;
  pallets: EligiblePallet[];
  canSignOffSpecException: boolean;
}) {
  const boundAction = addPalletLoadLineAction.bind(null, containerId);
  const [error, formAction, pending] = useActionState(boundAction, undefined);
  const [selectedId, setSelectedId] = useState(pallets[0]?.id ?? "");
  const [quantity, setQuantity] = useState(pallets[0]?.remaining.toFixed(2) ?? "");
  const specBlock = decodeSpecBlock(error);

  if (pallets.length === 0) {
    return <p className="text-sm text-slate-400">No allocated pallets with remaining tonnage for this order.</p>;
  }

  return (
    <div className="flex flex-wrap items-end gap-3">
      <form action={formAction} className="flex flex-wrap items-end gap-3">
        <FieldGroup label="Pallet">
          <Select
            name="palletId"
            value={selectedId}
            onChange={(e) => {
              setSelectedId(e.target.value);
              const p = pallets.find((p) => p.id === e.target.value);
              setQuantity(p ? p.remaining.toFixed(2) : "");
            }}
            className="w-80"
          >
            {pallets.map((p) => (
              <option key={p.id} value={p.id}>
                {p.palletNumber} — {p.remaining.toFixed(2)}t remaining — Lot {p.lotNumber}
              </option>
            ))}
          </Select>
        </FieldGroup>
        <FieldGroup label="Quantity to load (t)">
          <Input
            name="quantityTonnes"
            type="number"
            step="0.01"
            min="0.01"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            className="w-32"
          />
        </FieldGroup>
        <ConfirmSubmitButton
          confirmMessage={`Load ${quantity}t of pallet ${
            pallets.find((p) => p.id === selectedId)?.palletNumber ?? selectedId
          } into this container? This physically commits it to the shipment and frees its storage slot once fully loaded.`}
          disabled={pending}
          className="inline-flex items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-900 transition-colors hover:bg-slate-50 disabled:opacity-50 disabled:pointer-events-none"
        >
          {pending ? "Adding…" : "Add to manifest"}
        </ConfirmSubmitButton>
        {error && !specBlock && <p className="w-full text-sm text-red-600">{error}</p>}
      </form>
      {specBlock && <SpecExceptionForm payload={specBlock} canSignOff={canSignOffSpecException} />}
    </div>
  );
}
