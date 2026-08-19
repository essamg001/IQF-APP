import { prisma } from "@/lib/prisma";
import { SprayForm } from "./spray-form";
import { resolveLocale } from "@/lib/i18n/resolveLocale";
import { getDictionary } from "@/lib/i18n/getDictionary";

export default async function NewFieldSprayPage() {
  const dict = getDictionary(await resolveLocale()).fieldSprayLog;
  const fields = await prisma.field.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } });

  return (
    <div>
      <h1 className="text-xl font-semibold text-slate-900">{dict.newTitle}</h1>
      <div className="mt-6 max-w-xl">
        <SprayForm fields={fields} />
      </div>
    </div>
  );
}
