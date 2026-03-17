import React, { useState, useEffect } from "react";

const comb = (n, k) => {
  if (k < 0 || k > n) return 0n;
  let res = 1n;
  for (let i = 1; i <= k; i++) {
    res = (res * BigInt(n - k + i)) / BigInt(i);
  }
  return res;
};

const TeamCombinations = ({ eventTitle = "Latest UFC Event" }) => {
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
  const userSeed = Date.now() + Math.random() * 10000;

  useEffect(() => {
    fetch("/this_weeks_stats.json")
      .then((res) => res.json())
      .then((data) => {
        const realFighters = [];
        data.fights.forEach((fight) => {
          fight.fighters.forEach((f) => {
            realFighters.push({
              id: f.dk_id,
              name: f.name,
              salary: f.salary,
              fight_id: fight.fight_id,
            });
          });
        });
        setFighters(realFighters);
        const initialLimits = {};
        realFighters.forEach((f) => {
          initialLimits[f.id] = { min: 0, max: Infinity };
        });
        setFighterLimits(initialLimits);
        setLoading(false);
      })
      .catch((err) => {
        setError("Failed to load fighter data. Please try again.");
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

  const generateTeamsWithConstraints = () => {
    setError(null);
    setRandomTeams([]);
    setFighterCounts({});

    if (numFights < 6) {
      setError(
        "Not enough fights on the card to build teams (need at least 6).",
      );
      return;
    }

    // Build the set of excluded fighter IDs (max === 0)
    const excludedIds = new Set(
      Object.entries(fighterLimits)
        .filter(([, { max }]) => max === 0)
        .map(([id]) => id), // keep as string to match f.id (dk_id strings)
    );

    // Group fighters by fight_id, filtering out excluded fighters.
    // If a fight has no available fighters after exclusions, skip it entirely.
    const fightGroupMap = {};
    fighters.forEach((f) => {
      if (!fightGroupMap[f.fight_id]) fightGroupMap[f.fight_id] = [];
      if (!excludedIds.has(String(f.id))) fightGroupMap[f.fight_id].push(f);
    });
    const availableFights = Object.values(fightGroupMap).filter(
      (fg) => fg.length > 0,
    );

    console.log(
      `Available fights after exclusions: ${availableFights.length} (one-per-fight enforced by design)`,
    );

    if (availableFights.length < 6) {
      setError(
        `Not enough available fights after exclusions (need 6, have ${availableFights.length}). Remove some exclusions.`,
      );
      return;
    }

    // Live usage tracker — updated as teams are accepted
    const usageCounts = {}; // id -> count
    fighters.forEach((f) => {
      usageCounts[f.id] = 0;
    });

    // Seeded shuffle — userSeed is unique per render/visitor
    const seededShuffle = (array) => {
      let s = userSeed;
      const seededRandom = () => {
        s = Math.sin(s) * 10000;
        return s - Math.floor(s);
      };
      for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(seededRandom() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
      }
      return array;
    };

    // Build one diversity-aware candidate team:
    // 1. Fisher-Yates shuffle fights with Math.random() on every call — seededShuffle
    //    uses a fixed userSeed so all calls within one run produce the same order.
    // 2. Sort the full candidate pool by average current usage of their two fighters
    //    (prefer under-used fights).
    // 3. Pick the fighter with lower current usage per fight (random tie-break).
    const shuffleFresh = (arr) => {
      const a = [...arr];
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
      }
      return a;
    };

    // Build one diversity-aware candidate team that fits the salary cap.
    // teamsRemaining: how many more teams still need to be generated.
    //
    // Step 1: Force-include fights that contain a fighter with an unmet min.
    //   A fighter's "shortfall" is max(0, min - currentCount).
    //   A fight is "urgent" if any fighter in it has shortfall > 0 AND
    //   urgency (shortfall / teamsRemaining) >= 1, meaning we MUST include
    //   them in every remaining team to hit the target. If shortfall > 0 we
    //   also bias toward including those fights.
    // Step 2: Fill remaining slots with random fights (shuffled).
    // Step 3: Within each fight, pick the fighter with the lowest composite
    //   score (salary + usage*600 - urgencyBonus), giving min-required fighters
    //   priority within their slot.
    const buildTeam = (teamsRemaining) => {
      const innerMax = 100;
      for (let inner = 0; inner < innerMax; inner++) {
        // Identify fights that must be included (have a fighter with unmet min)
        const urgentFights = [];
        const nonUrgentFights = [];
        availableFights.forEach((fg) => {
          const hasShortfall = fg.some((f) => {
            const minReq = fighterLimits[String(f.id)]?.min || 0;
            return (usageCounts[f.id] || 0) < minReq;
          });
          if (hasShortfall) {
            urgentFights.push(fg);
          } else {
            nonUrgentFights.push(fg);
          }
        });

        // Force-include urgent fights first (up to 6), fill rest randomly
        const forcedCount = Math.min(urgentFights.length, 6);
        const shuffledUrgent = shuffleFresh(urgentFights).slice(0, forcedCount);
        const remaining = 6 - forcedCount;
        const shuffledRest = shuffleFresh(nonUrgentFights).slice(0, remaining);
        const selected = [...shuffledUrgent, ...shuffledRest];

        // If we somehow don't have 6 fights (very few fights on card), bail
        if (selected.length < 6) continue;

        const team = selected.map((fg) => {
          const scored = [...fg].map((f) => {
            const minReq = fighterLimits[String(f.id)]?.min || 0;
            const currentCount = usageCounts[f.id] || 0;
            const shortfall = Math.max(0, minReq - currentCount);
            const urgency =
              teamsRemaining > 0
                ? shortfall / teamsRemaining
                : shortfall > 0
                  ? 1
                  : 0;
            const urgencyAdj = urgency > 0 ? -urgency * 9000 : 0;
            return {
              f,
              score: f.salary + (usageCounts[f.id] ?? 0) * 600 + urgencyAdj,
            };
          });
          scored.sort((a, b) => a.score - b.score);
          return scored[0].f;
        });

        const totalSalary = team.reduce((sum, f) => sum + f.salary, 0);
        if (totalSalary <= 50000) return team;
      }
      console.log(`buildTeam: all ${100} attempts over salary cap`);
      return null;
    };

    // Jaccard overlap: count shared fighters between two teams
    const sharedCount = (teamA, teamB) => {
      const setA = new Set(teamA.map((f) => String(f.id)));
      return teamB.filter((f) => setA.has(String(f.id))).length;
    };

    const selectedTeams = [];
    const seenKeys = new Set();
    let attempts = 0;
    const maxAttempts = 200000;
    // overlapThreshold=3: reject if >3 fighters shared (4+ = too similar).
    // Math: threshold=2 allows max 11 teams from 12 fights (C(12,3)/C(6,3)=11).
    // threshold=3 allows max 33 with pure cheap selection, many more with rotation.
    const overlapThreshold = 3;

    while (attempts < maxAttempts && selectedTeams.length < numTeams) {
      attempts++;
      const team = buildTeam(numTeams - selectedTeams.length);

      // buildTeam returns null if it couldn't find a salary-valid team
      if (!team) continue;

      // Uniqueness check — skip exact duplicates
      const teamKey = team
        .map((f) => String(f.id))
        .sort()
        .join(",");
      if (seenKeys.has(teamKey)) continue;

      // Overlap/diversity check — discard near-duplicate lineups
      const tooSimilar = selectedTeams.some(
        (existing) => sharedCount(existing, team) > overlapThreshold,
      );
      if (tooSimilar) continue;

      // Max limit check — ensure adding this team doesn't push any fighter over their max
      let overMax = false;
      const prospectiveCounts = {};
      [...selectedTeams, team].forEach((t) =>
        t.forEach((f) => {
          prospectiveCounts[f.id] = (prospectiveCounts[f.id] || 0) + 1;
        }),
      );
      Object.entries(fighterLimits).forEach(([id, { max = Infinity }]) => {
        if ((prospectiveCounts[id] || 0) > max) overMax = true;
      });
      if (overMax) continue;

      // Accept team — update live usage so next buildTeam() sees current counts
      team.forEach((f) => {
        usageCounts[f.id] = (usageCounts[f.id] || 0) + 1;
      });
      seenKeys.add(teamKey);
      selectedTeams.push(team);
    }

    // Final min check across all selected teams
    const finalCounts = {};
    fighters.forEach((f) => (finalCounts[f.id] = { name: f.name, count: 0 }));
    selectedTeams.forEach((team) =>
      team.forEach((f) => finalCounts[f.id].count++),
    );
    let minViolations = [];
    Object.entries(fighterLimits).forEach(([id, { min = 0 }]) => {
      if (min > 0 && (finalCounts[id]?.count || 0) < min) {
        minViolations.push(`${finalCounts[id]?.name || id} (min ${min})`);
      }
    });

    // Single comprehensive post-loop diversity diagnostic
    const usageValues = Object.values(usageCounts);
    const avg =
      usageValues.reduce((a, b) => a + b, 0) / (usageValues.length || 1);
    const variance = Math.sqrt(
      usageValues.reduce((sum, c) => sum + (c - avg) ** 2, 0) /
        (usageValues.length || 1),
    );
    const zeros = usageValues.filter((c) => c === 0).length;
    console.log(
      `Final diversity — Avg usage: ${avg.toFixed(2)}, Variance: ${variance.toFixed(2)}, Zero-usage fighters: ${zeros}, Salary success rate: ${attempts > 0 ? ((selectedTeams.length / attempts) * 100).toFixed(1) : 0}%`,
    );
    console.log(
      `Generated ${selectedTeams.length} teams after ${attempts} attempts (salary success rate: ${attempts > 0 ? ((selectedTeams.length / attempts) * 100).toFixed(1) : 0}%)`,
    );
    setGeneratedCount(selectedTeams.length);

    if (selectedTeams.length === 0) {
      setError(
        "No valid teams could be generated. Try raising the salary cap tolerance, removing exclusions, or reducing the number of teams.",
      );
      return;
    }

    if (minViolations.length > 0) {
      setError(
        `Min limits not fully met for: ${minViolations.join(", ")}. Showing best results.`,
      );
    } else if (selectedTeams.length < numTeams) {
      setError(
        `Only ${selectedTeams.length} unique teams could be generated (salary cap or limits prevented more).`,
      );
    }

    setRandomTeams(selectedTeams);
    setFighterCounts(finalCounts);
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
            <button
              onClick={generateTeamsWithConstraints}
              className="w-full py-3 px-6 rounded-lg font-bold tracking-widest uppercase text-sm transition duration-300 hover:scale-105 bg-gradient-to-r from-yellow-700 to-yellow-600 text-stone-950 shadow-lg border border-yellow-600"
            >
              Generate
            </button>
            <button
              onClick={generateTeamsWithConstraints}
              className="w-full mt-3 py-3 px-6 rounded-lg font-bold tracking-widest uppercase text-sm transition duration-300 hover:scale-105 bg-stone-800 hover:bg-stone-700 text-yellow-400 border border-yellow-700/50 shadow-lg"
            >
              Regenerate Teams
            </button>
            {randomTeams.length > 0 && (
              <button onClick={downloadCSV} className="neon-button w-full mt-4">
                Download CSV
              </button>
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
                <h3 className="text-yellow-500 font-bold tracking-wider uppercase text-xs mb-2">
                  TEAM {index + 1}
                </h3>
                <ul className="space-y-1">
                  {team.map((f) => (
                    <li key={f.id} className="flex justify-between text-sm">
                      <span className="text-stone-200">{f.name}</span>
                      <span className="text-yellow-500/80">${f.salary}</span>
                    </li>
                  ))}
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
