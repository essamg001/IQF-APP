"use client";

import { useActionState, useRef, useState } from "react";
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
  const [checkedGarments, setCheckedGarments] = useState<Record<string, boolean>>({});

  return (
    <div>
      <h3 className="text-sm font-semibold text-slate-900">Laundry Daily Register — HSE03296</h3>
      <p className="mt-0.5 text-xs text-slate-500">
        Garment pieces issued/exchanged today, by worker — tick which garments, then enter each piece number (per
        the laundry&apos;s monthly register).
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
          setCheckedGarments({});
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
            <div key={g.key}>
              <label className="mb-1 flex items-center gap-1.5 text-xs font-medium text-slate-700">
                <input
                  type="checkbox"
                  checked={checkedGarments[g.key] ?? false}
                  onChange={(e) => setCheckedGarments((prev) => ({ ...prev, [g.key]: e.target.checked }))}
                  className="h-3.5 w-3.5 rounded border-slate-300 text-emerald-700 focus:ring-emerald-600"
                />
                {g.label}
              </label>
              {checkedGarments[g.key] && (
                <Input name={g.key} placeholder="Piece #" autoFocus className="px-2 py-1 text-xs" />
              )}
            </div>
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
