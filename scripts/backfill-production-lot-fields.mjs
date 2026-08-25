import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// One-time backfill: copies every ProductionLot's old single fieldId into the
// new ProductionLotField join table, ahead of dropping the fieldId column.
// Idempotent via ProductionLotField's @@unique([lotId, fieldId]), so it's
// safe to re-run.
async function main() {
  const lots = await prisma.productionLot.findMany({ select: { id: true, fieldId: true } });
  let created = 0;
  let skipped = 0;
  for (const lot of lots) {
    if (!lot.fieldId) {
      skipped++;
      continue;
    }
    await prisma.productionLotField.upsert({
      where: { lotId_fieldId: { lotId: lot.id, fieldId: lot.fieldId } },
      update: {},
      create: { lotId: lot.id, fieldId: lot.fieldId },
    });
    created++;
  }
  console.log(`Backfilled ${created} lot-to-field links, skipped ${skipped} lots with no fieldId.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
