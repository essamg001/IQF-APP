"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { raiseMicrobiologyLoadAttemptAlert } from "@/lib/alerts";
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
  });
  if (!parsed.success) {
    return parsed.error.issues[0]?.message ?? "Invalid input.";
  }

  const existing = await prisma.container.findUnique({ where: { containerNumber: parsed.data.containerNumber } });
  if (existing) return "A container with this number already exists.";

  const container = await prisma.container.create({
    data: {
      ...parsed.data,
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
const MAX_LOTS_PER_CONTAINER = 2;

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

  // Grade A containers may only mix cartons from up to 2 lots. Grade B is exempt —
  // daily 2nd-grade volume is small enough that a container legitimately needs many days' lots.
  if (pallet.lot.grade !== "B") {
    const existingLines = await prisma.containerPalletLine.findMany({
      where: { containerId },
      include: { pallet: { select: { lotId: true } } },
    });
    const existingLotIds = new Set(existingLines.map((l) => l.pallet.lotId));
    if (!existingLotIds.has(pallet.lotId) && existingLotIds.size >= MAX_LOTS_PER_CONTAINER) {
      return `This container already has ${MAX_LOTS_PER_CONTAINER} different lots — Grade A containers can't mix more than that.`;
    }
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
