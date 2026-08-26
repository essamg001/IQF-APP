import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { notFound } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Input, Select, FieldGroup } from "@/components/ui/field";
import { Button, LinkButton } from "@/components/ui/button";
import { ConfirmSubmitButton } from "@/components/ui/confirm-submit-button";
import { Badge } from "@/components/ui/badge";
import { PortInput } from "@/components/port-select";
import { CarrierInput } from "@/components/carrier-select";
import { canSeeContainerValue, canSignSpecException } from "@/lib/roles";
import { TestDataBadge, TEST_DATA_TEXT_CLASS } from "@/components/test-data-badge";
import { cn } from "@/lib/cn";
import {
  CAPACITY_TONNES,
  isManifestLocked,
  computeContainerChecklist,
  isChecklistComplete,
  CONTAINER_CHECKLIST_ITEMS,
} from "@/lib/logistics";
import { AddLoadLineForm } from "./add-load-line-form";
import { AddCostForm } from "./add-cost-form";
import { AddTemperatureForm } from "./add-temperature-form";
import { SignOffForm } from "./sign-off-form";
import { ReopenManifestForm } from "./reopen-manifest-form";
import { ChecklistItemConfirmForm } from "./checklist-item-confirm-form";
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
  reopenContainerManifestAction,
  confirmChecklistItemAction,
  addContainerLoadPhotoAction,
  removeContainerLoadPhotoAction,
} from "../actions";
import { resolveLocale } from "@/lib/i18n/resolveLocale";
import { getDictionary } from "@/lib/i18n/getDictionary";
import { formatDate } from "@/lib/dates";

// Matches the tolerance addTemperatureReadingAction uses to decide whether a
// reading is worth alerting on -- kept in sync so a reading flagged here is
// exactly the one that triggered (or would have triggered) an alert.
const TEMPERATURE_EXCURSION_TOLERANCE_C = 2;

