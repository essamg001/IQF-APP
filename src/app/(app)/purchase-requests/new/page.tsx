import { prisma } from "@/lib/prisma";
import { resolveLocale } from "@/lib/i18n/resolveLocale";
import { getDictionary } from "@/lib/i18n/getDictionary";
import { RequestForm } from "./request-form";

export default async function NewPurchaseRequestPage() {
  const locale = await resolveLocale();
  const dict = getDictionary(locale).purchaseRequests;
  const factories = await prisma.factory.findMany({ orderBy: { name: "asc" } });

  return (
    <div>
      <h1 className="text-xl font-semibold text-slate-900">{dict.newTitle}</h1>
      <div className="mt-6 max-w-xl">
        <RequestForm factories={factories} />
      </div>
    </div>
  );
}
