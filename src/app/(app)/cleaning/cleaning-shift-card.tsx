import { CLEANING_AREAS, CLEANING_AREA_LABEL, cleaningScoreColor, isCleaningLocked } from "@/lib/cleaning";
import { signCleaningAction } from "./actions";
import { ScoreEntryForm } from "./score-entry-form";
import { FoamToggleForm } from "./foam-toggle-form";
import { SignOffForm } from "./sign-off-form";
import { ReopenCleaningForm } from "./reopen-cleaning-form";

type Score = { area: string; productionScore: number | null; maintenanceScore: number | null };
type Record = {
  cleanedWithFoam: boolean;
  productionSignedByName: string | null;
  productionSignedAt: Date | null;
  maintenanceSignedByName: string | null;
  maintenanceSignedAt: Date | null;
} | null;

const ROLE_LABEL = { PRODUCTION: "Head of Production", MAINTENANCE: "Head of Maintenance" } as const;
// Set via inline style, not a border-l-{color} class -- Tailwind's generated
// stylesheet put the all-sides `border-slate-200` rule after the left-only
// accent rule, so the shorthand silently overwrote the accent color. Inline
// style always wins the cascade regardless of Tailwind's internal ordering.
const ROLE_ACCENT_COLOR = { PRODUCTION: "#38bdf8", MAINTENANCE: "#a78bfa" } as const; // sky-400 / violet-400

// One panel per role, holding both that role's score entry and its sign-off
// -- previously these were four separate boxes (two for scores, two for
// sign-off) with the role name repeated on each, which read as cluttered.
function RolePanel({
  role,
  factoryId,
  date,
  shiftType,
  scores,
  canScore,
  locked,
  complete,
  signedByName,
  signedAt,
  currentUserLabel,
}: {
  role: "PRODUCTION" | "MAINTENANCE";
  factoryId: string;
  date: string;
  shiftType: "DAY" | "NIGHT";
  scores: Score[];
  canScore: boolean;
  locked: boolean;
  complete: boolean;
  signedByName: string | null;
  signedAt: Date | null;
  currentUserLabel: string | null;
}) {
  const roleLabel = ROLE_LABEL[role];
  const otherRoleLabel = role === "PRODUCTION" ? ROLE_LABEL.MAINTENANCE : ROLE_LABEL.PRODUCTION;

  return (
    <div
      className="rounded-md border border-l-4 border-slate-200 bg-slate-50/50 p-2"
      style={{ borderLeftColor: ROLE_ACCENT_COLOR[role] }}
    >
      <h5 className="text-xs font-semibold uppercase tracking-wide text-slate-600">{roleLabel}</h5>
      {!canScore ? (
        <p className="mt-1 text-xs text-slate-400">Only the Owner or {roleLabel} can score and sign off.</p>
      ) : (
        <>
          {!locked && (
            <div className="mt-1">
              <ScoreEntryForm factoryId={factoryId} date={date} shiftType={shiftType} role={role} scores={scores} />
            </div>
          )}
          <div className="mt-2 border-t border-slate-200 pt-2">
            {signedByName ? (
              <p className="text-sm text-slate-800">
                {signedByName}
                <span className="ml-2 text-xs text-slate-500">{signedAt?.toLocaleString()}</span>
              </p>
            ) : !complete ? (
              <p className="text-xs text-slate-400">Score every area above before signing off.</p>
            ) : (
              <SignOffForm
                action={signCleaningAction.bind(null, factoryId, date, shiftType, role)}
                confirmMessage={`Confirm as ${
                  currentUserLabel ?? "yourself"
                }, ${roleLabel}: cleaning was done well and this area is cleared for production. This locks the record once ${otherRoleLabel} also signs off.`}
              />
            )}
          </div>
        </>
      )}
    </div>
  );
}

export function CleaningShiftCard({
  factoryId,
  date,
  shiftType,
  shiftLabel,
  scores,
  record,
  canScoreProduction,
  canScoreMaintenance,
  currentUserLabel,
}: {
  factoryId: string;
  date: string;
  shiftType: "DAY" | "NIGHT";
  shiftLabel: string;
  scores: Score[];
  record: Record;
  canScoreProduction: boolean;
  canScoreMaintenance: boolean;
  currentUserLabel: string | null;
}) {
  const locked = isCleaningLocked(record);
  const missingForRole = (role: "PRODUCTION" | "MAINTENANCE") =>
    CLEANING_AREAS.filter((area) => {
      const row = scores.find((s) => s.area === area);
      return role === "PRODUCTION" ? row?.productionScore == null : row?.maintenanceScore == null;
    });
  const productionComplete = missingForRole("PRODUCTION").length === 0;
  const maintenanceComplete = missingForRole("MAINTENANCE").length === 0;

  return (
    <div className="rounded-md border border-slate-200 p-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">{shiftLabel}</h4>
        <FoamToggleForm
          factoryId={factoryId}
          date={date}
          shiftType={shiftType}
          cleanedWithFoam={record?.cleanedWithFoam ?? false}
          disabled={locked && !(canScoreProduction || canScoreMaintenance)}
        />
      </div>

      <table className="w-full text-left text-xs">
        <thead className="border-b border-slate-200 text-slate-500">
          <tr>
            <th className="py-1.5 pr-3 font-medium">Area</th>
            <th className="py-1.5 pr-3 font-medium">Production</th>
            <th className="py-1.5 pr-3 font-medium">Maintenance</th>
          </tr>
        </thead>
        <tbody>
          {CLEANING_AREAS.map((area) => {
            const row = scores.find((s) => s.area === area);
            return (
              <tr key={area} className="border-b border-slate-100 last:border-0">
                <td className="py-1.5 pr-3 font-medium text-slate-800">{CLEANING_AREA_LABEL[area]}</td>
                <td className={`py-1.5 pr-3 font-semibold ${cleaningScoreColor(row?.productionScore)}`}>
                  {row?.productionScore ?? "—"}
                </td>
                <td className={`py-1.5 pr-3 font-semibold ${cleaningScoreColor(row?.maintenanceScore)}`}>
                  {row?.maintenanceScore ?? "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div className="mt-2 border-t border-slate-100 pt-2">
        {locked ? (
          <p className="mb-2 text-xs text-amber-700">
            Locked — cleared for production by both heads. Reopen below to correct a score.
          </p>
        ) : (
          <p className="mb-2 text-xs text-slate-500">
            Score every area, then sign off to confirm cleaning was done well and cleared for production.
          </p>
        )}
        <div className="space-y-3">
          <RolePanel
            role="PRODUCTION"
            factoryId={factoryId}
            date={date}
            shiftType={shiftType}
            scores={scores}
            canScore={canScoreProduction}
            locked={locked}
            complete={productionComplete}
            signedByName={record?.productionSignedByName ?? null}
            signedAt={record?.productionSignedAt ?? null}
            currentUserLabel={currentUserLabel}
          />
          <RolePanel
            role="MAINTENANCE"
            factoryId={factoryId}
            date={date}
            shiftType={shiftType}
            scores={scores}
            canScore={canScoreMaintenance}
            locked={locked}
            complete={maintenanceComplete}
            signedByName={record?.maintenanceSignedByName ?? null}
            signedAt={record?.maintenanceSignedAt ?? null}
            currentUserLabel={currentUserLabel}
          />
        </div>
      </div>

      {locked && (canScoreProduction || canScoreMaintenance) && (
        <div className="mt-3 border-t border-slate-100 pt-3">
          <ReopenCleaningForm factoryId={factoryId} date={date} shiftType={shiftType} />
        </div>
      )}
    </div>
  );
}
