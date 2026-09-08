import { prisma } from "@/lib/prisma";
import { SprayForm } from "./spray-form";
import { resolveLocale } from "@/lib/i18n/resolveLocale";
import { getDictionary } from "@/lib/i18n/getDictionary";

export default async function NewFieldSprayPage() {
  const dict = getDictionary(await resolveLocale()).fieldSprayLog;
  const fields = await prisma.field.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } });

  // The approved Open Field product list -- the person logging a spray picks
  // from these instead of typing a chemical name, and the PHI clearance is
  // derived from the entry rather than typed. Deduped by product name since
  // the same product can appear against more than one target pest in the
  // plan (same PHI either way).
  const cropProtectionRows = await prisma.cropProtectionEntry.findMany({
    where: { plan: { growthStage: "OPEN_FIELD", isCanonical: true, isSkeleton: false } },
    select: { id: true, commercialProductName: true, proposedPhiDays: true },
    orderBy: { commercialProductName: "asc" },
  });
  const seen = new Set<string>();
  const chemicalOptions = cropProtectionRows.filter((r) => {
    if (seen.has(r.commercialProductName)) return false;
    seen.add(r.commercialProductName);
    return true;
  });

  return (
    <div>
      <h1 className="text-xl font-semibold text-slate-900">{dict.newTitle}</h1>
      <div className="mt-6 max-w-xl">
        <SprayForm fields={fields} chemicalOptions={chemicalOptions} />
      </div>
    </div>
  );
}
