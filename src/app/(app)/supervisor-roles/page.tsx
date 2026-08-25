import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { formatDate } from "@/lib/dates";
import { resolveLocale } from "@/lib/i18n/resolveLocale";
import { getDictionary } from "@/lib/i18n/getDictionary";
import { AckForm } from "./ack-form";
import type { SupervisorProtocolRole } from "@prisma/client";

// Ordered to match the product's own physical journey through the factory
// (same reasoning as the sidebar's "Field to Freezer to Truck" section),
// then the overarching/managerial roles last.
const ROLES: SupervisorProtocolRole[] = [
  "RECEIVING",
  "RAW_MATERIAL_FEED",
  "LINE_SORTING",
  "PACKING",
  "COLD_STORAGE_LOADING",
  "OPERATIONS_MANAGER",
  "FACTORY_MANAGER",
  "HEALTH_AND_SAFETY",
  "GENERAL_ALL_SUPERVISORS",
];

const ROLE_DICT_KEY: Record<SupervisorProtocolRole, string> = {
  COLD_STORAGE_LOADING: "coldStorageLoading",
  RAW_MATERIAL_FEED: "rawMaterialFeed",
  GENERAL_ALL_SUPERVISORS: "generalAllSupervisors",
  OPERATIONS_MANAGER: "operationsManager",
  LINE_SORTING: "lineSorting",
  HEALTH_AND_SAFETY: "healthAndSafety",
  FACTORY_MANAGER: "factoryManager",
  RECEIVING: "receiving",
  PACKING: "packing",
};

export default async function SupervisorRolesPage({
  searchParams,
}: {
  searchParams: Promise<{ role?: string }>;
}) {
  const locale = await resolveLocale();
  const dict = getDictionary(locale).supervisorRoles;
  const { role: roleParam } = await searchParams;
  const role: SupervisorProtocolRole = ROLES.includes(roleParam as SupervisorProtocolRole)
    ? (roleParam as SupervisorProtocolRole)
    : ROLES[0];

  const protocol = dict.protocols[ROLE_DICT_KEY[role] as keyof typeof dict.protocols];

  const [acknowledgments, allForOptions] = await Promise.all([
    prisma.protocolAcknowledgment.findMany({
      where: { role },
      include: { recordedByUser: true },
      orderBy: { acknowledgedDate: "desc" },
      take: 200,
    }),
    prisma.protocolAcknowledgment.findMany({
      select: { attendeeName: true, jobTitle: true },
      take: 1000,
    }),
  ]);

  const knownNames = [...new Set(allForOptions.map((a) => a.attendeeName))].sort();
  const knownJobTitles = [...new Set(allForOptions.map((a) => a.jobTitle).filter((v): v is string => !!v))].sort();

  return (
    <div>
      <div>
        <h1 className="text-xl font-semibold text-slate-900">{dict.title}</h1>
        <p className="mt-1 text-sm text-slate-500">{dict.subtitle}</p>
      </div>

      <div className="mt-6 flex flex-wrap gap-1 border-b border-slate-200">
        {ROLES.map((r) => (
          <Link
            key={r}
            href={`/supervisor-roles?role=${r}`}
            className={`rounded-t-md px-3 py-2 text-xs font-medium ${
              r === role
                ? "border border-b-0 border-slate-200 bg-white text-emerald-700"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            {dict.roleLabels[ROLE_DICT_KEY[r] as keyof typeof dict.roleLabels]}
          </Link>
        ))}
      </div>

      <div className="space-y-4 rounded-tl-none border border-t-0 border-slate-200 bg-slate-50/40 p-4">
        <Card>
          <h2 className="text-sm font-semibold text-slate-900">{protocol.title}</h2>
          <ul className="mt-3 space-y-2 text-sm text-slate-700">
            {protocol.items.map((item, i) => {
              const isSectionHeader = item.length < 60 && !item.endsWith(".") && !item.endsWith(":");
              return (
                <li key={i} className={isSectionHeader ? "pt-2 font-semibold text-slate-900" : "ps-3"}>
                  {item}
                </li>
              );
            })}
          </ul>
        </Card>

        <Card>
          <h2 className="text-sm font-semibold text-slate-900">{dict.ackSectionTitle}</h2>
          <div className="mt-3">
            <AckForm role={role} knownNames={knownNames} knownJobTitles={knownJobTitles} />
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-start text-sm">
              <thead className="border-b border-slate-200 text-slate-500">
                <tr>
                  <th className="px-2 py-1 font-medium">{dict.colName}</th>
                  <th className="px-2 py-1 font-medium">{dict.colJobTitle}</th>
                  <th className="px-2 py-1 font-medium">{dict.colDate}</th>
                  <th className="px-2 py-1 font-medium">{dict.colRecordedBy}</th>
                </tr>
              </thead>
              <tbody>
                {acknowledgments.map((a) => (
                  <tr key={a.id} className="border-b border-slate-100 last:border-0">
                    <td className="px-2 py-1.5 font-medium text-slate-800">{a.attendeeName}</td>
                    <td className="px-2 py-1.5">{a.jobTitle ?? "—"}</td>
                    <td className="px-2 py-1.5">{formatDate(a.acknowledgedDate, "dd MMM yyyy", locale)}</td>
                    <td className="px-2 py-1.5">{a.recordedByUser?.name ?? "—"}</td>
                  </tr>
                ))}
                {acknowledgments.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-2 py-4 text-center text-slate-400">
                      {dict.noAcknowledgments}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}
