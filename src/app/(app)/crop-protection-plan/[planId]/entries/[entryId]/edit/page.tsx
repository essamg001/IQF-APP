import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { EntryForm } from "../../../../entry-form";
import { updateCropProtectionEntryAction, deleteCropProtectionEntryAction } from "../../../../actions";
import { ConfirmSubmitButton } from "@/components/ui/confirm-submit-button";
import { resolveLocale } from "@/lib/i18n/resolveLocale";
import { getDictionary } from "@/lib/i18n/getDictionary";

export default async function EditCropProtectionEntryPage({
  params,
}: {
  params: Promise<{ planId: string; entryId: string }>;
}) {
  const { planId, entryId } = await params;
  const dict = getDictionary(await resolveLocale()).cropProtectionPlan;

  const entry = await prisma.cropProtectionEntry.findUnique({ where: { id: entryId } });
  if (!entry) notFound();

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-slate-900">{dict.editEntry}</h1>
        <form action={deleteCropProtectionEntryAction.bind(null, entryId)}>
          <ConfirmSubmitButton
            confirmMessage={dict.deleteConfirm.replace("{name}", entry.commercialProductName)}
            className="rounded-md border border-red-300 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50"
          >
            {dict.deleteEntry}
          </ConfirmSubmitButton>
        </form>
      </div>
      <div className="mt-6 max-w-2xl">
        <EntryForm planId={planId} entry={entry} action={updateCropProtectionEntryAction.bind(null, entryId)} />
      </div>
    </div>
  );
}
