import { prisma } from "@/lib/prisma";
import { PositionForm } from "../position-form";
import { createOrgPositionAction } from "../actions";
import { resolveLocale } from "@/lib/i18n/resolveLocale";
import { getDictionary } from "@/lib/i18n/getDictionary";

export default async function NewOrgPositionPage() {
  const dict = getDictionary(await resolveLocale()).orgStructure;
  const positions = await prisma.orgPosition.findMany({ orderBy: { title: "asc" } });

  return (
    <div>
      <h1 className="text-xl font-semibold text-slate-900">{dict.addPosition}</h1>
      <div className="mt-6 max-w-xl">
        <PositionForm positions={positions} action={createOrgPositionAction} />
      </div>
    </div>
  );
}
