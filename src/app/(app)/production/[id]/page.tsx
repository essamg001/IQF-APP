import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/button";
import { format } from "date-fns";
import { FORMAT_LABEL } from "@/lib/format";
import { TestDataBadge, TEST_DATA_TEXT_CLASS } from "@/components/test-data-badge";
import { cn } from "@/lib/cn";
import { resolveLocale } from "@/lib/i18n/resolveLocale";
import { getDictionary } from "@/lib/i18n/getDictionary";

type ProductionDict = ReturnType<typeof getDictionary>["production"];

const PALLET_STATUS_COLOR = {
  IN_STORAGE: "slate",
  ALLOCATED: "blue",
  SHIPPED: "green",
  WASTE: "red",
  DISCOUNT_OFFERED: "amber",
} as const;

export default async function LotDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const fullDict = getDictionary(await resolveLocale());
  const dict = fullDict.production;
  const PALLET_STATUS_LABEL: Record<string, string> = {
    IN_STORAGE: fullDict.storage.statusInStorage,
    ALLOCATED: fullDict.storage.statusAllocated,
    SHIPPED: fullDict.storage.statusShipped,
    WASTE: fullDict.storage.statusWaste,
    DISCOUNT_OFFERED: fullDict.storage.statusDiscountOffered,
  };
  const MICRO_STATUS_LABEL: Record<string, string> = {
    PENDING: fullDict.lab.statusPending,
    SENT_TO_LAB: fullDict.lab.statusSentToLab,
    APPROVED: fullDict.lab.statusApproved,
    FAILED_MINOR: fullDict.lab.statusFailedMinor,
    FAILED_SEVERE: fullDict.lab.statusFailedSevere,
    ON_HOLD: fullDict.lab.statusOnHold,
  };
  const MRL_STATUS_LABEL: Record<string, string> = {
    PENDING: fullDict.lab.statusPending,
    SENT_TO_LAB: fullDict.lab.statusSentToLab,
    APPROVED: fullDict.lab.statusApproved,
    FAILED: fullDict.lab.statusFailedSevere,
  };

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
      // A still-open shift (no end time yet) has no upper bound -- anything
      // from its start onward could still be part of the mix.
      createdAt: { gte: lot.shift.startTime, ...(lot.shift.endTime ? { lte: lot.shift.endTime } : {}) },
    },
    include: { field: true },
  });
  const contributingFields = [...new Map(contributingChecks.map((c) => [c.fieldId, c.field!.name])).values()].sort();

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <h1 className={cn("text-xl font-semibold text-slate-900", lot.isTestData && TEST_DATA_TEXT_CLASS)}>
            {dict.lotTitle.replace("{number}", lot.lotNumber)}
          </h1>
          <Badge color={lot.grade === "A" ? "green" : "amber"}>{dict.gradeLabel.replace("{grade}", lot.grade)}</Badge>
          <Badge color="slate">{FORMAT_LABEL[lot.format]}</Badge>
          {lot.isTestData && <TestDataBadge />}
        </div>
        <p className="mt-1 text-sm text-slate-500">
          {dict.shiftLine
            .replace("{factory}", lot.factory.name)
            .replace("{date}", format(lot.shift.date, "dd MMM yyyy"))
            .replace("{field}", lot.field.name)}
        </p>
      </div>

      <Card>
        <h2 className="text-sm font-semibold text-slate-900">{dict.fieldsSupplyingTitle}</h2>
        <p className="mt-1 text-xs text-slate-500">
          {dict.fieldsSupplyingSubtitle.replace(
            "{window}",
            `${format(lot.shift.startTime, "HH:mm")}–${lot.shift.endTime ? format(lot.shift.endTime, "HH:mm") : dict.now}`
          )}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {contributingFields.map((name) => (
            <Badge key={name} color="slate">
              {name}
            </Badge>
          ))}
          {contributingFields.length === 0 && (
            <p className="text-sm text-slate-400">{dict.noPostDecapChecksInWindow}</p>
          )}
        </div>
      </Card>

      {lot.shift.onHold && (
        <Card className="border-red-300 bg-red-50">
          <h2 className="text-sm font-semibold text-red-800">{dict.shiftOnHoldTitle}</h2>
          <p className="mt-1 text-sm text-red-700">{lot.shift.holdReason}</p>
          <p className="mt-1 text-xs text-slate-500">
            {dict.onHoldSinceLabel.replace(
              "{date}",
              lot.shift.holdSince ? format(lot.shift.holdSince, "dd MMM yyyy HH:mm") : "—"
            )}
          </p>
        </Card>
      )}

      <Card>
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900">{dict.microbiologyApprovalTitle}</h2>
          <LinkButton href="/lab" variant="secondary" className="text-xs">
            {dict.manageInLabSection}
          </LinkButton>
        </div>
        <p className="mt-1 text-xs text-slate-500">{dict.microbiologySubtitle}</p>

        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          <MicroResultSummary label={dict.inHouseLabLabel} result={inHouseResult} dict={dict} statusLabel={MICRO_STATUS_LABEL} />
          <MicroResultSummary label={dict.externalLabLabel} result={externalResult} dict={dict} statusLabel={MICRO_STATUS_LABEL} />
        </div>
      </Card>

      <Card>
        <h2 className="text-sm font-semibold text-slate-900">{dict.mrlApprovalTitle}</h2>
        <p className="mt-1 text-xs text-slate-500">{dict.mrlApprovalSubtitle}</p>
        <div className="mt-4">
          <MrlResultSummary result={lot.mrlResult} dict={dict} statusLabel={MRL_STATUS_LABEL} />
        </div>
      </Card>

      <Card>
        <h2 className="text-sm font-semibold text-slate-900">{dict.qualityChecksTitle}</h2>
        {lot.qualityChecks.length === 0 && (
          <p className="mt-2 text-sm text-slate-400">{dict.noQualityChecksYet}</p>
        )}
        <ul className="mt-2 space-y-2">
          {lot.qualityChecks.map((q) => (
            <li key={q.id} className="rounded-md border border-slate-200 p-2 text-sm">
              <div className="flex justify-between">
                <span className="font-medium">
                  {q.checkpoint === "RAW_MATERIAL" ? dict.checkpointRawMaterial : dict.checkpointPostPackaging}
                </span>
                <span className="text-slate-500">{dict.brixLabel.replace("{value}", String(q.brix))}</span>
              </div>
              <p className="text-xs text-slate-500">
                {dict.mouldSkinInternalLine
                  .replace("{mould}", String(q.mouldPct ?? "—"))
                  .replace("{skin}", String(q.skinDamagePct))
                  .replace("{internal}", String(q.internalQualityPct))}
              </p>
            </li>
          ))}
        </ul>
      </Card>

      <Card className="overflow-x-auto p-0">
        <h2 className="px-4 py-3 text-sm font-semibold text-slate-900">
          {dict.palletsTitle.replace("{count}", String(lot.pallets.length))}
        </h2>
        <table className="w-full text-start text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-slate-500">
            <tr>
              <th className="px-4 py-2 font-medium">{dict.colPalletNumber}</th>
              <th className="px-4 py-2 font-medium">{dict.colColdRoom}</th>
              <th className="px-4 py-2 font-medium">{dict.colWeight}</th>
              <th className="px-4 py-2 font-medium">{dict.colStatus}</th>
              <th className="px-4 py-2 font-medium">{dict.colClient}</th>
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
                  <Badge color={PALLET_STATUS_COLOR[p.status]}>{PALLET_STATUS_LABEL[p.status] ?? p.status}</Badge>
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

