import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/button";
import { format } from "date-fns";
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

  // Fruit is mixed at the decap facility before being split across both
  // factories, so a lot's fruit isn't traceable to one exact field -- this is
  // the honest list of every field whose fruit cleared Post-Decap Quality
  // during this shift's time window, any of which could be present in the mix.
  const contributingChecks = await prisma.qualityCheck.findMany({
    where: {
      checkpoint: "POST_DECAP",
      decision: "ACCEPTED",
      fieldId: { not: null },
      createdAt: { gte: lot.shift.startTime, lte: lot.shift.endTime },
    },
    include: { field: true },
  });
  const contributingFields = [...new Map(contributingChecks.map((c) => [c.fieldId, c.field!.name])).values()].sort();

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
        <h2 className="text-sm font-semibold text-slate-900">Fields Supplying This Shift</h2>
        <p className="mt-1 text-xs text-slate-500">
          Fruit is mixed at the decap facility and the mix is split across both factories, so this lot isn&apos;t
          traceable to one exact field — this is every field that cleared Post-Decap Quality during this shift&apos;s
          time window ({format(lot.shift.startTime, "HH:mm")}–{format(lot.shift.endTime, "HH:mm")}), any of which
          could be present in the mix.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {contributingFields.map((name) => (
            <Badge key={name} color="slate">
              {name}
            </Badge>
          ))}
          {contributingFields.length === 0 && (
            <p className="text-sm text-slate-400">No Post-Decap Quality checks logged in this shift&apos;s window.</p>
          )}
        </div>
      </Card>

      <Card>
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900">Microbiology / Lab Clearance Approval</h2>
          <LinkButton href="/lab" variant="secondary" className="text-xs">
            Manage in Lab section
          </LinkButton>
        </div>
        <p className="mt-1 text-xs text-slate-500">
          Pallets cannot ship until this lot is approved. Dispatch, results, and the certificate file are managed
          from the Lab section — this is a read-only summary.
        </p>

        <div className="mt-4 flex items-center gap-2">
          <Badge
            color={
              lot.microbiologyResult?.status === "APPROVED"
                ? "green"
                : lot.microbiologyResult?.status === "FAILED_MINOR"
                  ? "amber"
                  : lot.microbiologyResult?.status === "FAILED_SEVERE"
                    ? "red"
                    : lot.microbiologyResult?.status === "SENT_TO_LAB"
                      ? "blue"
                      : "slate"
          }
          >
            {(lot.microbiologyResult?.status ?? "PENDING").replace(/_/g, " ")}
          </Badge>
          {lot.microbiologyResult?.certificateFileName && (
            <a
              href={`/api/files/certificates/${lot.microbiologyResult.certificateFileName}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-emerald-700 hover:underline"
            >
              View certificate
            </a>
          )}
        </div>

        {lot.microbiologyResult && (lot.microbiologyResult.certificateNumber || lot.microbiologyResult.labName || lot.microbiologyResult.sentDate) && (
          <dl className="mt-4 grid grid-cols-3 gap-x-4 gap-y-1 rounded-md bg-slate-50 p-3 text-xs">
            <Row label="Sent to lab" value={lot.microbiologyResult.sentDate ? format(lot.microbiologyResult.sentDate, "dd MMM yyyy") : undefined} />
            <Row label="Tracking ref" value={lot.microbiologyResult.trackingRef} />
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
