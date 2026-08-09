import { auth } from "@/lib/auth";
import { canManageClients } from "@/lib/roles";
import { redirect } from "next/navigation";
import { ClientForm } from "../client-form";
import { createClientAction } from "../actions";

export default async function NewClientPage() {
  const session = await auth();
  if (!canManageClients(session?.user.role)) redirect("/clients");

  return (
    <div>
      <h1 className="text-xl font-semibold text-slate-900">New Client</h1>
      <div className="mt-6 max-w-4xl">
        <ClientForm action={createClientAction} submitLabel="Create client" />
      </div>
    </div>
  );
}
