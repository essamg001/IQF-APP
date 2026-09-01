import type { Dictionary } from "@/lib/i18n/dictionaries/en";

type Dict = Dictionary["haccpFlowDiagram"];

type Box = { x: number; y: number; w: number; h: number };

function Node({
  box,
  n,
  children,
  variant = "default",
}: {
  box: Box;
  n?: string;
  children: React.ReactNode;
  variant?: "default" | "ccp" | "highCare" | "decision" | "terminal" | "muted";
}) {
  const styles: Record<string, string> = {
    default: "border-slate-300 bg-white text-slate-700",
    ccp: "border-red-400 bg-red-50 text-slate-800 ring-2 ring-red-300",
    highCare: "border-amber-300 bg-amber-50/70 text-slate-700",
    decision: "border-blue-400 bg-blue-50 text-slate-800",
    terminal: "border-slate-400 bg-slate-100 text-slate-600 border-dashed",
    muted: "border-slate-900 bg-slate-900 text-white",
  };
  return (
    <foreignObject x={box.x} y={box.y} width={box.w} height={box.h}>
      <div
        className={`flex h-full w-full flex-col justify-center gap-0.5 rounded-md border px-2.5 py-1.5 text-center text-[10.5px] leading-[1.25] ${styles[variant]}`}
      >
        {n && (
          <span className="font-mono text-[9px] font-semibold tracking-wide text-slate-400">
            {n}
          </span>
        )}
        <span className="font-medium">{children}</span>
      </div>
    </foreignObject>
  );
}

function Arrow({ d, dashed, color = "#94a3b8" }: { d: string; dashed?: boolean; color?: string }) {
  return (
    <path
      d={d}
      fill="none"
      stroke={color}
      strokeWidth={2.5}
      strokeDasharray={dashed ? "6 5" : undefined}
      markerEnd="url(#arrowhead)"
    />
  );
}

