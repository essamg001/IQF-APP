import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { notFound } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input, FieldGroup } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { LogRejectWasteForm } from "./log-reject-waste-form";
import { updateShiftCostingAction } from "../actions";
import { canSeeCosting } from "@/lib/roles";
import { getCompanySettings } from "@/lib/companySettings";
import { shiftHoursWorked, shiftCostPerTonneEgp, egpToUsd } from "@/lib/costing";

export default async function ShiftDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  const showCosting = canSeeCosting(session?.user);

  const [shift, companySettings] = await Promise.all([
    prisma.shiftLog.findUnique({
      where: { id },
      include: { factory: true, lots: { include: { pallets: true } }, waste: { orderBy: { date: "desc" } } },
    }),
    showCosting ? getCompanySettings() : Promise.resolve(null),
  ]);
  if (!shift) notFound();

  const hours = shiftHoursWorked(shift);
  const totalRejectWasteKg = shift.waste.reduce((s, w) => s + w.quantity, 0) * 1000;

  const totalTonnageThisShift = shift.lots.reduce(
    (sum, lot) => sum + lot.pallets.reduce((s, p) => s + p.weightTonnes, 0),
    0
  );
  const costPerTonneEgp = showCosting
    ? shiftCostPerTonneEgp(
        {
          rawMaterialCostEgp: shift.rawMaterialCostEgp,
          laborHourlyRateEgpSnapshot: shift.laborHourlyRateEgpSnapshot,
          workerCount: shift.workerCount,
          startTime: shift.startTime,
          endTime: shift.endTime,
        },
        totalTonnageThisShift
      )
    : null;
  const costPerTonneUsd =
    costPerTonneEgp != null ? egpToUsd(costPerTonneEgp, companySettings?.fxRateEgpPerUsd ?? null) : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">
          {shift.factory.name} — {format(shift.date, "dd MMM yyyy")}
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          <Badge color={shift.shiftType === "DAY" ? "amber" : "blue"}>
            {shift.shiftType === "DAY" ? "Shift 1 (Day)" : "Shift 2 (Night)"}
          </Badge>{" "}
          {format(shift.startTime, "HH:mm")}–{format(shift.endTime, "HH:mm")} · {hours.toFixed(1)}h ·{" "}
          {shift.workerCount} workers · {shift.lots.length} lot{shift.lots.length === 1 ? "" : "s"} produced
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Card className="p-3 text-center">
          <p className="text-xs text-slate-500">Rejected fruit composted (this shift)</p>
          <p className="text-lg font-semibold text-slate-900">{totalRejectWasteKg.toFixed(0)} kg</p>
        </Card>
        <Card className="p-3 text-center">
          <p className="text-xs text-slate-500">Entries logged</p>
          <p className="text-lg font-semibold text-slate-900">{shift.waste.length}</p>
        </Card>
      </div>

      {showCosting && (
        <Card>
          <h2 className="text-sm font-semibold text-slate-900">Costing</h2>
          <p className="mt-1 text-xs text-slate-500">
            Labor cost uses the wage rate in effect when confirmed here — later changes to the rate in Settings
            won&apos;t retroactively change this shift&apos;s already-confirmed cost.
          </p>
          <form action={updateShiftCostingAction.bind(null, shift.id)} className="mt-3 flex flex-wrap items-end gap-3">
            <FieldGroup label="Raw material cost (EGP)">
              <Input
                name="rawMaterialCostEgp"
                type="number"
                step="0.01"
                min="0"
                defaultValue={shift.rawMaterialCostEgp ?? ""}
                className="w-40"
              />
            </FieldGroup>
            <FieldGroup label="Labor wage rate (EGP/hour/worker)">
              <Input
                name="laborHourlyRateEgpSnapshot"
                type="number"
                step="0.01"
                min="0"
                defaultValue={shift.laborHourlyRateEgpSnapshot ?? companySettings?.laborHourlyRateEgp ?? ""}
                className="w-56"
              />
            </FieldGroup>
            <Button type="submit" variant="secondary">
              Save
            </Button>
          </form>
          <dl className="mt-4 space-y-1 text-sm">
            <div className="flex justify-between">
              <dt className="text-slate-500">Total tonnage produced this shift</dt>
              <dd className="text-slate-800">{totalTonnageThisShift.toFixed(2)} t</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Cost per tonne (raw material + labor)</dt>
              <dd className="text-slate-800">
                {costPerTonneEgp != null ? (
                  <>
                    {costPerTonneEgp.toLocaleString(undefined, { maximumFractionDigits: 0 })} EGP
                    {costPerTonneUsd != null && ` ($${costPerTonneUsd.toLocaleString(undefined, { maximumFractionDigits: 2 })})`}
                  </>
                ) : (
                  "—"
                )}
              </dd>
            </div>
          </dl>
        </Card>
      )}

      <Card>
        <h2 className="text-sm font-semibold text-slate-900">Reject Fruit — Composted</h2>
        <p className="mt-1 text-xs text-slate-500">
          Fruit pulled off the inspection belt through the shift is gathered and weighed once at the end, not
          per-check or per-pallet — log that end-of-shift weight here.
        </p>

        {shift.waste.length > 0 && (
          <ul className="mt-3 divide-y divide-slate-100 text-sm">
            {shift.waste.map((w) => (
              <li key={w.id} className="flex items-center justify-between py-2">
                <span>{w.reason}</span>
                <span className="text-slate-500">
                  {(w.quantity * 1000).toFixed(0)} kg · {w.date.toLocaleString()}
                </span>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-4 border-t border-slate-100 pt-4">
          <LogRejectWasteForm shiftId={shift.id} showCosting={showCosting} />
        </div>
      </Card>
    </div>
  );
}
