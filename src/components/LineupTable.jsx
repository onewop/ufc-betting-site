/**
 * LineupTable.jsx — Fighter limits table for the DFS optimizer.
 *
 * Responsibilities:
 *   - Search input to filter fighters by name
 *   - Mobile-friendly collapsible card layout (< md breakpoint)
 *   - Desktop scrollable table with columns: Name, Salary, Own, Leverage, Min, Max
 *   - Per-fighter min/max exposure limit inputs
 *
 * Parent: TeamCombinations.jsx
 * Depends on: ../utils/optimizerHelpers.js for ownershipTier() and leverageLabel()
 */

import React from "react";
import { ownershipTier, leverageLabel } from "../utils/optimizerHelpers";

const LineupTable = ({
  filteredFighters,
  fighterLimits,
  handleLimitChange,
  searchTerm,
  setSearchTerm,
}) => {
  return (
    <div className="md:w-2/3">
      <h2 className="text-sm font-bold tracking-[0.4em] uppercase text-yellow-600 mb-3">
        ◈ FIGHTER LIMITS
      </h2>
      <input
        type="text"
        placeholder="Search fighters..."
        className="w-full p-2 mb-4 bg-stone-900 text-stone-100 border border-yellow-700/40 rounded"
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
      />

      {/* ── Mobile: collapsible card layout ──────────────────────────── */}
      <details
        className="md:hidden mb-3 border border-yellow-700/30 rounded bg-stone-900/70"
        open={false}
      >
        <summary
          className="px-3 py-2 text-xs tracking-widest uppercase text-yellow-500"
          aria-label="Toggle fighter limits list"
        >
          Show Fighter Limits ({filteredFighters.length})
        </summary>
        <div className="max-h-96 overflow-y-auto space-y-2 p-3 border-t border-stone-700">
          {filteredFighters.map((fighter, idx) => (
            <article
              key={`mobile-limit-${fighter.id}`}
              className="mobile-data-card"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-stone-100 leading-snug">
                    {fighter.name}
                  </p>
                  <p className="text-xs text-yellow-500 mt-0.5">
                    ${fighter.salary}
                  </p>
                </div>
                <span className="text-[10px] text-stone-500 uppercase tracking-wider">
                  #{idx + 1}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 mt-3">
                <label className="text-[11px] text-stone-500 uppercase tracking-wide">
                  Min
                  <input
                    type="number"
                    value={fighterLimits[fighter.id]?.min || ""}
                    onChange={(e) =>
                      handleLimitChange(fighter.id, "min", e.target.value)
                    }
                    className="w-full mt-1 h-10 bg-stone-800 text-stone-100 border border-stone-600 rounded text-center"
                    min="0"
                  />
                </label>
                <label className="text-[11px] text-stone-500 uppercase tracking-wide">
                  Max
                  <input
                    type="number"
                    value={
                      fighterLimits[fighter.id]?.max === Infinity
                        ? ""
                        : fighterLimits[fighter.id]?.max
                    }
                    onChange={(e) =>
                      handleLimitChange(fighter.id, "max", e.target.value)
                    }
                    className="w-full mt-1 h-10 bg-stone-800 text-stone-100 border border-stone-600 rounded text-center"
                    min="0"
                  />
                </label>
              </div>
            </article>
          ))}
        </div>
      </details>

      {/* ── Desktop: scrollable table ────────────────────────────────── */}
      <div className="hidden md:block overflow-x-auto overflow-y-auto h-96 border border-yellow-700/30 rounded">
        <table className="w-full text-left text-stone-300">
          <thead className="sticky top-0 bg-stone-800">
            <tr>
              <th className="p-2 text-stone-400 text-xs tracking-wider uppercase">
                Name
              </th>
              <th className="p-2 text-stone-400 text-xs tracking-wider uppercase">
                Salary
              </th>
              <th className="p-2 text-stone-400 text-xs tracking-wider uppercase">
                Own
              </th>
              <th className="p-2 text-stone-400 text-xs tracking-wider uppercase">
                Leverage
              </th>
              <th className="p-2 text-stone-400 text-xs tracking-wider uppercase">
                Min
              </th>
              <th className="p-2 text-stone-400 text-xs tracking-wider uppercase">
                Max
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredFighters.map((fighter) => (
              <tr
                key={fighter.id}
                className="border-b border-stone-800 hover:bg-stone-900/60 transition"
              >
                <td className="p-2 text-stone-200">{fighter.name}</td>
                <td className="p-2 text-yellow-500 text-sm">
                  ${fighter.salary}
                </td>
                <td
                  className={`p-2 text-xs font-bold ${ownershipTier(fighter.salary).color}`}
                >
                  {ownershipTier(fighter.salary).label}
                </td>
                <td
                  className={`p-2 text-xs font-bold ${leverageLabel(fighter.salary, fighter.avgFPPG).color}`}
                >
                  {leverageLabel(fighter.salary, fighter.avgFPPG).label}
                </td>
                <td className="p-2">
                  <input
                    type="number"
                    value={fighterLimits[fighter.id]?.min || ""}
                    onChange={(e) =>
                      handleLimitChange(fighter.id, "min", e.target.value)
                    }
                    className="w-14 h-9 bg-stone-800 text-stone-100 border border-stone-600 rounded text-center"
                    min="0"
                  />
                </td>
                <td className="p-2">
                  <input
                    type="number"
                    value={
                      fighterLimits[fighter.id]?.max === Infinity
                        ? ""
                        : fighterLimits[fighter.id]?.max
                    }
                    onChange={(e) =>
                      handleLimitChange(fighter.id, "max", e.target.value)
                    }
                    className="w-14 h-9 bg-stone-800 text-stone-100 border border-stone-600 rounded text-center"
                    min="0"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default LineupTable;
