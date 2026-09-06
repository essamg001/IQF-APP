"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { saveUploadedFile } from "@/lib/files";
import { logActivity } from "@/lib/activityLog";
import {
  canManagePurchasing,
  canSignAsHeadOfProduction,
  canSubmitPurchaseRequest,
  canCheckWarehouseStock,
  canApproveAccounting,
} from "@/lib/roles";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

const lineItemSchema = z.object({
  category: z.enum(["CLEANING_MATERIALS", "EQUIPMENT", "SPARE_PARTS", "OTHER"]),
  itemDescription: z.string().min(1),
  quantity: z.string().optional(),
  reason: z.string().optional(),
  sourceType: z.string().optional().transform((v) => (v === "LOCAL" || v === "IMPORTED" ? v : undefined)),
});

const requestSchema = z.object({
  factoryId: z.string().min(1),
  items: z.array(lineItemSchema).min(1, "Add at least one item."),
});

// Requests come from Head of Production or Head of Maintenance -- the two
// teams the owner named, not the whole Production role (no dedicated
// "Maintenance" role exists at all).
export async function createPurchaseRequestAction(_prevState: string | undefined, formData: FormData) {
  const session = await auth();
  if (!canSubmitPurchaseRequest(session?.user)) {
    return "Only the Owner, Head of Production, or Head of Maintenance can submit a purchase request.";
  }

  const raw = Object.fromEntries(Array.from(formData.entries()).map(([k, v]) => [k, v === "" ? undefined : v]));

  let items: unknown = [];
  try {
    items = raw.itemsJson ? JSON.parse(String(raw.itemsJson)) : [];
  } catch {
    items = [];
  }

  const parsed = requestSchema.safeParse({ factoryId: raw.factoryId, items });
  if (!parsed.success) return parsed.error.issues[0]?.message ?? "Invalid input.";

  // A photo is optional here -- unlike a structural issue, there's usually
  // nothing to photograph yet (it's a request for something that doesn't
  // exist on site), so this just covers cases like "this is the exact part."
  const file = formData.get("file");
  let photo;
  if (file instanceof File && file.size > 0) {
    try {
      const saved = await saveUploadedFile(file, "purchase-request-photos");
      photo = { create: { fileName: saved.fileName, originalName: saved.originalName, uploadedByUserId: session!.user.id } };
    } catch (e) {
      return e instanceof Error ? e.message : "Could not save the uploaded photo.";
    }
  }

  const created = await prisma.purchaseRequest.create({
    data: {
      factoryId: parsed.data.factoryId,
      requestedByName: session!.user.name || session!.user.email,
      requestedByUserId: session!.user.id,
      items: { create: parsed.data.items },
      ...(photo ? { photos: photo } : {}),
    },
  });

  await logActivity({
    actorId: session!.user.id,
    action: "PURCHASE_REQUEST_CREATED",
    entityType: "PurchaseRequest",
    entityId: created.id,
    detail: `${parsed.data.items.length} item(s): ${parsed.data.items.map((i) => i.itemDescription).join(", ")}`,
  });

  revalidatePath("/purchase-requests");
  redirect(`/purchase-requests/${created.id}`);
}

const warehouseCheckSchema = z.object({
  available: z.enum(["YES", "NO"]),
});

/**
 * The real workflow's first step: before Accounting or Purchasing ever see
 * a request, the on-site warehouse is checked for stock (mirrors the
 * Release Order form, STO 02406). Available short-circuits straight to
 * FULFILLED_FROM_WAREHOUSE -- Accounting/Purchasing/Ordered never happen at
 * all for this request. Not available forwards it to Accounting, who
 * decide before Purchasing ever sees it (see approveAccountingAction).
 */
