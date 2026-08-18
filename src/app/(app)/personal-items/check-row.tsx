"use client";

import { useActionState } from "react";
import { checkInPersonalItemsAction, checkOutPersonalItemsAction } from "./actions";
import { Input, Select, FieldGroup } from "@/components/ui/field";
import { ConfirmSubmitButton } from "@/components/ui/confirm-submit-button";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { useTranslations } from "@/lib/i18n/locale-context";
import type { PersonalItemAuthorization, PersonalItemShiftCheck, PersonalItemCondition } from "@prisma/client";
import type { Dictionary } from "@/lib/i18n/dictionaries/en";

const ITEMS: {
  allowsKey: keyof PersonalItemAuthorization;
  labelKey: keyof Dictionary["personalItems"];
  startField: string;
  endField: string;
  startKey: keyof PersonalItemShiftCheck;
  endKey: keyof PersonalItemShiftCheck;
}[] = [
  { allowsKey: "allowsMobile", labelKey: "itemMobile", startField: "mobileStatusStart", endField: "mobileStatusEnd", startKey: "mobileStatusStart", endKey: "mobileStatusEnd" },
  { allowsKey: "allowsPens", labelKey: "itemPens", startField: "pensStatusStart", endField: "pensStatusEnd", startKey: "pensStatusStart", endKey: "pensStatusEnd" },
  { allowsKey: "allowsCalculator", labelKey: "itemCalculator", startField: "calculatorStatusStart", endField: "calculatorStatusEnd", startKey: "calculatorStatusStart", endKey: "calculatorStatusEnd" },
  { allowsKey: "allowsOther", labelKey: "itemOther", startField: "otherStatusStart", endField: "otherStatusEnd", startKey: "otherStatusStart", endKey: "otherStatusEnd" },
];

function ConditionBadge({ status, label }: { status: PersonalItemCondition; label: string }) {
  const color = status === "INTACT" ? "green" : status === "CRACKED" ? "amber" : "red";
  return <Badge color={color}>{label}</Badge>;
}

export function PersonalItemShiftRow({
  authorization,
  check,
  factoryId,
  date,
  shiftType,
}: {
  authorization: PersonalItemAuthorization;
  check: PersonalItemShiftCheck | null;
  factoryId: string;
  date: string;
  shiftType: "DAY" | "NIGHT";
}) {
  const checkInAction = checkInPersonalItemsAction.bind(null, authorization.id, factoryId, date, shiftType);
  const [checkInState, checkInFormAction, checkInPending] = useActionState(checkInAction, undefined);
  const checkInError = checkInState && checkInState !== "ok" ? checkInState : undefined;

  const checkOutAction = check ? checkOutPersonalItemsAction.bind(null, check.id) : undefined;
  const [checkOutState, checkOutFormAction, checkOutPending] = useActionState(
    checkOutAction ?? (async () => undefined),
    undefined
  );
  const checkOutError = checkOutState && checkOutState !== "ok" ? checkOutState : undefined;

  const dict = useTranslations();
  const t = dict.personalItems;
  const CONDITION_LABEL: Record<PersonalItemCondition, string> = {
    INTACT: t.conditionIntact,
    CRACKED: t.conditionCracked,
    BROKEN: t.conditionBroken,
    LOST: t.conditionLost,
  };

  const applicableItems = ITEMS.filter((i) => authorization[i.allowsKey]);

  return (
    <tr className="border-b border-slate-100 last:border-0 align-top">
      <td className="px-4 py-2">
        <p className="font-medium text-slate-900">{authorization.name}</p>
        {authorization.job && <p className="text-xs text-slate-500">{authorization.job}</p>}
        <div className="mt-1 flex flex-wrap gap-1">
          {applicableItems.map((i) => (
            <Badge key={i.allowsKey} color="slate">
              {t[i.labelKey]}
            </Badge>
          ))}
        </div>
      </td>
      <td className="px-4 py-2 text-sm">
        {!check && (
          <form action={checkInFormAction} className="space-y-1">
            {applicableItems.map((i) => (
              <FieldGroup key={i.startField} label={t.conditionLabel.replace("{item}", t[i.labelKey])}>
                <Select name={i.startField} defaultValue="INTACT" className="w-28 px-2 py-1 text-xs">
                  {Object.entries(CONDITION_LABEL).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </Select>
              </FieldGroup>
            ))}
            <ConfirmSubmitButton
              confirmMessage={t.checkInConfirm.replace("{name}", authorization.name)}
              disabled={checkInPending}
              className="inline-flex items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-900 transition-colors hover:bg-slate-50 disabled:opacity-50"
            >
              {checkInPending ? dict.common.saving : t.checkIn}
            </ConfirmSubmitButton>
            {checkInError && <p className="mt-1 text-xs text-red-600">{checkInError}</p>}
          </form>
        )}
        {check && (
          <div>
            <p className="text-xs text-slate-500">
              {t.inLabel}: {format(check.checkedInAt, "HH:mm")} — {check.checkedInByName}
            </p>
            <div className="mt-1 flex flex-wrap gap-1">
              {applicableItems.map((i) => {
                const status = check[i.startKey] as PersonalItemCondition | null;
                return status ? <ConditionBadge key={i.startField} status={status} label={CONDITION_LABEL[status]} /> : null;
              })}
            </div>
          </div>
        )}
      </td>
      <td className="px-4 py-2 text-sm">
        {check && !check.checkedOutAt && (
          <form action={checkOutFormAction} className="space-y-1">
            {applicableItems.map((i) => (
              <FieldGroup key={i.endField} label={t.conditionLabel.replace("{item}", t[i.labelKey])}>
                <Select name={i.endField} defaultValue="INTACT" className="w-28 px-2 py-1 text-xs">
                  {Object.entries(CONDITION_LABEL).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </Select>
              </FieldGroup>
            ))}
            <FieldGroup label={t.actionTakenLabel}>
              <Input name="actionTaken" className="w-48 px-2 py-1 text-xs" />
            </FieldGroup>
            <FieldGroup label={t.notesOptional}>
              <Input name="notes" className="w-48 px-2 py-1 text-xs" />
            </FieldGroup>
            <ConfirmSubmitButton
              confirmMessage={t.checkOutConfirm.replace("{name}", authorization.name)}
              disabled={checkOutPending}
              className="inline-flex items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-900 transition-colors hover:bg-slate-50 disabled:opacity-50"
            >
              {checkOutPending ? dict.common.saving : t.checkOut}
            </ConfirmSubmitButton>
            {checkOutError && <p className="text-xs text-red-600">{checkOutError}</p>}
          </form>
        )}
        {check?.checkedOutAt && (
          <div>
            <p className="text-xs text-slate-500">
              {t.outLabel}: {format(check.checkedOutAt, "HH:mm")} — {check.checkedOutByName}
            </p>
            <div className="mt-1 flex flex-wrap gap-1">
              {applicableItems.map((i) => {
                const status = check[i.endKey] as PersonalItemCondition | null;
                return status ? <ConditionBadge key={i.endField} status={status} label={CONDITION_LABEL[status]} /> : null;
              })}
            </div>
            {check.actionTaken && (
              <p className="mt-0.5 text-xs text-slate-500">
                {t.actionLabel}: {check.actionTaken}
              </p>
            )}
            {check.notes && <p className="mt-0.5 text-xs text-slate-400">{check.notes}</p>}
          </div>
        )}
        {!check && <span className="text-xs text-slate-300">—</span>}
      </td>
    </tr>
  );
}
