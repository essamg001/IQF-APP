import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Card, StatCard } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input, FieldGroup } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/dates";
import { markSentToLabAction, markMrlSentToLabAction } from "./actions";
import { ResultForm } from "./result-form";
import { MrlResultForm } from "./mrl-result-form";
import { ResolveHoldForm } from "./resolve-hold-form";
import { FilterableList } from "./filterable-list";
import { LabPipelineTracker } from "./lab-pipeline-tracker";
import { TestDataBadge } from "@/components/test-data-badge";
import { cn } from "@/lib/cn";
import { resolveLocale } from "@/lib/i18n/resolveLocale";
import { getDictionary } from "@/lib/i18n/getDictionary";

// Same slice-to-40 truncation as before, except a linked-to lot is never
// silently dropped just because it's old -- it's spliced back in at the
// front so a deep link always lands on something visible.
function keepFocusedInView<T extends { lot: { lotNumber: string } }>(
  all: T[],
  limit: number,
  isFocused: (lotNumber: string) => boolean
): T[] {
  const sliced = all.slice(0, limit);
  if (!all.some((r) => isFocused(r.lot.lotNumber))) return sliced;
  if (sliced.some((r) => isFocused(r.lot.lotNumber))) return sliced;
  const focusedRow = all.find((r) => isFocused(r.lot.lotNumber))!;
  return [focusedRow, ...sliced.slice(0, limit - 1)];
}

function daysAtLab(sentDate: Date | null): number | null {
  if (!sentDate) return null;
  return Math.floor((Date.now() - sentDate.getTime()) / (1000 * 60 * 60 * 24));
}

