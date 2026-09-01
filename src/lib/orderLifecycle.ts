import type { Order, Pallet, ProductionLot, MicrobiologyResult, MrlResult, ClientSpec, Container, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { isMrlCleared } from "@/lib/mrl";
import { isMicroCleared } from "@/lib/microbiology";
import { explainZeroAllocation } from "@/lib/allocation";

// The single source of truth for "where is this order, really." OrderStage
// itself only has 6 values and is advanced almost entirely by a person
// clicking a button -- it says nothing about allocation, lab clearance, or
// loading, which is why the Orders/Load Out/Logistics pages used to show a
// stage badge that could say "Confirmed" while every pallet had already
// shipped. Every step below is derived from data that already exists
// (Order.pallets, Pallet.lot, ProductionLot.microbiologyResults/mrlResult,
// Container) -- no new schema.
export const ORDER_STAGE_SEQUENCE = ["CONFIRMED", "IN_PRODUCTION", "PACKED", "SHIPPED", "DELIVERED", "PAID"] as const;

export type LifecycleStepKey = "CONFIRMED" | "ALLOCATED" | "LAB_CLEARED" | "LOADED" | "SHIPPED" | "DELIVERED" | "PAID";
export type StepStatus = "done" | "current" | "blocked" | "upcoming";

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

/**
 * Derives every real lifecycle step for one order. Steps beyond what
 * OrderStage itself tracks (Allocated, Lab Cleared, Loaded) are computed
 * fresh each call rather than stored -- an order's pallets/lots change
 * independently of Order.stage, so anything cached here could drift stale
 * the same way the old plain stage badge did.
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

  const stageIdx = ORDER_STAGE_SEQUENCE.indexOf(order.stage);
  for (const key of ["SHIPPED", "DELIVERED", "PAID"] as const) {
    const keyIdx = ORDER_STAGE_SEQUENCE.indexOf(key);
    steps.push({ key, status: stageIdx >= keyIdx ? "done" : stageIdx === keyIdx - 1 ? "current" : "upcoming" });
  }

  return steps;
}

/**
 * A one-line summary for compact list-view rendering (Orders/Logistics
 * lists). Returns the step KEY, not a pre-baked label -- step labels are
 * real UI chrome (unlike the English-only `detail` sentences, which follow
 * this app's existing src/lib/alerts.ts convention of plain-English system
 * messages), so every caller translates it through the same dict entries
 * the tracker itself uses.
 */
export function summarizeLifecycle(steps: LifecycleStep[]): { key: LifecycleStepKey; detail?: string; tone: "done" | "current" | "blocked" } {
  const blocked = steps.find((s) => s.status === "blocked");
  if (blocked) return { key: blocked.key, detail: blocked.detail, tone: "blocked" };
  const current = [...steps].reverse().find((s) => s.status === "current" || s.status === "done");
  if (!current) return { key: "CONFIRMED", tone: "current" };
  return { key: current.key, detail: current.detail, tone: current.status === "done" ? "done" : "current" };
}

/**
 * Fires the moment an order's last allocated pallet actually finishes
 * loading (called from logistics/actions.ts right after createLoadLine ships
 * a pallet) -- the same check advanceOrderStageAction already performs
 * before allowing a manual "Advance to Shipped" click, just no longer
 * waiting on someone to remember to click it once the data already proves
 * it's true. IN_PRODUCTION/PACKED stay untouched (nothing in the data
 * distinguishes them yet) and DELIVERED/PAID stay manual (real-world
 * attestation, not derivable).
 */
export async function maybeAutoAdvanceToShipped(orderId: string, tx: Prisma.TransactionClient | typeof prisma = prisma) {
  const order = await tx.order.findUnique({
    where: { id: orderId },
    select: { stage: true, pallets: { select: { status: true } } },
  });
  if (!order) return;
  if (ORDER_STAGE_SEQUENCE.indexOf(order.stage) >= ORDER_STAGE_SEQUENCE.indexOf("SHIPPED")) return;
  if (order.pallets.length === 0) return;
  if (order.pallets.some((p) => p.status !== "SHIPPED")) return;

  await tx.order.update({ where: { id: orderId }, data: { stage: "SHIPPED" } });
}
