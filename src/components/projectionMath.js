/**
 * projectionMath.js — DFS projection math functions (no React, no side effects).
 *
 * Exports:
 *   parseRoundsLine(bettingOdds)          — extract O/U rounds from betting_odds obj
 *   estimateFightRounds(f1, f2, bo)       — estimate expected rounds (with source tag)
 *   computeProjection(fighter, rounds, source) — build projLo/projMid/projHi object
 *   estimateWinProbability(fighter, bo)   — moneyline → 0–1 probability
 *
 * Internal helpers (not exported):
 *   avgRoundsFromDuration(fighter) — avg_fight_duration in minutes ÷ 5
 *   avgRoundsFromStyle(fighter)    — finish-rate based round estimate
 *
 * Used by:  DFSPicksProjections.jsx
 * Rollback: Delete this file and restore DFSPicksProjections_ORIGINAL_PRESPLIT.jsx
 *           from _archive/src_components/
 */

// Parse over/under rounds line from a betting_odds object.
// Handles strings like "O2.5", "2.5", or numeric values.
export const parseRoundsLine = (bo) => {
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
export const estimateFightRounds = (fighter1, fighter2, bettingOdds) => {
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
export const computeProjection = (fighter, roundsEst, roundsSource) => {
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

  // Stat-based fallback for fighters with no DK history. Some scraped profiles
  // can have extreme single-fight outliers (e.g. TD avg > 20), so clamp to
  // sane UFC ranges before projecting.
  const rawSlpm = fighter.stats?.slpm || 0;
  const rawTdAvg = fighter.stats?.td_avg || 0;
  const slpm = Math.min(Math.max(rawSlpm, 0), 10);
  const tdAvg = Math.min(Math.max(rawTdAvg, 0), 6);

  const strikingPoints = slpm * 5 * rounds * 0.45;
  const wrestlingPoints = tdAvg * rounds * 5;
  const base = strikingPoints + wrestlingPoints + 20;
  return {
    projLo: Math.round(base * 0.85),
    projHi: Math.round(base * 1.15),
    projMid: Math.round(base),
    rounds,
    roundsSource,
    source:
      rawSlpm !== slpm || rawTdAvg !== tdAvg
        ? "stat estimate (capped)"
        : "stat estimate",
  };
};

// Estimate win probability from betting odds (moneyline)
export const estimateWinProbability = (fighter, bettingOdds = {}) => {
  const { moneyline } = bettingOdds;
  if (!moneyline) return 0.5;
  const [mlF1, mlF2] = moneyline.split(" ");
  const odds = fighter.name.includes(mlF1)
    ? parseFloat(mlF1)
    : parseFloat(mlF2);
  if (isNaN(odds)) return 0.5;
  // Convert American odds to probability
  return odds < 0
    ? Math.abs(odds) / (Math.abs(odds) + 100)
    : 100 / (odds + 100);
};

