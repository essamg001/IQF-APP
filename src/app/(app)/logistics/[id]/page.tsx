import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { notFound } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Input, Select, FieldGroup } from "@/components/ui/field";
import { Button, LinkButton } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PortInput } from "@/components/port-select";
import { FORMAT_LABEL } from "@/lib/format";
import { canSeePricing } from "@/lib/roles";
import { AddLoadLineForm } from "./add-load-line-form";
import { AddCostForm } from "./add-cost-form";
import { AddTemperatureForm } from "./add-temperature-form";
import {
  updateContainerLocationAction,
  updateLoadingDetailsAction,
  updateShipmentDetailsAction,
  updateContainerValueAction,
  updateExportDocumentsAction,
  updateReeferSetPointAction,
  removeContainerCostAction,
  removePalletLoadLineAction,
  completeLoadLineAction,
  toggleStickeringRequiredAction,
  markStickeringCompleteAction,
  signLoadOutRepAction,
  signQualityRepAction,
} from "../actions";

const CAPACITY_TONNES: Record<"PALLETISED" | "UNPALLETISED", number> = {
  PALLETISED: 24,
  UNPALLETISED: 25,
};

const COST_CATEGORY_LABEL: Record<string, string> = {
  DEMURRAGE: "Demurrage",
  DETENTION: "Detention",
  STORAGE: "Storage",
  CUSTOMS_DELAY: "Customs Delay",
  DOCUMENTATION: "Documentation",
  INSPECTION: "Inspection",
  REROUTING: "Rerouting",
  OTHER: "Other",
};

// Matches the tolerance addTemperatureReadingAction uses to decide whether a
// reading is worth alerting on -- kept in sync so a reading flagged here is
// exactly the one that triggered (or would have triggered) an alert.
const TEMPERATURE_EXCURSION_TOLERANCE_C = 2;

