"use client";

import { useActionState, useRef } from "react";
import { issueBladeAction, returnBladeAction } from "./actions";
import { Input, Select, FieldGroup } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ConfirmSubmitButton } from "@/components/ui/confirm-submit-button";
import { format } from "date-fns";
import { useTranslations } from "@/lib/i18n/locale-context";
import type { BladeIssueRecord, BladeReturnCondition } from "@prisma/client";
import type { Dictionary } from "@/lib/i18n/dictionaries/en";

const CONDITION_LABEL_KEY: Record<BladeReturnCondition, keyof Dictionary["bladeControl"]> = {
  INTACT: "conditionIntact",
  DAMAGED: "conditionDamaged",
  PIECE_MISSING: "conditionPieceMissing",
};

// Fills Part 3's report form from a flagged return row and scrolls it into
// view, rather than making the worker retype what just happened -- these
// are plain uncontrolled inputs (no React state of their own), so setting
// .value directly and dispatching input is enough for their own form's
// FormData to pick it up on submit.
function reportAsIncident(text: string) {
  const reportInput = document.getElementById("blade-incident-report") as HTMLInputElement | null;
  if (!reportInput) return;
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")!.set!;
  setter.call(reportInput, text);
  reportInput.dispatchEvent(new Event("input", { bubbles: true }));
  reportInput.scrollIntoView({ behavior: "smooth", block: "center" });
  reportInput.focus();
}

function ReturnRow({ record }: { record: BladeIssueRecord }) {
  const [state, formAction, pending] = useActionState(returnBladeAction.bind(null, record.id), undefined);
  const errorMessage = state && state !== "ok" ? state : undefined;
  const mismatch = record.receiptKnifeNumber != null && record.receiptKnifeNumber !== record.issueKnifeNumber;
  const flaggedCondition = record.returnCondition && record.returnCondition !== "INTACT" ? record.returnCondition : null;
  const dict = useTranslations();
  const t = dict.bladeControl;

  return (
    <tr className={`border-b border-slate-100 last:border-0 align-top ${mismatch || flaggedCondition ? "bg-red-50" : ""}`}>
      <td className="px-3 py-2">
        <p className="font-medium text-slate-900">{record.workerName}</p>
        {record.packingGroupNumber && (
          <p className="text-xs text-slate-500">{t.groupLabel.replace("{n}", record.packingGroupNumber)}</p>
        )}
      </td>
      <td className="px-3 py-2">
        <p>#{record.issueKnifeNumber}</p>
        <p className="text-xs text-slate-500">{format(record.issuedAt, "HH:mm")}</p>
      </td>
      <td className="px-3 py-2">
        {!record.returnedAt && (
          <form action={formAction} className="space-y-1">
            <FieldGroup label={t.receiptKnifeLabel}>
              <Input name="receiptKnifeNumber" required className="w-24 px-2 py-1 text-xs" />
            </FieldGroup>
            <FieldGroup label={t.conditionLabel}>
              <Select name="returnCondition" defaultValue="INTACT" className="w-32 px-2 py-1 text-xs">
                <option value="INTACT">{t.conditionIntact}</option>
                <option value="DAMAGED">{t.conditionDamaged}</option>
                <option value="PIECE_MISSING">{t.conditionPieceMissing}</option>
              </Select>
            </FieldGroup>
            <FieldGroup label={t.pieceCountLabel}>
              <Input name="pieceCount" type="number" min="0" className="w-24 px-2 py-1 text-xs" />
            </FieldGroup>
            <FieldGroup label={dict.common.notes}>
              <Input name="notes" className="w-40 px-2 py-1 text-xs" />
            </FieldGroup>
            <ConfirmSubmitButton
              confirmMessage={t.returnConfirm.replace("{name}", record.workerName).replace("{number}", record.issueKnifeNumber)}
              disabled={pending}
              className="inline-flex items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-900 transition-colors hover:bg-slate-50 disabled:opacity-50"
            >
              {pending ? dict.common.saving : t.checkInKnife}
            </ConfirmSubmitButton>
            {errorMessage && <p className="text-xs text-red-600">{errorMessage}</p>}
          </form>
        )}
        {record.returnedAt && (
          <div>
            <p className={mismatch ? "font-semibold text-red-700" : ""}>
              #{record.receiptKnifeNumber} {mismatch && `— ${t.mismatchLabel}`}
            </p>
            <p className="text-xs text-slate-500">
              {format(record.returnedAt, "HH:mm")}
              {record.pieceCount != null && ` · ${record.pieceCount} ${t.piecesLabel}`}
            </p>
            {record.returnCondition && (
              <Badge color={flaggedCondition ? "red" : "green"} className="mt-1">
                {t[CONDITION_LABEL_KEY[record.returnCondition]]}
              </Badge>
            )}
            {record.notes && <p className="text-xs text-slate-400">{record.notes}</p>}
            {flaggedCondition && (
              <button
                type="button"
                onClick={() =>
                  reportAsIncident(
                    t.incidentPrefillText
                      .replace("{number}", record.receiptKnifeNumber ?? record.issueKnifeNumber)
                      .replace("{name}", record.workerName)
                      .replace("{condition}", t[CONDITION_LABEL_KEY[flaggedCondition]].toLowerCase())
                  )
                }
                className="mt-1 block text-xs text-emerald-700 hover:underline"
              >
                {t.reportAsIncident}
              </button>
            )}
          </div>
        )}
      </td>
    </tr>
  );
}

