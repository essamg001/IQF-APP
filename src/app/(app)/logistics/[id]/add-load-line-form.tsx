"use client";

import { useActionState, useState } from "react";
import { addPalletLoadLineAction } from "../actions";
import { Input, Select, FieldGroup } from "@/components/ui/field";
import { Button } from "@/components/ui/button";

type EligiblePallet = { id: string; palletNumber: string; remaining: number };

export function AddLoadLineForm({ containerId, pallets }: { containerId: string; pallets: EligiblePallet[] }) {
  const boundAction = addPalletLoadLineAction.bind(null, containerId);
  const [error, formAction, pending] = useActionState(boundAction, undefined);
  const [selectedId, setSelectedId] = useState(pallets[0]?.id ?? "");
  const [quantity, setQuantity] = useState(pallets[0]?.remaining.toFixed(2) ?? "");

  if (pallets.length === 0) {
    return <p className="text-sm text-slate-400">No allocated pallets with remaining tonnage for this order.</p>;
  }

  return (
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
          className="w-64"
        >
          {pallets.map((p) => (
            <option key={p.id} value={p.id}>
              {p.palletNumber} — {p.remaining.toFixed(2)}t remaining
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
      <Button type="submit" variant="secondary" disabled={pending}>
        {pending ? "Adding…" : "Add to manifest"}
      </Button>
      {error && <p className="w-full text-sm text-red-600">{error}</p>}
    </form>
  );
}
