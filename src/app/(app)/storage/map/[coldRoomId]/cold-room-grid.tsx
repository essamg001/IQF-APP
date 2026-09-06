"use client";

import { useActionState, useMemo, useState } from "react";
import type { MrlStatus } from "@prisma/client";
import { assignPalletToSlotAction, unassignSlotAction, pullPalletAsideAction, reshelvePalletAction } from "../actions";
import { Input, Select, FieldGroup } from "@/components/ui/field";
import { Button, LinkButton } from "@/components/ui/button";
import { ConfirmSubmitButton } from "@/components/ui/confirm-submit-button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CfuTierBadge } from "@/components/cfu-tier-badge";
import { MrlStatusBadge } from "@/components/mrl-status-badge";
import { CfuTierLegend } from "@/components/cfu-tier-legend";
import { cfuTierFor } from "@/lib/cfuTier";
import { rackLetter } from "@/lib/coldStorage";
import { TestDataBadge, TEST_DATA_TEXT_CLASS } from "@/components/test-data-badge";
import { cn } from "@/lib/cn";
import { useTranslations } from "@/lib/i18n/locale-context";

type SlotPallet = {
  id: string;
  palletNumber: string;
  status: string;
  lotNumber: string;
  fieldNames: string;
  clientName: string | null;
  quality: {
    grade: string;
    microbiologyStatus: string;
    cfuValue: number | null;
    mrlStatus: MrlStatus;
    brix: number | null;
    mouldPct: number | null;
    internalQualityPct: number | null;
    source: "pallet" | "lot" | "none";
  } | null;
  isTestData: boolean;
};

type Slot = { id: string; round: number; rack: string; level: number; pallet: SlotPallet | null };
type UnassignedPallet = { id: string; palletNumber: string; lotNumber: string; fieldNames: string; isTestData: boolean };
type PullAside = {
  id: string;
  palletId: string;
  palletNumber: string;
  round: number;
  rack: string;
  pulledAt: string;
  reason: string | null;
  isTestData: boolean;
  suggestedSlot: { id: string; round: number; rack: string; level: number } | null;
};

// Fallback coloring for pallets with no cfu/g reading yet -- once a reading
// exists, the cfu tier ramp (see src/lib/cfuTier.ts) takes over instead, per
// the owner's ask to have the storage map reflect the cfu tier colors.
const STATUS_COLOR: Record<string, string> = {
  APPROVED: "bg-emerald-100 border-emerald-300 text-emerald-900 hover:bg-emerald-200",
  SENT_TO_LAB: "bg-amber-100 border-amber-300 text-amber-900 hover:bg-amber-200",
  PENDING: "bg-amber-50 border-amber-200 text-amber-800 hover:bg-amber-100",
  FAILED_MINOR: "bg-red-100 border-red-300 text-red-900 hover:bg-red-200",
  FAILED_SEVERE: "bg-red-200 border-red-400 text-red-950 hover:bg-red-300",
  ON_HOLD: "bg-red-100 border-red-400 text-red-900 hover:bg-red-200",
};

