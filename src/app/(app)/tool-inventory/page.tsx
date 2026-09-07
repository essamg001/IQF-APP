import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { Input, FieldGroup } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { ConfirmSubmitButton } from "@/components/ui/confirm-submit-button";
import { parseLocalDateOnly } from "@/lib/dates";
import { toggleToolInventoryItemActiveAction } from "./actions";
import { ItemForm } from "./item-form";
import { ToolShiftRow } from "./check-row";
import { resolveLocale } from "@/lib/i18n/resolveLocale";
import { getDictionary } from "@/lib/i18n/getDictionary";
import { PrintButton } from "@/components/ui/print-button";

export default async function ToolInventoryPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const fullDict = getDictionary(await resolveLocale());
  const dict = fullDict.toolInventory;
  const { date: dateParam } = await searchParams;
  const dateStr = dateParam ?? new Date().toISOString().slice(0, 10);
  const parsedDate = parseLocalDateOnly(dateStr) ?? new Date();

  const [factories, items, checks] = await Promise.all([
    prisma.factory.findMany({ orderBy: { code: "asc" } }),
    prisma.toolInventoryItem.findMany({ orderBy: { name: "asc" } }),
    prisma.toolInventoryShiftCheck.findMany({ where: { date: parsedDate } }),
  ]);

  const activeItems = items.filter((i) => i.isActive);

  const checkFor = (toolId: string, factoryId: string, shiftType: "DAY" | "NIGHT") =>
    checks.find((c) => c.toolId === toolId && c.factoryId === factoryId && c.shiftType === shiftType) ?? null;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">{dict.title}</h1>
          <p className="mt-1 text-sm text-slate-500">{dict.subtitle}</p>
        </div>
        <PrintButton />
      </div>

      <Card>
        <h2 className="text-sm font-semibold text-slate-900">{dict.registeredTools}</h2>
        <div className="no-print">
          <ItemForm />
        </div>
        <ul className="mt-4 divide-y divide-slate-100 border-t border-slate-100 pt-1">
          {items.map((i) => (
            <li key={i.id} className="flex items-center justify-between py-2 text-sm">
              <span>
                <span className={i.isActive ? "text-slate-900" : "text-slate-400 line-through"}>{i.name}</span>
                <span className="text-slate-400"> × {i.count}</span>
                {i.location && <span className="text-slate-400"> · {i.location}</span>}
              </span>
              <form action={toggleToolInventoryItemActiveAction.bind(null, i.id)} className="no-print">
                <ConfirmSubmitButton
                  confirmMessage={(i.isActive ? dict.retireConfirm : dict.reinstateConfirm).replace("{name}", i.name)}
                  className="text-xs text-slate-400 hover:text-slate-600 hover:underline"
                >
                  {i.isActive ? dict.retire : dict.reinstate}
                </ConfirmSubmitButton>
              </form>
            </li>
          ))}
          {items.length === 0 && <li className="py-2 text-sm text-slate-400">{dict.noToolsYet}</li>}
        </ul>
      </Card>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-slate-900">{dict.shiftCheckTitle}</h2>
          <form className="no-print flex items-end gap-2">
            <FieldGroup label={fullDict.common.date}>
              <Input name="date" type="date" defaultValue={dateStr} />
            </FieldGroup>
            <Button type="submit" variant="secondary">
              {fullDict.common.go}
            </Button>
          </form>
        </div>

        {activeItems.length === 0 && <p className="mt-3 text-sm text-slate-400">{dict.noToolsToCheck}</p>}

        {activeItems.length > 0 &&
          factories.map((factory) =>
            (["DAY", "NIGHT"] as const).map((shiftType) => (
              <div key={`${factory.id}-${shiftType}`} className="mt-4">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {factory.name} — {shiftType === "DAY" ? fullDict.personalItems.shiftDay : fullDict.personalItems.shiftNight}
                </h3>
                <table className="mt-2 w-full text-start text-sm">
                  <thead className="border-b border-slate-200 text-slate-500">
                    <tr>
                      <th className="px-4 py-2 font-medium">{dict.colTool}</th>
                      <th className="px-4 py-2 font-medium">{dict.colStartOfShift}</th>
                      <th className="px-4 py-2 font-medium">{dict.colEndOfShift}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeItems.map((i) => (
                      <ToolShiftRow
                        key={i.id}
                        item={i}
                        check={checkFor(i.id, factory.id, shiftType)}
                        factoryId={factory.id}
                        date={dateStr}
                        shiftType={shiftType}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            ))
          )}
      </Card>
    </div>
  );
}
