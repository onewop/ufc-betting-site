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
    // Inner loop: up to 500 tries per team to find a valid salary combo.
    // Strategy per try:
    //   1. shuffleFresh the fights for true randomness each attempt.
    //   2. Sort selected fights by avg usage (under-used fights first).
    //   3. Per fight: prefer cheaper fighter to help budget, but blend with
    //      usage preference — pick the fighter with the lower (salary + usage*500)
    //      composite score, random tie-break.
    // Returns a random salary-valid team.
    // KEY DESIGN: shuffleFresh() provides ALL fight-combo diversity — 924 possible
    // combos from 12 fights choose 6. We do NOT sort after shuffling because sorting
    // completely erases the shuffle and converges every call to the same 6 cheapest
    // fights, which is why only 2-5 teams were ever produced.
    // Fighter selection: salary + usage*600 — cheap fighters first, but after ~3
    // uses a fighter's score nudges the picker toward unused teammates, spreading
    // usage naturally. Every fight averages $8,100; cheapest-fighter teams land
    // ~$44-46k, giving $4-6k of headroom to absorb the usage nudge.
    const buildTeam = () => {
      const innerMax = 50; // safety net only — cap violations are rare with cheap-first picks
      for (let inner = 0; inner < innerMax; inner++) {
        // Shuffle gives a random fight ordering — take first 6 as-is, NO sort
        const selected = shuffleFresh(availableFights).slice(0, 6);
        const team = selected.map((fg) => {
          // salary + usage*600: prefer cheap, rotate after ~3 uses
          const scored = [...fg].map((f) => ({
            f,
            score: f.salary + (usageCounts[f.id] ?? 0) * 600,
          }));
          scored.sort((a, b) => a.score - b.score);
          return scored[0].f;
        });
        const totalSalary = team.reduce((sum, f) => sum + f.salary, 0);
        if (totalSalary <= 50000) return team;
      }
      console.log(`buildTeam: all ${50} attempts over salary cap`);
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
      const team = buildTeam();

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

    const csvContent =
      "data:text/csv;charset=utf-8," +
      "Team Number,Fighter 1,Fighter 2,Fighter 3,Fighter 4,Fighter 5,Fighter 6\n" +
      randomTeams
        .map(
          (team, index) => `${index + 1},` + team.map((f) => f.name).join(","),
        )
        .join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "dfs_teams.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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

      <div className="max-w-6xl mx-auto px-4 py-10">
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
            className="text-4xl md:text-5xl font-black text-stone-100 tracking-wider uppercase"
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
            <div className="overflow-y-auto h-96 border border-yellow-700/30 rounded">
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
                          className="w-16 bg-stone-800 text-stone-100 border border-stone-600 rounded"
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
                          className="w-16 bg-stone-800 text-stone-100 border border-stone-600 rounded"
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
