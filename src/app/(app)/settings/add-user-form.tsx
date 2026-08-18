"use client";

import { useActionState, useState } from "react";
import { addUserAction } from "./actions";
import { Input, Select, FieldGroup } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { useTranslations } from "@/lib/i18n/locale-context";
import type { Role } from "@prisma/client";

export function AddUserForm() {
  const [error, formAction, pending] = useActionState(addUserAction, undefined);
  const [role, setRole] = useState<Role>("SALES");
  const fullDict = useTranslations();
  const dict = fullDict.settings;
  const roleDict = fullDict.common;

  const STATION_OPTIONS_BY_ROLE: Partial<Record<Role, { value: string; label: string }[]>> = {
    QUALITY: [
      { value: "ARRIVAL_INSPECTION", label: dict.stationArrivalInspection },
      { value: "POST_FREEZE_INSPECTION", label: dict.stationPostFreezeInspection },
      { value: "LAB", label: dict.stationLab },
    ],
    LOGISTICS: [{ value: "LOAD_OUT", label: dict.stationLoadOut }],
    PRODUCTION: [{ value: "FINAL_PRODUCT_ENTRY", label: dict.stationFinalProductEntry }],
  };
  const stationOptions = STATION_OPTIONS_BY_ROLE[role];

  return (
    <form action={formAction} className="mt-4 flex flex-wrap items-end gap-3">
      <FieldGroup label={dict.addUserNameLabel}>
        <Input name="name" required className="w-44" />
      </FieldGroup>
      <FieldGroup label={dict.addUserEmailLabel}>
        <Input name="email" type="email" required className="w-56" />
      </FieldGroup>
      <FieldGroup label={dict.addUserRoleLabel}>
        <Select name="role" required className="w-40" value={role} onChange={(e) => setRole(e.target.value as Role)}>
          <option value="SALES">{roleDict.roleSales}</option>
          <option value="QUALITY">{roleDict.roleQuality}</option>
          <option value="PRODUCTION">{roleDict.roleProduction}</option>
          <option value="LOGISTICS">{roleDict.roleLogistics}</option>
          <option value="OWNER">{roleDict.roleOwner}</option>
        </Select>
      </FieldGroup>
      {stationOptions && (
        <FieldGroup label={dict.restrictToLabel}>
          <Select name="station" className="w-56" defaultValue="">
            <option value="">{dict.fullAccessOption}</option>
            {stationOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </FieldGroup>
      )}
      <FieldGroup label={dict.passwordLabel}>
        <Input name="password" type="password" required minLength={6} className="w-40" />
      </FieldGroup>
      <label className="mb-2 flex items-center gap-2 text-sm text-slate-700">
        <input type="checkbox" name="isHeadOfSales" /> {dict.headOfSalesCheckbox}
      </label>
      <label className="mb-2 flex items-center gap-2 text-sm text-slate-700">
        <input type="checkbox" name="isHeadOfProduction" /> {dict.headOfProductionCheckbox}
      </label>
      <Button type="submit" variant="secondary" disabled={pending}>
        {pending ? dict.adding : dict.addUserButton}
      </Button>
      {error && <p className="w-full text-sm text-red-600">{error}</p>}
    </form>
  );
}
