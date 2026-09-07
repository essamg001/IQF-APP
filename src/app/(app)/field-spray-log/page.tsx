import { prisma } from "@/lib/prisma";
import { LinkButton } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { activeRestriction, sprayClearDate } from "@/lib/fieldSpray";
import { TestDataBadge, TEST_DATA_TEXT_CLASS } from "@/components/test-data-badge";
import { cn } from "@/lib/cn";
import { formatDate } from "@/lib/dates";
import { resolveLocale } from "@/lib/i18n/resolveLocale";
import { getDictionary } from "@/lib/i18n/getDictionary";
import { PrintButton } from "@/components/ui/print-button";

export default async function FieldSprayLogPage() {
  const locale = await resolveLocale();
  const dict = getDictionary(locale).fieldSprayLog;

  const sprays = await prisma.fieldSprayRecord.findMany({
    include: { field: true },
    orderBy: { sprayDate: "desc" },
  });

  const now = new Date();
  const byField = new Map<string, typeof sprays>();
  for (const s of sprays) {
    const list = byField.get(s.fieldId) ?? [];
    list.push(s);
    byField.set(s.fieldId, list);
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">{dict.title}</h1>
          <p className="mt-1 text-sm text-slate-500">{dict.subtitle}</p>
        </div>
        <div className="flex items-center gap-2">
          <LinkButton className="no-print" href="/field-spray-log/new">
            {dict.logSprayButton}
          </LinkButton>
          <PrintButton />
        </div>
      </div>

      <Card className="mt-6 overflow-x-auto p-0">
        <table className="w-full text-start text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-slate-500">
            <tr>
              <th className="px-4 py-2 font-medium">{dict.colField}</th>
              <th className="px-4 py-2 font-medium">{dict.colChemical}</th>
              <th className="px-4 py-2 font-medium">{dict.colDateSprayed}</th>
              <th className="px-4 py-2 font-medium">{dict.colNoHarvestDays}</th>
              <th className="px-4 py-2 font-medium">{dict.colClearDate}</th>
              <th className="px-4 py-2 font-medium">{dict.colStatus}</th>
              <th className="px-4 py-2 font-medium">{dict.colSprayedBy}</th>
              <th className="px-4 py-2 font-medium">{dict.colPhiLimit}</th>
              <th className="px-4 py-2 font-medium">{dict.colLeaf}</th>
              <th className="px-4 py-2 font-medium">{dict.colGlobalGap}</th>
              <th className="px-4 py-2 font-medium">{dict.colNurture}</th>
              <th className="px-4 py-2 font-medium">{dict.colFairtrade}</th>
            </tr>
          </thead>
          <tbody>
            {sprays.map((s) => {
              const clearDate = sprayClearDate(s);
              const isRestricted = activeRestriction(byField.get(s.fieldId) ?? [], now)?.id === s.id;
              const stillActive = clearDate > now;
              return (
                <tr key={s.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                  <td className={cn("px-4 py-2 font-medium text-slate-800", s.isTestData && TEST_DATA_TEXT_CLASS)}>
                    {s.field.name}
                    {s.isTestData && (
                      <>
                        {" "}
                        <TestDataBadge />
                      </>
                    )}
                  </td>
                  <td className="px-4 py-2">{s.chemicalName}</td>
                  <td className="px-4 py-2">{formatDate(s.sprayDate, "dd MMM yyyy", locale)}</td>
                  <td className="px-4 py-2">{dict.daysValue.replace("{days}", String(s.noHarvestDays))}</td>
                  <td className="px-4 py-2">{formatDate(clearDate, "dd MMM yyyy", locale)}</td>
                  <td className="px-4 py-2">
                    {stillActive ? (
                      <Badge color={isRestricted ? "red" : "slate"}>{dict.statusRestricted}</Badge>
                    ) : (
                      <Badge color="green">{dict.statusClear}</Badge>
                    )}
                  </td>
                  <td className="px-4 py-2">{s.sprayedByName || "—"}</td>
                  <td className="px-4 py-2">{s.phiLimitDays != null ? dict.daysValue.replace("{days}", String(s.phiLimitDays)) : "—"}</td>
                  <td className="px-4 py-2">{s.leafCompliancePct != null ? `${s.leafCompliancePct}%` : "—"}</td>
                  <td className="px-4 py-2">{s.globalGapCompliancePct != null ? `${s.globalGapCompliancePct}%` : "—"}</td>
                  <td className="px-4 py-2">{s.nurtureCompliancePct != null ? `${s.nurtureCompliancePct}%` : "—"}</td>
                  <td className="px-4 py-2">{s.fairtradeCompliancePct != null ? `${s.fairtradeCompliancePct}%` : "—"}</td>
                </tr>
              );
            })}
            {sprays.length === 0 && (
              <tr>
                <td colSpan={12} className="px-4 py-8 text-center text-slate-400">
                  {dict.noSpraysLogged}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
