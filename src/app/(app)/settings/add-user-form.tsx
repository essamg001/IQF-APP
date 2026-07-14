"use client";

import { useActionState } from "react";
import { addUserAction } from "./actions";
import { Input, Select, FieldGroup } from "@/components/ui/field";
import { Button } from "@/components/ui/button";

export function AddUserForm() {
  const [error, formAction, pending] = useActionState(addUserAction, undefined);

  return (
    <form action={formAction} className="mt-4 flex flex-wrap items-end gap-3">
      <FieldGroup label="Name">
        <Input name="name" required className="w-44" />
      </FieldGroup>
      <FieldGroup label="Email">
        <Input name="email" type="email" required className="w-56" />
      </FieldGroup>
      <FieldGroup label="Role">
        <Select name="role" required className="w-40">
          <option value="SALES">Sales</option>
          <option value="QUALITY">Quality</option>
          <option value="PRODUCTION">Production</option>
          <option value="LOGISTICS">Logistics</option>
          <option value="OWNER">Owner</option>
        </Select>
      </FieldGroup>
      <FieldGroup label="Password">
        <Input name="password" type="password" required minLength={6} className="w-40" />
      </FieldGroup>
      <label className="mb-2 flex items-center gap-2 text-sm text-slate-700">
        <input type="checkbox" name="isHeadOfSales" /> Head of Sales (sees historical/trend financials)
      </label>
      <Button type="submit" variant="secondary" disabled={pending}>
        {pending ? "Adding…" : "Add user"}
      </Button>
      {error && <p className="w-full text-sm text-red-600">{error}</p>}
    </form>
  );
}
