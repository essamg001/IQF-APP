"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { raiseMicrobiologyLoadAttemptAlert, raiseCfuLimitLoadAttemptAlert, raiseSpecExceptionAlert, raiseTemperatureExcursionAlert } from "@/lib/alerts";
import { combinedMicroStatus, isMicroCleared } from "@/lib/microbiology";
import { combinedCfuValue, exceedsClientLimit } from "@/lib/cfuTier";
import {
  evaluateSpecCompliance,
  violatedSpecRows,
  encodeSpecBlock,
  type SpecComplianceRow,
} from "@/lib/specCompliance";
import { logActivity } from "@/lib/activityLog";
import { canSeeContainerValue, canSignSpecException } from "@/lib/roles";

const containerSchema = z.object({
  orderId: z.string().min(1),
  containerNumber: z.string().min(1),
  carrier: z.string().optional(),
  vesselName: z.string().optional(),
  voyageNumber: z.string().optional(),
  bookingNumber: z.string().optional(),
  departurePort: z.string().optional(),
  destinationPort: z.string().optional(),
  destinationCountry: z.string().optional(),
  departureDate: z.string().optional(),
  expectedTransitDays: z.coerce.number().int().positive().optional(),
  trackingProvider: z.string().optional(),
  trackingRef: z.string().optional(),
  sealNumber: z.string().optional(),
  billOfLadingNumber: z.string().optional(),
  loadType: z.enum(["PALLETISED", "UNPALLETISED"]).optional(),
  // A checkbox, not a free-entry temperature -- IQF frozen product is
  // essentially always -18°C, so this is a one-click confirmation rather
  // than making every container creation retype the same number. A shipment
  // that genuinely needs a different set-point still gets it via the
  // container page's own Reefer Temperature field (unchanged, still a plain
  // number so it can be overridden).
  reeferConfirmed: z.boolean(),
});

const STANDARD_REEFER_SET_POINT_C = -18;

export async function createContainerAction(_prevState: string | undefined, formData: FormData) {
  const parsed = containerSchema.safeParse({
    orderId: formData.get("orderId"),
    containerNumber: formData.get("containerNumber"),
    carrier: formData.get("carrier") || undefined,
    vesselName: formData.get("vesselName") || undefined,
    voyageNumber: formData.get("voyageNumber") || undefined,
    bookingNumber: formData.get("bookingNumber") || undefined,
    departurePort: formData.get("departurePort") || undefined,
    destinationPort: formData.get("destinationPort") || undefined,
    destinationCountry: formData.get("destinationCountry") || undefined,
    departureDate: formData.get("departureDate") || undefined,
    expectedTransitDays: formData.get("expectedTransitDays") || undefined,
    trackingProvider: formData.get("trackingProvider") || undefined,
    trackingRef: formData.get("trackingRef") || undefined,
    sealNumber: formData.get("sealNumber") || undefined,
    billOfLadingNumber: formData.get("billOfLadingNumber") || undefined,
    loadType: formData.get("loadType") || undefined,
    reeferConfirmed: formData.get("reeferConfirmed") === "on",
  });
  if (!parsed.success) {
    return parsed.error.issues[0]?.message ?? "Invalid input.";
  }

  // Normalized so "msku1234567" and "MSKU1234567" aren't treated as two
  // different containers, and so it always displays in the standard ISO 6346
  // format used on the bill of lading, customs paperwork, and the carrier's
  // own tracking site.
  const containerNumber = parsed.data.containerNumber.trim().toUpperCase();

  const existing = await prisma.container.findUnique({ where: { containerNumber } });
  if (existing) return "A container with this number already exists.";

  const { reeferConfirmed, ...rest } = parsed.data;
  const container = await prisma.container.create({
    data: {
      ...rest,
      containerNumber,
      departureDate: parsed.data.departureDate ? new Date(parsed.data.departureDate) : undefined,
      reeferSetPointC: reeferConfirmed ? STANDARD_REEFER_SET_POINT_C : undefined,
    },
  });

  revalidatePath("/logistics");
  redirect(`/logistics/${container.id}`);
}

const updateStatusSchema = z.object({
  currentLocation: z.string().optional(),
});

export async function updateContainerLocationAction(containerId: string, formData: FormData) {
  const parsed = updateStatusSchema.parse({
    currentLocation: formData.get("currentLocation") || undefined,
  });
  await prisma.container.update({ where: { id: containerId }, data: parsed });

  const session = await auth();
  await logActivity({
    actorId: session?.user.id,
    action: "CONTAINER_LOCATION_UPDATED",
    entityType: "Container",
    entityId: containerId,
    detail: parsed.currentLocation,
  });

  revalidatePath(`/logistics/${containerId}`);
  revalidatePath("/logistics");
}

