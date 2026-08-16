import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { notFound } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input, FieldGroup } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { ConfirmSubmitButton } from "@/components/ui/confirm-submit-button";
import { format } from "date-fns";
import { canManagePurchasing, canSignAsHeadOfProduction } from "@/lib/roles";
import {
  reviewPurchaseRequestAction,
  markOrderedAction,
  markReceivedAction,
  confirmWorkingAction,
  addPurchaseRequestPhotoAction,
  removePurchaseRequestPhotoAction,
} from "../actions";
import { ReviewForm } from "./review-form";
import { OrderForm } from "./order-form";
import { ConfirmActionForm } from "./confirm-action-form";

const STATUS_COLOR = {
  REQUESTED: "amber",
  APPROVED: "blue",
  REJECTED: "red",
  ORDERED: "blue",
  RECEIVED: "green",
  CONFIRMED_WORKING: "green",
} as const;

const STATUS_LABEL = {
  REQUESTED: "Requested",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  ORDERED: "Ordered",
  RECEIVED: "Received",
  CONFIRMED_WORKING: "Confirmed Working",
} as const;

const CATEGORY_LABEL = {
  CLEANING_MATERIALS: "Cleaning Materials",
  EQUIPMENT: "Equipment",
  SPARE_PARTS: "Spare Parts",
  OTHER: "Other",
} as const;

function Row({ label, value }: { label: string; value?: string | number | null }) {
  if (value == null || value === "") return null;
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-slate-500">{label}</dt>
      <dd className="text-right text-slate-800">{value}</dd>
    </div>
  );
}

