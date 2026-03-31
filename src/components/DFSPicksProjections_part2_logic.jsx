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

  if (loading)