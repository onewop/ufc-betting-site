import React, { useState, useEffect, useMemo } from "react";
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

// ─── Projection ────────────────────────────────────────────────────────────
// Parse over/under rounds line from a betting_odds object.
// Handles strings like "O2.5", "2.5", or numeric values.
const parseRoundsLine = (bo) => {
  if (!bo) return null;
  const raw = bo.over_under_rounds;
  if (!raw || raw === "N/A") return null;
  const m = String(raw).match(/(\d+(\.\d+)?)/);
  return m ? parseFloat(m[1]) : null;
};

// Convert a fighter's avg_fight_duration (minutes) to rounds.
// 1 UFC round = 5 minutes. Returns null when data is unavailable.
const avgRoundsFromDuration = (fighter) => {
  const dur = fighter.avg_fight_duration;
  if (dur && typeof dur === "number" && dur > 0) {
    return Math.min(Math.max(dur / 5, 1.0), 3.0);
  }
  return null;
};

// Estimate expected rounds from a fighter's finish rate and win breakdown.
// High finishers end fights earlier; decision fighters go the distance.
const avgRoundsFromStyle = (fighter) => {
  const finRate = parseFloat(fighter.finish_rate_pct);
  if (!isNaN(finRate)) {
    if (finRate >= 70) return 1.5;
    if (finRate >= 50) return 2.0;
    if (finRate >= 25) return 2.5;
    return 3.0;
  }
  // Fall back to computing finish rate from wins breakdown
  const koW = fighter.wins_ko_tko || 0;
  const subW = fighter.wins_submission || 0;
  const decW = fighter.wins_decision || 0;
  const totalW = koW + subW + decW;
  if (totalW > 0) {
    const calcFR = ((koW + subW) / totalW) * 100;
    if (calcFR >= 70) return 1.5;
    if (calcFR >= 50) return 2.0;
    if (calcFR >= 25) return 2.5;
    return 3.0;
  }
  return null;
};

// Estimate expected rounds for a fight using both fighters' data.
// Priority order (highest → lowest):
//   1. betting_odds.over_under_rounds — set by scraper when live O/U is available
//   2. Average of both fighters' avg_fight_duration ÷ 5 min/round (historical)
//   3. Finish-rate / win-style estimate averaged across both fighters
//   4. Ultimate fallback: 2.5 rounds (UFC main-card standard)
const estimateFightRounds = (fighter1, fighter2, bettingOdds) => {
  // 1. Live odds over/under (populated once scraper enriches betting_odds)
  const oddsLine = parseRoundsLine(bettingOdds);
  if (oddsLine !== null) {
    console.log(
      `[Rounds] ${fighter1?.name}/${fighter2?.name} — odds O/U: ${oddsLine}`,
    );
    return { rounds: oddsLine, roundsSource: "odds O/U" };
  }

  // 2. Historical avg_fight_duration (minutes ÷ 5 = rounds)
  const dur1 = avgRoundsFromDuration(fighter1 || {});
  const dur2 = fighter2 ? avgRoundsFromDuration(fighter2) : null;
  if (dur1 !== null || dur2 !== null) {
    const vals = [dur1, dur2].filter((v) => v !== null);
    const avg = vals.reduce((s, v) => s + v, 0) / vals.length;
    const rounds = Math.round(avg * 10) / 10;
    console.log(
      `[Rounds] ${fighter1?.name}/${fighter2?.name} — duration-based: ${rounds}R` +
        ` (f1: ${dur1?.toFixed(1) ?? "N/A"}, f2: ${dur2?.toFixed(1) ?? "N/A"})`,
    );
    return { rounds, roundsSource: "historical" };
  }

  // 3. Style / finish-rate based (covers fighters missing avg_fight_duration)
  const style1 = avgRoundsFromStyle(fighter1 || {});
  const style2 = fighter2 ? avgRoundsFromStyle(fighter2) : null;
  if (style1 !== null || style2 !== null) {
    const vals = [style1, style2].filter((v) => v !== null);
    const avg = vals.reduce((s, v) => s + v, 0) / vals.length;
    const rounds = Math.round(avg * 10) / 10;
    console.log(
      `[Rounds] ${fighter1?.name}/${fighter2?.name} — style-based: ${rounds}R`,
    );
    return { rounds, roundsSource: "style est." };
  }

  // 4. Fallback
  console.log(
    `[Rounds] ${fighter1?.name}/${fighter2?.name} — using default 2.5`,
  );
  return { rounds: 2.5, roundsSource: "default" };
};

