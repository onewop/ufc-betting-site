import React, { useState, useEffect } from "react";

const comb = (n, k) => {
  if (k < 0 || k > n) return 0n;
  let res = 1n;
  for (let i = 1; i <= k; i++) {
    res = (res * BigInt(n - k + i)) / BigInt(i);
  }
  return res;
};

// ── Ownership tier (salary-based approximation) ─────────────────────────
const ownershipTier = (salary) => {
  if (salary >= 8500) return { label: "HIGH", color: "text-red-400" };
  if (salary >= 7000) return { label: "MED", color: "text-yellow-400" };
  return { label: "LOW", color: "text-green-400" };
};

// ── Leverage score (low ownership + decent projection = GPP edge) ─────────
const leverageLabel = (salary, avgFPPG = 0) => {
  const own = ownershipTier(salary);
  if (own.label === "LOW" && avgFPPG >= 18)
    return { label: "⚡ LEVERAGE", color: "text-green-400" };
  if (own.label === "LOW") return { label: "VALUE", color: "text-green-300" };
  if (own.label === "HIGH" && avgFPPG >= 24)
    return { label: "CEILING", color: "text-orange-400" };
  if (own.label === "HIGH") return { label: "CHALK", color: "text-red-400" };
  return { label: "NEUTRAL", color: "text-stone-400" };
};

