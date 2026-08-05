import { prisma } from "@/lib/prisma";
import { ShiftForm } from "./shift-form";

export default async function NewShiftPage({
  searchParams,
}: {
  searchParams: Promise<{ factoryId?: string; shiftType?: string; date?: string }>;
}) {
  const factories = await prisma.factory.findMany({ orderBy: { name: "asc" } });
  const { factoryId, shiftType, date } = await searchParams;

  return (
    <div>
      <h1 className="text-xl font-semibold text-slate-900">Log Shift</h1>
      <div className="mt-6 max-w-lg">
        <ShiftForm factories={factories} initial={{ factoryId, shiftType, date }} />
      </div>
    </div>
  );
}