export async function checkWarehouseStockAction(id: string, _prevState: string | undefined, formData: FormData) {
  const session = await auth();
  if (!canCheckWarehouseStock(session?.user)) {
    return "Only the Owner or a Store Supervisor can check warehouse stock.";
  }

  const parsed = warehouseCheckSchema.safeParse({ available: formData.get("available") });
  if (!parsed.success) return parsed.error.issues[0]?.message ?? "Invalid input.";

  const existing = await prisma.purchaseRequest.findUniqueOrThrow({ where: { id } });
  if (existing.status !== "REQUESTED") return "Warehouse stock has already been checked for this request.";

  const available = parsed.data.available === "YES";
  await prisma.purchaseRequest.update({
    where: { id },
    data: {
      warehouseAvailable: available,
      warehouseCheckedByName: session!.user.name || session!.user.email,
      warehouseCheckedByUserId: session!.user.id,
      warehouseCheckedAt: new Date(),
      status: available ? "FULFILLED_FROM_WAREHOUSE" : "FORWARDED_TO_ACCOUNTING",
    },
  });

  await logActivity({
    actorId: session!.user.id,
    action: available ? "PURCHASE_REQUEST_FULFILLED_FROM_WAREHOUSE" : "PURCHASE_REQUEST_FORWARDED_TO_ACCOUNTING",
    entityType: "PurchaseRequest",
    entityId: id,
  });

  revalidatePath(`/purchase-requests/${id}`);
  revalidatePath("/purchase-requests");
  return "ok";
}

const accountingSchema = z.object({
  decision: z.enum(["APPROVE", "REJECT"]),
  rejectionReason: z.string().optional(),
});

/**
 * The sole approve/reject decision in this workflow -- Accounting decides
 * before Purchasing ever sees the request. Approving flips status to
 * APPROVED, at which point Purchasing acknowledges receipt (below) and
 * places the order.
 */
export async function approveAccountingAction(id: string, _prevState: string | undefined, formData: FormData) {
  const session = await auth();
  if (!canApproveAccounting(session?.user)) {
    return "Only the Owner or Head of Accounting can approve this.";
  }

  const parsed = accountingSchema.safeParse({
    decision: formData.get("decision"),
    rejectionReason: formData.get("rejectionReason") || undefined,
  });
  if (!parsed.success) return parsed.error.issues[0]?.message ?? "Invalid input.";
  if (parsed.data.decision === "REJECT" && !parsed.data.rejectionReason?.trim()) {
    return "A reason is required to reject a request.";
  }

  const existing = await prisma.purchaseRequest.findUniqueOrThrow({ where: { id } });
  if (existing.status !== "FORWARDED_TO_ACCOUNTING") return "This request hasn't been forwarded to Accounting.";

  const rejected = parsed.data.decision === "REJECT";
  await prisma.purchaseRequest.update({
    where: { id },
    data: {
      status: rejected ? "REJECTED" : "APPROVED",
      accountingApprovedByName: rejected ? undefined : session!.user.name || session!.user.email,
      accountingApprovedByUserId: rejected ? undefined : session!.user.id,
      accountingApprovedAt: rejected ? undefined : new Date(),
      accountingRejectionReason: rejected ? parsed.data.rejectionReason : undefined,
    },
  });

  await logActivity({
    actorId: session!.user.id,
    action: rejected ? "PURCHASE_REQUEST_ACCOUNTING_REJECTED" : "PURCHASE_REQUEST_ACCOUNTING_APPROVED",
    entityType: "PurchaseRequest",
    entityId: id,
    detail: rejected ? parsed.data.rejectionReason : undefined,
  });

  revalidatePath(`/purchase-requests/${id}`);
  revalidatePath("/purchase-requests");
  return "ok";
}

/**
 * Deliberately separate from actually placing the order below -- the owner
 * specifically wanted confirmation Purchasing has seen an Accounting-approved
 * request, independent of when (or whether yet) they order it.
 * markOrderedAction requires this to be set first.
 */
