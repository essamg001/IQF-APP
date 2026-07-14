import { prisma } from "@/lib/prisma";
import { LotForm } from "./lot-form";

export default async function NewLotPage() {
  const [shifts, fields, coldRooms] = await Promise.all([
    prisma.shiftLog.findMany({ include: { factory: true }, orderBy: { date: "desc" }, take: 50 }),
    prisma.field.findMany({ orderBy: { name: "asc" } }),
    prisma.coldRoom.findMany({ orderBy: { name: "asc" } }),
  ]);

  return (
    <div>
      <h1 className="text-xl font-semibold text-slate-900">Log Production Lot</h1>
      <div className="mt-6 max-w-xl">
        <LotForm shifts={shifts} fields={fields} coldRooms={coldRooms} />
      </div>
    </div>
  );
}
