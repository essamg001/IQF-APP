import { prisma } from "@/lib/prisma";
import { ShiftForm } from "./shift-form";

export default async function NewShiftPage() {
  const factories = await prisma.factory.findMany({ orderBy: { name: "asc" } });

  return (
    <div>
      <h1 className="text-xl font-semibold text-slate-900">Log Shift</h1>
      <div className="mt-6 max-w-lg">
        <ShiftForm factories={factories} />
      </div>
    </div>
  );
}