export async function acknowledgePurchasingReceiptAction(id: string, _prevState: string | undefined, _formData: FormData) {
  const session = await auth();
  if (!canManagePurchasing(session?.user)) {
    return "Only the Owner or Head of Purchasing can acknowledge receipt.";
  }

  const existing = await prisma.purchaseRequest.findUniqueOrThrow({ where: { id } });
  if (existing.status !== "APPROVED") return "This request hasn't been approved by Accounting yet.";
  if (existing.purchasingAcknowledgedAt) return "Already acknowledged.";

  await prisma.purchaseRequest.update({
    where: { id },
    data: {
      purchasingAcknowledgedByName: session!.user.name || session!.user.email,
      purchasingAcknowledgedByUserId: session!.user.id,
      purchasingAcknowledgedAt: new Date(),
    },
  });

  await logActivity({
    actorId: session!.user.id,
    action: "PURCHASE_REQUEST_PURCHASING_ACKNOWLEDGED",
    entityType: "PurchaseRequest",
    entityId: id,
  });

  revalidatePath(`/purchase-requests/${id}`);
  return "ok";
}

const orderSchema = z.object({
  supplierName: z.string().optional(),
  orderReference: z.string().optional(),
  costUsd: z.coerce.number().nonnegative().optional(),
  expectedDeliveryDate: z.string().optional(),
});

export async function markOrderedAction(id: string, _prevState: string | undefined, formData: FormData) {
  const session = await auth();
  if (!canManagePurchasing(session?.user)) {
    return "Only the Owner or Head of Purchasing can mark a request as ordered.";
  }

  const raw = Object.fromEntries(Array.from(formData.entries()).map(([k, v]) => [k, v === "" ? undefined : v]));
  const parsed = orderSchema.safeParse(raw);
  if (!parsed.success) return parsed.error.issues[0]?.message ?? "Invalid input.";

  const existing = await prisma.purchaseRequest.findUniqueOrThrow({ where: { id } });
  if (existing.status !== "APPROVED") return "This request must be approved before it can be marked as ordered.";
  if (!existing.purchasingAcknowledgedAt) return "Acknowledge receipt of this request before marking it as ordered.";

  const { expectedDeliveryDate, ...rest } = parsed.data;
  await prisma.purchaseRequest.update({
    where: { id },
    data: {
      ...rest,
      expectedDeliveryDate: expectedDeliveryDate ? new Date(expectedDeliveryDate) : undefined,
      orderedByUserId: session!.user.id,
      orderedAt: new Date(),
      status: "ORDERED",
    },
  });

  await logActivity({
    actorId: session!.user.id,
    action: "PURCHASE_REQUEST_ORDERED",
    entityType: "PurchaseRequest",
    entityId: id,
    detail: parsed.data.supplierName,
  });

  revalidatePath(`/purchase-requests/${id}`);
  revalidatePath("/purchase-requests");
  return "ok";
}

const delaySchema = z.object({
  revisedDeliveryDate: z.string().min(1),
  delayReason: z.string().min(1, "A reason is required to record a delay."),
});

/**
 * Recorded against the original expectedDeliveryDate rather than
 * overwriting it, so the commitment that was actually missed stays visible
 * alongside how late it ran. Purchasing owns tracking this with the
 * supplier, same gate as ordering.
 */
export async function recordDeliveryDelayAction(id: string, _prevState: string | undefined, formData: FormData) {
  const session = await auth();
  if (!canManagePurchasing(session?.user)) {
    return "Only the Owner or Head of Purchasing can record a delivery delay.";
  }

  const parsed = delaySchema.safeParse({
    revisedDeliveryDate: formData.get("revisedDeliveryDate"),
    delayReason: formData.get("delayReason"),
  });
  if (!parsed.success) return parsed.error.issues[0]?.message ?? "Invalid input.";

  const existing = await prisma.purchaseRequest.findUniqueOrThrow({ where: { id } });
  if (existing.status !== "ORDERED") return "This request isn't on order.";

  await prisma.purchaseRequest.update({
    where: { id },
    data: {
      revisedDeliveryDate: new Date(parsed.data.revisedDeliveryDate),
      delayReason: parsed.data.delayReason,
    },
  });

  await logActivity({
    actorId: session!.user.id,
    action: "PURCHASE_REQUEST_DELAY_RECORDED",
    entityType: "PurchaseRequest",
    entityId: id,
    detail: parsed.data.delayReason,
  });

  revalidatePath(`/purchase-requests/${id}`);
  return "ok";
}

