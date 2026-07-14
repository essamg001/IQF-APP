import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { Card } from "@/components/ui/card";
import { Input, FieldGroup } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ROLE_LABELS } from "@/lib/roles";
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
  addColdRoomAction,
  addFieldAction,
  deleteFieldAction,
  deleteUserAction,
  toggleHeadOfSalesAction,
} from "./actions";
import { AddUserForm } from "./add-user-form";

export default async function SettingsPage() {
  const session = await auth();
  const isOwner = session?.user.role === "OWNER";

  const [factories, coldRooms, fields, users] = await Promise.all([
    prisma.factory.findMany({ orderBy: { name: "asc" } }),
    prisma.coldRoom.findMany({ orderBy: { name: "asc" } }),
    prisma.field.findMany({ orderBy: { name: "asc" } }),
    isOwner ? prisma.user.findMany({ orderBy: { name: "asc" } }) : Promise.resolve([]),
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
                        <button type="submit" className="text-xs text-slate-400 hover:text-slate-600 hover:underline">
                          Make head of sales?
                        </button>
                      </form>
                    ))}
                  {u.id !== session?.user.id && (
                    <form action={deleteUserAction.bind(null, u.id)}>
                      <button className="text-xs text-red-600 hover:underline">Remove</button>
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

      <Card>
        <h2 className="text-sm font-semibold text-slate-900">Factories</h2>
        <ul className="mt-3 divide-y divide-slate-100">
          {factories.map((f) => (
            <li key={f.id} className="flex justify-between py-2 text-sm">
              <span>{f.name}</span>
              <span className="text-slate-500">{f.capacityTonnesPerHour} t/hr</span>
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

      <Card>
        <h2 className="text-sm font-semibold text-slate-900">Cold Rooms</h2>
        <ul className="mt-3 divide-y divide-slate-100">
          {coldRooms.map((c) => (
            <li key={c.id} className="flex items-center justify-between py-2 text-sm">
              <span className="flex items-center gap-2">
                {c.name}
                <Badge color={c.isNew ? "green" : "slate"}>{c.isNew ? "New" : "Old"}</Badge>
              </span>
              <span className="text-slate-500">{c.capacityPallets} pallets</span>
            </li>
          ))}
        </ul>
        <form action={addColdRoomAction} className="mt-4 flex items-end gap-3">
          <FieldGroup label="Name">
            <Input name="name" required placeholder="Cold Store 6" className="w-48" />
          </FieldGroup>
          <FieldGroup label="Capacity (pallets)">
            <Input name="capacityPallets" type="number" required className="w-32" />
          </FieldGroup>
          <label className="mb-2 flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" name="isNew" /> New room
          </label>
          <Button type="submit" variant="secondary">
            Add
          </Button>
        </form>
      </Card>

      <Card>
        <h2 className="text-sm font-semibold text-slate-900">Fields</h2>
        <p className="text-xs text-slate-500">Used to trace pallets back to the source field for farm-to-pallet traceability.</p>
        <ul className="mt-3 divide-y divide-slate-100">
          {fields.map((f) => (
            <li key={f.id} className="flex items-center justify-between py-2 text-sm">
              <span>{f.name}</span>
              <form action={deleteFieldAction.bind(null, f.id)}>
                <button className="text-xs text-red-600 hover:underline">Remove</button>
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
    </div>
  );
}
