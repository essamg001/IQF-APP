import { PrismaClient } from "@prisma/client";
import { readFileSync } from "node:fs";

const prisma = new PrismaClient();

// Imports a Crop Protection Products Plan (approved pesticide/spray reference
// program) for one growth stage from a pre-extracted JSON file (see
// scripts/data/*.json, extracted from the grower's real spreadsheets).
// Idempotent by deleting and recreating that growth stage's canonical plan
// and entries on rerun -- there's no clean natural key to upsert entries on.
async function main() {
  const jsonPath = process.argv[2];
  if (!jsonPath) throw new Error("Usage: node import-crop-protection-plan.mjs <path-to-json>");

  const data = JSON.parse(readFileSync(jsonPath, "utf-8"));

  const existing = await prisma.cropProtectionPlan.findFirst({
    where: { growthStage: data.growthStage, isCanonical: true },
  });
  if (existing) {
    await prisma.cropProtectionEntry.deleteMany({ where: { planId: existing.id } });
    await prisma.cropProtectionPlan.delete({ where: { id: existing.id } });
    console.log(`Removed previous canonical plan for ${data.growthStage}`);
  }

  const plan = await prisma.cropProtectionPlan.create({
    data: {
      growthStage: data.growthStage,
      farmName: data.farmName,
      exportSeason: data.exportSeason,
      cropName: data.cropName,
      variety: data.variety,
      gradeClassifications: data.gradeClassifications,
      developedBy: data.developedBy,
      revisedBy: data.revisedBy,
      approvedBy: data.approvedBy,
      versionDate: new Date(data.versionDate),
      isCanonical: true,
      isSkeleton: data.isSkeleton ?? false,
      hazardListNote: data.hazardListNote ?? null,
      notes: data.notes ?? null,
      entries: {
        create: data.entries.map((e) => ({
          targetPestOrDisease: e.targetPestOrDisease,
          pestStage: e.pestStage ?? null,
          economicInjuryThreshold: e.economicInjuryThreshold ?? null,
          plantGrowthStage: e.plantGrowthStage ?? null,
          treatmentMethod: e.treatmentMethod ?? null,
          category: e.category ?? null,
          formulationCode: e.formulationCode ?? null,
          activeIngredient: e.activeIngredient ?? null,
          commercialProductName: e.commercialProductName,
          registrationNumber: e.registrationNumber ?? null,
          manufacturer: e.manufacturer ?? null,
          activeIngredientConcentrationPct: e.activeIngredientConcentrationPct ?? null,
          dosePer100L: e.dosePer100L ?? null,
          waterVolumePerFeddan: e.waterVolumePerFeddan ?? null,
          dosePerFeddan: e.dosePerFeddan ?? null,
          proposedPhiDays: e.proposedPhiDays ?? null,
          reEntryPeriodHours: e.reEntryPeriodHours ?? null,
          applicationTimeWindow: e.applicationTimeWindow ?? null,
          maxTreatmentsPerSeason: e.maxTreatmentsPerSeason ?? null,
          strictestMrlLimitMgKg: e.strictestMrlLimitMgKg ?? null,
          euArfdMgKg: e.euArfdMgKg ?? null,
          fairtradeHazardClass: e.fairtradeHazardClass ?? null,
          isPending: e.isPending ?? false,
          notes: e.notes ?? null,
        })),
      },
    },
  });

  console.log(`Imported ${data.growthStage}: ${data.entries.length} entries (plan ${plan.id})`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
