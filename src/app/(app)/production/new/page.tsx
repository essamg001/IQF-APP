import { prisma } from "@/lib/prisma";
import { LotForm } from "./lot-form";

export default async function NewLotPage() {
  const [factories, fields, coldRooms] = await Promise.all([
    prisma.factory.findMany({ orderBy: { name: "asc" } }),
    prisma.field.findMany({ orderBy: { name: "asc" } }),
    prisma.coldRoom.findMany({ orderBy: { name: "asc" } }),
  ]);

  return (
    <div>
      <h1 className="text-xl font-semibold text-slate-900">Log Production Lot</h1>
      <div className="mt-6 max-w-xl">
        <LotForm factories={factories} fields={fields} coldRooms={coldRooms} />
      </div>
    </div>
  );
}
