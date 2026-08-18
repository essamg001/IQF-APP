import { CLEANING_AREAS, cleaningScoreColor, isCleaningLocked } from "@/lib/cleaning";
import type { CleaningArea } from "@prisma/client";
import { signCleaningAction } from "./actions";
import { ScoreEntryForm } from "./score-entry-form";
import { FoamToggleForm } from "./foam-toggle-form";
import { SignOffForm } from "./sign-off-form";
import { ReopenCleaningForm } from "./reopen-cleaning-form";
import type { Dictionary } from "@/lib/i18n/getDictionary";

type Score = { area: string; productionScore: number | null; maintenanceScore: number | null };
type Record = {
  cleanedWithFoam: boolean;
  productionSignedByName: string | null;
  productionSignedAt: Date | null;
  maintenanceSignedByName: string | null;
  maintenanceSignedAt: Date | null;
} | null;
type CleaningModeDict = Dictionary["cleaningMode"];

function areaLabel(area: CleaningArea, dict: CleaningModeDict): string {
  const map: { [key in CleaningArea]: string } = {
    ARRIVAL: dict.areaArrival,
    PRE_COOLING: dict.areaPreCooling,
    PROCESSING: dict.areaProcessing,
    PACKAGING: dict.areaPackaging,
    COLD_STORES_AND_CORRIDORS: dict.areaColdStoresAndCorridors,
    LOAD_OUT: dict.areaLoadOut,
    DRY_STORAGE_ROOMS: dict.areaDryStorageRooms,
  };
  return map[area];
}

function roleLabelFor(role: "PRODUCTION" | "MAINTENANCE", dict: CleaningModeDict): string {
  return role === "PRODUCTION" ? dict.roleHeadOfProduction : dict.roleHeadOfMaintenance;
}

// A thin colored edge alone read as barely-there on some displays/browsers
// (a 4px sliver next to a 1px gray border is easy to miss). Identity is now
// carried three ways at once -- tinted background, colored heading text, and
// a colored left rule -- all via ordinary same-specificity Tailwind classes
// (no directional-vs-shorthand conflict like the border-color bug this
// replaced, since every one of these classes is the only rule touching that
// property).
const ROLE_STYLE = {
  PRODUCTION: { box: "bg-sky-50 border-sky-300", heading: "text-sky-800", rule: "bg-sky-400" },
  MAINTENANCE: { box: "bg-violet-50 border-violet-300", heading: "text-violet-800", rule: "bg-violet-400" },
} as const;

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
  dict,
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
  dict: CleaningModeDict;
}) {
  const roleLabel = roleLabelFor(role, dict);
  const otherRoleLabel = roleLabelFor(role === "PRODUCTION" ? "MAINTENANCE" : "PRODUCTION", dict);
  const style = ROLE_STYLE[role];

  return (
    <div className={`rounded-md border-2 p-2 ${style.box}`}>
      <div className="flex items-center gap-2">
        <span className={`h-2.5 w-2.5 rounded-full ${style.rule}`} />
        <h5 className={`text-xs font-bold uppercase tracking-wide ${style.heading}`}>{roleLabel}</h5>
      </div>
      {!canScore ? (
        <p className="mt-1 text-xs text-slate-400">{dict.onlyRoleCanScore.replace("{role}", roleLabel)}</p>
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
                <span className="ms-2 text-xs text-slate-500">{signedAt?.toLocaleString()}</span>
              </p>
            ) : !complete ? (
              <p className="text-xs text-slate-400">{dict.scoreAllBeforeSignOff}</p>
            ) : (
              <SignOffForm
                action={signCleaningAction.bind(null, factoryId, date, shiftType, role)}
                confirmMessage={dict.signOffConfirm
                  .replace("{name}", currentUserLabel ?? "yourself")
                  .replace("{role}", roleLabel)
                  .replace("{otherRole}", otherRoleLabel)}
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
  dict,
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
  dict: CleaningModeDict;
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

      <table className="w-full text-start text-xs">
        <thead className="border-b border-slate-200 text-slate-500">
          <tr>
            <th className="py-1.5 pr-3 font-medium">{dict.colArea}</th>
            <th className="py-1.5 pr-3 font-medium">{dict.colProduction}</th>
            <th className="py-1.5 pr-3 font-medium">{dict.colMaintenance}</th>
          </tr>
        </thead>
        <tbody>
          {CLEANING_AREAS.map((area) => {
            const row = scores.find((s) => s.area === area);
            return (
              <tr key={area} className="border-b border-slate-100 last:border-0">
                <td className="py-1.5 pr-3 font-medium text-slate-800">{areaLabel(area, dict)}</td>
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
          <p className="mb-2 text-xs text-amber-700">{dict.locked}</p>
        ) : (
          <p className="mb-2 text-xs text-slate-500">{dict.scoreThenSignOff}</p>
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
            dict={dict}
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
            dict={dict}
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
