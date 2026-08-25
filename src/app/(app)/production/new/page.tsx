import { prisma } from "@/lib/prisma";
import { LotForm } from "./lot-form";
import { Card } from "@/components/ui/card";
import { Input, Select, FieldGroup } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { parseLocalDateOnly } from "@/lib/dates";
import { resolveLocale } from "@/lib/i18n/resolveLocale";
import { getDictionary } from "@/lib/i18n/getDictionary";

export default async function NewLotPage({
  searchParams,
}: {
  searchParams: Promise<{ factoryId?: string; date?: string; shiftType?: string }>;
}) {
  const fullDict = getDictionary(await resolveLocale());
  const dict = fullDict.production;
  const { factoryId: factoryIdParam, date: dateParam, shiftType: shiftTypeParam } = await searchParams;

  const factories = await prisma.factory.findMany({ orderBy: { name: "asc" } });
  const factoryId = factoryIdParam ?? factories[0]?.id ?? "";
  const dateStr = dateParam ?? new Date().toISOString().slice(0, 10);
  const shiftType = shiftTypeParam === "NIGHT" ? "NIGHT" : "DAY";
  const date = parseLocalDateOnly(dateStr) ?? new Date();
  const factory = factories.find((f) => f.id === factoryId);

  const fields = await prisma.field.findMany({ orderBy: { name: "asc" } });

  // Fields with an accepted Post-Decap Quality check tied to this exact
  // date+shift -- the authoritative "who supplied this shift" answer.
  // Matched by decap shift (date+shiftType only, not factory), since decap
  // is one shared facility feeding both IQF factories at once -- the same
  // fields supply both factories' lots for the same shift.
  const suggestedChecks = await prisma.qualityCheck.findMany({
    where: {
      checkpoint: "POST_DECAP",
      decision: "ACCEPTED",
      decapShift: { date, shiftType },
      fieldId: { not: null },
    },
    include: { field: true },
    distinct: ["fieldId"],
  });
  const suggestedFieldNames = [...new Set(suggestedChecks.map((c) => c.field!.name))].sort();

  // Only prefill the farm code when every suggested field agrees on the same
  // non-null one -- if any field has no code on file, or two disagree, leave
  // it for the person logging the lot to enter rather than guess.
  const suggestedFieldFarmCodes = suggestedChecks.map((c) => c.field!.farmCode);
  const suggestedFarmCode =
    suggestedFieldFarmCodes.length > 0 &&
    suggestedFieldFarmCodes[0] &&
    suggestedFieldFarmCodes.every((code) => code === suggestedFieldFarmCodes[0])
      ? suggestedFieldFarmCodes[0]
      : null;

  return (
    <div>
      <h1 className="text-xl font-semibold text-slate-900">{dict.logProductionLot}</h1>

      <Card className="mt-6 max-w-xl">
        <form className="flex flex-wrap items-end gap-3">
          <FieldGroup label={fullDict.common.factory}>
            <Select name="factoryId" defaultValue={factoryId}>
              {factories.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </Select>
          </FieldGroup>
          <FieldGroup label={fullDict.common.date}>
            <Input name="date" type="date" defaultValue={dateStr} />
          </FieldGroup>
          <FieldGroup label={dict.shiftLabel}>
            <Select name="shiftType" defaultValue={shiftType}>
              <option value="DAY">{dict.shiftDay}</option>
              <option value="NIGHT">{dict.shiftNight}</option>
            </Select>
          </FieldGroup>
          <Button type="submit" variant="secondary">
            {fullDict.common.go}
          </Button>
        </form>
      </Card>

      <div className="mt-6 max-w-xl">
        <LotForm
          factoryId={factoryId}
          factoryCode={factory?.code ?? null}
          date={dateStr}
          shiftType={shiftType}
          fields={fields}
          suggestedFieldNames={suggestedFieldNames}
          suggestedFarmCode={suggestedFarmCode}
        />
      </div>
    </div>
  );
}
