import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { LinkButton, Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { deleteClientAction } from "../actions";
import { DEFECT_FIELDS } from "@/lib/validation/client";

const FORMAT_LABEL = { WHOLE: "Whole", SLICED: "Sliced", DICED: "Diced" } as const;

export default async function ClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const client = await prisma.client.findUnique({
    where: { id },
    include: { specs: true },
  });

  if (!client) notFound();

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">{client.name}</h1>
          <p className="mt-1 text-sm text-slate-500">{client.country ?? "No country on file"}</p>
        </div>
        <div className="flex gap-2">
          <LinkButton href={`/clients/${client.id}/edit`} variant="secondary">
            Edit
          </LinkButton>
          <form action={deleteClientAction.bind(null, client.id)}>
            <Button type="submit" variant="danger">
              Delete
            </Button>
          </form>
        </div>
      </div>

      <div className="mt-6">
        <Card>
          <h2 className="text-sm font-semibold text-slate-900">Contact & Terms</h2>
          <dl className="mt-3 grid grid-cols-3 gap-x-6 gap-y-2 text-sm">
            <Row label="Contact" value={client.contactName} />
            <Row label="Email" value={client.contactEmail} />
            <Row label="Phone" value={client.contactPhone} />
            <Row label="Payment terms" value={client.paymentTerms} />
            <Row label="Incoterms" value={client.incoterms} />
            <Row label="Currency" value={client.currency} />
          </dl>
        </Card>
      </div>

      <div className="mt-6 space-y-4">
        <h2 className="text-sm font-semibold text-slate-900">Specifications ({client.specs.length})</h2>
        {client.specs.length === 0 && (
          <Card>
            <p className="text-sm text-slate-400">No specs on file.</p>
          </Card>
        )}
        {client.specs.map((s) => {
          const defects = DEFECT_FIELDS.map((f) => ({ label: f.label, value: s[f.key] })).filter(
            (d) => d.value && d.value !== "*"
          );
          return (
            <Card key={s.id}>
              <div className="flex items-center gap-2">
                <Badge color={s.grade === "A" ? "green" : "amber"}>Grade {s.grade}</Badge>
                <span className="text-sm font-medium text-slate-800">{s.specName}</span>
                <Badge color="slate">{FORMAT_LABEL[s.format]}</Badge>
              </div>
              <dl className="mt-3 grid grid-cols-4 gap-x-6 gap-y-2 text-sm">
                <Row label="Brix" value={s.brix} />
                <Row label="pH" value={s.ph} />
                <Row label="Size/Caliber" value={s.sizeCaliber} />
              </dl>
              {defects.length > 0 && (
                <div className="mt-3">
                  <p className="text-xs font-medium text-slate-500">Defect tolerances</p>
                  <dl className="mt-1 grid grid-cols-4 gap-x-6 gap-y-1 text-sm">
                    {defects.map((d) => (
                      <Row key={d.label} label={d.label} value={d.value} />
                    ))}
                  </dl>
                </div>
              )}
              {s.notes && (
                <p className="mt-3 text-sm text-slate-600">
                  <span className="font-medium text-slate-500">Notes: </span>
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
      <dd className="text-right text-slate-800">{value || "—"}</dd>
    </div>
  );
}
