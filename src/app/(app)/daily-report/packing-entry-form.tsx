"use client";

import { useActionState } from "react";
import { addPackingLineAction } from "./actions";
import { Input, Select, FieldGroup } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { ClientOrOtherSelect } from "./client-or-other-select";
import { SelectWithOther } from "@/components/select-with-other";
import { CARTON_LOGO_OPTIONS } from "@/lib/cartonLogo";

export function PackingEntryForm({
  date,
  factories,
  clients,
}: {
  date: string;
  factories: { id: string; name: string; code: string | null }[];
  clients: { id: string; name: string }[];
}) {
  const [state, formAction, pending] = useActionState(addPackingLineAction, undefined);
  const errorMessage = state && state !== "ok" ? state : undefined;

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3">
      <input type="hidden" name="date" value={date} />
      <FieldGroup label="Plant (optional)">
        <Select name="factoryId" className="w-36">
          <option value="">—</option>
          {factories.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name} {f.code ? `(${f.code})` : ""}
            </option>
          ))}
        </Select>
      </FieldGroup>
      <FieldGroup label="Package">
        <Select name="packageType" required className="w-28">
          <option value="Carton">Carton</option>
          <option value="Bag">Bag</option>
        </Select>
      </FieldGroup>
      <FieldGroup label="Logo">
        <SelectWithOther name="logo" options={CARTON_LOGO_OPTIONS} otherPlaceholder="e.g. blue bag (samples)" />
      </FieldGroup>
      <FieldGroup label="Weight (kg)">
        <Input name="weightKg" type="number" step="0.1" className="w-20" />
      </FieldGroup>
      <FieldGroup label="Variety">
        <Input name="variety" defaultValue="MS1" className="w-20" />
      </FieldGroup>
      <FieldGroup label="Client">
        <ClientOrOtherSelect clients={clients} />
      </FieldGroup>
      <FieldGroup label="1st Class Qty">
        <Input name="firstClassQty" type="number" min="0" className="w-24" />
      </FieldGroup>
      <FieldGroup label="2nd Class Qty">
        <Input name="secondClassQty" type="number" min="0" className="w-24" />
      </FieldGroup>
      <FieldGroup label="Total Package Qty">
        <Input name="totalPackageQty" type="number" min="0" className="w-24" />
      </FieldGroup>
      <FieldGroup label="Total Ton">
        <Input name="totalTon" type="number" step="0.001" className="w-24" />
      </FieldGroup>
      <Button type="submit" variant="secondary" disabled={pending}>
        {pending ? "Saving…" : "Add row"}
      </Button>
      {errorMessage && <p className="w-full text-sm text-red-600">{errorMessage}</p>}
    </form>
  );
}
