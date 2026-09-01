import { prisma } from "@/lib/prisma";
import { ReportForm } from "./report-form";
import { resolveLocale } from "@/lib/i18n/resolveLocale";
import { getDictionary } from "@/lib/i18n/getDictionary";

export default async function NewNonConformanceReportPage({
  searchParams,
}: {
  searchParams: Promise<{ factoryId?: string; ncType?: string; location?: string; productOrReference?: string; description?: string }>;
}) {
  const dict = getDictionary(await resolveLocale()).nonConformance;
  const factories = await prisma.factory.findMany({ orderBy: { name: "asc" } });
  const defaults = await searchParams;

  return (
    <div>
      <h1 className="text-xl font-semibold text-slate-900">{dict.newTitle}</h1>
      <div className="mt-6 max-w-xl">
        <ReportForm factories={factories} defaults={defaults} />
      </div>
    </div>
  );
}
