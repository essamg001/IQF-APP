"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { saveUploadedFile } from "@/lib/files";
import { logActivity } from "@/lib/activityLog";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

const containerLineSchema = z.object({
  containerNumber: z.string().min(1),
  variety: z.string().optional(),
  shippingLine: z.string().optional(),
  cartonsPerContainer: z.coerce.number().int().optional(),
  netWeight: z.coerce.number().optional(),
  shipmentDate: z.string().optional(),
  arrivalDate: z.string().optional(),
  complaintDate: z.string().optional(),
  sellingPricePerCarton: z.coerce.number().optional(),
  shippingPrice: z.coerce.number().optional(),
  lostCartons: z.coerce.number().int().optional(),
  creditRequired: z.coerce.number().optional(),
  claimPct: z.coerce.number().optional(),
  claimAmount: z.coerce.number().optional(),
  totalSales: z.coerce.number().optional(),
});

const claimSchema = z.object({
  clientId: z.string().min(1),
  claimNumber: z.string().optional(),
  claimDate: z.string().min(1),
  variety: z.string().optional(),
  reason: z.enum(["QUALITY", "PACKAGING", "FOREIGN_MATERIAL", "TRANSPORT"]),
  severity: z.enum(["RED", "AMBER"]),
  valueUsd: z.coerce.number().nonnegative(),

  weightMagrabiTon: z.coerce.number().optional(),
  weightClientTon: z.coerce.number().optional(),
  weightDifferenceKg: z.coerce.number().optional(),
  weightDifferencePct: z.coerce.number().optional(),

  clientPrice: z.coerce.number().optional(),
  shippingPricePerContainer: z.coerce.number().optional(),
  clientFarmGateBeforeIssue: z.coerce.number().optional(),
  clientFarmGateAfterIssue: z.coerce.number().optional(),
  totalShippingPrice: z.coerce.number().optional(),
  priceAgreement: z.string().optional(),
  paymentTerms: z.string().optional(),
  contractWithCompany: z.string().optional(),

  claimDetails: z.string().optional(),
  qualityResponse: z.string().optional(),

  inspectionCompanySent: z.boolean().optional(),
  inspectionCompanyName: z.string().optional(),
  inspectionCompanyCost: z.coerce.number().optional(),
  inspectionCompanyReport: z.string().optional(),

  amountRequestedFromClient: z.coerce.number().optional(),
  amountAfterNegotiation: z.coerce.number().optional(),
  discountValue: z.coerce.number().optional(),
  amountRequestedForApproval: z.coerce.number().optional(),
  totalShipmentValue: z.coerce.number().optional(),
  discountPct: z.coerce.number().optional(),

  otherNotes: z.string().optional(),
  accountManager: z.string().optional(),
  itManager: z.string().optional(),
  exportManager: z.string().optional(),
  exportDirector: z.string().optional(),
  commercialDirector: z.string().optional(),
  chairman: z.string().optional(),

  containers: z.array(containerLineSchema).default([]),
});

export async function createClaimAction(_prevState: string | undefined, formData: FormData) {
  const raw = Object.fromEntries(
    Array.from(formData.entries()).map(([k, v]) => [k, v === "" ? undefined : v])
  );

  let containers: unknown = [];
  try {
    containers = raw.containersJson ? JSON.parse(String(raw.containersJson)) : [];
  } catch {
    containers = [];
  }

  const parsed = claimSchema.safeParse({
    ...raw,
    inspectionCompanySent: formData.get("inspectionCompanySent") === "on",
    containers,
  });
  if (!parsed.success) {
    return parsed.error.issues[0]?.message ?? "Invalid input.";
  }

  const { containers: containerLines, claimDate, ...claimFields } = parsed.data;

  // Match container numbers to existing Container records where possible, for traceability.
  const matched = await prisma.container.findMany({
    where: { containerNumber: { in: containerLines.map((c) => c.containerNumber) } },
  });
  const containerIdByNumber = new Map(matched.map((c) => [c.containerNumber, c.id]));

  const claim = await prisma.claim.create({
    data: {
      ...claimFields,
      claimDate: new Date(claimDate),
      containers: {
        create: containerLines.map((c) => {
          const { shipmentDate, arrivalDate, complaintDate, ...rest } = c;
          return {
            ...rest,
            containerId: containerIdByNumber.get(c.containerNumber),
            shipmentDate: shipmentDate ? new Date(shipmentDate) : undefined,
            arrivalDate: arrivalDate ? new Date(arrivalDate) : undefined,
            complaintDate: complaintDate ? new Date(complaintDate) : undefined,
          };
        }),
      },
    },
  });

  const session = await auth();
  await logActivity({
    actorId: session?.user.id,
    action: "CLAIM_CREATED",
    entityType: "Claim",
    entityId: claim.id,
    detail: `Filed claim (${parsed.data.reason}, ${parsed.data.severity}, $${parsed.data.valueUsd.toLocaleString()})`,
  });

  revalidatePath("/claims");
  redirect(`/claims/${claim.id}`);
}

const STATUS_ORDER = ["OPEN", "UNDER_REVIEW", "RESOLVED_CREDITED", "CLOSED"] as const;

export async function advanceClaimStatusAction(
  claimId: string,
  _prevState: string | undefined,
  _formData: FormData
) {
  const claim = await prisma.claim.findUniqueOrThrow({ where: { id: claimId } });
  const idx = STATUS_ORDER.indexOf(claim.status);
  const next = STATUS_ORDER[idx + 1];
  if (!next) return;

  // The negotiated settlement figure is what "credited" actually means here --
  // advancing past it without that number recorded would leave a resolved
  // claim with no financial record of what was actually agreed.
  if (next === "RESOLVED_CREDITED" && claim.amountAfterNegotiation == null) {
    return "Record the negotiated settlement (\"Amount after negotiation\") before marking this claim Resolved/Credited.";
  }

  await prisma.claim.update({
    where: { id: claimId },
    data: { status: next, resolvedDate: next === "RESOLVED_CREDITED" ? new Date() : undefined },
  });

  const session = await auth();
  await logActivity({
    actorId: session?.user.id,
    action: "CLAIM_STATUS_ADVANCED",
    entityType: "Claim",
    entityId: claimId,
    detail: `${claim.status} → ${next}`,
  });

  revalidatePath(`/claims/${claimId}`);
  revalidatePath("/claims");
}

const attachmentSchema = z.object({
  caption: z.string().optional(),
});

export async function addClaimAttachmentAction(claimId: string, formData: FormData) {
  const parsed = attachmentSchema.parse({
    caption: formData.get("caption") || undefined,
  });

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return;
  }

  const saved = await saveUploadedFile(file, "claim-attachments");
  const session = await auth();

  await prisma.claimAttachment.create({
    data: {
      claimId,
      fileName: saved.fileName,
      originalName: saved.originalName,
      caption: parsed.caption,
      uploadedByUserId: session?.user.id,
    },
  });

  await logActivity({
    actorId: session?.user.id,
    action: "CLAIM_ATTACHMENT_UPLOADED",
    entityType: "Claim",
    entityId: claimId,
    detail: saved.originalName,
  });

  revalidatePath(`/claims/${claimId}`);
}

export async function removeClaimAttachmentAction(claimId: string, attachmentId: string) {
  await prisma.claimAttachment.delete({ where: { id: attachmentId } });

  const session = await auth();
  await logActivity({
    actorId: session?.user.id,
    action: "CLAIM_ATTACHMENT_REMOVED",
    entityType: "Claim",
    entityId: claimId,
  });

  revalidatePath(`/claims/${claimId}`);
}
