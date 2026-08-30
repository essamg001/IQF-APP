import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// One-off cutover to the new PackagingMaterial catalog: creates a canonical
// material row per distinct (factoryId, itemName) already used in
// PackagingMaterialItem, then links existing items back to it. Idempotent --
// skips a factory that already has PackagingMaterial rows, so re-running
// after real materials have been added through the UI is a safe no-op.
async function main() {
  const factories = await prisma.factory.findMany();

  for (const factory of factories) {
    const existingMaterialCount = await prisma.packagingMaterial.count({ where: { factoryId: factory.id } });
    if (existingMaterialCount > 0) {
      console.log(`${factory.name}: already has ${existingMaterialCount} material(s), skipping backfill`);
      continue;
    }

    const items = await prisma.packagingMaterialItem.findMany({
      where: { dailyLog: { factoryId: factory.id } },
      orderBy: { createdAt: "asc" },
      select: { id: true, itemName: true, productCode: true, productUnit: true, minLevel: true, maxLevel: true },
    });

    const byKey = new Map();
    for (const item of items) {
      const key = item.itemName.trim().toLowerCase();
      if (!byKey.has(key)) {
        byKey.set(key, {
          name: item.itemName.trim(),
          code: item.productCode ?? null,
          unit: item.productUnit ?? null,
          minStockLevel: item.minLevel ?? null,
          itemIds: [],
        });
      }
      byKey.get(key).itemIds.push(item.id);
    }

    if (byKey.size === 0) {
      console.log(`${factory.name}: no existing packaging material items, nothing to backfill`);
      continue;
    }

    for (const { name, code, unit, minStockLevel, itemIds } of byKey.values()) {
      const material = await prisma.packagingMaterial.create({
        data: { factoryId: factory.id, name, code, unit, minStockLevel },
      });
      await prisma.packagingMaterialItem.updateMany({
        where: { id: { in: itemIds } },
        data: { materialId: material.id },
      });
    }
    console.log(`${factory.name}: backfilled ${byKey.size} material(s) from ${items.length} item row(s)`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
