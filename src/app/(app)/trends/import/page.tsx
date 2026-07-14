import { auth } from "@/lib/auth";
import { canSeeHistoricalTrends } from "@/lib/roles";
import { redirect } from "next/navigation";
import { ImportForm } from "./import-form";

export default async function ImportHistoricalPage() {
  const session = await auth();
  if (!canSeeHistoricalTrends(session?.user)) redirect("/");

  return (
    <div>
      <h1 className="text-xl font-semibold text-slate-900">Import Historical Orders</h1>
      <p className="mt-1 max-w-xl text-sm text-slate-500">
        Upload a CSV with header: <code className="rounded bg-slate-100 px-1">orderNumber,clientName,grade,format,quantityPallets,valueUsd,orderDate</code>.
        Client names must already exist under Clients. Dates should be in YYYY-MM-DD format.
      </p>
      <div className="mt-6 max-w-xl">
        <ImportForm />
      </div>
    </div>
  );
}