// roundsEst: fight-level rounds estimate from estimateFightRounds()
// roundsSource: string describing the origin of the estimate (for UI display)
const computeProjection = (fighter, roundsEst, roundsSource) => {
  const rounds = roundsEst;
  const avg = fighter.avgPointsPerGame;

  if (avg && avg > 0) {
    // Scale historic DK avg by expected fight length (avg fight ~2.5 rounds)
    const scale = rounds / 2.5;
    const base = avg * scale;
    return {
      projLo: Math.round(base * 0.85),
      projHi: Math.round(base * 1.15),
      projMid: Math.round(base),
      rounds,
      roundsSource,
      source: "DK avg",
    };
  }

  // Stat-based fallback: SLpM × 5 min/round × rounds × 0.45 DK pts/strike
  //                    + TD avg × rounds × 5 DK pts
  //                    + 20 base
  const slpm = fighter.stats?.slpm || 0;
  const tdAvg = fighter.stats?.td_avg || 0;
  const base = slpm * 5 * rounds * 0.45 + tdAvg * rounds * 5 + 20;
  return {
    projLo: Math.round(base * 0.85),
    projHi: Math.round(base * 1.15),
    projMid: Math.round(base),
    rounds,
    roundsSource,
    source: "stat estimate",
  };
};

// ─── Ownership ─────────────────────────────────────────────────────────────
const estimateOwnership = (salary, avgPPG, medianSalary, medianPPG) => {
  const salaryPct = salary / (medianSalary || salary);
  const ppgPct = (avgPPG || 0) / (medianPPG || 1);

  if (salary >= 9000 && ppgPct >= 1.2) return { label: "30–40%", ownerNum: 35 };
  if (salary >= 8500 && ppgPct >= 1.0) return { label: "20–30%", ownerNum: 25 };
  if (salary >= 8000) return { label: "15–25%", ownerNum: 20 };
  if (salary >= 7000 && ppgPct >= 1.1) return { label: "10–18%", ownerNum: 14 };
  if (salary >= 7000) return { label: "8–15%", ownerNum: 11 };
  if (salaryPct < 0.85) return { label: "5–10%", ownerNum: 7 };
  return { label: "5–12%", ownerNum: 8 };
};

