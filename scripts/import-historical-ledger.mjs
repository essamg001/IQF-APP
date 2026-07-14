import { PrismaClient } from "@prisma/client";
import { readFileSync } from "node:fs";

const prisma = new PrismaClient();

async function main() {
  const jsonPath = process.argv[2];
  if (!jsonPath) throw new Error("Usage: node import-historical-ledger.mjs <path-to-json>");

  const { year, rows } = JSON.parse(readFileSync(jsonPath, "utf-8"));
  console.log(`Importing ${rows.length} rows for ${year}...`);

  const clientNames = [...new Set(rows.map((r) => r.clientName))];
  const clientByName = new Map();
  for (const name of clientNames) {
    let client = await prisma.client.findFirst({ where: { name } });
    if (!client) {
      client = await prisma.client.create({ data: { name } });
      console.log(`  Created new client: ${name}`);
    }
    clientByName.set(name, client.id);
  }

  let created = 0;
  let skippedExisting = 0;
  const errors = [];

  for (const row of rows) {
    const existing = await prisma.order.findUnique({ where: { orderNumber: row.orderNumber } });
    if (existing) {
      skippedExisting++;
      continue;
    }

    const clientId = clientByName.get(row.clientName);
    if (!clientId) {
      errors.push(`No client id for ${row.clientName} (order ${row.orderNumber})`);
      continue;
    }

    try {
      const order = await prisma.order.create({
        data: {
          orderNumber: row.orderNumber,
          clientId,
          grade: row.grade,
          format: "WHOLE",
          quantityPallets: row.quantityPallets ?? 1,
          valueUsd: row.valueUsd,
          stage: "PAID",
          orderDate: new Date(row.orderDate),
          isHistorical: true,
        },
      });

      if (row.containerNumber) {
        const existingContainer = await prisma.container.findUnique({
          where: { containerNumber: row.containerNumber },
        });
        if (!existingContainer) {
          await prisma.container.create({
            data: {
              orderId: order.id,
              containerNumber: row.containerNumber,
              carrier: row.shippingLine || undefined,
              departurePort: row.portOfLoading || undefined,
              destinationPort: row.portOfDestination || undefined,
              departureDate: row.departureDate ? new Date(row.departureDate) : undefined,
            },
          });
        }
      }
      created++;
    } catch (e) {
      errors.push(`${row.orderNumber}: ${e.message}`);
    }
  }

  console.log(`Created ${created} orders, skipped ${skippedExisting} already-existing, ${errors.length} errors.`);
  if (errors.length) console.log(errors.slice(0, 20));
}

main()
  .catch((e) => {
    console.error("FAILED", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
