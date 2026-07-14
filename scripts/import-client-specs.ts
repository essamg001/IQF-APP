import { prisma } from "../src/lib/prisma";
import { readFileSync } from "node:fs";

type SpecRow = {
  sourceRow: number;
  sourceLabel: string;
  company: string;
  specName: string;
  grade: "A" | "B";
  format: "WHOLE" | "SLICED" | "DICED";
  overripe: string | null;
  unripe: string | null;
  calyx: string | null;
  leaves: string | null;
  stems: string | null;
  misshapen: string | null;
  blemish: string | null;
  dryPump: string | null;
  clumps: string | null;
  broken: string | null;
  oxidation: string | null;
  mechanicalDamage: string | null;
  rotten: string | null;
  insectDamage: string | null;
  internalQuality: string | null;
  brix: string | null;
  ph: string | null;
  deadWorm: string | null;
  sizeCaliber: string | null;
  notes: string | null;
};

async function main() {
  const jsonPath = process.argv[2];
  if (!jsonPath) throw new Error("Usage: tsx import-client-specs.ts <path-to-json>");

  const rows: SpecRow[] = JSON.parse(readFileSync(jsonPath, "utf-8"));

  const companies = [...new Set(rows.map((r) => r.company))];
  const clientByName = new Map<string, string>();

  for (const name of companies) {
    const existing = await prisma.client.findFirst({ where: { name } });
    if (existing) {
      clientByName.set(name, existing.id);
      continue;
    }
    const created = await prisma.client.create({ data: { name } });
    clientByName.set(name, created.id);
  }
  console.log(`Ensured ${companies.length} client companies exist.`);

  let specCount = 0;
  for (const row of rows) {
    const clientId = clientByName.get(row.company)!;
    await prisma.clientSpec.create({
      data: {
        clientId,
        specName: row.specName,
        grade: row.grade,
        format: row.format,
        brix: row.brix ?? undefined,
        ph: row.ph ?? undefined,
        sizeCaliber: row.sizeCaliber ?? undefined,
        overripe: row.overripe ?? undefined,
        unripe: row.unripe ?? undefined,
        calyx: row.calyx ?? undefined,
        leaves: row.leaves ?? undefined,
        stems: row.stems ?? undefined,
        misshapen: row.misshapen ?? undefined,
        blemish: row.blemish ?? undefined,
        dryPump: row.dryPump ?? undefined,
        clumps: row.clumps ?? undefined,
        broken: row.broken ?? undefined,
        oxidation: row.oxidation ?? undefined,
        mechanicalDamage: row.mechanicalDamage ?? undefined,
        rotten: row.rotten ?? undefined,
        insectDamage: row.insectDamage ?? undefined,
        internalQuality: row.internalQuality ?? undefined,
        deadWorm: row.deadWorm ?? undefined,
        notes: row.notes ?? undefined,
      },
    });
    specCount++;
  }
  console.log(`Created ${specCount} client specs.`);
}

main()
  .catch((e) => {
    console.error("FAILED", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