const shipmentDetailsSchema = z.object({
  carrier: z.string().optional(),
  vesselName: z.string().optional(),
  voyageNumber: z.string().optional(),
  bookingNumber: z.string().optional(),
  departurePort: z.string().optional(),
  destinationPort: z.string().optional(),
  destinationCountry: z.string().optional(),
  departureDate: z.string().optional(),
  expectedTransitDays: z.coerce.number().int().positive().optional(),
  trackingProvider: z.string().optional(),
  trackingRef: z.string().optional(),
  sealNumber: z.string().optional(),
  billOfLadingNumber: z.string().optional(),
});

// Seal number and bill of lading number in particular are usually only known
// a few days after the vessel actually departs (the carrier issues the B/L
// after the fact), so the whole shipment-details block needs to stay
// editable well after the container record was first created, not just set
// once at creation time.
export async function updateShipmentDetailsAction(containerId: string, formData: FormData) {
  const parsed = shipmentDetailsSchema.parse({
    carrier: formData.get("carrier") || undefined,
    vesselName: formData.get("vesselName") || undefined,
    voyageNumber: formData.get("voyageNumber") || undefined,
    bookingNumber: formData.get("bookingNumber") || undefined,
    departurePort: formData.get("departurePort") || undefined,
    destinationPort: formData.get("destinationPort") || undefined,
    destinationCountry: formData.get("destinationCountry") || undefined,
    departureDate: formData.get("departureDate") || undefined,
    expectedTransitDays: formData.get("expectedTransitDays") || undefined,
    trackingProvider: formData.get("trackingProvider") || undefined,
    trackingRef: formData.get("trackingRef") || undefined,
    sealNumber: formData.get("sealNumber") || undefined,
    billOfLadingNumber: formData.get("billOfLadingNumber") || undefined,
  });
  const { departureDate, ...rest } = parsed;
  await prisma.container.update({
    where: { id: containerId },
    data: { ...rest, departureDate: departureDate ? new Date(departureDate) : undefined },
  });

  const session = await auth();
  await logActivity({
    actorId: session?.user.id,
    action: "CONTAINER_SHIPMENT_DETAILS_UPDATED",
    entityType: "Container",
    entityId: containerId,
  });

  revalidatePath(`/logistics/${containerId}`);
  revalidatePath("/logistics");
}

const exportDocumentsSchema = z.object({
  nafezaInspectionRequestRef: z.string().optional(),
  bolsaPermitNumber: z.string().optional(),
  phytosanitaryCertNumber: z.string().optional(),
  nfsaHealthCertNumber: z.string().optional(),
  fumigationCertNumber: z.string().optional(),
  certificateOfOriginNumber: z.string().optional(),
  customsExportDeclarationNumber: z.string().optional(),
});

export async function updateExportDocumentsAction(containerId: string, formData: FormData) {
  const parsed = exportDocumentsSchema.parse({
    nafezaInspectionRequestRef: formData.get("nafezaInspectionRequestRef") || undefined,
    bolsaPermitNumber: formData.get("bolsaPermitNumber") || undefined,
    phytosanitaryCertNumber: formData.get("phytosanitaryCertNumber") || undefined,
    nfsaHealthCertNumber: formData.get("nfsaHealthCertNumber") || undefined,
    fumigationCertNumber: formData.get("fumigationCertNumber") || undefined,
    certificateOfOriginNumber: formData.get("certificateOfOriginNumber") || undefined,
    customsExportDeclarationNumber: formData.get("customsExportDeclarationNumber") || undefined,
  });
  await prisma.container.update({ where: { id: containerId }, data: parsed });
  revalidatePath(`/logistics/${containerId}`);
}

const reeferSetPointSchema = z.object({
  reeferSetPointC: z.coerce.number().optional(),
});

export async function updateReeferSetPointAction(containerId: string, formData: FormData) {
  const parsed = reeferSetPointSchema.parse({
    reeferSetPointC: formData.get("reeferSetPointC") || undefined,
  });
  await prisma.container.update({ where: { id: containerId }, data: parsed });
  revalidatePath(`/logistics/${containerId}`);
}

