import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { PostDecapForm } from "./post-decap-form";

export default async function PostDecapQualityPage() {
  const session = await auth();
  if (!session?.user || !["QUALITY", "OWNER"].includes(session.user.role)) {
    redirect("/");
  }

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const [todaysChecks, fields, arrivalChecks] = await Promise.all([
    prisma.qualityCheck.findMany({
      where: { checkpoint: "POST_DECAP", createdAt: { gte: startOfToday } },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    prisma.field.findMany({ where: { variety: "MS1" }, orderBy: { name: "asc" } }),
    prisma.qualityCheck.findMany({
      where: {
        checkpoint: "PRE_DECAP",
        fieldId: { not: null },
        receiptNoteNo: { not: null },
        createdAt: { gte: startOfToday },
      },
      include: { field: true },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
  ]);

  const accepted = todaysChecks.filter((c) => c.decision === "ACCEPTED").length;
  const rejected = todaysChecks.filter((c) => c.decision === "REJECTED").length;

  // Map receiptNoteNo -> field name from today's Pre-Decap Arrivals (STR03101),
  // so the form can auto-fill the field once the same receipt note is entered here.
  const fieldByReceiptNote: Record<string, string> = {};
  for (const c of arrivalChecks) {
    if (c.receiptNoteNo && c.field && !(c.receiptNoteNo in fieldByReceiptNote)) {
      fieldByReceiptNote[c.receiptNoteNo] = c.field.name;
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Decap — Post-Decap Quality</h1>
        <p className="mt-1 text-sm text-slate-500">
          Final product strawberry inspection (STR03107) — the greenlight for fruit to leave the decap facility
          for the factory. Enter the same Harvest Ticket Serial Number as the matching pre-decap arrival to auto-fill the field.
        </p>
      </div>

      <div className="flex gap-4">
        <Badge color="slate">{todaysChecks.length} logged today</Badge>
        <Badge color="green">{accepted} accepted</Badge>
        <Badge color="red">{rejected} rejected</Badge>
      </div>

      <div className="max-w-3xl">
        <PostDecapForm fields={fields} fieldByReceiptNote={fieldByReceiptNote} />
      </div>

      <Card className="max-w-3xl overflow-x-auto p-0">
        <h2 className="px-4 py-3 text-sm font-semibold text-slate-900">Today&apos;s Log</h2>
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-slate-500">
            <tr>
              <th className="px-4 py-2 font-medium">Time</th>
              <th className="px-4 py-2 font-medium">Sample</th>
              <th className="px-4 py-2 font-medium">QC</th>
              <th className="px-4 py-2 font-medium">Receipt Note</th>
              <th className="px-4 py-2 font-medium">Client</th>
              <th className="px-4 py-2 font-medium">Total Defects</th>
              <th className="px-4 py-2 font-medium">Decision</th>
            </tr>
          </thead>
          <tbody>
            {todaysChecks.map((c) => (
              <tr key={c.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                <td className="px-4 py-2 text-slate-500">
                  {c.createdAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </td>
                <td className="px-4 py-2">
                  <Link href={`/quality-check/${c.id}`} className="text-emerald-700 hover:underline">
                    {c.sampleNo ?? "—"}
                  </Link>
                </td>
                <td className="px-4 py-2">{c.decapQcApprover ?? "—"}</td>
                <td className="px-4 py-2">{c.receiptNoteNo ?? "—"}</td>
                <td className="px-4 py-2">{c.clientName ?? "—"}</td>
                <td className="px-4 py-2">
                  {c.totalDefectsPct != null ? (
                    <Badge color={c.totalDefectsPct > 6 ? "red" : "green"}>{c.totalDefectsPct.toFixed(1)}%</Badge>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="px-4 py-2">
                  <Badge color={c.decision === "ACCEPTED" ? "green" : "red"}>{c.decision}</Badge>
                </td>
              </tr>
            ))}
            {todaysChecks.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-slate-400">
                  Nothing logged yet today.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
