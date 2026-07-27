"use client";

import { useActionState } from "react";
import { createQualityIssueAction } from "../actions";
import { Input, Select, FieldGroup } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { Client } from "@prisma/client";

const today = new Date().toISOString().slice(0, 10);

export function IssueForm({ clients }: { clients: Client[] }) {
  const [state, formAction, pending] = useActionState(createQualityIssueAction, undefined);
  const errorMessage = typeof state === "string" ? state : undefined;

  return (
    <form action={formAction}>
      <Card className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <FieldGroup label="Date">
            <Input name="issueDate" type="date" defaultValue={today} required />
          </FieldGroup>
          <FieldGroup label="Client (optional)">
            <Select name="clientId" defaultValue="">
              <option value="">— None / internal —</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </FieldGroup>
          <FieldGroup label="Reason">
            <Select name="reason" required defaultValue="QUALITY">
              <option value="QUALITY">Quality</option>
              <option value="PACKAGING">Packaging</option>
              <option value="FOREIGN_MATERIAL">Foreign Material</option>
              <option value="TRANSPORT">Transport</option>
            </Select>
          </FieldGroup>
          <FieldGroup label="Variety">
            <Input name="variety" />
          </FieldGroup>
          <FieldGroup label="Order / Container / Lot Reference (optional)">
            <Input name="relatedReference" placeholder="e.g. ORD-2026-0001 or MSKU1234567" />
          </FieldGroup>
        </div>

        <FieldGroup label="What happened">
          <Input name="issueDetails" placeholder="e.g. Hair net found in a final product box by the client." />
        </FieldGroup>

        <FieldGroup label="Corrective Action (optional, can add later)">
          <Input name="correctiveAction" placeholder="e.g. Purchased an optical sorter to catch foreign material before packaging." />
        </FieldGroup>

        {errorMessage && <p className="text-sm text-red-600">{errorMessage}</p>}
        <Button type="submit" disabled={pending} className="w-full">
          {pending ? "Saving…" : "Report Issue"}
        </Button>
      </Card>
    </form>
  );
}
