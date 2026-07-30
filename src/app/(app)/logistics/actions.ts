"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { raiseMicrobiologyLoadAttemptAlert, raiseTemperatureExcursionAlert } from "@/lib/alerts";
import { combinedMicroStatus, isMicroCleared } from "@/lib/microbiology";

const containerSchema = z.object({
  orderId: z.string().min(1),
  containerNumber: z.string().min(1),
  carrier: z.string().optional(),
  departurePort: z.string().optional(),
  destinationPort: z.string().optional(),
  departureDate: z.string().optional(),
  expectedTransitDays: z.coerce.number().int().positive().optional(),
  trackingProvider: z.string().optional(),
  trackingRef: z.string().optional(),
  sealNumber: z.string().optional(),
  billOfLadingNumber: z.string().optional(),
});

export async function createContainerAction(_prevState: string | undefined, formData: FormData) {
  const parsed = containerSchema.safeParse({
    orderId: formData.get("orderId"),
    containerNumber: formData.get("containerNumber"),
    carrier: formData.get("carrier") || undefined,
    departurePort: formData.get("departurePort") || undefined,
    destinationPort: formData.get("destinationPort") || undefined,
    departureDate: formData.get("departureDate") || undefined,
    expectedTransitDays: formData.get("expectedTransitDays") || undefined,
    trackingProvider: formData.get("trackingProvider") || undefined,
    trackingRef: formData.get("trackingRef") || undefined,
    sealNumber: formData.get("sealNumber") || undefined,
    billOfLadingNumber: formData.get("billOfLadingNumber") || undefined,
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

  const container = await prisma.container.create({
    data: {
      ...parsed.data,
      containerNumber,
      departureDate: parsed.data.departureDate ? new Date(parsed.data.departureDate) : undefined,
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
  revalidatePath(`/logistics/${containerId}`);
  revalidatePath("/logistics");
}

const exportDocumentsSchema = z.object({
  phytosanitaryCertNumber: z.string().optional(),
  certificateOfOriginNumber: z.string().optional(),
  customsExportDeclarationNumber: z.string().optional(),
});

export async function updateExportDocumentsAction(containerId: string, formData: FormData) {
  const parsed = exportDocumentsSchema.parse({
    phytosanitaryCertNumber: formData.get("phytosanitaryCertNumber") || undefined,
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
    include: { lot: { include: { microbiologyResults: true, shift: true } } },
  });
  const lines = await prisma.containerPalletLine.findMany({ where: { palletId } });
  const loaded = lines.reduce((s, l) => s + l.quantityTonnes, 0);
  return { pallet, remaining: pallet.weightTonnes - loaded };
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

  const microStatus = combinedMicroStatus(pallet.lot.microbiologyResults, pallet.lot.shift.onHold);
  if (!isMicroCleared(pallet.lot.microbiologyResults, pallet.lot.shift.onHold)) {
    const container = await prisma.container.findUniqueOrThrow({ where: { id: containerId } });
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

  if (pallet.stickeringRequired && !pallet.stickeringCompletedAt) {
    return "This pallet needs stickering before it can be loaded.";
  }
  if (parsed.data.quantityTonnes > remaining + ROUNDING_TOLERANCE_TONNES) {
    return `Only ${remaining.toFixed(2)}t remaining on this pallet.`;
  }

  await prisma.containerPalletLine.create({
    data: {
      containerId,
      palletId: parsed.data.palletId,
      quantityTonnes: parsed.data.quantityTonnes,
      loadingStart: new Date(),
    },
  });

  const stillRemaining = remaining - parsed.data.quantityTonnes;
  if (stillRemaining <= ROUNDING_TOLERANCE_TONNES) {
    await prisma.pallet.update({ where: { id: pallet.id }, data: { status: "SHIPPED" } });
  }

  revalidatePath(`/logistics/${containerId}`);
  revalidatePath(`/storage/${pallet.id}`);
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
  revalidatePath(`/logistics/${containerId}`);
}

export async function signQualityRepAction(containerId: string, formData: FormData) {
  const name = String(formData.get("qualityRepName") ?? "").trim();
  if (!name) return;
  await prisma.container.update({
    where: { id: containerId },
    data: { qualityRepName: name, qualitySignedAt: new Date() },
  });
  revalidatePath(`/logistics/${containerId}`);
}
