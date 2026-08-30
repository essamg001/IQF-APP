import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { TestDataBadge, TEST_DATA_TEXT_CLASS } from "@/components/test-data-badge";
import { cn } from "@/lib/cn";
import { formatDate } from "@/lib/dates";
import { resolveLocale } from "@/lib/i18n/resolveLocale";
import { getDictionary } from "@/lib/i18n/getDictionary";
import { DisposalForm } from "./disposal-form";

const CLASSIFICATION_COLOR = { HAZARDOUS: "red", ORGANIC: "green", OTHER: "slate" } as const;

export default async function WastePage() {
  const locale = await resolveLocale();
  const fullDict = getDictionary(locale);
  const dict = fullDict.waste;

  const [waste, disposals, factories] = await Promise.all([
    prisma.waste.findMany({
      include: { pallet: { include: { lot: true } }, shift: { include: { factory: true } } },
      orderBy: { date: "desc" },
      take: 200,
    }),
    prisma.wasteDisposalRecord.findMany({
      include: { factory: true },
      orderBy: { date: "desc" },
      take: 200,
    }),
    prisma.factory.findMany({ orderBy: { name: "asc" } }),
  ]);

  const knownSupervisorNames = [...new Set(disposals.map((d) => d.supervisorName))].sort();
  const knownDisposalMethods = [...new Set(disposals.map((d) => d.disposalMethod))].sort();

  const CLASSIFICATION_LABEL = {
    HAZARDOUS: dict.classificationHazardous,
    ORGANIC: dict.classificationOrganic,
    OTHER: dict.classificationOther,
  } as const;

  const totalTonnes = waste.reduce((sum, w) => sum + w.quantity, 0);

  const byReason = new Map<string, number>();
  for (const w of waste) {
    byReason.set(w.reason, (byReason.get(w.reason) ?? 0) + w.quantity);
  }

  return (
    <div>
      <h1 className="text-xl font-semibold text-slate-900">{dict.title}</h1>
      <p className="mt-1 text-sm text-slate-500">{dict.subtitle}</p>

      <div className="mt-4 grid grid-cols-4 gap-3">
        <Card className="p-3 text-center">
          <p className="text-xs text-slate-500">{dict.totalWasteTonnes}</p>
          <p className="text-lg font-semibold text-slate-900">{totalTonnes.toFixed(1)}</p>
        </Card>
        <Card className="p-3 text-center">
          <p className="text-xs text-slate-500">{dict.wasteEvents}</p>
          <p className="text-lg font-semibold text-slate-900">{waste.length}</p>
        </Card>
      </div>

      <Card className="mt-4 overflow-x-auto p-0">
        <table className="w-full text-start text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-slate-500">
            <tr>
              <th className="px-4 py-2 font-medium">{dict.colDate}</th>
              <th className="px-4 py-2 font-medium">{dict.colSource}</th>
              <th className="px-4 py-2 font-medium">{dict.colQuantity}</th>
              <th className="px-4 py-2 font-medium">{dict.colReason}</th>
            </tr>
          </thead>
          <tbody>
            {waste.map((w) => (
              <tr key={w.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                <td className="px-4 py-2">{formatDate(w.date, "dd MMM yyyy", locale)}</td>
                <td className="px-4 py-2">
                  {w.pallet ? (
                    <>
                      <Link
                        href={`/storage/${w.palletId}`}
                        className={cn("text-emerald-700 hover:underline", w.pallet.isTestData && TEST_DATA_TEXT_CLASS)}
                      >
                        {w.pallet.palletNumber}
                      </Link>
                      <span className={cn("text-slate-500", w.pallet.lot.isTestData && TEST_DATA_TEXT_CLASS)}>
                        {" "}
                        · {dict.lotPrefix} {w.pallet.lot.lotNumber}
                      </span>
                      {(w.pallet.isTestData || w.pallet.lot.isTestData) && (
                        <>
                          {" "}
                          <TestDataBadge />
                        </>
                      )}
                    </>
                  ) : w.shift ? (
                    <Link href={`/shifts/${w.shiftId}`} className="text-emerald-700 hover:underline">
                      {w.shift.factory.name} · {formatDate(w.shift.date, "dd MMM yyyy", locale)} (
                      {w.shift.shiftType === "DAY" ? fullDict.lab.dayShift : fullDict.lab.nightShift})
                    </Link>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="px-4 py-2">{w.quantity}</td>
                <td className="px-4 py-2">{w.reason}</td>
              </tr>
            ))}
            {waste.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-slate-400">
                  {dict.noWaste}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>

      <Card className="mt-6">
        <h2 className="text-sm font-semibold text-slate-900">{dict.disposalRegisterTitle}</h2>
        <p className="mt-1 text-xs text-slate-500">{dict.disposalRegisterSubtitle}</p>
        <div className="mt-4">
          <DisposalForm
            factories={factories}
            knownSupervisorNames={knownSupervisorNames}
            knownDisposalMethods={knownDisposalMethods}
          />
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-start text-sm">
            <thead className="border-b border-slate-200 text-slate-500">
              <tr>
                <th className="px-2 py-2 font-medium">{dict.colDate}</th>
                <th className="px-2 py-2 font-medium">{fullDict.common.factory}</th>
                <th className="px-2 py-2 font-medium">{dict.disposalFormSupervisor}</th>
                <th className="px-2 py-2 font-medium">{dict.disposalFormMethod}</th>
                <th className="px-2 py-2 font-medium">{fullDict.common.location}</th>
                <th className="px-2 py-2 font-medium">{dict.disposalFormClassification}</th>
                <th className="px-2 py-2 font-medium">{dict.disposalFormNotes}</th>
              </tr>
            </thead>
            <tbody>
              {disposals.map((d) => (
                <tr key={d.id} className="border-b border-slate-100 last:border-0">
                  <td className="px-2 py-2">{formatDate(d.date, "dd MMM yyyy", locale)}</td>
                  <td className="px-2 py-2">{d.factory.name}</td>
                  <td className="px-2 py-2">{d.supervisorName}</td>
                  <td className="px-2 py-2">{d.disposalMethod}</td>
                  <td className="px-2 py-2">{d.location || "—"}</td>
                  <td className="px-2 py-2">
                    <Badge color={CLASSIFICATION_COLOR[d.classification]}>{CLASSIFICATION_LABEL[d.classification]}</Badge>
                  </td>
                  <td className="px-2 py-2 text-slate-500">{d.notes || "—"}</td>
                </tr>
              ))}
              {disposals.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-2 py-8 text-center text-slate-400">
                    {dict.noDisposalsLogged}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
