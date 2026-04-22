/**
 * TeamCombinations.jsx — Main container page for the DFS lineup optimizer.
 *
 * Responsibilities:
 *   - Pro/free paywall gate (renders upgrade CTA for non-Pro users)
 *   - Page-level layout, header, disclaimers, and classification banner
 *   - Composes sub-components: LineupTable, OptimizerControls, OptimizerStats
 *   - Delegates all state & logic to the useOptimizer custom hook
 *
 * Sub-components:
 *   - OptimizerControls.jsx  → team count, salary mode, generate/save buttons
 *   - LineupTable.jsx         → fighter limits table with search
 *   - OptimizerStats.jsx      → generated teams display + fighter usage summary
 *
 * Hook: ../hooks/useOptimizer.js  → all optimizer state, API calls, CSV export
 * Utils: ../utils/optimizerHelpers.js → pure helper functions (comb, tiers, CSV builder)
 */

import React from "react";
import useOptimizer from "../hooks/useOptimizer";
import { isPro as checkIsPro } from "../utils/devAccess";
import OptimizerControls from "./OptimizerControls";
import LineupTable from "./LineupTable";
import OptimizerStats from "./OptimizerStats";

const TeamCombinations = ({ eventTitle = "Latest UFC Event", currentUser }) => {
  const opt = useOptimizer();
  const isPro = checkIsPro(currentUser);

  if (!isPro) {
    return (
      <div
        className="min-h-screen bg-stone-950"
        style={{ fontFamily: "'Courier New', monospace" }}
      >
        <div className="flex items-center justify-between border-b border-yellow-700/40 bg-yellow-900/10 px-6 py-2">
          <span className="text-yellow-500 text-xs font-bold tracking-widest uppercase">
            ⚡ CLASSIFIED OPS
          </span>
          <span className="text-yellow-500/50 text-xs tracking-wider hidden sm:block">
            CLEARANCE: LEVEL 5
          </span>
          <span className="text-yellow-500 text-xs font-bold tracking-widest uppercase">
            DFS COMMAND ⚡
          </span>
        </div>

        <div className="max-w-4xl mx-auto px-4 py-8 md:py-10 text-center">
          <h1 className="text-3xl md:text-5xl font-black text-stone-100 tracking-wider uppercase mb-4">
            UPGRADE TO PRO
          </h1>
          <p className="text-stone-400 mb-6">
            Unlock the full DFS optimizer and generate unlimited lineups.
          </p>
          <button
            onClick={opt.handleUpgrade}
            className="bg-green-600 hover:bg-green-500 text-white font-bold py-3 px-6 rounded-lg transition"
          >
            Upgrade to Pro - $19.99/month
          </button>
        </div>
      </div>
    );
  }

  if (opt.loading)
    return (
      <div
        className="min-h-screen bg-stone-950 flex items-center justify-center"
        style={{ fontFamily: "'Courier New', monospace" }}
      >
        <p className="text-stone-500 tracking-widest animate-pulse uppercase text-sm">
          Loading…
        </p>
      </div>
    );

  return (
    <div
      className="min-h-screen bg-stone-950"
      style={{ fontFamily: "'Courier New', monospace" }}
    >
      {/* Classification banner */}
      <div className="flex items-center justify-between border-b border-yellow-700/40 bg-yellow-900/10 px-6 py-2">
        <span className="text-yellow-500 text-xs font-bold tracking-widest uppercase">
          ⚡ CLASSIFIED OPS
        </span>
        <span className="text-yellow-500/50 text-xs tracking-wider hidden sm:block">
          CLEARANCE: LEVEL 5
        </span>
        <span className="text-yellow-500 text-xs font-bold tracking-widest uppercase">
          DFS COMMAND ⚡
        </span>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-4 md:py-10">
        {opt.error && (
          <div className="text-center text-red-400 mb-4 p-3 border border-red-900/60 rounded bg-red-950/30">
            {opt.error}
          </div>
        )}

        {/* Page header */}
        <div className="text-center mb-8">
          <p className="text-xs text-stone-500 tracking-[0.5em] uppercase mb-2">
            ◆ OPERATION COMBAT VAULT — DFS DIVISION ◆
          </p>
          <h1
            className="text-3xl md:text-5xl font-black text-stone-100 tracking-wider uppercase"
            style={{
              fontFamily: "'Impact', sans-serif",
              textShadow: "2px 2px 0 #4a5240, 0 0 40px rgba(100,120,80,0.3)",
            }}
          >
            DFS TEAM <span className="text-yellow-600">COMBINATIONS</span>
          </h1>
          <p className="text-stone-400 mt-2 text-sm tracking-wide">
            {eventTitle}
          </p>
          <div className="w-32 h-px bg-gradient-to-r from-transparent via-yellow-700 to-transparent mx-auto mt-3" />
        </div>

        <p className="text-center text-yellow-500 text-sm mb-2 tracking-wide">
          Card has {opt.numFights} fights • Theoretical max teams (no salary
          cap): {opt.totalPossibleTeams.toLocaleString()}
        </p>
        <p className="text-stone-500 mb-6 text-center text-xs tracking-wide">
          <strong className="text-red-400">Warning:</strong> For entertainment
          only. DFS is 21+. Call 1-800-GAMBLER for help. [YourSite] not liable
          for losses.
        </p>
        <p className="text-stone-400 mb-6 text-center text-sm tracking-wide">
          Max 6 fighters per team, $50,000 salary cap, one fighter per fight.
        </p>
        <p className="text-stone-600 mb-6 text-center text-xs tracking-wide border border-stone-800 rounded py-2 px-4 max-w-xl mx-auto">
          ℹ️ Basic optimizer with diversity balancing, exposure limits, and
          stacking validation. For Monte Carlo sims and live ownership data, see{" "}
          <a
            href="https://www.saberism.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-stone-400 underline"
          >
            SaberSim
          </a>
          {" / "}
          <a
            href="https://www.fantasylabs.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-stone-400 underline"
          >
            FantasyLabs
          </a>
          .
        </p>

        {/* ── Fighter limits + controls ────────────────────── */}
        <div className="flex flex-col md:flex-row gap-6 mb-8">
          <LineupTable
            filteredFighters={opt.filteredFighters}
            fighterLimits={opt.fighterLimits}
            handleLimitChange={opt.handleLimitChange}
            searchTerm={opt.searchTerm}
            setSearchTerm={opt.setSearchTerm}
          />
          <OptimizerControls
            numTeams={opt.numTeams}
            setNumTeams={opt.setNumTeams}
            useSalaryTarget={opt.useSalaryTarget}
            setUseSalaryTarget={opt.setUseSalaryTarget}
            salaryMode={opt.salaryMode}
            setSalaryMode={opt.setSalaryMode}
            generating={opt.generating}
            generateTeams={opt.generateTeams}
            randomTeams={opt.randomTeams}
            downloadCSV={opt.downloadCSV}
            saveLineups={opt.saveLineups}
            saveStatus={opt.saveStatus}
            generatedCount={opt.generatedCount}
          />
        </div>

        {/* ── Generated teams + usage summary ──────────────── */}
        <OptimizerStats
          randomTeams={opt.randomTeams}
          numTeams={opt.numTeams}
          stackWarnings={opt.stackWarnings}
          fighterCounts={opt.fighterCounts}
        />
      </div>
    </div>
  );
};

export default TeamCombinations;
