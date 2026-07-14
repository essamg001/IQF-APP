import { prisma } from "@/lib/prisma";
import { QualityCheckForm } from "./quality-form";

export default async function NewQualityCheckPage() {
  const lots = await prisma.productionLot.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { field: true, pallets: true },
  });

  return (
    <div>
      <h1 className="text-xl font-semibold text-slate-900">Log Quality Check</h1>
      <div className="mt-6 max-w-3xl">
        <QualityCheckForm lots={lots} />
      </div>
    </div>
  );
}
