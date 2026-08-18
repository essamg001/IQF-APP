import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input, FieldGroup } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { ConfirmSubmitButton } from "@/components/ui/confirm-submit-button";
import { TestDataBadge, TEST_DATA_TEXT_CLASS } from "@/components/test-data-badge";
import { cn } from "@/lib/cn";
import { markWasteAction } from "../../production/actions";
import { combinedMicroStatus } from "@/lib/microbiology";
import { combinedCfuValue } from "@/lib/cfuTier";
import { CfuTierBadge } from "@/components/cfu-tier-badge";
import { MrlStatusBadge } from "@/components/mrl-status-badge";
import { buildRackOrder, nextAvailableSlot, dominantProductType, suggestColdRoom } from "@/lib/coldStorage";
import { resolveLocale } from "@/lib/i18n/resolveLocale";
import { getDictionary } from "@/lib/i18n/getDictionary";
import type { Dictionary } from "@/lib/i18n/dictionaries/en";

const STATUS_COLOR = {
  IN_STORAGE: "slate",
  ALLOCATED: "blue",
  SHIPPED: "green",
  WASTE: "red",
  DISCOUNT_OFFERED: "amber",
} as const;

function statusLabel(dict: Dictionary["storage"], status: keyof typeof STATUS_COLOR) {
  return {
    IN_STORAGE: dict.statusInStorage,
    ALLOCATED: dict.statusAllocated,
    SHIPPED: dict.statusShipped,
    WASTE: dict.statusWaste,
    DISCOUNT_OFFERED: dict.statusDiscountOffered,
  }[status];
}

function formatLabel(dict: Dictionary["storage"], format: "WHOLE" | "SLICED" | "DICED") {
  return { WHOLE: dict.formatWhole, SLICED: dict.formatSliced, DICED: dict.formatDiced }[format];
}

