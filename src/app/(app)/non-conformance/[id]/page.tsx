import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { notFound } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmSubmitButton } from "@/components/ui/confirm-submit-button";
import { Input, FieldGroup } from "@/components/ui/field";
import { formatDate } from "@/lib/dates";
import {
  updateNonConformanceCapaAction,
  addNonConformanceReportPhotoAction,
  removeNonConformanceReportPhotoAction,
} from "../actions";
import { VerifyCapaForm } from "./verify-capa-form";
import { resolveLocale } from "@/lib/i18n/resolveLocale";
import { getDictionary } from "@/lib/i18n/getDictionary";

function Row({ label, value }: { label: string; value?: string | number | null }) {
  if (value == null || value === "") return null;
  return (
    <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-2 last:border-0">
      <dt className="text-sm text-slate-500">{label}</dt>
      <dd className="text-right text-sm font-medium text-slate-800">{value}</dd>
    </div>
  );
}

export default async function NonConformanceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  const currentUserLabel = session?.user.name ?? session?.user.email ?? null;
  const locale = await resolveLocale();
  const fullDict = getDictionary(locale);
  const dict = fullDict.nonConformance;
  const TYPE_LABEL: Record<string, string> = {
    PRODUCT: dict.typeProduct,
    PROCESS: dict.typeProcess,
    EQUIPMENT: dict.typeEquipment,
    DOCUMENTATION: dict.typeDocumentation,
    SUPPLIER: dict.typeSupplier,
    OTHER: dict.typeOther,
  };
  const SOURCE_LABEL: Record<string, string> = {
    INTERNAL_AUDIT: dict.sourceInternalAudit,
    EXTERNAL_AUDIT: dict.sourceExternalAudit,
    CUSTOMER_COMPLAINT: dict.sourceCustomerComplaint,
    INSPECTION: dict.sourceInspection,
    STAFF_REPORT: dict.sourceStaffReport,
    OTHER: dict.sourceOther,
  };

  const report = await prisma.nonConformanceReport.findUnique({
    where: { id },
    include: { factory: true, photos: { include: { uploadedBy: true }, orderBy: { createdAt: "desc" } } },
  });
  if (!report) notFound();

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center gap-2">
        <h1 className="text-xl font-semibold text-slate-900">
          {dict.detailTitlePrefix}
          {report.location}
        </h1>
        {report.verifiedAt ? <Badge color="green">{dict.verified}</Badge> : <Badge color="amber">{dict.open}</Badge>}
      </div>
      <p className="text-sm text-slate-500">
        {formatDate(report.date, "dd MMM yyyy", locale)} · {TYPE_LABEL[report.ncType] ?? report.ncType} ·{" "}
        {SOURCE_LABEL[report.source] ?? report.source}
      </p>

      <Card className="space-y-3">
        <Row label={fullDict.common.factory} value={report.factory?.name ?? dict.bothFactoriesLabel} />
        <Row label={dict.productReferenceRow} value={report.productOrReference} />
        <Row label={fullDict.common.description} value={report.description} />
        <Row label={dict.reportedBy} value={report.reportedByName} />
        <Row label={dict.reportedAt} value={formatDate(report.reportedAt, "dd MMM yyyy HH:mm", locale)} />
      </Card>

      <Card className="space-y-4">
        <h2 className="text-sm font-semibold text-slate-900">{dict.capaTitle}</h2>
        <form action={updateNonConformanceCapaAction.bind(null, report.id)} className="space-y-3">
          <FieldGroup label={dict.rootCauseLabel}>
            <Input name="rootCause" defaultValue={report.rootCause ?? ""} />
          </FieldGroup>
          <FieldGroup label={dict.correctiveActionLabel}>
            <Input name="correctiveAction" defaultValue={report.correctiveAction ?? ""} />
          </FieldGroup>
          <FieldGroup label={dict.preventiveActionLabel}>
            <Input name="preventiveAction" defaultValue={report.preventiveAction ?? ""} />
          </FieldGroup>
          <Button type="submit">{fullDict.common.save}</Button>
        </form>
      </Card>

      <Card className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-900">{dict.verificationTitle}</h2>
        <p className="text-xs text-slate-500">{dict.verificationSubtitle}</p>
        {report.verifiedByName ? (
          <div className="text-sm">
            <p className="text-slate-800">
              {report.verifiedByName}
              <span className="ms-2 text-xs text-slate-500">
                {report.verifiedAt ? formatDate(report.verifiedAt, "dd MMM yyyy HH:mm", locale) : ""}
              </span>
            </p>
            {report.verificationNotes && <p className="mt-1 text-xs text-slate-500">{report.verificationNotes}</p>}
          </div>
        ) : !report.rootCause?.trim() || !report.correctiveAction?.trim() ? (
          <p className="text-xs text-slate-400">{dict.verifyBlockedMessage}</p>
        ) : (
          <VerifyCapaForm reportId={report.id} currentUserLabel={currentUserLabel} />
        )}
      </Card>

      <Card>
        <h2 className="text-sm font-semibold text-slate-900">
          {dict.photosTitle} ({report.photos.length})
        </h2>
        <div className="mt-3 grid grid-cols-3 gap-3">
          {report.photos.map((p) => {
            const isImage = /\.(jpe?g|png)$/i.test(p.fileName);
            return (
              <div key={p.id} className="rounded-md border border-slate-200 p-2">
                <a
                  href={`/api/files/non-conformance-photos/${p.fileName}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block"
                >
                  {isImage ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={`/api/files/non-conformance-photos/${p.fileName}`}
                      alt={p.caption ?? p.originalName}
                      className="h-32 w-full rounded object-cover"
                    />
                  ) : (
                    <div className="flex h-32 w-full items-center justify-center rounded bg-slate-50 text-sm text-emerald-700 hover:underline">
                      {fullDict.common.viewPdf}
                    </div>
                  )}
                </a>
                {p.caption && <p className="mt-2 text-xs text-slate-700">{p.caption}</p>}
                <p className="mt-1 text-xs text-slate-400">
                  {p.uploadedBy?.name ?? fullDict.common.unknown} · {formatDate(p.createdAt, "dd MMM yyyy HH:mm", locale)}
                </p>
                <form action={removeNonConformanceReportPhotoAction.bind(null, report.id, p.id)} className="mt-1">
                  <ConfirmSubmitButton confirmMessage={dict.removePhotoConfirm}>
                    {fullDict.common.remove}
                  </ConfirmSubmitButton>
                </form>
              </div>
            );
          })}
          {report.photos.length === 0 && (
            <p className="col-span-3 py-2 text-sm text-slate-400">{dict.noPhotosYet}</p>
          )}
        </div>

        <form
          action={addNonConformanceReportPhotoAction.bind(null, report.id)}
          className="mt-4 flex flex-wrap items-end gap-3 border-t border-slate-100 pt-4"
        >
          <FieldGroup label={fullDict.common.photoOrDocument}>
            <input
              name="file"
              type="file"
              accept="image/jpeg,image/png,application/pdf"
              required
              className="block w-64 text-sm text-slate-700 file:me-3 file:rounded-md file:border file:border-slate-300 file:bg-white file:px-3 file:py-1.5 file:text-sm file:font-medium hover:file:bg-slate-50"
            />
          </FieldGroup>
          <FieldGroup label={fullDict.common.captionOptional}>
            <Input name="caption" className="w-56" placeholder={dict.photoCaptionPlaceholder} />
          </FieldGroup>
          <Button type="submit" variant="secondary">
            {fullDict.common.upload}
          </Button>
        </form>
      </Card>
    </div>
  );
}