export default async function ContainerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  const isLoadOutStation = session?.user.station === "LOAD_OUT";
  const showPricing = canSeeContainerValue(session?.user);
  const canSignOffSpecException = canSignSpecException(session?.user);
  const locale = await resolveLocale();
  const fullDict = getDictionary(locale);
  const dict = fullDict.logistics;
  const COST_CATEGORY_LABEL: Record<string, string> = {
    DEMURRAGE: dict.costDemurrage,
    DETENTION: dict.costDetention,
    STORAGE: dict.costStorage,
    CUSTOMS_DELAY: dict.costCustomsDelay,
    DOCUMENTATION: dict.costDocumentation,
    INSPECTION: dict.costInspection,
    REROUTING: dict.costRerouting,
    OTHER: dict.costOther,
  };
  const FORMAT_LABEL: Record<string, string> = {
    WHOLE: fullDict.orders.formatWhole,
    SLICED: fullDict.orders.formatSliced,
    DICED: fullDict.orders.formatDiced,
  };
  const CHECKLIST_LABELS: Record<string, string> = {
    seal: dict.checklistSealLabel,
    reefer: dict.checklistReeferLabel,
    photo: dict.checklistPhotoLabel,
    preLoadInspection: dict.checklistPreLoadInspectionLabel,
    stickering: dict.checklistStickeringLabel,
    coldChain: dict.checklistColdChainLabel,
    loadLine: dict.checklistLoadLineLabel,
  };
  const CHECKLIST_ITEM_DICT: Record<string, { label: string; confirmMessage: string; buttonLabel: string }> = {
    preLoadInspection: {
      label: dict.checklistPreLoadInspectionLabel,
      confirmMessage: dict.checklistPreLoadInspectionConfirm,
      buttonLabel: dict.checklistPreLoadInspectionButton,
    },
    stickering: {
      label: dict.checklistStickeringLabel,
      confirmMessage: dict.checklistStickeringConfirm,
      buttonLabel: dict.checklistStickeringButton,
    },
    coldChain: {
      label: dict.checklistColdChainLabel,
      confirmMessage: dict.checklistColdChainConfirm,
      buttonLabel: dict.checklistColdChainButton,
    },
    loadLine: {
      label: dict.checklistLoadLineLabel,
      confirmMessage: dict.checklistLoadLineConfirm,
      buttonLabel: dict.checklistLoadLineButton,
    },
  };
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
      loadPhotos: { include: { uploadedBy: true }, orderBy: { createdAt: "desc" } },
      checklistConfirmations: true,
    },
  });
  if (!container) notFound();

  const manifestLocked = isManifestLocked(container);
  const checklist = computeContainerChecklist(container, CHECKLIST_LABELS);
  const checklistComplete = isChecklistComplete(container);
  const currentUserLabel = session?.user.name ?? session?.user.email ?? null;

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
            <h1 className="text-xl font-semibold text-slate-900">{dict.containerTitle.replace("{number}", container.containerNumber)}</h1>
            <Badge color={container.order.grade === "A" ? "green" : "amber"}>{dict.gradeLabel.replace("{grade}", container.order.grade)}</Badge>
            <Badge color="slate">{FORMAT_LABEL[container.order.format]}</Badge>
            {container.destinationCountry &&
              container.order.client.country &&
              container.destinationCountry.trim().toLowerCase() !== container.order.client.country.trim().toLowerCase() && (
                <Badge color="amber">
                  {dict.inTransitToBadge
                    .replace("{destination}", container.destinationCountry)
                    .replace("{client}", container.order.client.country)}
                </Badge>
              )}
          </div>
          <p className="mt-1 text-sm text-slate-500">
            {dict.orderLine}{" "}
            <a href={`/orders/${container.orderId}`} className="text-emerald-700 hover:underline">{container.order.orderNumber}</a> ·{" "}
            {container.order.client.name}
            {container.destinationCountry && ` · ${dict.colDestination}: ${container.destinationCountry}`}
          </p>
        </div>
        {!isLoadOutStation && (
          <LinkButton href={`/certificates/container/${container.id}`} variant="secondary">
            {dict.viewCertificate}
          </LinkButton>
        )}
      </div>

      {!isLoadOutStation && (
        <div className="grid grid-cols-2 gap-4">
          <Card>
            <h2 className="text-sm font-semibold text-slate-900">{dict.shipmentDetailsTitle}</h2>
            <form action={updateShipmentDetailsAction.bind(null, container.id)} className="mt-3 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <FieldGroup label={dict.carrierLabel}>
                  <CarrierInput name="carrier" defaultValue={container.carrier ?? ""} />
                </FieldGroup>
                <FieldGroup label={dict.bookingNumberLabel}>
                  <Input name="bookingNumber" defaultValue={container.bookingNumber ?? ""} />
                </FieldGroup>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <FieldGroup label={dict.vesselNameLabel}>
                  <Input name="vesselName" defaultValue={container.vesselName ?? ""} />
                </FieldGroup>
                <FieldGroup label={dict.voyageNumberLabel}>
                  <Input name="voyageNumber" defaultValue={container.voyageNumber ?? ""} />
                </FieldGroup>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <FieldGroup label={dict.departurePortLabel}>
                  <PortInput name="departurePort" defaultValue={container.departurePort ?? ""} />
                </FieldGroup>
                <FieldGroup label={dict.destinationPortLabel}>
                  <Input name="destinationPort" defaultValue={container.destinationPort ?? ""} />
                </FieldGroup>
              </div>
              <FieldGroup label={dict.destinationCountryLabel}>
                <Input
                  name="destinationCountry"
                  defaultValue={container.destinationCountry ?? ""}
                  placeholder={dict.destinationCountryPlaceholder}
                />
              </FieldGroup>
              <div className="grid grid-cols-2 gap-3">
                <FieldGroup label={dict.departureDateLabel}>
                  <Input
                    name="departureDate"
                    type="date"
                    defaultValue={container.departureDate ? container.departureDate.toISOString().slice(0, 10) : ""}
                  />
                </FieldGroup>
                <FieldGroup label={dict.expectedTransitLabel}>
                  <Input name="expectedTransitDays" type="number" min="1" defaultValue={container.expectedTransitDays ?? ""} />
                </FieldGroup>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <FieldGroup label={dict.trackingProviderLabelPlain}>
                  <Input name="trackingProvider" defaultValue={container.trackingProvider ?? ""} placeholder={dict.trackingProviderPlaceholder} />
                </FieldGroup>
                <FieldGroup label={dict.trackingRefLabelPlain}>
                  <Input name="trackingRef" defaultValue={container.trackingRef ?? ""} />
                </FieldGroup>
              </div>
              <div className="grid grid-cols-2 gap-3 border-t border-slate-100 pt-3">
                <FieldGroup label={dict.sealNumberLabel}>
                  <Input name="sealNumber" defaultValue={container.sealNumber ?? ""} placeholder={dict.sealNumberPlaceholder} />
                </FieldGroup>
                <FieldGroup label={dict.billOfLadingNumberLabel}>
                  <Input name="billOfLadingNumber" defaultValue={container.billOfLadingNumber ?? ""} />
                </FieldGroup>
              </div>
              <Button type="submit" variant="secondary">
                {dict.save}
              </Button>
            </form>
          </Card>

          <Card>
            <h2 className="text-sm font-semibold text-slate-900">{dict.currentLocationTitle}</h2>
            <p className="mt-1 text-sm text-slate-700">{container.currentLocation ?? dict.notSet}</p>
            <form action={updateContainerLocationAction.bind(null, container.id)} className="mt-4 space-y-3">
              <FieldGroup label={dict.updateLocationLabel}>
                <Input name="currentLocation" placeholder={dict.updateLocationPlaceholder} defaultValue={container.currentLocation ?? ""} />
              </FieldGroup>
              <Button type="submit" variant="secondary">
                {dict.update}
              </Button>
            </form>

            {showPricing && (
              <div className="mt-6 border-t border-slate-100 pt-4">
                <h3 className="text-sm font-semibold text-slate-900">{dict.containerValueTitle}</h3>
                <form action={updateContainerValueAction.bind(null, container.id)} className="mt-3 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <FieldGroup label={dict.pricePerKgLabel}>
                      <Input name="pricePerKgUsd" type="number" step="0.001" min="0" defaultValue={container.pricePerKgUsd ?? ""} />
                    </FieldGroup>
                    <FieldGroup label={dict.pricePerCartonLabel}>
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
                    {dict.save}
                  </Button>
                </form>
                <dl className="mt-3 space-y-1 text-sm">
                  <Row
                    label={dict.byWeightLabel.replace("{kg}", (totalLoadedThisContainer * 1000).toFixed(0))}
                    value={valueByWeightUsd != null ? `$${valueByWeightUsd.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : undefined}
                  />
                  <Row
                    label={dict.byCartonsLabel.replace("{ctn}", totalCartonsThisContainer.toFixed(0))}
                    value={valueByCartonUsd != null ? `$${valueByCartonUsd.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : undefined}
                  />
                  <Row label={dict.paymentTermsLabel} value={container.order.client.paymentTerms} />
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
              <h2 className="text-sm font-semibold text-slate-900">{dict.additionalCostsTitle}</h2>
              <p className="mt-1 text-xs text-slate-500">{dict.additionalCostsSubtitle}</p>
            </div>
            {container.costs.length > 0 && (
              <Badge color="amber">
                {dict.totalSuffix.replace("{amount}", `$${totalExtraCostsUsd.toLocaleString(undefined, { maximumFractionDigits: 0 })}`)}
              </Badge>
            )}
          </div>

          {container.costs.length > 0 && (
            <ul className="mt-3 divide-y divide-slate-100 text-sm">
              {container.costs.map((c) => (
                <li key={c.id} className="flex items-center justify-between py-2">
                  <div>
                    <Badge color="slate">{COST_CATEGORY_LABEL[c.category]}</Badge>
                    <span className="ms-2 text-slate-700">${c.amountUsd.toLocaleString()}</span>
                    {c.description && <span className="ms-2 text-slate-500">{c.description}</span>}
                    <span className="ms-2 text-xs text-slate-400">{c.incurredAt.toDateString()}</span>
                  </div>
                  <form action={removeContainerCostAction.bind(null, container.id, c.id)}>
                    <ConfirmSubmitButton
                      confirmMessage={dict.removeCostConfirm
                        .replace("{amount}", `$${c.amountUsd.toLocaleString()}`)
                        .replace("{category}", COST_CATEGORY_LABEL[c.category])}
                    >
                      {dict.remove}
                    </ConfirmSubmitButton>
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
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-900">{dict.exportDocumentsTitle}</h2>
              {!container.bolsaPermitNumber && (
                <Badge color="red">{dict.bolsaPermitMissing}</Badge>
              )}
            </div>
            <p className="mt-1 text-xs text-slate-500">{dict.exportDocumentsSubtitle}</p>
            <form action={updateExportDocumentsAction.bind(null, container.id)} className="mt-3 space-y-3">
              <FieldGroup label={dict.nafezaRefLabel}>
                <Input name="nafezaInspectionRequestRef" defaultValue={container.nafezaInspectionRequestRef ?? ""} />
              </FieldGroup>
              <FieldGroup label={dict.bolsaPermitNumberLabel}>
                <Input
                  name="bolsaPermitNumber"
                  defaultValue={container.bolsaPermitNumber ?? ""}
                  className="border-amber-400 focus:border-amber-500 focus:ring-amber-500"
                />
              </FieldGroup>
              <FieldGroup label={dict.nfsaHealthCertLabel}>
                <Input name="nfsaHealthCertNumber" defaultValue={container.nfsaHealthCertNumber ?? ""} />
              </FieldGroup>
              <FieldGroup label={dict.fumigationCertLabel}>
                <Input name="fumigationCertNumber" defaultValue={container.fumigationCertNumber ?? ""} />
              </FieldGroup>
              <FieldGroup label={dict.phytosanitaryCertLabel}>
                <Input name="phytosanitaryCertNumber" defaultValue={container.phytosanitaryCertNumber ?? ""} />
              </FieldGroup>
              <FieldGroup label={dict.certificateOfOriginLabel}>
                <Input name="certificateOfOriginNumber" defaultValue={container.certificateOfOriginNumber ?? ""} />
              </FieldGroup>
              <FieldGroup label={dict.customsDeclarationLabel}>
                <Input
                  name="customsExportDeclarationNumber"
                  defaultValue={container.customsExportDeclarationNumber ?? ""}
                />
              </FieldGroup>
              <Button type="submit" variant="secondary">
                {dict.save}
              </Button>
            </form>
          </Card>

          <Card>
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">{dict.reeferTemperatureTitle}</h2>
                <p className="mt-1 text-xs text-slate-500">{dict.reeferTemperatureSubtitle}</p>
              </div>
              {container.reeferSetPointC != null && (
                <Badge color="blue">{dict.setPointBadge.replace("{value}", String(container.reeferSetPointC))}</Badge>
              )}
            </div>

            <form action={updateReeferSetPointAction.bind(null, container.id)} className="mt-3 flex items-end gap-3">
              <FieldGroup label={dict.setPointLabel}>
                <Input
                  name="reeferSetPointC"
                  type="number"
                  step="0.1"
                  defaultValue={container.reeferSetPointC ?? ""}
                  placeholder={dict.setPointPlaceholder}
                  className="w-28"
                />
              </FieldGroup>
              <Button type="submit" variant="secondary">
                {dict.save}
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
                        {t.notes && <span className="ms-2 text-slate-500">{t.notes}</span>}
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
            <h2 className="text-base font-semibold text-emerald-900">{dict.containerLoadOutRecordTitle}</h2>
            <p className="mt-1 max-w-2xl text-sm text-emerald-800">
              {dict.containerLoadOutRecordBody.split("{container}").map((part, i, arr) => (
                <span key={i}>
                  {part}
                  {i < arr.length - 1 && <span className="font-medium">{container.containerNumber}</span>}
                </span>
              ))}
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            {container.loadType && (
              <Badge color={container.loadType === "PALLETISED" ? "blue" : "amber"}>
                {container.loadType === "PALLETISED" ? dict.palletisedBadge : dict.unpalletisedLooseBadge}
              </Badge>
            )}
            <Badge color={capacity && totalLoadedThisContainer >= capacity - 0.5 ? "green" : "slate"}>
              {dict.loadedBadge
                .replace("{loaded}", totalLoadedThisContainer.toFixed(2))
                .replace("{capacitySuffix}", capacity ? ` / ${capacity}t` : "")}
            </Badge>
            {distinctLotIds.size > 0 && (
              <Badge color={distinctLotIds.size > 1 ? "amber" : "slate"}>
                {dict.lotsUsedBadge.replace("{count}", String(distinctLotIds.size)).replace("{plural}", distinctLotIds.size === 1 ? "" : "s")}
              </Badge>
            )}
          </div>
        </div>

        <form
          action={updateLoadingDetailsAction.bind(null, container.id)}
          className="mt-4 flex flex-wrap items-end gap-3 border-t border-emerald-200 pt-4"
        >
          <FieldGroup label={dict.loadTypeLabel}>
            <Select name="loadType" defaultValue={container.loadType ?? ""}>
              <option value="" disabled>
                {dict.selectEllipsis}
              </option>
              <option value="PALLETISED">{dict.palletisedShort}</option>
              <option value="UNPALLETISED">{dict.unpalletisedShort}</option>
            </Select>
          </FieldGroup>
          <FieldGroup label={dict.loadingDateLabel}>
            <Input
              name="loadingDate"
              type="date"
              defaultValue={container.loadingDate ? container.loadingDate.toISOString().slice(0, 10) : ""}
            />
          </FieldGroup>
          <FieldGroup label={dict.loadingLocationLabel}>
            <Input name="loadingLocation" defaultValue={container.loadingLocation ?? ""} className="w-56" />
          </FieldGroup>
          <FieldGroup label={dict.supervisorLabel}>
            <Input name="loadingSupervisor" defaultValue={container.loadingSupervisor ?? ""} className="w-48" />
          </FieldGroup>
          <Button type="submit" variant="secondary">
            {dict.save}
          </Button>
        </form>
      </Card>

      <Card>
        <h2 className="text-sm font-semibold text-slate-900">
          {dict.allocatedPalletsAwaitingLoadTitle.replace("{count}", String(pendingPallets.length))}
        </h2>
        <p className="text-xs text-slate-500">{dict.allocatedPalletsAwaitingLoadSubtitle}</p>
        <div className="mt-3 divide-y divide-slate-100">
          {pendingPallets.map((p) => (
            <div key={p.id} className="flex items-center justify-between py-2 text-sm">
              <div className="flex items-center gap-3">
                <a
                  href={`/storage/${p.id}`}
                  className={cn("font-medium text-emerald-700 hover:underline", p.isTestData && TEST_DATA_TEXT_CLASS)}
                >
                  {p.palletNumber}
                </a>
                <span className="text-slate-500">
                  {dict.remainingLotSuffix.replace("{remaining}", p.remaining.toFixed(2)).replace("{lot}", p.lot.lotNumber)}
                </span>
                {(p.isTestData || p.lot.isTestData) && <TestDataBadge />}
              </div>
              <div>
                {!p.stickeringRequired ? (
                  <form action={toggleStickeringRequiredAction.bind(null, container.id, p.id)}>
                    <button type="submit" className="text-xs text-slate-400 hover:text-slate-600 hover:underline">
                      {dict.notNeededFlag}
                    </button>
                  </form>
                ) : p.stickeringCompletedAt ? (
                  <Badge color="green">{dict.stickered}</Badge>
                ) : (
                  <div className="flex items-center gap-2">
                    <Badge color="amber">{dict.stickeringPending}</Badge>
                    <form action={markStickeringCompleteAction.bind(null, container.id, p.id)}>
                      <ConfirmSubmitButton
                        confirmMessage={dict.markStickeredConfirm.replace("{pallet}", p.palletNumber)}
                        className="inline-flex items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-3.5 py-2 text-xs font-medium text-slate-900 transition-colors hover:bg-slate-50"
                      >
                        {dict.markStickered}
                      </ConfirmSubmitButton>
                    </form>
                  </div>
                )}
              </div>
            </div>
          ))}
          {pendingPallets.length === 0 && (
            <p className="py-2 text-sm text-slate-400">{dict.allPalletsFullyLoaded}</p>
          )}
        </div>

        <div className="mt-4 border-t border-slate-100 pt-4">
          <p className="mb-2 text-xs font-medium text-slate-500">{dict.addToManifestLabel}</p>
          {manifestLocked ? (
            <p className="text-sm text-slate-400">{dict.manifestLockedHint}</p>
          ) : (
            <AddLoadLineForm containerId={container.id} pallets={eligibleToAdd} canSignOffSpecException={canSignOffSpecException} />
          )}
        </div>
      </Card>

      <Card className="overflow-x-auto p-0">
        <div className="px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-900">
            {dict.loadOutManifestTitle
              .replace("{container}", container.containerNumber)
              .replace("{count}", String(container.palletLines.length))
              .replace("{plural}", container.palletLines.length === 1 ? "" : "s")}
          </h2>
          <p className="text-xs text-slate-500">{dict.loadOutManifestSubtitle}</p>
        </div>
        <table className="w-full text-start text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-slate-500">
            <tr>
              <th className="px-4 py-2 font-medium">{dict.colPalletNumber}</th>
              <th className="px-4 py-2 font-medium">{dict.colCartonLogo}</th>
              <th className="px-4 py-2 font-medium">{dict.colVariety}</th>
              <th className="px-4 py-2 font-medium">{dict.colTraceabilityLot}</th>
              <th className="px-4 py-2 font-medium">{dict.colClientGrade}</th>
              <th className="px-4 py-2 font-medium">{dict.colQuantityLoaded}</th>
              <th className="px-4 py-2 font-medium">{dict.colLoadingTime}</th>
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
                    <a
                      href={`/storage/${line.pallet.id}`}
                      className={cn(
                        "text-emerald-700 hover:underline",
                        (line.pallet.isTestData || line.pallet.lot.isTestData) && TEST_DATA_TEXT_CLASS
                      )}
                    >
                      {line.pallet.palletNumber}
                    </a>
                    {(line.pallet.isTestData || line.pallet.lot.isTestData) && (
                      <>
                        {" "}
                        <TestDataBadge />
                      </>
                    )}
                  </td>
                  <td className="px-4 py-2">{line.pallet.cartonLogo ?? "—"}</td>
                  <td className="px-4 py-2">{line.pallet.variety ?? "—"}</td>
                  <td className="px-4 py-2">{line.pallet.lot.lotNumber}</td>
                  <td className="px-4 py-2">
                    {container.order.client.name} / {dict.gradeLabel.replace("{grade}", line.pallet.lot.grade)}
                  </td>
                  <td className="px-4 py-2">{line.quantityTonnes.toFixed(2)}t</td>
                  <td className="px-4 py-2">
                    {durationMin !== null ? (
                      <Badge color={durationMin <= 15 ? "green" : "amber"}>{dict.minSuffix.replace("{min}", String(durationMin))}</Badge>
                    ) : (
                      <div className="flex items-center gap-2">
                        <Badge color="slate">{dict.inProgress}</Badge>
                        <form action={completeLoadLineAction.bind(null, container.id, line.id)}>
                          <Button type="submit" variant="secondary" className="text-xs">
                            {dict.markComplete}
                          </Button>
                        </form>
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-2">
                    {manifestLocked ? (
                      <span className="text-xs text-slate-300">{dict.locked}</span>
                    ) : (
                      <form action={removePalletLoadLineAction.bind(null, container.id, line.id)}>
                        <ConfirmSubmitButton
                          confirmMessage={dict.removeLoadLineConfirm.replace("{pallet}", line.pallet.palletNumber)}
                        >
                          {dict.remove}
                        </ConfirmSubmitButton>
                      </form>
                    )}
                  </td>
                </tr>
              );
            })}
            {container.palletLines.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-6 text-center text-slate-400">
                  {dict.nothingLoadedYet}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>

      <Card>
        <h2 className="text-sm font-semibold text-slate-900">{dict.preDepartureChecklistTitle}</h2>
        <p className="text-xs text-slate-500">{dict.preDepartureChecklistSubtitle}</p>
        <ul className="mt-3 space-y-2 text-sm">
          {checklist.map((item) => (
            <li key={item.key} className="flex items-center gap-2">
              <span className={item.done ? "text-emerald-600" : "text-slate-300"}>{item.done ? "✓" : "○"}</span>
              <span className={item.done ? "text-slate-700" : "text-slate-500"}>{item.label}</span>
            </li>
          ))}
        </ul>

        {CONTAINER_CHECKLIST_ITEMS.map((item) => {
          const itemText = CHECKLIST_ITEM_DICT[item.key];
          const confirmation = container.checklistConfirmations.find((c) => c.itemKey === item.key);
          const isDone = checklist.find((c) => c.key === item.key)?.done ?? false;
          return (
            <div key={item.key} className="mt-4 border-t border-slate-100 pt-4">
              <p className="mb-1 text-xs font-medium text-slate-500">{itemText.label}</p>
              {isDone && confirmation ? (
                <p className="text-sm text-slate-800">
                  {dict.confirmedBy.replace("{name}", confirmation.confirmedByName)}
                  <span className="ms-2 text-xs text-slate-500">
                    {formatDate(confirmation.confirmedAt, "dd MMM yyyy HH:mm", locale)}
                  </span>
                </p>
              ) : container.palletLines.length === 0 ? (
                <p className="text-xs text-slate-400">{dict.addPalletFirstHint}</p>
              ) : (
                <ChecklistItemConfirmForm
                  action={confirmChecklistItemAction.bind(null, container.id, item.key)}
                  confirmMessage={itemText.confirmMessage}
                  buttonLabel={itemText.buttonLabel}
                />
              )}
            </div>
          );
        })}

        <div className="mt-4 border-t border-slate-100 pt-4">
          <p className="mb-1 text-xs font-medium text-slate-500">
            {dict.photoOfLoadedContainerLabel.replace("{count}", String(container.loadPhotos.length))}
          </p>
          <div className="mt-2 grid grid-cols-4 gap-3">
            {container.loadPhotos.map((photo) => {
              const isImage = /\.(jpe?g|png)$/i.test(photo.fileName);
              const isStale =
                !!container.manifestReopenedAt && photo.createdAt < container.manifestReopenedAt;
              return (
                <div key={photo.id} className="rounded-md border border-slate-200 p-2">
                  <a
                    href={`/api/files/container-load-photos/${photo.fileName}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block"
                  >
                    {isImage ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={`/api/files/container-load-photos/${photo.fileName}`}
                        alt={photo.originalName}
                        className="h-24 w-full rounded object-cover"
                      />
                    ) : (
                      <div className="flex h-24 w-full items-center justify-center rounded bg-slate-50 text-xs text-emerald-700 hover:underline">
                        {dict.viewFile}
                      </div>
                    )}
                  </a>
                  {isStale && (
                    <p className="mt-1 text-[10px] font-medium text-amber-600">{dict.photoStaleNote}</p>
                  )}
                  <p className="mt-1 text-[10px] text-slate-400">
                    {photo.uploadedBy?.name ?? dict.unknownUploader} · {photo.createdAt.toLocaleString()}
                  </p>
                  {!manifestLocked && (
                    <form action={removeContainerLoadPhotoAction.bind(null, container.id, photo.id)} className="mt-1">
                      <ConfirmSubmitButton confirmMessage={dict.removePhotoConfirm} className="text-[10px] text-red-600 hover:underline">
                        {dict.remove}
                      </ConfirmSubmitButton>
                    </form>
                  )}
                </div>
              );
            })}
            {container.loadPhotos.length === 0 && (
              <p className="col-span-4 text-xs text-slate-400">{dict.noPhotoUploadedYet}</p>
            )}
          </div>
          {!manifestLocked && (
            <form
              action={addContainerLoadPhotoAction.bind(null, container.id)}
              className="mt-3 flex flex-wrap items-end gap-3"
            >
              <FieldGroup label={dict.photoFieldLabel}>
                <input
                  name="file"
                  type="file"
                  accept="image/jpeg,image/png"
                  required
                  className="block w-64 text-sm text-slate-700 file:mr-3 file:rounded-md file:border file:border-slate-300 file:bg-white file:px-3 file:py-1.5 file:text-sm file:font-medium hover:file:bg-slate-50"
                />
              </FieldGroup>
              <Button type="submit" variant="secondary">
                {dict.upload}
              </Button>
            </form>
          )}
        </div>
      </Card>

      <Card>
        <h2 className="text-sm font-semibold text-slate-900">{dict.signOffTitle}</h2>
        <p className="text-xs text-slate-500">{dict.signOffSubtitle}</p>
        <div className="mt-3 grid grid-cols-2 gap-4">
          <div>
            <p className="mb-1 text-xs font-medium text-slate-500">{dict.loadOutTeamLabel}</p>
            {container.loadOutRepName ? (
              <p className="text-sm text-slate-800">
                {container.loadOutRepName}
                <span className="ms-2 text-xs text-slate-500">
                  {container.loadOutSignedAt?.toLocaleString()}
                </span>
              </p>
            ) : container.palletLines.length === 0 ? (
              <p className="text-xs text-slate-400">{dict.addPalletBeforeSignOff}</p>
            ) : !checklistComplete ? (
              <p className="text-xs text-slate-400">{dict.completeChecklistBeforeSignOff}</p>
            ) : (
              <SignOffForm
                action={signLoadOutRepAction.bind(null, container.id)}
                confirmMessage={dict.signOffAsLoadOutConfirm.replace("{name}", currentUserLabel ?? dict.yourself)}
                pendingPalletCount={pendingPallets.length}
              />
            )}
          </div>
          <div>
            <p className="mb-1 text-xs font-medium text-slate-500">{dict.qualityDepartmentLabel}</p>
            {container.qualityRepName ? (
              <p className="text-sm text-slate-800">
                {container.qualityRepName}
                <span className="ms-2 text-xs text-slate-500">
                  {container.qualitySignedAt?.toLocaleString()}
                </span>
              </p>
            ) : container.palletLines.length === 0 ? (
              <p className="text-xs text-slate-400">{dict.addPalletBeforeSignOff}</p>
            ) : !checklistComplete ? (
              <p className="text-xs text-slate-400">{dict.completeChecklistBeforeSignOff}</p>
            ) : (
              <SignOffForm
                action={signQualityRepAction.bind(null, container.id)}
                confirmMessage={dict.signOffAsQualityConfirm.replace("{name}", currentUserLabel ?? dict.yourself)}
                pendingPalletCount={pendingPallets.length}
              />
            )}
          </div>
        </div>

        {manifestLocked && (
          <div className="mt-4 border-t border-slate-100 pt-4">
            <p className="mb-2 text-xs font-medium text-amber-700">{dict.manifestLockedNote}</p>
            <ReopenManifestForm containerId={container.id} />
          </div>
        )}
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
