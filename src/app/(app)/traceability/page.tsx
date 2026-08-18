import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { formatDate } from "@/lib/dates";
import { TestDataBadge, TEST_DATA_TEXT_CLASS } from "@/components/test-data-badge";
import { cn } from "@/lib/cn";
import { resolveLocale } from "@/lib/i18n/resolveLocale";
import { getDictionary } from "@/lib/i18n/getDictionary";
import type { Dictionary } from "@/lib/i18n/dictionaries/en";

const PALLET_STATUS_COLOR = {
  IN_STORAGE: "slate",
  ALLOCATED: "blue",
  SHIPPED: "green",
  WASTE: "red",
  DISCOUNT_OFFERED: "amber",
} as const;

function palletStatusLabel(storageDict: Dictionary["storage"], status: keyof typeof PALLET_STATUS_COLOR) {
  return {
    IN_STORAGE: storageDict.statusInStorage,
    ALLOCATED: storageDict.statusAllocated,
    SHIPPED: storageDict.statusShipped,
    WASTE: storageDict.statusWaste,
    DISCOUNT_OFFERED: storageDict.statusDiscountOffered,
  }[status];
}

export default async function TraceabilityPage({
  searchParams,
}: {
  searchParams: Promise<{ field?: string }>;
}) {
  const session = await auth();
  if (!session?.user || !["QUALITY", "OWNER"].includes(session.user.role)) {
    redirect("/");
  }

  const locale = await resolveLocale();
  const fullDict = getDictionary(locale);
  const dict = fullDict.traceability;
  const FORMAT_LABEL: Record<string, string> = {
    WHOLE: fullDict.storage.formatWhole,
    SLICED: fullDict.storage.formatSliced,
    DICED: fullDict.storage.formatDiced,
  };

  const { field: fieldName } = await searchParams;

  const fields = await prisma.field.findMany({
    where: { farmName: { not: null }, variety: "MS1" },
    orderBy: [{ farmName: "asc" }, { station: "asc" }, { valve: "asc" }],
  });

  const field = fieldName ? fields.find((f) => f.name === fieldName.trim()) : undefined;
  const notFoundMessage =
    fieldName && !field ? dict.notFoundMessage.replace("{field}", fieldName) : undefined;

  let directLots: Awaited<ReturnType<typeof loadDirectLots>> = [];
  let possibleLots: Awaited<ReturnType<typeof loadDirectLots>> = [];
  let preDecapRecords: Awaited<ReturnType<typeof loadPreDecapRecords>> = [];

  if (field) {
    [directLots, preDecapRecords] = await Promise.all([loadDirectLots(field.id), loadPreDecapRecords(field.id)]);

    const contributingChecks = await prisma.qualityCheck.findMany({
      where: { checkpoint: "POST_DECAP", decision: "ACCEPTED", fieldId: field.id },
      select: { createdAt: true },
    });

    if (contributingChecks.length > 0) {
      const times = contributingChecks.map((c) => c.createdAt.getTime());
      const minTime = new Date(Math.min(...times));
      const maxTime = new Date(Math.max(...times));

      const candidateLots = await prisma.productionLot.findMany({
        where: {
          fieldId: { not: field.id },
          // A still-open shift (no end time yet) has no upper bound -- for a
          // food-safety recall lookup, treat it as possibly still running
          // rather than silently excluding it (SQL comparisons against NULL
          // are never true, so `endTime: { gte: minTime }` alone would drop
          // it).
          shift: { startTime: { lte: maxTime }, OR: [{ endTime: { gte: minTime } }, { endTime: null }] },
        },
        include: lotInclude,
      });

      possibleLots = candidateLots.filter((lot) =>
        times.some(
          (t) => t >= lot.shift.startTime.getTime() && (lot.shift.endTime == null || t <= lot.shift.endTime.getTime())
        )
      );
    }
  }

  const affectedLots = [...directLots, ...possibleLots];
  const allPallets = affectedLots.flatMap((lot) =>
    lot.pallets.map((p) => ({ ...p, lotNumber: lot.lotNumber, lotIsTestData: lot.isTestData }))
  );
  const affectedClients = [...new Map(allPallets.filter((p) => p.client).map((p) => [p.client!.id, p.client!.name])).values()];
  const inStoragePallets = allPallets.filter((p) => p.status === "IN_STORAGE" || p.status === "ALLOCATED");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">{dict.title}</h1>
        <p className="mt-1 text-sm text-slate-500">{dict.subtitle}</p>
      </div>

      <Card>
        <form className="flex items-end gap-3">
          <div className="flex-1">
            <label className="mb-1 block text-sm font-medium text-slate-700">{dict.fieldPlotLabel}</label>
            <Input
              name="field"
              defaultValue={fieldName ?? ""}
              list="traceability-field-suggestions"
              placeholder={dict.fieldPlaceholder}
            />
            <datalist id="traceability-field-suggestions">
              {fields.map((f) => (
                <option key={f.id} value={f.name} />
              ))}
            </datalist>
          </div>
          <Button type="submit">{dict.lookUp}</Button>
        </form>
        {notFoundMessage && <p className="mt-2 text-sm text-red-600">{notFoundMessage}</p>}
      </Card>

      {field && (
        <>
          <Card>
            <h2 className="text-sm font-semibold text-slate-900">
              {dict.summaryTitle.replace("{field}", field.name)}
            </h2>
            <div className="mt-3 flex flex-wrap gap-4 text-sm text-slate-600">
              <span>
                <strong className="text-slate-900">{affectedLots.length}</strong> {dict.lotsAffected}
              </span>
              <span>
                <strong className="text-slate-900">{allPallets.length}</strong> {dict.palletsAffectedLabel}
              </span>
              <span>
                <strong className="text-slate-900">{inStoragePallets.length}</strong> {dict.stillInStorageAllocated}
              </span>
              <span>
                <strong className="text-slate-900">{affectedClients.length}</strong> {dict.clientsTouchedLabel}
              </span>
            </div>
          </Card>

          <Card>
            <h2 className="text-sm font-semibold text-slate-900">{dict.preDecapTitle}</h2>
            <p className="mt-1 text-xs text-slate-500">{dict.preDecapSubtitle}</p>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-start text-sm">
                <thead className="border-b border-slate-200 text-slate-500">
                  <tr>
                    <th className="py-2 pe-4 font-medium">{dict.colDate}</th>
                    <th className="py-2 pe-4 font-medium">{dict.colSample}</th>
                    <th className="py-2 pe-4 font-medium">{dict.colReceiptNote}</th>
                    <th className="py-2 pe-4 font-medium">{dict.colDecision}</th>
                  </tr>
                </thead>
                <tbody>
                  {preDecapRecords.map((r) => (
                    <tr key={r.id} className="border-b border-slate-100 last:border-0">
                      <td className="py-2 pe-4">{formatDate(r.createdAt, "dd MMM yyyy HH:mm", locale)}</td>
                      <td className="py-2 pe-4">{r.sampleNo ?? "—"}</td>
                      <td className="py-2 pe-4">{r.receiptNoteNo ?? "—"}</td>
                      <td className="py-2 pe-4">
                        <Badge color={r.decision === "ACCEPTED" ? "green" : "red"}>
                          {r.decision === "ACCEPTED" ? fullDict.preDecapInspection.acceptable : fullDict.preDecapInspection.unacceptable}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                  {preDecapRecords.length === 0 && (
                    <tr>
                      <td colSpan={4} className="py-4 text-center text-slate-400">
                        {dict.noPreDecapRecords}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>

          <Card>
            <h2 className="text-sm font-semibold text-slate-900">{dict.affectedLotsTitle}</h2>
            <p className="mt-1 text-xs text-slate-500">{dict.affectedLotsSubtitle}</p>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-start text-sm">
                <thead className="border-b border-slate-200 text-slate-500">
                  <tr>
                    <th className="py-2 pe-4 font-medium">{dict.colLot}</th>
                    <th className="py-2 pe-4 font-medium">{dict.colFactory}</th>
                    <th className="py-2 pe-4 font-medium">{dict.colShiftDate}</th>
                    <th className="py-2 pe-4 font-medium">{dict.colGrade}</th>
                    <th className="py-2 pe-4 font-medium">{dict.colFormat}</th>
                    <th className="py-2 pe-4 font-medium">{dict.colPallets}</th>
                    <th className="py-2 pe-4 font-medium">{dict.colLink}</th>
                  </tr>
                </thead>
                <tbody>
                  {directLots.map((lot) => (
                    <tr key={lot.id} className="border-b border-slate-100 last:border-0">
                      <td className={cn("py-2 pe-4", lot.isTestData && TEST_DATA_TEXT_CLASS)}>
                        {lot.lotNumber} {lot.isTestData && <TestDataBadge />}
                      </td>
                      <td className="py-2 pe-4">{lot.factory.name}</td>
                      <td className="py-2 pe-4">{formatDate(lot.shift.date, "dd MMM yyyy", locale)}</td>
                      <td className="py-2 pe-4">
                        <Badge color={lot.grade === "A" ? "green" : "amber"}>
                          {fullDict.storage.gradeLabel.replace("{grade}", lot.grade)}
                        </Badge>
                      </td>
                      <td className="py-2 pe-4">{FORMAT_LABEL[lot.format]}</td>
                      <td className="py-2 pe-4">{lot.pallets.length}</td>
                      <td className="py-2 pe-4">
                        <Link href={`/production/${lot.id}`} className="text-emerald-700 hover:underline">
                          <Badge color="blue">{dict.directBadge}</Badge>
                        </Link>
                      </td>
                    </tr>
                  ))}
                  {possibleLots.map((lot) => (
                    <tr key={lot.id} className="border-b border-slate-100 last:border-0">
                      <td className={cn("py-2 pe-4", lot.isTestData && TEST_DATA_TEXT_CLASS)}>
                        {lot.lotNumber} {lot.isTestData && <TestDataBadge />}
                      </td>
                      <td className="py-2 pe-4">{lot.factory.name}</td>
                      <td className="py-2 pe-4">{formatDate(lot.shift.date, "dd MMM yyyy", locale)}</td>
                      <td className="py-2 pe-4">
                        <Badge color={lot.grade === "A" ? "green" : "amber"}>
                          {fullDict.storage.gradeLabel.replace("{grade}", lot.grade)}
                        </Badge>
                      </td>
                      <td className="py-2 pe-4">{FORMAT_LABEL[lot.format]}</td>
                      <td className="py-2 pe-4">{lot.pallets.length}</td>
                      <td className="py-2 pe-4">
                        <Link href={`/production/${lot.id}`} className="text-emerald-700 hover:underline">
                          <Badge color="amber">{dict.possibleBadge}</Badge>
                        </Link>
                      </td>
                    </tr>
                  ))}
                  {affectedLots.length === 0 && (
                    <tr>
                      <td colSpan={7} className="py-4 text-center text-slate-400">
                        {dict.noLotsAffected}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>

          <Card>
            <h2 className="text-sm font-semibold text-slate-900">{dict.affectedPalletsTitle}</h2>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-start text-sm">
                <thead className="border-b border-slate-200 text-slate-500">
                  <tr>
                    <th className="py-2 pe-4 font-medium">{dict.colPallet}</th>
                    <th className="py-2 pe-4 font-medium">{dict.colLot}</th>
                    <th className="py-2 pe-4 font-medium">{dict.colStatus}</th>
                    <th className="py-2 pe-4 font-medium">{dict.colClient}</th>
                  </tr>
                </thead>
                <tbody>
                  {allPallets.map((p) => {
                    const isTest = p.isTestData || p.lotIsTestData;
                    return (
                      <tr key={p.id} className="border-b border-slate-100 last:border-0">
                        <td className={cn("py-2 pe-4", isTest && TEST_DATA_TEXT_CLASS)}>{p.palletNumber}</td>
                        <td className={cn("py-2 pe-4", isTest && TEST_DATA_TEXT_CLASS)}>
                          {p.lotNumber} {isTest && <TestDataBadge />}
                        </td>
                        <td className="py-2 pe-4">
                          <Badge color={PALLET_STATUS_COLOR[p.status]}>
                            {palletStatusLabel(fullDict.storage, p.status)}
                          </Badge>
                        </td>
                        <td className="py-2 pe-4">{p.client?.name ?? "—"}</td>
                      </tr>
                    );
                  })}
                  {allPallets.length === 0 && (
                    <tr>
                      <td colSpan={4} className="py-4 text-center text-slate-400">
                        {dict.noPalletsAffected}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>

          <Card>
            <h2 className="text-sm font-semibold text-slate-900">{dict.clientsTouchedTitle}</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {affectedClients.map((name) => (
                <Badge key={name} color="slate">
                  {name}
                </Badge>
              ))}
              {affectedClients.length === 0 && <p className="text-sm text-slate-400">{dict.noClientsTouchedYet}</p>}
            </div>
          </Card>
        </>
      )}
    </div>
  );
}

const lotInclude = {
  shift: { include: { factory: true } },
  factory: true,
  pallets: { include: { client: true } },
} as const;

function loadDirectLots(fieldId: string) {
  return prisma.productionLot.findMany({
    where: { fieldId },
    include: lotInclude,
    orderBy: { createdAt: "desc" },
  });
}

function loadPreDecapRecords(fieldId: string) {
  return prisma.qualityCheck.findMany({
    where: { checkpoint: "PRE_DECAP", fieldId },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
}
