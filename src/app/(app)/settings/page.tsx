import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Input, FieldGroup } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { ConfirmSubmitButton } from "@/components/ui/confirm-submit-button";
import { Badge } from "@/components/ui/badge";
import { ROLE_LABELS, canSeeCosting } from "@/lib/roles";
import { getCompanySettings } from "@/lib/companySettings";
import type { Station } from "@prisma/client";

const STATION_LABELS: Record<Station, string> = {
  ARRIVAL_INSPECTION: "Arrival Inspection only",
  POST_FREEZE_INSPECTION: "Post-Freeze Inspection only",
  LOAD_OUT: "Load-Out only",
  FINAL_PRODUCT_ENTRY: "Final Product Entry only",
  LAB: "Lab only",
};
import {
  addFactoryAction,
  updateFactoryAccreditationAction,
  addColdRoomAction,
  addFieldAction,
  deleteFieldAction,
  deleteUserAction,
  toggleHeadOfSalesAction,
  toggleHeadOfProductionAction,
  updateCostingRatesAction,
} from "./actions";
import { AddUserForm } from "./add-user-form";

export default async function SettingsPage() {
  const session = await auth();
  const isOwner = session?.user.role === "OWNER";
  const showCosting = canSeeCosting(session?.user);

  const [factories, coldRooms, fields, users, companySettings] = await Promise.all([
    prisma.factory.findMany({ orderBy: { name: "asc" } }),
    prisma.coldRoom.findMany({ orderBy: { name: "asc" } }),
    prisma.field.findMany({ orderBy: { name: "asc" } }),
    isOwner ? prisma.user.findMany({ orderBy: { name: "asc" } }) : Promise.resolve([]),
    showCosting ? getCompanySettings() : Promise.resolve(null),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Setup</h1>
        <p className="mt-1 text-sm text-slate-500">Factories, cold rooms, fields, and users.</p>
      </div>

      {isOwner && (
        <Card>
          <h2 className="text-sm font-semibold text-slate-900">Users</h2>
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
                      <Badge color="green">Head of Sales</Badge>
                    ) : (
                      <form action={toggleHeadOfSalesAction.bind(null, u.id)}>
                        <ConfirmSubmitButton
                          confirmMessage={`Make ${u.name} Head of Sales? This grants pricing/margin visibility and other sales-lead permissions.`}
                          className="text-xs text-slate-400 hover:text-slate-600 hover:underline"
                        >
                          Make head of sales?
                        </ConfirmSubmitButton>
                      </form>
                    ))}
                  {u.role === "PRODUCTION" &&
                    (u.isHeadOfProduction ? (
                      <Badge color="green">Head of Production</Badge>
                    ) : (
                      <form action={toggleHeadOfProductionAction.bind(null, u.id)}>
                        <ConfirmSubmitButton
                          confirmMessage={`Make ${u.name} Head of Production? This grants authority to sign off out-of-spec loads.`}
                          className="text-xs text-slate-400 hover:text-slate-600 hover:underline"
                        >
                          Make head of production?
                        </ConfirmSubmitButton>
                      </form>
                    ))}
                  {u.id !== session?.user.id && (
                    <form action={deleteUserAction.bind(null, u.id)}>
                      <ConfirmSubmitButton confirmMessage={`Remove ${u.name}'s login? They will no longer be able to sign in.`}>
                        Remove
                      </ConfirmSubmitButton>
                    </form>
                  )}
                </span>
              </li>
            ))}
            {users.length === 0 && <li className="py-2 text-sm text-slate-400">No users yet.</li>}
          </ul>
          <AddUserForm />
        </Card>
      )}

      {showCosting && companySettings && (
        <Card>
          <h2 className="text-sm font-semibold text-slate-900">Costing Rates</h2>
          <p className="mt-1 text-xs text-slate-500">
            Used to convert EGP raw-material and labor costs into USD on the Costing page. Changing the wage rate
            here only affects shifts costed from now on — each shift snapshots the rate in effect at the time, so
            past margins don&apos;t retroactively change.
          </p>
          <form action={updateCostingRatesAction} className="mt-3 flex flex-wrap items-end gap-3">
            <FieldGroup label="FX rate (EGP per USD)">
              <Input
                name="fxRateEgpPerUsd"
                type="number"
                step="0.01"
                min="0"
                defaultValue={companySettings.fxRateEgpPerUsd ?? ""}
                className="w-40"
              />
            </FieldGroup>
            <FieldGroup label="Labor wage rate (EGP/hour/worker)">
              <Input
                name="laborHourlyRateEgp"
                type="number"
                step="0.01"
                min="0"
                defaultValue={companySettings.laborHourlyRateEgp ?? ""}
                className="w-56"
              />
            </FieldGroup>
            <Button type="submit" variant="secondary">
              Save
            </Button>
          </form>
        </Card>
      )}

      {isOwner && (
        <Card>
          <h2 className="text-sm font-semibold text-slate-900">Factories</h2>
          <p className="mt-1 text-xs text-slate-500">
            CAPQ/NFSA accreditation is standing export eligibility for the packing house itself — produce from an
            un-coded facility can&apos;t legally be exported.
          </p>
          <ul className="mt-3 divide-y divide-slate-100">
            {factories.map((f) => (
              <li key={f.id} className="py-2 text-sm">
                <div className="flex justify-between">
                  <span>{f.name}</span>
                  <span className="text-slate-500">{f.capacityTonnesPerHour} t/hr</span>
                </div>
                <form
                  action={updateFactoryAccreditationAction.bind(null, f.id)}
                  className="mt-2 flex flex-wrap items-end gap-2"
                >
                  <FieldGroup label="CAPQ export code">
                    <Input name="capqExportCode" defaultValue={f.capqExportCode ?? ""} className="w-40 text-xs" />
                  </FieldGroup>
                  <FieldGroup label="NFSA accreditation code">
                    <Input name="nfsaAccreditationCode" defaultValue={f.nfsaAccreditationCode ?? ""} className="w-40 text-xs" />
                  </FieldGroup>
                  <Button type="submit" variant="secondary" className="text-xs">
                    Save
                  </Button>
                </form>
              </li>
            ))}
          </ul>
          <form action={addFactoryAction} className="mt-4 flex items-end gap-3">
            <FieldGroup label="Name">
              <Input name="name" required className="w-56" />
            </FieldGroup>
            <FieldGroup label="Capacity (t/hr)">
              <Input name="capacityTonnesPerHour" type="number" step="0.1" required className="w-32" />
            </FieldGroup>
            <Button type="submit" variant="secondary">
              Add
            </Button>
          </form>
        </Card>
      )}

      {isOwner && (
        <Card>
          <h2 className="text-sm font-semibold text-slate-900">Cold Rooms</h2>
          <p className="mt-1 text-xs text-slate-500">
            Capacity is derived from the room&apos;s physical layout (rounds × racks × levels), matching the storage
            map exactly — see the <Link href="/storage/map" className="text-emerald-700 hover:underline">Storage Map</Link> to
            view or assign individual slots.
          </p>
          <ul className="mt-3 divide-y divide-slate-100">
            {coldRooms.map((c) => (
              <li key={c.id} className="flex items-center justify-between py-2 text-sm">
                <span className="flex items-center gap-2">
                  {c.name}
                  <Badge color={c.isNew ? "green" : "slate"}>{c.isNew ? "New" : "Old"}</Badge>
                </span>
                <span className="text-slate-500">
                  {c.capacityPallets} pallets ({c.rounds} round{c.rounds === 1 ? "" : "s"} × {c.rackCount} rack
                  {c.rackCount === 1 ? "" : "s"} × {c.levelCount} level{c.levelCount === 1 ? "" : "s"})
                </span>
              </li>
            ))}
          </ul>
          <form action={addColdRoomAction} className="mt-4 flex flex-wrap items-end gap-3">
            <FieldGroup label="Name">
              <Input name="name" required placeholder="Cold Store 6" className="w-40" />
            </FieldGroup>
            <FieldGroup label="Rounds">
              <Input name="rounds" type="number" min="1" required defaultValue={2} className="w-20" />
            </FieldGroup>
            <FieldGroup label="Racks">
              <Input name="rackCount" type="number" min="1" required defaultValue={11} className="w-20" />
            </FieldGroup>
            <FieldGroup label="Levels">
              <Input name="levelCount" type="number" min="1" required defaultValue={14} className="w-20" />
            </FieldGroup>
            <label className="mb-2 flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" name="isNew" /> New room
            </label>
            <Button type="submit" variant="secondary">
              Add
            </Button>
          </form>
        </Card>
      )}

      {isOwner && (
        <Card>
          <h2 className="text-sm font-semibold text-slate-900">Fields</h2>
          <p className="text-xs text-slate-500">Used to trace pallets back to the source field for farm-to-pallet traceability.</p>
          <ul className="mt-3 divide-y divide-slate-100">
            {fields.map((f) => (
              <li key={f.id} className="flex items-center justify-between py-2 text-sm">
                <span>{f.name}</span>
                <form action={deleteFieldAction.bind(null, f.id)}>
                  <ConfirmSubmitButton confirmMessage={`Remove field "${f.name}"?`}>Remove</ConfirmSubmitButton>
                </form>
              </li>
            ))}
            {fields.length === 0 && <li className="py-2 text-sm text-slate-400">No fields yet.</li>}
          </ul>
          <form action={addFieldAction} className="mt-4 flex items-end gap-3">
            <FieldGroup label="Field name">
              <Input name="name" required className="w-56" />
            </FieldGroup>
            <FieldGroup label="Map reference (optional)">
              <Input name="mapReference" className="w-64" />
            </FieldGroup>
            <Button type="submit" variant="secondary">
              Add
            </Button>
          </form>
        </Card>
      )}
    </div>
  );
}
