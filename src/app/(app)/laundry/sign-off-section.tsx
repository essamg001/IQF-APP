"use client";

import { useActionState } from "react";
import { updateLaundrySignOffDetailsAction, signLaundryAction } from "./actions";
import { Input, Select, FieldGroup } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { LaundryDailySignOff } from "@prisma/client";

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
  const [supervisorState, supervisorAction, supervisorPending] = useActionState(signSupervisor, undefined);
  const [verifierState, verifierAction, verifierPending] = useActionState(signVerifier, undefined);
  const supervisorError = supervisorState && supervisorState !== "ok" ? supervisorState : undefined;
  const verifierError = verifierState && verifierState !== "ok" ? verifierState : undefined;

  return (
    <div className="border-t border-slate-100 pt-3">
      <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Cleanliness Level &amp; Sign-off</h4>

      <form action={updateLaundrySignOffDetailsAction} className="mt-2 flex flex-wrap items-end gap-2">
        <input type="hidden" name="date" value={date} />
        <input type="hidden" name="location" value={location} />
        <FieldGroup label="Cleanliness Level">
          <Select name="cleanlinessAcceptable" defaultValue={signOff?.cleanlinessAcceptable == null ? "" : signOff.cleanlinessAcceptable ? "ACCEPTABLE" : "NOT_ACCEPTABLE"} className="px-2 py-1 text-xs">
            <option value="">—</option>
            <option value="ACCEPTABLE">Acceptable</option>
            <option value="NOT_ACCEPTABLE">Not Acceptable</option>
          </Select>
        </FieldGroup>
        <FieldGroup label="Notes">
          <Input name="notes" defaultValue={signOff?.notes ?? ""} className="w-64 px-2 py-1 text-xs" />
        </FieldGroup>
        <Button type="submit" variant="secondary" className="px-2 py-1 text-xs">
          Save
        </Button>
        {signOff?.cleanlinessAcceptable != null && (
          <Badge color={signOff.cleanlinessAcceptable ? "green" : "red"}>
            {signOff.cleanlinessAcceptable ? "Acceptable" : "Not Acceptable"}
          </Badge>
        )}
      </form>

      <div className="mt-3 flex flex-wrap gap-6">
        <div>
          <p className="text-[11px] font-medium text-slate-500">Supervisor</p>
          {signOff?.supervisorSignedAt ? (
            <p className="text-xs text-slate-700">
              Signed by {signOff.supervisorSignedByName} on {signOff.supervisorSignedAt.toLocaleDateString()}
            </p>
          ) : (
            <form action={supervisorAction}>
              <Button type="submit" variant="secondary" disabled={supervisorPending} className="px-2 py-1 text-xs">
                {supervisorPending ? "Signing…" : "Sign as Supervisor"}
              </Button>
              {supervisorError && <p className="mt-1 text-xs text-red-600">{supervisorError}</p>}
            </form>
          )}
        </div>
        <div>
          <p className="text-[11px] font-medium text-slate-500">Verified By</p>
          {signOff?.verifiedSignedAt ? (
            <p className="text-xs text-slate-700">
              Signed by {signOff.verifiedSignedByName} on {signOff.verifiedSignedAt.toLocaleDateString()}
            </p>
          ) : (
            <form action={verifierAction}>
              <Button type="submit" variant="secondary" disabled={verifierPending} className="px-2 py-1 text-xs">
                {verifierPending ? "Signing…" : "Sign as Verifier"}
              </Button>
              {verifierError && <p className="mt-1 text-xs text-red-600">{verifierError}</p>}
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
