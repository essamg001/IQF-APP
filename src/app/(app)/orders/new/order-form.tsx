"use client";

import { useActionState, useMemo, useState } from "react";
import { createOrderAction } from "../actions";
import { Input, Select, FieldGroup } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FORMAT_LABEL } from "@/lib/format";
import { DEFECT_FIELDS } from "@/lib/validation/client";
import { FULL_PALLET_WEIGHT_TONNES } from "@/lib/logistics";
import type { Client, ClientSpec, Grade, Format } from "@prisma/client";

type ClientWithSpecs = Client & { specs: ClientSpec[] };

export function OrderForm({ clients }: { clients: ClientWithSpecs[] }) {
  const [error, formAction, pending] = useActionState(createOrderAction, undefined);

  const [clientId, setClientId] = useState(clients[0]?.id ?? "");
  const [grade, setGrade] = useState<Grade>("A");
  const [format, setFormat] = useState<Format>("WHOLE");
  const [quantityTonnes, setQuantityTonnes] = useState("");

  const matchedSpec = useMemo(() => {
    const client = clients.find((c) => c.id === clientId);
    return client?.specs.find((s) => s.grade === grade && s.format === format);
  }, [clients, clientId, grade, format]);

  const estimatedPallets = quantityTonnes
    ? Math.max(1, Math.round(Number(quantityTonnes) / FULL_PALLET_WEIGHT_TONNES))
    : null;

  return (
    <form action={formAction}>
      <Card className="space-y-4">
        <FieldGroup label="PO Number (optional)">
          <Input name="poNumber" placeholder="Client's purchase order number, if provided" />
        </FieldGroup>
        <FieldGroup label="Client">
          <Select name="clientId" required value={clientId} onChange={(e) => setClientId(e.target.value)}>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </FieldGroup>
        <div className="grid grid-cols-2 gap-3">
          <FieldGroup label="Grade">
            <Select name="grade" required value={grade} onChange={(e) => setGrade(e.target.value as Grade)}>
              <option value="A">Grade A</option>
              <option value="B">Grade B</option>
            </Select>
          </FieldGroup>
          <FieldGroup label="Format">
            <Select name="format" required value={format} onChange={(e) => setFormat(e.target.value as Format)}>
              <option value="WHOLE">Whole</option>
              <option value="SLICED">Sliced</option>
              <option value="DICED">Diced</option>
            </Select>
          </FieldGroup>
        </div>

        {matchedSpec ? (
          <div className="rounded-md border border-emerald-200 bg-emerald-50/40 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-800">
              Client Spec — {matchedSpec.specName}
            </p>
            <div className="mt-2 grid grid-cols-3 gap-x-4 gap-y-1 text-xs text-slate-700">
              {matchedSpec.brix && <SpecRow label="Brix" value={matchedSpec.brix} />}
              {matchedSpec.ph && <SpecRow label="PH" value={matchedSpec.ph} />}
              {matchedSpec.sizeCaliber && <SpecRow label="Size Caliber" value={matchedSpec.sizeCaliber} />}
              {DEFECT_FIELDS.map(
                ({ key, label }) =>
                  matchedSpec[key] && <SpecRow key={key} label={label} value={matchedSpec[key] as string} />
              )}
            </div>
            {matchedSpec.notes && <p className="mt-2 text-xs italic text-slate-500">{matchedSpec.notes}</p>}
          </div>
        ) : (
          <p className="text-xs text-amber-700">
            No spec on file for this client&apos;s {FORMAT_LABEL[format]} Grade {grade} — confirm requirements with the
            client before confirming this order.
          </p>
        )}

        <FieldGroup label="Quantity (tonnes)">
          <Input
            name="quantityTonnes"
            type="number"
            step="0.1"
            min="0.1"
            required
            value={quantityTonnes}
            onChange={(e) => setQuantityTonnes(e.target.value)}
          />
          {estimatedPallets && (
            <p className="mt-1 text-xs text-slate-400">≈ {estimatedPallets} pallets at {FULL_PALLET_WEIGHT_TONNES}t each</p>
          )}
        </FieldGroup>
        <FieldGroup label="Order date">
          <Input name="orderDate" type="date" required />
        </FieldGroup>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Create order"}
        </Button>
      </Card>
    </form>
  );
}

function SpecRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="inline text-slate-400">{label}: </dt>
      <dd className="inline font-medium">{value}</dd>
    </div>
  );
}
