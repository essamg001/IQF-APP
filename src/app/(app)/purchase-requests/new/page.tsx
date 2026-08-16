import { prisma } from "@/lib/prisma";
import { RequestForm } from "./request-form";

export default async function NewPurchaseRequestPage() {
  const factories = await prisma.factory.findMany({ orderBy: { name: "asc" } });

  return (
    <div>
      <h1 className="text-xl font-semibold text-slate-900">New Purchase Request</h1>
      <div className="mt-6 max-w-xl">
        <RequestForm factories={factories} />
      </div>
    </div>
  );
}
