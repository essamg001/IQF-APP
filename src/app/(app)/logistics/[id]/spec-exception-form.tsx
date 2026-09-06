"use client";

import { useActionState } from "react";
import { overrideSpecExceptionAction, releaseSpecFailedPalletAction } from "../actions";
import type { SpecBlockPayload } from "@/lib/specCompliance";
import { Input, FieldGroup } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { ConfirmSubmitButton } from "@/components/ui/confirm-submit-button";
import { useTranslations } from "@/lib/i18n/locale-context";

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
  const [releaseState, releaseFormAction, releasePending] = useActionState(releaseSpecFailedPalletAction, undefined);
  const releaseError = typeof releaseState === "string" && releaseState !== "ok" ? releaseState : undefined;
  const dict = useTranslations().logistics;

  return (
    <div className="w-full rounded-md border border-red-300 bg-red-50 p-3">
      <p className="text-sm font-medium text-red-800">
        {dict.blockedPalletFailsSpec
          .replace("{pallet}", payload.palletNumber)
          .replace("{lot}", payload.lotNumber)
          .replace("{client}", payload.clientName)}
      </p>
      <ul className="mt-1 space-y-0.5 text-xs text-red-700">
        {payload.violations.map((v) => (
          <li key={v.key}>
            {dict.measuredVsSpec
              .replace("{label}", v.label)
              .replace("{measured}", v.measuredDisplay)
              .replace("{spec}", v.specLimitDisplay)}
          </li>
        ))}
      </ul>

      {!canSignOff && <p className="mt-2 text-xs text-slate-600">{dict.onlyOwnerOrHeadCanSignOff}</p>}

      {canSignOff && (
        <form action={formAction} className="mt-3 space-y-2 rounded-md border border-amber-300 bg-amber-50 p-2">
          <input type="hidden" name="palletId" value={payload.palletId} />
          <input type="hidden" name="containerId" value={payload.containerId} />
          <input type="hidden" name="quantityTonnes" value={payload.quantityTonnes} />
          <input type="hidden" name="violationsJson" value={JSON.stringify(payload.violations)} />
          <p className="text-xs font-medium text-amber-800">{dict.signOffResponsibilityNote}</p>
          <FieldGroup label={dict.yourNameLabel}>
            <Input name="name" required className="text-sm" />
          </FieldGroup>
          <FieldGroup label={dict.signatureLabel}>
            <Input name="signature" required className="text-sm" placeholder={dict.signaturePlaceholder} />
          </FieldGroup>
          <FieldGroup label={dict.noteOptionalLabel}>
            <Input name="note" className="text-sm" />
          </FieldGroup>
          {errorMessage && <p className="text-xs text-red-600">{errorMessage}</p>}
          <Button type="submit" disabled={pending} className="text-xs">
            {pending ? dict.signing : dict.signOffAndLoadAnyway}
          </Button>
        </form>
      )}

      <form action={releaseFormAction} className="mt-3 space-y-2 rounded-md border border-slate-300 bg-white p-2">
        <input type="hidden" name="palletId" value={payload.palletId} />
        <input type="hidden" name="containerId" value={payload.containerId} />
        <p className="text-xs text-slate-600">{dict.releaseSpecFailedPalletNote}</p>
        <FieldGroup label={dict.noteOptionalLabel}>
          <Input name="note" className="text-sm" />
        </FieldGroup>
        {releaseError && <p className="text-xs text-red-600">{releaseError}</p>}
        <ConfirmSubmitButton
          confirmMessage={dict.releaseSpecFailedPalletConfirm.replace("{pallet}", payload.palletNumber)}
          disabled={releasePending}
          className="inline-flex items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-900 transition-colors hover:bg-slate-50 disabled:opacity-50 disabled:pointer-events-none"
        >
          {releasePending ? dict.releasing : dict.releaseSpecFailedPalletButton}
        </ConfirmSubmitButton>
      </form>
    </div>
  );
}
