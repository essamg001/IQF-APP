import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, FieldGroup } from "@/components/ui/field";
import { ConfirmSubmitButton } from "@/components/ui/confirm-submit-button";
import { formatDate } from "@/lib/dates";
import { resolveLocale } from "@/lib/i18n/resolveLocale";
import { getDictionary } from "@/lib/i18n/getDictionary";
import { canAccessVisits } from "@/lib/roles";
import { FindingForm } from "../finding-form";
import {
  addFindingPhotoAction,
  removeFindingPhotoAction,
  raiseFindingAsNonConformanceAction,
} from "../actions";

export default async function VisitDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!canAccessVisits(session?.user)) {
    redirect("/");
  }

  const { id } = await params;
  const locale = await resolveLocale();
  const fullDict = getDictionary(locale);
  const dict = fullDict.visits;

  const visit = await prisma.factoryVisit.findUnique({
    where: { id },
    include: {
      factory: true,
      findings: {
        include: { photos: { include: { uploadedBy: true } } },
        orderBy: [{ category: "asc" }, { createdAt: "asc" }],
      },
    },
  });
  if (!visit) notFound();

  const strengths = visit.findings.filter((f) => f.category === "STRENGTH");
  const issues = visit.findings.filter((f) => f.category === "ISSUE");

  const SEVERITY_COLOR = { MINOR: "slate", MAJOR: "amber", CRITICAL: "red" } as const;
  const SEVERITY_LABEL: Record<string, string> = {
    MINOR: dict.severityMinor,
    MAJOR: dict.severityMajor,
    CRITICAL: dict.severityCritical,
  };

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-semibold text-slate-900">{visit.visitorNames.join(", ")}</h1>
          {visit.isAudit && <Badge color="blue">{dict.auditBadge}</Badge>}
        </div>
        <p className="mt-1 text-sm text-slate-500">
          {visit.organization ? `${visit.organization} · ` : ""}
          {visit.factory.name} · {formatDate(visit.date, "dd MMM yyyy", locale)} · {visit.purpose}
        </p>
      </div>

      {visit.isAudit && (
        <Card>
          <h2 className="text-sm font-semibold text-slate-900">{dict.addFindingTitle}</h2>
          <FindingForm visitId={visit.id} />
        </Card>
      )}

      {visit.generalFeedback && (
        <Card>
          <h2 className="text-sm font-semibold text-slate-900">{dict.generalFeedbackLabel}</h2>
          <p className="mt-1 text-sm text-slate-700">{visit.generalFeedback}</p>
        </Card>
      )}

      {visit.isAudit && (
        <>
          <Card>
            <h2 className="text-sm font-semibold text-slate-900">{dict.strengthsTitle}</h2>
            {strengths.length === 0 && <p className="mt-2 text-sm text-slate-400">{dict.noStrengthsYet}</p>}
            <ul className="mt-2 space-y-3">
              {strengths.map((f) => (
                <FindingItem key={f.id} finding={f} visitId={visit.id} dict={dict} />
              ))}
            </ul>
          </Card>

          <Card>
            <h2 className="text-sm font-semibold text-slate-900">{dict.issuesTitle}</h2>
            {issues.length === 0 && <p className="mt-2 text-sm text-slate-400">{dict.noIssuesYet}</p>}
            <ul className="mt-2 space-y-3">
              {issues.map((f) => (
                <FindingItem
                  key={f.id}
                  finding={f}
                  visitId={visit.id}
                  dict={dict}
                  severityColor={SEVERITY_COLOR}
                  severityLabel={SEVERITY_LABEL}
                />
              ))}
            </ul>
          </Card>
        </>
      )}
    </div>
  );
}

function FindingItem({
  finding,
  visitId,
  dict,
  severityColor,
  severityLabel,
}: {
  finding: {
    id: string;
    area: string | null;
    description: string;
    severity: "MINOR" | "MAJOR" | "CRITICAL" | null;
    linkedNonConformanceReportId: string | null;
    photos: { id: string; fileName: string; originalName: string; caption: string | null; createdAt: Date; uploadedBy: { name: string | null } | null }[];
  };
  visitId: string;
  dict: ReturnType<typeof getDictionary>["visits"];
  severityColor?: Record<string, "slate" | "amber" | "red">;
  severityLabel?: Record<string, string>;
}) {
  const isImage = (fileName: string) => /\.(jpe?g|png)$/i.test(fileName);
  return (
    <li className="rounded-md border border-slate-200 p-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          {finding.area && <p className="text-xs font-medium text-slate-500">{finding.area}</p>}
          <p className="text-sm text-slate-800">{finding.description}</p>
        </div>
        {finding.severity && severityColor && severityLabel && (
          <Badge color={severityColor[finding.severity]}>{severityLabel[finding.severity]}</Badge>
        )}
      </div>

      {finding.photos.length > 0 && (
        <div className="mt-2 grid grid-cols-4 gap-2">
          {finding.photos.map((p) => (
            <div key={p.id}>
              <a href={`/api/files/audit-finding-photos/${p.fileName}`} target="_blank" rel="noopener noreferrer">
                {isImage(p.fileName) ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={`/api/files/audit-finding-photos/${p.fileName}`} alt={p.caption ?? p.originalName} className="h-20 w-full rounded object-cover" />
                ) : (
                  <div className="flex h-20 w-full items-center justify-center rounded bg-slate-50 text-xs text-emerald-700">PDF</div>
                )}
              </a>
              <form action={removeFindingPhotoAction.bind(null, visitId, p.id)}>
                <ConfirmSubmitButton confirmMessage={dict.removePhotoConfirm} className="text-xs text-red-600 hover:underline">
                  {dict.removePhoto}
                </ConfirmSubmitButton>
              </form>
            </div>
          ))}
        </div>
      )}

      <form action={addFindingPhotoAction.bind(null, visitId, finding.id)} className="mt-2 flex items-end gap-2">
        <input
          name="file"
          type="file"
          accept="image/jpeg,image/png,application/pdf"
          required
          className="block w-48 text-xs text-slate-700 file:me-2 file:rounded-md file:border file:border-slate-300 file:bg-white file:px-2 file:py-1 file:text-xs"
        />
        <Button type="submit" variant="secondary" className="px-2 py-1 text-xs">
          {dict.uploadPhoto}
        </Button>
      </form>

      {finding.severity && (
        <div className="mt-2">
          {finding.linkedNonConformanceReportId ? (
            <Link href={`/non-conformance/${finding.linkedNonConformanceReportId}`} className="text-xs text-emerald-700 hover:underline">
              {dict.viewLinkedNc}
            </Link>
          ) : (
            <form action={raiseFindingAsNonConformanceAction.bind(null, visitId, finding.id)}>
              <ConfirmSubmitButton confirmMessage={dict.raiseAsNcConfirm} className="text-xs text-amber-700 hover:underline">
                {dict.raiseAsNc}
              </ConfirmSubmitButton>
            </form>
          )}
        </div>
      )}
    </li>
  );
}