export function ColdRoomGrid({
  rounds,
  rackCount,
  levelCount,
  slots,
  suggestedSlotId,
  unassignedPallets,
  highlightPalletIds,
  orderContext,
  returnTo,
  pullAsides,
}: {
  coldRoomId: string;
  rounds: number;
  rackCount: number;
  levelCount: number;
  slots: Slot[];
  suggestedSlotId: string | null;
  unassignedPallets: UnassignedPallet[];
  highlightPalletIds?: string[];
  /** Arrived here from an order/container flow -- shows "X of Y ready, Z still needed" alongside the pick list. */
  orderContext?: { orderNumber: string; allocated: number; target: number } | null;
  /** Where to send someone back to once they've found what they came for (e.g. the container they're loading). */
  returnTo?: string;
  pullAsides: PullAside[];
}) {
  const fullDict = useTranslations();
  const dict = fullDict.storage;
  const highlightSet = useMemo(() => new Set(highlightPalletIds ?? []), [highlightPalletIds]);
  const highlightedSlots = useMemo(
    () => slots.filter((s) => s.pallet && highlightSet.has(s.pallet.id)),
    [slots, highlightSet]
  );
  const suggestedSlot = useMemo(() => slots.find((s) => s.id === suggestedSlotId) ?? null, [slots, suggestedSlotId]);
  const [round, setRound] = useState(highlightedSlots[0]?.round ?? suggestedSlot?.round ?? 1);
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
  const [reshelveError, reshelveFormAction] = useActionState(reshelvePalletAction, undefined);

  const racks = useMemo(() => Array.from({ length: rackCount }, (_, i) => rackLetter(i)), [rackCount]);
  const levels = useMemo(() => Array.from({ length: levelCount }, (_, i) => levelCount - i), [levelCount]);

  const slotByPosition = useMemo(() => {
    const m = new Map<string, Slot>();
    for (const s of slots) m.set(`${s.round}-${s.rack}-${s.level}`, s);
    return m;
  }, [slots]);

  const selectedSlot = slots.find((s) => s.id === selectedSlotId) ?? null;

  return (
    <div className="mt-4 grid grid-cols-[1fr_320px] gap-4">
      <Card className="overflow-x-auto p-3">
        {orderContext && (
          <div
            className={cn(
              "mb-3 rounded-md border px-3 py-2 text-xs",
              orderContext.allocated >= orderContext.target
                ? "border-blue-300 bg-blue-50 text-blue-900"
                : "border-amber-300 bg-amber-50 text-amber-900"
            )}
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <strong>{dict.orderContextPrefix.replace("{orderNumber}", orderContext.orderNumber)}</strong>
              {returnTo && (
                <a href={returnTo} className="shrink-0 font-medium underline hover:no-underline">
                  {dict.goToContainerLink}
                </a>
              )}
            </div>
            <p className="mt-1">
              {orderContext.allocated >= orderContext.target
                ? dict.orderContextFullyReady.replace("{allocated}", String(orderContext.allocated))
                : dict.orderContextOnHold
                    .replace("{allocated}", String(orderContext.allocated))
                    .replace("{target}", String(orderContext.target))}
            </p>
            {orderContext.allocated < orderContext.target && (
              <p className="mt-1">
                {dict.orderContextStillOwed
                  .replace("{missing}", String(orderContext.target - orderContext.allocated))
                  .replace("{target}", String(orderContext.target))}
              </p>
            )}
          </div>
        )}
        {highlightedSlots.length > 0 && (
          <div className="mb-3 rounded-md border border-blue-300 bg-blue-50 px-3 py-2 text-xs text-blue-900">
            <p className="font-semibold">
              {orderContext && orderContext.allocated < orderContext.target ? dict.pickListTitleSoFar : dict.pickListTitle}
            </p>
            <ul className="mt-1 space-y-0.5">
              {highlightedSlots
                .sort((a, b) => a.round - b.round || a.rack.localeCompare(b.rack) || a.level - b.level)
                .map((s) => (
                  <li key={s.id} className="flex items-center justify-between gap-3">
                    <span className={cn("font-mono font-medium", s.pallet!.isTestData && TEST_DATA_TEXT_CLASS)}>
                      {s.pallet!.palletNumber}
                    </span>
                    <span>
                      {dict.rackLevelRound
                        .replace("{rack}", s.rack)
                        .replace("{level}", String(s.level))
                        .replace("{round}", String(s.round))}
                    </span>
                  </li>
                ))}
            </ul>
          </div>
        )}
        {pullAsides.length > 0 && (
          <div className="mb-3 rounded-md border border-orange-300 bg-orange-50 px-3 py-2 text-xs text-orange-900">
            <p className="font-semibold">{dict.awaitingReshelveTitle.replace("{count}", String(pullAsides.length))}</p>
            <ul className="mt-1.5 space-y-1.5">
              {pullAsides.map((p) => (
                <li key={p.id} className="flex flex-wrap items-center justify-between gap-2">
                  <span>
                    <span className={cn("font-mono font-medium", p.isTestData && TEST_DATA_TEXT_CLASS)}>{p.palletNumber}</span>
                    {" — "}
                    {dict.pulledFromNote.replace("{rack}", p.rack).replace("{round}", String(p.round))}
                  </span>
                  {p.suggestedSlot ? (
                    <form action={reshelveFormAction}>
                      <input type="hidden" name="pullAsideId" value={p.id} />
                      <input type="hidden" name="slotId" value={p.suggestedSlot.id} />
                      <button
                        type="submit"
                        className="shrink-0 rounded-md bg-orange-600 px-2 py-1 font-medium text-white hover:bg-orange-700"
                      >
                        {dict.reshelveToButton
                          .replace("{rack}", p.suggestedSlot.rack)
                          .replace("{level}", String(p.suggestedSlot.level))}
                      </button>
                    </form>
                  ) : (
                    <span className="text-orange-700">{dict.lineFullNote}</span>
                  )}
                </li>
              ))}
            </ul>
            {reshelveError && <p className="mt-1.5 text-red-700">{reshelveError}</p>}
          </div>
        )}
        {suggestedSlot && (
          <div className="mb-3 flex items-center justify-between gap-3 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            <span>
              <strong>{dict.suggestedNextSlot}</strong>{" "}
              {dict.suggestedNextSlotText
                .replace("{round}", String(suggestedSlot.round))
                .replace("{rack}", suggestedSlot.rack)
                .replace("{level}", String(suggestedSlot.level))}
            </span>
            <button
              onClick={() => {
                setRound(suggestedSlot.round);
                setSelectedSlotId(suggestedSlot.id);
              }}
              className="shrink-0 rounded-md bg-amber-600 px-2 py-1 font-medium text-white hover:bg-amber-700"
            >
              {dict.jumpToIt}
            </button>
          </div>
        )}
        {rounds > 1 && (
          <div className="mb-3 flex gap-1">
            {Array.from({ length: rounds }, (_, i) => i + 1).map((r) => (
              <button
                key={r}
                onClick={() => setRound(r)}
                className={`rounded-md px-3 py-1 text-xs font-medium ${
                  r === round ? "bg-emerald-700 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {dict.roundLabel.replace("{round}", String(r))}
              </button>
            ))}
          </div>
        )}
        <div
          className="grid gap-1"
          style={{ gridTemplateColumns: `2rem repeat(${racks.length}, minmax(2.25rem, 1fr))` }}
        >
          <div />
          {racks.map((rack) => (
            <div key={rack} className="text-center text-xs font-semibold text-slate-500">
              {rack}
            </div>
          ))}
          {levels.map((level) => (
            <RowFragment
              key={level}
              level={level}
              racks={racks}
              round={round}
              slotByPosition={slotByPosition}
              selectedSlotId={selectedSlotId}
              suggestedSlotId={suggestedSlotId}
              highlightSet={highlightSet}
              onSelect={setSelectedSlotId}
            />
          ))}
        </div>
        <CfuTierLegend
          className="mt-3 border-t border-slate-100 pt-2"
          title={fullDict.common.cfuLegendTitle}
          rejectWord={fullDict.common.cfuRejectWord}
        />
      </Card>

      <div>
        {selectedSlot ? (
          <SlotDetail
            key={selectedSlot.id}
            slot={selectedSlot}
            unassignedPallets={unassignedPallets}
            onClose={() => setSelectedSlotId(null)}
          />
        ) : (
          <Card className="text-sm text-slate-400">{dict.clickSlotHint}</Card>
        )}
      </div>
    </div>
  );
}

function RowFragment({
  level,
  racks,
  round,
  slotByPosition,
  selectedSlotId,
  suggestedSlotId,
  highlightSet,
  onSelect,
}: {
  level: number;
  racks: string[];
  round: number;
  slotByPosition: Map<string, Slot>;
  selectedSlotId: string | null;
  suggestedSlotId: string | null;
  highlightSet: Set<string>;
  onSelect: (id: string) => void;
}) {
  const dict = useTranslations().storage;
  return (
    <>
      <div className="flex items-center justify-end pr-1 text-xs text-slate-400">{level}</div>
      {racks.map((rack) => {
        const slot = slotByPosition.get(`${round}-${rack}-${level}`);
        if (!slot) return <div key={rack} />;
        const occupied = !!slot.pallet;
        const cfuValue = slot.pallet?.quality?.cfuValue ?? null;
        let colorClass: string;
        if (!occupied) {
          colorClass = "bg-slate-50 border-slate-200 text-slate-300 hover:bg-slate-100";
        } else if (cfuValue != null) {
          const tier = cfuTierFor(cfuValue);
          colorClass = `${tier.bg} ${tier.text} border-black/10 hover:opacity-90`;
        } else {
          colorClass = STATUS_COLOR[slot.pallet!.quality?.microbiologyStatus ?? "PENDING"] ?? STATUS_COLOR.PENDING;
        }
        const isSuggested = !occupied && slot.id === suggestedSlotId;
        const isHighlighted = occupied && highlightSet.has(slot.pallet!.id);
        const title = occupied
          ? `${slot.pallet!.palletNumber} — ${dict.lotHashLabel} ${slot.pallet!.lotNumber}${
              cfuValue != null ? dict.cfuPerGramSuffix.replace("{value}", cfuValue.toLocaleString("en-US")) : ""
            }${slot.pallet!.isTestData ? dict.testDataSuffix : ""}${isHighlighted ? ` — ${dict.pickListTitle}` : ""}`
          : isSuggested
            ? dict.emptySuggestedSlotTitle.replace("{rackLevel}", `${rack}${level}`)
            : dict.emptySlotTitle.replace("{rackLevel}", `${rack}${level}`);
        return (
          <button
            key={rack}
            title={title}
            onClick={() => onSelect(slot.id)}
            className={`h-8 truncate rounded border px-0.5 text-[10px] font-medium ${colorClass} ${
              isHighlighted
                ? "ring-4 ring-blue-600"
                : selectedSlotId === slot.id
                  ? "ring-2 ring-emerald-600"
                  : isSuggested
                    ? "ring-2 ring-amber-500"
                    : ""
            }`}
          >
            {occupied ? slot.pallet!.palletNumber.slice(-6) : isSuggested ? "★" : "+"}
          </button>
        );
      })}
    </>
  );
}

function SlotDetail({
  slot,
  unassignedPallets,
  onClose,
}: {
  slot: Slot;
  unassignedPallets: UnassignedPallet[];
  onClose: () => void;
}) {
  const [error, formAction, pending] = useActionState(assignPalletToSlotAction, undefined);
  const [pullAsideError, pullAsideFormAction, pullAsidePending] = useActionState(pullPalletAsideAction, undefined);
  const [pullReason, setPullReason] = useState("");
  const dict = useTranslations().storage;

  return (
    <Card className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-900">
          {dict.rackLevelRound
            .replace("{rack}", slot.rack)
            .replace("{level}", String(slot.level))
            .replace("{round}", String(slot.round))}
        </h2>
        <button onClick={onClose} className="text-xs text-slate-400 hover:text-slate-600">
          {dict.closeLabel}
        </button>
      </div>

      {slot.pallet ? (
        <>
          {slot.pallet.isTestData && (
            <div className="flex items-center gap-1.5">
              <TestDataBadge />
            </div>
          )}
          <dl className="space-y-1 text-sm">
            <Row
              label={dict.palletHashLabel}
              value={slot.pallet.palletNumber}
              className={slot.pallet.isTestData ? TEST_DATA_TEXT_CLASS : undefined}
            />
            <Row
              label={dict.lotHashLabel}
              value={slot.pallet.lotNumber}
              className={slot.pallet.isTestData ? TEST_DATA_TEXT_CLASS : undefined}
            />
            <Row label={dict.fieldHashLabel} value={slot.pallet.fieldNames} />
            <Row label={dict.clientHashLabel} value={slot.pallet.clientName ?? "—"} />
            <Row label={dict.gradeFieldLabel} value={slot.pallet.quality ? dict.gradeLabel.replace("{grade}", slot.pallet.quality.grade) : "—"} />
            <Row
              label={dict.labClearanceLabel}
              value={slot.pallet.quality?.microbiologyStatus.replace(/_/g, " ") ?? "—"}
            />
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">{dict.totalPlateCountLabel}</dt>
              <dd className="text-end">
                <CfuTierBadge cfuValue={slot.pallet.quality?.cfuValue ?? null} />
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">{dict.colMrl}</dt>
              <dd className="text-end">
                <MrlStatusBadge status={slot.pallet.quality?.mrlStatus ?? "PENDING"} />
              </dd>
            </div>
            <Row
              label={dict.brixHashLabel}
              value={slot.pallet.quality?.brix != null ? String(slot.pallet.quality.brix) : "—"}
            />
            <Row
              label={dict.mouldPctLabel}
              value={slot.pallet.quality?.mouldPct != null ? `${slot.pallet.quality.mouldPct}%` : "—"}
            />
            <Row
              label={dict.internalQualityPctLabel}
              value={
                slot.pallet.quality?.internalQualityPct != null ? `${slot.pallet.quality.internalQualityPct}%` : "—"
              }
            />
          </dl>
          {slot.pallet.quality?.source === "lot" && (
            <p className="text-xs text-slate-400">{dict.qualityShownIsLotNote}</p>
          )}
          <div className="flex gap-2">
            <LinkButton href={`/storage/${slot.pallet.id}`} variant="secondary" className="flex-1 text-center">
              {dict.viewPallet}
            </LinkButton>
            <form action={unassignSlotAction.bind(null, slot.id)}>
              <ConfirmSubmitButton
                confirmMessage={dict.unassignConfirm
                  .replace("{pallet}", slot.pallet.palletNumber)
                  .replace("{round}", String(slot.round))
                  .replace("{rack}", slot.rack)
                  .replace("{level}", String(slot.level))}
                className="inline-flex items-center justify-center gap-2 rounded-md bg-red-600 px-3.5 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700"
              >
                {dict.unassign}
              </ConfirmSubmitButton>
            </form>
          </div>

          <div className="border-t border-slate-100 pt-3">
            <p className="mb-1.5 text-xs text-slate-500">{dict.pullAsideHint}</p>
            <form action={pullAsideFormAction} className="space-y-2">
              <input type="hidden" name="slotId" value={slot.id} />
              <Input
                name="reason"
                placeholder={dict.pullAsideReasonPlaceholder}
                value={pullReason}
                onChange={(e) => setPullReason(e.target.value)}
                className="text-sm"
              />
              <ConfirmSubmitButton
                confirmMessage={dict.pullAsideConfirm
                  .replace("{pallet}", slot.pallet.palletNumber)
                  .replace("{round}", String(slot.round))
                  .replace("{rack}", slot.rack)
                  .replace("{level}", String(slot.level))}
                disabled={pullAsidePending}
                className="inline-flex w-full items-center justify-center gap-2 rounded-md border border-orange-300 bg-orange-50 px-3.5 py-2 text-sm font-medium text-orange-800 transition-colors hover:bg-orange-100 disabled:opacity-50"
              >
                {pullAsidePending ? dict.pullingAside : dict.pullAside}
              </ConfirmSubmitButton>
              {pullAsideError && <p className="text-xs text-red-600">{pullAsideError}</p>}
            </form>
          </div>
        </>
      ) : (
        <form action={formAction} className="space-y-3">
          <input type="hidden" name="slotId" value={slot.id} />
          <FieldGroup label={dict.assignPalletToSlot}>
            <Select name="palletId" required defaultValue="">
              <option value="" disabled>
                {dict.selectPalletPlaceholder}
              </option>
              {unassignedPallets.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.palletNumber} — {dict.lotHashLabel} {p.lotNumber} ({p.fieldNames}){p.isTestData ? dict.testDataSuffix : ""}
                </option>
              ))}
            </Select>
          </FieldGroup>
          {unassignedPallets.length === 0 && (
            <p className="text-xs text-slate-400">{dict.noUnassignedPallets}</p>
          )}
          {error && <p className="text-xs text-red-600">{error}</p>}
          <Button type="submit" disabled={pending || unassignedPallets.length === 0} className="w-full">
            {pending ? dict.assigning : dict.assign}
          </Button>
        </form>
      )}
    </Card>
  );
}

function Row({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-slate-500">{label}</dt>
      <dd className={cn("text-end text-slate-800", className)}>{value}</dd>
    </div>
  );
}
