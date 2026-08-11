import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input, FieldGroup } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { markSentToLabAction, markMrlSentToLabAction } from "./actions";
import { ResultForm } from "./result-form";
import { MrlResultForm } from "./mrl-result-form";
import { ResolveHoldForm } from "./resolve-hold-form";
import { TestDataBadge } from "@/components/test-data-badge";

const LAB_LABEL = { IN_HOUSE: "In-House", EXTERNAL: "External" } as const;

export default async function LabPage() {
  const session = await auth();
  if (!session?.user || !["QUALITY", "OWNER"].includes(session.user.role)) {
    redirect("/");
  }

  const [onHoldShifts, results, mrlResults] = await Promise.all([
    prisma.shiftLog.findMany({
      where: { onHold: true },
      include: { factory: true },
      orderBy: { holdSince: "desc" },
    }),
    prisma.microbiologyResult.findMany({
      orderBy: { createdAt: "desc" },
      take: 300,
      include: { lot: { include: { field: true } }, sentBy: true, testLines: true },
    }),
    prisma.mrlResult.findMany({
      orderBy: { createdAt: "desc" },
      take: 300,
      include: { lot: { include: { field: true } }, sentBy: true },
    }),
  ]);

  const awaitingDispatch = results.filter((r) => r.status === "PENDING");
  const awaitingResult = results.filter((r) => r.status === "SENT_TO_LAB");
  const resolved = results.filter((r) => ["APPROVED", "FAILED_MINOR", "FAILED_SEVERE"].includes(r.status)).slice(0, 40);

  const mrlAwaitingDispatch = mrlResults.filter((r) => r.status === "PENDING");
  const mrlAwaitingResult = mrlResults.filter((r) => r.status === "SENT_TO_LAB");
  const mrlResolved = mrlResults.filter((r) => r.status === "APPROVED" || r.status === "FAILED").slice(0, 40);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Lab</h1>
        <p className="mt-1 text-sm text-slate-500">
          Every lot is sampled to both our in-house lab and an external lab. A lot can&apos;t ship until both come back
          Approved — and if the two disagree, every lot from that shift goes on hold until further testing resolves it.
        </p>
      </div>

      {onHoldShifts.length > 0 && (
        <Card className="border-red-300 bg-red-50">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-red-800">Shifts On Hold — Split Microbiology Result</h2>
            <Badge color="red">{onHoldShifts.length}</Badge>
          </div>
          <div className="mt-3 space-y-3">
            {onHoldShifts.map((shift) => (
              <div key={shift.id} className="rounded-md border border-red-200 bg-white p-3">
                <p className="text-sm font-medium text-slate-900">
                  {shift.factory.name} — {format(shift.date, "dd MMM yyyy")} {shift.shiftType} shift
                </p>
                <p className="mt-1 text-sm text-red-700">{shift.holdReason}</p>
                <p className="mt-1 text-xs text-slate-500">
                  On hold since {shift.holdSince ? format(shift.holdSince, "dd MMM yyyy HH:mm") : "—"}
                </p>
                <ResolveHoldForm shiftId={shift.id} />
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card>
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-slate-900">Awaiting Dispatch</h2>
          <Badge color="slate">{awaitingDispatch.length}</Badge>
        </div>
        <div className="mt-3 divide-y divide-slate-100">
          {awaitingDispatch.map((r) => (
            <details key={r.id} className="py-2">
              <summary className="cursor-pointer text-sm font-medium text-slate-800">
                {r.lot.lotNumber} — {r.lot.field.name} — Grade {r.lot.grade}{" "}
                <Badge color={r.labType === "IN_HOUSE" ? "blue" : "slate"}>{LAB_LABEL[r.labType]}</Badge>
                {(r.isTestData || r.lot.isTestData) && (
                  <>
                    {" "}
                    <TestDataBadge />
                  </>
                )}
              </summary>
              <form action={markSentToLabAction.bind(null, r.id)} className="mt-3 flex flex-wrap items-end gap-3">
                <FieldGroup label="Lab Name">
                  <Input name="labName" className="w-64" />
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
          {awaitingResult.map((r) => (
            <details key={r.id} className="py-2">
              <summary className="cursor-pointer text-sm font-medium text-slate-800">
                {r.lot.lotNumber} — {r.lot.field.name} — Grade {r.lot.grade}{" "}
                <Badge color={r.labType === "IN_HOUSE" ? "blue" : "slate"}>{LAB_LABEL[r.labType]}</Badge>
                {r.sentDate && (
                  <span className="ml-2 font-normal text-slate-400">
                    sent {format(r.sentDate, "dd MMM yyyy")}
                    {r.labName ? ` to ${r.labName}` : ""}
                    {r.sentBy ? ` by ${r.sentBy.name}` : ""}
                  </span>
                )}
                {(r.isTestData || r.lot.isTestData) && (
                  <>
                    {" "}
                    <TestDataBadge />
                  </>
                )}
              </summary>
              <ResultForm resultId={r.id} labType={r.labType} result={r} />
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
          {resolved.map((r) => (
            <details key={r.id} className="py-2">
              <summary className="cursor-pointer text-sm font-medium text-slate-800">
                {r.lot.lotNumber} — {r.lot.field.name} — Grade {r.lot.grade}{" "}
                <Badge color={r.labType === "IN_HOUSE" ? "blue" : "slate"}>{LAB_LABEL[r.labType]}</Badge>{" "}
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
                {(r.status === "FAILED_MINOR" || r.status === "FAILED_SEVERE") && r.rejectionReason && (
                  <span className="ml-2 font-normal text-red-700">
                    {r.rejectionReason}
                    {r.rejectedQuantityTonnes ? ` — ${r.rejectedQuantityTonnes}t` : ""}
                  </span>
                )}
                {(r.isTestData || r.lot.isTestData) && (
                  <>
                    {" "}
                    <TestDataBadge />
                  </>
                )}
              </summary>
              <ResultForm resultId={r.id} labType={r.labType} result={r} />
            </details>
          ))}
          {resolved.length === 0 && <p className="py-2 text-sm text-slate-400">No results recorded yet.</p>}
        </div>
      </Card>

      <div className="pt-2">
        <h2 className="text-lg font-semibold text-slate-900">MRL — Pesticide Residue Testing</h2>
        <p className="mt-1 text-sm text-slate-500">
          Every lot also needs its own MRL result, tested externally, before it can load out — same hard gate as
          microbiology, added even though the farms run a biological-control program with no synthetic spraying.
        </p>
      </div>

      <Card>
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-slate-900">Awaiting Dispatch</h2>
          <Badge color="slate">{mrlAwaitingDispatch.length}</Badge>
        </div>
        <div className="mt-3 divide-y divide-slate-100">
          {mrlAwaitingDispatch.map((r) => (
            <details key={r.id} className="py-2">
              <summary className="cursor-pointer text-sm font-medium text-slate-800">
                {r.lot.lotNumber} — {r.lot.field.name} — Grade {r.lot.grade}
                {(r.isTestData || r.lot.isTestData) && (
                  <>
                    {" "}
                    <TestDataBadge />
                  </>
                )}
              </summary>
              <form action={markMrlSentToLabAction.bind(null, r.id)} className="mt-3 flex flex-wrap items-end gap-3">
                <FieldGroup label="Lab Name">
                  <Input name="labName" className="w-64" />
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
          {mrlAwaitingDispatch.length === 0 && <p className="py-2 text-sm text-slate-400">Nothing waiting to be sent.</p>}
        </div>
      </Card>

      <Card>
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-slate-900">Sent — Awaiting Result</h2>
          <Badge color="amber">{mrlAwaitingResult.length}</Badge>
        </div>
        <div className="mt-3 divide-y divide-slate-100">
          {mrlAwaitingResult.map((r) => (
            <details key={r.id} className="py-2">
              <summary className="cursor-pointer text-sm font-medium text-slate-800">
                {r.lot.lotNumber} — {r.lot.field.name} — Grade {r.lot.grade}
                {r.sentDate && (
                  <span className="ml-2 font-normal text-slate-400">
                    sent {format(r.sentDate, "dd MMM yyyy")}
                    {r.labName ? ` to ${r.labName}` : ""}
                    {r.sentBy ? ` by ${r.sentBy.name}` : ""}
                  </span>
                )}
                {(r.isTestData || r.lot.isTestData) && (
                  <>
                    {" "}
                    <TestDataBadge />
                  </>
                )}
              </summary>
              <MrlResultForm resultId={r.id} result={r} />
            </details>
          ))}
          {mrlAwaitingResult.length === 0 && <p className="py-2 text-sm text-slate-400">Nothing currently at the lab.</p>}
        </div>
      </Card>

      <Card>
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-slate-900">Resolved</h2>
          <Badge color="slate">{mrlResolved.length}</Badge>
        </div>
        <div className="mt-3 divide-y divide-slate-100">
          {mrlResolved.map((r) => (
            <details key={r.id} className="py-2">
              <summary className="cursor-pointer text-sm font-medium text-slate-800">
                {r.lot.lotNumber} — {r.lot.field.name} — Grade {r.lot.grade}{" "}
                <Badge color={r.status === "APPROVED" ? "green" : "red"}>{r.status}</Badge>
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
                {r.status === "FAILED" && r.rejectionReason && (
                  <span className="ml-2 font-normal text-red-700">{r.rejectionReason}</span>
                )}
                {(r.isTestData || r.lot.isTestData) && (
                  <>
                    {" "}
                    <TestDataBadge />
                  </>
                )}
              </summary>
              <MrlResultForm resultId={r.id} result={r} />
            </details>
          ))}
          {mrlResolved.length === 0 && <p className="py-2 text-sm text-slate-400">No results recorded yet.</p>}
        </div>
      </Card>
    </div>
  );
}
