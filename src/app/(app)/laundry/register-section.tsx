"use client";

import { useActionState, useRef, useState } from "react";
import { createLaundryRecordAction } from "./actions";
import { Input, FieldGroup } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { GARMENT_TYPES } from "@/lib/laundry";
import type { LaundryRecord } from "@prisma/client";
import { useTranslations } from "@/lib/i18n/locale-context";
import type { Dictionary } from "@/lib/i18n/getDictionary";

const GARMENT_LABEL_KEY: Record<string, keyof Dictionary["laundry"]> = {
  whiteCoatNo: "garmentWhiteCoat",
  whiteTrousersNo: "garmentWhiteTrousers",
  blueCoatNo: "garmentBlueCoat",
  visitorCoatNo: "garmentVisitorCoat",
  maintenanceOverallNo: "garmentMaintenanceOverall",
  yellowCoatNo: "garmentYellowCoat",
  greenCoatNo: "garmentGreenCoat",
  yellowSuitNo: "garmentYellowSuit",
  coldStoreSuitNo: "garmentColdStoreSuit",
  greyJacketNo: "garmentGreyJacket",
  blackJacketNo: "garmentBlackJacket",
  glovesNo: "garmentGloves",
  whiteHeadscarfNo: "garmentWhiteHeadscarf",
  towelNo: "garmentTowel",
  capNo: "garmentCap",
  blueSuitNo: "garmentBlueSuit",
};

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
  const fullDict = useTranslations();
  const dict = fullDict.laundry;
  const garmentLabel = (key: string) => dict[GARMENT_LABEL_KEY[key]];

  return (
    <div>
      <h3 className="text-sm font-semibold text-slate-900">{dict.registerTitle}</h3>
      <p className="mt-0.5 text-xs text-slate-500">{dict.registerSubtitle}</p>

      {records.length > 0 && (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-start text-[11px]">
            <thead className="border-b border-slate-200 text-slate-500">
              <tr>
                <th className="py-1 pr-2 font-medium sticky start-0 bg-white">{dict.colName}</th>
                {GARMENT_TYPES.map((g) => (
                  <th key={g.key} className="py-1 pr-2 font-medium whitespace-nowrap">
                    {garmentLabel(g.key)}
                  </th>
                ))}
                <th className="py-1 pr-2 font-medium">{dict.colComments}</th>
              </tr>
            </thead>
            <tbody>
              {records.map((r) => (
                <tr key={r.id} className="border-b border-slate-100 last:border-0">
                  <td className="py-1 pr-2 font-medium text-slate-900 sticky start-0 bg-white">{r.workerName}</td>
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
          <FieldGroup label={dict.colName}>
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
                {garmentLabel(g.key)}
              </label>
              {checkedGarments[g.key] && (
                <Input name={g.key} placeholder={dict.piecePlaceholder} autoFocus className="px-2 py-1 text-xs" />
              )}
            </div>
          ))}
          <FieldGroup label={dict.colComments}>
            <Input name="comments" className="px-2 py-1 text-xs" />
          </FieldGroup>
        </div>
        <Button type="submit" variant="secondary" disabled={pending} className="px-2 py-1 text-xs">
          {pending ? fullDict.common.saving : dict.addEntry}
        </Button>
        {errorMessage && <p className="text-xs text-red-600">{errorMessage}</p>}
      </form>
    </div>
  );
}
