import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { canSeePricing } from "@/lib/roles";
import { OrderForm } from "./order-form";
import { redirect } from "next/navigation";
import { resolveLocale } from "@/lib/i18n/resolveLocale";
import { getDictionary } from "@/lib/i18n/getDictionary";

export default async function NewOrderPage() {
  const session = await auth();
  if (!canSeePricing(session?.user.role)) redirect("/orders");
  const dict = getDictionary(await resolveLocale()).orders;

  const clients = await prisma.client.findMany({ orderBy: { name: "asc" }, include: { specs: true } });

  return (
    <div>
      <h1 className="text-xl font-semibold text-slate-900">{dict.newOrder}</h1>
      <div className="mt-6 max-w-xl">
        <OrderForm clients={clients} />
      </div>
    </div>
  );
}
