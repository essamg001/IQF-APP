"use client";

import { useActionState } from "react";
import { updateLaundrySignOffDetailsAction, signLaundryAction, reopenLaundrySignOffAction } from "./actions";
import { Input, Select, FieldGroup } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ConfirmSubmitButton } from "@/components/ui/confirm-submit-button";
import { isLaundrySignOffLocked } from "@/lib/laundry";
import { format } from "date-fns";
import type { LaundryDailySignOff } from "@prisma/client";
import { useTranslations } from "@/lib/i18n/locale-context";

export function SignOffSection({
  date,
  location,
  signOff,
}: {
  date: string;
  location: string;
  signOff: LaundryDailySignOff | null;
}) {
  const signSupervisor = signLaundryAction.bind(null, date, location, "SUPERVISOR");
  const signVerifier = signLaundryAction.bind(null, date, location, "VERIFIER");
  const reopenAction = reopenLaundrySignOffAction.bind(null, date, location);
  const [supervisorState, supervisorAction, supervisorPending] = useActionState(signSupervisor, undefined);
  const [verifierState, verifierAction, verifierPending] = useActionState(signVerifier, undefined);
  const [detailsState, detailsAction, detailsPending] = useActionState(updateLaundrySignOffDetailsAction, undefined);
  const [reopenState, reopenFormAction, reopenPending] = useActionState(reopenAction, undefined);
  const supervisorError = supervisorState && supervisorState !== "ok" ? supervisorState : undefined;
  const verifierError = verifierState && verifierState !== "ok" ? verifierState : undefined;
  const detailsError = detailsState && detailsState !== "ok" ? detailsState : undefined;
  const reopenError = reopenState && reopenState !== "ok" ? reopenState : undefined;
  const locked = isLaundrySignOffLocked(signOff);
  const dict = useTranslations().laundry;

  return (
    <div className="border-t border-slate-100 pt-3">
      <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">{dict.cleanlinessSignOffTitle}</h4>

      {locked && <p className="mt-2 text-xs text-amber-700">{dict.lockedMessage}</p>}

      <form action={detailsAction} className="mt-2 flex flex-wrap items-end gap-2">
        <input type="hidden" name="date" value={date} />
        <input type="hidden" name="location" value={location} />
        <FieldGroup label={dict.cleanlinessLevel}>
          <Select
            name="cleanlinessAcceptable"
            defaultValue={signOff?.cleanlinessAcceptable == null ? "" : signOff.cleanlinessAcceptable ? "ACCEPTABLE" : "NOT_ACCEPTABLE"}
            disabled={locked}
            className="px-2 py-1 text-xs"
          >
            <option value="">—</option>
            <option value="ACCEPTABLE">{dict.acceptable}</option>
            <option value="NOT_ACCEPTABLE">{dict.notAcceptable}</option>
          </Select>
        </FieldGroup>
        <FieldGroup label={dict.notes}>
          <Input name="notes" defaultValue={signOff?.notes ?? ""} disabled={locked} className="w-64 px-2 py-1 text-xs" />
        </FieldGroup>
        <Button type="submit" variant="secondary" disabled={locked || detailsPending} className="px-2 py-1 text-xs">
          {dict.save}
        </Button>
        {signOff?.cleanlinessAcceptable != null && (
          <Badge color={signOff.cleanlinessAcceptable ? "green" : "red"}>
            {signOff.cleanlinessAcceptable ? dict.acceptable : dict.notAcceptable}
          </Badge>
        )}
        {detailsError && <p className="w-full text-xs text-red-600">{detailsError}</p>}
      </form>

      <div className="mt-3 flex flex-wrap gap-6">
        <div>
          <p className="text-[11px] font-medium text-slate-500">{dict.supervisor}</p>
          {signOff?.supervisorSignedAt ? (
            <p className="text-xs text-slate-700">
              {dict.signedByOn
                .replace("{name}", signOff.supervisorSignedByName ?? "")
                .replace("{date}", format(signOff.supervisorSignedAt, "dd MMM yyyy"))}
            </p>
          ) : (
            <form action={supervisorAction}>
              <Button type="submit" variant="secondary" disabled={supervisorPending} className="px-2 py-1 text-xs">
                {supervisorPending ? dict.signing : dict.signAsSupervisor}
              </Button>
              {supervisorError && <p className="mt-1 text-xs text-red-600">{supervisorError}</p>}
            </form>
          )}
        </div>
        <div>
          <p className="text-[11px] font-medium text-slate-500">{dict.verifiedBy}</p>
          {signOff?.verifiedSignedAt ? (
            <p className="text-xs text-slate-700">
              {dict.signedByOn
                .replace("{name}", signOff.verifiedSignedByName ?? "")
                .replace("{date}", format(signOff.verifiedSignedAt, "dd MMM yyyy"))}
            </p>
          ) : (
            <form action={verifierAction}>
              <Button type="submit" variant="secondary" disabled={verifierPending} className="px-2 py-1 text-xs">
                {verifierPending ? dict.signing : dict.signAsVerifier}
              </Button>
              {verifierError && <p className="mt-1 text-xs text-red-600">{verifierError}</p>}
            </form>
          )}
        </div>
      </div>

      {locked && (
        <div className="mt-3 border-t border-slate-100 pt-3">
          <form action={reopenFormAction} className="flex flex-wrap items-end gap-3">
            <FieldGroup label={dict.reopenReasonLabel}>
              <Input name="reason" required className="w-80 px-2 py-1 text-xs" placeholder={dict.reopenReasonPlaceholder} />
            </FieldGroup>
            <ConfirmSubmitButton
              confirmMessage={dict.reopenConfirm}
              disabled={reopenPending}
              className="inline-flex items-center justify-center gap-2 rounded-md bg-amber-600 px-3.5 py-2 text-xs font-medium text-white transition-colors hover:bg-amber-700 disabled:opacity-50 disabled:pointer-events-none"
            >
              {reopenPending ? dict.reopening : dict.reopen}
            </ConfirmSubmitButton>
            {reopenError && <p className="w-full text-xs text-red-600">{reopenError}</p>}
          </form>
        </div>
      )}
    </div>
  );
}
