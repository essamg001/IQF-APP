import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { Input, Select, FieldGroup } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { parseLocalDateOnly } from "@/lib/dates";
import { EquipmentSection } from "./equipment-section";
import { IssueSection } from "./issue-section";
import { IncidentSection } from "./incident-section";
import { resolveLocale } from "@/lib/i18n/resolveLocale";
import { getDictionary } from "@/lib/i18n/getDictionary";

export default async function BladeControlPage({
  searchParams,
}: {
  searchParams: Promise<{ factoryId?: string; date?: string; shiftType?: string }>;
}) {
  const fullDict = getDictionary(await resolveLocale());
  const dict = fullDict.bladeControl;
  const { factoryId: factoryIdParam, date: dateParam, shiftType: shiftTypeParam } = await searchParams;

  const factories = await prisma.factory.findMany({ orderBy: { code: "asc" } });
  const factoryId = factoryIdParam ?? factories[0]?.id ?? "";
  const dateStr = dateParam ?? new Date().toISOString().slice(0, 10);
  const shiftType = shiftTypeParam === "NIGHT" ? "NIGHT" : "DAY";
  const date = parseLocalDateOnly(dateStr) ?? new Date();
  const dayStart = date;
  const dayEnd = new Date(date.getTime() + 24 * 60 * 60 * 1000);

  const [equipmentChecks, issueRecords, incidents] = await Promise.all([
    factoryId
      ? prisma.bladeEquipmentCheck.findMany({
          where: { factoryId, date, shiftType },
          include: { washEvents: { orderBy: { recordedAt: "asc" } } },
          orderBy: { createdAt: "asc" },
        })
      : [],
    factoryId
      ? prisma.bladeIssueRecord.findMany({
          where: { factoryId, date, shiftType },
          orderBy: { issuedAt: "asc" },
        })
      : [],
    factoryId
      ? prisma.bladeIncidentReport.findMany({
          where: { factoryId, date: { gte: dayStart, lt: dayEnd } },
          orderBy: { reportedAt: "asc" },
        })
      : [],
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">{dict.title}</h1>
        <p className="mt-1 text-sm text-slate-500">{dict.subtitle}</p>
      </div>

      <Card>
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

      <Card>
        <EquipmentSection
          factoryId={factoryId}
          date={dateStr}
          shiftType={shiftType}
          equipmentChecks={equipmentChecks}
        />
      </Card>

      <Card>
        <IssueSection factoryId={factoryId} date={dateStr} shiftType={shiftType} records={issueRecords} />
      </Card>

      <Card>
        <IncidentSection factoryId={factoryId} date={dateStr} incidents={incidents} />
      </Card>
    </div>
  );
}