// ─── Narrative Reasoning ───────────────────────────────────────────────────
// Added submission wins, KO/TKO, and decision breakdown to reasoning for
// better DFS context. Finish types are now combined into one summary phrase
// instead of showing only one category at a time.
// Data priority: wins_ko_tko / wins_submission / wins_decision from the
// fighter object (populated from this_weeks_stats.json enrichment), then
// finish_rate_pct. Falls back to generic phrases when data is missing.
const buildReasoning = (fighter, projMid, ownerNum) => {
  const parts = [];
  const avg = fighter.avgPointsPerGame;
  const slpm = fighter.stats?.slpm;
  const tdAvg = fighter.stats?.td_avg;
  const koWins = fighter.wins_ko_tko || 0;
  const subWins = fighter.wins_submission || 0;
  const decWins = fighter.wins_decision || 0;
  const finRate = fighter.finish_rate_pct;
  const streak = fighter.current_win_streak;

  if (avg && avg > 0) {
    parts.push(`Averaging ${avg} DK pts/game historically`);
  } else if (avg === 0) {
    // avgPointsPerGame of exactly 0 means no DraftKings game history exists,
    // not a real score of zero — fall through to stat-based description.
    parts.push(
      slpm
        ? `No DK history — ${slpm} SLpM (stat-based estimate)`
        : "No DK history",
    );
  } else if (slpm) {
    parts.push(`${slpm} SLpM striking output`);
  }

  // Build a combined finish-type summary so KO and submission wins are both
  // visible — both score high DFS points and users need to see both at once.
  const hasFinishData = koWins > 0 || subWins > 0 || decWins > 0;
  if (hasFinishData) {
    const totalWins = koWins + subWins + decWins;
    const finishParts = [];
    if (koWins > 0) finishParts.push(`${koWins} KO/TKO`);
    if (subWins > 0) finishParts.push(`${subWins} sub`);
    if (decWins > 0) finishParts.push(`${decWins} dec`);

    if (koWins === 0 && subWins === 0 && decWins > 0) {
      // Pure decision fighter — flag it as that style
      parts.push(`decision specialist (${decWins}/${totalWins} wins by dec)`);
    } else if (koWins === 0 && subWins > 0) {
      // Sub-only finisher with no KOs
      parts.push(`submission finisher: ${finishParts.join(", ")} wins`);
    } else {
      // Mixed or KO-led — show all available breakdown
      parts.push(`finishes: ${finishParts.join(", ")} wins`);
    }
  }

  // Add finish rate context when not already implicit from the summary above.
  // High finish rate signals ceiling upside; low rate flags a grinder.
  if (finRate && finRate !== "N/A") {
    const fr = parseFloat(finRate);
    if (fr >= 60) parts.push(`${fr}% finish rate`);
    else if (fr <= 30 && !hasFinishData)
      parts.push(`tends toward decisions (${fr}% finish rate)`);
  }

  if (streak && streak > 1) parts.push(`on a ${streak}-fight win streak`);
  if (tdAvg && tdAvg > 1.5) parts.push(`active wrestler (${tdAvg} TD/15min)`);

  // ── Recent form / loss context ─────────────────────────────────────────
  // Adds a second sentence with loss signals so users can see both ceiling
  // (wins above) and floor/risk (recent form below) at a glance.
  // Source: record_last_5, last_fight_result, current_loss_streak from
  // this_weeks_stats.json. No per-method loss counts are available in the
  // data, so we use last_fight_result (e.g. "L – KO/TKO") as a proxy.
  const formParts = [];
  if (fighter.record_last_5) formParts.push(`last 5: ${fighter.record_last_5}`);
  if (fighter.last_fight_result) {
    // Normalize "L – S-DEC" style separators to a compact "L-S-DEC"
    const compact = fighter.last_fight_result.replace(/\s*[–—-]\s*/g, "-");
    formParts.push(`last fight: ${compact}`);
  }
  const lossStreak = fighter.current_loss_streak || 0;
  if (lossStreak >= 2) formParts.push(`⚠️ ${lossStreak}-fight loss streak`);

  const ownRisk =
    ownerNum >= 28
      ? "⚠️ Very high ownership — consider fading in large fields"
      : ownerNum >= 18
        ? "Moderate ownership risk"
        : "Low ownership — GPP leverage play";

  const offenseLine = parts.length
    ? `${parts.join(", ")}.`
    : `${fighter.record || "N/A"} record.`;
  const formLine = formParts.length ? ` ${formParts.join(" · ")}.` : "";

  return `${offenseLine}${formLine} ${ownRisk}.`;
};

// ─── Matchup Intel ────────────────────────────────────────────────────────
// Parses a "54%" style string into a float (54), or returns null.
const parsePct = (v) => {
  if (v == null) return null;
  const n = parseFloat(String(v).replace("%", ""));
  return isNaN(n) ? null : n;
};