export function FlowDiagram({ dict }: { dict: Dict }) {
  const s = dict.steps;
  const label = (i: number) => s[i]?.name ?? "";
  const num = (i: number) => s[i]?.n ?? "";

  // Column centers
  const MAIN = 610;
  const LEFT = 275;
  const RIGHT = 720;
  const FAR = 960;

  const b = (cx: number, y: number, w: number, h: number): Box => ({ x: cx - w / 2, y, w, h });

  const B = {
    start: b(MAIN, 20, 140, 44),
    n001: b(MAIN, 90, 230, 70),
    n002: b(MAIN, 195, 230, 95),
    n003: b(MAIN, 325, 230, 55),
    n004a: b(MAIN, 415, 230, 65),
    n005: b(LEFT, 415, 220, 95),
    waste: b(LEFT, 530, 220, 45),
    n006: b(MAIN, 515, 230, 110),
    n007: b(MAIN, 660, 230, 120),
    n004b: b(MAIN, 815, 230, 65),
    n008: b(LEFT, 930, 220, 65),
    n009: b(MAIN, 930, 230, 80),
    n010: b(LEFT + 40, 1075, 180, 65),
    n011: b(RIGHT, 1075, 230, 95),
    n023a: b(FAR, 1075, 230, 100),
    reject: b(FAR, 1225, 230, 60),
    n013: b(LEFT + 40, 1225, 220, 75),
    n012: b(RIGHT, 1225, 220, 75),
    n014: b(LEFT + 40, 1355, 220, 80),
    n015: b(RIGHT, 1355, 220, 80),
    n016: b(MAIN, 1495, 250, 110),
    n017: b(MAIN, 1655, 250, 65),
    n018: b(MAIN, 1770, 250, 65),
    n019: b(MAIN, 1885, 250, 85),
    decision: b(MAIN, 2020, 260, 170),
    n020: b(MAIN, 2240, 250, 85),
    n021: b(MAIN, 2375, 250, 85),
    n022: b(MAIN, 2510, 250, 65),
    n023b: b(MAIN, 2625, 250, 75),
    end: b(MAIN, 2740, 140, 44),
  };

  const cx = (box: Box) => box.x + box.w / 2;
  const top = (box: Box) => box.y;
  const bottom = (box: Box) => box.y + box.h;
  const left = (box: Box) => box.x;
  const right = (box: Box) => box.x + box.w;
  const midY = (box: Box) => box.y + box.h / 2;

  const straight = (a: Box, bx: Box) => `M${cx(a)},${bottom(a)} L${cx(bx)},${top(bx)}`;
  const elbowDown = (a: Box, bx: Box, atY: number) =>
    `M${cx(a)},${bottom(a)} L${cx(a)},${atY} L${cx(bx)},${atY} L${cx(bx)},${top(bx)}`;

  return (
    <div dir="ltr" className="overflow-x-auto rounded-lg border border-slate-200 bg-slate-50/50 p-4">
      <svg viewBox="0 0 1120 2820" width={1120} height={2820} className="mx-auto max-w-none" style={{ minWidth: 720 }}>
        <defs>
          <marker id="arrowhead" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
            <path d="M0,0 L8,4 L0,8 Z" fill="#94a3b8" />
          </marker>
          <marker id="arrowhead-red" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
            <path d="M0,0 L8,4 L0,8 Z" fill="#dc2626" />
          </marker>
        </defs>

        {/* high-care backdrop, steps 010-018 */}
        <rect x={LEFT - 70} y={1045} width={FAR + 155 - (LEFT - 70)} height={1520 - 1045} rx={16} fill="#fef3c7" opacity={0.35} />

        {/* main chain */}
        <Arrow d={straight(B.start, B.n001)} />
        <Arrow d={straight(B.n001, B.n002)} />
        <Arrow d={straight(B.n002, B.n003)} />
        <Arrow d={straight(B.n003, B.n004a)} />
        <Arrow d={straight(B.n004a, B.n006)} />
        <Arrow d={straight(B.n006, B.n007)} />
        <Arrow d={straight(B.n007, B.n004b)} />
        <Arrow d={straight(B.n004b, B.n009)} />

        {/* 004(1) sorting exception: stem removal -> waste, and back into 002 */}
        <Arrow d={`M${left(B.n004a)},${midY(B.n004a)} L${right(B.n005)},${midY(B.n005)}`} />
        <Arrow d={straight(B.n005, B.waste)} />
        <Arrow d={`M${left(B.n005)},${midY(B.n005)} L60,${midY(B.n005)} L60,${midY(B.n002)} L${left(B.n002)},${midY(B.n002)}`} dashed color="#0891b2" />

        {/* 004(2) -> slicing/dicing -> 009 */}
        <Arrow d={elbowDown(B.n004b, B.n008, 890)} />
        <Arrow d={`M${right(B.n008)},${midY(B.n008)} L${left(B.n009)},${midY(B.n009)}`} />

        {/* 009 -> 010 -> 011 */}
        <Arrow d={elbowDown(B.n009, B.n010, 1050)} />
        <Arrow d={elbowDown(B.n009, B.n011, 1050)} />
        <Arrow d={`M${right(B.n010)},${midY(B.n010)} L${left(B.n011)},${midY(B.n011)}`} />

        {/* 011 + 023a feed the packing bus -> 012 / 013 */}
        <Arrow d={elbowDown(B.n011, B.n012, 1200)} />
        <Arrow d={`M${cx(B.n011)},1200 L${cx(B.n013)},1200 L${cx(B.n013)},${top(B.n013)}`} />
        <Arrow d={elbowDown(B.n023a, B.n012, 1200)} />

        {/* 023a -> reject (packaging material rejected) */}
        <Arrow d={straight(B.n023a, B.reject)} color="#dc2626" />

        {/* packing -> sealing/sewing -> 016 */}
        <Arrow d={straight(B.n013, B.n014)} />
        <Arrow d={straight(B.n012, B.n015)} />
        <Arrow d={`M${cx(B.n014)},${bottom(B.n014)} L${cx(B.n014)},1480 L${cx(B.n016)},1480 L${cx(B.n016)},${top(B.n016)}`} />
        <Arrow d={`M${cx(B.n015)},${bottom(B.n015)} L${cx(B.n015)},1480 L${cx(B.n016)},1480 L${cx(B.n016)},${top(B.n016)}`} />

        {/* 016 -> 017 -> 018 -> 019 -> decision */}
        <Arrow d={straight(B.n016, B.n017)} />
        <Arrow d={straight(B.n017, B.n018)} />
        <Arrow d={straight(B.n018, B.n019)} />
        <Arrow d={straight(B.n019, B.decision)} />

        {/* decision Yes -> 020; No -> back to 016 (re-run metal detection) */}
        <Arrow d={straight(B.decision, B.n020)} />
        <Arrow
          d={`M${right(B.decision)},${midY(B.decision)} L1040,${midY(B.decision)} L1040,${midY(B.n016)} L${right(B.n016)},${midY(B.n016)}`}
          dashed
          color="#dc2626"
        />

        {/* 018 rework: temperature not reached -> back to 009 */}
        <Arrow
          d={`M${right(B.n018)},${midY(B.n018)} L1090,${midY(B.n018)} L1090,${midY(B.n009)} L${right(B.n009)},${midY(B.n009)}`}
          dashed
          color="#d97706"
        />

        {/* final chain */}
        <Arrow d={straight(B.n020, B.n021)} />
        <Arrow d={straight(B.n021, B.n022)} />
        <Arrow d={straight(B.n022, B.n023b)} />
        <Arrow d={straight(B.n023b, B.end)} />

        {/* rework loop labels */}
        <text x={LEFT + 90} y={midY(B.n005) - 10} className="fill-cyan-700 text-[9px] font-semibold" textAnchor="middle">
          ↻
        </text>
        <text x={935} y={midY(B.n018) - 8} className="fill-amber-700 text-[9.5px] font-semibold" textAnchor="end">
          {dict.reworkTempLabel}
        </text>
        <text x={1035} y={midY(B.decision) - 8} className="fill-red-700 text-[9.5px] font-semibold" textAnchor="end">
          {dict.reworkMetalLabel}
        </text>

        {/* nodes */}
        <Node box={B.start} variant="muted">{dict.startLabel}</Node>
        <Node box={B.n001} n={num(0)}>{label(0)}</Node>
        <Node box={B.n002} n={num(1)}>{label(1)}</Node>
        <Node box={B.n003} n={num(2)}>{label(2)}</Node>
        <Node box={B.n004a} n={num(3)}>{label(3)}</Node>
        <Node box={B.n005} n={num(10)}>{label(10)}</Node>
        <Node box={B.waste} variant="terminal">{dict.wasteLabel}</Node>
        <Node box={B.n006} n={num(4)}>{label(4)}</Node>
        <Node box={B.n007} n={num(5)} variant="ccp">
          <span className="mb-0.5 block text-[8.5px] font-bold uppercase tracking-wider text-red-600">{dict.ccpBadge02}</span>
          {label(5)}
        </Node>
        <Node box={B.n004b} n={num(6)}>{label(6)}</Node>
        <Node box={B.n008} n={num(11)}>{label(11)}</Node>
        <Node box={B.n009} n={num(7)}>{label(7)}</Node>
        <Node box={B.n010} n={num(8)}>{label(8)}</Node>
        <Node box={B.n011} n={num(9)}>{label(9)}</Node>
        <Node box={B.n023a} n={num(23)}>{label(23)}</Node>
        <Node box={B.reject} variant="terminal">{dict.rejectLabel}</Node>
        <Node box={B.n013} n={num(13)} variant="highCare">{label(13)}</Node>
        <Node box={B.n012} n={num(12)} variant="highCare">{label(12)}</Node>
        <Node box={B.n014} n={num(14)} variant="highCare">{label(14)}</Node>
        <Node box={B.n015} n={num(15)} variant="highCare">{label(15)}</Node>
        <Node box={B.n016} n={num(17)} variant="ccp">
          <span className="mb-0.5 block text-[8.5px] font-bold uppercase tracking-wider text-red-600">{dict.ccpBadge}</span>
          {label(17)}
        </Node>
        <Node box={B.n017} n={num(16)} variant="highCare">{label(16)}</Node>
        <Node box={B.n018} n={num(18)} variant="highCare">{label(18)}</Node>
        <Node box={B.n019} n={num(19)} variant="highCare">{label(19)}</Node>
        <Node box={B.decision} variant="decision">
          <span className="mb-0.5 block text-[8.5px] font-bold uppercase tracking-wider text-blue-600">{dict.decisionHeading}</span>
          {dict.decisionQuestion}
        </Node>
        <Node box={B.n020} n={num(20)}>{label(20)}</Node>
        <Node box={B.n021} n={num(21)}>{label(21)}</Node>
        <Node box={B.n022} n={num(22)}>{label(22)}</Node>
        <Node box={B.n023b} n={num(24)}>{label(24)}</Node>
        <Node box={B.end} variant="muted">{dict.endLabel}</Node>

        {/* Yes / No labels beside the decision node */}
        <text x={cx(B.decision) + 6} y={bottom(B.decision) + 20} className="fill-emerald-700 text-[10px] font-bold">
          {dict.decisionYes.split(" —")[0]}
        </text>
        <text x={right(B.decision) + 8} y={midY(B.decision) - 30} className="fill-red-600 text-[10px] font-bold">
          {dict.reworkMetalLabel.split(" —")[0]}
        </text>
      </svg>
    </div>
  );
}
