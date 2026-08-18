import { auth } from "@/lib/auth";
import { canManageClients } from "@/lib/roles";
import { redirect } from "next/navigation";
import { ClientForm } from "../client-form";
import { createClientAction } from "../actions";
import { resolveLocale } from "@/lib/i18n/resolveLocale";
import { getDictionary } from "@/lib/i18n/getDictionary";

export default async function NewClientPage() {
  const session = await auth();
  if (!canManageClients(session?.user.role)) redirect("/clients");
  const dict = getDictionary(await resolveLocale()).clients;

  return (
    <div>
      <h1 className="text-xl font-semibold text-slate-900">{dict.newClient}</h1>
      <div className="mt-6 max-w-4xl">
        <ClientForm action={createClientAction} submitLabel={dict.createClient} />
      </div>
    </div>
  );
}