export default async function ContainerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  const isLoadOutStation = session?.user.station === "LOAD_OUT";
  const showPricing = canSeePricing(session?.user.role);
  const container = await prisma.container.findUnique({
    where: { id },
    include: {
      order: { include: { client: true } },
      palletLines: {
        include: { pallet: { include: { lot: true } } },
        orderBy: { createdAt: "asc" },
      },
      costs: { orderBy: { incurredAt: "desc" } },
      temperatureLogs: { orderBy: { recordedAt: "desc" } },
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

  const distinctLotIds = new Set(container.palletLines.map((l) => l.pallet.lotId));

  // No hard cap on lots per container -- early in the season daily production
  // can be a fraction of a container's capacity, so filling one legitimately
  // takes pallets from several days' lots. Instead, pallets from a lot already
  // in this container are listed first, so whoever's loading naturally
  // finishes off the lot(s) already in progress before a new one is pulled in,
  // keeping the count as low as the day's production actually allows.
  const eligibleToAdd = withRemaining
    .filter((p) => p.remaining > 0.01 && !(p.stickeringRequired && !p.stickeringCompletedAt))
    .sort((a, b) => (distinctLotIds.has(a.lotId) ? 0 : 1) - (distinctLotIds.has(b.lotId) ? 0 : 1))
    .map((p) => ({ id: p.id, palletNumber: p.palletNumber, remaining: p.remaining, lotNumber: p.lot.lotNumber }));

  const pendingPallets = withRemaining.filter((p) => p.remaining > 0.01);

  const totalLoadedThisContainer = container.palletLines.reduce((s, l) => s + l.quantityTonnes, 0);
  const capacity = container.loadType ? CAPACITY_TONNES[container.loadType] : null;

  // A pallet's cartons can be split across two containers when it fills one
  // up mid-pallet, so a container's own carton count is prorated by however
  // much of each pallet's weight actually went into it, not just summed
  // whole -- otherwise a split pallet's cartons would be double-counted
  // across both containers it touched.
  const totalCartonsThisContainer = container.palletLines.reduce((sum, line) => {
    if (!line.pallet.totalCartons || line.pallet.weightTonnes <= 0) return sum;
    const fraction = Math.min(1, line.quantityTonnes / line.pallet.weightTonnes);
    return sum + line.pallet.totalCartons * fraction;
  }, 0);

  const valueByWeightUsd = container.pricePerKgUsd != null ? container.pricePerKgUsd * totalLoadedThisContainer * 1000 : null;
  const valueByCartonUsd =
    container.pricePerCartonUsd != null ? container.pricePerCartonUsd * totalCartonsThisContainer : null;

  const totalExtraCostsUsd = container.costs.reduce((s, c) => s + c.amountUsd, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold text-slate-900">Container {container.containerNumber}</h1>
            <Badge color={container.order.grade === "A" ? "green" : "amber"}>Grade {container.order.grade}</Badge>
            <Badge color="slate">{FORMAT_LABEL[container.order.format]}</Badge>
            {container.destinationCountry &&
              container.order.client.country &&
              container.destinationCountry.trim().toLowerCase() !== container.order.client.country.trim().toLowerCase() && (
                <Badge color="amber">In transit to {container.destinationCountry} (client is in {container.order.client.country})</Badge>
              )}
          </div>
          <p className="mt-1 text-sm text-slate-500">
            Order <a href={`/orders/${container.orderId}`} className="text-emerald-700 hover:underline">{container.order.orderNumber}</a> ·{" "}
            {container.order.client.name}
            {container.destinationCountry && ` · Destination: ${container.destinationCountry}`}
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
            <form action={updateShipmentDetailsAction.bind(null, container.id)} className="mt-3 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <FieldGroup label="Carrier">
                  <Input name="carrier" defaultValue={container.carrier ?? ""} placeholder="e.g. Maersk, MSC" />
                </FieldGroup>
                <FieldGroup label="Booking number">
                  <Input name="bookingNumber" defaultValue={container.bookingNumber ?? ""} />
                </FieldGroup>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <FieldGroup label="Vessel name">
                  <Input name="vesselName" defaultValue={container.vesselName ?? ""} />
                </FieldGroup>
                <FieldGroup label="Voyage number">
                  <Input name="voyageNumber" defaultValue={container.voyageNumber ?? ""} />
                </FieldGroup>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <FieldGroup label="Departure port">
                  <PortInput name="departurePort" defaultValue={container.departurePort ?? ""} />
                </FieldGroup>
                <FieldGroup label="Destination port">
                  <Input name="destinationPort" defaultValue={container.destinationPort ?? ""} />
                </FieldGroup>
              </div>
              <FieldGroup label="Destination country">
                <Input
                  name="destinationCountry"
                  defaultValue={container.destinationCountry ?? ""}
                  placeholder="e.g. Germany"
                />
              </FieldGroup>
              <div className="grid grid-cols-2 gap-3">
                <FieldGroup label="Departure date">
                  <Input
                    name="departureDate"
                    type="date"
                    defaultValue={container.departureDate ? container.departureDate.toISOString().slice(0, 10) : ""}
                  />
                </FieldGroup>
                <FieldGroup label="Expected transit (days)">
                  <Input name="expectedTransitDays" type="number" min="1" defaultValue={container.expectedTransitDays ?? ""} />
                </FieldGroup>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <FieldGroup label="Tracking provider">
                  <Input name="trackingProvider" defaultValue={container.trackingProvider ?? ""} placeholder="e.g. ShipsGo" />
                </FieldGroup>
                <FieldGroup label="Tracking reference">
                  <Input name="trackingRef" defaultValue={container.trackingRef ?? ""} />
                </FieldGroup>
              </div>
              <div className="grid grid-cols-2 gap-3 border-t border-slate-100 pt-3">
                <FieldGroup label="Seal number">
                  <Input name="sealNumber" defaultValue={container.sealNumber ?? ""} placeholder="e.g. SL1234567" />
                </FieldGroup>
                <FieldGroup label="Bill of lading number">
                  <Input name="billOfLadingNumber" defaultValue={container.billOfLadingNumber ?? ""} />
                </FieldGroup>
              </div>
              <Button type="submit" variant="secondary">
                Save
              </Button>
            </form>
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

            {showPricing && (
              <div className="mt-6 border-t border-slate-100 pt-4">
                <h3 className="text-sm font-semibold text-slate-900">Container Value</h3>
                <form action={updateContainerValueAction.bind(null, container.id)} className="mt-3 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <FieldGroup label="Price per kg (USD)">
                      <Input name="pricePerKgUsd" type="number" step="0.001" min="0" defaultValue={container.pricePerKgUsd ?? ""} />
                    </FieldGroup>
                    <FieldGroup label="Price per carton (USD)">
                      <Input
                        name="pricePerCartonUsd"
                        type="number"
                        step="0.01"
                        min="0"
                        defaultValue={container.pricePerCartonUsd ?? ""}
                      />
                    </FieldGroup>
                  </div>
                  <Button type="submit" variant="secondary">
                    Save
                  </Button>
                </form>
                <dl className="mt-3 space-y-1 text-sm">
                  <Row
                    label={`By weight (${(totalLoadedThisContainer * 1000).toFixed(0)} kg)`}
                    value={valueByWeightUsd != null ? `$${valueByWeightUsd.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : undefined}
                  />
                  <Row
                    label={`By cartons (${totalCartonsThisContainer.toFixed(0)} ctn)`}
                    value={valueByCartonUsd != null ? `$${valueByCartonUsd.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : undefined}
                  />
                  <Row label="Payment terms" value={container.order.client.paymentTerms} />
                </dl>
              </div>
            )}
          </Card>
        </div>
      )}

      {!isLoadOutStation && (
        <Card>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Additional Logistics Costs</h2>
              <p className="mt-1 text-xs text-slate-500">
                Demurrage, detention, storage, a customs hold, a reroute — anything beyond the base freight rate.
              </p>
            </div>
            {container.costs.length > 0 && (
              <Badge color="amber">${totalExtraCostsUsd.toLocaleString(undefined, { maximumFractionDigits: 0 })} total</Badge>
            )}
          </div>

          {container.costs.length > 0 && (
            <ul className="mt-3 divide-y divide-slate-100 text-sm">
              {container.costs.map((c) => (
                <li key={c.id} className="flex items-center justify-between py-2">
                  <div>
                    <Badge color="slate">{COST_CATEGORY_LABEL[c.category]}</Badge>
                    <span className="ml-2 text-slate-700">${c.amountUsd.toLocaleString()}</span>
                    {c.description && <span className="ml-2 text-slate-500">{c.description}</span>}
                    <span className="ml-2 text-xs text-slate-400">{c.incurredAt.toDateString()}</span>
                  </div>
                  <form action={removeContainerCostAction.bind(null, container.id, c.id)}>
                    <button type="submit" className="text-xs text-red-600 hover:underline">
                      Remove
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-4 border-t border-slate-100 pt-4">
            <AddCostForm containerId={container.id} />
          </div>
        </Card>
      )}

      {!isLoadOutStation && (
        <div className="grid grid-cols-2 gap-4">
          <Card>
            <h2 className="text-sm font-semibold text-slate-900">Export Documents</h2>
            <p className="mt-1 text-xs text-slate-500">
              What customs and the client&apos;s own import broker actually ask for — separate from the
              factory&apos;s Certificate of Quality.
            </p>
            <form action={updateExportDocumentsAction.bind(null, container.id)} className="mt-3 space-y-3">
              <FieldGroup label="Phytosanitary certificate number">
                <Input name="phytosanitaryCertNumber" defaultValue={container.phytosanitaryCertNumber ?? ""} />
              </FieldGroup>
              <FieldGroup label="Certificate of origin number">
                <Input name="certificateOfOriginNumber" defaultValue={container.certificateOfOriginNumber ?? ""} />
              </FieldGroup>
              <FieldGroup label="Customs export declaration number">
                <Input
                  name="customsExportDeclarationNumber"
                  defaultValue={container.customsExportDeclarationNumber ?? ""}
                />
              </FieldGroup>
              <Button type="submit" variant="secondary">
                Save
              </Button>
            </form>
          </Card>

          <Card>
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">Reefer Temperature</h2>
                <p className="mt-1 text-xs text-slate-500">
                  Readings during transit, compared against the set-point below — no fixed schedule, log
                  whatever the forwarder reports.
                </p>
              </div>
              {container.reeferSetPointC != null && <Badge color="blue">Set-point {container.reeferSetPointC}°C</Badge>}
            </div>

            <form action={updateReeferSetPointAction.bind(null, container.id)} className="mt-3 flex items-end gap-3">
              <FieldGroup label="Set-point (°C)">
                <Input
                  name="reeferSetPointC"
                  type="number"
                  step="0.1"
                  defaultValue={container.reeferSetPointC ?? ""}
                  placeholder="e.g. -18"
                  className="w-28"
                />
              </FieldGroup>
              <Button type="submit" variant="secondary">
                Save
              </Button>
            </form>

            {container.temperatureLogs.length > 0 && (
              <ul className="mt-3 max-h-56 divide-y divide-slate-100 overflow-y-auto text-sm">
                {container.temperatureLogs.map((t) => {
                  const isExcursion =
                    container.reeferSetPointC != null &&
                    Math.abs(t.temperatureC - container.reeferSetPointC) > TEMPERATURE_EXCURSION_TOLERANCE_C;
                  return (
                    <li key={t.id} className="flex items-center justify-between py-2">
                      <div>
                        <Badge color={isExcursion ? "red" : "slate"}>{t.temperatureC}°C</Badge>
                        {t.notes && <span className="ml-2 text-slate-500">{t.notes}</span>}
                      </div>
                      <span className="text-xs text-slate-400">{t.recordedAt.toLocaleString()}</span>
                    </li>
                  );
                })}
              </ul>
            )}

            <div className="mt-4 border-t border-slate-100 pt-4">
              <AddTemperatureForm containerId={container.id} />
            </div>
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
            {distinctLotIds.size > 0 && (
              <Badge color={distinctLotIds.size > 1 ? "amber" : "slate"}>
                {distinctLotIds.size} lot{distinctLotIds.size === 1 ? "" : "s"} used
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
