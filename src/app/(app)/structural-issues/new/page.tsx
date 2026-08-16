import { prisma } from "@/lib/prisma";
import { IssueForm } from "./issue-form";

export default async function NewStructuralIssuePage() {
  const factories = await prisma.factory.findMany({ orderBy: { name: "asc" } });

  return (
    <div>
      <h1 className="text-xl font-semibold text-slate-900">Report Structural Issue</h1>
      <div className="mt-6 max-w-xl">
        <IssueForm factories={factories} />
      </div>
    </div>
  );
}