export default async function PalletDetailPage({ params }: { params: Promise<{ palletId: string }> }) {
  const { palletId } = await params;
  const fullDict = getDictionary(await resolveLocale());
  const dict = fullDict.storage;
  const fpe = fullDict.finalProductEntry;
  const pallet = await prisma.pallet.findUnique({
    where: { id: palletId },
    include: {
      lot: { include: { field: true, factory: true, shift: true, microbiologyResults: true, mrlResult: true } },
      coldRoom: true,
      client: true,
      order: true,
      waste: true,
      qualityChecks: true,
      loadLines: { include: { container: true }, orderBy: { createdAt: "asc" } },
      slot: true,
    },
  });
  if (!pallet) notFound();

  const loadedTonnes = pallet.loadLines.reduce((s, l) => s + l.quantityTonnes, 0);
  const remainingTonnes = pallet.weightTonnes - loadedTonnes;

  // Only worth computing a placement suggestion when the pallet hasn't been
  // shelved yet -- once it has a slot, this section is moot.
  let placementSuggestion:
    | { roomId: string; roomName: string; round: number; rack: string; level: number; reason: string }
    | null = null;
  if (!pallet.slot) {
    const rooms = await prisma.coldRoom.findMany({
      select: {
        id: true,
        name: true,
        capacityPallets: true,
        rackCount: true,
        slots: {
          select: {
            id: true,
            round: true,
            rack: true,
            level: true,
            palletId: true,
            pallet: { select: { lot: { select: { grade: true, format: true } } } },
          },
        },
      },
    });
    const roomsForSuggestion = rooms.map((r) => ({
      id: r.id,
      name: r.name,
      capacityPallets: r.capacityPallets,
      rackCount: r.rackCount,
      slotPositions: r.slots.map((s) => ({ id: s.id, round: s.round, rack: s.rack, level: s.level, palletId: s.palletId })),
      occupiedCount: r.slots.filter((s) => s.palletId).length,
      pallets: r.slots.filter((s) => s.pallet).map((s) => ({ grade: s.pallet!.lot.grade, format: s.pallet!.lot.format })),
    }));

    const palletType = { grade: pallet.lot.grade, format: pallet.lot.format };
    // Already assigned to a room, just no slot yet -- suggest within that room only.
    const targetRoomId = pallet.coldRoomId ?? suggestColdRoom(roomsForSuggestion, palletType);
    const targetRoom = roomsForSuggestion.find((r) => r.id === targetRoomId);
    if (targetRoom) {
      const slot = nextAvailableSlot(targetRoom.slotPositions, buildRackOrder(targetRoom.rackCount));
      if (slot) {
        const dominant = dominantProductType(targetRoom.pallets);
        const reason = pallet.coldRoomId
          ? dict.reasonNextOpenSlot
          : dominant && dominant.grade === palletType.grade && dominant.format === palletType.format
            ? dict.reasonMatchesGradeFormat
                .replace("{grade}", dominant.grade)
                .replace("{format}", formatLabel(dict, dominant.format as "WHOLE" | "SLICED" | "DICED"))
            : dict.reasonLeastFullRoom;
        placementSuggestion = { roomId: targetRoom.id, roomName: targetRoom.name, round: slot.round, rack: slot.rack, level: slot.level, reason };
      }
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <h1 className={cn("text-xl font-semibold text-slate-900", pallet.isTestData && TEST_DATA_TEXT_CLASS)}>
          {dict.palletNumberTitle.replace("{number}", pallet.palletNumber)}
        </h1>
        <Badge color={STATUS_COLOR[pallet.status]}>{statusLabel(dict, pallet.status)}</Badge>
        {pallet.isTestData && <TestDataBadge />}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Card>
          <h2 className="text-sm font-semibold text-slate-900">{dict.traceabilityTitle}</h2>
          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">{dict.lotNumberLabel}</dt>
              <dd className={cn("text-end text-slate-800", pallet.lot.isTestData && TEST_DATA_TEXT_CLASS)}>
                {pallet.lot.lotNumber}
                {pallet.lot.isTestData && (
                  <>
                    {" "}
                    <TestDataBadge />
                  </>
                )}
              </dd>
            </div>
            <Row label={dict.factoryLabel} value={pallet.lot.factory.name} />
            <Row label={dict.fieldLabel} value={pallet.lot.field.name} />
            <Row label={dict.gradeFieldLabel} value={dict.gradeLabel.replace("{grade}", pallet.lot.grade)} />
            <Row label={dict.formatFieldLabel} value={formatLabel(dict, pallet.lot.format)} />
            <Row label={dict.weightLabel} value={`${pallet.weightTonnes} t`} />
            <Row label={dict.coldRoomLabel} value={pallet.coldRoom?.name} />
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">{dict.storageSlotLabel}</dt>
              <dd className="text-end text-slate-800">
                {pallet.slot ? (
                  <>
                    {dict.rackLevelRound
                      .replace("{rack}", pallet.slot.rack)
                      .replace("{level}", String(pallet.slot.level))
                      .replace("{round}", String(pallet.slot.round))}{" "}
                    <a href={`/storage/map/${pallet.coldRoomId}`} className="text-emerald-700 hover:underline">
                      {dict.viewMapLink}
                    </a>
                  </>
                ) : pallet.coldRoomId ? (
                  <a href={`/storage/map/${pallet.coldRoomId}`} className="text-emerald-700 hover:underline">
                    {dict.notAssignedSlot}
                  </a>
                ) : (
                  "—"
                )}
              </dd>
            </div>
            {placementSuggestion && (
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500">{dict.suggestedPlacementLabel}</dt>
                <dd className="text-end text-slate-800">
                  <a href={`/storage/map/${placementSuggestion.roomId}`} className="text-emerald-700 hover:underline">
                    {dict.suggestedPlacementText
                      .replace("{room}", placementSuggestion.roomName)
                      .replace("{round}", String(placementSuggestion.round))
                      .replace("{rack}", placementSuggestion.rack)
                      .replace("{level}", String(placementSuggestion.level))}
                  </a>
                  <p className="text-xs text-slate-400">{placementSuggestion.reason}</p>
                </dd>
              </div>
            )}
            <Row
              label={dict.microbiologyLabel}
              value={combinedMicroStatus(pallet.lot.microbiologyResults, pallet.lot.shift.onHold).replace("_", " ")}
            />
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">{dict.totalPlateCountLabel}</dt>
              <dd className="text-end">
                <CfuTierBadge cfuValue={combinedCfuValue(pallet.lot.microbiologyResults)} />
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">{dict.mrlLabel}</dt>
              <dd className="text-end">
                <MrlStatusBadge status={pallet.lot.mrlResult?.status ?? "PENDING"} />
              </dd>
            </div>
            <Row label={dict.clientAllocatedLabel} value={pallet.client?.name} />
          </dl>
        </Card>

        <Card>
          <h2 className="text-sm font-semibold text-slate-900">{dict.wasteTitle}</h2>
          {pallet.waste.length > 0 ? (
            <ul className="mt-2 space-y-2 text-sm">
              {pallet.waste.map((w) => (
                <li key={w.id} className="rounded-md border border-slate-200 p-2">
                  <p className="font-medium text-slate-800">
                    {dict.wasteEntry.replace("{quantity}", String(w.quantity)).replace("{reason}", w.reason)}
                  </p>
                  <p className="text-xs text-slate-500">{w.date.toDateString()}</p>
                </li>
              ))}
            </ul>
          ) : pallet.status === "WASTE" ? (
            <p className="mt-2 text-sm text-slate-400">{dict.markedWasteNoReason}</p>
          ) : (
            <>
              <p className="mt-1 text-xs text-slate-500">{dict.markWasteHint}</p>
              <form action={markWasteAction.bind(null, pallet.id)} className="mt-3 space-y-3">
                <FieldGroup label={dict.reasonFieldLabel}>
                  <Input name="reason" required placeholder={dict.reasonPlaceholder} />
                </FieldGroup>
                <FieldGroup label={dict.quantityTonnesLabel}>
                  <Input name="quantity" type="number" step="0.1" defaultValue={pallet.weightTonnes} />
                </FieldGroup>
                <ConfirmSubmitButton
                  confirmMessage={dict.markWasteConfirm.replace("{number}", pallet.palletNumber)}
                  className="inline-flex items-center justify-center gap-2 rounded-md bg-red-600 px-3.5 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700"
                >
                  {dict.markAsWaste}
                </ConfirmSubmitButton>
              </form>
            </>
          )}
        </Card>
      </div>

      <Card>
        <h2 className="text-sm font-semibold text-slate-900">{dict.packingDetailsTitle}</h2>
        <dl className="mt-3 grid grid-cols-4 gap-x-6 gap-y-2 text-sm">
          <Row label={fpe.packingDate} value={pallet.packingDate?.toDateString()} />
          <Row label={fpe.packingLocation} value={pallet.packingLocation} />
          <Row label={fpe.supervisor} value={pallet.packingSupervisor} />
          <Row label={fpe.cartonLogo} value={pallet.cartonLogo} />
          <Row label={fpe.size} value={pallet.cartonSize} />
          <Row label={fpe.variety} value={pallet.variety} />
          <Row label={dict.clientSpecNoteLabel} value={pallet.clientSpecNote} />
          <Row label={dict.qualityGradeLabel} value={pallet.qualityGrade ? dict.gradeLabel.replace("{grade}", pallet.qualityGrade) : undefined} />
          <Row label={fpe.totalCartons} value={pallet.totalCartons?.toString()} />
          <Row label={fpe.product} value={pallet.isMixedVariety ? fpe.mixedVarieties : fpe.oneVariety} />
          <Row label={fpe.parcels} value={pallet.fullPallet ? fpe.fullPallet : fpe.partial} />
          <Row label={fpe.palletizationStart} value={pallet.palletizationStart?.toLocaleString()} />
          <Row label={fpe.palletizationEnd} value={pallet.palletizationEnd?.toLocaleString()} />
          <Row
            label={fpe.fruitDiameterTitle}
            value={
              pallet.fruitDiameterCalibrated == null
                ? undefined
                : pallet.fruitDiameterCalibrated
                  ? dict.calibratedValue
                  : dict.uncalibratedValue
            }
          />
        </dl>

        {pallet.loadLines.length > 0 && (
          <>
            <h2 className="mt-4 text-sm font-semibold text-slate-900">{dict.loadOutHistoryTitle}</h2>
            <p className="text-xs text-slate-500">
              {dict.loadedOfWeight.replace("{loaded}", loadedTonnes.toFixed(2)).replace("{weight}", String(pallet.weightTonnes))}
              {remainingTonnes > 0.01 && dict.remainingNote.replace("{remaining}", remainingTonnes.toFixed(2))}
            </p>
            <ul className="mt-2 space-y-1 text-sm">
              {pallet.loadLines.map((line) => (
                <li key={line.id} className="flex justify-between">
                  <a href={`/logistics/${line.container.id}`} className="text-emerald-700 hover:underline">
                    {line.container.containerNumber}
                  </a>
                  <span className="text-slate-600">
                    {line.quantityTonnes.toFixed(2)}t
                    {line.loadingEnd
                      ? ` · ${line.loadingEnd.toLocaleString()}`
                      : line.loadingStart
                        ? ` · ${dict.inProgress}`
                        : ""}
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </Card>

      {pallet.qualityChecks.length > 0 && (
        <Card>
          <h2 className="text-sm font-semibold text-slate-900">{dict.qualityChecksTitle}</h2>
          <ul className="mt-2 space-y-2">
            {pallet.qualityChecks.map((q) => (
              <li key={q.id} className="rounded-md border border-slate-200 p-2 text-sm">
                <div className="flex justify-between">
                  <span className="font-medium">
                    {q.checkpoint === "RAW_MATERIAL" ? dict.checkpointRawMaterial : dict.checkpointPostPackaging}
                  </span>
                  <span className="text-slate-500">{dict.brixShort.replace("{value}", String(q.brix))}</span>
                </div>
                <p className="text-xs text-slate-500">
                  {dict.mouldSkinInternalLine
                    .replace("{mould}", String(q.mouldPct))
                    .replace("{skin}", String(q.skinDamagePct))
                    .replace("{internal}", String(q.internalQualityPct))}
                  {q.foreignOdor && dict.foreignOdorSuffix.replace("{value}", q.foreignOdor)}
                </p>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-slate-500">{label}</dt>
      <dd className="text-end text-slate-800">{value || "—"}</dd>
    </div>
  );
}
