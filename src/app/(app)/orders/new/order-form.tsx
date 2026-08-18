"use client";

import { useActionState, useMemo, useState } from "react";
import { createOrderAction } from "../actions";
import { Input, Select, FieldGroup } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DEFECT_FIELDS } from "@/lib/validation/client";
import { FULL_PALLET_WEIGHT_TONNES } from "@/lib/logistics";
import { useTranslations } from "@/lib/i18n/locale-context";
import type { Client, ClientSpec, Grade, Format } from "@prisma/client";

type ClientWithSpecs = Client & { specs: ClientSpec[] };

export function OrderForm({ clients }: { clients: ClientWithSpecs[] }) {
  const [error, formAction, pending] = useActionState(createOrderAction, undefined);
  const dict = useTranslations().orders;

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

  const formatLabel = { WHOLE: dict.formatWhole, SLICED: dict.formatSliced, DICED: dict.formatDiced }[format];

  return (
    <form action={formAction}>
      <Card className="space-y-4">
        <FieldGroup label={dict.poNumberOptional}>
          <Input name="poNumber" placeholder={dict.poNumberPlaceholder} />
        </FieldGroup>
        <FieldGroup label={dict.clientLabel}>
          <Select name="clientId" required value={clientId} onChange={(e) => setClientId(e.target.value)}>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </FieldGroup>
        <div className="grid grid-cols-2 gap-3">
          <FieldGroup label={dict.gradeLabelField}>
            <Select name="grade" required value={grade} onChange={(e) => setGrade(e.target.value as Grade)}>
              <option value="A">{dict.gradeLabel.replace("{grade}", "A")}</option>
              <option value="B">{dict.gradeLabel.replace("{grade}", "B")}</option>
            </Select>
          </FieldGroup>
          <FieldGroup label={dict.formatLabelField}>
            <Select name="format" required value={format} onChange={(e) => setFormat(e.target.value as Format)}>
              <option value="WHOLE">{dict.formatWhole}</option>
              <option value="SLICED">{dict.formatSliced}</option>
              <option value="DICED">{dict.formatDiced}</option>
            </Select>
          </FieldGroup>
        </div>

        {matchedSpec ? (
          <div className="rounded-md border border-emerald-200 bg-emerald-50/40 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-800">
              {dict.clientSpecTitle.replace("{specName}", matchedSpec.specName)}
            </p>
            <div className="mt-2 grid grid-cols-3 gap-x-4 gap-y-1 text-xs text-slate-700">
              {matchedSpec.brix && <SpecRow label={dict.brix} value={matchedSpec.brix} />}
              {matchedSpec.ph && <SpecRow label={dict.ph} value={matchedSpec.ph} />}
              {matchedSpec.sizeCaliber && <SpecRow label={dict.sizeCaliber} value={matchedSpec.sizeCaliber} />}
              {DEFECT_FIELDS.map(
                ({ key, label }) =>
                  matchedSpec[key] && <SpecRow key={key} label={label} value={matchedSpec[key] as string} />
              )}
            </div>
            {matchedSpec.notes && <p className="mt-2 text-xs italic text-slate-500">{matchedSpec.notes}</p>}
          </div>
        ) : (
          <p className="text-xs text-amber-700">
            {dict.noSpecOnFile.replace("{format}", formatLabel).replace("{grade}", grade)}
          </p>
        )}

        <FieldGroup label={dict.quantityTonnesLabel}>
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
            <p className="mt-1 text-xs text-slate-400">
              {dict.estimatedPallets.replace("{count}", String(estimatedPallets)).replace("{weight}", String(FULL_PALLET_WEIGHT_TONNES))}
            </p>
          )}
        </FieldGroup>
        <FieldGroup label={dict.orderDateLabel}>
          <Input name="orderDate" type="date" required />
        </FieldGroup>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <Button type="submit" disabled={pending}>
          {pending ? dict.saving : dict.createOrder}
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
