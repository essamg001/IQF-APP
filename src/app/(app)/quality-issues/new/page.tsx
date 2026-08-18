import { prisma } from "@/lib/prisma";
import { IssueForm } from "./issue-form";
import { resolveLocale } from "@/lib/i18n/resolveLocale";
import { getDictionary } from "@/lib/i18n/getDictionary";

export default async function NewQualityIssuePage() {
  const dict = getDictionary(await resolveLocale()).qualityIssues;
  const clients = await prisma.client.findMany({ orderBy: { name: "asc" } });

  return (
    <div className="max-w-2xl">
      <h1 className="text-xl font-semibold text-slate-900">{dict.newTitle}</h1>
      <p className="mt-1 text-sm text-slate-500">{dict.newSubtitle}</p>

      <div className="mt-6">
        <IssueForm clients={clients} />
      </div>
    </div>
  );
}
