/**
 * DFSPicksProjections.jsx — Main DFS projections table + bar chart component.
 *
 * This file contains only:
 *   rowClass(pick, avgProjMid, avgSalary)   — row highlight CSS
 *   sortPicks(arr, key, order)              — sort helper
 *   CustomTooltip                           — recharts tooltip
 *   DFSPicksProjections                    — main exported component
 *
 * Heavy computation and sub-components are in separate files:
 *   projectionMath.js    — round estimation, computeProjection, win probability
 *   projectionHelpers.js — ownership tiers, narrative reasoning text
 *   MatchupIntel.jsx     — directional exploit analysis grid
 *
 * Rollback: cp _archive/src_components/DFSPicksProjections_ORIGINAL_PRESPLIT.jsx \
 *              src/components/DFSPicksProjections.jsx
 *           (then delete projectionMath.js, projectionHelpers.js, MatchupIntel.jsx)
 */

import React, { useState, useEffect, useMemo } from "react";
import api from "../services/api";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

import {
  parseRoundsLine,
  estimateFightRounds,
  computeProjection,
  estimateWinProbability,
} from "./projectionMath";
import { estimateOwnership, buildReasoning } from "./projectionHelpers";
import MatchupIntel from "./MatchupIntel";

const rowClass = (pick, avgProjMid, avgSalary) => {
  const valueScore = pick.projMid / (pick.salary / 1000);
  const avgValueScore = avgProjMid / (avgSalary / 1000);
  const isFade = pick.ownerNum >= 28 && pick.projMid < avgProjMid;
  if (isFade) return "bg-red-950/40 border-red-900";
  if (valueScore > avgValueScore * 1.15)
    return "bg-green-950/40 border-green-900";
  return "border-stone-700";
};

// ─── Sort helper ───────────────────────────────────────────────────────────
const sortPicks = (arr, key, order) =>
  [...arr].sort((a, b) => {
    const va = a[key] ?? 0;
    const vb = b[key] ?? 0;
    const cmp = typeof va === "string" ? va.localeCompare(vb) : va - vb;
    return order === "asc" ? cmp : -cmp;
  });

// ─── Custom bar chart label ────────────────────────────────────────────────
const CustomTooltip = ({ active, payload }) => {
  if (active && payload?.length) {
    const d = payload[0].payload;
    return (
      <div className="bg-stone-900 border border-yellow-700/40 rounded p-2 text-xs text-stone-100">
        <p className="font-bold text-yellow-400">{d.fighter}</p>
        <p className="text-stone-300">Projection: {d.projMid} pts</p>
        <p className="text-stone-400">Salary: ${d.salary.toLocaleString()}</p>
      </div>
    );
  }
  return null;
};

