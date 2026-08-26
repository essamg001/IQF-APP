"use client";

import { useActionState, useState } from "react";
import { addPalletLoadLineAction } from "../actions";
import { decodeSpecBlock } from "@/lib/specCompliance";
import { SpecExceptionForm } from "./spec-exception-form";
import { Input, FieldGroup } from "@/components/ui/field";
import { ConfirmSubmitButton } from "@/components/ui/confirm-submit-button";
import { useTranslations } from "@/lib/i18n/locale-context";

type EligiblePallet = { id: string; palletNumber: string; remaining: number; lotNumber: string };

// Typed, not picked from a dropdown -- the loader reads the number off the
// physical pallet and enters it, and the server checks it against this
// order's actual allocation (see addPalletLoadLineAction's palletNumber
// resolution). A dropdown only confirms someone selected *a* description;
// typing the real number is what catches picking up the wrong pallet.
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
  const [typedNumber, setTypedNumber] = useState("");
  const [quantity, setQuantity] = useState("");
  const specBlock = decodeSpecBlock(error);
  const dict = useTranslations().logistics;

  if (pallets.length === 0) {
    return <p className="text-sm text-slate-400">{dict.noPalletsRemainingTonnage}</p>;
  }

  const matched = pallets.find((p) => p.palletNumber.trim().toLowerCase() === typedNumber.trim().toLowerCase());

  return (
    <div className="flex flex-wrap items-end gap-3">
      <form action={formAction} className="flex flex-wrap items-end gap-3">
        <FieldGroup label={dict.palletLabel}>
          <Input
            name="palletNumber"
            list="eligible-pallet-numbers"
            value={typedNumber}
            onChange={(e) => {
              const value = e.target.value;
              setTypedNumber(value);
              const p = pallets.find((p) => p.palletNumber.trim().toLowerCase() === value.trim().toLowerCase());
              if (p) setQuantity(p.remaining.toFixed(2));
            }}
            placeholder={dict.palletNumberPlaceholder}
            className="w-80"
            required
          />
          <datalist id="eligible-pallet-numbers">
            {pallets.map((p) => (
              <option key={p.id} value={p.palletNumber} />
            ))}
          </datalist>
          {typedNumber.trim() &&
            (matched ? (
              <p className="mt-1 text-xs font-medium text-emerald-700">
                {dict.palletNumberMatchedNote.replace("{remaining}", matched.remaining.toFixed(2)).replace("{lot}", matched.lotNumber)}
              </p>
            ) : (
              <p className="mt-1 text-xs font-medium text-red-600">{dict.palletNumberNotFoundNote}</p>
            ))}
        </FieldGroup>
        <FieldGroup label={dict.quantityToLoadLabel}>
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
          confirmMessage={dict.loadPalletConfirm.replace("{quantity}", quantity).replace("{pallet}", typedNumber)}
          disabled={pending}
          className="inline-flex items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-900 transition-colors hover:bg-slate-50 disabled:opacity-50 disabled:pointer-events-none"
        >
          {pending ? dict.adding : dict.addToManifest}
        </ConfirmSubmitButton>
        {error && !specBlock && <p className="w-full text-sm text-red-600">{error}</p>}
      </form>
      {specBlock && <SpecExceptionForm payload={specBlock} canSignOff={canSignOffSpecException} />}
    </div>
  );
}
