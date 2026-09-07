import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { LinkButton } from "@/components/ui/button";
import { resolveLocale } from "@/lib/i18n/resolveLocale";
import { getDictionary } from "@/lib/i18n/getDictionary";
import { PrintButton } from "@/components/ui/print-button";
import type { OrgPosition } from "@prisma/client";

function buildTree(positions: OrgPosition[]) {
  const byParent = new Map<string | null, OrgPosition[]>();
  for (const p of positions) {
    const key = p.reportsToId;
    const list = byParent.get(key) ?? [];
    list.push(p);
    byParent.set(key, list);
  }
  for (const list of byParent.values()) {
    list.sort((a, b) => a.sortOrder - b.sortOrder || a.title.localeCompare(b.title));
  }
  return byParent;
}

function PositionRow({
  position,
  byParent,
  depth,
  dict,
}: {
  position: OrgPosition;
  byParent: Map<string | null, OrgPosition[]>;
  depth: number;
  dict: ReturnType<typeof getDictionary>["orgStructure"];
}) {
  const children = byParent.get(position.id) ?? [];
  return (
    <li>
      <div className="flex items-center justify-between rounded-md border border-slate-200 bg-white px-3 py-2" style={{ marginInlineStart: `${depth * 1.5}rem` }}>
        <div>
          <p className="text-sm font-medium text-slate-900">{position.title}</p>
          <p className="text-xs text-slate-500">
            {position.personName ?? <span className="italic text-amber-600">{dict.vacantLabel}</span>}
            {position.department && ` · ${position.department}`}
            {position.headcount > 0 && ` · ${dict.headcountSuffix.replace("{count}", String(position.headcount))}`}
          </p>
        </div>
        <Link href={`/org-structure/${position.id}/edit`} className="no-print text-xs text-emerald-700 hover:underline">
          {dict.editLink}
        </Link>
      </div>
      {children.length > 0 && (
        <ul className="mt-2 space-y-2">
          {children.map((c) => (
            <PositionRow key={c.id} position={c} byParent={byParent} depth={depth + 1} dict={dict} />
          ))}
        </ul>
      )}
    </li>
  );
}

export default async function OrgStructurePage() {
  const dict = getDictionary(await resolveLocale()).orgStructure;
  const positions = await prisma.orgPosition.findMany({ orderBy: [{ sortOrder: "asc" }, { title: "asc" }] });

  const byParent = buildTree(positions);
  const roots = byParent.get(null) ?? [];

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">{dict.title}</h1>
          <p className="mt-1 text-sm text-slate-500">{dict.subtitle}</p>
        </div>
        <div className="flex items-center gap-2">
          <LinkButton href="/org-structure/new" className="no-print">
            {dict.addPosition}
          </LinkButton>
          <PrintButton />
        </div>
      </div>

      <Card className="mt-6">
        {roots.length === 0 ? (
          <p className="text-sm text-slate-400">{dict.noPositionsYet}</p>
        ) : (
          <ul className="space-y-2">
            {roots.map((p) => (
              <PositionRow key={p.id} position={p} byParent={byParent} depth={0} dict={dict} />
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
