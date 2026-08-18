import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { canSeePricing } from "@/lib/roles";
import { notFound } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmSubmitButton } from "@/components/ui/confirm-submit-button";
import { Input, FieldGroup } from "@/components/ui/field";
import { addClaimAttachmentAction, removeClaimAttachmentAction } from "../actions";
import { AdvanceStatusButton } from "./advance-status-button";
import { formatDate } from "@/lib/dates";
import { resolveLocale } from "@/lib/i18n/resolveLocale";
import { getDictionary } from "@/lib/i18n/getDictionary";

const STATUS_ORDER = ["OPEN", "UNDER_REVIEW", "RESOLVED_CREDITED", "CLOSED"] as const;
const STATUS_LABEL_KEY = {
  OPEN: "claimStatusOpen",
  UNDER_REVIEW: "claimStatusUnderReview",
  RESOLVED_CREDITED: "claimStatusResolvedCredited",
  CLOSED: "claimStatusClosed",
} as const;
const REASON_LABEL_KEY = {
  QUALITY: "claimReasonQuality",
  PACKAGING: "claimReasonPackaging",
  FOREIGN_MATERIAL: "claimReasonForeignMaterial",
  TRANSPORT: "claimReasonTransport",
} as const;

export default async function ClaimDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const locale = await resolveLocale();
  const fullDict = getDictionary(locale);
  const dict = fullDict.claims;
  const common = fullDict.common;
  const orders = fullDict.orders;

  const session = await auth();
  const showPricing = canSeePricing(session?.user.role);

  const claim = await prisma.claim.findUnique({
    where: { id },
    include: {
      client: true,
      containers: true,
      attachments: { include: { uploadedBy: true }, orderBy: { createdAt: "desc" } },
    },
  });
  if (!claim) notFound();

  const nextStatus = STATUS_ORDER[STATUS_ORDER.indexOf(claim.status) + 1];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold text-slate-900">
              {dict.claimPrefix} {claim.claimNumber ? `#${claim.claimNumber}` : ""} — {claim.client.name}
            </h1>
            <Badge color={claim.severity === "RED" ? "red" : "amber"}>
              {claim.severity === "RED" ? orders.claimSeverityRed : orders.claimSeverityAmber}
            </Badge>
            <Badge color="slate">{orders[STATUS_LABEL_KEY[claim.status]]}</Badge>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            {formatDate(claim.claimDate, "dd MMM yyyy", locale)} · {orders[REASON_LABEL_KEY[claim.reason]]}
            {claim.variety ? ` · ${claim.variety}` : ""}
          </p>
        </div>
        {nextStatus && <AdvanceStatusButton claimId={claim.id} label={orders[STATUS_LABEL_KEY[nextStatus]]} />}
      </div>

      {showPricing && (
        <Card>
          <h2 className="text-sm font-semibold text-slate-900">{dict.financialSummaryTitle}</h2>
          <dl className="mt-2 grid grid-cols-4 gap-x-6 gap-y-2 text-sm">
            <Row label={dict.rowClaimValue} value={`$${claim.valueUsd.toLocaleString()}`} />
            <Row label={dict.rowAmountRequestedFromClient} value={fmtMoney(claim.amountRequestedFromClient)} />
            <Row label={dict.rowAmountAfterNegotiation} value={fmtMoney(claim.amountAfterNegotiation)} />
            <Row label={dict.rowDiscountValue} value={fmtMoney(claim.discountValue)} />
            <Row label={dict.rowAmountRequestedForApproval} value={fmtMoney(claim.amountRequestedForApproval)} />
            <Row label={dict.rowTotalShipmentValue} value={fmtMoney(claim.totalShipmentValue)} />
            <Row label={dict.rowDiscountPct} value={claim.discountPct != null ? `${claim.discountPct}%` : undefined} />
          </dl>
        </Card>
      )}

      <Card className="overflow-x-auto p-0">
        <h2 className="px-4 py-3 text-sm font-semibold text-slate-900">
          {dict.containersComplainedTitle} ({claim.containers.length})
        </h2>
        <table className="w-full text-start text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-slate-500">
            <tr>
              <th className="px-4 py-2 font-medium">{dict.colContainerNumber}</th>
              <th className="px-4 py-2 font-medium">{common.variety}</th>
              <th className="px-4 py-2 font-medium">{dict.colShippingLine}</th>
              <th className="px-4 py-2 font-medium">{dict.colCartons}</th>
              <th className="px-4 py-2 font-medium">{dict.colLostCartons}</th>
              {showPricing && <th className="px-4 py-2 font-medium">{dict.colClaimPct}</th>}
              {showPricing && <th className="px-4 py-2 font-medium">{dict.colClaimAmount}</th>}
            </tr>
          </thead>
          <tbody>
            {claim.containers.map((line) => (
              <tr key={line.id} className="border-b border-slate-100 last:border-0">
                <td className="px-4 py-2">
                  {line.containerId ? (
                    <a href={`/logistics/${line.containerId}`} className="text-emerald-700 hover:underline">
                      {line.containerNumber}
                    </a>
                  ) : (
                    line.containerNumber
                  )}
                </td>
                <td className="px-4 py-2">{line.variety ?? "—"}</td>
                <td className="px-4 py-2">{line.shippingLine ?? "—"}</td>
                <td className="px-4 py-2">{line.cartonsPerContainer ?? "—"}</td>
                <td className="px-4 py-2">{line.lostCartons ?? "—"}</td>
                {showPricing && <td className="px-4 py-2">{line.claimPct != null ? `${line.claimPct}%` : "—"}</td>}
                {showPricing && <td className="px-4 py-2">{fmtMoney(line.claimAmount)}</td>}
              </tr>
            ))}
            {claim.containers.length === 0 && (
              <tr>
                <td colSpan={showPricing ? 7 : 5} className="px-4 py-6 text-center text-slate-400">
                  {dict.noContainersListed}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>

      <div className="grid grid-cols-2 gap-4">
        <Card>
          <h2 className="text-sm font-semibold text-slate-900">{dict.claimDetailsQualityTitle}</h2>
          <p className="mt-2 text-sm text-slate-700">{claim.claimDetails || "—"}</p>
          <p className="mt-2 text-xs font-medium text-slate-500">{dict.qualityResponseLabel}</p>
          <p className="text-sm text-slate-700">{claim.qualityResponse || "—"}</p>
        </Card>

        <Card>
          <h2 className="text-sm font-semibold text-slate-900">{dict.containerInspectionTitle}</h2>
          <dl className="mt-2 space-y-2 text-sm">
            <Row label={dict.rowInspectionSent} value={claim.inspectionCompanySent ? common.yes : common.no} />
            <Row label={dict.rowCompanyName} value={claim.inspectionCompanyName} />
            {showPricing && <Row label={fullDict.purchaseRequests.rowCost} value={fmtMoney(claim.inspectionCompanyCost)} />}
            <Row label={dict.rowReport} value={claim.inspectionCompanyReport} />
          </dl>
        </Card>
      </div>

      {(claim.weightMagrabiTon || claim.weightClientTon) && (
        <Card>
          <h2 className="text-sm font-semibold text-slate-900">{dict.weightDeductionTitle}</h2>
          <dl className="mt-2 grid grid-cols-4 gap-x-6 gap-y-2 text-sm">
            <Row label={dict.rowWeightMagrabi} value={claim.weightMagrabiTon ? `${claim.weightMagrabiTon} ton` : undefined} />
            <Row label={dict.rowWeightClient} value={claim.weightClientTon ? `${claim.weightClientTon} ton` : undefined} />
            <Row label={dict.rowWeightDifference} value={claim.weightDifferenceKg ? `${claim.weightDifferenceKg} kg` : undefined} />
            <Row label={dict.rowWeightDifferencePct} value={claim.weightDifferencePct != null ? `${claim.weightDifferencePct}%` : undefined} />
          </dl>
        </Card>
      )}

      <Card>
        <h2 className="text-sm font-semibold text-slate-900">{dict.approvalsTitle}</h2>
        <dl className="mt-2 grid grid-cols-3 gap-x-6 gap-y-2 text-sm">
          <Row label={dict.rowAccountManager} value={claim.accountManager} />
          <Row label={dict.rowItManager} value={claim.itManager} />
          <Row label={dict.rowExportManager} value={claim.exportManager} />
          <Row label={dict.rowExportDirector} value={claim.exportDirector} />
          <Row label={dict.rowCommercialDirector} value={claim.commercialDirector} />
          <Row label={dict.rowChairman} value={claim.chairman} />
        </dl>
        {claim.otherNotes && (
          <p className="mt-3 text-sm text-slate-700">
            <span className="font-medium text-slate-500">{dict.notesLabel}</span>
            {claim.otherNotes}
          </p>
        )}
      </Card>

      <Card>
        <h2 className="text-sm font-semibold text-slate-900">
          {dict.evidenceTitle} ({claim.attachments.length})
        </h2>
        <p className="mt-1 text-xs text-slate-500">{dict.evidenceSubtitle}</p>

        <div className="mt-3 grid grid-cols-3 gap-3">
          {claim.attachments.map((a) => {
            const isImage = /\.(jpe?g|png)$/i.test(a.fileName);
            return (
              <div key={a.id} className="rounded-md border border-slate-200 p-2">
                <a
                  href={`/api/files/claim-attachments/${a.fileName}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block"
                >
                  {isImage ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={`/api/files/claim-attachments/${a.fileName}`}
                      alt={a.caption ?? a.originalName}
                      className="h-32 w-full rounded object-cover"
                    />
                  ) : (
                    <div className="flex h-32 w-full items-center justify-center rounded bg-slate-50 text-sm text-emerald-700 hover:underline">
                      {common.viewPdf}
                    </div>
                  )}
                </a>
                {a.caption && <p className="mt-2 text-xs text-slate-700">{a.caption}</p>}
                <p className="mt-1 text-xs text-slate-400">
                  {a.uploadedBy?.name ?? common.unknown} · {formatDate(a.createdAt, "dd MMM yyyy HH:mm", locale)}
                </p>
                <form action={removeClaimAttachmentAction.bind(null, claim.id, a.id)} className="mt-1">
                  <ConfirmSubmitButton confirmMessage={dict.removeEvidenceConfirm}>{common.remove}</ConfirmSubmitButton>
                </form>
              </div>
            );
          })}
          {claim.attachments.length === 0 && (
            <p className="col-span-3 py-2 text-sm text-slate-400">{dict.noEvidence}</p>
          )}
        </div>

        <form action={addClaimAttachmentAction.bind(null, claim.id)} className="mt-4 flex flex-wrap items-end gap-3 border-t border-slate-100 pt-4">
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

function fmtMoney(value?: number | null) {
  return value != null ? `$${value.toLocaleString()}` : undefined;
}

function Row({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-slate-500">{label}</dt>
      <dd className="text-end text-slate-800">{value || "—"}</dd>
    </div>
  );
}
