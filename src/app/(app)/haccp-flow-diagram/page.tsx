import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { resolveLocale } from "@/lib/i18n/resolveLocale";
import { getDictionary } from "@/lib/i18n/getDictionary";
import { FlowDiagram } from "./flow-diagram";

export default async function HaccpFlowDiagramPage() {
  const session = await auth();
  if (!session?.user || !["OWNER", "QUALITY", "PRODUCTION"].includes(session.user.role)) {
    redirect("/");
  }

  const locale = await resolveLocale();
  const dict = getDictionary(locale).haccpFlowDiagram;

  return (
    <div>
      <div>
        <h1 className="text-xl font-semibold text-slate-900">{dict.title}</h1>
        <p className="mt-1 text-sm text-slate-500">{dict.subtitle}</p>
      </div>

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-400">
        <span>{dict.docMetaIssue}</span>
        <span>{dict.docMetaVersion}</span>
        <span>{dict.docMetaIssueDate}</span>
        <span>{dict.docMetaUpdated}</span>
        <span>{dict.docMetaVerified}</span>
      </div>

      <div className="mt-8">
        <h2 className="text-sm font-semibold text-slate-900">{dict.diagramHeading}</h2>
        <p className="mt-1 text-xs leading-relaxed text-slate-500">{dict.diagramNote}</p>
        <div className="mt-3">
          <FlowDiagram dict={dict} />
        </div>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="border-red-200 bg-red-50 space-y-3">
          <div>
            <Badge color="red">{dict.ccpBadge}</Badge>
            <h2 className="mt-2 text-sm font-semibold text-slate-900">{dict.ccpHeading}</h2>
            <p className="mt-1 text-xs leading-relaxed text-slate-600">{dict.ccpBody}</p>
          </div>
          <div className="border-t border-red-200 pt-3">
            <Badge color="red">{dict.ccpBadge02}</Badge>
            <h2 className="mt-2 text-sm font-semibold text-slate-900">{dict.ccpHeading02}</h2>
            <p className="mt-1 text-xs leading-relaxed text-slate-600">{dict.ccpBody02}</p>
          </div>
        </Card>
        <Card className="border-amber-200 bg-amber-50">
          <Badge color="amber">018 – 010</Badge>
          <h2 className="mt-2 text-sm font-semibold text-slate-900">{dict.highCareHeading}</h2>
          <p className="mt-1 text-xs leading-relaxed text-slate-600">{dict.highCareBody}</p>
        </Card>
        <Card className="border-blue-200 bg-blue-50">
          <Badge color="blue">016 →</Badge>
          <h2 className="mt-2 text-sm font-semibold text-slate-900">{dict.decisionHeading}</h2>
          <p className="mt-1 text-xs leading-relaxed text-slate-600">{dict.decisionQuestion}</p>
          <ul className="mt-2 space-y-1 text-xs leading-relaxed text-slate-600">
            <li>{dict.decisionYes}</li>
            <li>{dict.decisionNo}</li>
          </ul>
        </Card>
      </div>

      <div className="mt-8">
        <h2 className="text-sm font-semibold text-slate-900">{dict.stepsHeading}</h2>
        <p className="mt-1 text-xs leading-relaxed text-slate-500">{dict.stepsNote}</p>
        <div className="mt-3 overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-start text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-400">
                <th className="w-24 px-4 py-2 text-start font-medium">{dict.stepNumberLabel}</th>
                <th className="px-4 py-2 text-start font-medium"> </th>
              </tr>
            </thead>
            <tbody>
              {dict.steps.map((step, i) => {
                const isCcp = step.n === "016" || step.n === "007";
                return (
                  <tr
                    key={`${step.n}-${i}`}
                    className={`border-t border-slate-100 ${isCcp ? "bg-red-50/60" : ""}`}
                  >
                    <td className="px-4 py-2.5 font-mono text-xs text-slate-500">
                      {step.n}
                      {isCcp && (
                        <span className="ms-1.5">
                          <Badge color="red">{step.n === "007" ? dict.ccpBadge02 : dict.ccpBadge}</Badge>
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-slate-700">{step.name}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Badge color="slate">{dict.wasteLabel}</Badge>
          <Badge color="slate">{dict.rejectLabel}</Badge>
        </div>
      </div>
    </div>
  );
}
