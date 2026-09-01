import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ConfirmSubmitButton } from "@/components/ui/confirm-submit-button";
import { trainingExpiryStatus, trainingExpiryColor } from "@/lib/training";
import { formatDate } from "@/lib/dates";
import { resolveLocale } from "@/lib/i18n/resolveLocale";
import { getDictionary } from "@/lib/i18n/getDictionary";
import { CertificationForm } from "./certification-form";
import { deleteCertificationAction } from "./actions";

export default async function CertificationsPage() {
  const session = await auth();
  if (!session?.user || !["OWNER", "QUALITY"].includes(session.user.role)) {
    redirect("/");
  }

  const locale = await resolveLocale();
  const fullDict = getDictionary(locale);
  const dict = fullDict.certifications;

  const STATUS_LABEL: Record<string, string> = {
    NONE: "—",
    OK: dict.statusValid,
    EXPIRING_SOON: dict.statusExpiringSoon,
    EXPIRED: dict.statusExpired,
  };

  const now = new Date();
  const certifications = await prisma.certification.findMany({ orderBy: { validTo: "asc" } });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">{dict.title}</h1>
        <p className="mt-1 text-sm text-slate-500">{dict.subtitle}</p>
      </div>

      <Card>
        <CertificationForm />
      </Card>

      <Card className="overflow-x-auto p-0">
        <table className="w-full text-start text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-slate-500">
            <tr>
              <th className="px-4 py-2 font-medium">{dict.colName}</th>
              <th className="px-4 py-2 font-medium">{dict.colCertNumber}</th>
              <th className="px-4 py-2 font-medium">{dict.colValidTo}</th>
              <th className="px-4 py-2 font-medium">{dict.colStatus}</th>
              <th className="px-4 py-2 font-medium">{dict.colNotes}</th>
              <th className="px-4 py-2 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {certifications.map((c) => {
              const status = trainingExpiryStatus(c.validTo, now);
              return (
                <tr key={c.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                  <td className="px-4 py-2 font-medium text-slate-900">{c.name}</td>
                  <td className="px-4 py-2 text-slate-500">{c.certNumber ?? "—"}</td>
                  <td className="px-4 py-2">{formatDate(c.validTo, "dd MMM yyyy", locale)}</td>
                  <td className="px-4 py-2">
                    <Badge color={trainingExpiryColor(status)}>{STATUS_LABEL[status]}</Badge>
                  </td>
                  <td className="px-4 py-2 text-slate-500">{c.notes ?? "—"}</td>
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-3">
                      <Link href={`/certifications/${c.id}/edit`} className="text-xs text-emerald-700 hover:underline">
                        {fullDict.common.edit}
                      </Link>
                      <form action={deleteCertificationAction.bind(null, c.id)}>
                        <ConfirmSubmitButton confirmMessage={dict.removeCertConfirm.replace("{name}", c.name)}>
                          {fullDict.common.remove}
                        </ConfirmSubmitButton>
                      </form>
                    </div>
                  </td>
                </tr>
              );
            })}
            {certifications.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                  {dict.noCertifications}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