// A reading is compared against the container's own set-point at the time
// it's logged, not stored as its own pass/fail flag -- so correcting the
// set-point later doesn't retroactively change what counted as an excursion.
const TEMPERATURE_EXCURSION_TOLERANCE_C = 2;

const temperatureReadingSchema = z.object({
  temperatureC: z.coerce.number(),
  recordedAt: z.string().optional(),
  notes: z.string().optional(),
});

export async function addTemperatureReadingAction(
  containerId: string,
  _prevState: string | undefined,
  formData: FormData
) {
  const parsed = temperatureReadingSchema.safeParse({
    temperatureC: formData.get("temperatureC"),
    recordedAt: formData.get("recordedAt") || undefined,
    notes: formData.get("notes") || undefined,
  });
  if (!parsed.success) return parsed.error.issues[0]?.message ?? "Invalid input.";

  const container = await prisma.container.findUniqueOrThrow({ where: { id: containerId } });
  const { recordedAt, ...data } = parsed.data;

  await prisma.containerTemperatureLog.create({
    data: { ...data, containerId, recordedAt: recordedAt ? new Date(recordedAt) : undefined },
  });

  if (container.reeferSetPointC != null && Math.abs(data.temperatureC - container.reeferSetPointC) > TEMPERATURE_EXCURSION_TOLERANCE_C) {
    await raiseTemperatureExcursionAlert({
      containerId,
      containerNumber: container.containerNumber,
      temperatureC: data.temperatureC,
      setPointC: container.reeferSetPointC,
    });
  }

  revalidatePath(`/logistics/${containerId}`);
  return "ok";
}

const containerValueSchema = z.object({
  pricePerKgUsd: z.coerce.number().nonnegative().optional(),
  pricePerCartonUsd: z.coerce.number().nonnegative().optional(),
});

export async function updateContainerValueAction(containerId: string, formData: FormData) {
  const session = await auth();
  if (!canSeeContainerValue(session?.user)) return;

  const parsed = containerValueSchema.parse({
    pricePerKgUsd: formData.get("pricePerKgUsd") || undefined,
    pricePerCartonUsd: formData.get("pricePerCartonUsd") || undefined,
  });
  await prisma.container.update({ where: { id: containerId }, data: parsed });
  revalidatePath(`/logistics/${containerId}`);
  revalidatePath("/logistics");
}

const containerCostSchema = z.object({
  category: z.enum(["DEMURRAGE", "DETENTION", "STORAGE", "CUSTOMS_DELAY", "DOCUMENTATION", "INSPECTION", "REROUTING", "OTHER"]),
  amountUsd: z.coerce.number().positive(),
  description: z.string().optional(),
  incurredAt: z.string().optional(),
});

export async function addContainerCostAction(containerId: string, _prevState: string | undefined, formData: FormData) {
  const parsed = containerCostSchema.safeParse({
    category: formData.get("category"),
    amountUsd: formData.get("amountUsd"),
    description: formData.get("description") || undefined,
    incurredAt: formData.get("incurredAt") || undefined,
  });
  if (!parsed.success) return parsed.error.issues[0]?.message ?? "Invalid input.";

  const { incurredAt, ...data } = parsed.data;
  await prisma.containerCost.create({
    data: { ...data, containerId, incurredAt: incurredAt ? new Date(incurredAt) : undefined },
  });
  revalidatePath(`/logistics/${containerId}`);
  revalidatePath("/logistics");
  return "ok";
}

export async function removeContainerCostAction(containerId: string, costId: string) {
  await prisma.containerCost.delete({ where: { id: costId } });
  revalidatePath(`/logistics/${containerId}`);
  revalidatePath("/logistics");
}

const loadingDetailsSchema = z.object({
  loadingDate: z.string().optional(),
  loadingLocation: z.string().optional(),
  loadingSupervisor: z.string().optional(),
  loadType: z.enum(["PALLETISED", "UNPALLETISED"]).optional(),
});

export async function updateLoadingDetailsAction(containerId: string, formData: FormData) {
  const parsed = loadingDetailsSchema.parse({
    loadingDate: formData.get("loadingDate") || undefined,
    loadingLocation: formData.get("loadingLocation") || undefined,
    loadingSupervisor: formData.get("loadingSupervisor") || undefined,
    loadType: formData.get("loadType") || undefined,
  });
  await prisma.container.update({
    where: { id: containerId },
    data: {
      loadingLocation: parsed.loadingLocation,
      loadingSupervisor: parsed.loadingSupervisor,
      loadingDate: parsed.loadingDate ? new Date(parsed.loadingDate) : undefined,
      loadType: parsed.loadType,
    },
  });
  revalidatePath(`/logistics/${containerId}`);
}

