import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { canManageClients } from "@/lib/roles";
import { LinkButton } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { resolveLocale } from "@/lib/i18n/resolveLocale";
import { getDictionary } from "@/lib/i18n/getDictionary";

export default async function ClientsPage() {
  const [session, clients] = await Promise.all([
    auth(),
    prisma.client.findMany({
      include: { specs: true },
      orderBy: { name: "asc" },
    }),
  ]);
  const canManage = canManageClients(session?.user.role);
  const dict = getDictionary(await resolveLocale()).clients;

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">{dict.title}</h1>
          <p className="mt-1 text-sm text-slate-500">
            {clients.length} {dict.clientCountSuffix}
          </p>
        </div>
        {canManage && <LinkButton href="/clients/new">{dict.newClient}</LinkButton>}
      </div>

      <Card className="mt-6 overflow-x-auto p-0">
        <table className="w-full text-start text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-slate-500">
            <tr>
              <th className="px-4 py-2 font-medium">{dict.colName}</th>
              <th className="px-4 py-2 font-medium">{dict.colCountry}</th>
              <th className="px-4 py-2 font-medium">{dict.colSpecs}</th>
              <th className="px-4 py-2 font-medium">{dict.colPaymentTerms}</th>
              <th className="px-4 py-2 font-medium">{dict.colIncoterms}</th>
            </tr>
          </thead>
          <tbody>
            {clients.map((c) => (
              <tr key={c.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                <td className="px-4 py-2">
                  <Link href={`/clients/${c.id}`} className="font-medium text-emerald-700 hover:underline">
                    {c.name}
                  </Link>
                </td>
                <td className="px-4 py-2 text-slate-600">{c.country ?? "—"}</td>
                <td className="px-4 py-2">
                  <div className="flex flex-wrap gap-1">
                    {c.specs.map((s) => (
                      <Badge key={s.id} color={s.grade === "A" ? "green" : "amber"}>
                        {s.specName} ({s.grade})
                      </Badge>
                    ))}
                    {c.specs.length === 0 && <span className="text-slate-400">—</span>}
                  </div>
                </td>
                <td className="px-4 py-2 text-slate-600">{c.paymentTerms ?? "—"}</td>
                <td className="px-4 py-2 text-slate-600">{c.incoterms ?? "—"}</td>
              </tr>
            ))}
            {clients.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                  {dict.noClientsYet}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
