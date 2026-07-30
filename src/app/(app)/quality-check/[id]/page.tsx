import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { notFound, redirect } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { limitsFor } from "@/lib/qualityLimits";
import { format } from "date-fns";

const CHECKPOINT_LABEL: Record<string, string> = {
  PRE_DECAP: "Pre-Decap Arrival (STR03101)",
  RAW_MATERIAL: "Arrival Inspection at Factory (STR03110)",
  POST_DECAP: "Post-Decap Quality (STR03107)",
  POST_PACKAGING: "Post-Freeze Inspection (STR03111 / STR03116)",
};

export default async function QualityCheckDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user || !["QUALITY", "OWNER", "PRODUCTION"].includes(session.user.role)) {
    redirect("/");
  }

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
    { label: "Sample No.", value: check.sampleNo },
    { label: "Receipt Note No.", value: check.receiptNoteNo },
    { label: "Field / Plot", value: check.field?.name },
    { label: "Variety", value: check.varietyName },
    { label: "Client", value: check.clientName },
    { label: "Lot", value: check.lot?.lotNumber },
    { label: "Pallet", value: check.pallet?.palletNumber },
    { label: "Shift #", value: check.shiftNumber },
    { label: "Farm Code", value: check.farmCode },
    { label: "Raw Material Source", value: check.rawMaterialSource },
    { label: "Decapping Pack House", value: check.decapPackHouse },
    { label: "QC Approver (Pack House)", value: check.decapQcApprover },
    { label: "Processing Line", value: check.processingLine },
    { label: "Transport Vehicle No.", value: check.transportVehicleNo },
    { label: "Number of Boxes/Pallets Received", value: check.numberOfBoxesReceived },
    { label: "Harvest Supervisor", value: check.harvestSupervisor },
    { label: "Sample Collection Time", value: check.sampleCollectionTime ? format(check.sampleCollectionTime, "dd MMM yyyy HH:mm") : null },
    { label: "Sample Weight (kg)", value: check.sampleWeightKg },
    { label: "Crate/Carton Weight (kg)", value: check.crateWeightKg },
    { label: "Size Caliber", value: check.sizeCaliber },
    { label: "Product Temperature (°C)", value: check.productTemperatureC },
    { label: "PH", value: check.acidityPh },
    { label: "Cleaning / Good Crates OK", value: check.cleaningGoodCratesOk == null ? null : check.cleaningGoodCratesOk ? "Yes" : "No" },
    { label: "Foreign Odor", value: check.foreignOdor },
    { label: "Foreign Taste", value: check.foreignTaste },
    { label: "Whole-Delivery Rejection", value: check.appliesToWholeDelivery ? "Yes" : null },
    { label: "Compliance Level", value: check.complianceLevel },
    { label: "Diverted To", value: check.divertedTo },
    { label: "Inspector", value: check.inspector?.name },
  ].filter((f) => f.value != null && f.value !== "");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">{CHECKPOINT_LABEL[check.checkpoint] ?? check.checkpoint}</h1>
        <p className="mt-1 text-sm text-slate-500">{format(check.createdAt, "dd MMM yyyy HH:mm")}</p>
      </div>

      <Card>
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900">Decision</h2>
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
          <h2 className="text-sm font-semibold text-slate-900">Delivery Identity</h2>
          <dl className="mt-3 grid grid-cols-3 gap-x-6 gap-y-2 text-sm">
            {identityFields.map((f) => (
              <div key={f.label} className="flex justify-between gap-4">
                <dt className="text-slate-500">{f.label}</dt>
                <dd className="text-right text-slate-800">{f.value}</dd>
              </div>
            ))}
          </dl>
        </Card>
      )}

      <Card className="overflow-x-auto p-0">
        <div className="px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-900">Physical Measurements &amp; Defects — Band by Band</h2>
          <p className="text-xs text-slate-500">Every metric this checkpoint measures, against its own printed limit.</p>
        </div>
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-slate-500">
            <tr>
              <th className="px-4 py-2 font-medium">Band</th>
              <th className="px-4 py-2 font-medium">Recorded Value</th>
              <th className="px-4 py-2 font-medium">Limit</th>
              <th className="px-4 py-2 font-medium">Result</th>
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
                    <Badge color={r.pass ? "green" : "red"}>{r.pass ? "Pass" : "Fail"}</Badge>
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
