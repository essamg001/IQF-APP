import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PositionForm } from "../../position-form";
import { updateOrgPositionAction, deleteOrgPositionAction } from "../../actions";
import { ConfirmSubmitButton } from "@/components/ui/confirm-submit-button";
import { resolveLocale } from "@/lib/i18n/resolveLocale";
import { getDictionary } from "@/lib/i18n/getDictionary";

export default async function EditOrgPositionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const dict = getDictionary(await resolveLocale()).orgStructure;

  const [position, positions] = await Promise.all([
    prisma.orgPosition.findUnique({ where: { id } }),
    prisma.orgPosition.findMany({ orderBy: { title: "asc" } }),
  ]);
  if (!position) notFound();

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-slate-900">{dict.editPosition}</h1>
        <form action={deleteOrgPositionAction.bind(null, id)}>
          <ConfirmSubmitButton
            confirmMessage={dict.deleteConfirm.replace("{name}", position.title)}
            className="rounded-md border border-red-300 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50"
          >
            {dict.deletePosition}
          </ConfirmSubmitButton>
        </form>
      </div>
      <div className="mt-6 max-w-xl">
        <PositionForm position={position} positions={positions} action={updateOrgPositionAction.bind(null, id)} />
      </div>
    </div>
  );
}
