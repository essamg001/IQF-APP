import { prisma } from "@/lib/prisma";
import { combinedMicroStatus, isMicroCleared } from "@/lib/microbiology";
import { combinedCfuValue } from "@/lib/cfuTier";
import { evaluateSpecCompliance, violatedSpecRows, type SpecComplianceRow } from "@/lib/specCompliance";

function avg(nums: (number | null)[]) {
  const vals = nums.filter((n): n is number => n !== null);
  return vals.length ? vals.reduce((s, n) => s + n, 0) / vals.length : null;
}

export type CertificateData = {
  certNumber: string;
  issueDate: string;
  client: { name: string; country: string | null; contactName: string | null };
  orderNumber: string;
  format: string;
  grade: string;
  variety: string;
  containerNumber: string;
  lotNumbers: string[];
  fieldNames: string[];
  factoryNames: string[];
  // A range, not a single date -- a container's lots don't have to share a
  // production day (see the max-lots-per-container policy), so picking just
  // one lot's date would misstate the true production window on the cert.
  productionDateStart: string | null;
  productionDateEnd: string | null;
  palletCount: number;
  totalTonnes: number;
  isPostPackaging: boolean;
  brix: number | null;
  fruitColorPct: number | null;
  internalQualityPct: number | null;
  mouldPct: number | null;
  skinDamagePct: number | null;
  overmaturePct: number | null;
  productTemp: number;
  foreignOdor: string;
  foreignTaste: string;
  specBrix: string | null;
  specInternalQuality: string | null;
  specMechanicalDamage: string | null;
  complianceLevels: string[];
  allApproved: boolean;
  microDate: string | null;
  // Higher (worse) of every lot in this container's cfu/g readings -- a
  // container is only as good as its worst-tested lot (see cfuTier.ts).
  cfuValue: number | null;
  // Grouped by lab, not flattened -- a container's lots each carry an
  // in-house AND an external result, and mixing their certificate numbers
  // into one undifferentiated list would hide which lab said what.
  microCertsByLab: { labType: "IN_HOUSE" | "EXTERNAL"; labName: string | null; certificateNumbers: string[] }[];
  qualityRepName: string | null;
  loadOutRepName: string | null;
  // Every client-spec parameter (brix + defect tolerances, see
  // src/lib/specCompliance.ts) averaged across this container's loaded
  // pallets. The certificate itself is a uniform, plain document -- it
  // shows the same measured-vs-spec values every time, regardless of
  // whether a given pallet's reading was a clean pass or a signed-off
  // exception (see SpecException); that distinction is an internal
  // accountability record, not something the document itself varies on.
  specComplianceRows: SpecComplianceRow[];
};

export type CertificateGate = {
  ready: boolean;
  reasons: string[];
};

async function fetchContainerForCertificate(containerId: string) {
  return prisma.container.findUnique({
    where: { id: containerId },
    include: {
      order: { include: { client: { include: { specs: true } } } },
      palletLines: {
        include: {
          pallet: {
            include: {
              qualityChecks: true,
              lot: {
                include: { field: true, factory: true, shift: true, microbiologyResults: true, qualityChecks: true },
              },
            },
          },
        },
      },
      specExceptions: true,
    },
  });
}

/** The pallet's own POST_PACKAGING check, falling back to its lot's latest one -- same lookup as src/lib/palletQuality.ts. */
function latestPostPackagingCheckForPallet(pallet: ContainerForCertificate["palletLines"][number]["pallet"]) {
  const own = pallet.qualityChecks
    .filter((c) => c.checkpoint === "POST_PACKAGING")
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
  if (own) return own;
  return pallet.lot.qualityChecks
    .filter((c) => c.checkpoint === "POST_PACKAGING" && !c.palletId)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
}

export type ContainerForCertificate = NonNullable<Awaited<ReturnType<typeof fetchContainerForCertificate>>>;

