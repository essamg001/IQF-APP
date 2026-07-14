import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, FieldGroup, Input } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { updateMicrobiologyAction } from "../actions-micro";
import { FORMAT_LABEL } from "@/lib/format";

const PALLET_STATUS_COLOR = {
  IN_STORAGE: "slate",
  ALLOCATED: "blue",
  SHIPPED: "green",
  WASTE: "red",
  DISCOUNT_OFFERED: "amber",
} as const;

export default async function LotDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const lot = await prisma.productionLot.findUnique({
    where: { id },
    include: {
      shift: { include: { factory: true } },
      factory: true,
      field: true,
      microbiologyResult: true,
      pallets: { include: { coldRoom: true, client: true }, orderBy: { palletNumber: "asc" } },
      qualityChecks: true,
    },
  });
  if (!lot) notFound();

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-semibold text-slate-900">Lot {lot.lotNumber}</h1>
          <Badge color={lot.grade === "A" ? "green" : "amber"}>Grade {lot.grade}</Badge>
          <Badge color="slate">{FORMAT_LABEL[lot.format]}</Badge>
        </div>
        <p className="mt-1 text-sm text-slate-500">
          {lot.factory.name} · {format(lot.shift.date, "dd MMM yyyy")} shift · Field: {lot.field.name}
        </p>
      </div>

      <Card>
        <h2 className="text-sm font-semibold text-slate-900">Microbiology / Lab Clearance Approval</h2>
        <p className="mt-1 text-xs text-slate-500">
          Pallets cannot ship until this lot is approved. Severe failures move pallets to waste automatically;
          minor failures offer pallets at a discount. Fields below are transcribed from the lab&apos;s test certificate.
        </p>

        {lot.microbiologyResult && (lot.microbiologyResult.certificateNumber || lot.microbiologyResult.labName) && (
          <dl className="mt-4 grid grid-cols-3 gap-x-4 gap-y-1 rounded-md bg-slate-50 p-3 text-xs">
            <Row label="Certificate #" value={lot.microbiologyResult.certificateNumber} />
            <Row label="Lab" value={lot.microbiologyResult.labName} />
            <Row label="Method" value={lot.microbiologyResult.methodName} />
            <Row label="Sample ID" value={lot.microbiologyResult.sampleId} />
            <Row label="Protocol #" value={lot.microbiologyResult.protocolNumber} />
            <Row label="Sampling bag serial" value={lot.microbiologyResult.samplingBagSerial} />
            <Row label="Sampling place" value={lot.microbiologyResult.samplingPlace} />
            <Row label="Analysis period" value={dateRange(lot.microbiologyResult.analysisStartDate, lot.microbiologyResult.analysisEndDate)} />
            <Row label="Person in charge" value={lot.microbiologyResult.personInCharge} />
            {lot.microbiologyResult.resultsSummary && (
              <div className="col-span-3">
                <dt className="text-slate-400">Results</dt>
                <dd className="text-slate-700">{lot.microbiologyResult.resultsSummary}</dd>
              </div>
            )}
          </dl>
        )}

        <form action={updateMicrobiologyAction.bind(null, lot.id)} className="mt-4 space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <FieldGroup label="Status">
              <Select name="status" defaultValue={lot.microbiologyResult?.status ?? "PENDING"}>
                <option value="PENDING">Pending</option>
                <option value="APPROVED">Approved</option>
                <option value="FAILED_MINOR">Failed — Minor</option>
                <option value="FAILED_SEVERE">Failed — Severe</option>
              </Select>
            </FieldGroup>
            <FieldGroup label="Certificate Number">
              <Input name="certificateNumber" defaultValue={lot.microbiologyResult?.certificateNumber ?? ""} />
            </FieldGroup>
            <FieldGroup label="Lab Name">
              <Input name="labName" defaultValue={lot.microbiologyResult?.labName ?? ""} />
            </FieldGroup>
            <FieldGroup label="Sample ID">
              <Input name="sampleId" defaultValue={lot.microbiologyResult?.sampleId ?? ""} />
            </FieldGroup>
            <FieldGroup label="Protocol Number">
              <Input name="protocolNumber" defaultValue={lot.microbiologyResult?.protocolNumber ?? ""} />
            </FieldGroup>
            <FieldGroup label="Sampling Bag Serial">
              <Input name="samplingBagSerial" defaultValue={lot.microbiologyResult?.samplingBagSerial ?? ""} />
            </FieldGroup>
            <FieldGroup label="Sampling Place">
              <Input name="samplingPlace" defaultValue={lot.microbiologyResult?.samplingPlace ?? ""} />
            </FieldGroup>
            <FieldGroup label="Method Name">
              <Input name="methodName" defaultValue={lot.microbiologyResult?.methodName ?? ""} />
            </FieldGroup>
            <FieldGroup label="Person In Charge">
              <Input name="personInCharge" defaultValue={lot.microbiologyResult?.personInCharge ?? ""} />
            </FieldGroup>
            <FieldGroup label="Analysis Start Date">
              <Input
                name="analysisStartDate"
                type="date"
                defaultValue={lot.microbiologyResult?.analysisStartDate?.toISOString().slice(0, 10) ?? ""}
              />
            </FieldGroup>
            <FieldGroup label="Analysis End Date">
              <Input
                name="analysisEndDate"
                type="date"
                defaultValue={lot.microbiologyResult?.analysisEndDate?.toISOString().slice(0, 10) ?? ""}
              />
            </FieldGroup>
          </div>
          <FieldGroup label="Results Summary">
            <Input
              name="resultsSummary"
              placeholder="e.g. Chlorates: Not detected. Perchlorates: Not detected."
              defaultValue={lot.microbiologyResult?.resultsSummary ?? ""}
            />
          </FieldGroup>
          <FieldGroup label="Notes">
            <Input name="notes" defaultValue={lot.microbiologyResult?.notes ?? ""} />
          </FieldGroup>
          <Button type="submit" variant="secondary">
            Update result
          </Button>
        </form>
      </Card>

      <Card>
        <h2 className="text-sm font-semibold text-slate-900">Quality Checks</h2>
        {lot.qualityChecks.length === 0 && (
          <p className="mt-2 text-sm text-slate-400">No quality checks logged for this lot yet.</p>
        )}
        <ul className="mt-2 space-y-2">
          {lot.qualityChecks.map((q) => (
            <li key={q.id} className="rounded-md border border-slate-200 p-2 text-sm">
              <div className="flex justify-between">
                <span className="font-medium">{q.checkpoint === "RAW_MATERIAL" ? "Raw Material" : "Post-Packaging"}</span>
                <span className="text-slate-500">Brix {q.brix}</span>
              </div>
              <p className="text-xs text-slate-500">
                Mould {q.mouldPct}% · Skin damage {q.skinDamagePct}% · Internal quality {q.internalQualityPct}%
              </p>
            </li>
          ))}
        </ul>
      </Card>

      <Card className="overflow-x-auto p-0">
        <h2 className="px-4 py-3 text-sm font-semibold text-slate-900">Pallets ({lot.pallets.length})</h2>
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-slate-500">
            <tr>
              <th className="px-4 py-2 font-medium">Pallet #</th>
              <th className="px-4 py-2 font-medium">Cold Room</th>
              <th className="px-4 py-2 font-medium">Weight</th>
              <th className="px-4 py-2 font-medium">Status</th>
              <th className="px-4 py-2 font-medium">Client</th>
            </tr>
          </thead>
          <tbody>
            {lot.pallets.map((p) => (
              <tr key={p.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                <td className="px-4 py-2">
                  <a href={`/storage/${p.id}`} className="text-emerald-700 hover:underline">
                    {p.palletNumber}
                  </a>
                </td>
                <td className="px-4 py-2">{p.coldRoom?.name ?? "—"}</td>
                <td className="px-4 py-2">{p.weightTonnes}t</td>
                <td className="px-4 py-2">
                  <Badge color={PALLET_STATUS_COLOR[p.status]}>{p.status.replace("_", " ")}</Badge>
                </td>
                <td className="px-4 py-2">{p.client?.name ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

function Row({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div>
      <dt className="text-slate-400">{label}</dt>
      <dd className="text-slate-700">{value}</dd>
    </div>
  );
}

function dateRange(start?: Date | null, end?: Date | null) {
  if (!start && !end) return undefined;
  const fmt = (d: Date) => format(d, "dd MMM yyyy");
  if (start && end) return `${fmt(start)} – ${fmt(end)}`;
  return fmt((start ?? end) as Date);
}
