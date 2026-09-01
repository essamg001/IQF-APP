import { prisma } from "@/lib/prisma";
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

  // Station/valve are real, GIS-imported data on Field -- the plot-line
  // dropdowns select from this instead of free-typing (the server action
  // already resolves a matching Field from these two values, see
  // resolveField in ../actions.ts; a dropdown just means what's submitted
  // always actually matches a real field instead of a typo).
  const fields = await prisma.field.findMany({
    where: { station: { not: null }, valve: { not: null } },
    select: { station: true, valve: true },
    distinct: ["station", "valve"],
    orderBy: [{ station: "asc" }, { valve: "asc" }],
  });

  return (
    <div>
      <h1 className="text-xl font-semibold text-slate-900">{dict.newTicket}</h1>
      <p className="mt-1 text-sm text-slate-500">{dict.newTicketSubtitle}</p>
      <div className="mt-6 max-w-4xl">
        <TicketForm fields={fields as { station: string; valve: string }[]} />
      </div>
    </div>
  );
}
