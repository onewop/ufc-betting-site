// DFSPicksProjections_part2_logic.jsx
// This file contains the main component state, data fetching, memo calculations, and projection logic for DFSPicksProjections.
// Includes useState, useEffect, useMemo, sorted, avgProjMid, top10Chart, etc.
// Split for AI analysis to focus on state management and data processing without helpers or UI.

const DFSPicksProjections = ({ eventTitle = "" }) => {
  const [picks, setPicks] = useState([]);
  const [fights, setFights] = useState([]);
  const [eventName, setEventName] = useState("This Week's Card");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sortKey, setSortKey] = useState("projMid");
  const [sortOrder, setSortOrder] = useState("desc");
  const [locked, setLocked] = useState(new Set());
  const [excluded, setExcluded] = useState(new Set());
  const [optimalLineups, setOptimalLineups] = useState([]);
  const [optimizerError, setOptimizerError] = useState(null);
  const [exposureLimit, setExposureLimit] = useState(60); // max % a fighter can appear across lineups
  const [focusedFightId, setFocusedFightId] = useState(null);
  const [openSections, setOpenSections] = useState({
    chart: true,
    table: true,
    matchupIntel: false, // collapsed by default — open via nav or header click
    optimizer: true,
  });
  const toggleSection = (key) =>
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  const openAndScroll = (id, key) => {
    if (key) setOpenSections((prev) => ({ ...prev, [key]: true }));
    setTimeout(
      () =>
        document
          .getElementById(id)
          ?.scrollIntoView({ behavior: "smooth", block: "start" }),
      50,
    );
  };

  const openMatchupIntelFight = (fightAnchor, e) => {
    if (e) e.preventDefault();
    const match = String(fightAnchor).match(/^fight-(.+)$/);
    setFocusedFightId(match ? match[1] : null);
    openAndScroll(fightAnchor, "matchupIntel");
  };
  // Unique per user session — seeds projection noise so two users building
  // at the same time get slightly different diverse lineup orderings.
  const userSeed = Date.now() + Math.random() * 10000;

  const toggleLock = (name) => {
    setLocked((prev) => {
      const next = new Set(prev);
      if (next.has(name)) {
        next.delete(name);
      } else {
        next.add(name);
        setExcluded((ex) => {
          const e = new Set(ex);
          e.delete(name);
          return e;
        });
      }
      return next;
    });
  };

  const toggleExclude = (name) => {
    setExcluded((prev) => {
      const next = new Set(prev);
      if (next.has(name)) {
        next.delete(name);
      } else {
        next.add(name);
        setLocked((lk) => {
          const l = new Set(lk);
          l.delete(name);
          return l;
        });
      }
      return next;
    });
  };

  // Return all k-length combinations from arr
  const getCombinations = (arr, k) => {
    if (k === 0) return [[]];
    if (arr.length < k) return [];
    const [first, ...rest] = arr;
    return [
      ...getCombinations(rest, k - 1).map((c) => [first, ...c]),
      ...getCombinations(rest, k),
    ];
  };

  // Estimate win probability from betting odds (moneyline)
  // Returns probability that fighter is favorite (i.e., negative odds)
  const estimateWinProbability = (fighter, bettingOdds = {}) => {
    const { moneyline } = bettingOdds;
    if (!moneyline) return 0.5;
    const [mlF1, mlF2] = moneyline.split(" ");
    const odds = fighter.name.includes(mlF1) ? parseFloat(mlF1) : parseFloat(mlF2);
    if (isNaN(odds)) return 0.5;
    // Convert American odds to probability
    return odds < 0 ? Math.abs(odds) / (Math.abs(odds) + 100) : 100 / (odds + 100);
  };

  // Compute fight quality score (0–1) based on favorite win probability
  const computeFightQuality = (fighters, bettingOdds) => {
    if (!fighters || fighters.length < 2) return 0.5;
    const f1Prob = estimateWinProbability(fighters[0], bettingOdds);
    const f2Prob = estimateWinProbability(fighters[1], bettingOdds);
    const favoriteProb = Math.max(f1Prob, f2Prob);
    // High-quality fight: favorite win prob between 60% and 85%
    if (favoriteProb < 0.6) return 0.3;
    if (favoriteProb > 0.85) return 0.5;
    return 0.8;
  };

  // Build every valid salary-cap lineup sorted by projected points descending.
  // Returns an array of { team, totalSalary, totalPoints } objects.
  const buildAllValidLineups = (allPicks, lockedSet, excludedSet) => {
    const available = allPicks.filter((p) => !excludedSet.has(p.fighter));

    const byFight = {};
    available.forEach((p) => {
      if (!byFight[p.fightId]) byFight[p.fightId] = [];
      byFight[p.fightId].push(p);
    });

    const lockedFighters = [];
    const lockedFightIds = new Set();
    available
      .filter((p) => lockedSet.has(p.fighter))
      .forEach((p) => {
        if (!lockedFightIds.has(p.fightId)) {
          lockedFighters.push(p);
          lockedFightIds.add(p.fightId);
        }
      });

    const freeFights = Object.entries(byFight)
      .filter(([fid]) => !lockedFightIds.has(fid))
      .map(([, fighters]) => fighters);

    const slotsNeeded = 6 - lockedFighters.length;
    if (slotsNeeded < 0) return { error: "Too many fighters locked (max 6)." };
    if (freeFights.length < slotsNeeded)
      return {
        error: `Not enough fights available (need ${slotsNeeded} more).`,
      };

    const lockedSalary = lockedFighters.reduce((s, f) => s + f.salary, 0);
    const remainingBudget = 50000 - lockedSalary;

    const combos = getCombinations(freeFights, slotsNeeded);
    const validLineups = [];

    for (const combo of combos) {
      const selections = combo.reduce(
        (acc, fightFighters) =>
          acc.length === 0
            ? fightFighters.map((f) => [f])
            : acc.flatMap((existing) =>
                fightFighters.map((f) => [...existing, f]),
              ),
        [],
      );
      for (const sel of selections) {
        const salUsed = sel.reduce((s, f) => s + f.salary, 0);
        if (salUsed > remainingBudget) continue;
        const team = [...lockedFighters, ...sel];
        const pts = team.reduce((s, f) => s + f.projMid, 0);
        validLineups.push({
          team,
          totalSalary: lockedSalary + salUsed,
          totalPoints: pts,
        });
      }
    }

    // Sort best → worst by projected points
    validLineups.sort((a, b) => b.totalPoints - a.totalPoints);
    return validLineups;
  };

  const runOptimizer = (count = 1) => {
    setOptimizerError(null);
    setOptimalLineups([]);

    // For multi-lineup builds apply seeded ±5% noise so different users
    // (or repeated clicks) get varied lineup orderings while still being
    // projection-based.  Single-lineup builds use exact projMid values.
    let picksToUse = picks;
    if (count > 1) {
      let s = userSeed;
      const seededRandom = () => {
        s = Math.sin(s) * 10000;
        return s - Math.floor(s);
      };
      picksToUse = picks.map((p) => ({
        ...p,
        projMid: Math.round(p.projMid * (1 + (seededRandom() * 2 - 1) * 0.05)),
      }));
    }

    const allValid = buildAllValidLineups(picksToUse, locked, excluded);
    if (!Array.isArray(allValid)) {
      setOptimizerError(allValid.error);
      return;
    }
    if (allValid.length === 0) {
      setOptimizerError("No valid lineups found under the $50,000 salary cap.");
      return;
    }

    if (count === 1) {
      // Simply return the globally optimal lineup
      const best = allValid[0];
      setOptimalLineups([
        { ...best, totalPoints: Math.round(best.totalPoints) },
      ]);
      return;
    }

    // For multiple lineups: greedily pick the next best lineup that respects
    // the exposure limit — no fighter appears in more than (exposureLimit% × count) lineups.
    // Also enforce that each pair of lineups differs by at least 3 fighters.
    const maxAppearances = Math.max(
      1,
      Math.ceil(count * (exposureLimit / 100)),
    );
    const usageCounts = {}; // fighter name → how many lineups they're in so far
    const selected = [];

    // Phase 1: select from lineups that include ALL locked fighters, applying
    // the full exposure check to every fighter (locked ones included).
    // This means locked fighters appear in at most maxAppearances lineups.
    for (const candidate of allValid) {
      if (selected.length >= count) break;
      const overExposed = candidate.team.some(
        (f) => (usageCounts[f.fighter] || 0) >= maxAppearances,
      );
      if (overExposed) continue;
      // Check diversity: must differ by at least 3 fighters from every chosen lineup
      const candNames = new Set(candidate.team.map((f) => f.fighter));
      const tooSimilar = selected.some(
        (existing) =>
          existing.team.filter((f) => candNames.has(f.fighter)).length > 3,
      );
      if (tooSimilar) continue;
      candidate.team.forEach((f) => {
        usageCounts[f.fighter] = (usageCounts[f.fighter] || 0) + 1;
      });
      selected.push(candidate);
    }

    // Phase 2: if locked fighters hit their exposure cap before we reach `count`,
    // fill remaining slots from the unlocked pool so the full target is met.
    if (selected.length < count && locked.size > 0) {
      const allValidUnlocked = buildAllValidLineups(
        picksToUse,
        new Set(),
        excluded,
      );
      if (Array.isArray(allValidUnlocked)) {
        // Track team fingerprints to skip exact duplicates already selected.
        const selectedFingerprints = selected.map((l) =>
          l.team
            .map((f) => f.fighter)
            .sort()
            .join("|"),
        );
        for (const candidate of allValidUnlocked) {
          if (selected.length >= count) break;
          const candNames = new Set(candidate.team.map((f) => f.fighter));
          const fingerprint = [...candNames].sort().join("|");
          if (selectedFingerprints.includes(fingerprint)) continue;
          const overExposed = candidate.team.some(
            (f) => (usageCounts[f.fighter] || 0) >= maxAppearances,
          );
          if (overExposed) continue;
          const tooSimilar = selected.some(
            (existing) =>
              existing.team.filter((f) => candNames.has(f.fighter)).length > 3,
          );
          if (tooSimilar) continue;
          candidate.team.forEach((f) => {
            usageCounts[f.fighter] = (usageCounts[f.fighter] || 0) + 1;
          });
          selected.push(candidate);
          selectedFingerprints.push(fingerprint);
        }
      }
    }

    // Log generation results.
    if (selected.length >= count) {
      console.log(
        `[Optimizer] Built ${selected.length}/${count} lineups. ` +
          `Locked pool: ${allValid.length}. Exposure cap: ${exposureLimit}%.`,
      );
    } else {
      console.log(
        `[Optimizer] Only ${selected.length} of ${count} requested lineups could be generated. ` +
          `Locked pool: ${allValid.length}. Likely cause: diversity/exposure constraints are ` +
          `too tight for the current locks/excludes at ${exposureLimit}% exposure.`,
      );
    }

    if (selected.length === 0) {
      setOptimizerError(
        `Could not build diverse lineups at ${exposureLimit}% exposure. Try raising the exposure limit or excluding dominant fighters.`,
      );
      return;
    }

    if (selected.length < count) {
      setOptimizerError(
        `Only ${selected.length} diverse lineup${selected.length === 1 ? "" : "s"} could be generated with current locks/excludes. Showing all found.`,
      );
    }

    setOptimalLineups(
      selected.map((l) => ({ ...l, totalPoints: Math.round(l.totalPoints) })),
    );
  };

  const downloadOptimalCSV = () => {
    if (optimalLineups.length === 0) return;
    const rows = [
      "Team,Fighter 1,Fighter 2,Fighter 3,Fighter 4,Fighter 5,Fighter 6,Total Salary,Proj Pts",
    ];
    optimalLineups.forEach((lineup, idx) => {
      const names = lineup.team.map((f) => f.fighter).join(",");
      rows.push(
        `${idx + 1},${names},${lineup.totalSalary},${lineup.totalPoints}`,
      );
    });
    const blob = new Blob([rows.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "optimal_lineups.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  useEffect(() => {
    fetch("/this_weeks_stats.json", { cache: "no-store" })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => {
        if (data.event) setEventName(data.event.name || data.event);
        setFights(data.fights || []);

        // Pre-compute a rounds estimate for each fight using both fighters' data.
        // This ensures every fight gets a unique value instead of a flat 2.5 default.
        const fightRoundsMap = {};
        (data.fights || []).forEach((fight) => {
          const [f1, f2] = fight.fighters || [];
          const { rounds, roundsSource } = estimateFightRounds(
            f1 || {},
            f2 || null,
            fight.betting_odds || {},
          );
          fightRoundsMap[String(fight.fight_id ?? 0)] = {
            rounds,
            roundsSource,
          };
        });

        // Flatten fighters, carrying their fight's betting_odds, fight_id, and
        // the per-fight rounds estimate (same value for both fighters in a bout).
        const allFighters = (data.fights || []).flatMap((fight) =>
          (fight.fighters || []).map((f) => ({
            ...f,
            _bettingOdds: fight.betting_odds || {},
            _fightId: String(fight.fight_id ?? 0),
            _roundsEst:
              fightRoundsMap[String(fight.fight_id ?? 0)]?.rounds ?? 2.5,
            _roundsSource:
              fightRoundsMap[String(fight.fight_id ?? 0)]?.roundsSource ??
              "default",
          })),
        );

        const valid = allFighters.filter((f) => f.name && f.salary);

        // Compute medians for relative ownership
        const salaries = valid.map((f) => f.salary).sort((a, b) => a - b);
        const ppgs = valid
          .map((f) => f.avgPointsPerGame || 0)
          .filter((v) => v > 0)
          .sort((a, b) => a - b);
        const medianSalary = salaries[Math.floor(salaries.length / 2)] || 8000;
        const medianPPG = ppgs[Math.floor(ppgs.length / 2)] || 50;

        const computed = valid.map((f) => {
          const { projLo, projHi, projMid, rounds, roundsSource, source } =
            computeProjection(f, f._roundsEst, f._roundsSource);
          const isStud = f.salary >= 8000;
          const { label: ownership, ownerNum } = estimateOwnership(
            f.salary,
            f.avgPointsPerGame || 0,
            medianSalary,
            medianPPG,
          );
          const reasoning = buildReasoning(f, projMid, ownerNum);

          // Compute win probability and points-per-thousand
          const winProb = estimateWinProbability(f, f._bettingOdds);
          const pointsPerThousand = f.salary > 0 ? (projMid / f.salary) * 1000 : 0;

          return {
            fighter: f.name,
            salary: f.salary,
            fightId: f._fightId,
            type: isStud ? "Stud" : "Value",
            projLo,
            projHi,
            projMid,
            projection: `${projLo}–${projHi} pts`,
            ownership,
            ownerNum,
            reasoning,
            rounds,
            roundsSource,
            source,
            fightAnchor: `fight-${f._fightId}`,
            winProb,
            pointsPerThousand,
          };
        });

        setPicks(computed);
        setLoading(false);
      })
      .catch((err) => {
        console.error("DFSPicksProjections fetch error:", err);
        setError("Could not load fighter data: " + err.message);
        setLoading(false);
      });
  }, []);

  const sorted = useMemo(
    () => sortPicks(picks, sortKey, sortOrder),
    [picks, sortKey, sortOrder],
  );

  const handleSort = (key) => {
    setSortOrder(sortKey === key && sortOrder === "desc" ? "asc" : "desc");
    setSortKey(key);
  };

  const SortTh = ({ col, label }) => (
    <th
      onClick={() => handleSort(col)}
      className="p-2 cursor-pointer border border-stone-700 hover:bg-stone-700/60 select-none whitespace-nowrap"
    >
      {label}{" "}
      {sortKey === col ? (
        sortOrder === "asc" ? (
          "↑"
        ) : (
          "↓"
        )
      ) : (
        <span className="text-stone-500 text-xs">↕</span>
      )}
    </th>
  );

  const avgProjMid = useMemo(
    () => picks.reduce((s, p) => s + p.projMid, 0) / (picks.length || 1),
    [picks],
  );
  const avgSalary = useMemo(
    () => picks.reduce((s, p) => s + p.salary, 0) / (picks.length || 1),
    [picks],
  );

  const top10Chart = useMemo(
    () => [...picks].sort((a, b) => b.projMid - a.projMid).slice(0, 10),
    [picks],
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-stone-950 text-yellow-500">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-yellow-500 mx-auto mb-4"></div>
          <p className="text-lg">Loading UFC stats...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-stone-950 text-red-500">
        <div className="text-center">
          <p className="text-xl font-bold mb-2">Error</p>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-950 text-stone-200 font-sans">
      <header className="bg-stone-900 border-b border-stone-800 py-4 px-6 sticky top-0 z-20">
        <h1 className="text-2xl font-bold text-yellow-600">
          {eventName} — DFS Picks & Projections
        </h1>
        <p className="text-sm text-stone-400 mt-1">
          Event: {eventTitle || "Latest UFC Event"} • Avg Proj: {avgProjMid.toFixed(1)} pts
        </p>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        {/* Optimizer Section */}
        <section id="optimizer" className="mb-10">
          <div
            className="flex items-center justify-between mb-4 cursor-pointer"
            onClick={() => toggleSection("optimizer")}
          >
            <h2 className="text-xl font-semibold text-yellow-500">
              Lineup Optimizer
            </h2>
            <span className="text-stone-500">
              {openSections.optimizer ? "−" : "+"}
            </span>
          </div>
          {openSections.optimizer && (
            <div className="bg-stone-900 rounded-lg p-4 border border-stone-800">
              <div className="flex flex-wrap gap-4 items-center mb-4">
                <label className="flex items-center gap-2">
                  <span className="text-sm">Lineups:</span>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    defaultValue="1"
                    className="w-20 bg-stone-800 border border-stone-700 rounded px-2 py-1 text-white"
                    id="lineupCount"
                  />
                </label>
                <label className="flex items-center gap-2">
                  <span className="text-sm">Exposure %:</span>
                  <input
                    type="number"
                    min="10"
                    max="100"
                    value={exposureLimit}
                    onChange={(e) => setExposureLimit(Number(e.target.value))}
                    className="w-20 bg-stone-800 border border-stone-700 rounded px-2 py-1 text-white"
                  />
                </label>
                <button
                  onClick={() => {
                    const countInput = document.getElementById("lineupCount");
                    const count = countInput ? Number(countInput.value) : 1;
                    runOptimizer(count);
                  }}
                  className="bg-yellow-600 hover:bg-yellow-500 text-white px-4 py-2 rounded font-semibold transition"
                >
                  Generate Lineups
                </button>
                <button
                  onClick={downloadOptimalCSV}
                  disabled={optimalLineups.length === 0}
                  className="bg-stone-700 hover:bg-stone-600 disabled:opacity-50 text-white px-4 py-2 rounded font-semibold transition"
                >
                  Download CSV
                </button>
              </div>
              {optimizerError && (
                <p className="text-red-400 mb-2">{optimizerError}</p>
              )}
              {optimalLineups.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-left text-sm">
                    <thead>
                      <tr className="bg-stone-800">
                        <th className="p-2">Lineup</th>
                        <th className="p-2">Fighters</th>
                        <th className="p-2">Salary</th>
                        <th className="p-2">Proj Pts</th>
                      </tr>
                    </thead>
                    <tbody>
                      {optimalLineups.map((lineup, idx) => (
                        <tr key={idx} className="border-b border-stone-800">
                          <td className="p-2 font-bold text-yellow-500">
                            #{idx + 1}
                          </td>
                          <td className="p-2">
                            {lineup.team.map((f, i) => (
                              <span key={i} className="mr-2">
                                {f.fighter}
                              </span>
                            ))}
                          </td>
                          <td className="p-2">${lineup.totalSalary.toLocaleString()}</td>
                          <td className="p-2 font-bold">{lineup.totalPoints}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </section>

        {/* Table Section */}
        <section id="table" className="mb-10">
          <div
            className="flex items-center justify-between mb-4 cursor-pointer"
            onClick={() => toggleSection("table")}
          >
            <h2 className="text-xl font-semibold text-yellow-500">
              Fighter Projections
            </h2>
            <span className="text-stone-500">
              {openSections.table ? "−" : "+"}
            </span>
          </div>
          {openSections.table && (
            <div className="overflow-x-auto bg-stone-900 rounded-lg border border-stone-800">
              <table className="min-w-full text-left text-sm">
                <thead>
                  <tr className="bg-stone-800">
                    <SortTh col="fighter" label="Fighter" />
                    <SortTh col="salary" label="Salary" />
                    <SortTh col="projMid" label="Proj Pts" />
                    <SortTh col="projection" label="Projection" />
                    <SortTh col="ownership" label="Ownership" />
                    <SortTh col="winProb" label="Win % Est" />
                    <SortTh col="pointsPerThousand" label="Value ($/k)" />
                    <th className="p-2">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((p) => (
                    <tr
                      key={p.fighter}
                      className={`border-b border-stone-800 hover:bg-stone-800/60 ${
                        locked.has(p.fighter) ? "bg-yellow-900/20" : ""
                      }`}
                    >
                      <td className="p-2">
                        <a
                          href={`#${p.fightAnchor}`}
                          onClick={(e) => openMatchupIntelFight(p.fightAnchor, e)}
                          className="text-yellow-500 hover:underline"
                        >
                          {p.fighter}
                        </a>
                      </td>
                      <td className="p-2">${p.salary.toLocaleString()}</td>
                      <td className="p-2 font-bold">{p.projMid}</td>
                      <td className="p-2">{p.projection}</td>
                      <td className="p-2">{p.ownership}</td>
                      <td className="p-2">{(p.winProb * 100).toFixed(1)}%</td>
                      <td className="p-2">${p.pointsPerThousand.toFixed(2)}</td>
                      <td className="p-2">
                        <button
                          onClick={() => toggleLock(p.fighter)}
                          className={`px-2 py-1 rounded text-xs font-semibold mr-2 ${
                            locked.has(p.fighter)
                              ? "bg-green-700 text-white"
                              : "bg-stone-700 text-stone-300"
                          }`}
                        >
                          {locked.has(p.fighter) ? "Locked" : "Lock"}
                        </button>
                        <button
                          onClick={() => toggleExclude(p.fighter)}
                          className={`px-2 py-1 rounded text-xs font-semibold ${
                            excluded.has(p.fighter)
                              ? "bg-red-700 text-white"
                              : "bg-stone-700 text-stone-300"
                          }`}
                        >
                          {excluded.has(p.fighter) ? "Excluded" : "Exclude"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Chart Section */}
        <section id="chart" className="mb-10">
          <div
            className="flex items-center justify-between mb-4 cursor-pointer"
            onClick={() => toggleSection("chart")}
          >
            <h2 className="text-xl font-semibold text-yellow-500">
              Top 10 Projections
            </h2>
            <span className="text-stone-500">
              {openSections.chart ? "−" : "+"}
            </span>
          </div>
          {openSections.chart && (
            <div className="bg-stone-900 rounded-lg p-4 border border-stone-800">
              <div className="h-64 flex items-end justify-between gap-2">
                {top10Chart.map((p, i) => (
                  <div key={i} className="flex flex-col items-center w-full">
                    <div
                      className="w-full bg-yellow-600 hover:bg-yellow-500 transition rounded-t"
                      style={{ height: `${Math.min((p.projMid / 60) * 100, 100)}%` }}
                      title={`${p.fighter}: ${p.projMid} pts`}
                    ></div>
                    <span className="text-xs mt-2 truncate w-full text-center">
                      {p.fighter}
                    </span>
                    <span className="text-xs text-stone-400">
                      ${p.salary.toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* Matchup Intel Section */}
        <section id="matchupIntel" className="mb-10">
          <div
            className="flex items-center justify-between mb-4 cursor-pointer"
            onClick={() => toggleSection("matchupIntel")}
          >
            <h2 className="text-xl font-semibold text-yellow-500">
              Matchup Intel
            </h2>
            <span className="text-stone-500">
              {openSections.matchupIntel ? "−" : "+"}
            </span>
          </div>
          {openSections.matchupIntel && (
            <div className="bg-stone-900 rounded-lg p-4 border border-stone-800">
              {focusedFightId ? (
                (() => {
                  const fight = fights.find(
                    (f) => String(f.fight_id) === focusedFightId
                  );
                  if (!fight) return <p className="text-red-400">Fight not found.</p>;
                  const [f1, f2] = fight.fighters || [];
                  const quality = computeFightQuality(
                    [f1, f2],
                    fight.betting_odds || {}
                  );
                  return (
                    <div>
                      <h3 className="text-lg font-bold text-yellow-500 mb-2">
                        {f1?.name} vs {f2?.name}
                      </h3>
                      <p className="mb-2">
                        Fight Quality Score:{" "}
                        <span className="font-bold">
                          {(quality * 100).toFixed(0)}%
                        </span>
                      </p>
                      <p className="text-sm text-stone-400">
                        Based on win probability estimates from betting odds.
                      </p>
                    </div>
                  );
                })()
              ) : (
                <p className="text-stone-400">
                  Click on a fighter’s name in the table to view matchup intel.
                </p>
              )}
            </div>
          )}
        </section>
      </main>

      <footer className="bg-stone-900 text-stone-400 text-center py-6 border-t border-stone-800">
        <p className="text-sm px-4">
          21+. Gambling problem? Call 1-800-GAMBLER. Not affiliated with UFC or any
          sportsbook.
        </p>
        <p className="text-sm mt-2 px-4">
          Ready to bet on UFC? Sign up at{" "}
          <a
            href="PASTE_YOUR_DRAFTKINGS_AFFILIATE_LINK_HERE"
            className="text-yellow-500 hover:underline"
          >
            DraftKings
          </a>
          .
        </p>
      </footer>
    </div>
  );
};

export default DFSPicksProjections;
