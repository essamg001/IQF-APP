import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { canSeePricing } from "@/lib/roles";
import { isCreditedClaim } from "@/lib/claims";
import { notFound } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button, LinkButton } from "@/components/ui/button";
import { format } from "date-fns";
import { allocatePalletsAction, advanceOrderStageAction, updateOrderValueAction } from "../actions";
import { Input, FieldGroup } from "@/components/ui/field";
import { FORMAT_LABEL } from "@/lib/format";

const STAGE_ORDER = ["CONFIRMED", "IN_PRODUCTION", "PACKED", "SHIPPED", "DELIVERED", "PAID"] as const;
const STAGE_LABEL: Record<(typeof STAGE_ORDER)[number], string> = {
  CONFIRMED: "Confirmed",
  IN_PRODUCTION: "In Production",
  PACKED: "Packed",
  SHIPPED: "Shipped",
  DELIVERED: "Delivered",
  PAID: "Paid",
};

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  const showPricing = canSeePricing(session?.user.role);

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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold text-slate-900">{order.orderNumber}</h1>
            <Badge color="slate">{STAGE_LABEL[order.stage]}</Badge>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            {order.client.name} · Grade {order.grade} · {FORMAT_LABEL[order.format]}
          </p>
        </div>
        <div className="flex gap-2">
          {order.pallets.length < order.quantityPallets && (
            <form action={allocatePalletsAction.bind(null, order.id)}>
              <Button type="submit" variant="secondary">
                Allocate pallets
              </Button>
            </form>
          )}
          {nextStage && (
            <form action={advanceOrderStageAction.bind(null, order.id)}>
              <Button type="submit">Advance to {STAGE_LABEL[nextStage]}</Button>
            </form>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Card>
          <h2 className="text-sm font-semibold text-slate-900">Order Details</h2>
          <dl className="mt-3 space-y-2 text-sm">
            <Row label="PO Number" value={order.poNumber} />
            <Row label="Order date" value={format(order.orderDate, "dd MMM yyyy")} />
            <Row label="Quantity" value={`${order.quantityPallets} pallets`} />
            <Row label="Allocated" value={`${order.pallets.length} / ${order.quantityPallets}`} />
            {showPricing && <Row label="Gross value" value={`$${order.valueUsd.toLocaleString()}`} />}
            {showPricing && <Row label="Net value (after claims)" value={`$${netValue.toLocaleString()}`} />}
          </dl>
          {showPricing && (
            <form action={updateOrderValueAction.bind(null, order.id)} className="mt-3 flex items-end gap-2 border-t border-slate-100 pt-3">
              <FieldGroup label={order.valueUsd > 0 ? "Update value (USD)" : "Set value (USD)"}>
                <Input name="valueUsd" type="number" step="0.01" min="0" defaultValue={order.valueUsd || ""} className="w-40" />
              </FieldGroup>
              <Button type="submit" variant="secondary">
                Save
              </Button>
            </form>
          )}
        </Card>

        <Card>
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900">
              Containers ({order.containers.length})
            </h2>
            <LinkButton href={`/logistics/new?orderId=${order.id}`} variant="secondary" className="text-xs">
              Add container
            </LinkButton>
          </div>
          {order.containers.length > 0 ? (
            <ul className="mt-3 space-y-2 text-sm">
              {order.containers.map((c) => (
                <li key={c.id}>
                  <a href={`/logistics/${c.id}`} className="flex justify-between rounded-md border border-slate-200 p-2 hover:bg-slate-50">
                    <span className="font-medium text-emerald-700">{c.containerNumber}</span>
                    <span className="text-slate-500">{c.currentLocation ?? "Location not set"}</span>
                  </a>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-slate-400">
              No containers yet. Large orders may need more than one — a container holds ~25t loose or ~24t
              palletised.
            </p>
          )}
        </Card>
      </div>

      <Card className="overflow-x-auto p-0">
        <div className="flex items-center justify-between px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-900">Allocated Pallets</h2>
          <LinkButton
            href={`/claims/new?clientId=${order.clientId}${order.containers[0] ? `&containerNumber=${order.containers[0].containerNumber}` : ""}`}
            variant="secondary"
          >
            File Claim
          </LinkButton>
        </div>
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-slate-500">
            <tr>
              <th className="px-4 py-2 font-medium">Pallet #</th>
              <th className="px-4 py-2 font-medium">Lot</th>
              <th className="px-4 py-2 font-medium">Cold Room</th>
              <th className="px-4 py-2 font-medium">Loaded</th>
              <th className="px-4 py-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {order.pallets.map((p) => {
              const loaded = p.loadLines.reduce((s, l) => s + l.quantityTonnes, 0);
              return (
                <tr key={p.id} className="border-b border-slate-100 last:border-0">
                  <td className="px-4 py-2">
                    <a href={`/storage/${p.id}`} className="text-emerald-700 hover:underline">
                      {p.palletNumber}
                    </a>
                  </td>
                  <td className="px-4 py-2">{p.lot.lotNumber}</td>
                  <td className="px-4 py-2">{p.coldRoom?.name ?? "—"}</td>
                  <td className="px-4 py-2">
                    {loaded.toFixed(2)}t / {p.weightTonnes}t
                  </td>
                  <td className="px-4 py-2">
                    <Badge color="blue">{p.status.replace("_", " ")}</Badge>
                  </td>
                </tr>
              );
            })}
            {order.pallets.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-slate-400">
                  No pallets allocated yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>

      {relatedClaims.length > 0 && (
        <Card>
          <h2 className="text-sm font-semibold text-slate-900">Claims on these Containers</h2>
          <ul className="mt-2 space-y-2">
            {relatedClaims.map((c) => (
              <li key={c.id}>
                <a
                  href={`/claims/${c.id}`}
                  className="flex justify-between rounded-md border border-slate-200 p-2 text-sm hover:bg-slate-50"
                >
                  <span>
                    <Badge color={c.severity === "RED" ? "red" : "amber"}>{c.severity}</Badge>{" "}
                    {c.reason.replace("_", " ")}
                  </span>
                  <span className="text-slate-500">
                    {showPricing ? `$${c.valueUsd.toLocaleString()} · ` : ""}
                    {c.status.replace("_", " ")}
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
      <dd className="text-right text-slate-800">{value || "—"}</dd>
    </div>
  );
}
