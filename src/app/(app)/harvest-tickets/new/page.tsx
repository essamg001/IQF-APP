import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { TicketForm } from "./ticket-form";

export default async function NewHarvestTicketPage() {
  const session = await auth();
  if (!session?.user || !["QUALITY", "OWNER"].includes(session.user.role)) {
    redirect("/");
  }

  return (
    <div>
      <h1 className="text-xl font-semibold text-slate-900">New Harvest Ticket</h1>
      <p className="mt-1 text-sm text-slate-500">
        Filled out by the field/harvest team before the tractor leaves for the decap facility.
      </p>
      <div className="mt-6 max-w-4xl">
        <TicketForm />
      </div>
    </div>
  );
}