const TeamCombinations = ({ eventTitle = "Latest UFC Event", currentUser }) => {
  const [fighters, setFighters] = useState([]);
  const numFights = [...new Set(fighters.map((f) => f.fight_id))].length;
  const totalPossibleTeams = 2n ** BigInt(numFights) * comb(numFights, 6);
  const [randomTeams, setRandomTeams] = useState([]);
  const [fighterCounts, setFighterCounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [numTeams, setNumTeams] = useState(5);
  const [fighterLimits, setFighterLimits] = useState({});
  const [searchTerm, setSearchTerm] = useState("");
  const [generatedCount, setGeneratedCount] = useState(0);
  const [stackWarnings, setStackWarnings] = useState([]);
  const [generating, setGenerating] = useState(false);
  const [useSalaryTarget, setUseSalaryTarget] = useState(false);
  const [salaryMode, setSalaryMode] = useState("diverse");
  const [saveStatus, setSaveStatus] = useState(null); // null | "saving" | "saved" | "error"

  // Paywall check — driven by prop from App.jsx
  const isPro = currentUser?.subscription_status === "pro";

  const handleUpgrade = async () => {
    const token = localStorage.getItem("authToken");
    if (!token) return;
    try {
      const res = await fetch(
        "http://localhost:8000/api/create-checkout-session",
        {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (err) {
      console.error("Upgrade error:", err);
    }
  };

  if (!isPro) {
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

        <div className="max-w-4xl mx-auto px-4 py-8 md:py-10 text-center">
          <h1 className="text-3xl md:text-5xl font-black text-stone-100 tracking-wider uppercase mb-4">
            UPGRADE TO PRO
          </h1>
          <p className="text-stone-400 mb-6">
            Unlock the full DFS optimizer and generate unlimited lineups.
          </p>
          <button
            onClick={handleUpgrade}
            className="bg-green-600 hover:bg-green-500 text-white font-bold py-3 px-6 rounded-lg transition"
          >
            Upgrade to Pro - $19.99/month
          </button>
        </div>
      </div>
    );
  }

  useEffect(() => {
    fetch("http://localhost:8000/api/fighters")
      .then((res) => {
        if (!res.ok) throw new Error(`Server error ${res.status}`);
        return res.json();
      })
      .then((data) => {
        const realFighters = data.fighters;
        setFighters(realFighters);
        const initialLimits = {};
        realFighters.forEach((f) => {
          initialLimits[f.id] = { min: 0, max: Infinity };
        });
        setFighterLimits(initialLimits);
        setLoading(false);
      })
      .catch((err) => {
        setError(
          `Failed to load fighter data: ${err.message}. Is the optimizer server running? Start it with: uvicorn backend.main:app --reload --port 8000`,
        );
        setLoading(false);
        console.error("Error loading fighters:", err);
      });
  }, []);

  const handleLimitChange = (fighterId, type, value) => {
    const parsedValue = parseInt(value);
    setFighterLimits((prev) => ({
      ...prev,
      [fighterId]: {
        ...prev[fighterId],
        [type]: isNaN(parsedValue)
          ? type === "min"
            ? 0
            : Infinity
          : parsedValue,
      },
    }));
  };

  const generateTeamsWithConstraints = async () => {
    setError(null);
    setRandomTeams([]);
    setFighterCounts({});
    setGenerating(true);

    try {
      if (numFights < 6) {
        setError(
          "Not enough fights on the card to build teams (need at least 6).",
        );
        return;
      }

      // Build excluded + locked lists from per-fighter limits
      const excludedIds = Object.entries(fighterLimits)
        .filter(([, { max }]) => max === 0)
        .map(([id]) => String(id));
      const lockedIds = Object.entries(fighterLimits)
        .filter(([, { min }]) => min >= numTeams)
        .map(([id]) => String(id));

      const response = await fetch("http://localhost:8000/api/optimize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          num_lineups: numTeams,
          salary_mode: salaryMode,
          locked_fighters: lockedIds,
          excluded_fighters: excludedIds,
          exposure_limit: 1.0,
        }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.detail || `Server error ${response.status}`);
      }

      const data = await response.json();
      // data.lineups is [{fighters: [...], total_salary, projected_fpts}, ...]
      // Guard against unexpected shapes (e.g. backend returning a bare array).
      const rawLineups = Array.isArray(data.lineups)
        ? data.lineups
        : Array.isArray(data)
          ? data
          : [];
      const selectedTeams = rawLineups
        .map((l) => (Array.isArray(l.fighters) ? l.fighters : l))
        .filter((team) => Array.isArray(team));

      if (selectedTeams.length === 0) {
        setError(
          "No valid teams could be generated. Try removing exclusions or reducing the number of teams.",
        );
        return;
      }

      // Compute per-fighter appearance counts for the exposure table
      const finalCounts = {};
      fighters.forEach((f) => {
        finalCounts[f.id] = { name: f.name, count: 0 };
      });
      selectedTeams.forEach((team) =>
        team.forEach((f) => {
          if (finalCounts[f.id]) finalCounts[f.id].count++;
          else finalCounts[f.id] = { name: f.name, count: 1 };
        }),
      );

      if (selectedTeams.length < numTeams) {
        setError(
          `Only ${selectedTeams.length} unique teams could be generated.`,
        );
      }

      setRandomTeams(selectedTeams);
      setFighterCounts(finalCounts);
      setGeneratedCount(selectedTeams.length);
      setStackWarnings([]); // backend enforces one-per-fight
    } catch (err) {
      setError(
        `Failed to generate lineups: ${err.message}. Is the optimizer server running? Start it with: uvicorn backend.main:app --reload --port 8000`,
      );
    } finally {
      setGenerating(false);
    }
  };

  const downloadCSV = () => {
    if (randomTeams.length === 0) return;

    const skipped = [];
    const lineupRows = [];

    for (let i = 0; i < randomTeams.length; i++) {
      const team = randomTeams[i];
      if (team.length !== 6) {
        skipped.push(`Lineup ${i + 1}: only ${team.length} fighters (need 6)`);
        continue;
      }
      // f.id is already the DK numeric player ID (set from dk_id in this_weeks_stats.json)
      lineupRows.push(team.map((f) => f.id));
    }

    if (skipped.length > 0) {
      alert(
        `Warning — ${skipped.length} lineup(s) skipped:\n\n${skipped.join("\n")}`,
      );
    }
    if (lineupRows.length === 0) {
      alert("No valid lineups to export.");
      return;
    }

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

    // application/octet-stream forces download instead of opening in LibreOffice
    const csvBlob = new Blob([csvRows.join("\r\n")], {
      type: "application/octet-stream",
    });
    const url = URL.createObjectURL(csvBlob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `dk-ufc-lineups-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const saveLineups = async () => {
    const token = localStorage.getItem("authToken");
    if (!token) {
      setError("You must be logged in to save lineups.");
      return;
    }
    if (randomTeams.length === 0) return;

    const defaultName = `My Lineup Set – ${new Date().toLocaleDateString()}`;
    const name = window.prompt(
      "Enter a name for this lineup set:",
      defaultName,
    );
    if (!name) return;

    setSaveStatus("saving");
    const avgSalary = Math.round(
      randomTeams.reduce(
        (s, team) => s + team.reduce((sum, f) => sum + f.salary, 0),
        0,
      ) / randomTeams.length,
    );
    const avgFpts = parseFloat(
      (
        randomTeams.reduce(
          (s, team) => s + team.reduce((sum, f) => sum + (f.avgFPPG || 0), 0),
          0,
        ) / randomTeams.length
      ).toFixed(2),
    );

    try {
      const res = await fetch("http://localhost:8000/api/lineups", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name,
          lineup_data: randomTeams,
          total_salary: avgSalary,
          projected_fpts: avgFpts,
          salary_mode: salaryMode,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || `Error ${res.status}`);
      }
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus(null), 3000);
    } catch (err) {
      setSaveStatus(null);
      setError(`Failed to save lineup: ${err.message}`);
    }
  };

  const filteredFighters = fighters.filter((f) =>
    f.name.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  if (loading)
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
        {error && (
          <div className="text-center text-red-400 mb-4 p-3 border border-red-900/60 rounded bg-red-950/30">
            {error}
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
          Card has {numFights} fights • Theoretical max teams (no salary cap):{" "}
          {totalPossibleTeams.toLocaleString()}
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
        <div className="flex flex-col md:flex-row gap-6 mb-8">
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
              onClick={generateTeamsWithConstraints}
              disabled={generating}
              className="w-full py-3 px-6 rounded-lg font-bold tracking-widest uppercase text-sm transition duration-300 hover:scale-105 bg-gradient-to-r from-yellow-700 to-yellow-600 text-stone-950 shadow-lg border border-yellow-600 disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:scale-100"
            >
              {generating ? "Generating…" : "Generate"}
            </button>
            <button
              onClick={generateTeamsWithConstraints}
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
                      (s, team) =>
                        s + team.reduce((sum, f) => sum + f.salary, 0),
                      0,
                    ) / randomTeams.length,
                  ).toLocaleString()}
                </p>
              </div>
            )}
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                        <span className="text-stone-200 truncate">
                          {f.name}
                        </span>
                        <span className="flex items-center gap-1.5 shrink-0">
                          <span
                            className={`text-[10px] font-bold ${own.color}`}
                          >
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
                    $
                    {team
                      .reduce((sum, f) => sum + f.salary, 0)
                      .toLocaleString()}
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
      </div>
    </div>
  );
};

export default TeamCombinations;