const ROUNDING_TOLERANCE_TONNES = 0.01;

async function palletWithRemaining(palletId: string) {
  const pallet = await prisma.pallet.findUniqueOrThrow({
    where: { id: palletId },
    include: {
      lot: { include: { microbiologyResults: true, shift: true, qualityChecks: true } },
      qualityChecks: true,
    },
  });
  const lines = await prisma.containerPalletLine.findMany({ where: { palletId } });
  const loaded = lines.reduce((s, l) => s + l.quantityTonnes, 0);
  return { pallet, remaining: pallet.weightTonnes - loaded };
}

/** The pallet's own POST_PACKAGING check, falling back to the lot's latest one -- same lookup as src/lib/palletQuality.ts. */
function latestPostPackagingCheck(pallet: Awaited<ReturnType<typeof palletWithRemaining>>["pallet"]) {
  const ownCheck = pallet.qualityChecks
    .filter((c) => c.checkpoint === "POST_PACKAGING")
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
  if (ownCheck) return ownCheck;
  return pallet.lot.qualityChecks
    .filter((c) => c.checkpoint === "POST_PACKAGING" && !c.palletId)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
}

function formatMeasured(row: SpecComplianceRow): string {
  if (row.measuredValue == null) return "—";
  return row.measuredUnit === "°Bx" ? `${row.measuredValue} °Bx` : `${row.measuredValue} ${row.measuredUnit}`;
}

async function createLoadLine(containerId: string, palletId: string, remaining: number, quantityTonnes: number) {
  if (quantityTonnes > remaining + ROUNDING_TOLERANCE_TONNES) {
    return `Only ${remaining.toFixed(2)}t remaining on this pallet.`;
  }

  await prisma.containerPalletLine.create({
    data: { containerId, palletId, quantityTonnes, loadingStart: new Date() },
  });

  const stillRemaining = remaining - quantityTonnes;
  if (stillRemaining <= ROUNDING_TOLERANCE_TONNES) {
    await prisma.pallet.update({ where: { id: palletId }, data: { status: "SHIPPED" } });
  }

  revalidatePath(`/logistics/${containerId}`);
  revalidatePath(`/storage/${palletId}`);
  return "ok";
}

const addLoadLineSchema = z.object({
  palletId: z.string().min(1),
  quantityTonnes: z.coerce.number().positive(),
});

