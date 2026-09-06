import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button, LinkButton } from "@/components/ui/button";
import { formatDate } from "@/lib/dates";
import { updateOrderQuantityAction } from "../actions";
import { MarkDeliveredForm } from "./mark-delivered-form";
import { MarkPaidForm } from "./mark-paid-form";
import { CancelOrderForm } from "./cancel-order-form";
import { LifecycleTracker } from "./lifecycle-tracker";
import { getOrderLifecycleStatus, normalizedStageIndex, ORDER_STAGE_SEQUENCE } from "@/lib/orderLifecycle";
import { Input, FieldGroup } from "@/components/ui/field";
import { FULL_PALLET_WEIGHT_TONNES } from "@/lib/logistics";
import { TestDataBadge, TEST_DATA_TEXT_CLASS } from "@/components/test-data-badge";
import { cn } from "@/lib/cn";
import { resolveLocale } from "@/lib/i18n/resolveLocale";
import { getDictionary } from "@/lib/i18n/getDictionary";
import type { Dictionary } from "@/lib/i18n/dictionaries/en";

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

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const locale = await resolveLocale();
  const fullDict = getDictionary(locale);
  const dict = fullDict.orders;

  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      client: { include: { specs: true } },
      containers: true,
      pallets: {
        include: {
          lot: { include: { microbiologyResults: true, mrlResult: true, shift: true } },
          coldRoom: true,
          loadLines: true,
          slot: true,
        },
      },
    },
  });
  if (!order) notFound();

  const containerIds = order.containers.map((c) => c.id);
  const relatedClaims =
    containerIds.length > 0
      ? await prisma.claim.findMany({
          where: { containers: { some: { containerId: { in: containerIds } } } },
        })
      : [];

  const isCancelled = !!order.cancelledAt;
  const stageIdx = normalizedStageIndex(order.stage);
  // Cancelling only makes sense before anything has actually shipped -- once
  // it has, there's nothing left to "cancel" (a real return/claim is the
  // right tool instead), enforced again server-side in cancelOrderAction.
  const canCancel = !isCancelled && stageIdx < ORDER_STAGE_SEQUENCE.indexOf("SHIPPED");
  const lifecycleSteps = isCancelled ? null : await getOrderLifecycleStatus(order);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">{order.orderNumber}</h1>
          <p className="mt-1 text-sm text-slate-500">
            {order.client.name} · {dict.gradeLabel.replace("{grade}", order.grade)} · {formatLabel(dict, order.format)}
          </p>
        </div>
        {canCancel && <CancelOrderForm orderId={order.id} />}
      </div>

      {isCancelled ? (
        <Card className="border-red-200 bg-red-50">
          <div className="flex items-center gap-2">
            <Badge color="red">{dict.cancelledBadge}</Badge>
          </div>
          <p className="mt-2 text-sm text-red-800">
            {dict.cancelledDetail
              .replace("{date}", formatDate(order.cancelledAt!, "dd MMM yyyy", locale))
              .replace("{name}", order.cancelledByName ?? "—")
              .replace("{reason}", order.cancellationReason ?? "—")}
          </p>
        </Card>
      ) : (
        <Card>
          <LifecycleTracker
            steps={lifecycleSteps!}
            labels={{
              CONFIRMED: dict.stageConfirmed,
              ALLOCATED: dict.stepAllocated,
              LAB_CLEARED: dict.stepLabCleared,
              LOADED: dict.stepLoaded,
              SHIPPED: dict.stageShipped,
              DELIVERED: dict.stageDelivered,
              PAID: dict.stagePaid,
            }}
            manualStepTitle={dict.manualStepTitle}
            actions={{
              ALLOCATED: order.pallets.length < order.quantityPallets && (
                <LinkButton
                  href={`/orders/${order.id}/allocate`}
                  variant="secondary"
                  className="px-3 py-1.5 text-sm"
                >
                  {dict.allocatePallets}
                </LinkButton>
              ),
              DELIVERED: <MarkDeliveredForm orderId={order.id} />,
              PAID: <MarkPaidForm orderId={order.id} />,
            }}
          />
        </Card>
      )}

      <div className="grid grid-cols-2 gap-4">
        <Card>
          <h2 className="text-sm font-semibold text-slate-900">{dict.orderDetailsTitle}</h2>
          <dl className="mt-3 space-y-2 text-sm">
            <Row label={dict.poNumberLabel} value={order.poNumber} />
            <Row label={dict.orderDateLabel} value={formatDate(order.orderDate, "dd MMM yyyy", locale)} />
            <Row label={dict.quantityLabel} value={`${order.quantityPallets} ${dict.palletsSuffix}`} />
            <Row label={dict.allocatedLabel} value={`${order.pallets.length} / ${order.quantityPallets}`} />
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
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-900">{dict.allocatedPalletsTitle}</h2>
          <div className="flex flex-wrap gap-2">
            {(() => {
              // One "View on Storage Map" link per cold room this order's
              // still-in-storage pallets are actually shelved in -- a
              // shipped pallet is gone, so there's nothing to highlight for
              // it. Groups by room since a highlight query param only
              // targets one room's map at a time.
              const byRoom = new Map<string, { name: string; palletIds: string[] }>();
              for (const p of order.pallets) {
                if (p.status === "SHIPPED" || !p.coldRoomId || !p.slot) continue;
                const entry = byRoom.get(p.coldRoomId) ?? { name: p.coldRoom!.name, palletIds: [] };
                entry.palletIds.push(p.id);
                byRoom.set(p.coldRoomId, entry);
              }
              return [...byRoom.entries()].map(([roomId, { name, palletIds }]) => (
                <LinkButton
                  key={roomId}
                  href={`/storage/map/${roomId}?highlight=${palletIds.join(",")}`}
                  variant="secondary"
                >
                  {dict.viewOnStorageMap.replace("{room}", name)}
                </LinkButton>
              ));
            })()}
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
        </div>
        <table className="w-full text-start text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-slate-500">
            <tr>
              <th className="px-4 py-2 font-medium">{dict.colPalletNumber}</th>
              <th className="px-4 py-2 font-medium">{dict.colLot}</th>
              <th className="px-4 py-2 font-medium">{dict.colColdRoom}</th>
              <th className="px-4 py-2 font-medium">{dict.colLocation}</th>
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
                    {p.slot
                      ? fullDict.storage.rackLevelRound
                          .replace("{rack}", p.slot.rack)
                          .replace("{level}", String(p.slot.level))
                          .replace("{round}", String(p.slot.round))
                      : "—"}
                  </td>
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
                <td colSpan={6} className="px-4 py-6 text-center text-slate-400">
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
                  <span className="text-slate-500">{claimStatusLabel(dict, c.status)}</span>
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
