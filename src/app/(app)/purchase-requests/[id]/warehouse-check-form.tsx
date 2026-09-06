"use client";

import { useActionState } from "react";
import { checkWarehouseStockAction } from "../actions";
import { Button } from "@/components/ui/button";
import { useTranslations } from "@/lib/i18n/locale-context";

export function WarehouseCheckForm({ requestId }: { requestId: string }) {
  const [state, formAction, pending] = useActionState(checkWarehouseStockAction.bind(null, requestId), undefined);
  const errorMessage = state && state !== "ok" ? state : undefined;
  const { purchaseRequests: dict, common } = useTranslations();

  return (
    <form action={formAction} className="mt-3 space-y-3">
      <div className="flex gap-2">
        <Button
          type="submit"
          name="available"
          value="YES"
          disabled={pending}
          className="bg-emerald-700 text-white hover:bg-emerald-800"
        >
          {pending ? common.saving : dict.warehouseHasStock}
        </Button>
        <Button type="submit" name="available" value="NO" variant="secondary" disabled={pending}>
          {pending ? common.saving : dict.warehouseNoStock}
        </Button>
      </div>
      {errorMessage && <p className="text-sm text-red-600">{errorMessage}</p>}
    </form>
  );
}
