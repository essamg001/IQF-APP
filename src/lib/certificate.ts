import { prisma } from "@/lib/prisma";
import { parseBrixRange } from "@/lib/allocation";
import { combinedMicroStatus, isMicroCleared } from "@/lib/microbiology";

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
  brixPass: boolean | null;
  complianceLevels: string[];
  allApproved: boolean;
  microDate: string | null;
  // Grouped by lab, not flattened -- a container's lots each carry an
  // in-house AND an external result, and mixing their certificate numbers
  // into one undifferentiated list would hide which lab said what.
  microCertsByLab: { labType: "IN_HOUSE" | "EXTERNAL"; labName: string | null; certificateNumbers: string[] }[];
  qualityRepName: string | null;
  loadOutRepName: string | null;
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
              lot: {
                include: { field: true, factory: true, shift: true, microbiologyResults: true, qualityChecks: true },
              },
            },
          },
        },
      },
    },
  });
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
  const brixRange = parseBrixRange(spec?.brix);
  const brixPass = brixRange && brix !== null ? brix >= brixRange.min && brix <= brixRange.max : null;

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
    brixPass,
    complianceLevels: [...new Set(checksForCert.map((c) => c.complianceLevel).filter((v): v is NonNullable<typeof v> => !!v))],
    allApproved,
    microDate: microDate ? microDate.toISOString() : null,
    microCertsByLab,
    qualityRepName: container.qualityRepName,
    loadOutRepName: container.loadOutRepName,
  };

  return { container, gate, data };
}
