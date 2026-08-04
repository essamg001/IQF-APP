import { prisma } from "@/lib/prisma";
import type { AlertType, Role } from "@prisma/client";
import { differenceInDays } from "date-fns";
import { sendEmail } from "@/lib/email";
import { parseBrixRange } from "@/lib/allocation";
import { formatViolation, formatTrendWarning, type LimitViolation, type TrendWarning } from "@/lib/qualityLimits";
import { bothLabsApprovedFilter } from "@/lib/microbiology";

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

/**
 * Same blocked-load-attempt alert type as raiseMicrobiologyLoadAttemptAlert,
 * but for the distinct case where a pallet IS lab-Approved and still gets
 * blocked -- its cfu/g reading is above this specific client's own spec
 * ceiling (see src/lib/cfuTier.ts), so it would be fully rejected on arrival
 * rather than just discounted.
 */
export async function raiseCfuLimitLoadAttemptAlert(params: {
  palletId: string;
  palletNumber: string;
  lotNumber: string;
  containerNumber: string;
  clientName: string;
  cfuValue: number;
  maxCfuPerGram: number;
}) {
  const message = `Blocked: attempt to load pallet ${params.palletNumber} (Lot ${params.lotNumber}) into container ${params.containerNumber} — Total Plate Count ${params.cfuValue.toLocaleString()} cfu/g exceeds ${params.clientName}'s spec limit of ${params.maxCfuPerGram.toLocaleString()} cfu/g.`;

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

/**
 * Fired the moment a lab result is recorded as rejected, rather than waiting
 * for the periodic scan, so quality/production can act before that fruit
 * gets anywhere near a shipment.
 */
export async function raiseMicrobiologyRejectionAlert(params: {
  lotId: string;
  lotNumber: string;
  severity: "FAILED_MINOR" | "FAILED_SEVERE";
  rejectedQuantityTonnes: number | null;
  rejectionReason: string | null;
}) {
  const severityLabel = params.severity === "FAILED_SEVERE" ? "SEVERE" : "MINOR";
  const quantityPart = params.rejectedQuantityTonnes ? `${params.rejectedQuantityTonnes}t` : "quantity not yet specified";
  const reasonPart = params.rejectionReason || "reason not yet specified";
  const message = `Lab REJECTED Lot ${params.lotNumber} (${severityLabel}) — ${quantityPart} — reason: ${reasonPart}. Do not export this fruit.`;

  for (const role of ["QUALITY", "PRODUCTION"] as const) {
    await prisma.alert.create({
      data: {
        type: "MICROBIOLOGY_REJECTED",
        relatedEntityType: "MICROBIOLOGY_REJECTED",
        relatedEntityId: params.lotId,
        targetRole: role,
        message,
      },
    });
    const recipients = await prisma.user.findMany({ where: { role } });
    await Promise.all(recipients.map((u) => sendEmail(u.email, "IQF Alert: Lab Rejection", message)));
  }
}

/**
 * Fired when a lot's two microbiology results disagree -- one lab Approved
 * it, the other Failed it. We can't tell yet which lab is right, so every
 * lot from the same shift goes on hold pending further testing, not just the
 * one sampled lot. Idempotent: does nothing if the shift is already on hold,
 * so re-running the check after the fact (or on a sibling lot's result)
 * doesn't reset the hold timer or spam duplicate alerts.
 */
export async function raiseShiftOnHoldAlert(params: { shiftId: string; reason: string }) {
  const shift = await prisma.shiftLog.findUnique({ where: { id: params.shiftId } });
  if (!shift || shift.onHold) return;

  await prisma.shiftLog.update({
    where: { id: params.shiftId },
    data: { onHold: true, holdReason: params.reason, holdSince: new Date() },
  });

  for (const role of ["QUALITY", "PRODUCTION", "OWNER"] as const) {
    await prisma.alert.create({
      data: {
        type: "SHIFT_ON_HOLD",
        relatedEntityType: "SHIFT_ON_HOLD",
        relatedEntityId: params.shiftId,
        targetRole: role,
        message: params.reason,
      },
    });
    const recipients = await prisma.user.findMany({ where: { role } });
    await Promise.all(recipients.map((u) => sendEmail(u.email, "IQF Alert: Shift On Hold", params.reason)));
  }
}

/**
 * Fired the moment any inspection checkpoint (Pre-Decap, Post-Decap, Arrival
 * at Factory, Post-Freeze) is logged with a value outside its own printed
 * tolerance. The point is to catch it immediately -- before that produce
 * moves any further toward storage or load-out, and while corrective action
 * in the field may still be possible -- not to wait for a periodic scan.
 */
export async function raiseQualityLimitAlert(params: {
  checkId: string;
  checkpointLabel: string;
  identifier: string; // whatever best identifies this check to a human -- field name, lot number, sample no.
  violations: LimitViolation[];
}) {
  if (params.violations.length === 0) return;
  const violationText = params.violations.map(formatViolation).join("; ");
  const message = `${params.checkpointLabel} — ${params.identifier}: out of spec — ${violationText}.`;

  await prisma.qualityCheck.update({ where: { id: params.checkId }, data: { overrideStatus: "PENDING" } });

  for (const role of ["QUALITY", "PRODUCTION", "OWNER"] as const) {
    await prisma.alert.create({
      data: {
        type: "QUALITY_LIMIT_EXCEEDED",
        relatedEntityType: "QUALITY_LIMIT_EXCEEDED",
        relatedEntityId: params.checkId,
        targetRole: role,
        message,
      },
    });
    const recipients = await prisma.user.findMany({ where: { role } });
    await Promise.all(recipients.map((u) => sendEmail(u.email, "IQF Alert: Quality Limit Exceeded", message)));
  }
}

/**
 * Fired the moment someone signs off to let an out-of-spec check proceed at
 * their own risk (rather than rejecting it outright) -- every such decision
 * is its own compliance event, so this always creates a fresh alert rather
 * than deduping like upsertAlert does.
 */
export async function raiseQualityOverrideAlert(params: {
  checkId: string;
  originalMessage: string;
  approvedByName: string;
  note?: string | null;
}) {
  const message = `RISK APPROVED — ${params.originalMessage} — signed off to proceed anyway by ${params.approvedByName}${params.note ? ` ("${params.note}")` : ""}.`;

  for (const role of ["QUALITY", "PRODUCTION", "OWNER"] as const) {
    await prisma.alert.create({
      data: {
        type: "QUALITY_OVERRIDE_APPROVED",
        relatedEntityType: "QUALITY_OVERRIDE_APPROVED",
        relatedEntityId: params.checkId,
        targetRole: role,
        message,
      },
    });
    const recipients = await prisma.user.findMany({ where: { role } });
    await Promise.all(recipients.map((u) => sendEmail(u.email, "IQF Alert: Quality Override Approved", message)));
  }
}

/**
 * A softer, earlier signal than raiseQualityLimitAlert: a field's last 3
 * readings are moving toward a limit, not just a single bad one. Doesn't
 * touch overrideStatus -- nothing has actually breached spec yet, so there's
 * nothing to block or sign off on, just a heads-up to go look at the field
 * before it becomes a real problem.
 */
export async function raiseFieldTrendAlert(params: {
  fieldId: string;
  checkpointLabel: string;
  identifier: string;
  warnings: TrendWarning[];
}) {
  if (params.warnings.length === 0) return;
  const warningText = params.warnings.map(formatTrendWarning).join("; ");
  const message = `${params.checkpointLabel} — ${params.identifier}: quality trending toward its limit — ${warningText}.`;

  // Keyed by field + which metrics are currently trending, not just field --
  // a field can trend on one metric (e.g. Brix) while a later check finds a
  // completely different one (e.g. Botrytis) trending instead. Keying on
  // fieldId alone would make upsertAlert's dedup treat the second as "already
  // alerted" and silently keep showing the first, now-stale warning.
  const metricsKey = [...params.warnings.map((w) => w.limit.field)].sort().join(",");
  const relatedEntityId = `${params.fieldId}::${metricsKey}`;

  for (const role of ["QUALITY", "PRODUCTION", "OWNER"] as const) {
    await upsertAlert("EARLY_WARNING", relatedEntityId, role, message);
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
    const daysElapsed = differenceInDays(new Date(), c.departureDate);

    if (daysElapsed > c.expectedTransitDays) {
      const message = `Container ${c.containerNumber} (${c.order.client.name}) is overdue vs. its expected ${c.expectedTransitDays}-day transit.`;
      await upsertAlert("CONTAINER_OVERDUE", c.id, "LOGISTICS", message);
      await upsertAlert("CONTAINER_OVERDUE", c.id, "SALES", message);
      await upsertAlert("CONTAINER_OVERDUE", c.id, "PRODUCTION", message);
    } else if (daysElapsed >= c.expectedTransitDays * 0.8) {
      // A real early warning -- fired while there's still time to act on a
      // developing delay, not just a postmortem once the expected date has
      // already passed (that's what CONTAINER_OVERDUE above is for).
      const message = `Container ${c.containerNumber} (${c.order.client.name}) is at day ${daysElapsed} of its expected ${c.expectedTransitDays}-day transit -- approaching its expected arrival, worth checking on.`;
      await upsertAlert("EARLY_WARNING", c.id, "LOGISTICS", message);
      await upsertAlert("EARLY_WARNING", c.id, "SALES", message);
    }
  }
}

/**
 * Fired the moment a logged temperature reading falls outside tolerance of
 * the container's own reefer set-point -- every reading is its own event
 * worth its own alert, not a static condition to dedupe against.
 */
export async function raiseTemperatureExcursionAlert(params: {
  containerId: string;
  containerNumber: string;
  temperatureC: number;
  setPointC: number;
}) {
  const message = `Container ${params.containerNumber}: reefer reading ${params.temperatureC}°C is off its ${params.setPointC}°C set-point -- possible temperature excursion in transit.`;

  for (const role of ["LOGISTICS", "QUALITY", "OWNER"] as const) {
    await prisma.alert.create({
      data: {
        type: "TEMPERATURE_EXCURSION",
        relatedEntityType: "TEMPERATURE_EXCURSION",
        relatedEntityId: params.containerId,
        targetRole: role,
        message,
      },
    });
    const recipients = await prisma.user.findMany({ where: { role } });
    await Promise.all(recipients.map((u) => sendEmail(u.email, "IQF Alert: Temperature Excursion", message)));
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
      where: {
        status: "IN_STORAGE",
        lot: {
          grade,
          format,
          shift: { is: { onHold: false } },
          ...bothLabsApprovedFilter,
        },
      },
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
    where: { status: { in: ["PENDING", "SENT_TO_LAB"] } },
    include: { lot: true },
  });

  for (const m of pending) {
    const days = differenceInDays(new Date(), m.lot.createdAt);
    if (days < MICRO_PENDING_DAYS_THRESHOLD) continue;
    const labLabel = m.labType === "IN_HOUSE" ? "In-House" : "External";
    const message = `Lot ${m.lot.lotNumber} has been awaiting its ${labLabel} lab result for ${days} day(s).`;
    // Keyed per result (not per lot) since a lot now has two independent
    // results, each of which can be pending on its own schedule.
    await upsertAlert("MICROBIOLOGY_PENDING", m.id, "QUALITY", message);
    await upsertAlert("MICROBIOLOGY_PENDING", m.id, "PRODUCTION", message);
  }
}
