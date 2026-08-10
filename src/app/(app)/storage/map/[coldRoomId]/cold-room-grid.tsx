"use client";

import { useActionState, useMemo, useState } from "react";
import { assignPalletToSlotAction, unassignSlotAction } from "../actions";
import { Select, FieldGroup } from "@/components/ui/field";
import { Button, LinkButton } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CfuTierBadge } from "@/components/cfu-tier-badge";
import { CfuTierLegend } from "@/components/cfu-tier-legend";
import { cfuTierFor } from "@/lib/cfuTier";
import { rackLetter } from "@/lib/coldStorage";
import { TestDataBadge, TEST_DATA_TEXT_CLASS } from "@/components/test-data-badge";
import { cn } from "@/lib/cn";

type SlotPallet = {
  id: string;
  palletNumber: string;
  status: string;
  lotNumber: string;
  fieldName: string;
  clientName: string | null;
  quality: {
    grade: string;
    microbiologyStatus: string;
    cfuValue: number | null;
    brix: number | null;
    mouldPct: number | null;
    internalQualityPct: number | null;
    source: "pallet" | "lot" | "none";
  } | null;
  isTestData: boolean;
};

type Slot = { id: string; round: number; rack: string; level: number; pallet: SlotPallet | null };
type UnassignedPallet = { id: string; palletNumber: string; lotNumber: string; fieldName: string; isTestData: boolean };

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
}: {
  coldRoomId: string;
  rounds: number;
  rackCount: number;
  levelCount: number;
  slots: Slot[];
  suggestedSlotId: string | null;
  unassignedPallets: UnassignedPallet[];
}) {
  const suggestedSlot = useMemo(() => slots.find((s) => s.id === suggestedSlotId) ?? null, [slots, suggestedSlotId]);
  const [round, setRound] = useState(suggestedSlot?.round ?? 1);
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);

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
        {suggestedSlot && (
          <div className="mb-3 flex items-center justify-between gap-3 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            <span>
              <strong>Suggested next slot:</strong> Round {suggestedSlot.round} · Rack {suggestedSlot.rack} · Level{" "}
              {suggestedSlot.level}
            </span>
            <button
              onClick={() => {
                setRound(suggestedSlot.round);
                setSelectedSlotId(suggestedSlot.id);
              }}
              className="shrink-0 rounded-md bg-amber-600 px-2 py-1 font-medium text-white hover:bg-amber-700"
            >
              Jump to it
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
                Round {r}
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
              onSelect={setSelectedSlotId}
            />
          ))}
        </div>
        <CfuTierLegend className="mt-3 border-t border-slate-100 pt-2" />
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
          <Card className="text-sm text-slate-400">Click a slot to assign a pallet or view what&apos;s stored there.</Card>
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
  onSelect,
}: {
  level: number;
  racks: string[];
  round: number;
  slotByPosition: Map<string, Slot>;
  selectedSlotId: string | null;
  suggestedSlotId: string | null;
  onSelect: (id: string) => void;
}) {
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
        const title = occupied
          ? `${slot.pallet!.palletNumber} — Lot ${slot.pallet!.lotNumber}${
              cfuValue != null ? ` — ${cfuValue.toLocaleString()} cfu/g` : ""
            }${slot.pallet!.isTestData ? " — TEST DATA" : ""}`
          : isSuggested
            ? `${rack}${level} — empty (suggested next slot)`
            : `${rack}${level} — empty`;
        return (
          <button
            key={rack}
            title={title}
            onClick={() => onSelect(slot.id)}
            className={`h-8 truncate rounded border px-0.5 text-[10px] font-medium ${colorClass} ${
              selectedSlotId === slot.id ? "ring-2 ring-emerald-600" : isSuggested ? "ring-2 ring-amber-500" : ""
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

  return (
    <Card className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-900">
          Rack {slot.rack} · Level {slot.level} · Round {slot.round}
        </h2>
        <button onClick={onClose} className="text-xs text-slate-400 hover:text-slate-600">
          Close
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
              label="Pallet #"
              value={slot.pallet.palletNumber}
              className={slot.pallet.isTestData ? TEST_DATA_TEXT_CLASS : undefined}
            />
            <Row
              label="Lot"
              value={slot.pallet.lotNumber}
              className={slot.pallet.isTestData ? TEST_DATA_TEXT_CLASS : undefined}
            />
            <Row label="Field" value={slot.pallet.fieldName} />
            <Row label="Client" value={slot.pallet.clientName ?? "—"} />
            <Row label="Grade" value={slot.pallet.quality ? `Grade ${slot.pallet.quality.grade}` : "—"} />
            <Row
              label="Lab clearance"
              value={slot.pallet.quality?.microbiologyStatus.replace(/_/g, " ") ?? "—"}
            />
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">Total Plate Count</dt>
              <dd className="text-right">
                <CfuTierBadge cfuValue={slot.pallet.quality?.cfuValue ?? null} />
              </dd>
            </div>
            <Row
              label="Brix"
              value={slot.pallet.quality?.brix != null ? String(slot.pallet.quality.brix) : "—"}
            />
            <Row
              label="Mould %"
              value={slot.pallet.quality?.mouldPct != null ? `${slot.pallet.quality.mouldPct}%` : "—"}
            />
            <Row
              label="Internal quality %"
              value={
                slot.pallet.quality?.internalQualityPct != null ? `${slot.pallet.quality.internalQualityPct}%` : "—"
              }
            />
          </dl>
          {slot.pallet.quality?.source === "lot" && (
            <p className="text-xs text-slate-400">Quality shown is the lot&apos;s latest check — no check logged against this specific pallet yet.</p>
          )}
          <div className="flex gap-2">
            <LinkButton href={`/storage/${slot.pallet.id}`} variant="secondary" className="flex-1 text-center">
              View pallet
            </LinkButton>
            <form action={unassignSlotAction.bind(null, slot.id)}>
              <Button type="submit" variant="danger">
                Unassign
              </Button>
            </form>
          </div>
        </>
      ) : (
        <form action={formAction} className="space-y-3">
          <input type="hidden" name="slotId" value={slot.id} />
          <FieldGroup label="Assign pallet to this slot">
            <Select name="palletId" required defaultValue="">
              <option value="" disabled>
                Select a pallet…
              </option>
              {unassignedPallets.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.palletNumber} — Lot {p.lotNumber} ({p.fieldName}){p.isTestData ? " — TEST DATA" : ""}
                </option>
              ))}
            </Select>
          </FieldGroup>
          {unassignedPallets.length === 0 && (
            <p className="text-xs text-slate-400">No unassigned pallets available right now.</p>
          )}
          {error && <p className="text-xs text-red-600">{error}</p>}
          <Button type="submit" disabled={pending || unassignedPallets.length === 0} className="w-full">
            {pending ? "Assigning…" : "Assign"}
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
      <dd className={cn("text-right text-slate-800", className)}>{value}</dd>
    </div>
  );
}
