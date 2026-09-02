import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { canSeePricing } from "@/lib/roles";
import { resolveLocale } from "@/lib/i18n/resolveLocale";
import { getDictionary } from "@/lib/i18n/getDictionary";
import { ClaimForm } from "./claim-form";

export default async function NewClaimPage({
  searchParams,
}: {
  searchParams: Promise<{ clientId?: string; containerNumber?: string }>;
}) {
  const { clientId, containerNumber } = await searchParams;
  const session = await auth();
  const showPricing = canSeePricing(session?.user.role);
  const clients = await prisma.client.findMany({ orderBy: { name: "asc" } });
  const locale = await resolveLocale();
  const dict = getDictionary(locale).claims;

  return (
    <div>
      <h1 className="text-xl font-semibold text-slate-900">{dict.newTitle}</h1>
      <div className="mt-6 max-w-4xl">
        <ClaimForm
          clients={clients}
          defaultClientId={clientId}
          defaultContainerNumber={containerNumber}
          showPricing={showPricing}
        />
      </div>
    </div>
  );
}
