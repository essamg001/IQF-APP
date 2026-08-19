"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { parseDateSafe } from "@/lib/dates";
import { activeRestriction, sprayClearDate } from "@/lib/fieldSpray";
import { raiseSprayRestrictionBlockedAlert } from "@/lib/alerts";
import { z } from "zod";

const plotLineSchema = z.object({
  stationNo: z.string().optional(),
  plotValveGhNo: z.string().optional(),
  varietyName: z.string().optional(),
  cycleNumber: z.string().optional(),
  plantingYear: z.string().optional(),
  cutNo: z.string().optional(),
  palletsCount: z.coerce.number().int().min(0).optional(),
  cratesCount: z.coerce.number().int().min(0).optional(),
  weightKg: z.coerce.number().min(0).optional(),
});

const complianceLevels = ["GLOBALGAP", "SPRING", "LEAF", "OTHER", "NURTURE", "AH_DL_GROW", "FAIRTRADE", "ORGANIC_100", "BIO_SUISSE"] as const;

const ticketSchema = z.object({
  serialNumber: z.string().min(1, "Serial number is required."),
  ggn: z.string().optional(),
  complianceLevel: z.enum(complianceLevels).optional(),
  complianceOther: z.string().optional(),
  productType: z.enum(["RAW", "FINAL", "REWORK"]).optional(),
  reworkReason: z.string().optional(),

  fruitConformityOk: z.boolean(),
  fruitSafetyOk: z.boolean(),
  cratesCleanlinessOk: z.boolean(),
  fieldCleanlinessOk: z.boolean(),
  vehicleCleanlinessOk: z.boolean(),

  petsPresent: z.boolean(),
  petsPresentAction: z.string().optional(),
  animalProductionNearby: z.boolean(),
  animalProductionNearbyAction: z.string().optional(),
  wildDomesticAnimalActivity: z.boolean(),
  wildDomesticAnimalActivityAction: z.string().optional(),
  rodentDogActivity: z.boolean(),
  rodentDogActivityAction: z.string().optional(),

  loadingSupervisor: z.string().optional(),
  loadingTime: z.string().optional(),
  transferredBy: z.string().optional(),
  vehicleNo: z.string().optional(),
  authorizedGrower: z.string().optional(),
  cropName: z.string().optional(),
  harvestTime: z.string().optional(),
  harvestSupervisor: z.string().optional(),
  harvestDate: z.string().optional(),

  plotLines: z.array(plotLineSchema),
});

