import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input, FieldGroup } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { ConfirmSubmitButton } from "@/components/ui/confirm-submit-button";
import { limitsFor, translateLabel } from "@/lib/qualityLimits";
import { formatDate } from "@/lib/dates";
import { resolveLocale } from "@/lib/i18n/resolveLocale";
import { getDictionary } from "@/lib/i18n/getDictionary";
import { updateQualityCheckAction, deleteQualityCheckAction } from "../actions";

export default async function QualityCheckDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ edit?: string }>;
}) {
  const { id } = await params;
  const { edit } = await searchParams;
  const session = await auth();
  if (!session?.user || !["QUALITY", "OWNER", "PRODUCTION"].includes(session.user.role)) {
    redirect("/");
  }
  const canEdit = ["QUALITY", "OWNER"].includes(session.user.role);
  const editing = canEdit && edit === "1";
  const locale = await resolveLocale();
  const fullDict = getDictionary(locale);
  const dict = fullDict.qualityCheckDetail;
  const CHECKPOINT_LABEL: Record<string, string> = {
    PRE_DECAP: dict.checkpointPreDecap,
    RAW_MATERIAL: dict.checkpointRawMaterial,
    POST_DECAP: dict.checkpointPostDecap,
    POST_PACKAGING: dict.checkpointPostPackaging,
  };

  const check = await prisma.qualityCheck.findUnique({
    where: { id },
    include: {
      field: true,
      lot: true,
      pallet: true,
      harvestTicketPlotLine: true,
      inspector: true,
    },
  });
  if (!check) notFound();

  // Same rule set the form itself checks against on save -- every band this
  // checkpoint measures, alongside its limit, whether or not it happened to
  // be recorded (a value left blank still shows as "—", not silently omitted).
  const rows = limitsFor(check.checkpoint, check.lot?.grade).map((rule) => {
    const value = (check as unknown as Record<string, unknown>)[rule.field];
    const numeric = typeof value === "number" ? value : null;
    const pass = numeric == null ? null : !((rule.max != null && numeric > rule.max) || (rule.min != null && numeric < rule.min));
    return { ...rule, label: translateLabel(rule.label, locale), value: numeric, pass };
  });

  const identityFields: { label: string; value: string | number | null | undefined }[] = [
    { label: dict.sampleNo, value: check.sampleNo },
    { label: dict.receiptNoteNo, value: check.receiptNoteNo },
    { label: dict.fieldPlot, value: check.field?.name },
    { label: dict.variety, value: check.varietyName },
    { label: dict.client, value: check.clientName },
    { label: dict.lot, value: check.lot?.lotNumber },
    { label: dict.pallet, value: check.pallet?.palletNumber },
    { label: dict.shiftNumber, value: check.shiftNumber },
    { label: dict.farmCode, value: check.farmCode },
    { label: dict.rawMaterialSource, value: check.rawMaterialSource },
    { label: dict.decapPackHouse, value: check.decapPackHouse },
    { label: dict.qcApprover, value: check.decapQcApprover },
    { label: dict.processingLine, value: check.processingLine },
    { label: dict.transportVehicleNo, value: check.transportVehicleNo },
    { label: dict.numberOfBoxesPalletsReceived, value: check.numberOfBoxesReceived },
    { label: dict.harvestSupervisor, value: check.harvestSupervisor },
    {
      label: dict.sampleCollectionTime,
      value: check.sampleCollectionTime ? formatDate(check.sampleCollectionTime, "dd MMM yyyy HH:mm", locale) : null,
    },
    { label: dict.sampleWeightKg, value: check.sampleWeightKg },
    { label: dict.crateCartonWeightKg, value: check.crateWeightKg },
    { label: dict.sizeCaliber, value: check.sizeCaliber },
    { label: dict.productTemperatureC, value: check.productTemperatureC },
    { label: dict.ph, value: check.acidityPh },
    { label: dict.cleaningGoodCratesOk, value: check.cleaningGoodCratesOk == null ? null : check.cleaningGoodCratesOk ? fullDict.common.yes : fullDict.common.no },
    { label: dict.foreignOdor, value: check.foreignOdor },
    { label: dict.foreignTaste, value: check.foreignTaste },
    { label: dict.wholeDeliveryRejection, value: check.appliesToWholeDelivery ? fullDict.common.yes : null },
    { label: dict.complianceLevel, value: check.complianceLevel },
    { label: dict.divertedTo, value: check.divertedTo },
    { label: dict.inspector, value: check.inspector?.name },
  ].filter((f) => f.value != null && f.value !== "");

  const reportNonConformanceHref = `/non-conformance/new?ncType=PRODUCT&productOrReference=${encodeURIComponent(
    check.sampleNo ?? ""
  )}&description=${encodeURIComponent(`${CHECKPOINT_LABEL[check.checkpoint] ?? check.checkpoint} — sample ${check.sampleNo ?? check.id}`)}`;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">{CHECKPOINT_LABEL[check.checkpoint] ?? check.checkpoint}</h1>
          <p className="mt-1 text-sm text-slate-500">{formatDate(check.createdAt, "dd MMM yyyy HH:mm", locale)}</p>
        </div>
        {canEdit && !editing && (
          <div className="flex shrink-0 items-center gap-3">
            <Link href={reportNonConformanceHref} className="text-sm text-amber-700 hover:underline">
              {dict.reportNonConformance}
            </Link>
            <Link href={`/quality-check/${id}?edit=1`} className="text-sm text-emerald-700 hover:underline">
              {dict.editButton}
            </Link>
            <form action={deleteQualityCheckAction.bind(null, id)}>
              <ConfirmSubmitButton confirmMessage={dict.deleteConfirm}>{dict.deleteButton}</ConfirmSubmitButton>
            </form>
          </div>
        )}
      </div>

      <Card>
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900">{dict.decision}</h2>
          {check.decision && <Badge color={check.decision === "ACCEPTED" ? "green" : "red"}>{check.decision}</Badge>}
        </div>
        {!check.decision && !check.notes && !check.overrideStatus && (
          <p className="mt-2 text-sm text-slate-400">{dict.noDecisionRecorded}</p>
        )}
        {check.notes && <p className="mt-2 text-sm text-slate-600">{check.notes}</p>}
        {check.overrideStatus && (
          <div className="mt-3 border-t border-slate-100 pt-3 text-sm">
            <Badge color={check.overrideStatus === "APPROVED_AT_RISK" ? "amber" : check.overrideStatus === "REJECTED" ? "red" : "slate"}>
              {check.overrideStatus.replace(/_/g, " ")}
            </Badge>
            {check.overrideByName && (
              <p className="mt-1 text-xs text-slate-500">
                by {check.overrideByName}
                {check.overrideNote ? ` — ${check.overrideNote}` : ""}
                {check.overrideAt ? ` · ${formatDate(check.overrideAt, "dd MMM yyyy HH:mm", locale)}` : ""}
              </p>
            )}
          </div>
        )}
      </Card>

      {identityFields.length > 0 && (
        <Card>
          <h2 className="text-sm font-semibold text-slate-900">{dict.deliveryIdentity}</h2>
          <dl className="mt-3 grid grid-cols-3 gap-x-6 gap-y-2 text-sm">
            {identityFields.map((f) => (
              <div key={f.label} className="flex justify-between gap-4">
                <dt className="text-slate-500">{f.label}</dt>
                <dd className="text-end text-slate-800">{f.value}</dd>
              </div>
            ))}
          </dl>
        </Card>
      )}

      {editing ? (
        <Card>
          <h2 className="text-sm font-semibold text-slate-900">{dict.physicalMeasurementsDefects}</h2>
          <p className="text-xs text-slate-500">{dict.bandByBandSubtitle}</p>
          <form action={updateQualityCheckAction.bind(null, id)} className="mt-4 space-y-4">
            <div className="grid grid-cols-4 gap-3">
              {rows.map((r) => (
                <FieldGroup key={r.field} label={`${r.label} (${r.max != null ? `≤${r.max}` : `≥${r.min}`})`}>
                  <Input name={r.field} type="number" step="0.01" defaultValue={r.value ?? ""} />
                </FieldGroup>
              ))}
            </div>
            <FieldGroup label={dict.notesLabel}>
              <Input name="notes" defaultValue={check.notes ?? ""} />
            </FieldGroup>
            <div className="flex gap-3">
              <Button type="submit">{dict.saveButton}</Button>
              <Link href={`/quality-check/${id}`} className="inline-flex items-center text-sm text-slate-500 hover:underline">
                {dict.cancelButton}
              </Link>
            </div>
          </form>
        </Card>
      ) : (
        <Card className="overflow-x-auto p-0">
          <div className="px-4 py-3">
            <h2 className="text-sm font-semibold text-slate-900">{dict.physicalMeasurementsDefects}</h2>
            <p className="text-xs text-slate-500">{dict.bandByBandSubtitle}</p>
          </div>
          <table className="w-full text-start text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-slate-500">
              <tr>
                <th className="px-4 py-2 font-medium">{dict.colBand}</th>
                <th className="px-4 py-2 font-medium">{dict.colRecordedValue}</th>
                <th className="px-4 py-2 font-medium">{dict.colLimit}</th>
                <th className="px-4 py-2 font-medium">{dict.colResult}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.field} className="border-b border-slate-100 last:border-0">
                  <td className="px-4 py-2">{r.label}</td>
                  <td className="px-4 py-2">{r.value != null ? r.value : "—"}</td>
                  <td className="px-4 py-2 text-slate-500">{r.max != null ? `≤ ${r.max}%` : `≥ ${r.min}%`}</td>
                  <td className="px-4 py-2">
                    {r.pass == null ? (
                      <span className="text-slate-400">—</span>
                    ) : (
                      <Badge color={r.pass ? "green" : "red"}>{r.pass ? dict.pass : dict.fail}</Badge>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