// Evaluate one directional exploit angle for fighter A attacking fighter B.
// Returns { level: 'strong'|'moderate'|'neutral', label, tip }
// Zero values are treated as no data: 0% defense is almost always a small
// sample artifact (0-for-0 attempts) rather than a legitimate vulnerability,
// and 0 attacker output means no attempts recorded, not a real zero.
const evalAngle = (
  label,
  attackerVal,
  defenderDefPct,
  higherIsBetter = true,
) => {
  if (attackerVal == null || defenderDefPct == null)
    return { level: "neutral", label, tip: "No data available" };
  // 0% defense is a small-sample artifact (e.g. their few opponents never
  // attempted takedowns), not a genuine vulnerability — note it but don't
  // flag as an exploit.
  if (defenderDefPct === 0)
    return {
      level: "neutral",
      label,
      tip: `${attackerVal > 0 ? attackerVal : "no data"} output vs 0% defense (small sample — insufficient data)`,
    };
  // 0 attacker output means no attempts on record, not a real zero.
  if (attackerVal === 0)
    return {
      level: "neutral",
      label,
      tip: `No attempts on record vs ${defenderDefPct}% defense`,
    };
  // Vulnerability threshold: defender stops < 65% → weak, < 50% → very weak
  const isWeakDef = defenderDefPct < 65;
  const isVeryWeakDef = defenderDefPct < 50;
  if (isVeryWeakDef) {
    return {
      level: "strong",
      label,
      tip: `${attackerVal} output vs ${defenderDefPct}% defense — clear exploit`,
    };
  }
  if (isWeakDef) {
    return {
      level: "moderate",
      label,
      tip: `${attackerVal} output vs ${defenderDefPct}% defense — potential edge`,
    };
  }
  return {
    level: "neutral",
    label,
    tip: `${attackerVal} output vs ${defenderDefPct}% defense — no clear edge`,
  };
};

// Compute all matchup angles for a fight with two fighter objects.
// Returns array of angle objects from each fighter's perspective.
const computeMatchupAngles = (f1, f2) => {
  const s1 = f1.stats || {};
  const s2 = f2.stats || {};

  const slpm1 = s1.slpm;
  const slpm2 = s2.slpm;
  const strDef1 = parsePct(s1.striking_defense);
  const strDef2 = parsePct(s2.striking_defense);
  const tdAvg1 = s1.td_avg;
  const tdAvg2 = s2.td_avg;
  const tdDef1 = parsePct(s1.td_defense);
  const tdDef2 = parsePct(s2.td_defense);
  const subAtt1 = s1.avg_sub_attempts ?? f1.avg_sub_attempts;
  const subAtt2 = s2.avg_sub_attempts ?? f2.avg_sub_attempts;

  return [
    // ── F1 attacking F2 ──────────────────────────────────────────────────
    {
      attacker: f1.name,
      defender: f2.name,
      angles: [
        evalAngle("Striking", slpm1, strDef2),
        evalAngle("Wrestling", tdAvg1, tdDef2),
        evalAngle("Submissions", subAtt1, tdDef2), // TD def as sub vulnerability proxy
      ],
    },
    // ── F2 attacking F1 ──────────────────────────────────────────────────
    {
      attacker: f2.name,
      defender: f1.name,
      angles: [
        evalAngle("Striking", slpm2, strDef1),
        evalAngle("Wrestling", tdAvg2, tdDef1),
        evalAngle("Submissions", subAtt2, tdDef1),
      ],
    },
  ];
};

// Visual config for each exploit level
const LEVEL_STYLE = {
  strong: {
    dot: "bg-red-500",
    border: "border-red-700/60",
    bg: "bg-red-950/50",
    badge: "bg-red-700 text-red-100",
    icon: "🔴",
    label: "Exploit",
  },
  moderate: {
    dot: "bg-orange-400",
    border: "border-orange-700/50",
    bg: "bg-orange-950/30",
    badge: "bg-orange-800 text-orange-100",
    icon: "🟠",
    label: "Edge",
  },
  neutral: {
    dot: "bg-stone-600",
    border: "border-stone-700",
    bg: "bg-stone-900/40",
    badge: "bg-stone-700 text-stone-300",
    icon: "⚪",
    label: "Even",
  },
};

