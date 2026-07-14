"use client";

import { useActionState } from "react";
import { createOrderAction } from "../actions";
import { Input, Select, FieldGroup } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { Client } from "@prisma/client";

export function OrderForm({ clients }: { clients: Client[] }) {
  const [error, formAction, pending] = useActionState(createOrderAction, undefined);

  return (
    <form action={formAction}>
      <Card className="space-y-4">
        <FieldGroup label="Order / container number">
          <Input name="orderNumber" required placeholder="e.g. MSKU1234567" />
        </FieldGroup>
        <FieldGroup label="Client">
          <Select name="clientId" required>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </FieldGroup>
        <div className="grid grid-cols-2 gap-3">
          <FieldGroup label="Grade">
            <Select name="grade" required>
              <option value="A">Grade A</option>
              <option value="B">Grade B</option>
            </Select>
          </FieldGroup>
          <FieldGroup label="Format">
            <Select name="format" required>
              <option value="WHOLE">Whole</option>
              <option value="SLICED">Sliced</option>
              <option value="DICED">Diced</option>
            </Select>
          </FieldGroup>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <FieldGroup label="Quantity (pallets)">
            <Input name="quantityPallets" type="number" min="1" required />
          </FieldGroup>
          <FieldGroup label="Value (USD)">
            <Input name="valueUsd" type="number" step="0.01" min="0" required />
          </FieldGroup>
        </div>
        <FieldGroup label="Order date">
          <Input name="orderDate" type="date" required />
        </FieldGroup>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Create order"}
        </Button>
      </Card>
    </form>
  );
}
