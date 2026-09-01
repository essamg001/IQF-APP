import { PrismaClient } from "@prisma/client";
import { readFileSync } from "node:fs";

const prisma = new PrismaClient();

// Imports the real HACCP hazard-analysis table (scripts/data/haccp_hazards.json,
// transcribed verbatim in Arabic from the source PDF) backing
// haccp-flow-diagram's 23 process steps. Idempotent by wiping and
// recreating every HaccpHazard row on rerun -- there's no natural key to
// upsert individual hazard rows on.
async function main() {
  const jsonPath = process.argv[2] ?? "scripts/data/haccp_hazards.json";
  const steps = JSON.parse(readFileSync(jsonPath, "utf-8"));

  const removed = await prisma.haccpHazard.deleteMany({});
  console.log(`Removed ${removed.count} existing hazard row(s)`);

  let sortOrder = 0;
  let created = 0;
  for (const step of steps) {
    for (const h of step.hazards) {
      await prisma.haccpHazard.create({
        data: {
          processStepNumber: step.stepNumber,
          category: h.category,
          hazardArabic: h.hazardArabic ?? null,
          controlsArabic: h.controlsArabic ?? null,
          probability: h.probability ?? null,
          severity: h.severity ?? null,
          result: h.result ?? null,
          resultLabel: h.resultLabel ?? null,
          isCcp: h.isCcp ?? false,
          sortOrder: sortOrder++,
        },
      });
      created++;
    }
  }

  console.log(`Imported ${created} hazard rows across ${steps.length} process steps`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
