"use client";

import { useActionState } from "react";
import { overrideSpecExceptionAction } from "../actions";
import type { SpecBlockPayload } from "@/lib/specCompliance";
import { Input, FieldGroup } from "@/components/ui/field";
import { Button } from "@/components/ui/button";

// Shown when addPalletLoadLineAction blocks a load because the pallet fails
// one or more of the destination client's spec parameters (see
// src/lib/specCompliance.ts) -- mirrors the shape of
// src/app/(app)/alerts/quality-override-actions.tsx (name + typed signature
// + note), but only the Owner or a Head of Production can actually submit it
// (canSignOff, computed server-side from session.user in the parent page) --
// everyone else just sees who needs to be brought in.
export function SpecExceptionForm({ payload, canSignOff }: { payload: SpecBlockPayload; canSignOff: boolean }) {
  const [state, formAction, pending] = useActionState(overrideSpecExceptionAction, undefined);
  const errorMessage = typeof state === "string" && state !== "ok" ? state : undefined;

  return (
    <div className="w-full rounded-md border border-red-300 bg-red-50 p-3">
      <p className="text-sm font-medium text-red-800">
        Blocked: pallet {payload.palletNumber} (Lot {payload.lotNumber}) fails {payload.clientName}&apos;s spec:
      </p>
      <ul className="mt-1 space-y-0.5 text-xs text-red-700">
        {payload.violations.map((v) => (
          <li key={v.key}>
            {v.label}: measured {v.measuredDisplay} — spec {v.specLimitDisplay}
          </li>
        ))}
      </ul>

      {!canSignOff && (
        <p className="mt-2 text-xs text-slate-600">
          Only the Owner or a Head of Production can sign off loading this pallet anyway.
        </p>
      )}

      {canSignOff && (
        <form action={formAction} className="mt-3 space-y-2 rounded-md border border-amber-300 bg-amber-50 p-2">
          <input type="hidden" name="palletId" value={payload.palletId} />
          <input type="hidden" name="containerId" value={payload.containerId} />
          <input type="hidden" name="quantityTonnes" value={payload.quantityTonnes} />
          <input type="hidden" name="violationsJson" value={JSON.stringify(payload.violations)} />
          <p className="text-xs font-medium text-amber-800">
            Signing off means you take responsibility for this pallet shipping despite failing the client&apos;s spec.
          </p>
          <FieldGroup label="Your Name">
            <Input name="name" required className="text-sm" />
          </FieldGroup>
          <FieldGroup label="Signature (type to confirm)">
            <Input name="signature" required className="text-sm" placeholder="Type your name again to sign" />
          </FieldGroup>
          <FieldGroup label="Note (optional)">
            <Input name="note" className="text-sm" />
          </FieldGroup>
          {errorMessage && <p className="text-xs text-red-600">{errorMessage}</p>}
          <Button type="submit" disabled={pending} className="text-xs">
            {pending ? "Signing…" : "Sign off & load anyway"}
          </Button>
        </form>
      )}
    </div>
  );
}
