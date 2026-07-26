import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("password123", 10);

  const users = await Promise.all(
    [
      { name: "Owner", email: "owner@iqf.test", role: "OWNER" as const },
      { name: "Ibrahim", email: "ibrahim@iqf.test", role: "SALES" as const, isHeadOfSales: true },
      { name: "Karam", email: "karam@iqf.test", role: "QUALITY" as const },
      { name: "Lisan", email: "lisan@iqf.test", role: "QUALITY" as const },
      { name: "Mostafa Abd El Naby", email: "mostafa@iqf.test", role: "PRODUCTION" as const },
      { name: "Essam", email: "essam@iqf.test", role: "LOGISTICS" as const },
    ].map((u) =>
      prisma.user.upsert({
        where: { email: u.email },
        update: {},
        create: { ...u, passwordHash },
      })
    )
  );
  console.log(`Seeded ${users.length} users (password: password123)`);

  const factory1 = await prisma.factory.upsert({
    where: { name: "Factory 1 (Established)" },
    update: {},
    create: { name: "Factory 1 (Established)", capacityTonnesPerHour: 4.2 },
  });
  await prisma.factory.upsert({
    where: { name: "Factory 2 (New)" },
    update: {},
    create: { name: "Factory 2 (New)", capacityTonnesPerHour: 4.9 },
  });
  console.log("Seeded 2 factories");

  for (let i = 1; i <= 5; i++) {
    await prisma.coldRoom.upsert({
      where: { name: `Cold Store ${i}` },
      update: {},
      create: { name: `Cold Store ${i}`, capacityPallets: 1200, isNew: i <= 3 },
    });
  }
  console.log("Seeded 5 cold rooms (Cold Store 1-5)");

  await prisma.field.upsert({
    where: { name: "Field A" },
    update: {},
    create: { name: "Field A" },
  });
  await prisma.field.upsert({
    where: { name: "Field B" },
    update: {},
    create: { name: "Field B" },
  });
  console.log("Seeded 2 sample fields");

  const client = await prisma.client.upsert({
    where: { id: "seed-client-1" },
    update: {},
    create: {
      id: "seed-client-1",
      name: "Nordic Berries AB",
      country: "Sweden",
      contactName: "Erik Lindqvist",
      contactEmail: "erik@nordicberries.example",
      paymentTerms: "Net 30",
      incoterms: "CIF",
      currency: "USD",
      specs: {
        create: [
          { specName: "Standard Whole", grade: "A", format: "WHOLE", brix: "8-11%", mechanicalDamage: "2%" },
          { specName: "Standard Sliced", grade: "B", format: "SLICED", brix: "7-10%", mechanicalDamage: "5%" },
        ],
      },
    },
  });
  console.log(`Seeded sample client: ${client.name}`);

  const fieldA = await prisma.field.findUniqueOrThrow({ where: { name: "Field A" } });
  const coldRoom1 = await prisma.coldRoom.findUniqueOrThrow({ where: { name: "Cold Store 1" } });

  const shift = await prisma.shiftLog.upsert({
    where: { id: "seed-shift-1" },
    update: {},
    create: {
      id: "seed-shift-1",
      factoryId: factory1.id,
      date: new Date("2026-06-15"),
      shiftType: "DAY",
      startTime: new Date("2026-06-15T06:00:00"),
      endTime: new Date("2026-06-15T14:00:00"),
      workerCount: 24,
    },
  });

  const lot = await prisma.productionLot.upsert({
    where: { lotNumber: "L-2026-0001" },
    update: {},
    create: {
      lotNumber: "L-2026-0001",
      shiftId: shift.id,
      factoryId: factory1.id,
      fieldId: fieldA.id,
      grade: "A",
      format: "WHOLE",
      microbiologyResult: { create: { status: "APPROVED", receivedDate: new Date("2026-06-17") } },
      qualityChecks: {
        create: [
          {
            checkpoint: "RAW_MATERIAL",
            brix: 9.2,
            fruitColorPct: 92,
            mouldPct: 0.5,
            skinDamagePct: 1,
            internalQualityPct: 1,
            sizeCaliber: "25-40mm",
            complianceLevel: "GLOBALGAP",
          },
          {
            checkpoint: "POST_PACKAGING",
            brix: 9.4,
            fruitColorPct: 94,
            mouldPct: 0.3,
            skinDamagePct: 0.8,
            internalQualityPct: 0.5,
            complianceLevel: "GLOBALGAP",
          },
        ],
      },
      pallets: {
        create: Array.from({ length: 5 }, (_, i) => ({
          palletNumber: `L-2026-0001-P${i + 1}`,
          coldRoomId: coldRoom1.id,
        })),
      },
    },
  });
  console.log(`Seeded shift + lot ${lot.lotNumber} with 5 pallets`);

  // Lot upsert's `update: {}` is a no-op on reseed, so nested qualityChecks never
  // refresh once the lot exists -- upsert them explicitly by checkpoint so schema
  // additions (or corrections) always take effect on `npm run db:seed`.
  const qualityCheckData = [
    { checkpoint: "RAW_MATERIAL" as const, brix: 9.2, fruitColorPct: 92, mouldPct: 0.5, skinDamagePct: 1, internalQualityPct: 1, sizeCaliber: "25-40mm", complianceLevel: "GLOBALGAP" as const },
    { checkpoint: "POST_PACKAGING" as const, brix: 9.4, fruitColorPct: 94, mouldPct: 0.3, skinDamagePct: 0.8, internalQualityPct: 0.5, complianceLevel: "GLOBALGAP" as const },
  ];
  for (const qc of qualityCheckData) {
    const existing = await prisma.qualityCheck.findFirst({ where: { lotId: lot.id, checkpoint: qc.checkpoint } });
    if (existing) {
      await prisma.qualityCheck.update({ where: { id: existing.id }, data: qc });
    } else {
      await prisma.qualityCheck.create({ data: { ...qc, lotId: lot.id } });
    }
  }

  const order = await prisma.order.upsert({
    where: { orderNumber: "ORD-2026-0001" },
    update: {},
    create: {
      orderNumber: "ORD-2026-0001",
      clientId: client.id,
      grade: "A",
      format: "WHOLE",
      quantityPallets: 2,
      valueUsd: 24000,
      stage: "PACKED",
      orderDate: new Date("2026-06-16"),
    },
  });

  const unallocatedPallets = await prisma.pallet.findMany({
    where: { lotId: lot.id, status: "IN_STORAGE" },
    take: 2,
  });
  await prisma.$transaction(
    unallocatedPallets.map((p) =>
      prisma.pallet.update({
        where: { id: p.id },
        data: { status: "ALLOCATED", clientId: client.id, orderId: order.id },
      })
    )
  );
  console.log(`Seeded order ${order.orderNumber} with ${unallocatedPallets.length} pallets allocated`);

  const container = await prisma.container.upsert({
    where: { containerNumber: "MSKU1234567" },
    update: {},
    create: {
      orderId: order.id,
      containerNumber: "MSKU1234567",
      carrier: "Maersk",
      departurePort: "Damietta",
      destinationPort: "Rotterdam",
      departureDate: new Date("2026-06-20"),
      expectedTransitDays: 12,
      loadType: "UNPALLETISED",
      loadingDate: new Date("2026-06-19"),
      loadingLocation: "Factory 1 Dock",
      loadingSupervisor: "Essam",
      loadOutRepName: "Essam",
      loadOutSignedAt: new Date("2026-06-19"),
      qualityRepName: "Karam",
      qualitySignedAt: new Date("2026-06-19"),
    },
  });
  const allocatedPallets = await prisma.pallet.findMany({ where: { orderId: order.id } });
  for (const p of allocatedPallets) {
    const existingLine = await prisma.containerPalletLine.findFirst({
      where: { containerId: container.id, palletId: p.id },
    });
    if (!existingLine) {
      await prisma.containerPalletLine.create({
        data: {
          containerId: container.id,
          palletId: p.id,
          quantityTonnes: p.weightTonnes,
          loadingStart: new Date("2026-06-19T08:00:00"),
          loadingEnd: new Date("2026-06-19T08:10:00"),
        },
      });
    }
  }
  console.log(`Seeded container ${container.containerNumber} with ${allocatedPallets.length} pallet lines`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
