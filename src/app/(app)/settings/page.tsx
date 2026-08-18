import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Input, FieldGroup } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { ConfirmSubmitButton } from "@/components/ui/confirm-submit-button";
import { Badge } from "@/components/ui/badge";
import { getCompanySettings } from "@/lib/companySettings";
import { resolveLocale } from "@/lib/i18n/resolveLocale";
import { getDictionary } from "@/lib/i18n/getDictionary";
import {
  addFactoryAction,
  updateFactoryAccreditationAction,
  addColdRoomAction,
  addFieldAction,
  deleteFieldAction,
  deleteUserAction,
  toggleHeadOfSalesAction,
  toggleHeadOfProductionAction,
  toggleHeadOfMaintenanceAction,
  toggleHeadOfPurchasingAction,
  updateFarmAccreditationAction,
} from "./actions";
import { AddUserForm } from "./add-user-form";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await auth();
  const isOwner = session?.user.role === "OWNER";
  const { error } = await searchParams;
  const fullDict = getDictionary(await resolveLocale());
  const dict = fullDict.settings;
  const ROLE_LABELS = {
    OWNER: fullDict.common.roleOwner,
    SALES: fullDict.common.roleSales,
    QUALITY: fullDict.common.roleQuality,
    PRODUCTION: fullDict.common.roleProduction,
    LOGISTICS: fullDict.common.roleLogistics,
  } as const;
  const STATION_LABELS = {
    ARRIVAL_INSPECTION: dict.stationArrivalInspection,
    POST_FREEZE_INSPECTION: dict.stationPostFreezeInspection,
    LOAD_OUT: dict.stationLoadOut,
    FINAL_PRODUCT_ENTRY: dict.stationFinalProductEntry,
    LAB: dict.stationLab,
  } as const;

  const [factories, coldRooms, fields, users, companySettings] = await Promise.all([
    prisma.factory.findMany({ orderBy: { name: "asc" } }),
    prisma.coldRoom.findMany({ orderBy: { name: "asc" } }),
    prisma.field.findMany({ orderBy: { name: "asc" } }),
    isOwner ? prisma.user.findMany({ orderBy: { name: "asc" } }) : Promise.resolve([]),
    isOwner ? getCompanySettings() : Promise.resolve(null),
  ]);

  return (
    <div className="space-y-6">
      {error === "field-in-use" && (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {dict.fieldInUseError}
        </p>
      )}
      <div>
        <h1 className="text-xl font-semibold text-slate-900">{dict.title}</h1>
        <p className="mt-1 text-sm text-slate-500">{dict.subtitle}</p>
      </div>

      {isOwner && (
        <Card>
          <h2 className="text-sm font-semibold text-slate-900">{dict.usersTitle}</h2>
          <ul className="mt-3 divide-y divide-slate-100">
            {users.map((u) => (
              <li key={u.id} className="flex items-center justify-between py-2 text-sm">
                <span>
                  {u.name} <span className="text-slate-400">({u.email})</span>
                </span>
                <span className="flex items-center gap-3">
                  <Badge color="slate">{ROLE_LABELS[u.role]}</Badge>
                  {u.station && <Badge color="amber">{STATION_LABELS[u.station]}</Badge>}
                  {u.role === "SALES" &&
                    (u.isHeadOfSales ? (
                      <Badge color="green">{dict.headOfSalesBadge}</Badge>
                    ) : (
                      <form action={toggleHeadOfSalesAction.bind(null, u.id)}>
                        <ConfirmSubmitButton
                          confirmMessage={dict.makeHeadOfSalesConfirm.replace("{name}", u.name)}
                          className="text-xs text-slate-400 hover:text-slate-600 hover:underline"
                        >
                          {dict.makeHeadOfSalesLink}
                        </ConfirmSubmitButton>
                      </form>
                    ))}
                  {u.role === "PRODUCTION" &&
                    (u.isHeadOfProduction ? (
                      <Badge color="green">{dict.headOfProductionBadge}</Badge>
                    ) : (
                      <form action={toggleHeadOfProductionAction.bind(null, u.id)}>
                        <ConfirmSubmitButton
                          confirmMessage={dict.makeHeadOfProductionConfirm.replace("{name}", u.name)}
                          className="text-xs text-slate-400 hover:text-slate-600 hover:underline"
                        >
                          {dict.makeHeadOfProductionLink}
                        </ConfirmSubmitButton>
                      </form>
                    ))}
                  {u.isHeadOfMaintenance ? (
                    <Badge color="green">{dict.headOfMaintenanceBadge}</Badge>
                  ) : (
                    <form action={toggleHeadOfMaintenanceAction.bind(null, u.id)}>
                      <ConfirmSubmitButton
                        confirmMessage={dict.makeHeadOfMaintenanceConfirm.replace("{name}", u.name)}
                        className="text-xs text-slate-400 hover:text-slate-600 hover:underline"
                      >
                        {dict.makeHeadOfMaintenanceLink}
                      </ConfirmSubmitButton>
                    </form>
                  )}
                  {u.isHeadOfPurchasing ? (
                    <Badge color="green">{dict.headOfPurchasingBadge}</Badge>
                  ) : (
                    <form action={toggleHeadOfPurchasingAction.bind(null, u.id)}>
                      <ConfirmSubmitButton
                        confirmMessage={dict.makeHeadOfPurchasingConfirm.replace("{name}", u.name)}
                        className="text-xs text-slate-400 hover:text-slate-600 hover:underline"
                      >
                        {dict.makeHeadOfPurchasingLink}
                      </ConfirmSubmitButton>
                    </form>
                  )}
                  {u.id !== session?.user.id && (
                    <form action={deleteUserAction.bind(null, u.id)}>
                      <ConfirmSubmitButton confirmMessage={dict.removeUserConfirm.replace("{name}", u.name)}>
                        {dict.removeButton}
                      </ConfirmSubmitButton>
                    </form>
                  )}
                </span>
              </li>
            ))}
            {users.length === 0 && <li className="py-2 text-sm text-slate-400">{dict.noUsersYet}</li>}
          </ul>
          <AddUserForm />
        </Card>
      )}

      {isOwner && companySettings && (
        <Card>
          <h2 className="text-sm font-semibold text-slate-900">{dict.farmAccreditationTitle}</h2>
          <p className="mt-1 text-xs text-slate-500">{dict.farmAccreditationSubtitle}</p>
          <form action={updateFarmAccreditationAction} className="mt-3 flex flex-wrap items-end gap-3">
            <FieldGroup label={dict.globalGapNumberLabel}>
              <Input name="globalGapNumber" defaultValue={companySettings.globalGapNumber ?? ""} className="w-48" />
            </FieldGroup>
            <FieldGroup label={dict.expiryDateLabel}>
              <Input
                name="globalGapExpiry"
                type="date"
                defaultValue={
                  companySettings.globalGapExpiry ? companySettings.globalGapExpiry.toISOString().slice(0, 10) : ""
                }
                className="w-40"
              />
            </FieldGroup>
            <Button type="submit" variant="secondary">
              {dict.saveButton}
            </Button>
          </form>
        </Card>
      )}

      {isOwner && (
        <Card>
          <h2 className="text-sm font-semibold text-slate-900">{dict.factoriesTitle}</h2>
          <p className="mt-1 text-xs text-slate-500">{dict.factoriesSubtitle}</p>
          <ul className="mt-3 divide-y divide-slate-100">
            {factories.map((f) => (
              <li key={f.id} className="py-2 text-sm">
                <div className="flex justify-between">
                  <span>{f.name}</span>
                  <span className="text-slate-500">
                    {f.capacityTonnesPerHour} {dict.tPerHourSuffix}
                  </span>
                </div>
                <form
                  action={updateFactoryAccreditationAction.bind(null, f.id)}
                  className="mt-2 flex flex-wrap items-end gap-2"
                >
                  <FieldGroup label={dict.capqExportCodeLabel}>
                    <Input name="capqExportCode" defaultValue={f.capqExportCode ?? ""} className="w-40 text-xs" />
                  </FieldGroup>
                  <FieldGroup label={dict.nfsaAccreditationCodeLabel}>
                    <Input name="nfsaAccreditationCode" defaultValue={f.nfsaAccreditationCode ?? ""} className="w-40 text-xs" />
                  </FieldGroup>
                  <Button type="submit" variant="secondary" className="text-xs">
                    {dict.saveButton}
                  </Button>
                </form>
              </li>
            ))}
          </ul>
          <form action={addFactoryAction} className="mt-4 flex items-end gap-3">
            <FieldGroup label={dict.addFactoryNameLabel}>
              <Input name="name" required className="w-56" />
            </FieldGroup>
            <FieldGroup label={dict.addFactoryCapacityLabel}>
              <Input name="capacityTonnesPerHour" type="number" step="0.1" required className="w-32" />
            </FieldGroup>
            <Button type="submit" variant="secondary">
              {dict.addButton}
            </Button>
          </form>
        </Card>
      )}

      {isOwner && (
        <Card>
          <h2 className="text-sm font-semibold text-slate-900">{dict.coldRoomsTitle}</h2>
          <p className="mt-1 text-xs text-slate-500">
            {dict.coldRoomsSubtitle.split("{storageMapLink}")[0]}
            <Link href="/storage/map" className="text-emerald-700 hover:underline">
              {dict.storageMapLinkText}
            </Link>
            {dict.coldRoomsSubtitle.split("{storageMapLink}")[1]}
          </p>
          <ul className="mt-3 divide-y divide-slate-100">
            {coldRooms.map((c) => (
              <li key={c.id} className="flex items-center justify-between py-2 text-sm">
                <span className="flex items-center gap-2">
                  {c.name}
                  <Badge color={c.isNew ? "green" : "slate"}>{c.isNew ? dict.newBadge : dict.oldBadge}</Badge>
                </span>
                <span className="text-slate-500">
                  {dict.coldRoomSummary
                    .replace("{count}", String(c.capacityPallets))
                    .replace("{rounds}", String(c.rounds))
                    .replace("{roundsPlural}", c.rounds === 1 ? "" : "s")
                    .replace("{racks}", String(c.rackCount))
                    .replace("{racksPlural}", c.rackCount === 1 ? "" : "s")
                    .replace("{levels}", String(c.levelCount))
                    .replace("{levelsPlural}", c.levelCount === 1 ? "" : "s")}
                </span>
              </li>
            ))}
          </ul>
          <form action={addColdRoomAction} className="mt-4 flex flex-wrap items-end gap-3">
            <FieldGroup label={dict.addColdRoomNameLabel}>
              <Input name="name" required placeholder="Cold Store 6" className="w-40" />
            </FieldGroup>
            <FieldGroup label={dict.roundsLabel}>
              <Input name="rounds" type="number" min="1" required defaultValue={2} className="w-20" />
            </FieldGroup>
            <FieldGroup label={dict.racksLabel}>
              <Input name="rackCount" type="number" min="1" required defaultValue={11} className="w-20" />
            </FieldGroup>
            <FieldGroup label={dict.levelsLabel}>
              <Input name="levelCount" type="number" min="1" required defaultValue={14} className="w-20" />
            </FieldGroup>
            <label className="mb-2 flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" name="isNew" /> {dict.newRoomLabel}
            </label>
            <Button type="submit" variant="secondary">
              {dict.addButton}
            </Button>
          </form>
        </Card>
      )}

      {isOwner && (
        <Card>
          <h2 className="text-sm font-semibold text-slate-900">{dict.fieldsTitle}</h2>
          <p className="text-xs text-slate-500">{dict.fieldsSubtitle}</p>
          <ul className="mt-3 divide-y divide-slate-100">
            {fields.map((f) => (
              <li key={f.id} className="flex items-center justify-between py-2 text-sm">
                <span>{f.name}</span>
                <form action={deleteFieldAction.bind(null, f.id)}>
                  <ConfirmSubmitButton confirmMessage={dict.removeFieldConfirm.replace("{name}", f.name)}>
                    {dict.removeButton}
                  </ConfirmSubmitButton>
                </form>
              </li>
            ))}
            {fields.length === 0 && <li className="py-2 text-sm text-slate-400">{dict.noFieldsYet}</li>}
          </ul>
          <form action={addFieldAction} className="mt-4 flex items-end gap-3">
            <FieldGroup label={dict.addFieldNameLabel}>
              <Input name="name" required className="w-56" />
            </FieldGroup>
            <FieldGroup label={dict.mapReferenceLabel}>
              <Input name="mapReference" className="w-64" />
            </FieldGroup>
            <Button type="submit" variant="secondary">
              {dict.addButton}
            </Button>
          </form>
        </Card>
      )}
    </div>
  );
}
