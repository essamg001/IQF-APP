import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/button";
import { format } from "date-fns";
import { FORMAT_LABEL } from "@/lib/format";
import { TestDataBadge, TEST_DATA_TEXT_CLASS } from "@/components/test-data-badge";
import { cn } from "@/lib/cn";

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
      microbiologyResults: { include: { testLines: true } },
      mrlResult: true,
      pallets: { include: { coldRoom: true, client: true }, orderBy: { palletNumber: "asc" } },
      qualityChecks: true,
    },
  });
  if (!lot) notFound();

  const inHouseResult = lot.microbiologyResults.find((r) => r.labType === "IN_HOUSE");
  const externalResult = lot.microbiologyResults.find((r) => r.labType === "EXTERNAL");

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
          <h1 className={cn("text-xl font-semibold text-slate-900", lot.isTestData && TEST_DATA_TEXT_CLASS)}>
            Lot {lot.lotNumber}
          </h1>
          <Badge color={lot.grade === "A" ? "green" : "amber"}>Grade {lot.grade}</Badge>
          <Badge color="slate">{FORMAT_LABEL[lot.format]}</Badge>
          {lot.isTestData && <TestDataBadge />}
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

      {lot.shift.onHold && (
        <Card className="border-red-300 bg-red-50">
          <h2 className="text-sm font-semibold text-red-800">Shift On Hold — Split Microbiology Result</h2>
          <p className="mt-1 text-sm text-red-700">{lot.shift.holdReason}</p>
          <p className="mt-1 text-xs text-slate-500">
            On hold since {lot.shift.holdSince ? format(lot.shift.holdSince, "dd MMM yyyy HH:mm") : "—"}. Every lot from
            this shift is blocked from loading/sale until this is released from the Lab section.
          </p>
        </Card>
      )}

      <Card>
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900">Microbiology / Lab Clearance Approval</h2>
          <LinkButton href="/lab" variant="secondary" className="text-xs">
            Manage in Lab section
          </LinkButton>
        </div>
        <p className="mt-1 text-xs text-slate-500">
          Every lot is tested in both our in-house lab and an external lab. Pallets cannot ship until both come back
          Approved — dispatch, results, and certificate files are managed from the Lab section; this is a read-only
          summary.
        </p>

        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          <MicroResultSummary label="In-House Lab" result={inHouseResult} />
          <MicroResultSummary label="External Lab" result={externalResult} />
        </div>
      </Card>

      <Card>
        <h2 className="text-sm font-semibold text-slate-900">MRL — Pesticide Residue Approval</h2>
        <p className="mt-1 text-xs text-slate-500">
          Also required before pallets from this lot can load out — same hard gate as microbiology.
        </p>
        <div className="mt-4">
          <MrlResultSummary result={lot.mrlResult} />
        </div>
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
                  <a
                    href={`/storage/${p.id}`}
                    className={cn("text-emerald-700 hover:underline", p.isTestData && TEST_DATA_TEXT_CLASS)}
                  >
                    {p.palletNumber}
                  </a>
                  {p.isTestData && (
                    <>
                      {" "}
                      <TestDataBadge />
                    </>
                  )}
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

type MicroResult = {
  status: string;
  certificateFileName: string | null;
  certificateNumber: string | null;
  labName: string | null;
  sentDate: Date | null;
  methodName: string | null;
  sampleId: string | null;
  protocolNumber: string | null;
  samplingBagSerial: string | null;
  samplingPlace: string | null;
  clientName: string | null;
  clientAddress: string | null;
  attentionTo: string | null;
  sampleCode: string | null;
  sampleType: string | null;
  sampleSize: string | null;
  sampleCondition: string | null;
  analysisStartDate: Date | null;
  analysisEndDate: Date | null;
  personInCharge: string | null;
  resultsSummary: string | null;
  recommendation: string | null;
  reviewedBy: string | null;
  approvedBy: string | null;
  isTestData: boolean;
  testLines: {
    testName: string | null;
    result: string | null;
    unit: string | null;
    measurementUncertainty: string | null;
    methodRef: string | null;
  }[];
} | undefined;

