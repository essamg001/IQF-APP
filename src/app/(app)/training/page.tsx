import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { trainingExpiryStatus, trainingExpiryColor } from "@/lib/training";
import { formatDate } from "@/lib/dates";
import { resolveLocale } from "@/lib/i18n/resolveLocale";
import { getDictionary } from "@/lib/i18n/getDictionary";
import { StaffTrainingForm } from "./staff-training-form";
import { PrintButton } from "@/components/ui/print-button";

export default async function TrainingPage({
  searchParams,
}: {
  searchParams: Promise<{ tier?: string }>;
}) {
  const session = await auth();
  if (!session?.user || !["OWNER", "QUALITY", "PRODUCTION"].includes(session.user.role)) {
    redirect("/");
  }

  const locale = await resolveLocale();
  const fullDict = getDictionary(locale);
  const dict = fullDict.training;
  const common = fullDict.common;

  const STATUS_LABEL: Record<string, string> = {
    NONE: "—",
    OK: dict.statusValid,
    EXPIRING_SOON: dict.statusExpiringSoon,
    EXPIRED: dict.statusExpired,
  };

  const TIER_LABEL: Record<string, string> = { SUPERVISOR: dict.tierSupervisor, WORKER: dict.tierWorker };

  const { tier: tierParam } = await searchParams;
  const tierFilter = tierParam === "SUPERVISOR" || tierParam === "WORKER" ? tierParam : undefined;

  const now = new Date();

  const records = await prisma.staffTrainingRecord.findMany({
    where: tierFilter ? { tier: tierFilter } : undefined,
    orderBy: [{ trainedDate: "desc" }, { attendeeName: "asc" }],
    take: 500,
  });

  const allForOptions = await prisma.staffTrainingRecord.findMany({
    select: { attendeeName: true, jobTitle: true, trainingType: true, provider: true, trainerName: true },
    take: 1000,
  });
  const knownNames = [...new Set(allForOptions.map((r) => r.attendeeName))].sort();
  const knownJobTitles = [...new Set(allForOptions.map((r) => r.jobTitle).filter((v): v is string => !!v))].sort();
  const knownTypes = [...new Set(allForOptions.map((r) => r.trainingType))].sort();
  const knownProviders = [...new Set(allForOptions.map((r) => r.provider).filter((v): v is string => !!v))].sort();
  const knownTrainers = [...new Set(allForOptions.map((r) => r.trainerName).filter((v): v is string => !!v))].sort();

  const flaggedCount = records.filter((r) => {
    const status = trainingExpiryStatus(r.expiryDate, now);
    return status === "EXPIRED" || status === "EXPIRING_SOON";
  }).length;

  const totalCount = await prisma.staffTrainingRecord.count();
  const uniqueAttendees = (await prisma.staffTrainingRecord.groupBy({ by: ["attendeeName"] })).length;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">{dict.title}</h1>
          <p className="mt-1 text-sm text-slate-500">
            {dict.subtitle.replace("{count}", String(totalCount)).replace("{people}", String(uniqueAttendees))}
          </p>
          <p className="print-only mt-1 text-xs text-slate-500">
            {common.printedOn.replace("{date}", formatDate(now, "dd MMM yyyy HH:mm", locale))}
          </p>
        </div>
        <PrintButton />
      </div>

      <Card className="no-print">
        <StaffTrainingForm
          knownNames={knownNames}
          knownJobTitles={knownJobTitles}
          knownTypes={knownTypes}
          knownProviders={knownProviders}
          knownTrainers={knownTrainers}
        />
      </Card>

      <div className="no-print flex items-center gap-3">
        <div className="flex gap-1 border-b border-slate-200">
          {(
            [
              [undefined, dict.tabAll],
              ["SUPERVISOR", dict.tierSupervisor],
              ["WORKER", dict.tierWorker],
            ] as const
          ).map(([value, label]) => (
            <a
              key={label}
              href={value ? `/training?tier=${value}` : "/training"}
              className={
                "rounded-t-md px-4 py-2 text-sm font-medium " +
                (tierFilter === value
                  ? "border border-b-0 border-slate-200 bg-white text-emerald-700"
                  : "text-slate-500 hover:text-slate-700")
              }
            >
              {label}
            </a>
          ))}
        </div>
        {flaggedCount > 0 && (
          <Badge color="red">
            {flaggedCount} {dict.flaggedSuffix}
          </Badge>
        )}
      </div>

      <Card className="overflow-x-auto rounded-tl-none p-0">
        <table className="w-full text-start text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-slate-500">
            <tr>
              <th className="px-4 py-2 font-medium">{dict.colName}</th>
              <th className="px-4 py-2 font-medium">{dict.colTier}</th>
              <th className="px-4 py-2 font-medium">{dict.colJobTitle}</th>
              <th className="px-4 py-2 font-medium">{dict.colTraining}</th>
              <th className="px-4 py-2 font-medium">{common.date}</th>
              <th className="px-4 py-2 font-medium">{dict.colProvider}</th>
              <th className="px-4 py-2 font-medium">{dict.colTrainer}</th>
              <th className="px-4 py-2 font-medium">{dict.colExpiry}</th>
              <th className="px-4 py-2 font-medium">{common.status}</th>
            </tr>
          </thead>
          <tbody>
            {records.map((r) => {
              const status = trainingExpiryStatus(r.expiryDate, now);
              return (
                <tr key={r.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                  <td className="px-4 py-2 font-medium text-slate-900">
                    {r.attendeeName}
                    {r.notes && (
                      <span
                        title={r.notes}
                        className="ms-1.5 inline-flex cursor-help items-center rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800"
                      >
                        {dict.noteBadge}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2">
                    <Badge color={r.tier === "SUPERVISOR" ? "blue" : "slate"}>{TIER_LABEL[r.tier]}</Badge>
                  </td>
                  <td className="px-4 py-2 text-slate-500">{r.jobTitle ?? "—"}</td>
                  <td className="px-4 py-2">{r.trainingType}</td>
                  <td className="px-4 py-2">{formatDate(r.trainedDate, "dd MMM yyyy", locale)}</td>
                  <td className="px-4 py-2 text-slate-500">{r.provider ?? "—"}</td>
                  <td className="px-4 py-2 text-slate-500">{r.trainerName ?? "—"}</td>
                  <td className="px-4 py-2">{r.expiryDate ? formatDate(r.expiryDate, "dd MMM yyyy", locale) : "—"}</td>
                  <td className="px-4 py-2">
                    {status === "NONE" ? (
                      <span className="text-xs text-slate-400">—</span>
                    ) : (
                      <Badge color={trainingExpiryColor(status)}>{STATUS_LABEL[status]}</Badge>
                    )}
                  </td>
                </tr>
              );
            })}
            {records.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-slate-400">
                  {dict.noTraining}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
