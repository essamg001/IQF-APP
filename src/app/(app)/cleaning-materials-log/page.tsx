import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { formatDate } from "@/lib/dates";
import { resolveLocale } from "@/lib/i18n/resolveLocale";
import { getDictionary } from "@/lib/i18n/getDictionary";
import { ConsumptionForm } from "./consumption-form";
import { PrintButton } from "@/components/ui/print-button";

export default async function CleaningMaterialsLogPage() {
  const locale = await resolveLocale();
  const dict = getDictionary(locale).cleaningMaterialsLog;

  const [records, factories] = await Promise.all([
    prisma.cleaningMaterialConsumptionRecord.findMany({
      include: { factory: true },
      orderBy: { date: "desc" },
      take: 200,
    }),
    prisma.factory.findMany({ orderBy: { name: "asc" } }),
  ]);

  const knownMaterialNames = [...new Set(records.map((r) => r.materialName))].sort();
  const knownRecordedByNames = [...new Set(records.map((r) => r.recordedByName))].sort();

  return (
    <div>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">{dict.title}</h1>
          <p className="mt-1 text-sm text-slate-500">{dict.subtitle}</p>
        </div>
        <PrintButton />
      </div>

      <Card className="mt-6">
        <div className="no-print">
          <ConsumptionForm
            factories={factories}
            knownMaterialNames={knownMaterialNames}
            knownRecordedByNames={knownRecordedByNames}
          />
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-start text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-slate-500">
              <tr>
                <th className="px-4 py-2 font-medium">{dict.colDate}</th>
                <th className="px-4 py-2 font-medium">{dict.colFactory}</th>
                <th className="px-4 py-2 font-medium">{dict.colMaterial}</th>
                <th className="px-4 py-2 font-medium">{dict.colQuantity}</th>
                <th className="px-4 py-2 font-medium">{dict.colConcentration}</th>
                <th className="px-4 py-2 font-medium">{dict.colPurpose}</th>
                <th className="px-4 py-2 font-medium">{dict.colRecordedBy}</th>
              </tr>
            </thead>
            <tbody>
              {records.map((r) => (
                <tr key={r.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                  <td className="px-4 py-2">{formatDate(r.date, "dd MMM yyyy", locale)}</td>
                  <td className="px-4 py-2">{r.factory.name}</td>
                  <td className="px-4 py-2 font-medium text-slate-800">{r.materialName}</td>
                  <td className="px-4 py-2">
                    {r.quantityUsed}
                    {r.unit ? ` ${r.unit}` : ""}
                  </td>
                  <td className="px-4 py-2">{r.concentration || "—"}</td>
                  <td className="px-4 py-2">{r.purpose || "—"}</td>
                  <td className="px-4 py-2 text-slate-500">{r.recordedByName}</td>
                </tr>
              ))}
              {records.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                    {dict.noRecordsLogged}
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