export async function addPalletLoadLineAction(
  containerId: string,
  _prevState: string | undefined,
  formData: FormData
) {
  const parsed = addLoadLineSchema.safeParse({
    palletId: formData.get("palletId"),
    quantityTonnes: formData.get("quantityTonnes"),
  });
  if (!parsed.success) return parsed.error.issues[0]?.message ?? "Invalid input.";

  const { pallet, remaining } = await palletWithRemaining(parsed.data.palletId);

  const container = await prisma.container.findUniqueOrThrow({
    where: { id: containerId },
    include: { order: { include: { client: { include: { specs: true } } } } },
  });

  const microStatus = combinedMicroStatus(pallet.lot.microbiologyResults, pallet.lot.shift.onHold);
  if (!isMicroCleared(pallet.lot.microbiologyResults, pallet.lot.shift.onHold)) {
    await raiseMicrobiologyLoadAttemptAlert({
      palletId: pallet.id,
      palletNumber: pallet.palletNumber,
      lotNumber: pallet.lot.lotNumber,
      containerNumber: container.containerNumber,
      microStatus,
    });
    const statusLabel = microStatus === "ON_HOLD" ? "shift on hold — split microbiology result" : microStatus.replace("_", " ");
    return `Blocked: Lot ${pallet.lot.lotNumber} has not cleared microbiology (both labs required — status: ${statusLabel}). Quality has been alerted.`;
  }

  // Lab-Approved isn't the same as "fits this client" -- a pallet can pass
  // the pass/fail gate above and still carry a cfu/g reading above this
  // specific client's own spec ceiling (see src/lib/cfuTier.ts), which would
  // make the shipment fully rejected on arrival rather than just discounted.
  const spec = container.order.client.specs.find((s) => s.grade === pallet.lot.grade && s.format === pallet.lot.format);
  const cfuValue = combinedCfuValue(pallet.lot.microbiologyResults);
  if (cfuValue != null && exceedsClientLimit(cfuValue, spec?.maxCfuPerGram)) {
    await raiseCfuLimitLoadAttemptAlert({
      palletId: pallet.id,
      palletNumber: pallet.palletNumber,
      lotNumber: pallet.lot.lotNumber,
      containerNumber: container.containerNumber,
      clientName: container.order.client.name,
      cfuValue,
      maxCfuPerGram: spec!.maxCfuPerGram!,
    });
    return `Blocked: Lot ${pallet.lot.lotNumber} has a Total Plate Count of ${cfuValue.toLocaleString()} cfu/g, above ${container.order.client.name}'s spec limit of ${spec!.maxCfuPerGram!.toLocaleString()} cfu/g. This pallet would be rejected on arrival.`;
  }

  // Brix and every defect tolerance the client's spec sheet actually states a
  // parseable ceiling for (see src/lib/specCompliance.ts) -- same principle
  // as the cfu/g check above, just covering every parameter, not just one.
  // Existing SpecException rows mean someone already signed off on exactly
  // this pallet/container/parameter, so those don't block again.
  const check = latestPostPackagingCheck(pallet);
  const violations = violatedSpecRows(evaluateSpecCompliance(check ?? null, spec ?? null));
  if (violations.length > 0) {
    const existingExceptions = await prisma.specException.findMany({
      where: { palletId: pallet.id, containerId },
    });
    const unresolved = violations.filter((v) => !existingExceptions.some((e) => e.parameter === v.key));
    if (unresolved.length > 0) {
      await raiseSpecExceptionAlert({
        stage: "attempt",
        palletId: pallet.id,
        palletNumber: pallet.palletNumber,
        lotNumber: pallet.lot.lotNumber,
        containerNumber: container.containerNumber,
        clientName: container.order.client.name,
        violations: unresolved.map((v) => `${v.label} ${formatMeasured(v)} (spec: ${v.specLimitDisplay ?? "—"})`),
      });
      return encodeSpecBlock({
        palletId: pallet.id,
        palletNumber: pallet.palletNumber,
        lotNumber: pallet.lot.lotNumber,
        containerId,
        quantityTonnes: parsed.data.quantityTonnes,
        clientName: container.order.client.name,
        violations: unresolved.map((v) => ({
          key: v.key,
          label: v.label,
          measuredDisplay: formatMeasured(v),
          specLimitDisplay: v.specLimitDisplay ?? "—",
        })),
      });
    }
  }

  if (pallet.stickeringRequired && !pallet.stickeringCompletedAt) {
    return "This pallet needs stickering before it can be loaded.";
  }

  return createLoadLine(containerId, pallet.id, remaining, parsed.data.quantityTonnes);
}

const overrideSpecExceptionSchema = z.object({
  palletId: z.string().min(1),
  containerId: z.string().min(1),
  quantityTonnes: z.coerce.number().positive(),
  violationsJson: z.string().min(1),
  name: z.string().min(1, "Your name is required."),
  signature: z.string().min(1, "Signature is required."),
  note: z.string().optional(),
});

/**
 * Signs off loading a pallet that fails one or more of the destination
 * client's spec parameters -- gated to the Owner or whoever holds
 * User.isHeadOfProduction, so the accountability this exists for (see
 * SpecException) actually means something. Writes one SpecException row per
 * overridden parameter, then loads the pallet in the same step so the
 * load-out worker doesn't have to re-submit.
 */
