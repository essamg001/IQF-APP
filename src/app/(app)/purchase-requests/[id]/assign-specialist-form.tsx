"use client";

import { useActionState } from "react";
import { assignPurchasingSpecialistAction } from "../actions";
import { Input } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { useTranslations } from "@/lib/i18n/locale-context";

export function AssignSpecialistForm({
  requestId,
  items,
}: {
  requestId: string;
  items: { id: string; itemDescription: string; assignedSpecialistName: string | null }[];
}) {
  const [state, formAction, pending] = useActionState(assignPurchasingSpecialistAction.bind(null, requestId), undefined);
  const errorMessage = state && state !== "ok" ? state : undefined;
  const { purchaseRequests: dict, common } = useTranslations();

  return (
    <form action={formAction} className="mt-3 space-y-2">
      {items.map((item) => (
        <div key={item.id} className="flex items-center gap-3">
          <span className="w-48 shrink-0 truncate text-sm text-slate-600">{item.itemDescription}</span>
          <Input
            name={`specialist_${item.id}`}
            defaultValue={item.assignedSpecialistName ?? ""}
            placeholder={dict.specialistPlaceholder}
            className="flex-1"
          />
        </div>
      ))}
      {errorMessage && <p className="text-sm text-red-600">{errorMessage}</p>}
      <Button type="submit" variant="secondary" disabled={pending}>
        {pending ? common.saving : dict.assignSpecialistButton}
      </Button>
    </form>
  );
}
