import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { canSeePricing } from "@/lib/roles";
import { isCreditedClaim } from "@/lib/claims";
import { notFound } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button, LinkButton } from "@/components/ui/button";
import { ConfirmSubmitButton } from "@/components/ui/confirm-submit-button";
import { formatDate } from "@/lib/dates";
import { allocatePalletsAction, updateOrderQuantityAction, updateOrderValueAction } from "../actions";
import { AdvanceStageButton } from "./advance-stage-button";
import { Input, FieldGroup } from "@/components/ui/field";
import { FULL_PALLET_WEIGHT_TONNES } from "@/lib/logistics";
import { TestDataBadge, TEST_DATA_TEXT_CLASS } from "@/components/test-data-badge";
import { cn } from "@/lib/cn";
import { resolveLocale } from "@/lib/i18n/resolveLocale";
import { getDictionary } from "@/lib/i18n/getDictionary";
import type { Dictionary } from "@/lib/i18n/dictionaries/en";

const STAGE_ORDER = ["CONFIRMED", "IN_PRODUCTION", "PACKED", "SHIPPED", "DELIVERED", "PAID"] as const;

function stageLabel(dict: Dictionary["orders"], stage: (typeof STAGE_ORDER)[number]) {
  return {
    CONFIRMED: dict.stageConfirmed,
    IN_PRODUCTION: dict.stageInProduction,
    PACKED: dict.stagePacked,
    SHIPPED: dict.stageShipped,
    DELIVERED: dict.stageDelivered,
    PAID: dict.stagePaid,
  }[stage];
}

function formatLabel(dict: Dictionary["orders"], format: "WHOLE" | "SLICED" | "DICED") {
  return { WHOLE: dict.formatWhole, SLICED: dict.formatSliced, DICED: dict.formatDiced }[format];
}

function palletStatusLabel(dict: Dictionary["orders"], status: "IN_STORAGE" | "ALLOCATED" | "SHIPPED" | "WASTE" | "DISCOUNT_OFFERED") {
  return {
    IN_STORAGE: dict.palletStatusInStorage,
    ALLOCATED: dict.palletStatusAllocated,
    SHIPPED: dict.palletStatusShipped,
    WASTE: dict.palletStatusWaste,
    DISCOUNT_OFFERED: dict.palletStatusDiscountOffered,
  }[status];
}

function claimReasonLabel(dict: Dictionary["orders"], reason: "QUALITY" | "PACKAGING" | "FOREIGN_MATERIAL" | "TRANSPORT") {
  return {
    QUALITY: dict.claimReasonQuality,
    PACKAGING: dict.claimReasonPackaging,
    FOREIGN_MATERIAL: dict.claimReasonForeignMaterial,
    TRANSPORT: dict.claimReasonTransport,
  }[reason];
}

function claimStatusLabel(dict: Dictionary["orders"], status: "OPEN" | "UNDER_REVIEW" | "RESOLVED_CREDITED" | "CLOSED") {
  return {
    OPEN: dict.claimStatusOpen,
    UNDER_REVIEW: dict.claimStatusUnderReview,
    RESOLVED_CREDITED: dict.claimStatusResolvedCredited,
    CLOSED: dict.claimStatusClosed,
  }[status];
}

