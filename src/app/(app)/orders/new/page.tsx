import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { canSeePricing } from "@/lib/roles";
import { OrderForm } from "./order-form";
import { redirect } from "next/navigation";

export default async function NewOrderPage() {
  const session = await auth();
  if (!canSeePricing(session?.user.role)) redirect("/orders");

  const clients = await prisma.client.findMany({ orderBy: { name: "asc" } });

  return (
    <div>
      <h1 className="text-xl font-semibold text-slate-900">New Order</h1>
      <div className="mt-6 max-w-xl">
        <OrderForm clients={clients} />
      </div>
    </div>
  );
}
