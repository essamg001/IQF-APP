import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { notFound } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input, FieldGroup } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { ConfirmSubmitButton } from "@/components/ui/confirm-submit-button";
import { formatDate } from "@/lib/dates";
import { canManagePurchasing, canSignAsHeadOfProduction } from "@/lib/roles";
import { resolveLocale } from "@/lib/i18n/resolveLocale";
import { getDictionary } from "@/lib/i18n/getDictionary";
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

function Row({ label, value }: { label: string; value?: string | number | null }) {
  if (value == null || value === "") return null;
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-slate-500">{label}</dt>
      <dd className="text-end text-slate-800">{value}</dd>
    </div>
  );
}

export default async function PurchaseRequestDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const locale = await resolveLocale();
  const fullDict = getDictionary(locale);
  const dict = fullDict.purchaseRequests;
  const common = fullDict.common;

  const STATUS_LABEL = {
    REQUESTED: dict.statusRequested,
    APPROVED: dict.statusApproved,
    REJECTED: dict.statusRejected,
    ORDERED: dict.statusOrdered,
    RECEIVED: dict.statusReceived,
    CONFIRMED_WORKING: dict.statusConfirmedWorking,
  } as const;

  const CATEGORY_LABEL = {
    CLEANING_MATERIALS: dict.categoryCleaningMaterials,
    EQUIPMENT: dict.categoryEquipment,
    SPARE_PARTS: dict.categorySpareParts,
    OTHER: common.other,
  } as const;

  const [session, request] = await Promise.all([
    auth(),
    prisma.purchaseRequest.findUnique({
      where: { id },
      include: {
        factory: true,
        items: true,
        photos: { include: { uploadedBy: true }, orderBy: { createdAt: "desc" } },
      },
    }),
  ]);
  if (!request) notFound();

  const canManage = canManagePurchasing(session?.user);
  const canReport = canSignAsHeadOfProduction(session?.user);
  const canSeeCost = session?.user.role === "OWNER" || session?.user.isHeadOfPurchasing;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <h1 className="text-xl font-semibold text-slate-900">
          {dict.listHeading.replace("{count}", String(request.items.length))}
        </h1>
        <Badge color={STATUS_COLOR[request.status]}>{STATUS_LABEL[request.status]}</Badge>
      </div>

      <Card>
        <h2 className="text-sm font-semibold text-slate-900">{dict.itemsCardTitle}</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-start text-sm">
            <thead className="border-b border-slate-200 text-slate-500 text-xs">
              <tr>
                <th className="px-2 py-1 font-medium">{dict.colItem}</th>
                <th className="px-2 py-1 font-medium">{dict.colCategory}</th>
                <th className="px-2 py-1 font-medium">{dict.rowQuantity}</th>
                <th className="px-2 py-1 font-medium">{dict.rowReason}</th>
              </tr>
            </thead>
            <tbody>
              {request.items.map((i) => (
                <tr key={i.id} className="border-b border-slate-100 last:border-0">
                  <td className="px-2 py-1 font-medium text-slate-900">{i.itemDescription}</td>
                  <td className="px-2 py-1">
                    <Badge color="slate">{CATEGORY_LABEL[i.category]}</Badge>
                  </td>
                  <td className="px-2 py-1 text-slate-600">{i.quantity ?? "—"}</td>
                  <td className="px-2 py-1 text-slate-600">{i.reason ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-4">
        <Card>
          <h2 className="text-sm font-semibold text-slate-900">{dict.requestDetailsCard}</h2>
          <dl className="mt-3 space-y-2 text-sm">
            <Row label={common.factory} value={request.factory.name} />
            <Row label={dict.rowRequestedBy} value={request.requestedByName} />
            <Row label={dict.requestedLabel} value={formatDate(request.requestedAt, "dd MMM yyyy HH:mm", locale)} />
          </dl>
        </Card>

        <Card>
          <h2 className="text-sm font-semibold text-slate-900">{dict.purchasingCard}</h2>
          <dl className="mt-3 space-y-2 text-sm">
            <Row label={dict.rowReviewedBy} value={request.reviewedByName} />
            <Row
              label={dict.rowReviewed}
              value={request.reviewedAt ? formatDate(request.reviewedAt, "dd MMM yyyy HH:mm", locale) : null}
            />
            {request.status === "REJECTED" && <Row label={dict.rowRejectionReason} value={request.rejectionReason} />}
            <Row label={dict.rowSupplier} value={request.supplierName} />
            <Row label={dict.rowOrderReference} value={request.orderReference} />
            {canSeeCost && (
              <Row label={dict.rowCost} value={request.costUsd != null ? `$${request.costUsd.toLocaleString()}` : null} />
            )}
            <Row
              label={dict.rowExpectedDelivery}
              value={request.expectedDeliveryDate ? formatDate(request.expectedDeliveryDate, "dd MMM yyyy", locale) : null}
            />
            <Row label={dict.rowReceivedBy} value={request.receivedByName} />
            <Row
              label={dict.rowReceived}
              value={request.receivedAt ? formatDate(request.receivedAt, "dd MMM yyyy HH:mm", locale) : null}
            />
            <Row label={dict.rowWorkingConfirmedBy} value={request.workingConfirmedByName} />
            <Row label={dict.rowWorkingNotes} value={request.workingNotes} />
          </dl>
        </Card>
      </div>

      {request.status === "REQUESTED" && (
        <Card>
          <h2 className="text-sm font-semibold text-slate-900">{dict.reviewSectionTitle}</h2>
          {canManage ? (
            <ReviewForm requestId={request.id} action={reviewPurchaseRequestAction} />
          ) : (
            <p className="mt-2 text-xs text-slate-400">{dict.onlyPurchasingReview}</p>
          )}
        </Card>
      )}

      {request.status === "APPROVED" && (
        <Card>
          <h2 className="text-sm font-semibold text-slate-900">{dict.markOrderedTitle}</h2>
          {canManage ? (
            <OrderForm requestId={request.id} action={markOrderedAction} />
          ) : (
            <p className="mt-2 text-xs text-slate-400">{dict.onlyPurchasingDo}</p>
          )}
        </Card>
      )}

      {request.status === "ORDERED" && (
        <Card>
          <h2 className="text-sm font-semibold text-slate-900">{dict.confirmReceiptTitle}</h2>
          {canReport ? (
            <ConfirmActionForm
              requestId={request.id}
              action={markReceivedAction}
              confirmMessage={dict.confirmReceivedMessage.replace("{count}", String(request.items.length))}
              buttonLabel={dict.markReceivedButton}
            />
          ) : (
            <p className="mt-2 text-xs text-slate-400">{dict.onlyProductionDo}</p>
          )}
        </Card>
      )}

      {request.status === "RECEIVED" && (
        <Card>
          <h2 className="text-sm font-semibold text-slate-900">{dict.confirmWorkingTitle}</h2>
          <p className="mt-1 text-xs text-slate-500">{dict.confirmWorkingSubtitle}</p>
          <ConfirmActionForm
            requestId={request.id}
            action={confirmWorkingAction}
            confirmMessage={dict.confirmWorkingMessage.replace("{count}", String(request.items.length))}
            buttonLabel={dict.confirmWorkingButton}
            withNotes
          />
        </Card>
      )}

      <Card>
        <h2 className="text-sm font-semibold text-slate-900">
          {dict.photosTitle} ({request.photos.length})
        </h2>
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
                      {common.viewPdf}
                    </div>
                  )}
                </a>
                {p.caption && <p className="mt-2 text-xs text-slate-700">{p.caption}</p>}
                <p className="mt-1 text-xs text-slate-400">
                  {p.uploadedBy?.name ?? common.unknown} · {formatDate(p.createdAt, "dd MMM yyyy HH:mm", locale)}
                </p>
                <form action={removePurchaseRequestPhotoAction.bind(null, request.id, p.id)} className="mt-1">
                  <ConfirmSubmitButton confirmMessage={dict.removePhotoConfirm}>{common.remove}</ConfirmSubmitButton>
                </form>
              </div>
            );
          })}
          {request.photos.length === 0 && <p className="col-span-3 py-2 text-sm text-slate-400">{dict.noPhotos}</p>}
        </div>

        <form
          action={addPurchaseRequestPhotoAction.bind(null, request.id)}
          className="mt-4 flex flex-wrap items-end gap-3 border-t border-slate-100 pt-4"
        >
          <FieldGroup label={common.photoOrDocument}>
            <input
              name="file"
              type="file"
              accept="image/jpeg,image/png,application/pdf"
              required
              className="block w-64 text-sm text-slate-700 file:me-3 file:rounded-md file:border file:border-slate-300 file:bg-white file:px-3 file:py-1.5 file:text-sm file:font-medium hover:file:bg-slate-50"
            />
          </FieldGroup>
          <FieldGroup label={common.captionOptional}>
            <Input name="caption" className="w-56" placeholder={dict.captionPlaceholder} />
          </FieldGroup>
          <Button type="submit" variant="secondary">
            {common.upload}
          </Button>
        </form>
      </Card>
    </div>
  );
}
