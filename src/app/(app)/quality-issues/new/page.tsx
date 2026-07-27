import { prisma } from "@/lib/prisma";
import { IssueForm } from "./issue-form";

export default async function NewQualityIssuePage() {
  const clients = await prisma.client.findMany({ orderBy: { name: "asc" } });

  return (
    <div className="max-w-2xl">
      <h1 className="text-xl font-semibold text-slate-900">Report Quality Issue</h1>
      <p className="mt-1 text-sm text-slate-500">
        For quality problems reported without a financial claim — the goal is process improvement.
      </p>

      <div className="mt-6">
        <IssueForm clients={clients} />
      </div>
    </div>
  );
}
