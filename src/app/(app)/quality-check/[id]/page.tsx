import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { notFound, redirect } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { limitsFor } from "@/lib/qualityLimits";
import { format } from "date-fns";
import { resolveLocale } from "@/lib/i18n/resolveLocale";
import { getDictionary } from "@/lib/i18n/getDictionary";

export default async function QualityCheckDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user || !["QUALITY", "OWNER", "PRODUCTION"].includes(session.user.role)) {
    redirect("/");
  }
  const fullDict = getDictionary(await resolveLocale());
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
    return { ...rule, value: numeric, pass };
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
    { label: dict.sampleCollectionTime, value: check.sampleCollectionTime ? format(check.sampleCollectionTime, "dd MMM yyyy HH:mm") : null },
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">{CHECKPOINT_LABEL[check.checkpoint] ?? check.checkpoint}</h1>
        <p className="mt-1 text-sm text-slate-500">{format(check.createdAt, "dd MMM yyyy HH:mm")}</p>
      </div>

      <Card>
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900">{dict.decision}</h2>
          {check.decision && <Badge color={check.decision === "ACCEPTED" ? "green" : "red"}>{check.decision}</Badge>}
        </div>
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
                {check.overrideAt ? ` · ${format(check.overrideAt, "dd MMM yyyy HH:mm")}` : ""}
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
    </div>
  );
}
