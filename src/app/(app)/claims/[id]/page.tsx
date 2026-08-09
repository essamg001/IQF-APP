import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { canSeePricing } from "@/lib/roles";
import { notFound } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmSubmitButton } from "@/components/ui/confirm-submit-button";
import { Input, FieldGroup } from "@/components/ui/field";
import { addClaimAttachmentAction, removeClaimAttachmentAction } from "../actions";
import { AdvanceStatusButton } from "./advance-status-button";
import { format } from "date-fns";

const STATUS_ORDER = ["OPEN", "UNDER_REVIEW", "RESOLVED_CREDITED", "CLOSED"] as const;
const STATUS_LABEL: Record<(typeof STATUS_ORDER)[number], string> = {
  OPEN: "Open",
  UNDER_REVIEW: "Under Review",
  RESOLVED_CREDITED: "Resolved / Credited",
  CLOSED: "Closed",
};

export default async function ClaimDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  const showPricing = canSeePricing(session?.user.role);

  const claim = await prisma.claim.findUnique({
    where: { id },
    include: {
      client: true,
      containers: true,
      attachments: { include: { uploadedBy: true }, orderBy: { createdAt: "desc" } },
    },
  });
  if (!claim) notFound();

  const nextStatus = STATUS_ORDER[STATUS_ORDER.indexOf(claim.status) + 1];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold text-slate-900">
              Claim {claim.claimNumber ? `#${claim.claimNumber}` : ""} — {claim.client.name}
            </h1>
            <Badge color={claim.severity === "RED" ? "red" : "amber"}>{claim.severity}</Badge>
            <Badge color="slate">{STATUS_LABEL[claim.status]}</Badge>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            {format(claim.claimDate, "dd MMM yyyy")} · {claim.reason.replace("_", " ")}
            {claim.variety ? ` · ${claim.variety}` : ""}
          </p>
        </div>
        {nextStatus && <AdvanceStatusButton claimId={claim.id} label={STATUS_LABEL[nextStatus]} />}
      </div>

      {showPricing && (
        <Card>
          <h2 className="text-sm font-semibold text-slate-900">Financial Summary</h2>
          <dl className="mt-2 grid grid-cols-4 gap-x-6 gap-y-2 text-sm">
            <Row label="Claim value" value={`$${claim.valueUsd.toLocaleString()}`} />
            <Row label="Amount requested from client" value={fmtMoney(claim.amountRequestedFromClient)} />
            <Row label="Amount after negotiation" value={fmtMoney(claim.amountAfterNegotiation)} />
            <Row label="Discount value" value={fmtMoney(claim.discountValue)} />
            <Row label="Amount requested for approval" value={fmtMoney(claim.amountRequestedForApproval)} />
            <Row label="Total shipment value" value={fmtMoney(claim.totalShipmentValue)} />
            <Row label="Discount %" value={claim.discountPct != null ? `${claim.discountPct}%` : undefined} />
          </dl>
        </Card>
      )}

      <Card className="overflow-x-auto p-0">
        <h2 className="px-4 py-3 text-sm font-semibold text-slate-900">
          Containers Complained About ({claim.containers.length})
        </h2>
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-slate-500">
            <tr>
              <th className="px-4 py-2 font-medium">Container #</th>
              <th className="px-4 py-2 font-medium">Variety</th>
              <th className="px-4 py-2 font-medium">Shipping Line</th>
              <th className="px-4 py-2 font-medium">Cartons</th>
              <th className="px-4 py-2 font-medium">Lost Cartons</th>
              {showPricing && <th className="px-4 py-2 font-medium">Claim %</th>}
              {showPricing && <th className="px-4 py-2 font-medium">Claim Amount</th>}
            </tr>
          </thead>
          <tbody>
            {claim.containers.map((line) => (
              <tr key={line.id} className="border-b border-slate-100 last:border-0">
                <td className="px-4 py-2">
                  {line.containerId ? (
                    <a href={`/logistics/${line.containerId}`} className="text-emerald-700 hover:underline">
                      {line.containerNumber}
                    </a>
                  ) : (
                    line.containerNumber
                  )}
                </td>
                <td className="px-4 py-2">{line.variety ?? "—"}</td>
                <td className="px-4 py-2">{line.shippingLine ?? "—"}</td>
                <td className="px-4 py-2">{line.cartonsPerContainer ?? "—"}</td>
                <td className="px-4 py-2">{line.lostCartons ?? "—"}</td>
                {showPricing && <td className="px-4 py-2">{line.claimPct != null ? `${line.claimPct}%` : "—"}</td>}
                {showPricing && <td className="px-4 py-2">{fmtMoney(line.claimAmount)}</td>}
              </tr>
            ))}
            {claim.containers.length === 0 && (
              <tr>
                <td colSpan={showPricing ? 7 : 5} className="px-4 py-6 text-center text-slate-400">
                  No containers listed.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>

      <div className="grid grid-cols-2 gap-4">
        <Card>
          <h2 className="text-sm font-semibold text-slate-900">Claim Details & Quality Response</h2>
          <p className="mt-2 text-sm text-slate-700">{claim.claimDetails || "—"}</p>
          <p className="mt-2 text-xs font-medium text-slate-500">Quality response</p>
          <p className="text-sm text-slate-700">{claim.qualityResponse || "—"}</p>
        </Card>

        <Card>
          <h2 className="text-sm font-semibold text-slate-900">Container Inspection</h2>
          <dl className="mt-2 space-y-2 text-sm">
            <Row label="Inspection company sent" value={claim.inspectionCompanySent ? "Yes" : "No"} />
            <Row label="Company name" value={claim.inspectionCompanyName} />
            {showPricing && <Row label="Cost" value={fmtMoney(claim.inspectionCompanyCost)} />}
            <Row label="Report" value={claim.inspectionCompanyReport} />
          </dl>
        </Card>
      </div>

      {(claim.weightMagrabiTon || claim.weightClientTon) && (
        <Card>
          <h2 className="text-sm font-semibold text-slate-900">Weight Deduction</h2>
          <dl className="mt-2 grid grid-cols-4 gap-x-6 gap-y-2 text-sm">
            <Row label="Net weight — Magrabi" value={claim.weightMagrabiTon ? `${claim.weightMagrabiTon} ton` : undefined} />
            <Row label="Net weight — client" value={claim.weightClientTon ? `${claim.weightClientTon} ton` : undefined} />
            <Row label="Weight difference" value={claim.weightDifferenceKg ? `${claim.weightDifferenceKg} kg` : undefined} />
            <Row label="Weight difference %" value={claim.weightDifferencePct != null ? `${claim.weightDifferencePct}%` : undefined} />
          </dl>
        </Card>
      )}

      <Card>
        <h2 className="text-sm font-semibold text-slate-900">Approvals</h2>
        <dl className="mt-2 grid grid-cols-3 gap-x-6 gap-y-2 text-sm">
          <Row label="Account Manager" value={claim.accountManager} />
          <Row label="IT Manager" value={claim.itManager} />
          <Row label="Export Manager" value={claim.exportManager} />
          <Row label="Export Director" value={claim.exportDirector} />
          <Row label="Commercial Director" value={claim.commercialDirector} />
          <Row label="Chairman" value={claim.chairman} />
        </dl>
        {claim.otherNotes && (
          <p className="mt-3 text-sm text-slate-700">
            <span className="font-medium text-slate-500">Notes: </span>
            {claim.otherNotes}
          </p>
        )}
      </Card>

      <Card>
        <h2 className="text-sm font-semibold text-slate-900">Evidence — Photos & Documents ({claim.attachments.length})</h2>
        <p className="mt-1 text-xs text-slate-500">
          Every file is stamped with who uploaded it and when, so the evidence trail is attributable.
        </p>

        <div className="mt-3 grid grid-cols-3 gap-3">
          {claim.attachments.map((a) => {
            const isImage = /\.(jpe?g|png)$/i.test(a.fileName);
            return (
              <div key={a.id} className="rounded-md border border-slate-200 p-2">
                <a
                  href={`/api/files/claim-attachments/${a.fileName}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block"
                >
                  {isImage ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={`/api/files/claim-attachments/${a.fileName}`}
                      alt={a.caption ?? a.originalName}
                      className="h-32 w-full rounded object-cover"
                    />
                  ) : (
                    <div className="flex h-32 w-full items-center justify-center rounded bg-slate-50 text-sm text-emerald-700 hover:underline">
                      View PDF
                    </div>
                  )}
                </a>
                {a.caption && <p className="mt-2 text-xs text-slate-700">{a.caption}</p>}
                <p className="mt-1 text-xs text-slate-400">
                  {a.uploadedBy?.name ?? "Unknown"} · {format(a.createdAt, "dd MMM yyyy HH:mm")}
                </p>
                <form action={removeClaimAttachmentAction.bind(null, claim.id, a.id)} className="mt-1">
                  <ConfirmSubmitButton confirmMessage="Remove this evidence file? This cannot be undone.">
                    Remove
                  </ConfirmSubmitButton>
                </form>
              </div>
            );
          })}
          {claim.attachments.length === 0 && (
            <p className="col-span-3 py-2 text-sm text-slate-400">No evidence uploaded yet.</p>
          )}
        </div>

        <form action={addClaimAttachmentAction.bind(null, claim.id)} className="mt-4 flex flex-wrap items-end gap-3 border-t border-slate-100 pt-4">
          <FieldGroup label="Photo or document (JPEG, PNG, or PDF)">
            <input
              name="file"
              type="file"
              accept="image/jpeg,image/png,application/pdf"
              required
              className="block w-64 text-sm text-slate-700 file:mr-3 file:rounded-md file:border file:border-slate-300 file:bg-white file:px-3 file:py-1.5 file:text-sm file:font-medium hover:file:bg-slate-50"
            />
          </FieldGroup>
          <FieldGroup label="Caption (optional)">
            <Input name="caption" className="w-56" placeholder="e.g. Mould on arrival, container 3" />
          </FieldGroup>
          <Button type="submit" variant="secondary">
            Upload
          </Button>
        </form>
      </Card>
    </div>
  );
}

function fmtMoney(value?: number | null) {
  return value != null ? `$${value.toLocaleString()}` : undefined;
}

function Row({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-slate-500">{label}</dt>
      <dd className="text-right text-slate-800">{value || "—"}</dd>
    </div>
  );
}