// ────────────────────────────────────────────────────────────────────────────
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
  const [backendProj, setBackendProj] = useState({}); // name → backend projection data
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
    api
      .get("/api/this-weeks-stats")
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
          const winProb = estimateWinProbability(f, f._bettingOdds);
          const pointsPerThousand =
            f.salary > 0
              ? parseFloat(((f.projMid / f.salary) * 1000).toFixed(2))
              : 0;

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

        // Fetch matchup-aware backend projections (non-blocking enhancement)
        api
          .get("/api/projections")
          .then((data) => {
            if (data?.projections) {
              const byName = {};
              data.projections.forEach((p) => {
                byName[p.name] = p;
              });
              setBackendProj(byName);
            }
          })
          .catch(() => {}); // silently fail — backend projections are optional
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
    return (
      <div
        className="min-h-screen bg-stone-950 flex items-center justify-center"
        style={{ fontFamily: "'Courier New', monospace" }}
      >
        <p className="text-stone-500 tracking-widest animate-pulse uppercase text-sm">
          Loading Predictions…
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
        {/* Page header */}
        <div className="text-center mb-8">
          <p className="text-xs text-stone-500 tracking-[0.5em] uppercase mb-2">
            ◆ OPERATION COMBAT VAULT — PROJECTIONS INTEL ◆
          </p>
          <h1
            className="text-3xl md:text-5xl font-black text-stone-100 tracking-wider uppercase"
            style={{
              fontFamily: "'Impact', sans-serif",
              textShadow: "2px 2px 0 #4a5240, 0 0 40px rgba(100,120,80,0.3)",
            }}
          >
            <span className="text-yellow-600">DFS</span> PROJECTIONS
          </h1>
          <p className="text-stone-400 mt-2 text-sm tracking-wide">
            {eventTitle || eventName} — Ownership Guide
          </p>
          <div className="w-32 h-px bg-gradient-to-r from-transparent via-yellow-700 to-transparent mx-auto mt-3" />
        </div>

        {error && <p className="text-red-400 text-center mb-4">{error}</p>}

        {/* ── Section Navigator ── */}
        <div className="sticky top-0 z-20 -mx-4 px-4 bg-stone-950/95 backdrop-blur-sm border-b border-stone-800 mb-8 py-2">
          <div className="flex items-center justify-center gap-1 flex-wrap max-w-6xl mx-auto">
            <span className="text-stone-600 text-[10px] tracking-widest uppercase mr-2 hidden sm:inline">
              Jump to:
            </span>
            {[
              { label: "📊 Chart", id: "section-chart", key: "chart" },
              {
                label: "📋 Projections",
                id: "section-table",
                key: "table",
              },
              {
                label: "🔍 Matchup Intel",
                id: "section-matchup",
                key: "matchupIntel",
              },
              {
                label: "⚙️ Optimizer",
                id: "section-optimizer",
                key: "optimizer",
              },
            ].map(({ label, id, key }) => (
              <button
                key={id}
                onClick={() => {
                  if (key === "matchupIntel") setFocusedFightId(null);
                  openAndScroll(id, key);
                }}
                className="px-3 py-1 rounded text-[11px] font-semibold tracking-wide text-stone-400 hover:text-yellow-400 hover:bg-stone-800 transition whitespace-nowrap"
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Bar Chart ── */}
        {top10Chart.length > 0 && (
          <section id="section-chart" className="mb-10">
            <div
              className="flex items-center gap-3 mb-5 cursor-pointer group"
              onClick={() => toggleSection("chart")}
              title={openSections.chart ? "Collapse section" : "Expand section"}
            >
              <div className="h-px flex-1 bg-yellow-700/30 group-hover:bg-yellow-700/60 transition" />
              <span className="text-xs font-bold tracking-[0.4em] uppercase text-yellow-600 group-hover:text-yellow-400 transition">
                TOP 10 DFS PROJECTIONS
              </span>
              <span className="text-yellow-700 group-hover:text-yellow-400 transition text-xs ml-1">
                {openSections.chart ? "▲" : "▼"}
              </span>
              <div className="h-px flex-1 bg-yellow-700/30 group-hover:bg-yellow-700/60 transition" />
            </div>
            {openSections.chart && (
              <>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart
                    data={top10Chart}
                    margin={{ top: 5, right: 20, left: 0, bottom: 60 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis
                      dataKey="fighter"
                      tick={{ fill: "#9ca3af", fontSize: 11 }}
                      angle={-35}
                      textAnchor="end"
                      interval={0}
                    />
                    <YAxis tick={{ fill: "#9ca3af", fontSize: 11 }} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="projMid" radius={[4, 4, 0, 0]}>
                      {top10Chart.map((entry, i) => (
                        <Cell
                          key={i}
                          fill={
                            entry.ownerNum >= 28
                              ? "#7f1d1d"
                              : entry.projMid / (entry.salary / 1000) >
                                  (avgProjMid / (avgSalary / 1000)) * 1.15
                                ? "#14532d"
                                : "#1e3a5f"
                          }
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
                <div className="flex gap-4 justify-center text-xs text-stone-400 mt-2">
                  <span>
                    <span
                      className="inline-block w-3 h-3 rounded mr-1"
                      style={{ backgroundColor: "#14532d" }}
                    />
                    Value play
                  </span>
                  <span>
                    <span
                      className="inline-block w-3 h-3 rounded mr-1"
                      style={{ backgroundColor: "#1e3a5f" }}
                    />
                    Standard
                  </span>
                  <span>
                    <span
                      className="inline-block w-3 h-3 rounded mr-1"
                      style={{ backgroundColor: "#7f1d1d" }}
                    />
                    High-own fade risk
                  </span>
                </div>
              </>
            )}
          </section>
        )}

        {/* ── Table ── */}
        <section id="section-table" className="mb-12">
          <div
            className="flex items-center gap-3 mb-4 cursor-pointer group"
            onClick={() => toggleSection("table")}
            title={openSections.table ? "Collapse section" : "Expand section"}
          >
            <div className="h-px flex-1 bg-yellow-700/30 group-hover:bg-yellow-700/60 transition" />
            <span className="text-xs font-bold tracking-[0.4em] uppercase text-yellow-600 group-hover:text-yellow-400 transition">
              FULL CARD PROJECTIONS
            </span>
            <span className="text-yellow-700 group-hover:text-yellow-400 transition text-xs ml-1">
              {openSections.table ? "▲" : "▼"}
            </span>
            <div className="h-px flex-1 bg-yellow-700/30 group-hover:bg-yellow-700/60 transition" />
          </div>
          {openSections.table && (
            <>
              <p className="text-stone-400 mb-4 text-center text-sm">
                Projections use DK historical avg when available, scaled to
                expected fight length. Green rows = value plays · Red rows =
                high-own fade candidates.
              </p>
              <div className="md:hidden space-y-3">
                {sorted.map((pick, i) => (
                  <article
                    key={`mobile-${i}`}
                    className={`mobile-data-card ${rowClass(pick, avgProjMid, avgSalary)}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-base font-bold text-stone-100 leading-snug">
                          {pick.fighter}
                        </p>
                        <p className="text-xs text-stone-500 mt-0.5">
                          Salary ${pick.salary.toLocaleString()} · ~
                          {pick.rounds}R ({pick.roundsSource})
                        </p>
                      </div>
                      <span
                        className={`px-2 py-1 rounded text-xs font-bold ${
                          pick.type === "Stud"
                            ? "bg-yellow-700 text-yellow-100"
                            : "bg-stone-700 text-stone-200"
                        }`}
                      >
                        {pick.type}
                      </span>
                    </div>

                    <div className="mobile-kv-row mt-2">
                      <span className="mobile-kv-label">Projection</span>
                      <span className="mobile-kv-value text-yellow-400">
                        {pick.projection}
                      </span>
                    </div>
                    <div className="mobile-kv-row">
                      <span className="mobile-kv-label">Ownership</span>
                      <span
                        className={`px-2 py-0.5 rounded text-xs font-semibold ${
                          pick.ownerNum >= 28
                            ? "bg-red-800 text-red-100"
                            : pick.ownerNum <= 10
                              ? "bg-green-800 text-green-100"
                              : "bg-stone-700 text-stone-200"
                        }`}
                      >
                        {pick.ownership}
                      </span>
                    </div>

                    <details className="mt-2 rounded border border-stone-700/80 bg-stone-950/60">
                      <summary
                        className="px-3 py-2 text-xs tracking-wider uppercase text-yellow-500"
                        aria-label={`Show reasoning for ${pick.fighter}`}
                      >
                        Reasoning
                      </summary>
                      <div className="px-3 pb-3 text-xs text-stone-300 leading-relaxed">
                        {pick.reasoning}
                        {backendProj[pick.fighter] && (
                          <div className="mt-2 pt-2 border-t border-stone-700/50">
                            <span className="text-yellow-600 text-[10px] uppercase tracking-wider font-bold">
                              Matchup Analysis:
                            </span>
                            <p className="text-stone-400 mt-1">
                              {backendProj[pick.fighter].reasoning}
                            </p>
                            <div className="flex flex-wrap gap-2 mt-1 text-[10px] text-stone-500">
                              <span>
                                Striking:{" "}
                                <span className="text-yellow-500">
                                  {
                                    backendProj[pick.fighter].proj_components
                                      .striking
                                  }
                                </span>
                              </span>
                              <span>
                                Grappling:{" "}
                                <span className="text-yellow-500">
                                  {
                                    backendProj[pick.fighter].proj_components
                                      .grappling
                                  }
                                </span>
                              </span>
                              <span>
                                Win bonus:{" "}
                                <span className="text-yellow-500">
                                  {
                                    backendProj[pick.fighter].proj_components
                                      .win_bonus
                                  }
                                </span>
                              </span>
                              <span>
                                Finish%:{" "}
                                <span className="text-stone-300">
                                  {(
                                    backendProj[pick.fighter].finish_prob * 100
                                  ).toFixed(0)}
                                  %
                                </span>
                              </span>
                            </div>
                          </div>
                        )}
                        <a
                          href={`#${pick.fightAnchor}`}
                          onClick={(e) =>
                            openMatchupIntelFight(pick.fightAnchor, e)
                          }
                          className="inline-block mt-2 text-[10px] text-yellow-600 hover:text-yellow-400 underline underline-offset-2"
                        >
                          View matchup intel
                        </a>
                      </div>
                    </details>

                    <div className="grid grid-cols-2 gap-2 mt-3">
                      <button
                        onClick={() => toggleLock(pick.fighter)}
                        title="Lock into lineup"
                        className={`min-h-[42px] text-sm rounded font-bold transition ${
                          locked.has(pick.fighter)
                            ? "bg-yellow-500 text-stone-950"
                            : "bg-stone-700 text-stone-300 hover:bg-yellow-700 hover:text-stone-100"
                        }`}
                      >
                        🔒 Lock
                      </button>
                      <button
                        onClick={() => toggleExclude(pick.fighter)}
                        title="Exclude from lineup"
                        className={`min-h-[42px] text-sm rounded font-bold transition ${
                          excluded.has(pick.fighter)
                            ? "bg-red-600 text-stone-100"
                            : "bg-stone-700 text-stone-300 hover:bg-red-900 hover:text-stone-100"
                        }`}
                      >
                        ✕ Exclude
                      </button>
                    </div>
                  </article>
                ))}
              </div>

              <p className="hidden md:block text-center text-[11px] text-stone-500 mb-2">
                Scroll horizontally to view all columns. Lock/Excl stay pinned
                on the right.
              </p>
              <div className="-mx-4 sm:mx-0 overflow-x-auto hidden md:block relative">
                <table className="w-full text-stone-300 border-collapse text-sm">
                  <thead>
                    <tr className="bg-stone-800/90 text-stone-200">
                      <SortTh col="fighter" label="Fighter" />
                      <SortTh col="salary" label="DK Salary" />
                      <SortTh col="type" label="Type" />
                      <SortTh col="projMid" label="Projection" />
                      <SortTh col="pointsPerThousand" label="Value ($/k)" />
                      <SortTh col="ownerNum" label="Own. Est." />
                      <SortTh col="winProb" label="Win % Est." />
                      <th className="p-2 border border-stone-700">
                        Rounds Est.
                      </th>
                      <th className="p-2 border border-stone-700 min-w-[360px] pr-32">
                        Reasoning
                      </th>
                      <th
                        className="p-1 border border-stone-700 text-center text-xs sticky right-12 bg-stone-800 z-20 w-12 min-w-12 max-w-12"
                        style={{ boxShadow: "inset 1px 0 0 #44403c" }}
                      >
                        Lock
                      </th>
                      <th
                        className="p-1 border border-stone-700 text-center text-xs sticky right-0 bg-stone-800 z-20 w-12 min-w-12 max-w-12"
                        style={{
                          boxShadow:
                            "inset 1px 0 0 #44403c, inset -1px 0 0 #44403c",
                        }}
                      >
                        Excl
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {sorted.map((pick, i) => (
                      <tr
                        key={i}
                        className={`border-b transition ${rowClass(pick, avgProjMid, avgSalary)}`}
                      >
                        <td className="p-2 border border-stone-700 font-semibold text-stone-100">
                          {pick.fighter}
                        </td>
                        <td className="p-2 border border-stone-700 text-yellow-500/80 whitespace-nowrap w-[104px] min-w-[104px]">
                          ${pick.salary.toLocaleString()}
                        </td>
                        <td className="p-2 border border-stone-700">
                          <span
                            className={`px-2 py-0.5 rounded text-xs font-bold ${
                              pick.type === "Stud"
                                ? "bg-yellow-700 text-yellow-100"
                                : "bg-stone-700 text-stone-200"
                            }`}
                          >
                            {pick.type}
                          </span>
                        </td>
                        <td className="p-2 border border-stone-700 font-mono font-bold text-yellow-400">
                          {pick.projection}
                        </td>
                        <td className="p-2 border border-stone-700 font-mono text-green-400">
                          {pick.pointsPerThousand.toFixed(2)}
                        </td>
                        <td className="p-2 border border-stone-700 whitespace-nowrap w-[108px] min-w-[108px]">
                          <span
                            className={`px-2 py-0.5 rounded text-xs font-semibold ${
                              pick.ownerNum >= 28
                                ? "bg-red-800 text-red-100"
                                : pick.ownerNum <= 10
                                  ? "bg-green-800 text-green-100"
                                  : "bg-stone-700 text-stone-200"
                            }`}
                          >
                            {pick.ownership}
                          </span>
                        </td>
                        <td className="p-2 border border-stone-700 text-center">
                          {(pick.winProb * 100).toFixed(0)}%
                        </td>
                        <td
                          className="p-2 border border-stone-700 text-center text-xs"
                          title={`Rounds estimate source: ${pick.roundsSource}`}
                        >
                          <span className="text-stone-300">
                            ~{pick.rounds}R
                          </span>
                          <br />
                          <span className="text-stone-500">
                            {pick.roundsSource}
                          </span>
                        </td>
                        <td className="p-2 pr-32 border border-stone-700 text-xs text-stone-300 leading-relaxed min-w-[360px]">
                          {pick.reasoning}{" "}
                          {backendProj[pick.fighter] && (
                            <span
                              className="text-yellow-600/70"
                              title={backendProj[pick.fighter].reasoning}
                            >
                              | Matchup proj:{" "}
                              {backendProj[pick.fighter].proj_fppg.toFixed(1)}{" "}
                              pts (Fin{" "}
                              {(
                                backendProj[pick.fighter].finish_prob * 100
                              ).toFixed(0)}
                              %)
                            </span>
                          )}{" "}
                          <a
                            href={`#${pick.fightAnchor}`}
                            onClick={(e) =>
                              openMatchupIntelFight(pick.fightAnchor, e)
                            }
                            className="inline-block mt-1 text-[10px] text-yellow-600 hover:text-yellow-400 underline underline-offset-2 whitespace-nowrap"
                          >
                            ↓ matchup intel
                          </a>
                        </td>
                        <td
                          className="p-1 border border-stone-700 text-center sticky right-12 bg-stone-900 z-30 w-12 min-w-12 max-w-12"
                          style={{ boxShadow: "inset 1px 0 0 #44403c" }}
                        >
                          <button
                            onClick={() => toggleLock(pick.fighter)}
                            title="Lock into lineup"
                            className={`text-xs px-2 py-0.5 rounded font-bold transition ${
                              locked.has(pick.fighter)
                                ? "bg-yellow-500 text-stone-950"
                                : "bg-stone-700 text-stone-400 hover:bg-yellow-700 hover:text-stone-100"
                            }`}
                          >
                            🔒
                          </button>
                        </td>
                        <td
                          className="p-1 border border-stone-700 text-center sticky right-0 bg-stone-900 z-30 w-12 min-w-12 max-w-12"
                          style={{
                            boxShadow:
                              "inset 1px 0 0 #44403c, inset -1px 0 0 #44403c",
                          }}
                        >
                          <button
                            onClick={() => toggleExclude(pick.fighter)}
                            title="Exclude from lineup"
                            className={`text-xs px-2 py-0.5 rounded font-bold transition ${
                              excluded.has(pick.fighter)
                                ? "bg-red-600 text-stone-100"
                                : "bg-stone-700 text-stone-400 hover:bg-red-900 hover:text-stone-100"
                            }`}
                          >
                            ✕
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-stone-500 mt-3 text-center text-xs">
                * For entertainment only. Projections based on career DK
                averages &amp; UFCStats. Ownership estimates are conceptual, not
                sourced from live data.
              </p>
            </>
          )}
        </section>

        {/* ── Matchup Intel ── */}
        <section id="section-matchup" className="mb-12">
          <div
            className="flex items-center gap-3 mb-4 cursor-pointer group"
            onClick={() => toggleSection("matchupIntel")}
            title={
              openSections.matchupIntel ? "Collapse section" : "Expand section"
            }
          >
            <div className="h-px flex-1 bg-yellow-700/30 group-hover:bg-yellow-700/60 transition" />
            <span className="text-xs font-bold tracking-[0.4em] uppercase text-yellow-600 group-hover:text-yellow-400 transition">
              MATCHUP INTEL
            </span>
            <span className="text-yellow-700 group-hover:text-yellow-400 transition text-xs ml-1">
              {openSections.matchupIntel ? "▲" : "▼"}
            </span>
            <div className="h-px flex-1 bg-yellow-700/30 group-hover:bg-yellow-700/60 transition" />
          </div>
          {!openSections.matchupIntel && (
            <p className="text-stone-500 text-center text-xs mb-2">
              Strike, wrestling &amp; submission vulnerability breakdown for
              each fight. Click the header to expand.
            </p>
          )}
          {openSections.matchupIntel && (
            <MatchupIntel
              fights={fights}
              focusFightId={focusedFightId}
              onClearFocus={() => setFocusedFightId(null)}
            />
          )}
        </section>

        {/* ── Lineup Optimizer ── */}
        <section id="section-optimizer" className="mb-12">
          <div
            className="flex items-center gap-3 mb-3 cursor-pointer group"
            onClick={() => toggleSection("optimizer")}
            title={
              openSections.optimizer ? "Collapse section" : "Expand section"
            }
          >
            <div className="h-px flex-1 bg-yellow-700/30 group-hover:bg-yellow-700/60 transition" />
            <span className="text-xs font-bold tracking-[0.4em] uppercase text-yellow-600 group-hover:text-yellow-400 transition">
              LINEUP OPTIMIZER
            </span>
            <span className="text-yellow-700 group-hover:text-yellow-400 transition text-xs ml-1">
              {openSections.optimizer ? "▲" : "▼"}
            </span>
            <div className="h-px flex-1 bg-yellow-700/30 group-hover:bg-yellow-700/60 transition" />
          </div>
          {openSections.optimizer && (
            <>
              <p className="text-stone-400 text-center text-sm mb-4">
                Lock 🔒 fighters to force them in. Exclude ✕ fighters to leave
                them out. Then build the highest-projected lineup under $50K.
              </p>

              {/* Exposure slider — only relevant for multi-lineup builds */}
              <div className="flex flex-col items-center mb-5">
                <label className="text-stone-300 text-sm mb-1">
                  Max Exposure per Fighter:{" "}
                  <span className="text-yellow-400 font-bold">
                    {exposureLimit}%
                  </span>
                  <span className="text-stone-500 text-xs ml-2">
                    (
                    {exposureLimit === 100
                      ? "no limit"
                      : `appears in ≤${Math.ceil((5 * exposureLimit) / 100)} of 5 lineups`}
                    )
                  </span>
                </label>
                <input
                  type="range"
                  min="20"
                  max="100"
                  step="10"
                  value={exposureLimit}
                  onChange={(e) => setExposureLimit(Number(e.target.value))}
                  className="w-64 accent-yellow-500"
                />
                <div className="flex justify-between w-64 text-xs text-stone-500 mt-0.5">
                  <span>20% (very diverse)</span>
                  <span>100% (no limit)</span>
                </div>
              </div>
              {(locked.size > 0 || excluded.size > 0) && (
                <div className="flex flex-wrap gap-2 justify-center mb-4">
                  {[...locked].map((name) => (
                    <span
                      key={name}
                      className="px-2 py-0.5 rounded bg-yellow-700 text-yellow-100 text-xs font-semibold"
                    >
                      🔒 {name}
                    </span>
                  ))}
                  {[...excluded].map((name) => (
                    <span
                      key={name}
                      className="px-2 py-0.5 rounded bg-red-800 text-red-200 text-xs font-semibold"
                    >
                      ✕ {name}
                    </span>
                  ))}
                  <button
                    onClick={() => {
                      setLocked(new Set());
                      setExcluded(new Set());
                    }}
                    className="px-2 py-0.5 rounded bg-stone-700 text-stone-300 text-xs hover:bg-stone-600"
                  >
                    Clear all
                  </button>
                </div>
              )}
              <div className="flex gap-3 justify-center mb-6 flex-wrap">
                <button onClick={() => runOptimizer(1)} className="neon-button">
                  Build Optimal Lineup
                </button>
                <button
                  onClick={() => runOptimizer(5)}
                  className="neon-button bg-gray-700 hover:bg-gray-600"
                >
                  Build 5 Diverse Lineups
                </button>
                {optimalLineups.length > 0 && (
                  <button
                    onClick={downloadOptimalCSV}
                    className="neon-button bg-green-900 hover:bg-green-800"
                  >
                    Download CSV
                  </button>
                )}
              </div>
              {optimizerError && (
                <p className="text-red-400 text-center text-sm mb-4">
                  {optimizerError}
                </p>
              )}
              {optimalLineups.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {optimalLineups.map((lineup, idx) => (
                    <div
                      key={idx}
                      className="bg-stone-900 border border-yellow-700/40 rounded-lg p-4"
                    >
                      <h3 className="text-yellow-500 font-bold mb-2 tracking-widest uppercase text-xs">
                        {optimalLineups.length === 1
                          ? "Optimal Lineup"
                          : `Lineup ${idx + 1}`}
                      </h3>
                      <ul className="space-y-1 mb-3">
                        {lineup.team.map((f, fi) => (
                          <li key={fi} className="flex justify-between text-sm">
                            <span
                              className={`font-semibold ${locked.has(f.fighter) ? "text-yellow-400" : "text-stone-100"}`}
                            >
                              {f.fighter}
                              {locked.has(f.fighter) ? " 🔒" : ""}
                            </span>
                            <span className="text-stone-400">
                              ${f.salary.toLocaleString()} · {f.projMid} pts
                            </span>
                          </li>
                        ))}
                      </ul>
                      <div className="flex justify-between text-xs text-stone-400 border-t border-stone-700 pt-2">
                        <span>
                          Total Salary:{" "}
                          <span className="text-stone-100 font-bold">
                            ${lineup.totalSalary.toLocaleString()}
                          </span>
                        </span>
                        <span>
                          Proj Pts:{" "}
                          <span className="text-yellow-400 font-bold">
                            {lineup.totalPoints}
                          </span>
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
};

export default DFSPicksProjections;
