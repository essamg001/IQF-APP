import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { notFound } from "next/navigation";
import { LinkButton } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ConfirmSubmitButton } from "@/components/ui/confirm-submit-button";
import { deleteClientAction } from "../actions";
import { DEFECT_FIELDS } from "@/lib/validation/client";
import { canManageClients } from "@/lib/roles";
import { AddSpecForm } from "./add-spec-form";
import { CfuTierBadge } from "@/components/cfu-tier-badge";
import { TestDataBadge, TEST_DATA_TEXT_CLASS } from "@/components/test-data-badge";
import { cn } from "@/lib/cn";
import { resolveLocale } from "@/lib/i18n/resolveLocale";
import { getDictionary } from "@/lib/i18n/getDictionary";
import type { Dictionary } from "@/lib/i18n/dictionaries/en";

function formatLabel(dict: Dictionary["clients"], format: "WHOLE" | "SLICED" | "DICED") {
  return { WHOLE: dict.formatWhole, SLICED: dict.formatSliced, DICED: dict.formatDiced }[format];
}

export default async function ClientDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;
  const [session, client] = await Promise.all([
    auth(),
    prisma.client.findUnique({
      where: { id },
      include: { specs: true },
    }),
  ]);

  if (!client) notFound();

  const canManage = canManageClients(session?.user.role);
  const isOwner = session?.user.role === "OWNER";
  const dict = getDictionary(await resolveLocale()).clients;

  return (
    <div>
      {error === "in-use" && (
        <p className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {dict.cantDeleteInUse}
        </p>
      )}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">{client.name}</h1>
          <p className="mt-1 text-sm text-slate-500">{client.country ?? dict.noCountryOnFile}</p>
        </div>
        <div className="flex gap-2">
          {canManage && (
            <LinkButton href={`/clients/${client.id}/edit`} variant="secondary">
              {dict.edit}
            </LinkButton>
          )}
          {isOwner && (
            <form action={deleteClientAction.bind(null, client.id)}>
              <ConfirmSubmitButton
                confirmMessage={dict.deleteConfirm.replace("{name}", client.name).replace("{count}", String(client.specs.length))}
                className="inline-flex items-center justify-center gap-2 rounded-md bg-red-600 px-3.5 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700"
              >
                {dict.delete}
              </ConfirmSubmitButton>
            </form>
          )}
        </div>
      </div>

      <div className="mt-6">
        <Card>
          <h2 className="text-sm font-semibold text-slate-900">{dict.contactTermsTitle}</h2>
          <dl className="mt-3 grid grid-cols-3 gap-x-6 gap-y-2 text-sm">
            <Row label={dict.contactLabel} value={client.contactName} />
            <Row label={dict.emailLabel} value={client.contactEmail} />
            <Row label={dict.phoneLabel} value={client.contactPhone} />
            <Row label={dict.paymentTermsLabel} value={client.paymentTerms} />
            <Row label={dict.incotermsLabel} value={client.incoterms} />
            <Row label={dict.currencyLabel} value={client.currency} />
          </dl>
        </Card>
      </div>

      <div className="mt-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900">
            {dict.specificationsTitle.replace("{count}", String(client.specs.length))}
          </h2>
        </div>
        {canManage && (
          <Card>
            <details>
              <summary className="cursor-pointer text-sm font-medium text-slate-800">{dict.addSpecSummary}</summary>
              <div className="mt-4">
                <AddSpecForm clientId={client.id} />
              </div>
            </details>
          </Card>
        )}
        {client.specs.length === 0 && (
          <Card>
            <p className="text-sm text-slate-400">{dict.noSpecsOnFile}</p>
          </Card>
        )}
        {client.specs.map((s) => {
          const defects = DEFECT_FIELDS.map((f) => ({ label: f.label, value: s[f.key] })).filter(
            (d) => d.value && d.value !== "*"
          );
          return (
            <Card key={s.id}>
              <div className="flex items-center gap-2">
                <Badge color={s.grade === "A" ? "green" : "amber"}>{dict.gradeLabel.replace("{grade}", s.grade)}</Badge>
                <span className={cn("text-sm font-medium text-slate-800", s.isTestData && TEST_DATA_TEXT_CLASS)}>
                  {s.specName}
                </span>
                <Badge color="slate">{formatLabel(dict, s.format)}</Badge>
                {s.isTestData && <TestDataBadge />}
              </div>
              <dl className="mt-3 grid grid-cols-4 gap-x-6 gap-y-2 text-sm">
                <Row label={dict.brixLabel} value={s.brix} />
                <Row label={dict.phLabel} value={s.ph} />
                <Row label={dict.sizeCaliberLabel} value={s.sizeCaliber} />
                <div className="flex justify-between gap-4">
                  <dt className="text-slate-500">{dict.maxTotalPlateCount}</dt>
                  <dd className="text-end">
                    <CfuTierBadge cfuValue={s.maxCfuPerGram ?? null} />
                  </dd>
                </div>
              </dl>
              {defects.length > 0 && (
                <div className="mt-3">
                  <p className="text-xs font-medium text-slate-500">{dict.defectTolerancesLabel}</p>
                  <dl className="mt-1 grid grid-cols-4 gap-x-6 gap-y-1 text-sm">
                    {defects.map((d) => (
                      <Row key={d.label} label={d.label} value={d.value} />
                    ))}
                  </dl>
                </div>
              )}
              {s.notes && (
                <p className="mt-3 text-sm text-slate-600">
                  <span className="font-medium text-slate-500">{dict.notesLabel} </span>
                  {s.notes}
                </p>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-slate-500">{label}</dt>
      <dd className="text-end text-slate-800">{value || "—"}</dd>
    </div>
  );
}
