/**
 * OptimizerControls.jsx — Control panel for the DFS lineup optimizer.
 *
 * Responsibilities:
 *   - Number-of-teams input
 *   - Salary mode radio buttons (aggressive / higher / diverse)
 *   - Generate / Regenerate buttons
 *   - Download CSV & Save Lineup buttons (shown after generation)
 *   - Quick generation stats (count + average salary)
 *
 * Parent: TeamCombinations.jsx
 * Receives all state & actions from the useOptimizer hook via props.
 */

import React from "react";

const OptimizerControls = ({
  numTeams,
  setNumTeams,
  useSalaryTarget,
  setUseSalaryTarget,
  salaryMode,
  setSalaryMode,
  generating,
  generateTeams,
  randomTeams,
  downloadCSV,
  saveLineups,
  saveStatus,
  generatedCount,
}) => {
  return (
    <div className="md:w-1/3 bg-stone-900 border border-yellow-700/40 rounded-lg p-5">
      <h2 className="text-sm font-bold tracking-[0.4em] uppercase text-yellow-600 mb-4">
        ◈ GENERATE TEAMS
      </h2>
      <label className="block text-stone-400 text-xs tracking-wider uppercase mb-2">
        Number of Teams:
      </label>
      <input
        type="number"
        value={numTeams}
        onChange={(e) => setNumTeams(parseInt(e.target.value) || 5)}
        className="w-full p-2 mb-4 bg-stone-800 text-stone-100 border border-stone-600 rounded"
        min="1"
        max="50"
      />
      <label className="block text-stone-400 text-xs tracking-wider uppercase mb-2">
        Salary Targeting:
      </label>
      <label className="flex items-center mb-2">
        <input
          type="checkbox"
          checked={useSalaryTarget}
          onChange={(e) => setUseSalaryTarget(e.target.checked)}
          className="mr-2"
        />
        Use Salary Target
      </label>
      {useSalaryTarget && (
        <div className="mb-4 space-y-2">
          <label className="flex items-center">
            <input
              type="radio"
              name="salaryMode"
              value="higher"
              checked={salaryMode === "higher"}
              onChange={(e) => setSalaryMode(e.target.value)}
              className="mr-2"
            />
            Aggressive / Max Salary (avg ~$49.2k–$50k)
          </label>
          <label className="flex items-center">
            <input
              type="radio"
              name="salaryMode"
              value="medium"
              checked={salaryMode === "medium"}
              onChange={(e) => setSalaryMode(e.target.value)}
              className="mr-2"
            />
            Higher Salaries (avg ~$48.5k–$49.2k)
          </label>
          <label className="flex items-center">
            <input
              type="radio"
              name="salaryMode"
              value="diverse"
              checked={salaryMode === "diverse"}
              onChange={(e) => setSalaryMode(e.target.value)}
              className="mr-2"
            />
            Balanced / Default (avg ~$47.5k–$48.5k)
          </label>
        </div>
      )}
      <button
        onClick={generateTeams}
        disabled={generating}
        className="w-full py-3 px-6 rounded-lg font-bold tracking-widest uppercase text-sm transition duration-300 hover:scale-105 bg-gradient-to-r from-yellow-700 to-yellow-600 text-stone-950 shadow-lg border border-yellow-600 disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:scale-100"
      >
        {generating ? "Generating…" : "Generate"}
      </button>
      <button
        onClick={generateTeams}
        disabled={generating}
        className="w-full mt-3 py-3 px-6 rounded-lg font-bold tracking-widest uppercase text-sm transition duration-300 hover:scale-105 bg-stone-800 hover:bg-stone-700 text-yellow-400 border border-yellow-700/50 shadow-lg disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:scale-100"
      >
        {generating ? "Generating…" : "Regenerate Teams"}
      </button>
      {randomTeams.length > 0 && (
        <button onClick={downloadCSV} className="neon-button w-full mt-4">
          Download CSV
        </button>
      )}
      {randomTeams.length > 0 && (
        <button
          onClick={saveLineups}
          disabled={saveStatus === "saving"}
          className="neon-button w-full mt-2 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {saveStatus === "saving"
            ? "Saving…"
            : saveStatus === "saved"
              ? "✓ Saved!"
              : "Save Lineup"}
        </button>
      )}
      {generatedCount > 0 && (
        <div className="bg-stone-800 rounded p-4 mt-4">
          <p>
            Generated {generatedCount} of {numTeams} teams
          </p>
          <p>
            Average Salary: $
            {Math.round(
              randomTeams.reduce(
                (s, team) => s + team.reduce((sum, f) => sum + f.salary, 0),
                0,
              ) / randomTeams.length,
            ).toLocaleString()}
          </p>
        </div>
      )}
    </div>
  );
};

export default OptimizerControls;
