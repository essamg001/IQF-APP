import type { Order, Pallet, ProductionLot, MicrobiologyResult, MrlResult, ClientSpec, Container, OrderStage, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { differenceInCalendarDays } from "date-fns";
import { isMrlCleared } from "@/lib/mrl";
import { isMicroCleared } from "@/lib/microbiology";
import { explainZeroAllocation } from "@/lib/allocation";

// The single source of truth for "where is this order, really." Only the
// stages that are still real, unambiguous facts stay in the manual
// sequence -- IN_PRODUCTION and PACKED (still present in the OrderStage
// enum itself, for old rows) were removed after they turned out to have no
// real backing data and no gate on advancing through them: an order could
// be clicked all the way to "Packed" with zero pallets allocated, which
// then made this same tracker's Shipped step render as "current" purely
// because of index proximity, contradicting the Allocated step right next
// to it. Whatever "in production" was meant to signal is already covered
// by the Allocated step's own NO_STOCK detail below. Every step through
// Loaded is derived from data that already exists (Order.pallets,
// Pallet.lot, ProductionLot.microbiologyResults/mrlResult, Container) --
// no new schema was needed for those. Delivered/Paid are the only two
// left that are genuine real-world attestations nothing in the data can
// derive on its own.
export const ORDER_STAGE_SEQUENCE = ["CONFIRMED", "SHIPPED", "DELIVERED", "PAID"] as const;

/**
 * Same as ORDER_STAGE_SEQUENCE.indexOf, but falls back to CONFIRMED's index
 * (0) for a legacy row still sitting at IN_PRODUCTION/PACKED from before
 * those were retired, rather than returning -1 and breaking every
 * comparison downstream. A legacy row gets treated exactly like a
 * CONFIRMED order for tracker/advancement purposes -- which matches
 * reality, since neither of those two ever proved anything actually
 * happened.
 */
export function normalizedStageIndex(stage: OrderStage): number {
  const idx = ORDER_STAGE_SEQUENCE.indexOf(stage as (typeof ORDER_STAGE_SEQUENCE)[number]);
  return idx === -1 ? 0 : idx;
}

export type LifecycleStepKey = "CONFIRMED" | "ALLOCATED" | "LAB_CLEARED" | "LOADED" | "SHIPPED" | "DELIVERED" | "PAID";
export type StepStatus = "done" | "current" | "blocked" | "upcoming";
export type StepUrgency = "normal" | "warning" | "critical";

export type LifecycleStep = {
  key: LifecycleStepKey;
  status: StepStatus;
  // Plain English, matching how src/lib/alerts.ts already writes its
  // messages -- this app's convention for system-generated status text is
  // English-only (it's operational detail, not UI chrome), not a per-locale
  // dictionary string.
  detail?: string;
  actionHref?: string;
  actionLabel?: string;
  /** Only set on the one active (blocked/current) step -- see the aging note below. */
  urgency?: StepUrgency;
};

type PalletForLifecycle = Pallet & {
  lot: ProductionLot & {
    microbiologyResults: MicrobiologyResult[];
    mrlResult: MrlResult | null;
    shift: { onHold: boolean };
  };
};

export type OrderForLifecycle = Order & {
  client: { name: string; specs: ClientSpec[] };
  pallets: PalletForLifecycle[];
  containers: Pick<Container, "id">[];
};

const ALLOCATION_WARNING_DAYS = 5;
const ALLOCATION_CRITICAL_DAYS = 10;
const SHIP_DATE_WARNING_DAYS = 5;
const SHIP_DATE_CRITICAL_DAYS = 2;

/**
 * Derives every real lifecycle step for one order. Steps beyond what
 * OrderStage itself tracks (Allocated, Lab Cleared, Loaded) are computed
 * fresh each call rather than stored -- an order's pallets/lots change
 * independently of Order.stage, so anything cached here could drift stale
 * the same way the old plain stage badge did.
 *
 * Callers must check `order.cancelledAt` before calling this -- a
 * cancelled order isn't a step in this sequence, it's an exit from it, so
 * it's handled entirely outside this function (see the order detail and
 * orders list pages).
 */
export async function getOrderLifecycleStatus(order: OrderForLifecycle): Promise<LifecycleStep[]> {
  const steps: LifecycleStep[] = [{ key: "CONFIRMED", status: "done" }];

  const allocatedCount = order.pallets.length;
  const target = order.quantityPallets;

  if (allocatedCount >= target && target > 0) {
    steps.push({ key: "ALLOCATED", status: "done", detail: `${allocatedCount} of ${target} pallets allocated.` });
  } else {
    let detail: string;
    let actionHref: string | undefined;
    let actionLabel: string | undefined;
    if (allocatedCount === 0) {
      const reason = await explainZeroAllocation({ grade: order.grade, format: order.format });
      if (reason === "NO_STOCK") {
        detail = `No in-storage stock of Grade ${order.grade} ${order.format} exists yet.`;
        // Not the same link/label as the LAB_PENDING case below -- this is
        // a structural, system-wide shortage (nothing to allocate from at
        // all, matching or not), not a matter of waiting on one lot's lab
        // result, so it points at the shortfall report rather than the lab.
        actionHref = `/available-to-sell?highlight=${order.grade}-${order.format}`;
        actionLabel = "View system-wide shortfall";
      } else if (reason === "LAB_PENDING") {
        detail = "Matching stock exists, but none of it has cleared microbiology/MRL testing yet.";
        actionHref = "/lab";
        actionLabel = "View in Lab";
      } else {
        detail = `Matching, lab-cleared stock exists, but it fails ${order.client.name}'s spec limits.`;
      }
    } else {
      detail = `${allocatedCount} of ${target} pallets allocated -- ${target - allocatedCount} more needed.`;
    }
    steps.push({ key: "ALLOCATED", status: allocatedCount > 0 ? "current" : "blocked", detail, actionHref, actionLabel });
  }

  if (allocatedCount === 0) {
    steps.push({ key: "LAB_CLEARED", status: "upcoming" });
  } else {
    const blocked = order.pallets.filter(
      (p) => !isMicroCleared(p.lot.microbiologyResults, p.lot.shift.onHold) || !isMrlCleared(p.lot.mrlResult)
    );
    if (blocked.length === 0) {
      steps.push({ key: "LAB_CLEARED", status: "done" });
    } else {
      const lots = [...new Set(blocked.map((p) => p.lot.lotNumber))];
      const lotList = lots.slice(0, 3).join(", ") + (lots.length > 3 ? ` and ${lots.length - 3} more` : "");
      steps.push({
        key: "LAB_CLEARED",
        status: "blocked",
        detail: `${blocked.length} of ${allocatedCount} allocated pallet(s) waiting on lab clearance -- lot(s) ${lotList}.`,
        actionHref: `/lab?lot=${encodeURIComponent(lots[0])}`,
        actionLabel: "View in Lab",
      });
    }
  }

  if (allocatedCount === 0) {
    steps.push({ key: "LOADED", status: "upcoming" });
  } else {
    const shippedCount = order.pallets.filter((p) => p.status === "SHIPPED").length;
    if (shippedCount >= allocatedCount) {
      steps.push({ key: "LOADED", status: "done" });
    } else {
      const container = order.containers[0];
      steps.push({
        key: "LOADED",
        status: "current",
        detail: `${shippedCount} of ${allocatedCount} allocated pallet(s) loaded.`,
        actionHref: container ? `/logistics/${container.id}` : `/logistics/new?orderId=${order.id}`,
        actionLabel: container ? "Go to Container" : "Create Container",
      });
    }
  }

  // Shipped is the one real gap between the shrunk manual sequence
  // (Confirmed/Shipped/Delivered/Paid) and the fully-derived steps above
  // it: with In Production/Packed gone, Shipped would otherwise be
  // mechanically "current" for every single unshipped order regardless of
  // real progress -- the exact contradiction (Shipped rendering as the
  // active next step while Allocated shows blocked right next to it) this
  // whole fix was meant to remove, just moved rather than closed. Gating
  // its "current" status on Loaded actually being done keeps it inert
  // (upcoming) until it's genuinely the true next milestone.
  const loadedDone = steps.find((s) => s.key === "LOADED")?.status === "done";
  const stageIdx = normalizedStageIndex(order.stage);
  for (const key of ["SHIPPED", "DELIVERED", "PAID"] as const) {
    const keyIdx = ORDER_STAGE_SEQUENCE.indexOf(key);
    const wouldBeCurrent = stageIdx === keyIdx - 1;
    const status: StepStatus =
      stageIdx >= keyIdx ? "done" : wouldBeCurrent && (key !== "SHIPPED" || loadedDone) ? "current" : "upcoming";
    let detail: string | undefined;
    if (status === "done") {
      if (key === "DELIVERED" && order.deliveredAt) {
        detail = `Delivered ${formatShortDate(order.deliveredAt)} by ${order.deliveredByName}${order.deliveryReference ? ` (ref. ${order.deliveryReference})` : ""}.`;
      } else if (key === "PAID" && order.paidAt) {
        detail = `Paid ${formatShortDate(order.paidAt)}, confirmed by ${order.paidByName}${order.paymentReference ? ` (ref. ${order.paymentReference})` : ""}.`;
      }
    }
    steps.push({ key, status, detail });
  }

  // Aging/urgency is a property of the order as a whole (how long it's been
  // sitting, how close its ship date is), not of any one step -- attached
  // to whichever step is actually the current bottleneck (the same one
  // src/app/(app)/orders/[id]/lifecycle-tracker.tsx's findActiveStep would
  // pick), so the one banner a user actually sees carries it.
  const active = steps.find((s) => s.status === "blocked" || s.status === "current");
  if (active) {
    const daysSinceOrder = differenceInCalendarDays(new Date(), order.orderDate);
    const daysToShip = order.shipDate ? differenceInCalendarDays(order.shipDate, new Date()) : null;

    let urgency: StepUrgency = "normal";
    if (
      (daysToShip != null && daysToShip <= SHIP_DATE_CRITICAL_DAYS) ||
      daysSinceOrder >= ALLOCATION_CRITICAL_DAYS
    ) {
      urgency = "critical";
    } else if (
      (daysToShip != null && daysToShip <= SHIP_DATE_WARNING_DAYS) ||
      daysSinceOrder >= ALLOCATION_WARNING_DAYS
    ) {
      urgency = "warning";
    }

    const agingSuffix =
      daysToShip != null
        ? ` (blocked ${daysSinceOrder} day${daysSinceOrder === 1 ? "" : "s"}, ship date ${
            daysToShip >= 0 ? `in ${daysToShip} day${daysToShip === 1 ? "" : "s"}` : `${Math.abs(daysToShip)} day${Math.abs(daysToShip) === 1 ? "" : "s"} overdue`
          })`
        : ` (blocked ${daysSinceOrder} day${daysSinceOrder === 1 ? "" : "s"})`;

    active.detail = (active.detail ?? "") + agingSuffix;
    active.urgency = urgency;
  }

  return steps;
}

function formatShortDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * A one-line summary for compact list-view rendering (Orders/Logistics
 * lists). Returns the step KEY, not a pre-baked label -- step labels are
 * real UI chrome (unlike the English-only `detail` sentences, which follow
 * this app's existing src/lib/alerts.ts convention of plain-English system
 * messages), so every caller translates it through the same dict entries
 * the tracker itself uses.
 */
export function summarizeLifecycle(
  steps: LifecycleStep[]
): { key: LifecycleStepKey; detail?: string; tone: "done" | "current" | "blocked"; urgency?: StepUrgency } {
  const blocked = steps.find((s) => s.status === "blocked");
  if (blocked) return { key: blocked.key, detail: blocked.detail, tone: "blocked", urgency: blocked.urgency };
  const current = [...steps].reverse().find((s) => s.status === "current" || s.status === "done");
  if (!current) return { key: "CONFIRMED", tone: "current" };
  return { key: current.key, detail: current.detail, tone: current.status === "done" ? "done" : "current", urgency: current.urgency };
}

/**
 * Fires the moment an order's last allocated pallet actually finishes
 * loading (called from logistics/actions.ts right after createLoadLine ships
 * a pallet) -- the same check the old manual "Advance to Shipped" click used
 * to perform, just no longer waiting on someone to remember to click it once
 * the data already proves it's true. Delivered/Paid stay manual (real-world
 * attestation, not derivable) -- see markOrderDeliveredAction/
 * markOrderPaidAction in orders/actions.ts.
 */
export async function maybeAutoAdvanceToShipped(orderId: string, tx: Prisma.TransactionClient | typeof prisma = prisma) {
  const order = await tx.order.findUnique({
    where: { id: orderId },
    select: { stage: true, quantityPallets: true, cancelledAt: true, pallets: { select: { status: true } } },
  });
  if (!order || order.cancelledAt) return;
  if (normalizedStageIndex(order.stage) >= ORDER_STAGE_SEQUENCE.indexOf("SHIPPED")) return;
  if (order.pallets.length === 0) return;
  // Every *allocated* pallet shipping isn't the same as the order actually
  // being done -- an order still short of its full quantityPallets target
  // (Allocate Pallets hasn't found the rest of the stock yet) would
  // otherwise get silently marked Shipped the moment whatever partial
  // allocation it does have finishes loading, even though more pallets are
  // still owed to the client and were never allocated.
  if (order.pallets.length < order.quantityPallets) return;
  if (order.pallets.some((p) => p.status !== "SHIPPED")) return;

  await tx.order.update({ where: { id: orderId }, data: { stage: "SHIPPED" } });
}