export function computeCertificateGate(container: ContainerForCertificate): CertificateGate {
  const lots = new Map(container.palletLines.map((l) => [l.pallet.lot.id, l.pallet.lot]));
  const distinctLots = [...lots.values()];

  const reasons: string[] = [];
  if (distinctLots.length === 0) {
    reasons.push("No pallets have been loaded into this container yet.");
  }
  for (const lot of distinctLots) {
    if (!isMicroCleared(lot.microbiologyResults, lot.shift.onHold)) {
      const status = combinedMicroStatus(lot.microbiologyResults, lot.shift.onHold);
      const label = status === "ON_HOLD" ? "shift is on hold (split microbiology result)" : `lab clearance is ${status.replace(/_/g, " ").toLowerCase()}, not both approved`;
      reasons.push(`Lot ${lot.lotNumber}: ${label}.`);
    }
  }
  if (!container.loadOutSignedAt) reasons.push("Load-out representative has not signed off.");
  if (!container.qualitySignedAt) reasons.push("Quality representative has not signed off.");

  // Defensive check -- load-out itself is the primary gate against the
  // client's own spec (see src/lib/specCompliance.ts, addPalletLoadLineAction),
  // so this only ever fires if a spec limit was tightened or added after a
  // pallet was already loaded. An existing SpecException means someone
  // already signed off on exactly this pallet/parameter, so it doesn't block again.
  const spec = container.order.client.specs.find(
    (s) => s.grade === container.order.grade && s.format === container.order.format
  );
  for (const line of container.palletLines) {
    const check = latestPostPackagingCheckForPallet(line.pallet);
    const violations = violatedSpecRows(evaluateSpecCompliance(check ?? null, spec ?? null));
    const unresolved = violations.filter(
      (v) => !container.specExceptions.some((e) => e.palletId === line.pallet.id && e.parameter === v.key)
    );
    for (const v of unresolved) {
      reasons.push(
        `Pallet ${line.pallet.palletNumber}: ${v.label} fails ${container.order.client.name}'s spec (measured ${v.measuredValue}${v.measuredUnit === "°Bx" ? " °Bx" : ` ${v.measuredUnit}`}, spec ${v.specLimitDisplay ?? "—"}) and hasn't been signed off.`
      );
    }
  }

  return { ready: reasons.length === 0, reasons };
}