export default async function OrderDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ allocError?: string }>;
}) {
  const { id } = await params;
  const { allocError } = await searchParams;
  const session = await auth();
  const showPricing = canSeePricing(session?.user.role);
  const locale = await resolveLocale();
  const dict = getDictionary(locale).orders;

  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      client: true,
      containers: true,
      pallets: { include: { lot: true, coldRoom: true, loadLines: true } },
    },
  });
  if (!order) notFound();

  const containerIds = order.containers.map((c) => c.id);
  const relatedClaims =
    containerIds.length > 0
      ? await prisma.claim.findMany({
          where: { containers: { some: { containerId: { in: containerIds } } } },
          include: {
            containers: { where: { containerId: { in: containerIds } } },
            _count: { select: { containers: true } },
          },
        })
      : [];

  // A claim can list several containers, each with its own claimAmount --
  // summing only containers[0] (as this used to) silently dropped every
  // other container's credit for a claim spanning more than one. Falling
  // back to the claim's full valueUsd is only safe when every container the
  // claim lists belongs to this order; otherwise that value may belong partly
  // to another order too, and using it here would double-count it there.
  const netValue =
    order.valueUsd -
    relatedClaims
      .filter((c) => isCreditedClaim(c.status))
      .reduce((sum, c) => {
        const matchedTotal = c.containers.reduce((s, line) => s + (line.claimAmount ?? 0), 0);
        const everyMatchedLineHasAmount = c.containers.length > 0 && c.containers.every((line) => line.claimAmount != null);
        const claimIsFullyWithinThisOrder = c.containers.length === c._count.containers;
        const share = everyMatchedLineHasAmount
          ? matchedTotal
          : claimIsFullyWithinThisOrder
            ? c.valueUsd
            : matchedTotal;
        return sum + share;
      }, 0);

  const nextStage = STAGE_ORDER[STAGE_ORDER.indexOf(order.stage) + 1];

  const allocErrorMessage =
    allocError === "NO_STOCK"
      ? dict.allocateNoneNoStock
      : allocError === "LAB_PENDING"
        ? dict.allocateNoneLabPending
        : allocError === "SPEC_FAIL"
          ? dict.allocateNoneSpecFail.replace("{clientName}", order.client.name)
          : null;

  return (
    <div className="space-y-6">
      {allocErrorMessage && (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          {allocErrorMessage}
        </p>
      )}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold text-slate-900">{order.orderNumber}</h1>
            <Badge color="slate">{stageLabel(dict, order.stage)}</Badge>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            {order.client.name} · {dict.gradeLabel.replace("{grade}", order.grade)} · {formatLabel(dict, order.format)}
          </p>
        </div>
        <div className="flex gap-2">
          {order.pallets.length < order.quantityPallets && (
            <form action={allocatePalletsAction.bind(null, order.id)}>
              <ConfirmSubmitButton
                confirmMessage={dict.allocateConfirm
                  .replace("{count}", String(order.quantityPallets - order.pallets.length))
                  .replace("{tonnes}", ((order.quantityPallets - order.pallets.length) * FULL_PALLET_WEIGHT_TONNES).toFixed(1))
                  .replace("{orderNumber}", order.orderNumber)}
                className="inline-flex items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-900 transition-colors hover:bg-slate-50"
              >
                {dict.allocatePallets}
              </ConfirmSubmitButton>
            </form>
          )}
          {nextStage && <AdvanceStageButton orderId={order.id} label={stageLabel(dict, nextStage)} />}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Card>
          <h2 className="text-sm font-semibold text-slate-900">{dict.orderDetailsTitle}</h2>
          <dl className="mt-3 space-y-2 text-sm">
            <Row label={dict.poNumberLabel} value={order.poNumber} />
            <Row label={dict.orderDateLabel} value={formatDate(order.orderDate, "dd MMM yyyy", locale)} />
            <Row label={dict.quantityLabel} value={`${order.quantityPallets} ${dict.palletsSuffix}`} />
            <Row label={dict.allocatedLabel} value={`${order.pallets.length} / ${order.quantityPallets}`} />
            {showPricing && <Row label={dict.grossValueLabel} value={`$${order.valueUsd.toLocaleString()}`} />}
            {showPricing && <Row label={dict.netValueLabel} value={`$${netValue.toLocaleString()}`} />}
          </dl>
          {order.pallets.length === 0 && (
            <form
              action={updateOrderQuantityAction.bind(null, order.id)}
              className="mt-3 flex items-end gap-2 border-t border-slate-100 pt-3"
            >
              <FieldGroup label={dict.correctQuantityLabel}>
                <Input
                  name="quantityTonnes"
                  type="number"
                  step="0.1"
                  min="0.1"
                  defaultValue={order.quantityPallets * FULL_PALLET_WEIGHT_TONNES}
                  className="w-40"
                />
              </FieldGroup>
              <Button type="submit" variant="secondary">
                {dict.save}
              </Button>
            </form>
          )}
          {showPricing && (
            <form action={updateOrderValueAction.bind(null, order.id)} className="mt-3 flex items-end gap-2 border-t border-slate-100 pt-3">
              <FieldGroup label={order.valueUsd > 0 ? dict.updateValueLabel : dict.setValueLabel}>
                <Input name="valueUsd" type="number" step="0.01" min="0" defaultValue={order.valueUsd || ""} className="w-40" />
              </FieldGroup>
              <Button type="submit" variant="secondary">
                {dict.save}
              </Button>
            </form>
          )}
        </Card>

        <Card>
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900">
              {dict.containersTitle.replace("{count}", String(order.containers.length))}
            </h2>
            <LinkButton href={`/logistics/new?orderId=${order.id}`} variant="secondary" className="text-xs">
              {dict.addContainer}
            </LinkButton>
          </div>
          {order.containers.length > 0 ? (
            <ul className="mt-3 space-y-2 text-sm">
              {order.containers.map((c) => (
                <li key={c.id}>
                  <a href={`/logistics/${c.id}`} className="flex justify-between rounded-md border border-slate-200 p-2 hover:bg-slate-50">
                    <span className="font-medium text-emerald-700">{c.containerNumber}</span>
                    <span className="text-slate-500">{c.currentLocation ?? dict.locationNotSet}</span>
                  </a>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-slate-400">{dict.noContainersYet}</p>
          )}
        </Card>
      </div>

      <Card className="overflow-x-auto p-0">
        <div className="flex items-center justify-between px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-900">{dict.allocatedPalletsTitle}</h2>
          <LinkButton
            // Only prefill a container when there's exactly one on this order --
            // defaulting to containers[0] on a multi-container order would
            // silently attach the claim to the wrong shipment.
            href={`/claims/new?clientId=${order.clientId}${order.containers.length === 1 ? `&containerNumber=${order.containers[0].containerNumber}` : ""}`}
            variant="secondary"
          >
            {dict.fileClaim}
          </LinkButton>
        </div>
        <table className="w-full text-start text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-slate-500">
            <tr>
              <th className="px-4 py-2 font-medium">{dict.colPalletNumber}</th>
              <th className="px-4 py-2 font-medium">{dict.colLot}</th>
              <th className="px-4 py-2 font-medium">{dict.colColdRoom}</th>
              <th className="px-4 py-2 font-medium">{dict.colLoaded}</th>
              <th className="px-4 py-2 font-medium">{dict.colStatus}</th>
            </tr>
          </thead>
          <tbody>
            {order.pallets.map((p) => {
              const loaded = p.loadLines.reduce((s, l) => s + l.quantityTonnes, 0);
              return (
                <tr key={p.id} className="border-b border-slate-100 last:border-0">
                  <td className="px-4 py-2">
                    <a
                      href={`/storage/${p.id}`}
                      className={cn("text-emerald-700 hover:underline", p.isTestData && TEST_DATA_TEXT_CLASS)}
                    >
                      {p.palletNumber}
                    </a>
                    {(p.isTestData || p.lot.isTestData) && (
                      <>
                        {" "}
                        <TestDataBadge />
                      </>
                    )}
                  </td>
                  <td className={cn("px-4 py-2", p.lot.isTestData && TEST_DATA_TEXT_CLASS)}>{p.lot.lotNumber}</td>
                  <td className="px-4 py-2">{p.coldRoom?.name ?? "—"}</td>
                  <td className="px-4 py-2">
                    {loaded.toFixed(2)}t / {p.weightTonnes}t
                  </td>
                  <td className="px-4 py-2">
                    <Badge color="blue">{palletStatusLabel(dict, p.status)}</Badge>
                  </td>
                </tr>
              );
            })}
            {order.pallets.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-slate-400">
                  {dict.noPalletsAllocated}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>

      {relatedClaims.length > 0 && (
        <Card>
          <h2 className="text-sm font-semibold text-slate-900">{dict.claimsOnContainersTitle}</h2>
          <ul className="mt-2 space-y-2">
            {relatedClaims.map((c) => (
              <li key={c.id}>
                <a
                  href={`/claims/${c.id}`}
                  className="flex justify-between rounded-md border border-slate-200 p-2 text-sm hover:bg-slate-50"
                >
                  <span>
                    <Badge color={c.severity === "RED" ? "red" : "amber"}>
                      {c.severity === "RED" ? dict.claimSeverityRed : dict.claimSeverityAmber}
                    </Badge>{" "}
                    {claimReasonLabel(dict, c.reason)}
                  </span>
                  <span className="text-slate-500">
                    {showPricing ? `$${c.valueUsd.toLocaleString()} · ` : ""}
                    {claimStatusLabel(dict, c.status)}
                  </span>
                </a>
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
      <dd className="text-end text-slate-800">{value || "—"}</dd>
    </div>
  );
}
