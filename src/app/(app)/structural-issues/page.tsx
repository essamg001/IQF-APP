import { prisma } from "@/lib/prisma";
import { LinkButton } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { formatDate } from "@/lib/dates";
import { isStructuralIssueOverdue, STRUCTURAL_ISSUE_LOCATIONS } from "@/lib/structuralIssues";
import { resolveLocale } from "@/lib/i18n/resolveLocale";
import { getDictionary } from "@/lib/i18n/getDictionary";

const STATUS_COLOR = {
  REPORTED: "amber",
  PLANNED: "blue",
  COMPLETED: "green",
} as const;

const SORT_OPTIONS = ["reportedDesc", "reportedAsc", "location", "targetCompletion"] as const;
type SortOption = (typeof SORT_OPTIONS)[number];

export default async function StructuralIssuesPage({
  searchParams,
}: {
  searchParams: Promise<{ location?: string; sort?: string }>;
}) {
  const locale = await resolveLocale();
  const dict = getDictionary(locale).structuralIssues;
  const { location, sort } = await searchParams;
  const sortOption: SortOption = (SORT_OPTIONS as readonly string[]).includes(sort ?? "")
    ? (sort as SortOption)
    : "reportedDesc";

  const STATUS_LABEL = {
    REPORTED: dict.statusReported,
    PLANNED: dict.statusPlanned,
    COMPLETED: dict.statusCompleted,
  } as const;

  const orderBy =
    sortOption === "reportedAsc"
      ? { reportedAt: "asc" as const }
      : sortOption === "location"
        ? { location: "asc" as const }
        : sortOption === "targetCompletion"
          ? { proposedCompletionDate: "asc" as const }
          : { reportedAt: "desc" as const };

  const issues = await prisma.structuralIssue.findMany({
    where: location ? { location } : undefined,
    include: { factory: true, _count: { select: { photos: true } } },
    orderBy,
    take: 200,
  });

  const overdueCount = issues.filter((i) => isStructuralIssueOverdue(i)).length;

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">{dict.title}</h1>
          <p className="mt-1 text-sm text-slate-500">
            {dict.subtitle}
            {overdueCount > 0 && (
              <span className="ms-2">
                <Badge color="red">
                  {overdueCount} {dict.overdue}
                </Badge>
              </span>
            )}
          </p>
        </div>
        <LinkButton href="/structural-issues/new">{dict.reportIssue}</LinkButton>
      </div>

      <form className="mt-4 flex gap-3" method="get">
        <select name="location" defaultValue={location ?? ""} className="rounded-md border border-slate-300 px-3 py-2 text-sm">
          <option value="">{dict.allLocations}</option>
          {STRUCTURAL_ISSUE_LOCATIONS.map((loc) => (
            <option key={loc} value={loc}>
              {dict.locationOptionLabels[loc]}
            </option>
          ))}
        </select>
        <select name="sort" defaultValue={sortOption} className="rounded-md border border-slate-300 px-3 py-2 text-sm">
          <option value="reportedDesc">{dict.sortReportedNewest}</option>
          <option value="reportedAsc">{dict.sortReportedOldest}</option>
          <option value="location">{dict.sortLocation}</option>
          <option value="targetCompletion">{dict.sortTargetCompletion}</option>
        </select>
        <button className="rounded-md bg-emerald-700 px-3.5 py-2 text-sm font-medium text-white">{dict.filterButton}</button>
      </form>

      <Card className="mt-4 overflow-x-auto p-0">
        <table className="w-full text-start text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-slate-500">
            <tr>
              <th className="px-4 py-2 font-medium">{dict.colLocation}</th>
              <th className="px-4 py-2 font-medium">{dict.colFactory}</th>
              <th className="px-4 py-2 font-medium">{dict.colReportedBy}</th>
              <th className="px-4 py-2 font-medium">{dict.colReported}</th>
              <th className="px-4 py-2 font-medium">{dict.colTargetCompletion}</th>
              <th className="px-4 py-2 font-medium">{dict.colStatus}</th>
            </tr>
          </thead>
          <tbody>
            {issues.map((i) => {
              const overdue = isStructuralIssueOverdue(i);
              return (
                <tr key={i.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                  <td className="px-4 py-2">
                    <Link href={`/structural-issues/${i.id}`} className="font-medium text-emerald-700 hover:underline">
                      {dict.locationOptionLabels[i.location] ?? dict.knownLocationLabels[i.location] ?? i.location}
                    </Link>
                    {i._count.photos > 0 && (
                      <span className="ms-1.5 text-xs text-slate-400">
                        ({i._count.photos} photo{i._count.photos === 1 ? "" : "s"})
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-slate-600">{i.factory.name}</td>
                  <td className="px-4 py-2 text-slate-600">{dict.knownReporterLabels[i.reportedByName] ?? i.reportedByName}</td>
                  <td className="px-4 py-2 text-slate-500">{formatDate(i.reportedAt, "dd MMM yyyy", locale)}</td>
                  <td className="px-4 py-2 text-slate-500">
                    {i.proposedCompletionDate ? formatDate(i.proposedCompletionDate, "dd MMM yyyy", locale) : "—"}
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-1.5">
                      <Badge color={STATUS_COLOR[i.status]}>{STATUS_LABEL[i.status]}</Badge>
                      {overdue && <Badge color="red">{dict.overdueBadge}</Badge>}
                    </div>
                  </td>
                </tr>
              );
            })}
            {issues.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                  {dict.noIssues}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