function MicroResultSummary({ label, result }: { label: string; result: MicroResult }) {
  const status = result?.status ?? "PENDING";
  return (
    <div className="rounded-md border border-slate-200 p-3">
      <div className="flex items-center justify-between">
        <p className="flex items-center gap-1.5 text-sm font-semibold text-slate-800">
          {label}
          {result?.isTestData && <TestDataBadge />}
        </p>
        <Badge
          color={
            status === "APPROVED"
              ? "green"
              : status === "FAILED_MINOR"
                ? "amber"
                : status === "FAILED_SEVERE"
                  ? "red"
                  : status === "SENT_TO_LAB"
                    ? "blue"
                    : "slate"
          }
        >
          {status.replace(/_/g, " ")}
        </Badge>
      </div>
      {result?.certificateFileName && (
        <a
          href={`/api/files/certificates/${result.certificateFileName}`}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-1 inline-block text-xs text-emerald-700 hover:underline"
        >
          View certificate
        </a>
      )}
      {result && (result.certificateNumber || result.labName || result.sentDate || result.sampleCode) && (
        <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 rounded-md bg-slate-50 p-3 text-xs">
          <Row label="Sent to lab" value={result.sentDate ? format(result.sentDate, "dd MMM yyyy") : undefined} />
          <Row label="Certificate #" value={result.certificateNumber} />
          <Row label="Lab" value={result.labName} />
          <Row label="Client" value={result.clientName} />
          <Row label="Client Address" value={result.clientAddress} />
          <Row label="Attention" value={result.attentionTo} />
          <Row label="Sample Code" value={result.sampleCode} />
          <Row label="Sample Type" value={result.sampleType} />
          <Row label="Sample Size" value={result.sampleSize} />
          <Row label="Sample Condition" value={result.sampleCondition} />
          <Row label="Method" value={result.methodName} />
          <Row label="Sample ID" value={result.sampleId} />
          <Row label="Protocol #" value={result.protocolNumber} />
          <Row label="Sampling bag serial" value={result.samplingBagSerial} />
          <Row label="Sampling place" value={result.samplingPlace} />
          <Row label="Analysis period" value={dateRange(result.analysisStartDate, result.analysisEndDate)} />
          <Row label="Person in charge" value={result.personInCharge} />
          <Row label="Reviewed By" value={result.reviewedBy} />
          <Row label="Approved By" value={result.approvedBy} />
          {result.testLines.length > 0 && (
            <div className="col-span-2">
              <dt className="text-slate-400">Tests</dt>
              <dd className="text-slate-700">
                {result.testLines.map((t, i) => (
                  <div key={i}>
                    {t.testName}: {t.result ?? "—"} {t.unit ?? ""}
                    {t.measurementUncertainty ? ` (MU ${t.measurementUncertainty})` : ""}
                    {t.methodRef ? ` — ${t.methodRef}` : ""}
                  </div>
                ))}
              </dd>
            </div>
          )}
          {result.resultsSummary && (
            <div className="col-span-2">
              <dt className="text-slate-400">Results</dt>
              <dd className="text-slate-700">{result.resultsSummary}</dd>
            </div>
          )}
          {result.recommendation && (
            <div className="col-span-2">
              <dt className="text-slate-400">Recommendation</dt>
              <dd className="text-slate-700">{result.recommendation}</dd>
            </div>
          )}
        </dl>
      )}
    </div>
  );
}

type MrlResult = {
  status: string;
  certificateFileName: string | null;
  certificateNumber: string | null;
  labName: string | null;
  sentDate: Date | null;
  sampleCode: string | null;
  reportDate: Date | null;
  rejectionReason: string | null;
  isTestData: boolean;
} | null | undefined;

function MrlResultSummary({ result }: { result: MrlResult }) {
  const status = result?.status ?? "PENDING";
  return (
    <div className="rounded-md border border-slate-200 p-3">
      <div className="flex items-center justify-between">
        <p className="flex items-center gap-1.5 text-sm font-semibold text-slate-800">
          MRL Result
          {result?.isTestData && <TestDataBadge />}
        </p>
        <Badge
          color={
            status === "APPROVED" ? "green" : status === "FAILED" ? "red" : status === "SENT_TO_LAB" ? "blue" : "slate"
          }
        >
          {status.replace(/_/g, " ")}
        </Badge>
      </div>
      {result?.certificateFileName && (
        <a
          href={`/api/files/certificates/${result.certificateFileName}`}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-1 inline-block text-xs text-emerald-700 hover:underline"
        >
          View certificate
        </a>
      )}
      {result && (result.certificateNumber || result.labName || result.sentDate || result.sampleCode) && (
        <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 rounded-md bg-slate-50 p-3 text-xs">
          <Row label="Sent to lab" value={result.sentDate ? format(result.sentDate, "dd MMM yyyy") : undefined} />
          <Row label="Report date" value={result.reportDate ? format(result.reportDate, "dd MMM yyyy") : undefined} />
          <Row label="Certificate #" value={result.certificateNumber} />
          <Row label="Lab" value={result.labName} />
          <Row label="Sample Code" value={result.sampleCode} />
          {result.status === "FAILED" && <Row label="Rejection reason" value={result.rejectionReason} />}
        </dl>
      )}
    </div>
  );
}
