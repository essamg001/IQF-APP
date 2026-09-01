"use client";

import { Card } from "@/components/ui/card";
import { PackingEntryForm } from "./packing-entry-form";
import { ConfirmSubmitButton } from "@/components/ui/confirm-submit-button";
import { removePackingLineAction } from "./actions";
import { useTranslations } from "@/lib/i18n/locale-context";

type PackingLine = {
  id: string;
  factory: { name: string; code: string | null } | null;
  packageType: string;
  logo: string;
  weightKg: number | null;
  variety: string | null;
  client: { name: string } | null;
  clientOther: string | null;
  firstClassQty: number | null;
  secondClassQty: number | null;
  totalPackageQty: number | null;
  totalTon: number | null;
};

export function PackingSection({
  date,
  factories,
  clients,
  lines,
}: {
  date: string;
  factories: { id: string; name: string; code: string | null }[];
  clients: { id: string; name: string }[];
  lines: PackingLine[];
}) {
  const fullDict = useTranslations();
  const dict = fullDict.dailyReport;
  const totalPackageQty = lines.reduce((s, l) => s + (l.totalPackageQty ?? 0), 0);
  const totalTon = lines.reduce((s, l) => s + (l.totalTon ?? 0), 0);

  return (
    <Card className="overflow-x-auto">
      <h2 className="text-sm font-semibold text-slate-900">{dict.packingTitle}</h2>
      <div className="mt-3">
        <PackingEntryForm date={date} factories={factories} clients={clients} />
      </div>

      <table className="mt-4 w-full text-start text-xs">
        <thead className="border-b border-slate-200 bg-slate-50 text-slate-500">
          <tr>
            <th className="px-2 py-2 font-medium">{dict.colPackage}</th>
            <th className="px-2 py-2 font-medium">{dict.colLogo}</th>
            <th className="px-2 py-2 font-medium">{dict.colWeight}</th>
            <th className="px-2 py-2 font-medium">{fullDict.common.variety}</th>
            <th className="px-2 py-2 font-medium">{dict.client}</th>
            <th className="px-2 py-2 font-medium">{dict.col1stClass}</th>
            <th className="px-2 py-2 font-medium">{dict.col2ndClass}</th>
            <th className="px-2 py-2 font-medium">{dict.colTotalPkgs}</th>
            <th className="px-2 py-2 font-medium">{dict.colTotalTon}</th>
            <th className="px-2 py-2 font-medium"></th>
          </tr>
        </thead>
        <tbody>
          {lines.map((l) => (
            <tr key={l.id} className="border-b border-slate-100 last:border-0">
              <td className="px-2 py-1.5">{l.packageType}</td>
              <td className="px-2 py-1.5">{l.logo}</td>
              <td className="px-2 py-1.5">{l.weightKg ?? "—"}</td>
              <td className="px-2 py-1.5">{l.variety ?? "—"}</td>
              <td className="px-2 py-1.5">{l.client?.name ?? l.clientOther ?? "—"}</td>
              <td className="px-2 py-1.5">{l.firstClassQty ?? "—"}</td>
              <td className="px-2 py-1.5">{l.secondClassQty ?? "—"}</td>
              <td className="px-2 py-1.5">{l.totalPackageQty ?? "—"}</td>
              <td className="px-2 py-1.5">{l.totalTon ?? "—"}</td>
              <td className="px-2 py-1.5">
                <form action={removePackingLineAction.bind(null, l.id)}>
                  <ConfirmSubmitButton confirmMessage={dict.removePackingLineConfirm} className="text-red-600 hover:underline">
                    {fullDict.common.remove}
                  </ConfirmSubmitButton>
                </form>
              </td>
            </tr>
          ))}
          {lines.length === 0 && (
            <tr>
              <td colSpan={10} className="px-2 py-6 text-center text-slate-400">
                {dict.noEntriesYet}
              </td>
            </tr>
          )}
          {lines.length > 0 && (
            <tr className="border-t-2 border-slate-300 bg-slate-50 font-semibold text-slate-900">
              <td colSpan={7} className="px-2 py-2">
                {dict.totalPacked}
              </td>
              <td className="px-2 py-2">{totalPackageQty}</td>
              <td className="px-2 py-2">{totalTon.toFixed(3)}</td>
              <td></td>
            </tr>
          )}
        </tbody>
      </table>
    </Card>
  );
}
