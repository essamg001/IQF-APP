import { prisma } from "@/lib/prisma";
import type { AlertType, Role } from "@prisma/client";
import { differenceInDays } from "date-fns";
import { sendEmail } from "@/lib/email";
import { parseBrixRange } from "@/lib/allocation";

const MICRO_PENDING_DAYS_THRESHOLD = 3;

async function upsertAlert(type: AlertType, relatedEntityId: string, targetRole: Role, message: string) {
  const existing = await prisma.alert.findFirst({
    where: { type, relatedEntityId, targetRole, status: "UNREAD" },
  });
  if (existing) return;
  await prisma.alert.create({
    data: { type, relatedEntityType: type, relatedEntityId, targetRole, message },
  });

  const recipients = await prisma.user.findMany({ where: { role: targetRole } });
  await Promise.all(recipients.map((u) => sendEmail(u.email, `IQF Alert: ${type.replace("_", " ")}`, message)));
}

/** Scans current state and raises alerts for newly-detected conditions. Safe to call repeatedly. */
export async function generateAlerts() {
  await Promise.all([checkSpecMismatch(), checkContainerOverdue(), checkLowStock(), checkMicrobiologyPending()]);
}

/**
 * Every attempt is its own compliance event (not a static condition), so this
 * always creates a fresh alert rather than deduping like upsertAlert does.
 */
export async function raiseMicrobiologyLoadAttemptAlert(params: {
  palletId: string;
  palletNumber: string;
  lotNumber: string;
  containerNumber: string;
  microStatus: string;
}) {
  const message = `Blocked: attempt to load pallet ${params.palletNumber} (Lot ${params.lotNumber}) into container ${params.containerNumber} without microbiology approval (status: ${params.microStatus.replace("_", " ")}).`;

  for (const role of ["QUALITY", "PRODUCTION"] as const) {
    await prisma.alert.create({
      data: {
        type: "MICROBIOLOGY_LOAD_ATTEMPT",
        relatedEntityType: "MICROBIOLOGY_LOAD_ATTEMPT",
        relatedEntityId: params.palletId,
        targetRole: role,
        message,
      },
    });
    const recipients = await prisma.user.findMany({ where: { role } });
    await Promise.all(recipients.map((u) => sendEmail(u.email, "IQF Alert: Blocked Load Attempt", message)));
  }
}

async function checkSpecMismatch() {
  const pallets = await prisma.pallet.findMany({
    where: { status: "ALLOCATED" },
    include: { lot: { include: { qualityChecks: true } }, client: { include: { specs: true } } },
  });

  for (const pallet of pallets) {
    if (!pallet.client) continue;
    const spec = pallet.client.specs.find(
      (s) => s.grade === pallet.lot.grade && s.format === pallet.lot.format
    );
    if (!spec) continue;

    const brixRange = parseBrixRange(spec.brix);
    if (!brixRange) continue;

    const checks = pallet.lot.qualityChecks;
    if (checks.length === 0) continue;
    const avgBrix = checks.reduce((s, c) => s + c.brix, 0) / checks.length;

    const outOfBrix = avgBrix < brixRange.min || avgBrix > brixRange.max;
    if (!outOfBrix) continue;

    const message = `Pallet ${pallet.palletNumber} for ${pallet.client.name} (spec "${spec.specName}") is outside brix spec (${avgBrix.toFixed(1)}, expected ${brixRange.min}-${brixRange.max}) before shipment.`;
    await upsertAlert("SPEC_MISMATCH", pallet.id, "QUALITY", message);
    await upsertAlert("SPEC_MISMATCH", pallet.id, "PRODUCTION", message);
  }
}

async function checkContainerOverdue() {
  const containers = await prisma.container.findMany({
    where: {
      departureDate: { not: null },
      expectedTransitDays: { not: null },
      order: { stage: { notIn: ["DELIVERED", "PAID"] } },
    },
    include: { order: { include: { client: true } } },
  });

  for (const c of containers) {
    if (!c.departureDate || !c.expectedTransitDays) continue;
    if (differenceInDays(new Date(), c.departureDate) <= c.expectedTransitDays) continue;

    const message = `Container ${c.containerNumber} (${c.order.client.name}) is overdue vs. its expected ${c.expectedTransitDays}-day transit.`;
    await upsertAlert("CONTAINER_OVERDUE", c.id, "LOGISTICS", message);
    await upsertAlert("CONTAINER_OVERDUE", c.id, "SALES", message);
    await upsertAlert("CONTAINER_OVERDUE", c.id, "PRODUCTION", message);
  }
}

async function checkLowStock() {
  const pendingOrders = await prisma.order.findMany({
    where: { stage: { in: ["CONFIRMED", "IN_PRODUCTION", "PACKED"] } },
    include: { _count: { select: { pallets: true } } },
  });

  const neededByKey = new Map<string, number>();
  for (const o of pendingOrders) {
    const key = `${o.grade}:${o.format}`;
    const remaining = o.quantityPallets - o._count.pallets;
    if (remaining > 0) neededByKey.set(key, (neededByKey.get(key) ?? 0) + remaining);
  }

  for (const [key, needed] of neededByKey) {
    const [grade, format] = key.split(":") as ["A" | "B", "WHOLE" | "SLICED" | "DICED"];
    const available = await prisma.pallet.count({
      where: { status: "IN_STORAGE", lot: { grade, format, microbiologyResult: { status: "APPROVED" } } },
    });
    if (available >= needed) continue;

    const message = `Low stock: Grade ${grade} ${format} has ${available} pallet(s) available but ${needed} needed for pending orders.`;
    await upsertAlert("LOW_STOCK", key, "SALES", message);
    await upsertAlert("LOW_STOCK", key, "OWNER", message);
    await upsertAlert("LOW_STOCK", key, "PRODUCTION", message);
  }
}

async function checkMicrobiologyPending() {
  const pending = await prisma.microbiologyResult.findMany({
    where: { status: "PENDING" },
    include: { lot: true },
  });

  for (const m of pending) {
    if (differenceInDays(new Date(), m.lot.createdAt) < MICRO_PENDING_DAYS_THRESHOLD) continue;
    const message = `Lot ${m.lot.lotNumber} has been awaiting microbiology results for ${differenceInDays(new Date(), m.lot.createdAt)} day(s).`;
    await upsertAlert("MICROBIOLOGY_PENDING", m.lotId, "QUALITY", message);
    await upsertAlert("MICROBIOLOGY_PENDING", m.lotId, "PRODUCTION", message);
  }
}
