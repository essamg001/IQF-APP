import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input, Select, FieldGroup } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { markSentToLabAction, updateLabResultAction } from "./actions";

export default async function LabPage() {
  const session = await auth();
  if (!session?.user || !["QUALITY", "OWNER"].includes(session.user.role)) {
    redirect("/");
  }

  const lots = await prisma.productionLot.findMany({
    orderBy: { createdAt: "desc" },
    take: 150,
    include: { field: true, microbiologyResult: { include: { sentBy: true } } },
  });

  const awaitingDispatch = lots.filter((l) => (l.microbiologyResult?.status ?? "PENDING") === "PENDING");
  const awaitingResult = lots.filter((l) => l.microbiologyResult?.status === "SENT_TO_LAB");
  const resolved = lots
    .filter((l) => l.microbiologyResult && ["APPROVED", "FAILED_MINOR", "FAILED_SEVERE"].includes(l.microbiologyResult.status))
    .slice(0, 30);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Lab</h1>
        <p className="mt-1 text-sm text-slate-500">
          Track samples sent out for lab clearance and record results. A lot can&apos;t ship until its result here is Approved.
        </p>
      </div>

      <Card>
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-slate-900">Awaiting Dispatch</h2>
          <Badge color="slate">{awaitingDispatch.length}</Badge>
        </div>
        <div className="mt-3 divide-y divide-slate-100">
          {awaitingDispatch.map((lot) => (
            <details key={lot.id} className="py-2">
              <summary className="cursor-pointer text-sm font-medium text-slate-800">
                {lot.lotNumber} — {lot.field.name} — Grade {lot.grade}
              </summary>
              <form action={markSentToLabAction.bind(null, lot.id)} className="mt-3 flex flex-wrap items-end gap-3">
                <FieldGroup label="Lab Name">
                  <Input name="labName" className="w-64" />
                </FieldGroup>
                <FieldGroup label="Tracking Ref.">
                  <Input name="trackingRef" className="w-48" />
                </FieldGroup>
                <FieldGroup label="Sent Date">
                  <Input name="sentDate" type="date" defaultValue={new Date().toISOString().slice(0, 10)} />
                </FieldGroup>
                <Button type="submit" variant="secondary">
                  Mark sent to lab
                </Button>
              </form>
            </details>
          ))}
          {awaitingDispatch.length === 0 && <p className="py-2 text-sm text-slate-400">Nothing waiting to be sent.</p>}
        </div>
      </Card>

      <Card>
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-slate-900">Sent — Awaiting Result</h2>
          <Badge color="amber">{awaitingResult.length}</Badge>
        </div>
        <div className="mt-3 divide-y divide-slate-100">
          {awaitingResult.map((lot) => (
            <details key={lot.id} className="py-2">
              <summary className="cursor-pointer text-sm font-medium text-slate-800">
                {lot.lotNumber} — {lot.field.name} — Grade {lot.grade}
                {lot.microbiologyResult?.sentDate && (
                  <span className="ml-2 font-normal text-slate-400">
                    sent {format(lot.microbiologyResult.sentDate, "dd MMM yyyy")}
                    {lot.microbiologyResult.labName ? ` to ${lot.microbiologyResult.labName}` : ""}
                    {lot.microbiologyResult.sentBy ? ` by ${lot.microbiologyResult.sentBy.name}` : ""}
                  </span>
                )}
              </summary>
              <ResultForm lotId={lot.id} result={lot.microbiologyResult} />
            </details>
          ))}
          {awaitingResult.length === 0 && <p className="py-2 text-sm text-slate-400">Nothing currently at the lab.</p>}
        </div>
      </Card>

      <Card>
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-slate-900">Resolved</h2>
          <Badge color="slate">{resolved.length}</Badge>
        </div>
        <div className="mt-3 divide-y divide-slate-100">
          {resolved.map((lot) => {
            const r = lot.microbiologyResult!;
            return (
              <details key={lot.id} className="py-2">
                <summary className="cursor-pointer text-sm font-medium text-slate-800">
                  {lot.lotNumber} — {lot.field.name} — Grade {lot.grade}{" "}
                  <Badge color={r.status === "APPROVED" ? "green" : r.status === "FAILED_MINOR" ? "amber" : "red"}>
                    {r.status.replace(/_/g, " ")}
                  </Badge>
                  {r.certificateFileName && (
                    <a
                      href={`/api/files/certificates/${r.certificateFileName}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ml-2 text-xs text-emerald-700 hover:underline"
                    >
                      View certificate
                    </a>
                  )}
                </summary>
                <ResultForm lotId={lot.id} result={r} />
              </details>
            );
          })}
          {resolved.length === 0 && <p className="py-2 text-sm text-slate-400">No results recorded yet.</p>}
        </div>
      </Card>
    </div>
  );
}

type ResultData = {
  status: string;
  notes: string | null;
  certificateNumber: string | null;
  labName: string | null;
  sampleId: string | null;
  protocolNumber: string | null;
  samplingBagSerial: string | null;
  samplingPlace: string | null;
  analysisStartDate: Date | null;
  analysisEndDate: Date | null;
  methodName: string | null;
  personInCharge: string | null;
  resultsSummary: string | null;
  certificateFileName: string | null;
  certificateFileOriginalName: string | null;
} | null | undefined;

function ResultForm({ lotId, result }: { lotId: string; result: ResultData }) {
  return (
    <form action={updateLabResultAction.bind(null, lotId)} className="mt-3 space-y-3" encType="multipart/form-data">
      <div className="grid grid-cols-4 gap-3">
        <FieldGroup label="Status">
          <Select name="status" defaultValue={result?.status ?? "SENT_TO_LAB"}>
            <option value="SENT_TO_LAB">Still awaiting result</option>
            <option value="APPROVED">Approved</option>
            <option value="FAILED_MINOR">Failed — Minor</option>
            <option value="FAILED_SEVERE">Failed — Severe</option>
          </Select>
        </FieldGroup>
        <FieldGroup label="Certificate Number">
          <Input name="certificateNumber" defaultValue={result?.certificateNumber ?? ""} />
        </FieldGroup>
        <FieldGroup label="Lab Name">
          <Input name="labName" defaultValue={result?.labName ?? ""} />
        </FieldGroup>
        <FieldGroup label="Sample ID">
          <Input name="sampleId" defaultValue={result?.sampleId ?? ""} />
        </FieldGroup>
        <FieldGroup label="Protocol Number">
          <Input name="protocolNumber" defaultValue={result?.protocolNumber ?? ""} />
        </FieldGroup>
        <FieldGroup label="Sampling Bag Serial">
          <Input name="samplingBagSerial" defaultValue={result?.samplingBagSerial ?? ""} />
        </FieldGroup>
        <FieldGroup label="Sampling Place">
          <Input name="samplingPlace" defaultValue={result?.samplingPlace ?? ""} />
        </FieldGroup>
        <FieldGroup label="Method Name">
          <Input name="methodName" defaultValue={result?.methodName ?? ""} />
        </FieldGroup>
        <FieldGroup label="Person In Charge">
          <Input name="personInCharge" defaultValue={result?.personInCharge ?? ""} />
        </FieldGroup>
        <FieldGroup label="Analysis Start Date">
          <Input name="analysisStartDate" type="date" defaultValue={result?.analysisStartDate?.toISOString().slice(0, 10) ?? ""} />
        </FieldGroup>
        <FieldGroup label="Analysis End Date">
          <Input name="analysisEndDate" type="date" defaultValue={result?.analysisEndDate?.toISOString().slice(0, 10) ?? ""} />
        </FieldGroup>
      </div>
      <FieldGroup label="Results Summary">
        <Input name="resultsSummary" placeholder="e.g. Chlorates: Not detected. Perchlorates: Not detected." defaultValue={result?.resultsSummary ?? ""} />
      </FieldGroup>
      <FieldGroup label="Notes">
        <Input name="notes" defaultValue={result?.notes ?? ""} />
      </FieldGroup>
      <FieldGroup label={result?.certificateFileOriginalName ? `Certificate File (currently: ${result.certificateFileOriginalName})` : "Certificate File (PDF, JPG, or PNG)"}>
        <input type="file" name="certificateFile" accept="application/pdf,image/jpeg,image/png" className="block text-sm" />
      </FieldGroup>
      <Button type="submit" variant="secondary">
        Save result
      </Button>
    </form>
  );
}
