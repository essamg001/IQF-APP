"use client";

import { useActionState } from "react";
import { importHistoricalOrdersAction } from "./actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export function ImportForm() {
  const [result, formAction, pending] = useActionState(importHistoricalOrdersAction, undefined);

  return (
    <form action={formAction}>
      <Card className="space-y-4">
        <input type="file" name="file" accept=".csv,text/csv" required className="block text-sm" />
        {result && <p className="text-sm text-slate-700">{result}</p>}
        <Button type="submit" disabled={pending}>
          {pending ? "Importing…" : "Import"}
        </Button>
      </Card>
    </form>
  );
}