export async function overrideSpecExceptionAction(_prevState: string | undefined, formData: FormData) {
  const session = await auth();
  if (!canSignSpecException(session?.user)) {
    return "Only the Owner or a Head of Production can sign off an out-of-spec load.";
  }

  const parsed = overrideSpecExceptionSchema.safeParse({
    palletId: formData.get("palletId"),
    containerId: formData.get("containerId"),
    quantityTonnes: formData.get("quantityTonnes"),
    violationsJson: formData.get("violationsJson"),
    name: formData.get("name"),
    signature: formData.get("signature"),
    note: formData.get("note") || undefined,
  });
  if (!parsed.success) return parsed.error.issues[0]?.message ?? "Invalid input.";

  let violations: { key: string; label: string; measuredDisplay: string; specLimitDisplay: string }[] = [];
  try {
    violations = JSON.parse(parsed.data.violationsJson);
  } catch {
    return "Could not read the violation details -- please retry the load.";
  }
  if (violations.length === 0) return "No violations to sign off.";

  const { pallet, remaining } = await palletWithRemaining(parsed.data.palletId);
  const container = await prisma.container.findUniqueOrThrow({
    where: { id: parsed.data.containerId },
    include: { order: { include: { client: true } } },
  });

  await prisma.specException.createMany({
    data: violations.map((v) => ({
      palletId: parsed.data.palletId,
      containerId: parsed.data.containerId,
      parameter: v.key,
      parameterLabel: v.label,
      measuredValue: v.measuredDisplay,
      specLimit: v.specLimitDisplay,
      approvedByName: parsed.data.name,
      approvedSignature: parsed.data.signature,
      note: parsed.data.note,
    })),
  });

  await raiseSpecExceptionAlert({
    stage: "signed",
    palletId: pallet.id,
    palletNumber: pallet.palletNumber,
    lotNumber: pallet.lot.lotNumber,
    containerNumber: container.containerNumber,
    clientName: container.order.client.name,
    violations: violations.map((v) => `${v.label} ${v.measuredDisplay} (spec: ${v.specLimitDisplay})`),
    approvedByName: parsed.data.name,
    note: parsed.data.note,
  });

  await logActivity({
    actorId: session?.user.id,
    action: "SPEC_EXCEPTION_APPROVED",
    entityType: "Pallet",
    entityId: pallet.id,
    detail: `${parsed.data.name} signed off loading ${pallet.palletNumber} into ${container.containerNumber} despite: ${violations.map((v) => v.label).join(", ")}${parsed.data.note ? ` — ${parsed.data.note}` : ""}`,
  });

  return createLoadLine(parsed.data.containerId, parsed.data.palletId, remaining, parsed.data.quantityTonnes);
}

export async function completeLoadLineAction(containerId: string, lineId: string) {
  const line = await prisma.containerPalletLine.findUniqueOrThrow({ where: { id: lineId } });
  await prisma.containerPalletLine.update({
    where: { id: lineId },
    data: { loadingEnd: new Date(), loadingStart: line.loadingStart ?? new Date() },
  });
  revalidatePath(`/logistics/${containerId}`);
}

export async function removePalletLoadLineAction(containerId: string, lineId: string) {
  const line = await prisma.containerPalletLine.findUniqueOrThrow({ where: { id: lineId } });
  await prisma.containerPalletLine.delete({ where: { id: lineId } });

  const { remaining } = await palletWithRemaining(line.palletId);
  if (remaining > ROUNDING_TOLERANCE_TONNES) {
    await prisma.pallet.update({ where: { id: line.palletId }, data: { status: "ALLOCATED" } });
  }

  revalidatePath(`/logistics/${containerId}`);
  revalidatePath(`/storage/${line.palletId}`);
}

export async function toggleStickeringRequiredAction(containerId: string, palletId: string) {
  const pallet = await prisma.pallet.findUniqueOrThrow({ where: { id: palletId } });
  await prisma.pallet.update({
    where: { id: palletId },
    data: { stickeringRequired: !pallet.stickeringRequired },
  });
  revalidatePath(`/logistics/${containerId}`);
  revalidatePath(`/storage/${palletId}`);
}

export async function markStickeringCompleteAction(containerId: string, palletId: string) {
  await prisma.pallet.update({
    where: { id: palletId },
    data: { stickeringCompletedAt: new Date() },
  });
  revalidatePath(`/logistics/${containerId}`);
  revalidatePath(`/storage/${palletId}`);
}

export async function signLoadOutRepAction(containerId: string, formData: FormData) {
  const name = String(formData.get("loadOutRepName") ?? "").trim();
  if (!name) return;
  await prisma.container.update({
    where: { id: containerId },
    data: { loadOutRepName: name, loadOutSignedAt: new Date() },
  });
  const session = await auth();
  await logActivity({
    actorId: session?.user.id,
    action: "LOAD_OUT_SIGNED",
    entityType: "Container",
    entityId: containerId,
    detail: name,
  });
  revalidatePath(`/logistics/${containerId}`);
}

export async function signQualityRepAction(containerId: string, formData: FormData) {
  const name = String(formData.get("qualityRepName") ?? "").trim();
  if (!name) return;
  await prisma.container.update({
    where: { id: containerId },
    data: { qualityRepName: name, qualitySignedAt: new Date() },
  });
  const session = await auth();
  await logActivity({
    actorId: session?.user.id,
    action: "QUALITY_SIGNED",
    entityType: "Container",
    entityId: containerId,
    detail: name,
  });
  revalidatePath(`/logistics/${containerId}`);
}