const MatchupIntel = ({ fights }) => {
  if (!fights || fights.length === 0) return null;
  return (
    <section id="matchup-intel" className="mb-12">
      <div className="flex items-center gap-3 mb-2">
        <div className="h-px flex-1 bg-yellow-700/30" />
        <span className="text-xs font-bold tracking-[0.4em] uppercase text-yellow-600">
          MATCHUP INTEL
        </span>
        <div className="h-px flex-1 bg-yellow-700/30" />
      </div>
      <p className="text-stone-400 text-center text-sm mb-6">
        Directional exploit analysis per fight.{" "}
        <span className="text-red-400">🔴 Exploit</span> = attacker has real
        edge over defender's weakness.{" "}
        <span className="text-orange-400">🟠 Edge</span> = some advantage.{" "}
        <span className="text-stone-400">⚪ Even</span> = no clear edge.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {fights.map((fight) => {
          const [f1, f2] = fight.fighters || [];
          if (!f1 || !f2) return null;
          const directions = computeMatchupAngles(f1, f2);
          // Determine overall fight-level danger color for the card border
          const hasStrong = directions.some((d) =>
            d.angles.some((a) => a.level === "strong"),
          );
          const hasModerate = directions.some((d) =>
            d.angles.some((a) => a.level === "moderate"),
          );
          const cardBorder = hasStrong
            ? "border-red-700/60"
            : hasModerate
              ? "border-orange-700/50"
              : "border-stone-700/60";

          return (
            <div
              key={fight.fight_id}
              id={`fight-${fight.fight_id}`}
              className={`bg-stone-900 rounded-lg border ${cardBorder} p-4`}
            >
              {/* Fight header */}
              <div className="flex items-center justify-between mb-3">
                <span className="text-stone-100 font-bold text-sm">
                  {f1.name}
                  <span className="text-stone-500 mx-2">vs</span>
                  {f2.name}
                </span>
                {hasStrong && (
                  <span className="text-xs bg-red-800 text-red-100 px-2 py-0.5 rounded font-bold">
                    ⚠ Exploit Found
                  </span>
                )}
              </div>

              {/* Directional angle rows */}
              {directions.map((dir, di) => {
                const topAngles = dir.angles.filter(
                  (a) => a.level !== "neutral",
                );
                if (topAngles.length === 0) return null;
                return (
                  <div key={di} className="mb-3">
                    <p className="text-xs text-stone-400 mb-1 font-semibold">
                      {dir.attacker}{" "}
                      <span className="text-stone-600">exploiting</span>{" "}
                      {dir.defender}
                    </p>
                    <div className="flex flex-col gap-1">
                      {dir.angles.map((angle, ai) => {
                        const style = LEVEL_STYLE[angle.level];
                        return (
                          <div
                            key={ai}
                            className={`flex items-center gap-2 rounded px-2 py-1 ${style.bg} border ${style.border}`}
                          >
                            <span
                              className={`w-2 h-2 rounded-full flex-shrink-0 ${style.dot}`}
                            />
                            <span className="text-xs text-stone-300 flex-1">
                              <span className="font-semibold text-stone-100">
                                {angle.label}
                              </span>
                              {" — "}
                              {angle.tip}
                            </span>
                            <span
                              className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${style.badge}`}
                            >
                              {style.label}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}

              {/* DFS angle summary */}
              {(() => {
                const allStrong = directions.flatMap((d) =>
                  d.angles
                    .filter((a) => a.level === "strong")
                    .map((a) => `${d.attacker}'s ${a.label.toLowerCase()}`),
                );
                if (allStrong.length === 0) return null;
                return (
                  <p className="text-xs text-yellow-400/80 mt-2 border-t border-stone-700 pt-2">
                    💡 DFS angle: Target {allStrong.join(" and ")}.
                  </p>
                );
              })()}
            </div>
          );
        })}
      </div>
    </section>
  );
};

// ─── Row colour ────────────────────────────────────────────────────────────
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
      50
    );
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

      <div className="max-w-6xl mx-auto px-4 py-10">
        {/* Page header */}
        <div className="text-center mb-8">
          <p className="text-xs text-stone-500 tracking-[0.5em] uppercase mb-2">
            ◆ OPERATION COMBAT VAULT — PROJECTIONS INTEL ◆
          </p>
          <h1
            className="text-4xl md:text-5xl font-black text-stone-100 tracking-wider uppercase"
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
              { label: "🎥 Videos", id: "section-videos", key: null },
            ].map(({ label, id, key }) => (
              <button
                key={id}
                onClick={() => openAndScroll(id, key)}
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
                <span className="inline-block w-3 h-3 bg-green-900 rounded mr-1" />
                Value play
              </span>
              <span>
                <span className="inline-block w-3 h-3 bg-yellow-900 rounded mr-1" />
                Standard
              </span>
              <span>
                <span className="inline-block w-3 h-3 bg-red-900 rounded mr-1" />
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
            Projections use DK historical avg when available, scaled to expected
            fight length. Green rows = value plays · Red rows = high-own fade
            candidates.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-stone-300 border-collapse text-sm">
              <thead>
                <tr className="bg-stone-800/90 text-stone-200">
                  <SortTh col="fighter" label="Fighter" />
                  <SortTh col="salary" label="DK (DraftKings) Salary" />
                  <SortTh col="type" label="Type" />
                  <SortTh col="projMid" label="Projection" />
                  <SortTh
                    col="ownerNum"
                    label="Own. Est. (Ownership Estimate)"
                  />
                  <th className="p-2 border border-stone-700">Rounds Est.</th>
                  <th className="p-2 border border-stone-700 min-w-[260px]">
                    Reasoning
                  </th>
                  <th className="p-2 border border-stone-700 text-center text-xs">
                    Lock
                  </th>
                  <th className="p-2 border border-stone-700 text-center text-xs">
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
                    <td className="p-2 border border-stone-700 text-yellow-500/80">
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
                    <td className="p-2 border border-stone-700">
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
                    <td
                      className="p-2 border border-stone-700 text-center text-xs"
                      title={`Rounds estimate source: ${pick.roundsSource}`}
                    >
                      <span className="text-stone-300">~{pick.rounds}R</span>
                      <br />
                      <span className="text-stone-500">
                        {pick.roundsSource}
                      </span>
                    </td>
                    <td className="p-2 border border-stone-700 text-xs text-stone-300 leading-relaxed">
                      {pick.reasoning}{" "}
                      <a
                        href={`#${pick.fightAnchor}`}
                        className="inline-block mt-1 text-[10px] text-yellow-600 hover:text-yellow-400 underline underline-offset-2 whitespace-nowrap"
                      >
                        ↓ matchup intel
                      </a>
                    </td>
                    <td className="p-2 border border-stone-700 text-center">
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
                    <td className="p-2 border border-stone-700 text-center">
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
            * For entertainment only. Projections based on career DK averages
            &amp; UFCStats. Ownership estimates are conceptual, not sourced from
            live data.
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
              openSections.matchupIntel
                ? "Collapse section"
                : "Expand section"
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
          {openSections.matchupIntel && <MatchupIntel fights={fights} />}
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
            Lock 🔒 fighters to force them in. Exclude ✕ fighters to leave them
            out. Then build the highest-projected lineup under $50K.
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

        {/* ── Video Vault link ── */}
        <section id="section-videos" className="text-center pb-10">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-px flex-1 bg-yellow-700/30" />
            <span className="text-xs font-bold tracking-[0.4em] uppercase text-yellow-600">
              HANDICAPPER BREAKDOWNS
            </span>
            <div className="h-px flex-1 bg-yellow-700/30" />
          </div>
          <p className="text-stone-400 mb-4 text-sm">
            Watch expert fight breakdowns and handicapper picks in the Video
            Vault.
          </p>
          <a href="/video-vault" className="neon-button inline-block">
            Go to Video Vault
          </a>
        </section>
      </div>
    </div>
  );
};

export default DFSPicksProjections;
