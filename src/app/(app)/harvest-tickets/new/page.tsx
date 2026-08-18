import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { TicketForm } from "./ticket-form";
import { resolveLocale } from "@/lib/i18n/resolveLocale";
import { getDictionary } from "@/lib/i18n/getDictionary";

export default async function NewHarvestTicketPage() {
  const session = await auth();
  if (!session?.user || !["QUALITY", "OWNER"].includes(session.user.role)) {
    redirect("/");
  }
  const dict = getDictionary(await resolveLocale()).harvestTickets;

  return (
    <div>
      <h1 className="text-xl font-semibold text-slate-900">{dict.newTicket}</h1>
      <p className="mt-1 text-sm text-slate-500">{dict.newTicketSubtitle}</p>
      <div className="mt-6 max-w-4xl">
        <TicketForm />
      </div>
    </div>
  );
}
