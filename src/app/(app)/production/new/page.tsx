import { prisma } from "@/lib/prisma";
import { LotForm } from "./lot-form";

export default async function NewLotPage() {
  const [factories, fields, coldRooms, recentPostDecap] = await Promise.all([
    prisma.factory.findMany({ orderBy: { name: "asc" } }),
    prisma.field.findMany({ orderBy: { name: "asc" } }),
    prisma.coldRoom.findMany({ orderBy: { name: "asc" } }),
    prisma.qualityCheck.findMany({
      where: { checkpoint: "POST_DECAP", decision: "ACCEPTED", fieldId: { not: null } },
      include: { field: true },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
  ]);

  // Most-recent-first list of distinct fields that recently passed Post-Decap
  // Quality -- the best available signal for which field is currently feeding
  // the factory, since a lot number doesn't itself carry a receipt note to
  // match against.
  const recentFieldNames: string[] = [];
  for (const c of recentPostDecap) {
    if (c.field && !recentFieldNames.includes(c.field.name)) recentFieldNames.push(c.field.name);
  }

  return (
    <div>
      <h1 className="text-xl font-semibold text-slate-900">Log Production Lot</h1>
      <div className="mt-6 max-w-xl">
        <LotForm factories={factories} fields={fields} coldRooms={coldRooms} recentFieldNames={recentFieldNames} />
      </div>
    </div>
  );
}
