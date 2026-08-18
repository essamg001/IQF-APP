import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input, FieldGroup } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { ConfirmSubmitButton } from "@/components/ui/confirm-submit-button";
import { canAccessLab } from "@/lib/roles";
import { parseLocalDateOnly } from "@/lib/dates";
import { toggleAuthorizationActiveAction } from "./actions";
import { AuthorizationForm } from "./authorization-form";
import { PersonalItemShiftRow } from "./check-row";
import { resolveLocale } from "@/lib/i18n/resolveLocale";
import { getDictionary } from "@/lib/i18n/getDictionary";

export default async function PersonalItemsPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const session = await auth();
  const fullDict = getDictionary(await resolveLocale());
  const dict = fullDict.personalItems;
  const ITEM_LABELS: { key: "allowsMobile" | "allowsPens" | "allowsCalculator" | "allowsOther"; label: string }[] = [
    { key: "allowsMobile", label: dict.itemMobile },
    { key: "allowsPens", label: dict.itemPens },
    { key: "allowsCalculator", label: dict.itemCalculator },
    { key: "allowsOther", label: dict.itemOther },
  ];
  const { date: dateParam } = await searchParams;
  const dateStr = dateParam ?? new Date().toISOString().slice(0, 10);
  const parsedDate = parseLocalDateOnly(dateStr) ?? new Date();

  const [factories, authorizations, checks] = await Promise.all([
    prisma.factory.findMany({ orderBy: { code: "asc" } }),
    prisma.personalItemAuthorization.findMany({ orderBy: { name: "asc" } }),
    prisma.personalItemShiftCheck.findMany({ where: { date: parsedDate } }),
  ]);

  const canManage = canAccessLab(session?.user?.role);
  const activeAuthorizations = authorizations.filter((a) => a.isActive);

  const checkFor = (authorizationId: string, factoryId: string, shiftType: "DAY" | "NIGHT") =>
    checks.find((c) => c.authorizationId === authorizationId && c.factoryId === factoryId && c.shiftType === shiftType) ??
    null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">{dict.title}</h1>
        <p className="mt-1 text-sm text-slate-500">{dict.subtitle}</p>
      </div>

      <Card>
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900">{dict.authorizedPersonnel}</h2>
          {!canManage && <span className="text-xs text-slate-400">{dict.onlyQualityCanEdit}</span>}
        </div>
        <ul className="mt-3 divide-y divide-slate-100">
          {authorizations.map((a) => (
            <li key={a.id} className="flex items-center justify-between py-2 text-sm">
              <span>
                <span className={a.isActive ? "text-slate-900" : "text-slate-400 line-through"}>{a.name}</span>
                {a.job && <span className="text-slate-400"> — {a.job}</span>}
                {a.location && <span className="text-slate-400"> · {a.location}</span>}
                <span className="ms-2 inline-flex gap-1">
                  {ITEM_LABELS.filter((i) => a[i.key]).map((i) => (
                    <Badge key={i.key} color="slate">
                      {i.label}
                    </Badge>
                  ))}
                </span>
              </span>
              {canManage && (
                <form action={toggleAuthorizationActiveAction.bind(null, a.id)}>
                  <ConfirmSubmitButton
                    confirmMessage={(a.isActive ? dict.revokeConfirm : dict.reinstateConfirm).replace("{name}", a.name)}
                    className="text-xs text-slate-400 hover:text-slate-600 hover:underline"
                  >
                    {a.isActive ? dict.revoke : dict.reinstate}
                  </ConfirmSubmitButton>
                </form>
              )}
            </li>
          ))}
          {authorizations.length === 0 && <li className="py-2 text-sm text-slate-400">{dict.noOneAuthorized}</li>}
        </ul>
        {canManage && <AuthorizationForm />}
      </Card>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-slate-900">{dict.shiftCheckTitle}</h2>
          <form className="flex items-end gap-2">
            <FieldGroup label={fullDict.common.date}>
              <Input name="date" type="date" defaultValue={dateStr} />
            </FieldGroup>
            <Button type="submit" variant="secondary">
              {dict.go}
            </Button>
          </form>
        </div>

        {activeAuthorizations.length === 0 && <p className="mt-3 text-sm text-slate-400">{dict.noAuthorizedToCheckIn}</p>}

        {activeAuthorizations.length > 0 &&
          factories.map((factory) =>
            (["DAY", "NIGHT"] as const).map((shiftType) => (
              <div key={`${factory.id}-${shiftType}`} className="mt-4">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {factory.name} — {shiftType === "DAY" ? dict.shiftDay : dict.shiftNight}
                </h3>
                <table className="mt-2 w-full text-start text-sm">
                  <thead className="border-b border-slate-200 text-slate-500">
                    <tr>
                      <th className="px-4 py-2 font-medium">{dict.colName}</th>
                      <th className="px-4 py-2 font-medium">{dict.colCheckIn}</th>
                      <th className="px-4 py-2 font-medium">{dict.colCheckOut}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeAuthorizations.map((a) => (
                      <PersonalItemShiftRow
                        key={a.id}
                        authorization={a}
                        check={checkFor(a.id, factory.id, shiftType)}
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