export default async function PurchaseRequestDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [session, request] = await Promise.all([
    auth(),
    prisma.purchaseRequest.findUnique({
      where: { id },
      include: { factory: true, photos: { include: { uploadedBy: true }, orderBy: { createdAt: "desc" } } },
    }),
  ]);
  if (!request) notFound();

  const canManage = canManagePurchasing(session?.user);
  const canReport = canSignAsHeadOfProduction(session?.user);
  const canSeeCost = session?.user.role === "OWNER" || session?.user.isHeadOfPurchasing;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <h1 className="text-xl font-semibold text-slate-900">{request.itemDescription}</h1>
        <Badge color="slate">{CATEGORY_LABEL[request.category]}</Badge>
        <Badge color={STATUS_COLOR[request.status]}>{STATUS_LABEL[request.status]}</Badge>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Card>
          <h2 className="text-sm font-semibold text-slate-900">Request Details</h2>
          <dl className="mt-3 space-y-2 text-sm">
            <Row label="Factory" value={request.factory.name} />
            <Row label="Quantity" value={request.quantity} />
            <Row label="Reason" value={request.reason} />
            <Row label="Requested by" value={request.requestedByName} />
            <Row label="Requested" value={format(request.requestedAt, "dd MMM yyyy HH:mm")} />
          </dl>
        </Card>

        <Card>
          <h2 className="text-sm font-semibold text-slate-900">Purchasing</h2>
          <dl className="mt-3 space-y-2 text-sm">
            <Row label="Reviewed by" value={request.reviewedByName} />
            <Row label="Reviewed" value={request.reviewedAt ? format(request.reviewedAt, "dd MMM yyyy HH:mm") : null} />
            {request.status === "REJECTED" && <Row label="Rejection reason" value={request.rejectionReason} />}
            <Row label="Supplier" value={request.supplierName} />
            <Row label="Order reference" value={request.orderReference} />
            {canSeeCost && <Row label="Cost" value={request.costUsd != null ? `$${request.costUsd.toLocaleString()}` : null} />}
            <Row
              label="Expected delivery"
              value={request.expectedDeliveryDate ? format(request.expectedDeliveryDate, "dd MMM yyyy") : null}
            />
            <Row label="Received by" value={request.receivedByName} />
            <Row label="Received" value={request.receivedAt ? format(request.receivedAt, "dd MMM yyyy HH:mm") : null} />
            <Row label="Working confirmed by" value={request.workingConfirmedByName} />
            <Row label="Working notes" value={request.workingNotes} />
          </dl>
        </Card>
      </div>

      {request.status === "REQUESTED" && (
        <Card>
          <h2 className="text-sm font-semibold text-slate-900">Review this request</h2>
          {canManage ? (
            <ReviewForm requestId={request.id} action={reviewPurchaseRequestAction} />
          ) : (
            <p className="mt-2 text-xs text-slate-400">Only the Owner or Head of Purchasing can review this.</p>
          )}
        </Card>
      )}

      {request.status === "APPROVED" && (
        <Card>
          <h2 className="text-sm font-semibold text-slate-900">Mark as ordered</h2>
          {canManage ? (
            <OrderForm requestId={request.id} action={markOrderedAction} />
          ) : (
            <p className="mt-2 text-xs text-slate-400">Only the Owner or Head of Purchasing can do this.</p>
          )}
        </Card>
      )}

      {request.status === "ORDERED" && (
        <Card>
          <h2 className="text-sm font-semibold text-slate-900">Confirm receipt at the farm gate</h2>
          {canReport ? (
            <ConfirmActionForm
              requestId={request.id}
              action={markReceivedAction}
              confirmMessage={`Confirm ${request.itemDescription} has been received?`}
              buttonLabel="Mark Received"
            />
          ) : (
            <p className="mt-2 text-xs text-slate-400">Only the Owner or Head of Production can do this.</p>
          )}
        </Card>
      )}

      {request.status === "RECEIVED" && (
        <Card>
          <h2 className="text-sm font-semibold text-slate-900">Confirm it's working</h2>
          <p className="mt-1 text-xs text-slate-500">
            A separate check from receiving it — confirm it actually works as expected.
          </p>
          <ConfirmActionForm
            requestId={request.id}
            action={confirmWorkingAction}
            confirmMessage={`Confirm ${request.itemDescription} is working properly?`}
            buttonLabel="Confirm Working"
            withNotes
          />
        </Card>
      )}

      <Card>
        <h2 className="text-sm font-semibold text-slate-900">Photos ({request.photos.length})</h2>
        <div className="mt-3 grid grid-cols-3 gap-3">
          {request.photos.map((p) => {
            const isImage = /\.(jpe?g|png)$/i.test(p.fileName);
            return (
              <div key={p.id} className="rounded-md border border-slate-200 p-2">
                <a href={`/api/files/purchase-request-photos/${p.fileName}`} target="_blank" rel="noopener noreferrer" className="block">
                  {isImage ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={`/api/files/purchase-request-photos/${p.fileName}`}
                      alt={p.caption ?? p.originalName}
                      className="h-32 w-full rounded object-cover"
                    />
                  ) : (
                    <div className="flex h-32 w-full items-center justify-center rounded bg-slate-50 text-sm text-emerald-700 hover:underline">
                      View PDF
                    </div>
                  )}
                </a>
                {p.caption && <p className="mt-2 text-xs text-slate-700">{p.caption}</p>}
                <p className="mt-1 text-xs text-slate-400">
                  {p.uploadedBy?.name ?? "Unknown"} · {format(p.createdAt, "dd MMM yyyy HH:mm")}
                </p>
                <form action={removePurchaseRequestPhotoAction.bind(null, request.id, p.id)} className="mt-1">
                  <ConfirmSubmitButton confirmMessage="Remove this photo? This cannot be undone.">Remove</ConfirmSubmitButton>
                </form>
              </div>
            );
          })}
          {request.photos.length === 0 && <p className="col-span-3 py-2 text-sm text-slate-400">No photos uploaded yet.</p>}
        </div>

        <form
          action={addPurchaseRequestPhotoAction.bind(null, request.id)}
          className="mt-4 flex flex-wrap items-end gap-3 border-t border-slate-100 pt-4"
        >
          <FieldGroup label="Photo or document (JPEG, PNG, or PDF)">
            <input
              name="file"
              type="file"
              accept="image/jpeg,image/png,application/pdf"
              required
              className="block w-64 text-sm text-slate-700 file:mr-3 file:rounded-md file:border file:border-slate-300 file:bg-white file:px-3 file:py-1.5 file:text-sm file:font-medium hover:file:bg-slate-50"
            />
          </FieldGroup>
          <FieldGroup label="Caption (optional)">
            <Input name="caption" className="w-56" placeholder="e.g. Item as delivered" />
          </FieldGroup>
          <Button type="submit" variant="secondary">
            Upload
          </Button>
        </form>
      </Card>
    </div>
  );
}
