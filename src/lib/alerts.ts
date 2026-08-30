import { prisma } from "@/lib/prisma";
import type { AlertType, Role } from "@prisma/client";
import { differenceInDays } from "date-fns";
import { sendEmail } from "@/lib/email";
import { parseBrixRange } from "@/lib/allocation";
import { formatViolation, formatTrendWarning, type LimitViolation, type TrendWarning } from "@/lib/qualityLimits";
import { bothLabsApprovedFilter } from "@/lib/microbiology";
import { getCompanySettings } from "@/lib/companySettings";
import { getPackagingLowStockWarnings } from "@/lib/packagingMaterials";

const MICRO_PENDING_DAYS_THRESHOLD = 3;
const GLOBALGAP_EXPIRY_WARNING_DAYS = 30;
const CERTIFICATION_EXPIRY_WARNING_DAYS = 30;

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
  await Promise.all([
    checkSpecMismatch(),
    checkContainerOverdue(),
    checkLowStock(),
    checkMicrobiologyPending(),
    checkGlobalGapExpiry(),
    checkCertificationExpiry(),
    checkPalletsAwaitingReshelf(),
    checkPackagingLowStock(),
  ]);
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

/** Same shape as raiseMicrobiologyLoadAttemptAlert, for the MRL (pesticide residue) gate. */
export async function raiseMrlLoadAttemptAlert(params: {
  palletId: string;
  palletNumber: string;
  lotNumber: string;
  containerNumber: string;
  mrlStatus: string;
}) {
  const message = `Blocked: attempt to load pallet ${params.palletNumber} (Lot ${params.lotNumber}) into container ${params.containerNumber} without MRL approval (status: ${params.mrlStatus.replace("_", " ")}).`;

  for (const role of ["QUALITY", "PRODUCTION"] as const) {
    await prisma.alert.create({
      data: {
        type: "MRL_LOAD_ATTEMPT",
        relatedEntityType: "MRL_LOAD_ATTEMPT",
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
 * Covers the full client-spec compliance gate (brix + defect tolerances, see
 * src/lib/specCompliance.ts) -- not just cfu/g. Two distinct moments, both
 * worth a broadcast: "attempt" fires when a load gets blocked (so someone
 * with sign-off authority knows to come look), "signed" fires once someone
 * actually overrides it (so everyone who needs to know a specific person
 * took that risk finds out, independent of who happened to see the block).
 */
export async function raiseSpecExceptionAlert(
  params:
    | {
        stage: "attempt";
        palletId: string;
        palletNumber: string;
        lotNumber: string;
        containerNumber: string;
        clientName: string;
        violations: string[];
      }
    | {
        stage: "signed";
        palletId: string;
        palletNumber: string;
        lotNumber: string;
        containerNumber: string;
        clientName: string;
        violations: string[];
        approvedByName: string;
        note?: string | null;
      }
) {
  const message =
    params.stage === "attempt"
      ? `Blocked: attempt to load pallet ${params.palletNumber} (Lot ${params.lotNumber}) into container ${params.containerNumber} — fails ${params.clientName}'s spec: ${params.violations.join("; ")}.`
      : `SPEC EXCEPTION APPROVED — pallet ${params.palletNumber} (Lot ${params.lotNumber}) loaded into ${params.containerNumber} despite failing ${params.clientName}'s spec (${params.violations.join("; ")}) — signed off by ${params.approvedByName}${params.note ? ` ("${params.note}")` : ""}.`;
  const subject = params.stage === "attempt" ? "IQF Alert: Blocked Load Attempt" : "IQF Alert: Spec Exception Approved";

  for (const role of ["QUALITY", "PRODUCTION", "OWNER"] as const) {
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
    await Promise.all(recipients.map((u) => sendEmail(u.email, subject, message)));
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

/**
 * Every blocked attempt is its own compliance event (not a static
 * condition), so this always creates a fresh alert rather than deduping
 * like upsertAlert does -- same convention as the MRL/microbiology
 * load-attempt alerts.
 */
export async function raiseSprayRestrictionBlockedAlert(params: {
  fieldId: string;
  fieldName: string;
  harvestTicketSerial: string;
  chemicalName: string;
  sprayDate: Date;
  clearDate: Date;
}) {
  const message = `Blocked: Harvest Ticket ${params.harvestTicketSerial} includes field "${params.fieldName}", still inside its no-harvest window from a ${params.chemicalName} spray on ${params.sprayDate.toDateString()} -- clear to harvest on ${params.clearDate.toDateString()}.`;

  for (const role of ["QUALITY", "PRODUCTION"] as const) {
    await prisma.alert.create({
      data: {
        type: "SPRAY_RESTRICTION_BLOCKED",
        relatedEntityType: "SPRAY_RESTRICTION_BLOCKED",
        relatedEntityId: params.fieldId,
        targetRole: role,
        message,
      },
    });
    const recipients = await prisma.user.findMany({ where: { role } });
    await Promise.all(recipients.map((u) => sendEmail(u.email, "IQF Alert: Blocked Harvest Ticket", message)));
  }
}

/**
 * Every blade/knife return is checked against the number that went out, so a
 * mismatch means a piece may be unaccounted for -- a foreign-object risk in
 * frozen product. Fired the moment the mismatch is recorded (an event, not a
 * static condition), same convention as the other load-attempt alerts.
 */
export async function raiseBladeKnifeMismatchAlert(params: {
  recordId: string;
  workerName: string;
  issuedKnifeNumber: string;
  returnedKnifeNumber: string;
}) {
  const message = `Blade/knife mismatch: ${params.workerName} issued knife #${params.issuedKnifeNumber} but returned #${params.returnedKnifeNumber} -- a piece may be unaccounted for.`;

  for (const role of ["QUALITY", "PRODUCTION"] as const) {
    await prisma.alert.create({
      data: {
        type: "BLADE_KNIFE_MISMATCH",
        relatedEntityType: "BLADE_KNIFE_MISMATCH",
        relatedEntityId: params.recordId,
        targetRole: role,
        message,
      },
    });
    const recipients = await prisma.user.findMany({ where: { role } });
    await Promise.all(recipients.map((u) => sendEmail(u.email, "IQF Alert: Blade/Knife Mismatch", message)));
  }
}

/**
 * Fired the moment a scale's daily calibration check comes back outside its
 * own registered tolerance -- every product weight recorded on that scale
 * since its last good check is now suspect, a legal/compliance risk (net
 * weight on the label), not just an internal accuracy concern.
 */
export async function raiseScaleOutOfToleranceAlert(params: {
  scaleId: string;
  scaleNumber: string;
  deviationG: number;
  maxPermissibleErrorG: number;
}) {
  const message = `Scale #${params.scaleNumber} is out of tolerance: deviation ${params.deviationG}g exceeds its ±${params.maxPermissibleErrorG}g limit -- weights recorded on this scale may be wrong.`;

  for (const role of ["QUALITY", "PRODUCTION", "OWNER"] as const) {
    await prisma.alert.create({
      data: {
        type: "SCALE_OUT_OF_TOLERANCE",
        relatedEntityType: "SCALE_OUT_OF_TOLERANCE",
        relatedEntityId: params.scaleId,
        targetRole: role,
        message,
      },
    });
    const recipients = await prisma.user.findMany({ where: { role } });
    await Promise.all(recipients.map((u) => sendEmail(u.email, "IQF Alert: Scale Out of Tolerance", message)));
  }
}

/**
 * Fired the moment a rodent trap/bait station check finds a live or dead
 * rodent -- a food-safety event worth immediate attention, not something
 * that should wait to be noticed on the next visit to this page.
 */
export async function raiseRodentDetectedAlert(params: {
  trapId: string;
  trapNumber: string;
  trapType: "BAIT_STATION" | "GLUE_TRAP";
  status: "LIVE_RODENT" | "DEAD_RODENT";
}) {
  const trapTypeLabel = params.trapType === "BAIT_STATION" ? "bait station" : "glue trap";
  const findingLabel = params.status === "LIVE_RODENT" ? "a live rodent" : "a dead rodent";
  const message = `Rodent ${trapTypeLabel} #${params.trapNumber} check found ${findingLabel}.`;

  for (const role of ["QUALITY", "PRODUCTION"] as const) {
    await prisma.alert.create({
      data: {
        type: "RODENT_DETECTED",
        relatedEntityType: "RODENT_DETECTED",
        relatedEntityId: params.trapId,
        targetRole: role,
        message,
      },
    });
    const recipients = await prisma.user.findMany({ where: { role } });
    await Promise.all(recipients.map((u) => sendEmail(u.email, "IQF Alert: Rodent Detected", message)));
  }
}

/**
 * Fired at tool check-out when the counted total (intact + broken) is less
 * than the registered count for that tool -- same "a piece may be
 * unaccounted for" reasoning as the blade/knife mismatch alert, since a
 * missing tool fragment is exactly the kind of foreign-material risk this
 * register exists to catch.
 */
export async function raiseToolInventoryDiscrepancyAlert(params: {
  checkId: string;
  toolName: string;
  registeredCount: number;
  countedTotal: number;
}) {
  const message = `Tool inventory discrepancy: "${params.toolName}" — ${params.countedTotal} accounted for at check-out, but ${params.registeredCount} are registered. A piece may be unaccounted for.`;

  for (const role of ["QUALITY", "PRODUCTION"] as const) {
    await prisma.alert.create({
      data: {
        type: "TOOL_INVENTORY_DISCREPANCY",
        relatedEntityType: "TOOL_INVENTORY_DISCREPANCY",
        relatedEntityId: params.checkId,
        targetRole: role,
        message,
      },
    });
    const recipients = await prisma.user.findMany({ where: { role } });
    await Promise.all(recipients.map((u) => sendEmail(u.email, "IQF Alert: Tool Inventory Discrepancy", message)));
  }
}

/**
 * Fired the moment a returned knife is logged as Damaged or Piece Missing --
 * independent of raiseBladeKnifeMismatchAlert above, since a knife can come
 * back as the right number and still be damaged. Same "may be unaccounted
 * for" food-safety reasoning either way.
 */
export async function raiseBladeKnifeDamagedAlert(params: {
  recordId: string;
  workerName: string;
  knifeNumber: string;
  condition: "DAMAGED" | "PIECE_MISSING";
}) {
  const conditionLabel = params.condition === "DAMAGED" ? "damaged" : "missing a piece";
  const message = `Knife #${params.knifeNumber} returned by ${params.workerName} came back ${conditionLabel} -- a fragment may be unaccounted for.`;

  for (const role of ["QUALITY", "PRODUCTION"] as const) {
    await prisma.alert.create({
      data: {
        type: "BLADE_KNIFE_DAMAGED",
        relatedEntityType: "BLADE_KNIFE_DAMAGED",
        relatedEntityId: params.recordId,
        targetRole: role,
        message,
      },
    });
    const recipients = await prisma.user.findMany({ where: { role } });
    await Promise.all(recipients.map((u) => sendEmail(u.email, "IQF Alert: Blade/Knife Damaged", message)));
  }
}

/**
 * Fired when a Production Lot is logged for a shift with no accepted
 * Post-Decap Quality check linked to any of it -- every field on the lot came
 * from the manual "add another field" fallback instead of the automatic
 * shift-scoped suggestion, meaning decap traceability for this lot is
 * currently unconfirmed.
 */
export async function raiseShiftMissingPostDecapLinkAlert(params: { lotId: string; lotNumber: string }) {
  const message = `Lot ${params.lotNumber} was logged with no matching accepted Post-Decap Quality check for its shift -- its supplying field(s) were entered manually and aren't confirmed by a decap record.`;

  for (const role of ["QUALITY", "PRODUCTION"] as const) {
    await prisma.alert.create({
      data: {
        type: "SHIFT_MISSING_POST_DECAP_LINK",
        relatedEntityType: "SHIFT_MISSING_POST_DECAP_LINK",
        relatedEntityId: params.lotId,
        targetRole: role,
        message,
      },
    });
    const recipients = await prisma.user.findMany({ where: { role } });
    await Promise.all(recipients.map((u) => sendEmail(u.email, "IQF Alert: Lot Missing Post-Decap Link", message)));
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

// All fields currently share one farm-level GlobalG.A.P. certification (see
// CompanySettings.globalGapExpiry), so this is a single check rather than
// one per field.
async function checkGlobalGapExpiry() {
  const settings = await getCompanySettings();
  if (!settings.globalGapExpiry) return;

  const daysLeft = differenceInDays(settings.globalGapExpiry, new Date());
  if (daysLeft > GLOBALGAP_EXPIRY_WARNING_DAYS) return;

  const numberLabel = settings.globalGapNumber ? `#${settings.globalGapNumber}` : "on file";
  const message =
    daysLeft < 0
      ? `GlobalG.A.P. certification (${numberLabel}) expired ${Math.abs(daysLeft)} day(s) ago.`
      : `GlobalG.A.P. certification (${numberLabel}) expires in ${daysLeft} day(s).`;

  await upsertAlert("GLOBALGAP_EXPIRING", settings.id, "OWNER", message);
  await upsertAlert("GLOBALGAP_EXPIRING", settings.id, "QUALITY", message);
}

// Facility-level certifications (BRCGS, SMETA, FDA, Kosher, etc.) -- one
// check per row, same warning window as GlobalG.A.P. above.
async function checkCertificationExpiry() {
  const certifications = await prisma.certification.findMany();

  for (const cert of certifications) {
    const daysLeft = differenceInDays(cert.validTo, new Date());
    if (daysLeft > CERTIFICATION_EXPIRY_WARNING_DAYS) continue;

    const message =
      daysLeft < 0
        ? `${cert.name} certification expired ${Math.abs(daysLeft)} day(s) ago.`
        : `${cert.name} certification expires in ${daysLeft} day(s).`;

    await upsertAlert("CERTIFICATION_EXPIRING", cert.id, "OWNER", message);
    await upsertAlert("CERTIFICATION_EXPIRING", cert.id, "QUALITY", message);
  }
}

// A pallet pulled aside just to reach others behind it (see PalletPullAside)
// is easy to forget once the shift that pulled it is over -- this is the
// same "don't let it silently fall through the cracks" pattern as every
// other upsertAlert check here, not a discrete one-off event, so it keeps
// firing (deduped) for as long as the pallet stays un-reshelved.
async function checkPalletsAwaitingReshelf() {
  const pending = await prisma.palletPullAside.findMany({
    where: { resolvedAt: null },
    include: { pallet: true, coldRoom: true },
  });

  for (const p of pending) {
    const hoursAgo = Math.round((Date.now() - p.pulledAt.getTime()) / (1000 * 60 * 60));
    const message = `${p.pallet.palletNumber} was pulled aside from ${p.coldRoom.name} Round ${p.round} / Rack ${p.rack} ${hoursAgo} hour(s) ago and hasn't been re-shelved yet.`;
    await upsertAlert("PALLET_AWAITING_RESHELVE", p.id, "OWNER", message);
    await upsertAlert("PALLET_AWAITING_RESHELVE", p.id, "LOGISTICS", message);
  }
}

// A packaging material either sitting at/under its set minimum, or -- where
// a consumption ratio is on file -- projected to run out within a few days
// at the current production pace. Same ongoing-condition pattern as
// checkPalletsAwaitingReshelf: keeps re-firing (deduped) for as long as the
// condition holds.
async function checkPackagingLowStock() {
  const factories = await prisma.factory.findMany();

  for (const factory of factories) {
    const warnings = await getPackagingLowStockWarnings(factory.id);
    for (const w of warnings) {
      const message =
        w.reason === "BELOW_MINIMUM"
          ? `${w.material.name} (${factory.name}) is at ${w.closingBalance}${w.material.unit ? ` ${w.material.unit}` : ""}, at or below its minimum stock level of ${w.material.minStockLevel}.`
          : `${w.material.name} (${factory.name}) is projected to run out in ${w.daysOfStockLeft!.toFixed(1)} day(s) at the current production pace (${w.closingBalance}${w.material.unit ? ` ${w.material.unit}` : ""} on hand).`;
      await upsertAlert("PACKAGING_LOW_STOCK", w.material.id, "OWNER", message);
      await upsertAlert("PACKAGING_LOW_STOCK", w.material.id, "PRODUCTION", message);
    }
  }
}
