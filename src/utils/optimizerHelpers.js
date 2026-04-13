/**
 * optimizerHelpers.js — Pure helper functions for the DFS lineup optimizer.
 *
 * Responsibilities:
 *   - Combinatorics math (comb)
 *   - Ownership tier classification by salary
 *   - Leverage / GPP-edge labelling
 *   - DraftKings CSV export formatting
 *
 * No React imports — these are plain JS utilities shared by useOptimizer
 * hook, OptimizerControls, LineupTable, and OptimizerStats components.
 */

/** BigInt-safe "n choose k". */
export const comb = (n, k) => {
  if (k < 0 || k > n) return 0n;
  let res = 1n;
  for (let i = 1; i <= k; i++) {
    res = (res * BigInt(n - k + i)) / BigInt(i);
  }
  return res;
};

/** Salary-based ownership tier (HIGH / MED / LOW). */
export const ownershipTier = (salary) => {
  if (salary >= 8500) return { label: "HIGH", color: "text-red-400" };
  if (salary >= 7000) return { label: "MED", color: "text-yellow-400" };
  return { label: "LOW", color: "text-green-400" };
};

/** Leverage label — low ownership + decent projection = GPP edge. */
export const leverageLabel = (salary, avgFPPG = 0) => {
  const own = ownershipTier(salary);
  if (own.label === "LOW" && avgFPPG >= 18)
    return { label: "⚡ LEVERAGE", color: "text-green-400" };
  if (own.label === "LOW") return { label: "VALUE", color: "text-green-300" };
  if (own.label === "HIGH" && avgFPPG >= 24)
    return { label: "CEILING", color: "text-orange-400" };
  if (own.label === "HIGH") return { label: "CHALK", color: "text-red-400" };
  return { label: "NEUTRAL", color: "text-stone-400" };
};

/**
 * Build a DraftKings-compatible CSV blob from generated lineups.
 * Returns { blob, filename, skipped } or null if nothing to export.
 */
export const buildDraftKingsCSV = (randomTeams, fighters) => {
  if (randomTeams.length === 0) return null;

  const skipped = [];
  const lineupRows = [];

  for (let i = 0; i < randomTeams.length; i++) {
    const team = randomTeams[i];
    if (team.length !== 6) {
      skipped.push(`Lineup ${i + 1}: only ${team.length} fighters (need 6)`);
      continue;
    }
    lineupRows.push(team.map((f) => f.id));
  }

  if (lineupRows.length === 0) return null;

  const INSTRUCTIONS = [
    "1. Locate the player you want to select in the list below",
    "2. Copy the ID of your player (you can use the Name + ID column or the ID column)",
    "3. Paste the ID into the roster position desired",
    "4. You must include an ID for each player; you cannot use just the player's name",
    "5. You can create up to 500 lineups per file",
  ];

  const rightSide = [
    ...INSTRUCTIONS,
    "",
    "Position,Name + ID,Name,ID,Roster Position,Salary,Game Info,TeamAbbrev,AvgPointsPerGame",
    ...fighters.map(
      (f) => `F,${f.name} (${f.id}),${f.name},${f.id},F,${f.salary},,, `,
    ),
  ];

  const csvRows = ["F,F,F,F,F,F,,Instructions"];
  const totalRows = Math.max(lineupRows.length, rightSide.length);
  for (let i = 0; i < totalRows; i++) {
    const left = lineupRows[i] ? lineupRows[i].join(",") : ",,,,,";
    const right = rightSide[i] !== undefined ? rightSide[i] : "";
    csvRows.push(`${left},,${right}`);
  }

  const blob = new Blob([csvRows.join("\r\n")], {
    type: "application/octet-stream",
  });
  const filename = `dk-ufc-lineups-${new Date().toISOString().slice(0, 10)}.csv`;

  return { blob, filename, skipped };
};