export function IssueSection({
  factoryId,
  date,
  shiftType,
  records,
}: {
  factoryId: string;
  date: string;
  shiftType: "DAY" | "NIGHT";
  records: BladeIssueRecord[];
}) {
  const [state, formAction, pending] = useActionState(issueBladeAction, undefined);
  const formRef = useRef<HTMLFormElement>(null);
  const errorMessage = state && state !== "ok" ? state : undefined;
  const dict = useTranslations();
  const t = dict.bladeControl;

  return (
    <div>
      <h2 className="text-sm font-semibold text-slate-900">{t.part2Title}</h2>
      <p className="mt-1 text-xs text-slate-500">{t.part2Subtitle}</p>

      {records.length > 0 && (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-start text-sm">
            <thead className="border-b border-slate-200 text-slate-500 text-xs">
              <tr>
                <th className="px-3 py-1 font-medium">{t.colWorker}</th>
                <th className="px-3 py-1 font-medium">{t.colIssued}</th>
                <th className="px-3 py-1 font-medium">{t.colReturn}</th>
              </tr>
            </thead>
            <tbody>
              {records.map((r) => (
                <ReturnRow key={r.id} record={r} />
              ))}
            </tbody>
          </table>
        </div>
      )}
      {records.length === 0 && <p className="mt-3 text-sm text-slate-400">{t.noKnivesYet}</p>}

      <form
        ref={formRef}
        action={async (formData) => {
          await formAction(formData);
          formRef.current?.reset();
        }}
        className="mt-4 grid grid-cols-4 gap-3 border-t border-slate-100 pt-4"
      >
        <input type="hidden" name="factoryId" value={factoryId} />
        <input type="hidden" name="date" value={date} />
        <input type="hidden" name="shiftType" value={shiftType} />
        <FieldGroup label={t.workerNameLabel}>
          <Input name="workerName" required className="px-2 py-1 text-xs" />
        </FieldGroup>
        <FieldGroup label={dict.injuryLog.packingGroupLabel}>
          <Input name="packingGroupNumber" className="px-2 py-1 text-xs" />
        </FieldGroup>
        <FieldGroup label={t.knifeNumberLabel}>
          <Input name="issueKnifeNumber" required className="px-2 py-1 text-xs" />
        </FieldGroup>
        <div className="flex items-end">
          <Button type="submit" variant="secondary" disabled={pending} className="px-2 py-1 text-xs">
            {pending ? dict.common.saving : t.issueKnife}
          </Button>
        </div>
        {errorMessage && <p className="col-span-4 text-xs text-red-600">{errorMessage}</p>}
      </form>
    </div>
  );
}
