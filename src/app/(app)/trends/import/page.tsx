import { auth } from "@/lib/auth";
import { canSeeHistoricalTrends } from "@/lib/roles";
import { redirect } from "next/navigation";
import { ImportForm } from "./import-form";
import { resolveLocale } from "@/lib/i18n/resolveLocale";
import { getDictionary } from "@/lib/i18n/getDictionary";

export default async function ImportHistoricalPage() {
  const session = await auth();
  if (!canSeeHistoricalTrends(session?.user)) redirect("/");

  const fullDict = getDictionary(await resolveLocale());
  const dict = fullDict.trends;

  return (
    <div>
      <h1 className="text-xl font-semibold text-slate-900">{dict.importHistoricalOrders}</h1>
      <p className="mt-1 max-w-xl text-sm text-slate-500">
        {dict.uploadCsvPrefix}{" "}
        <code className="rounded bg-slate-100 px-1">orderNumber,clientName,grade,format,quantityPallets,valueUsd,orderDate</code>.{" "}
        {dict.uploadCsvSuffix}
      </p>
      <div className="mt-6 max-w-xl">
        <ImportForm />
      </div>
    </div>
  );
}
