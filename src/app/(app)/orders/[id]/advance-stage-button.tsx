"use client";

import { useActionState } from "react";
import { advanceOrderStageAction } from "../actions";
import { Button } from "@/components/ui/button";

export function AdvanceStageButton({ orderId, label }: { orderId: string; label: string }) {
  const [error, formAction, pending] = useActionState(advanceOrderStageAction.bind(null, orderId), undefined);

  return (
    <div>
      <form action={formAction}>
        <Button type="submit" disabled={pending}>
          {pending ? "Advancing…" : `Advance to ${label}`}
        </Button>
      </form>
      {error && <p className="mt-1 max-w-xs text-xs text-red-600">{error}</p>}
    </div>
  );
}
