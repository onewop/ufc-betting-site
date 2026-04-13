/**
 * OptimizerStats.jsx — Generated teams display & fighter usage summary.
 *
 * Responsibilities:
 *   - Renders the list of generated 6-fighter teams with salary totals
 *   - Shows ownership tier + leverage labels per fighter in each team
 *   - Stacking validation indicators (✓ ok / ⚠ STACKING)
 *   - Fighter usage summary grid (appearances across all generated teams)
 *
 * Parent: TeamCombinations.jsx
 * Depends on: ../utils/optimizerHelpers.js for ownershipTier() and leverageLabel()
 */

import React from "react";
import { ownershipTier, leverageLabel } from "../utils/optimizerHelpers";

const OptimizerStats = ({
  randomTeams,
  numTeams,
  stackWarnings,
  fighterCounts,
}) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* ── Generated teams ──────────────────────────────────────────── */}
      <div className="bg-stone-900 border border-yellow-700/40 rounded-lg p-5">
        <h2 className="text-sm font-bold tracking-[0.4em] uppercase text-yellow-600 mb-4">
          ◈ GENERATED TEAMS
        </h2>
        {randomTeams.map((team, index) => (
          <div
            key={index}
            className="mb-4 pb-4 border-b border-stone-800 last:border-0"
          >
            <div className="flex items-center gap-2 mb-2">
              <h3 className="text-yellow-500 font-bold tracking-wider uppercase text-xs">
                TEAM {index + 1}
              </h3>
              {stackWarnings.includes(`Team ${index + 1}`) ? (
                <span className="text-[10px] text-red-400 font-bold">
                  ⚠ STACKING
                </span>
              ) : (
                <span className="text-[10px] text-green-500">
                  ✓ stacking ok
                </span>
              )}
            </div>
            <ul className="space-y-1">
              {team.map((f) => {
                const own = ownershipTier(f.salary);
                const lev = leverageLabel(f.salary, f.avgFPPG);
                return (
                  <li
                    key={f.id}
                    className="flex items-center justify-between text-sm gap-1"
                  >
                    <span className="text-stone-200 truncate">{f.name}</span>
                    <span className="flex items-center gap-1.5 shrink-0">
                      <span className={`text-[10px] font-bold ${own.color}`}>
                        {own.label}
                      </span>
                      <span className={`text-[10px] ${lev.color}`}>
                        {lev.label}
                      </span>
                      <span className="text-yellow-500/80">
                        ${f.salary.toLocaleString()}
                      </span>
                    </span>
                  </li>
                );
              })}
            </ul>
            <p className="text-stone-400 text-xs mt-2 tracking-wide">
              Total:{" "}
              <span className="text-yellow-400 font-bold">
                ${team.reduce((sum, f) => sum + f.salary, 0).toLocaleString()}
              </span>
            </p>
          </div>
        ))}
        {randomTeams.length > 0 && (
          <p className="text-center text-yellow-600 text-xs mt-4 tracking-widest uppercase">
            Generated {randomTeams.length} unique teams out of requested{" "}
            {numTeams}
          </p>
        )}
      </div>

      {/* ── Fighter usage summary ────────────────────────────────────── */}
      <div className="bg-stone-900 border border-yellow-700/40 rounded-lg p-5">
        <h2 className="text-sm font-bold tracking-[0.4em] uppercase text-yellow-600 mb-4">
          ◈ FIGHTER USAGE SUMMARY
        </h2>
        <ul className="grid grid-cols-1 gap-2">
          {Object.values(fighterCounts).map((fc) => (
            <li
              key={fc.name}
              className={`p-2 border border-stone-700 rounded text-sm ${
                fc.count === 0 ? "text-stone-600" : "text-stone-300"
              }`}
            >
              <span className="font-semibold">{fc.name}</span>:{" "}
              <span className={fc.count > 0 ? "text-yellow-400" : ""}>
                {fc.count ?? 0} teams
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default OptimizerStats;
