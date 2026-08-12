"use client";

import { useActionState, useRef } from "react";
import { createLaundryRecordAction } from "./actions";
import { Input, FieldGroup } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { GARMENT_TYPES } from "@/lib/laundry";
import type { LaundryRecord } from "@prisma/client";

export function RegisterSection({
  date,
  packhouse,
  records,
  knownNames,
}: {
  date: string;
  packhouse: string;
  records: LaundryRecord[];
  knownNames: string[];
}) {
  const [state, formAction, pending] = useActionState(createLaundryRecordAction, undefined);
  const formRef = useRef<HTMLFormElement>(null);
  const errorMessage = state && state !== "ok" ? state : undefined;

  return (
    <div>
      <h3 className="text-sm font-semibold text-slate-900">Laundry Daily Register — HSE03296</h3>
      <p className="mt-0.5 text-xs text-slate-500">
        Garment pieces issued/exchanged today, by worker and piece number (per the laundry&apos;s monthly register).
      </p>

      {records.length > 0 && (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left text-[11px]">
            <thead className="border-b border-slate-200 text-slate-500">
              <tr>
                <th className="py-1 pr-2 font-medium sticky left-0 bg-white">Name</th>
                {GARMENT_TYPES.map((g) => (
                  <th key={g.key} className="py-1 pr-2 font-medium whitespace-nowrap">
                    {g.label}
                  </th>
                ))}
                <th className="py-1 pr-2 font-medium">Comments</th>
              </tr>
            </thead>
            <tbody>
              {records.map((r) => (
                <tr key={r.id} className="border-b border-slate-100 last:border-0">
                  <td className="py-1 pr-2 font-medium text-slate-900 sticky left-0 bg-white">{r.workerName}</td>
                  {GARMENT_TYPES.map((g) => (
                    <td key={g.key} className="py-1 pr-2 text-slate-600">
                      {(r as unknown as Record<string, string | null>)[g.key] ?? "—"}
                    </td>
                  ))}
                  <td className="py-1 pr-2 text-slate-500">{r.comments ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <form
        ref={formRef}
        action={async (formData) => {
          await formAction(formData);
          formRef.current?.reset();
        }}
        className="mt-3 space-y-2 border-t border-slate-100 pt-3"
      >
        <input type="hidden" name="date" value={date} />
        <input type="hidden" name="packhouse" value={packhouse} />
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">
          <FieldGroup label="Name">
            <Input name="workerName" list="laundry-worker-names" required className="px-2 py-1 text-xs" />
            <datalist id="laundry-worker-names">
              {knownNames.map((n) => (
                <option key={n} value={n} />
              ))}
            </datalist>
          </FieldGroup>
          {GARMENT_TYPES.map((g) => (
            <FieldGroup key={g.key} label={g.label}>
              <Input name={g.key} placeholder="Piece #" className="px-2 py-1 text-xs" />
            </FieldGroup>
          ))}
          <FieldGroup label="Comments">
            <Input name="comments" className="px-2 py-1 text-xs" />
          </FieldGroup>
        </div>
        <Button type="submit" variant="secondary" disabled={pending} className="px-2 py-1 text-xs">
          {pending ? "Saving…" : "Add Entry"}
        </Button>
        {errorMessage && <p className="text-xs text-red-600">{errorMessage}</p>}
      </form>
    </div>
  );
}
