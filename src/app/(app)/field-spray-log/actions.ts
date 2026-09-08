"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { logActivity } from "@/lib/activityLog";
import { parseLocalDateOnly } from "@/lib/dates";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

const sprayFormSchema = z.object({
  fieldName: z.string().min(1, "Field is required."),
  // Set when a product was picked from the Open Field Crop Protection
  // Plan's dropdown -- chemicalName/noHarvestDays/phiLimitDays are then
  // derived server-side from that entry, never trusted from the client.
  cropProtectionEntryId: z.string().optional(),
  chemicalName: z.string().optional(),
  sprayDate: z.string().min(1, "Spray date is required."),
  noHarvestDays: z.coerce.number().int().min(0).optional(),
  sprayedByName: z.string().optional(),
  reason: z.string().optional(),
  leafCompliancePct: z.coerce.number().min(0).max(100).optional(),
  globalGapCompliancePct: z.coerce.number().min(0).max(100).optional(),
  nurtureCompliancePct: z.coerce.number().min(0).max(100).optional(),
  fairtradeCompliancePct: z.coerce.number().min(0).max(100).optional(),
  notes: z.string().optional(),
});

/** A clean whole number of days ("14"), or null for "NA"/ranges/anything else not safe to auto-apply. */
function parsePhiDays(raw: string | null): number | null {
  if (raw && /^\d+$/.test(raw.trim())) return parseInt(raw.trim(), 10);
  return null;
}

// Matches spray-form.tsx's OTHER_VALUE -- the dropdown's "not on the list"
// option submits this sentinel rather than a real CropProtectionEntry id.
const OTHER_VALUE = "__OTHER__";

export async function createFieldSprayAction(_prevState: string | undefined, formData: FormData) {
  const session = await auth();
  if (!session?.user || !["OWNER", "QUALITY"].includes(session.user.role)) {
    return "Only the Owner or Quality can log a field spray.";
  }

  const raw = Object.fromEntries(
    Array.from(formData.entries()).map(([k, v]) => [k, v === "" ? undefined : v])
  );
  const parsed = sprayFormSchema.safeParse(raw);
  if (!parsed.success) {
    return parsed.error.issues[0]?.message ?? "Invalid input.";
  }

  const field = await prisma.field.findUnique({ where: { name: parsed.data.fieldName.trim() } });
  if (!field) {
    return `Field "${parsed.data.fieldName}" not found — pick one from the list.`;
  }

  const sprayDate = parseLocalDateOnly(parsed.data.sprayDate);
  if (!sprayDate) return "Invalid spray date.";

  // The chemical + its PHI clearance: either derived from the approved plan
  // entry (never trusting a client-submitted number for a known product), or
  // -- for a product not on the list, or one the plan has no PHI on file
  // for -- taken from what the person logging the spray typed in by hand.
  let chemicalName: string;
  let noHarvestDays: number;
  let phiLimitDays: number | undefined;
  let cropProtectionEntryId: string | undefined;

  if (parsed.data.cropProtectionEntryId && parsed.data.cropProtectionEntryId !== OTHER_VALUE) {
    const entry = await prisma.cropProtectionEntry.findUnique({ where: { id: parsed.data.cropProtectionEntryId } });
    if (!entry) return "Selected chemical wasn't found — pick again.";
    chemicalName = entry.commercialProductName;
    cropProtectionEntryId = entry.id;
    const planPhi = parsePhiDays(entry.proposedPhiDays);
    if (planPhi != null) {
      noHarvestDays = planPhi;
      phiLimitDays = planPhi;
    } else {
      if (parsed.data.noHarvestDays == null) {
        return `"${entry.commercialProductName}" has no PHI on file in the plan — enter the no-harvest period manually.`;
      }
      noHarvestDays = parsed.data.noHarvestDays;
    }
  } else {
    if (!parsed.data.chemicalName?.trim()) return "Chemical / product name is required.";
    if (parsed.data.noHarvestDays == null) {
      return "No-harvest period (PHI) is required for a chemical that isn't on the approved list.";
    }
    chemicalName = parsed.data.chemicalName.trim();
    noHarvestDays = parsed.data.noHarvestDays;
  }

  const { fieldName, sprayDate: _sprayDateRaw, cropProtectionEntryId: _rawEntryId, chemicalName: _rawChemical, noHarvestDays: _rawDays, ...data } = parsed.data;

  const created = await prisma.fieldSprayRecord.create({
    data: {
      ...data,
      chemicalName,
      noHarvestDays,
      phiLimitDays,
      cropProtectionEntryId,
      fieldId: field.id,
      sprayDate,
    },
  });

  await logActivity({
    actorId: session.user.id,
    action: "FIELD_SPRAY_LOGGED",
    entityType: "FieldSprayRecord",
    entityId: created.id,
    detail: `${field.name} — ${chemicalName} (${noHarvestDays}-day no-harvest)`,
  });

  revalidatePath("/field-spray-log");
  redirect("/field-spray-log");
}
