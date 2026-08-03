"use client";

import { useActionState } from "react";
import { addQuantityEntryAction } from "./actions";
import { Input, Select, FieldGroup } from "@/components/ui/field";
import { Button } from "@/components/ui/button";

function PctPair({ label, tonName, pctName }: { label: string; tonName: string; pctName: string }) {
  return (
    <FieldGroup label={label}>
      <div className="flex gap-1">
        <Input name={tonName} type="number" step="0.001" placeholder="ton" className="w-20" />
        <Input name={pctName} type="number" step="0.1" placeholder="%" className="w-16" />
      </div>
    </FieldGroup>
  );
}

export function QuantityEntryForm({
  date,
  factories,
}: {
  date: string;
  factories: { id: string; name: string; code: string | null }[];
}) {
  const [state, formAction, pending] = useActionState(addQuantityEntryAction, undefined);
  const errorMessage = state && state !== "ok" ? state : undefined;

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="date" value={date} />
      <div className="flex flex-wrap items-end gap-3">
        <FieldGroup label="Plant">
          <Select name="factoryId" required className="w-40">
            <option value="">—</option>
            {factories.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name} {f.code ? `(${f.code})` : ""}
              </option>
            ))}
          </Select>
        </FieldGroup>
        <FieldGroup label="Shift">
          <Select name="shiftType" required className="w-32">
            <option value="DAY">Shift 1 (Day)</option>
            <option value="NIGHT">Shift 2 (Night)</option>
          </Select>
        </FieldGroup>
        <FieldGroup label="Variety">
          <Input name="variety" required defaultValue="MS1" className="w-24" />
        </FieldGroup>
        <FieldGroup label="First Balance (ton)">
          <Input name="firstBalanceTon" type="number" step="0.001" className="w-24" />
        </FieldGroup>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <PctPair label="Raw Incoming" tonName="rawIncomingTon" pctName="rawIncomingPct" />
        <PctPair label="Inlet for Operation" tonName="inletForOperationTon" pctName="inletForOperationPct" />
        <PctPair label="End Balance" tonName="endBalanceTon" pctName="endBalancePct" />
        <PctPair label="1st Class Whole" tonName="firstClassWholeTon" pctName="firstClassWholePct" />
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <PctPair label="2nd Class Whole" tonName="secondClassWholeTon" pctName="secondClassWholePct" />
        <PctPair label="Rejected (before tunnel)" tonName="rejectedBeforeTunnelTon" pctName="rejectedBeforeTunnelPct" />
        <PctPair label="Rejected (after tunnel)" tonName="rejectedAfterTunnelTon" pctName="rejectedAfterTunnelPct" />
        <PctPair label="Total Packed" tonName="totalPackedTon" pctName="totalPackedPct" />
        <PctPair label="Lost / reconciliation" tonName="lostTon" pctName="lostPct" />
        <Button type="submit" variant="secondary" disabled={pending}>
          {pending ? "Saving…" : "Add row"}
        </Button>
      </div>
      {errorMessage && <p className="text-sm text-red-600">{errorMessage}</p>}
    </form>
  );
}
