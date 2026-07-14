import { prisma } from "@/lib/prisma";
import { ContainerForm } from "./container-form";

export default async function NewContainerPage({
  searchParams,
}: {
  searchParams: Promise<{ orderId?: string }>;
}) {
  const { orderId } = await searchParams;
  const orders = await prisma.order.findMany({
    where: { stage: { notIn: ["DELIVERED", "PAID"] } },
    include: { client: true },
    orderBy: { orderDate: "desc" },
  });

  return (
    <div>
      <h1 className="text-xl font-semibold text-slate-900">Create Container</h1>
      <div className="mt-6 max-w-xl">
        <ContainerForm orders={orders} defaultOrderId={orderId} />
      </div>
    </div>
  );
}