export default async function LabPage({ searchParams }: { searchParams: Promise<{ lot?: string }> }) {
  const session = await auth();
  if (!session?.user || !["QUALITY", "OWNER"].includes(session.user.role)) {
    redirect("/");
  }
  const { lot: focusedLot } = await searchParams;
  const locale = await resolveLocale();
  const dict = getDictionary(locale).lab;
  const LAB_LABEL = { IN_HOUSE: dict.labInHouse, EXTERNAL: dict.labExternal } as const;
  // Highlights and auto-opens whichever lot a link (e.g. the Order lifecycle
  // tracker's "View in Lab" action) was actually pointing at -- this list has
  // no other deep-linking, so without this a user following that link would
  // land on an unfiltered wall of results with no idea which row matters.
  const isFocused = (lotNumber: string) => focusedLot != null && lotNumber === focusedLot;
  const focusedClass = "ring-2 ring-emerald-400 rounded-md";

  const [onHoldShifts, results, mrlResults] = await Promise.all([
    prisma.shiftLog.findMany({
      where: { onHold: true },
      include: { factory: true },
      orderBy: { holdSince: "desc" },
    }),
    prisma.microbiologyResult.findMany({
      orderBy: { createdAt: "desc" },
      take: 300,
      include: { lot: { include: { fields: { include: { field: true } } } }, sentBy: true, testLines: true },
    }),
    prisma.mrlResult.findMany({
      orderBy: { createdAt: "desc" },
      take: 300,
      include: { lot: { include: { fields: { include: { field: true } } } }, sentBy: true },
    }),
  ]);

  const awaitingDispatch = results.filter((r) => r.status === "PENDING");
  const awaitingResult = results.filter((r) => r.status === "SENT_TO_LAB");
  const resolvedAll = results.filter((r) => ["APPROVED", "FAILED_MINOR", "FAILED_SEVERE"].includes(r.status));
  const failedAll = resolvedAll.filter((r) => r.status !== "APPROVED");
  const resolved = keepFocusedInView(resolvedAll, 40, isFocused);

  const mrlAwaitingDispatch = mrlResults.filter((r) => r.status === "PENDING");
  const mrlAwaitingResult = mrlResults.filter((r) => r.status === "SENT_TO_LAB");
  const mrlResolvedAll = mrlResults.filter((r) => r.status === "APPROVED" || r.status === "FAILED");
  const mrlFailedAll = mrlResolvedAll.filter((r) => r.status === "FAILED");
  const mrlResolved = keepFocusedInView(mrlResolvedAll, 40, isFocused);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">{dict.title}</h1>
        <p className="mt-1 text-sm text-slate-500">{dict.subtitle}</p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <StatCard label={dict.statAwaitingDispatch} value={String(awaitingDispatch.length + mrlAwaitingDispatch.length)} />
        <StatCard label={dict.statAtLab} value={String(awaitingResult.length + mrlAwaitingResult.length)} />
        <StatCard
          label={dict.statNeedsAttention}
          value={String(failedAll.length + mrlFailedAll.length)}
          hint={dict.statNeedsAttentionHint}
        />
      </div>

      {onHoldShifts.length > 0 && (
        <Card className="border-red-300 bg-red-50">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-red-800">{dict.shiftsOnHoldTitle}</h2>
            <Badge color="red">{onHoldShifts.length}</Badge>
          </div>
          <div className="mt-3 space-y-3">
            {onHoldShifts.map((shift) => (
              <div key={shift.id} className="rounded-md border border-red-200 bg-white p-3">
                <p className="text-sm font-medium text-slate-900">
                  {dict.factoryDateShiftLine
                    .replace("{factory}", shift.factory.name)
                    .replace("{date}", formatDate(shift.date, "dd MMM yyyy", locale))
                    .replace("{shiftType}", shift.shiftType === "DAY" ? dict.dayShift : dict.nightShift)}
                </p>
                <p className="mt-1 text-sm text-red-700">{shift.holdReason}</p>
                <p className="mt-1 text-xs text-slate-500">
                  {dict.onHoldSince.replace(
                    "{date}",
                    shift.holdSince ? formatDate(shift.holdSince, "dd MMM yyyy HH:mm", locale) : "—"
                  )}
                </p>
                <ResolveHoldForm shiftId={shift.id} />
              </div>
            ))}
          </div>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-6">
        <div className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">{dict.microbiologySectionTitle}</h2>
            <p className="mt-1 text-sm text-slate-500">{dict.microbiologySectionSubtitle}</p>
          </div>

          <Card>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-slate-900">{dict.awaitingDispatchTitle}</h3>
              <Badge color="slate">{awaitingDispatch.length}</Badge>
            </div>
            <div className="mt-3 divide-y divide-slate-100">
              {awaitingDispatch.map((r) => (
                <details key={r.id} className={cn("py-2", isFocused(r.lot.lotNumber) && focusedClass)} open={isFocused(r.lot.lotNumber)}>
                  <summary className="cursor-pointer text-sm font-medium text-slate-800">
                    {r.lot.lotNumber} — {r.lot.fields.map((f) => f.field.name).join(", ")} — {dict.gradeLabel.replace("{grade}", r.lot.grade)}{" "}
                    <Badge color={r.labType === "IN_HOUSE" ? "blue" : "slate"}>{LAB_LABEL[r.labType]}</Badge>
                    {(r.isTestData || r.lot.isTestData) && (
                      <>
                        {" "}
                        <TestDataBadge />
                      </>
                    )}
                  </summary>
                  <div className="mt-3">
                    <LabPipelineTracker
                      current="dispatch"
                      labels={[dict.awaitingDispatchTitle, dict.sentAwaitingResultTitle, dict.resolvedTitle]}
                    />
                    <form action={markSentToLabAction.bind(null, r.id)} className="flex flex-wrap items-end gap-3">
                      <FieldGroup label={dict.labNameLabel}>
                        <Input name="labName" className="w-64" />
                      </FieldGroup>
                      <FieldGroup label={dict.sentDateLabel}>
                        <Input name="sentDate" type="date" defaultValue={new Date().toISOString().slice(0, 10)} />
                      </FieldGroup>
                      <Button type="submit" variant="secondary">
                        {dict.markSentToLab}
                      </Button>
                    </form>
                  </div>
                </details>
              ))}
              {awaitingDispatch.length === 0 && <p className="py-2 text-sm text-slate-400">{dict.nothingWaitingToBeSent}</p>}
            </div>
          </Card>

          <Card>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-slate-900">{dict.sentAwaitingResultTitle}</h3>
              <Badge color="amber">{awaitingResult.length}</Badge>
            </div>
            <div className="mt-3 divide-y divide-slate-100">
              {awaitingResult.map((r) => {
                const elapsed = daysAtLab(r.sentDate);
                return (
                  <details key={r.id} className={cn("py-2", isFocused(r.lot.lotNumber) && focusedClass)} open={isFocused(r.lot.lotNumber)}>
                    <summary className="cursor-pointer text-sm font-medium text-slate-800">
                      {r.lot.lotNumber} — {r.lot.fields.map((f) => f.field.name).join(", ")} — {dict.gradeLabel.replace("{grade}", r.lot.grade)}{" "}
                      <Badge color={r.labType === "IN_HOUSE" ? "blue" : "slate"}>{LAB_LABEL[r.labType]}</Badge>
                      {r.sentDate && (
                        <span className="ms-2 font-normal text-slate-400">
                          {dict.sentDateInline.replace("{date}", formatDate(r.sentDate, "dd MMM yyyy", locale))}
                          {r.labName ? dict.toLabSuffix.replace("{lab}", r.labName) : ""}
                          {r.sentBy ? dict.byPersonSuffix.replace("{name}", r.sentBy.name) : ""}
                          {elapsed != null ? dict.daysAtLabSuffix.replace("{days}", String(elapsed)) : ""}
                        </span>
                      )}
                      {(r.isTestData || r.lot.isTestData) && (
                        <>
                          {" "}
                          <TestDataBadge />
                        </>
                      )}
                    </summary>
                    <ResultForm resultId={r.id} labType={r.labType} result={r} />
                  </details>
                );
              })}
              {awaitingResult.length === 0 && <p className="py-2 text-sm text-slate-400">{dict.nothingCurrentlyAtLab}</p>}
            </div>
          </Card>

          <Card>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-slate-900">{dict.resolvedTitle}</h3>
              <Badge color="slate">{resolvedAll.length}</Badge>
              {failedAll.length > 0 && <Badge color="red">{dict.failedCountSuffix.replace("{count}", String(failedAll.length))}</Badge>}
            </div>
            <div className="mt-3">
              <FilterableList
                placeholder={dict.searchByLotPlaceholder}
                emptyMessage={dict.noResultsRecordedYet}
                noMatchMessage={dict.noMatchingResults}
                items={resolved.map((r) => ({
                  key: r.id,
                  searchText: r.lot.lotNumber,
                  node: (
                    <details className={cn("py-2", isFocused(r.lot.lotNumber) && focusedClass)} open={isFocused(r.lot.lotNumber)}>
                      <summary className="cursor-pointer text-sm font-medium text-slate-800">
                        {r.lot.lotNumber} — {r.lot.fields.map((f) => f.field.name).join(", ")} — {dict.gradeLabel.replace("{grade}", r.lot.grade)}{" "}
                        <Badge color={r.labType === "IN_HOUSE" ? "blue" : "slate"}>{LAB_LABEL[r.labType]}</Badge>{" "}
                        <Badge color={r.status === "APPROVED" ? "green" : r.status === "FAILED_MINOR" ? "amber" : "red"}>
                          {r.status === "APPROVED"
                            ? dict.statusApproved
                            : r.status === "FAILED_MINOR"
                              ? dict.statusFailedMinor
                              : dict.statusFailedSevere}
                        </Badge>
                        {r.certificateFileName && (
                          <a
                            href={`/api/files/certificates/${r.certificateFileName}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="ms-2 text-xs text-emerald-700 hover:underline"
                          >
                            {dict.viewCertificate}
                          </a>
                        )}
                        {(r.status === "FAILED_MINOR" || r.status === "FAILED_SEVERE") && r.rejectionReason && (
                          <span className="ms-2 font-normal text-red-700">
                            {r.rejectionReason}
                            {r.rejectedQuantityTonnes ? dict.rejectedQuantitySuffix.replace("{qty}", String(r.rejectedQuantityTonnes)) : ""}
                          </span>
                        )}
                        {(r.isTestData || r.lot.isTestData) && (
                          <>
                            {" "}
                            <TestDataBadge />
                          </>
                        )}
                      </summary>
                      <ResultForm resultId={r.id} labType={r.labType} result={r} />
                    </details>
                  ),
                }))}
              />
            </div>
          </Card>
        </div>

        <div className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">{dict.mrlSectionTitle}</h2>
            <p className="mt-1 text-sm text-slate-500">{dict.mrlSectionSubtitle}</p>
          </div>

          <Card>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-slate-900">{dict.awaitingDispatchTitle}</h3>
              <Badge color="slate">{mrlAwaitingDispatch.length}</Badge>
            </div>
            <div className="mt-3 divide-y divide-slate-100">
              {mrlAwaitingDispatch.map((r) => (
                <details key={r.id} className={cn("py-2", isFocused(r.lot.lotNumber) && focusedClass)} open={isFocused(r.lot.lotNumber)}>
                  <summary className="cursor-pointer text-sm font-medium text-slate-800">
                    {r.lot.lotNumber} — {r.lot.fields.map((f) => f.field.name).join(", ")} — {dict.gradeLabel.replace("{grade}", r.lot.grade)}
                    {(r.isTestData || r.lot.isTestData) && (
                      <>
                        {" "}
                        <TestDataBadge />
                      </>
                    )}
                  </summary>
                  <div className="mt-3">
                    <LabPipelineTracker
                      current="dispatch"
                      labels={[dict.awaitingDispatchTitle, dict.sentAwaitingResultTitle, dict.resolvedTitle]}
                    />
                    <form action={markMrlSentToLabAction.bind(null, r.id)} className="flex flex-wrap items-end gap-3">
                      <FieldGroup label={dict.labNameLabel}>
                        <Input name="labName" className="w-64" />
                      </FieldGroup>
                      <FieldGroup label={dict.sentDateLabel}>
                        <Input name="sentDate" type="date" defaultValue={new Date().toISOString().slice(0, 10)} />
                      </FieldGroup>
                      <Button type="submit" variant="secondary">
                        {dict.markSentToLab}
                      </Button>
                    </form>
                  </div>
                </details>
              ))}
              {mrlAwaitingDispatch.length === 0 && <p className="py-2 text-sm text-slate-400">{dict.nothingWaitingToBeSent}</p>}
            </div>
          </Card>

          <Card>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-slate-900">{dict.sentAwaitingResultTitle}</h3>
              <Badge color="amber">{mrlAwaitingResult.length}</Badge>
            </div>
            <div className="mt-3 divide-y divide-slate-100">
              {mrlAwaitingResult.map((r) => {
                const elapsed = daysAtLab(r.sentDate);
                return (
                  <details key={r.id} className={cn("py-2", isFocused(r.lot.lotNumber) && focusedClass)} open={isFocused(r.lot.lotNumber)}>
                    <summary className="cursor-pointer text-sm font-medium text-slate-800">
                      {r.lot.lotNumber} — {r.lot.fields.map((f) => f.field.name).join(", ")} — {dict.gradeLabel.replace("{grade}", r.lot.grade)}
                      {r.sentDate && (
                        <span className="ms-2 font-normal text-slate-400">
                          {dict.sentDateInline.replace("{date}", formatDate(r.sentDate, "dd MMM yyyy", locale))}
                          {r.labName ? dict.toLabSuffix.replace("{lab}", r.labName) : ""}
                          {r.sentBy ? dict.byPersonSuffix.replace("{name}", r.sentBy.name) : ""}
                          {elapsed != null ? dict.daysAtLabSuffix.replace("{days}", String(elapsed)) : ""}
                        </span>
                      )}
                      {(r.isTestData || r.lot.isTestData) && (
                        <>
                          {" "}
                          <TestDataBadge />
                        </>
                      )}
                    </summary>
                    <MrlResultForm resultId={r.id} result={r} />
                  </details>
                );
              })}
              {mrlAwaitingResult.length === 0 && <p className="py-2 text-sm text-slate-400">{dict.nothingCurrentlyAtLab}</p>}
            </div>
          </Card>

          <Card>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-slate-900">{dict.resolvedTitle}</h3>
              <Badge color="slate">{mrlResolvedAll.length}</Badge>
              {mrlFailedAll.length > 0 && <Badge color="red">{dict.failedCountSuffix.replace("{count}", String(mrlFailedAll.length))}</Badge>}
            </div>
            <div className="mt-3">
              <FilterableList
                placeholder={dict.searchByLotPlaceholder}
                emptyMessage={dict.noResultsRecordedYet}
                noMatchMessage={dict.noMatchingResults}
                items={mrlResolved.map((r) => ({
                  key: r.id,
                  searchText: r.lot.lotNumber,
                  node: (
                    <details className={cn("py-2", isFocused(r.lot.lotNumber) && focusedClass)} open={isFocused(r.lot.lotNumber)}>
                      <summary className="cursor-pointer text-sm font-medium text-slate-800">
                        {r.lot.lotNumber} — {r.lot.fields.map((f) => f.field.name).join(", ")} — {dict.gradeLabel.replace("{grade}", r.lot.grade)}{" "}
                        <Badge color={r.status === "APPROVED" ? "green" : "red"}>
                          {r.status === "APPROVED" ? dict.statusApproved : dict.statusFailed}
                        </Badge>
                        {r.certificateFileName && (
                          <a
                            href={`/api/files/certificates/${r.certificateFileName}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="ms-2 text-xs text-emerald-700 hover:underline"
                          >
                            {dict.viewCertificate}
                          </a>
                        )}
                        {r.status === "FAILED" && r.rejectionReason && (
                          <span className="ms-2 font-normal text-red-700">{r.rejectionReason}</span>
                        )}
                        {(r.isTestData || r.lot.isTestData) && (
                          <>
                            {" "}
                            <TestDataBadge />
                          </>
                        )}
                      </summary>
                      <MrlResultForm resultId={r.id} result={r} />
                    </details>
                  ),
                }))}
              />
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