export async function createHarvestTicketAction(_prevState: string | undefined, formData: FormData) {
  const raw = Object.fromEntries(
    Array.from(formData.entries()).map(([k, v]) => [k, v === "" ? undefined : v])
  );

  let plotLines: unknown = [];
  try {
    plotLines = raw.plotLinesJson ? JSON.parse(String(raw.plotLinesJson)) : [];
  } catch {
    plotLines = [];
  }

  const parsed = ticketSchema.safeParse({
    ...raw,
    fruitConformityOk: formData.get("fruitConformityOk") === "on",
    fruitSafetyOk: formData.get("fruitSafetyOk") === "on",
    cratesCleanlinessOk: formData.get("cratesCleanlinessOk") === "on",
    fieldCleanlinessOk: formData.get("fieldCleanlinessOk") === "on",
    vehicleCleanlinessOk: formData.get("vehicleCleanlinessOk") === "on",
    petsPresent: formData.get("petsPresent") === "on",
    animalProductionNearby: formData.get("animalProductionNearby") === "on",
    wildDomesticAnimalActivity: formData.get("wildDomesticAnimalActivity") === "on",
    rodentDogActivity: formData.get("rodentDogActivity") === "on",
    plotLines,
  });
  if (!parsed.success) {
    return parsed.error.issues[0]?.message ?? "Invalid input.";
  }

  const existing = await prisma.harvestTicket.findUnique({ where: { serialNumber: parsed.data.serialNumber.trim() } });
  if (existing) return `Harvest ticket ${parsed.data.serialNumber} already exists.`;

  // Resolve each plot line against the real Field table where possible, by
  // matching station + valve -- best-effort, since harvest tickets may use
  // slightly different plot naming than the GIS-derived Field records.
  const fields = await prisma.field.findMany();
  const resolveField = (stationNo?: string, plotValveGhNo?: string) => {
    if (!stationNo || !plotValveGhNo) return undefined;
    const match = fields.find(
      (f) =>
        f.station?.replace(/^st/i, "").trim() === stationNo.replace(/^st/i, "").trim() &&
        f.valve?.trim().toLowerCase() === plotValveGhNo.trim().toLowerCase()
    );
    return match?.id;
  };

  const { loadingTime, harvestTime, harvestDate, plotLines: lines, ...data } = parsed.data;

  const filteredLines = lines.filter((l) => l.stationNo || l.plotValveGhNo || l.varietyName);
  const resolvedFieldIds = [
    ...new Set(
      filteredLines.map((l) => resolveField(l.stationNo, l.plotValveGhNo)).filter((id): id is string => !!id)
    ),
  ];

  if (resolvedFieldIds.length > 0) {
    const sprays = await prisma.fieldSprayRecord.findMany({
      where: { fieldId: { in: resolvedFieldIds } },
      include: { field: true },
    });
    for (const fieldId of resolvedFieldIds) {
      const restriction = activeRestriction(sprays.filter((s) => s.fieldId === fieldId));
      if (!restriction) continue;
      const clearDate = sprayClearDate(restriction);
      await raiseSprayRestrictionBlockedAlert({
        fieldId,
        fieldName: restriction.field.name,
        harvestTicketSerial: parsed.data.serialNumber,
        chemicalName: restriction.chemicalName,
        sprayDate: restriction.sprayDate,
        clearDate,
      });
      return `Blocked: Field "${restriction.field.name}" is still inside its no-harvest window (sprayed with ${restriction.chemicalName} on ${restriction.sprayDate.toDateString()}, clear to harvest on ${clearDate.toDateString()}). Quality has been alerted.`;
    }
  }

  const created = await prisma.harvestTicket.create({
    data: {
      ...data,
      loadingTime: parseDateSafe(loadingTime),
      harvestTime: parseDateSafe(harvestTime),
      harvestDate: parseDateSafe(harvestDate),
      plotLines: {
        create: lines
          .filter((l) => l.stationNo || l.plotValveGhNo || l.varietyName)
          .map((l) => ({
            ...l,
            fieldId: resolveField(l.stationNo, l.plotValveGhNo),
          })),
      },
    },
  });

  revalidatePath("/harvest-tickets");
  redirect(`/harvest-tickets/${created.id}`);
}

const receiptSchema = z.object({
  receivedDate: z.string().optional(),
  receivedTime: z.string().optional(),
  deliveryNumber: z.string().optional(),
  cratesReceived: z.coerce.number().int().min(0).optional(),
  palletsReceived: z.coerce.number().int().min(0).optional(),
  grossWeightKg: z.coerce.number().min(0).optional(),
  netWeightKg: z.coerce.number().min(0).optional(),
  electronicWeightCardNo: z.string().optional(),
  productTempC: z.coerce.number().optional(),
  optimumTempC: z.coerce.number().optional(),
  coldTruckTempC: z.coerce.number().optional(),
  acceptedAtPackhouse: z.boolean(),
  receivedByName: z.string().min(1, "Name is required."),
});

export async function recordReceiptAction(ticketId: string, _prevState: string | undefined, formData: FormData) {
  const raw = Object.fromEntries(
    Array.from(formData.entries()).map(([k, v]) => [k, v === "" ? undefined : v])
  );
  const parsed = receiptSchema.safeParse({
    ...raw,
    acceptedAtPackhouse: formData.get("acceptedAtPackhouse") === "on",
  });
  if (!parsed.success) {
    return parsed.error.issues[0]?.message ?? "Invalid input.";
  }

  const { receivedDate, receivedTime, ...data } = parsed.data;

  await prisma.harvestTicket.update({
    where: { id: ticketId },
    data: {
      ...data,
      receivedDate: parseDateSafe(receivedDate),
      receivedTime: parseDateSafe(receivedTime),
    },
  });

  revalidatePath(`/harvest-tickets/${ticketId}`);
  return "ok";
}
