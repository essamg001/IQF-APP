import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { notFound } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Input, Select, FieldGroup } from "@/components/ui/field";
import { Button, LinkButton } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AddLoadLineForm } from "./add-load-line-form";
import {
  updateContainerLocationAction,
  updateLoadingDetailsAction,
  removePalletLoadLineAction,
  completeLoadLineAction,
  toggleStickeringRequiredAction,
  markStickeringCompleteAction,
  signLoadOutRepAction,
  signQualityRepAction,
} from "../actions";

const MAX_LOTS_PER_CONTAINER = 2;

const CAPACITY_TONNES: Record<"PALLETISED" | "UNPALLETISED", number> = {
  PALLETISED: 24,
  UNPALLETISED: 25,
};

export default async function ContainerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  const isLoadOutStation = session?.user.station === "LOAD_OUT";
  const container = await prisma.container.findUnique({
    where: { id },
    include: {
      order: { include: { client: true } },
      palletLines: {
        include: { pallet: { include: { lot: true } } },
        orderBy: { createdAt: "asc" },
      },
    },
  });
  if (!container) notFound();

  const orderPallets = await prisma.pallet.findMany({
    where: { orderId: container.orderId },
    include: { lot: true, loadLines: true },
    orderBy: { palletNumber: "asc" },
  });

  const withRemaining = orderPallets.map((p) => ({
    ...p,
    remaining: p.weightTonnes - p.loadLines.reduce((s, l) => s + l.quantityTonnes, 0),
  }));

  const eligibleToAdd = withRemaining
    .filter((p) => p.remaining > 0.01 && !(p.stickeringRequired && !p.stickeringCompletedAt))
    .map((p) => ({ id: p.id, palletNumber: p.palletNumber, remaining: p.remaining }));

  const pendingPallets = withRemaining.filter((p) => p.remaining > 0.01);

  const totalLoadedThisContainer = container.palletLines.reduce((s, l) => s + l.quantityTonnes, 0);
  const capacity = container.loadType ? CAPACITY_TONNES[container.loadType] : null;

  const distinctLotIds = new Set(container.palletLines.map((l) => l.pallet.lotId));
  const isGradeB = container.palletLines.every((l) => l.pallet.lot.grade === "B");
  const atLotLimit = !isGradeB && distinctLotIds.size >= MAX_LOTS_PER_CONTAINER;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Container {container.containerNumber}</h1>
          <p className="mt-1 text-sm text-slate-500">
            Order <a href={`/orders/${container.orderId}`} className="text-emerald-700 hover:underline">{container.order.orderNumber}</a> ·{" "}
            {container.order.client.name}
          </p>
        </div>
        {!isLoadOutStation && (
          <LinkButton href={`/certificates/container/${container.id}`} variant="secondary">
            View Certificate
          </LinkButton>
        )}
      </div>

      {!isLoadOutStation && (
        <div className="grid grid-cols-2 gap-4">
          <Card>
            <h2 className="text-sm font-semibold text-slate-900">Shipment Details</h2>
            <dl className="mt-3 space-y-2 text-sm">
              <Row label="Carrier" value={container.carrier} />
              <Row label="Departure port" value={container.departurePort} />
              <Row label="Destination port" value={container.destinationPort} />
              <Row label="Departure date" value={container.departureDate?.toDateString()} />
              <Row label="Expected transit" value={container.expectedTransitDays ? `${container.expectedTransitDays} days` : undefined} />
              <Row label="Tracking provider" value={container.trackingProvider} />
              <Row label="Tracking reference" value={container.trackingRef} />
            </dl>
          </Card>

          <Card>
            <h2 className="text-sm font-semibold text-slate-900">Current Location</h2>
            <p className="mt-1 text-sm text-slate-700">{container.currentLocation ?? "Not set"}</p>
            <form action={updateContainerLocationAction.bind(null, container.id)} className="mt-4 space-y-3">
              <FieldGroup label="Update location">
                <Input name="currentLocation" placeholder="e.g. Suez Canal, In transit" defaultValue={container.currentLocation ?? ""} />
              </FieldGroup>
              <Button type="submit" variant="secondary">
                Update
              </Button>
            </form>
          </Card>
        </div>
      )}

      <Card className="border-emerald-200 bg-emerald-50/40">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-emerald-900">📦 Container Load-Out Record</h2>
            <p className="mt-1 max-w-2xl text-sm text-emerald-800">
              This is the final, authoritative record of exactly what was loaded into this container —
              filled out at the dock as pallets are loaded, not at production. It exists so that if a
              client ever disputes what shipped, or a claim comes in, you have pallet-by-pallet proof of
              what left the factory in <span className="font-medium">{container.containerNumber}</span>.
              (Digital equivalent of form GEN03115 — &quot;Identification of Packed Pallets&quot;.) A
              container holds ~25t loose or ~24t palletised — since a pallet is 1.2t, that rarely divides
              evenly, so a pallet&apos;s remaining cartons often carry over into the next container.
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            {container.loadType && (
              <Badge color={container.loadType === "PALLETISED" ? "blue" : "amber"}>
                {container.loadType === "PALLETISED" ? "Palletised" : "Unpalletised (loose cartons)"}
              </Badge>
            )}
            <Badge color={capacity && totalLoadedThisContainer >= capacity - 0.5 ? "green" : "slate"}>
              {totalLoadedThisContainer.toFixed(2)}t{capacity ? ` / ${capacity}t` : ""} loaded
            </Badge>
            {!isGradeB && distinctLotIds.size > 0 && (
              <Badge color={atLotLimit ? "amber" : "slate"}>
                {distinctLotIds.size} / {MAX_LOTS_PER_CONTAINER} lots
              </Badge>
            )}
          </div>
        </div>

        <form
          action={updateLoadingDetailsAction.bind(null, container.id)}
          className="mt-4 flex flex-wrap items-end gap-3 border-t border-emerald-200 pt-4"
        >
          <FieldGroup label="Load type">
            <Select name="loadType" defaultValue={container.loadType ?? ""}>
              <option value="" disabled>
                Select…
              </option>
              <option value="PALLETISED">Palletised — pallet ships as-is</option>
              <option value="UNPALLETISED">Unpalletised — cartons stacked loose</option>
            </Select>
          </FieldGroup>
          <FieldGroup label="Loading date">
            <Input
              name="loadingDate"
              type="date"
              defaultValue={container.loadingDate ? container.loadingDate.toISOString().slice(0, 10) : ""}
            />
          </FieldGroup>
          <FieldGroup label="Loading location">
            <Input name="loadingLocation" defaultValue={container.loadingLocation ?? ""} className="w-56" />
          </FieldGroup>
          <FieldGroup label="Supervisor">
            <Input name="loadingSupervisor" defaultValue={container.loadingSupervisor ?? ""} className="w-48" />
          </FieldGroup>
          <Button type="submit" variant="secondary">
            Save
          </Button>
        </form>
      </Card>

      <Card>
        <h2 className="text-sm font-semibold text-slate-900">
          Allocated Pallets Awaiting Load ({pendingPallets.length})
        </h2>
        <p className="text-xs text-slate-500">
          Pallets allocated to this order with tonnage not yet loaded into any container — resolve stickering
          here before adding them to the manifest below.
        </p>
        <div className="mt-3 divide-y divide-slate-100">
          {pendingPallets.map((p) => (
            <div key={p.id} className="flex items-center justify-between py-2 text-sm">
              <div className="flex items-center gap-3">
                <a href={`/storage/${p.id}`} className="font-medium text-emerald-700 hover:underline">
                  {p.palletNumber}
                </a>
                <span className="text-slate-500">{p.remaining.toFixed(2)}t remaining · Lot {p.lot.lotNumber}</span>
              </div>
              <div>
                {!p.stickeringRequired ? (
                  <form action={toggleStickeringRequiredAction.bind(null, container.id, p.id)}>
                    <button type="submit" className="text-xs text-slate-400 hover:text-slate-600 hover:underline">
                      Not needed — flag?
                    </button>
                  </form>
                ) : p.stickeringCompletedAt ? (
                  <Badge color="green">Stickered</Badge>
                ) : (
                  <div className="flex items-center gap-2">
                    <Badge color="amber">Stickering pending</Badge>
                    <form action={markStickeringCompleteAction.bind(null, container.id, p.id)}>
                      <Button type="submit" variant="secondary" className="text-xs">
                        Mark stickered
                      </Button>
                    </form>
                  </div>
                )}
              </div>
            </div>
          ))}
          {pendingPallets.length === 0 && (
            <p className="py-2 text-sm text-slate-400">All allocated pallets for this order are fully loaded.</p>
          )}
        </div>

        <div className="mt-4 border-t border-slate-100 pt-4">
          <p className="mb-2 text-xs font-medium text-slate-500">Add to this container&apos;s manifest</p>
          <AddLoadLineForm containerId={container.id} pallets={eligibleToAdd} />
        </div>
      </Card>

      <Card className="overflow-x-auto p-0">
        <div className="px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-900">
            Load-Out Manifest — {container.containerNumber} ({container.palletLines.length} line
            {container.palletLines.length === 1 ? "" : "s"})
          </h2>
          <p className="text-xs text-slate-500">
            This is the shipment&apos;s permanent traceability record — exactly which pallets, and how much of
            each, went into this container.
          </p>
        </div>
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-slate-500">
            <tr>
              <th className="px-4 py-2 font-medium">Pallet #</th>
              <th className="px-4 py-2 font-medium">Carton Logo</th>
              <th className="px-4 py-2 font-medium">Variety</th>
              <th className="px-4 py-2 font-medium">Traceability Code / Lot</th>
              <th className="px-4 py-2 font-medium">Client / Grade</th>
              <th className="px-4 py-2 font-medium">Quantity Loaded</th>
              <th className="px-4 py-2 font-medium">Loading Time</th>
              <th className="px-4 py-2 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {container.palletLines.map((line) => {
              const durationMin =
                line.loadingStart && line.loadingEnd
                  ? Math.round((line.loadingEnd.getTime() - line.loadingStart.getTime()) / 60000)
                  : null;
              return (
                <tr key={line.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                  <td className="px-4 py-2">
                    <a href={`/storage/${line.pallet.id}`} className="text-emerald-700 hover:underline">
                      {line.pallet.palletNumber}
                    </a>
                  </td>
                  <td className="px-4 py-2">{line.pallet.cartonLogo ?? "—"}</td>
                  <td className="px-4 py-2">{line.pallet.variety ?? "—"}</td>
                  <td className="px-4 py-2">{line.pallet.lot.lotNumber}</td>
                  <td className="px-4 py-2">
                    {container.order.client.name} / Grade {line.pallet.lot.grade}
                  </td>
                  <td className="px-4 py-2">{line.quantityTonnes.toFixed(2)}t</td>
                  <td className="px-4 py-2">
                    {durationMin !== null ? (
                      <Badge color={durationMin <= 15 ? "green" : "amber"}>{durationMin} min</Badge>
                    ) : (
                      <div className="flex items-center gap-2">
                        <Badge color="slate">In progress</Badge>
                        <form action={completeLoadLineAction.bind(null, container.id, line.id)}>
                          <Button type="submit" variant="secondary" className="text-xs">
                            Mark complete
                          </Button>
                        </form>
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-2">
                    <form action={removePalletLoadLineAction.bind(null, container.id, line.id)}>
                      <button type="submit" className="text-xs text-red-600 hover:underline">
                        Remove
                      </button>
                    </form>
                  </td>
                </tr>
              );
            })}
            {container.palletLines.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-6 text-center text-slate-400">
                  Nothing loaded into this container yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>

      <Card>
        <h2 className="text-sm font-semibold text-slate-900">Sign-Off on Loading Complete</h2>
        <p className="text-xs text-slate-500">
          Once loading is finished, a load-out team representative and a quality representative both sign off.
        </p>
        <div className="mt-3 grid grid-cols-2 gap-4">
          <div>
            <p className="mb-1 text-xs font-medium text-slate-500">Load-Out Team</p>
            {container.loadOutRepName ? (
              <p className="text-sm text-slate-800">
                {container.loadOutRepName}
                <span className="ml-2 text-xs text-slate-500">
                  {container.loadOutSignedAt?.toLocaleString()}
                </span>
              </p>
            ) : (
              <form action={signLoadOutRepAction.bind(null, container.id)} className="flex items-end gap-2">
                <FieldGroup label="Name">
                  <Input name="loadOutRepName" required className="w-48" />
                </FieldGroup>
                <Button type="submit" variant="secondary">
                  Sign off
                </Button>
              </form>
            )}
          </div>
          <div>
            <p className="mb-1 text-xs font-medium text-slate-500">Quality Department</p>
            {container.qualityRepName ? (
              <p className="text-sm text-slate-800">
                {container.qualityRepName}
                <span className="ml-2 text-xs text-slate-500">
                  {container.qualitySignedAt?.toLocaleString()}
                </span>
              </p>
            ) : (
              <form action={signQualityRepAction.bind(null, container.id)} className="flex items-end gap-2">
                <FieldGroup label="Name">
                  <Input name="qualityRepName" required className="w-48" />
                </FieldGroup>
                <Button type="submit" variant="secondary">
                  Sign off
                </Button>
              </form>
            )}
          </div>
        </div>
      </Card>
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