export async function computeContainerCertificateData(containerId: string): Promise<{
  container: ContainerForCertificate;
  gate: CertificateGate;
  data: CertificateData;
} | null> {
  const container = await fetchContainerForCertificate(containerId);
  if (!container) return null;

  const gate = computeCertificateGate(container);

  const lots = new Map(container.palletLines.map((l) => [l.pallet.lot.id, l.pallet.lot]));
  const distinctLots = [...lots.values()];
  const shiftDates = distinctLots.map((l) => l.shift.date).sort((a, b) => a.getTime() - b.getTime());

  const postChecks = distinctLots.flatMap((l) => l.qualityChecks.filter((q) => q.checkpoint === "POST_PACKAGING"));
  const checksForCert = postChecks.length
    ? postChecks
    : distinctLots.flatMap((l) => l.qualityChecks.filter((q) => q.checkpoint === "RAW_MATERIAL"));

  const brix = avg(checksForCert.map((c) => c.brix));
  const fruitColorPct = avg(checksForCert.map((c) => c.fruitColorPct));
  const internalQualityPct = avg(checksForCert.map((c) => c.internalQualityPct));
  const mouldPct = avg(checksForCert.map((c) => c.mouldPct));
  const skinDamagePct = avg(checksForCert.map((c) => c.skinDamagePct));
  const overmaturePct = avg(checksForCert.map((c) => c.overmaturePct));
  const productTemp = checksForCert.find((c) => c.productTemperatureC !== null)?.productTemperatureC ?? -18;
  const foreignOdor = checksForCert.find((c) => c.foreignOdor)?.foreignOdor ?? "NIL";
  const foreignTaste = checksForCert.find((c) => c.foreignTaste)?.foreignTaste ?? "NIL";

  const allApproved = distinctLots.every((l) => isMicroCleared(l.microbiologyResults, l.shift.onHold));
  const microDate = distinctLots
    .flatMap((l) => l.microbiologyResults.map((m) => m.receivedDate))
    .filter((d): d is Date => !!d)
    .sort((a, b) => b.getTime() - a.getTime())[0];
  const allMicroResults = distinctLots.flatMap((l) => l.microbiologyResults);
  const microCertsByLab: CertificateData["microCertsByLab"] = (["IN_HOUSE", "EXTERNAL"] as const)
    .map((labType) => {
      const forLab = allMicroResults.filter((m) => m.labType === labType && m.certificateNumber);
      return {
        labType,
        labName: forLab.find((m) => m.labName)?.labName ?? null,
        certificateNumbers: [...new Set(forLab.map((m) => m.certificateNumber as string))],
      };
    })
    .filter((g) => g.certificateNumbers.length > 0);

  const spec = container.order.client.specs.find(
    (s) => s.grade === container.order.grade && s.format === container.order.format
  );

  // A container-wide averaged "check" (same checksForCert set already used
  // above for brix etc.) fed into the same evaluator load-out uses per-pallet
  // -- brix is guaranteed non-null here since QualityCheck.brix is required,
  // so whenever there's at least one check, the average is real, not a
  // placeholder.
  const pseudoCheck =
    checksForCert.length > 0
      ? {
          brix: brix as number,
          overmaturePct,
          incompleteMaturityPct: avg(checksForCert.map((c) => c.incompleteMaturityPct)),
          capsuleRemainsCount: avg(checksForCert.map((c) => c.capsuleRemainsCount)),
          leafRemainsCount: avg(checksForCert.map((c) => c.leafRemainsCount)),
          stemFragmentsCount: avg(checksForCert.map((c) => c.stemFragmentsCount)),
          shapeDeformitiesPct: avg(checksForCert.map((c) => c.shapeDeformitiesPct)),
          skinDamagePct,
          cohesiveClustersPct: avg(checksForCert.map((c) => c.cohesiveClustersPct)),
          crushedBrokenFruitPct: avg(checksForCert.map((c) => c.crushedBrokenFruitPct)),
          dryBruisesPct: avg(checksForCert.map((c) => c.dryBruisesPct)),
          oxidationPct: avg(checksForCert.map((c) => c.oxidationPct)),
          fungalInfectionPct: avg(checksForCert.map((c) => c.fungalInfectionPct)),
          mechanicalFactorsPct: avg(checksForCert.map((c) => c.mechanicalFactorsPct)),
          mouldPct,
          insectInfestationPct: avg(checksForCert.map((c) => c.insectInfestationPct)),
          insectsLarvaePct: avg(checksForCert.map((c) => c.insectsLarvaePct)),
          foreignBodiesPct: avg(checksForCert.map((c) => c.foreignBodiesPct)),
          internalQualityPct,
        }
      : null;
  const specComplianceRows: CertificateData["specComplianceRows"] = evaluateSpecCompliance(pseudoCheck, spec ?? null);

  const totalTonnes = container.palletLines.reduce((s, l) => s + l.quantityTonnes, 0);
  const variety = container.palletLines.find((l) => l.pallet.variety)?.pallet.variety ?? "—";

  const data: CertificateData = {
    certNumber: `MA-QC-${container.containerNumber}`,
    issueDate: new Date().toISOString(),
    client: {
      name: container.order.client.name,
      country: container.order.client.country,
      contactName: container.order.client.contactName,
    },
    orderNumber: container.order.orderNumber,
    format: container.order.format,
    grade: container.order.grade,
    variety,
    containerNumber: container.containerNumber,
    lotNumbers: distinctLots.map((l) => l.lotNumber),
    fieldNames: [...new Set(distinctLots.map((l) => l.field.name))],
    factoryNames: [...new Set(distinctLots.map((l) => l.factory.name))],
    productionDateStart: shiftDates[0] ? shiftDates[0].toISOString() : null,
    productionDateEnd: shiftDates[shiftDates.length - 1] ? shiftDates[shiftDates.length - 1].toISOString() : null,
    palletCount: container.palletLines.length,
    totalTonnes,
    isPostPackaging: postChecks.length > 0,
    brix,
    fruitColorPct,
    internalQualityPct,
    mouldPct,
    skinDamagePct,
    overmaturePct,
    productTemp,
    foreignOdor,
    foreignTaste,
    specBrix: spec?.brix ?? null,
    specInternalQuality: spec?.internalQuality ?? null,
    specMechanicalDamage: spec?.mechanicalDamage ?? null,
    complianceLevels: [...new Set(checksForCert.map((c) => c.complianceLevel).filter((v): v is NonNullable<typeof v> => !!v))],
    allApproved,
    microDate: microDate ? microDate.toISOString() : null,
    cfuValue: combinedCfuValue(allMicroResults),
    microCertsByLab,
    qualityRepName: container.qualityRepName,
    loadOutRepName: container.loadOutRepName,
    specComplianceRows,
  };

  return { container, gate, data };
}
