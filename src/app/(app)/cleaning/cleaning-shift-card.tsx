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

      {locked ? (
        <p className="mt-2 border-t border-slate-100 pt-2 text-xs text-amber-700">
          Locked — cleared for production by both Head of Production and Head of Maintenance. Reopen below to correct
          a score.
        </p>
      ) : (
        <>
          {canScoreProduction ? (
            <ScoreEntryForm factoryId={factoryId} date={date} shiftType={shiftType} role="PRODUCTION" scores={scores} />
          ) : (
            <p className="mt-2 border-t border-slate-100 pt-2 text-xs text-slate-400">
              Only the Owner or Head of Production can enter production scores.
            </p>
          )}
          {canScoreMaintenance ? (
            <ScoreEntryForm factoryId={factoryId} date={date} shiftType={shiftType} role="MAINTENANCE" scores={scores} />
          ) : (
            <p className="mt-2 border-t border-slate-100 pt-2 text-xs text-slate-400">
              Only the Owner or Head of Maintenance can enter maintenance scores.
            </p>
          )}
        </>
      )}

      <div className="mt-3 border-t border-slate-100 pt-3">
        <h5 className="text-xs font-semibold uppercase tracking-wide text-slate-700">Sign-off — Cleared for Production</h5>
        <p className="mt-0.5 text-xs text-slate-500">
          Approval that cleaning was done well and this area is cleared for production. The next shift can&apos;t be
          logged until both sign-offs are on file.
        </p>
        <div className="mt-2 grid grid-cols-2 gap-4">
          <div className="rounded-md border border-l-4 border-slate-200 border-l-sky-400 bg-slate-50/50 p-2">
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-600">Head of Production</p>
            {record?.productionSignedByName ? (
              <p className="text-sm text-slate-800">
                {record.productionSignedByName}
                <span className="ml-2 text-xs text-slate-500">{record.productionSignedAt?.toLocaleString()}</span>
              </p>
            ) : !canScoreProduction ? (
              <p className="text-xs text-slate-400">Waiting on Head of Production.</p>
            ) : !productionComplete ? (
              <p className="text-xs text-slate-400">Score every area above before signing off.</p>
            ) : (
              <SignOffForm
                action={signCleaningAction.bind(null, factoryId, date, shiftType, "PRODUCTION")}
                confirmMessage={`Confirm as ${
                  currentUserLabel ?? "yourself"
                }, Head of Production: cleaning was done well and this area is cleared for production. This locks the record once Maintenance also signs off.`}
              />
            )}
          </div>
          <div className="rounded-md border border-l-4 border-slate-200 border-l-violet-400 bg-slate-50/50 p-2">
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-600">Head of Maintenance</p>
            {record?.maintenanceSignedByName ? (
              <p className="text-sm text-slate-800">
                {record.maintenanceSignedByName}
                <span className="ml-2 text-xs text-slate-500">{record.maintenanceSignedAt?.toLocaleString()}</span>
              </p>
            ) : !canScoreMaintenance ? (
              <p className="text-xs text-slate-400">Waiting on Head of Maintenance.</p>
            ) : !maintenanceComplete ? (
              <p className="text-xs text-slate-400">Score every area above before signing off.</p>
            ) : (
              <SignOffForm
                action={signCleaningAction.bind(null, factoryId, date, shiftType, "MAINTENANCE")}
                confirmMessage={`Confirm as ${
                  currentUserLabel ?? "yourself"
                }, Head of Maintenance: cleaning was done well and this area is cleared for production. This locks the record once Production also signs off.`}
              />
            )}
          </div>
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
