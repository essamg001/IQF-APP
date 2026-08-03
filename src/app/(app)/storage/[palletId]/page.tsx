import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { notFound } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input, FieldGroup } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { markWasteAction } from "../../production/actions";
import { combinedMicroStatus } from "@/lib/microbiology";
import { canSeeCosting } from "@/lib/roles";

const STATUS_COLOR = {
  IN_STORAGE: "slate",
  ALLOCATED: "blue",
  SHIPPED: "green",
  WASTE: "red",
  DISCOUNT_OFFERED: "amber",
} as const;

export default async function PalletDetailPage({ params }: { params: Promise<{ palletId: string }> }) {
  const { palletId } = await params;
  const session = await auth();
  const showCosting = canSeeCosting(session?.user);
  const pallet = await prisma.pallet.findUnique({
    where: { id: palletId },
    include: {
      lot: { include: { field: true, factory: true, shift: true, microbiologyResults: true } },
      coldRoom: true,
      client: true,
      order: true,
      waste: true,
      qualityChecks: true,
      loadLines: { include: { container: true }, orderBy: { createdAt: "asc" } },
      slot: true,
    },
  });
  if (!pallet) notFound();

  const loadedTonnes = pallet.loadLines.reduce((s, l) => s + l.quantityTonnes, 0);
  const remainingTonnes = pallet.weightTonnes - loadedTonnes;

  const FORMAT_LABEL = { WHOLE: "Whole", SLICED: "Sliced", DICED: "Diced" } as const;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <h1 className="text-xl font-semibold text-slate-900">Pallet {pallet.palletNumber}</h1>
        <Badge color={STATUS_COLOR[pallet.status]}>{pallet.status.replace("_", " ")}</Badge>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Card>
          <h2 className="text-sm font-semibold text-slate-900">Traceability</h2>
          <dl className="mt-3 space-y-2 text-sm">
            <Row label="Lot number" value={pallet.lot.lotNumber} />
            <Row label="Factory" value={pallet.lot.factory.name} />
            <Row label="Field" value={pallet.lot.field.name} />
            <Row label="Grade" value={`Grade ${pallet.lot.grade}`} />
            <Row label="Format" value={FORMAT_LABEL[pallet.lot.format]} />
            <Row label="Weight" value={`${pallet.weightTonnes} t`} />
            <Row label="Cold room" value={pallet.coldRoom?.name} />
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">Storage slot</dt>
              <dd className="text-right text-slate-800">
                {pallet.slot ? (
                  <>
                    Rack {pallet.slot.rack} · Level {pallet.slot.level} · Round {pallet.slot.round}{" "}
                    <a href={`/storage/map/${pallet.coldRoomId}`} className="text-emerald-700 hover:underline">
                      (view map)
                    </a>
                  </>
                ) : pallet.coldRoomId ? (
                  <a href={`/storage/map/${pallet.coldRoomId}`} className="text-emerald-700 hover:underline">
                    Not yet assigned a slot — assign one
                  </a>
                ) : (
                  "—"
                )}
              </dd>
            </div>
            <Row
              label="Microbiology"
              value={combinedMicroStatus(pallet.lot.microbiologyResults, pallet.lot.shift.onHold).replace("_", " ")}
            />
            <Row label="Client (allocated)" value={pallet.client?.name} />
          </dl>
        </Card>

        <Card>
          <h2 className="text-sm font-semibold text-slate-900">Waste</h2>
          {pallet.waste.length > 0 ? (
            <ul className="mt-2 space-y-2 text-sm">
              {pallet.waste.map((w) => (
                <li key={w.id} className="rounded-md border border-slate-200 p-2">
                  <p className="font-medium text-slate-800">
                    {w.quantity}t — {w.reason}
                    {showCosting && w.valueUsd != null && ` — $${w.valueUsd.toLocaleString()}`}
                  </p>
                  <p className="text-xs text-slate-500">{w.date.toDateString()}</p>
                </li>
              ))}
            </ul>
          ) : pallet.status === "WASTE" ? (
            <p className="mt-2 text-sm text-slate-400">Marked as waste, no reason on file.</p>
          ) : (
            <>
              <p className="mt-1 text-xs text-slate-500">Mark this pallet as waste (e.g. handling damage, quality reject).</p>
              <form action={markWasteAction.bind(null, pallet.id)} className="mt-3 space-y-3">
                <FieldGroup label="Reason">
                  <Input name="reason" required placeholder="e.g. Handling damage" />
                </FieldGroup>
                <FieldGroup label="Quantity (tonnes)">
                  <Input name="quantity" type="number" step="0.1" defaultValue={pallet.weightTonnes} />
                </FieldGroup>
                {showCosting && (
                  <FieldGroup label="Value (USD)">
                    <Input name="valueUsd" type="number" step="0.01" min="0" />
                  </FieldGroup>
                )}
                <Button type="submit" variant="danger">
                  Mark as waste
                </Button>
              </form>
            </>
          )}
        </Card>
      </div>

      <Card>
        <h2 className="text-sm font-semibold text-slate-900">Packing Details — Identification of Packed Pallets (GEN03115)</h2>
        <dl className="mt-3 grid grid-cols-4 gap-x-6 gap-y-2 text-sm">
          <Row label="Packing date" value={pallet.packingDate?.toDateString()} />
          <Row label="Packing location" value={pallet.packingLocation} />
          <Row label="Supervisor" value={pallet.packingSupervisor} />
          <Row label="Carton logo" value={pallet.cartonLogo} />
          <Row label="Carton size" value={pallet.cartonSize} />
          <Row label="Variety" value={pallet.variety} />
          <Row label="Client (spec note)" value={pallet.clientSpecNote} />
          <Row label="Quality grade" value={pallet.qualityGrade ? `Grade ${pallet.qualityGrade}` : undefined} />
          <Row label="Total cartons" value={pallet.totalCartons?.toString()} />
          <Row label="Product" value={pallet.isMixedVariety ? "Mixed varieties" : "One variety"} />
          <Row label="Parcels" value={pallet.fullPallet ? "Full pallet" : "Partial"} />
          <Row label="Beginning of palletization" value={pallet.palletizationStart?.toLocaleString()} />
          <Row label="End of palletization" value={pallet.palletizationEnd?.toLocaleString()} />
        </dl>

        <h3 className="mt-4 text-xs font-semibold uppercase tracking-wide text-slate-500">
          Fruit Diameter — from Post-Freeze Inspection
        </h3>
        <dl className="mt-2 grid grid-cols-4 gap-x-6 gap-y-2 text-sm">
          <Row label="Uncalibrated" value={pallet.fruitDiameterUncalibrated} />
          <Row label="Calibrated — small" value={pallet.fruitDiameterCalibratedSmall} />
          <Row label="Calibrated — medium" value={pallet.fruitDiameterCalibratedMedium} />
          <Row label="Calibrated — large" value={pallet.fruitDiameterCalibratedLarge} />
        </dl>

        {pallet.loadLines.length > 0 && (
          <>
            <h2 className="mt-4 text-sm font-semibold text-slate-900">Load-Out History</h2>
            <p className="text-xs text-slate-500">
              {loadedTonnes.toFixed(2)}t of {pallet.weightTonnes}t loaded
              {remainingTonnes > 0.01 && ` — ${remainingTonnes.toFixed(2)}t remaining, to be loaded into a future container`}
            </p>
            <ul className="mt-2 space-y-1 text-sm">
              {pallet.loadLines.map((line) => (
                <li key={line.id} className="flex justify-between">
                  <a href={`/logistics/${line.container.id}`} className="text-emerald-700 hover:underline">
                    {line.container.containerNumber}
                  </a>
                  <span className="text-slate-600">
                    {line.quantityTonnes.toFixed(2)}t
                    {line.loadingEnd
                      ? ` · ${line.loadingEnd.toLocaleString()}`
                      : line.loadingStart
                        ? " · in progress"
                        : ""}
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </Card>

      {pallet.qualityChecks.length > 0 && (
        <Card>
          <h2 className="text-sm font-semibold text-slate-900">Quality Checks for this Pallet</h2>
          <ul className="mt-2 space-y-2">
            {pallet.qualityChecks.map((q) => (
              <li key={q.id} className="rounded-md border border-slate-200 p-2 text-sm">
                <div className="flex justify-between">
                  <span className="font-medium">
                    {q.checkpoint === "RAW_MATERIAL" ? "Raw Material" : "Post-Packaging"}
                  </span>
                  <span className="text-slate-500">Brix {q.brix}</span>
                </div>
                <p className="text-xs text-slate-500">
                  Mould {q.mouldPct}% · Skin damage {q.skinDamagePct}% · Internal quality {q.internalQualityPct}%
                  {q.foreignOdor && ` · Foreign odor: ${q.foreignOdor}`}
                </p>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-slate-500">{label}</dt>
      <dd className="text-right text-slate-800">{value || "—"}</dd>
    </div>
  );
}