function MicroResultSummary({
  label,
  result,
  dict,
  statusLabel,
}: {
  label: string;
  result: MicroResult;
  dict: ProductionDict;
  statusLabel: Record<string, string>;
}) {
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
          {statusLabel[status] ?? status}
        </Badge>
      </div>
      {result?.certificateFileName && (
        <a
          href={`/api/files/certificates/${result.certificateFileName}`}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-1 inline-block text-xs text-emerald-700 hover:underline"
        >
          {dict.viewCertificate}
        </a>
      )}
      {result && (result.certificateNumber || result.labName || result.sentDate || result.sampleCode) && (
        <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 rounded-md bg-slate-50 p-3 text-xs">
          <Row label={dict.sentToLabLabel} value={result.sentDate ? format(result.sentDate, "dd MMM yyyy") : undefined} />
          <Row label={dict.certificateNumberLabel} value={result.certificateNumber} />
          <Row label={dict.labLabel} value={result.labName} />
          <Row label={dict.clientLabel} value={result.clientName} />
          <Row label={dict.clientAddressLabel} value={result.clientAddress} />
          <Row label={dict.attentionLabel} value={result.attentionTo} />
          <Row label={dict.sampleCodeLabel} value={result.sampleCode} />
          <Row label={dict.sampleTypeLabel} value={result.sampleType} />
          <Row label={dict.sampleSizeLabel} value={result.sampleSize} />
          <Row label={dict.sampleConditionLabel} value={result.sampleCondition} />
          <Row label={dict.methodLabel} value={result.methodName} />
          <Row label={dict.sampleIdLabel} value={result.sampleId} />
          <Row label={dict.protocolNumberLabel} value={result.protocolNumber} />
          <Row label={dict.samplingBagSerialLabel} value={result.samplingBagSerial} />
          <Row label={dict.samplingPlaceLabel} value={result.samplingPlace} />
          <Row label={dict.analysisPeriodLabel} value={dateRange(result.analysisStartDate, result.analysisEndDate)} />
          <Row label={dict.personInChargeLabel} value={result.personInCharge} />
          <Row label={dict.reviewedByLabel} value={result.reviewedBy} />
          <Row label={dict.approvedByLabel} value={result.approvedBy} />
          {result.testLines.length > 0 && (
            <div className="col-span-2">
              <dt className="text-slate-400">{dict.testsLabel}</dt>
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
              <dt className="text-slate-400">{dict.resultsLabel}</dt>
              <dd className="text-slate-700">{result.resultsSummary}</dd>
            </div>
          )}
          {result.recommendation && (
            <div className="col-span-2">
              <dt className="text-slate-400">{dict.recommendationLabel}</dt>
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

function MrlResultSummary({
  result,
  dict,
  statusLabel,
}: {
  result: MrlResult;
  dict: ProductionDict;
  statusLabel: Record<string, string>;
}) {
  const status = result?.status ?? "PENDING";
  return (
    <div className="rounded-md border border-slate-200 p-3">
      <div className="flex items-center justify-between">
        <p className="flex items-center gap-1.5 text-sm font-semibold text-slate-800">
          {dict.mrlResultLabel}
          {result?.isTestData && <TestDataBadge />}
        </p>
        <Badge
          color={
            status === "APPROVED" ? "green" : status === "FAILED" ? "red" : status === "SENT_TO_LAB" ? "blue" : "slate"
          }
        >
          {statusLabel[status] ?? status}
        </Badge>
      </div>
      {result?.certificateFileName && (
        <a
          href={`/api/files/certificates/${result.certificateFileName}`}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-1 inline-block text-xs text-emerald-700 hover:underline"
        >
          {dict.viewCertificate}
        </a>
      )}
      {result && (result.certificateNumber || result.labName || result.sentDate || result.sampleCode) && (
        <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 rounded-md bg-slate-50 p-3 text-xs">
          <Row label={dict.sentToLabLabel} value={result.sentDate ? format(result.sentDate, "dd MMM yyyy") : undefined} />
          <Row label={dict.reportDateLabel} value={result.reportDate ? format(result.reportDate, "dd MMM yyyy") : undefined} />
          <Row label={dict.certificateNumberLabel} value={result.certificateNumber} />
          <Row label={dict.labLabel} value={result.labName} />
          <Row label={dict.sampleCodeLabel} value={result.sampleCode} />
          {result.status === "FAILED" && <Row label={dict.rejectionReasonLabel} value={result.rejectionReason} />}
        </dl>
      )}
    </div>
  );
}