// Same gate as submitting the request -- the Owner described this as the
// Head of Production's confirmation, not open to whoever happens to be at
// the gate. Reachable from ORDERED (the externally-purchased path) or
// FULFILLED_FROM_WAREHOUSE (the warehouse-stock path) -- both converge on
// this same sign-off, since the owner confirmed it's the same role either
// way.
export async function markReceivedAction(id: string, _prevState: string | undefined, _formData: FormData) {
  const session = await auth();
  if (!canSignAsHeadOfProduction(session?.user)) {
    return "Only the Owner or Head of Production can confirm receipt.";
  }

  const existing = await prisma.purchaseRequest.findUniqueOrThrow({ where: { id } });
  if (existing.status !== "ORDERED" && existing.status !== "FULFILLED_FROM_WAREHOUSE") {
    return "This request isn't ready to be marked received yet.";
  }

  await prisma.purchaseRequest.update({
    where: { id },
    data: {
      receivedByName: session!.user.name || session!.user.email,
      receivedByUserId: session!.user.id,
      receivedAt: new Date(),
      status: "RECEIVED",
    },
  });

  await logActivity({
    actorId: session!.user.id,
    action: "PURCHASE_REQUEST_RECEIVED",
    entityType: "PurchaseRequest",
    entityId: id,
  });

  revalidatePath(`/purchase-requests/${id}`);
  revalidatePath("/purchase-requests");
  return "ok";
}

const workingSchema = z.object({
  workingNotes: z.string().optional(),
});

// "Arrived" and "works" are deliberately two separate facts -- equipment can
// show up damaged or wrong, so this is a distinct confirmation from Received,
// not just the same click twice.
export async function confirmWorkingAction(id: string, _prevState: string | undefined, formData: FormData) {
  const session = await auth();
  if (!session?.user) return "You must be logged in to confirm this.";

  const existing = await prisma.purchaseRequest.findUniqueOrThrow({ where: { id } });
  if (existing.status !== "RECEIVED") return "This request hasn't been confirmed received yet.";

  const parsed = workingSchema.safeParse({ workingNotes: formData.get("workingNotes") || undefined });
  if (!parsed.success) return "Invalid input.";

  await prisma.purchaseRequest.update({
    where: { id },
    data: {
      workingConfirmedByName: session.user.name || session.user.email,
      workingConfirmedByUserId: session.user.id,
      workingConfirmedAt: new Date(),
      workingNotes: parsed.data.workingNotes,
      status: "CONFIRMED_WORKING",
    },
  });

  await logActivity({
    actorId: session.user.id,
    action: "PURCHASE_REQUEST_CONFIRMED_WORKING",
    entityType: "PurchaseRequest",
    entityId: id,
    detail: parsed.data.workingNotes,
  });

  revalidatePath(`/purchase-requests/${id}`);
  revalidatePath("/purchase-requests");
  return "ok";
}

const photoSchema = z.object({
  caption: z.string().optional(),
});

export async function addPurchaseRequestPhotoAction(purchaseRequestId: string, formData: FormData) {
  const parsed = photoSchema.parse({ caption: formData.get("caption") || undefined });

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return;

  const saved = await saveUploadedFile(file, "purchase-request-photos");
  const session = await auth();

  await prisma.purchaseRequestPhoto.create({
    data: {
      purchaseRequestId,
      fileName: saved.fileName,
      originalName: saved.originalName,
      caption: parsed.caption,
      uploadedByUserId: session?.user.id,
    },
  });

  await logActivity({
    actorId: session?.user.id,
    action: "PURCHASE_REQUEST_PHOTO_UPLOADED",
    entityType: "PurchaseRequest",
    entityId: purchaseRequestId,
  });

  revalidatePath(`/purchase-requests/${purchaseRequestId}`);
}

export async function removePurchaseRequestPhotoAction(purchaseRequestId: string, photoId: string) {
  await prisma.purchaseRequestPhoto.delete({ where: { id: photoId } });

  const session = await auth();
  await logActivity({
    actorId: session?.user.id,
    action: "PURCHASE_REQUEST_PHOTO_REMOVED",
    entityType: "PurchaseRequest",
    entityId: purchaseRequestId,
  });

  revalidatePath(`/purchase-requests/${purchaseRequestId}`);
}
