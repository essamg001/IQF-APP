import { EntryForm } from "../../../entry-form";
import { createCropProtectionEntryAction } from "../../../actions";
import { resolveLocale } from "@/lib/i18n/resolveLocale";
import { getDictionary } from "@/lib/i18n/getDictionary";

export default async function NewCropProtectionEntryPage({ params }: { params: Promise<{ planId: string }> }) {
  const { planId } = await params;
  const dict = getDictionary(await resolveLocale()).cropProtectionPlan;

  return (
    <div>
      <h1 className="text-xl font-semibold text-slate-900">{dict.addEntry}</h1>
      <div className="mt-6 max-w-2xl">
        <EntryForm planId={planId} action={createCropProtectionEntryAction} />
      </div>
    </div>
  );
}
