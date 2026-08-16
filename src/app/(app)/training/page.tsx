import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { format } from "date-fns";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { trainingExpiryStatus, trainingExpiryColor } from "@/lib/training";
import { StaffTrainingForm } from "./staff-training-form";

const STATUS_LABEL: Record<string, string> = {
  NONE: "—",
  OK: "Valid",
  EXPIRING_SOON: "Expiring soon",
  EXPIRED: "Expired",
};

const TIER_LABEL: Record<string, string> = { SUPERVISOR: "Supervisor / Mgmt", WORKER: "Worker" };

export default async function TrainingPage({
  searchParams,
}: {
  searchParams: Promise<{ tier?: string }>;
}) {
  const session = await auth();
  if (!session?.user || !["OWNER", "QUALITY", "PRODUCTION"].includes(session.user.role)) {
    redirect("/");
  }

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
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Staff Training</h1>
        <p className="mt-1 text-sm text-slate-500">
          Food-safety and role training records for every attendee — supervisors/management and workers alike, by
          name. {totalCount} record{totalCount === 1 ? "" : "s"} across {uniqueAttendees} people.
        </p>
      </div>

      <Card>
        <StaffTrainingForm
          knownNames={knownNames}
          knownJobTitles={knownJobTitles}
          knownTypes={knownTypes}
          knownProviders={knownProviders}
          knownTrainers={knownTrainers}
        />
      </Card>

      <div className="flex items-center gap-3">
        <div className="flex gap-1 border-b border-slate-200">
          {(
            [
              [undefined, "All"],
              ["SUPERVISOR", "Supervisor / Mgmt"],
              ["WORKER", "Worker"],
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
        {flaggedCount > 0 && <Badge color="red">{flaggedCount} expired or expiring soon</Badge>}
      </div>

      <Card className="overflow-x-auto rounded-tl-none p-0">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-slate-500">
            <tr>
              <th className="px-4 py-2 font-medium">Name</th>
              <th className="px-4 py-2 font-medium">Tier</th>
              <th className="px-4 py-2 font-medium">Job Title</th>
              <th className="px-4 py-2 font-medium">Training</th>
              <th className="px-4 py-2 font-medium">Date</th>
              <th className="px-4 py-2 font-medium">Provider</th>
              <th className="px-4 py-2 font-medium">Trainer</th>
              <th className="px-4 py-2 font-medium">Expiry</th>
              <th className="px-4 py-2 font-medium">Status</th>
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
                        className="ml-1.5 inline-flex cursor-help items-center rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800"
                      >
                        note
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2">
                    <Badge color={r.tier === "SUPERVISOR" ? "blue" : "slate"}>{TIER_LABEL[r.tier]}</Badge>
                  </td>
                  <td className="px-4 py-2 text-slate-500">{r.jobTitle ?? "—"}</td>
                  <td className="px-4 py-2">{r.trainingType}</td>
                  <td className="px-4 py-2">{format(r.trainedDate, "dd MMM yyyy")}</td>
                  <td className="px-4 py-2 text-slate-500">{r.provider ?? "—"}</td>
                  <td className="px-4 py-2 text-slate-500">{r.trainerName ?? "—"}</td>
                  <td className="px-4 py-2">{r.expiryDate ? format(r.expiryDate, "dd MMM yyyy") : "—"}</td>
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
                  No training recorded yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
