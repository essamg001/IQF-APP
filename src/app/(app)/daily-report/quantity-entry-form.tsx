"use client";

import { useActionState } from "react";
import { addQuantityEntryAction } from "./actions";
import { Input, Select, FieldGroup } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { useTranslations } from "@/lib/i18n/locale-context";

function PctPair({
  label,
  tonName,
  pctName,
  tonPlaceholder,
  pctPlaceholder,
}: {
  label: string;
  tonName: string;
  pctName: string;
  tonPlaceholder: string;
  pctPlaceholder: string;
}) {
  return (
    <FieldGroup label={label}>
      <div className="flex gap-1">
        <Input name={tonName} type="number" step="0.001" placeholder={tonPlaceholder} className="w-20" />
        <Input name={pctName} type="number" step="0.1" placeholder={pctPlaceholder} className="w-16" />
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
  const fullDict = useTranslations();
  const dict = fullDict.dailyReport;
  const [state, formAction, pending] = useActionState(addQuantityEntryAction, undefined);
  const errorMessage = state && state !== "ok" ? state : undefined;

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="date" value={date} />
      <div className="flex flex-wrap items-end gap-3">
        <FieldGroup label={dict.plant}>
          <Select name="factoryId" required className="w-40">
            <option value="">—</option>
            {factories.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name} {f.code ? `(${f.code})` : ""}
              </option>
            ))}
          </Select>
        </FieldGroup>
        <FieldGroup label={dict.shift}>
          <Select name="shiftType" required className="w-32">
            <option value="DAY">{dict.shift1Day}</option>
            <option value="NIGHT">{dict.shift2Night}</option>
          </Select>
        </FieldGroup>
        <FieldGroup label={fullDict.common.variety}>
          <Input name="variety" required defaultValue="MS1" className="w-24" />
        </FieldGroup>
        <FieldGroup label={dict.firstBalanceTonLabel}>
          <Input name="firstBalanceTon" type="number" step="0.001" className="w-24" />
        </FieldGroup>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <PctPair
          label={dict.rawIncomingLabel}
          tonName="rawIncomingTon"
          pctName="rawIncomingPct"
          tonPlaceholder={dict.tonPlaceholder}
          pctPlaceholder={dict.pctPlaceholder}
        />
        <PctPair
          label={dict.inletForOperationLabel}
          tonName="inletForOperationTon"
          pctName="inletForOperationPct"
          tonPlaceholder={dict.tonPlaceholder}
          pctPlaceholder={dict.pctPlaceholder}
        />
        <PctPair
          label={dict.endBalanceLabel}
          tonName="endBalanceTon"
          pctName="endBalancePct"
          tonPlaceholder={dict.tonPlaceholder}
          pctPlaceholder={dict.pctPlaceholder}
        />
        <PctPair
          label={dict.firstClassWholeLabel}
          tonName="firstClassWholeTon"
          pctName="firstClassWholePct"
          tonPlaceholder={dict.tonPlaceholder}
          pctPlaceholder={dict.pctPlaceholder}
        />
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <PctPair
          label={dict.secondClassWholeLabel}
          tonName="secondClassWholeTon"
          pctName="secondClassWholePct"
          tonPlaceholder={dict.tonPlaceholder}
          pctPlaceholder={dict.pctPlaceholder}
        />
        <PctPair
          label={dict.rejectedBeforeTunnelLabel}
          tonName="rejectedBeforeTunnelTon"
          pctName="rejectedBeforeTunnelPct"
          tonPlaceholder={dict.tonPlaceholder}
          pctPlaceholder={dict.pctPlaceholder}
        />
        <PctPair
          label={dict.rejectedAfterTunnelLabel}
          tonName="rejectedAfterTunnelTon"
          pctName="rejectedAfterTunnelPct"
          tonPlaceholder={dict.tonPlaceholder}
          pctPlaceholder={dict.pctPlaceholder}
        />
        <PctPair
          label={dict.totalPacked}
          tonName="totalPackedTon"
          pctName="totalPackedPct"
          tonPlaceholder={dict.tonPlaceholder}
          pctPlaceholder={dict.pctPlaceholder}
        />
        <PctPair
          label={dict.lostReconciliationLabel}
          tonName="lostTon"
          pctName="lostPct"
          tonPlaceholder={dict.tonPlaceholder}
          pctPlaceholder={dict.pctPlaceholder}
        />
        <Button type="submit" variant="secondary" disabled={pending}>
          {pending ? fullDict.common.saving : dict.addRow}
        </Button>
      </div>
      {errorMessage && <p className="text-sm text-red-600">{errorMessage}</p>}
    </form>
  );
}
