/**
 * fightAnalyzerHelpers.js — Matchup-angle helper functions for FightAnalyzer.
 *
 * These pure functions compute the "Matchup Intel" angles shown in FightAnalyzer
 * (and originally duplicated in DFSPicksProjections).  They compare fighter stats
 * to assess striking, wrestling, and submission threat levels.
 *
 * Exported:
 *   _parsePct(v)                          — parse a "64%" string to 64.0 or null
 *   _evalAngle(label, attackerVal, defPct) — rate one stat matchup angle
 *   _evalSubAngle(...)                     — rate the submission threat angle
 *   _computeAngles(f1, f2)                 — build both fighter angle arrays
 *   _LEVEL                                 — Tailwind class map per severity level
 *
 * Imported by:  FightAnalyzer.jsx
 * Rollback:     Delete this file and restore FightAnalyzer_ORIGINAL_PRESPLIT.jsx
 *               from _archive/src_components/
 */

// ── Parse percentage string ─────────────────────────────────────────────────
// Input can be a number (64), a string ("64"), or a percent string ("64%").
// Returns a float or null (never NaN).
export const _parsePct = (v) => {
  if (v == null) return null;
  const n = parseFloat(String(v).replace("%", ""));
  return isNaN(n) ? null : n;
};

// ── Single angle evaluator ──────────────────────────────────────────────────
// Compares an attacker's offensive metric (slpm, td_avg) against a defender's
// defense percentage.  Returns a severity { level, label, tip } object.
//
// Level thresholds:
//   strong   — defender's defense < 50%  (clear exploit)
//   moderate — defender's defense 50–65% (potential edge)
//   neutral  — defender's defense ≥ 65%  (no clear edge)
export const _evalAngle = (label, attackerVal, defenderDefPct) => {
  if (attackerVal == null || defenderDefPct == null)
    return { level: "neutral", label, tip: "No data available" };
  if (defenderDefPct === 0)
    return {
      level: "neutral",
      label,
      tip: `${attackerVal > 0 ? attackerVal : "no data"} output vs 0% defense (small sample — insufficient data)`,
    };
  if (attackerVal === 0)
    return {
      level: "neutral",
      label,
      tip: `No attempts on record vs ${defenderDefPct}% defense`,
    };
  if (defenderDefPct < 50)
    return {
      level: "strong",
      label,
      tip: `${attackerVal} output vs ${defenderDefPct}% defense — clear exploit`,
    };
  if (defenderDefPct < 65)
    return {
      level: "moderate",
      label,
      tip: `${attackerVal} output vs ${defenderDefPct}% defense — potential edge`,
    };
  return {
    level: "neutral",
    label,
    tip: `${attackerVal} output vs ${defenderDefPct}% defense — no clear edge`,
  };
};

// ── Submission angle evaluator ───────────────────────────────────────────────
// Uses career submission wins as the primary signal (more meaningful than attempt
// count alone).  avg_sub_attempts is shown as secondary context in the tooltip.
export const _evalSubAngle = (
  attackerWins,
  attackerAttempts,
  defenderWins,
  defenderAttempts,
) => {
  const label = "Submissions";
  const wins = attackerWins ?? 0;
  const atts = Number((attackerAttempts ?? 0).toFixed(1));
  const oppWins = defenderWins ?? 0;
  const tip = `${wins} sub win${wins !== 1 ? "s" : ""} (${atts} attempts/fight)`;
  if (wins === 0)
    return {
      level: "neutral",
      label,
      tip: `0 sub wins (${atts} attempts/fight)`,
    };
  if (wins >= 3 && wins >= oppWins * 2) return { level: "strong", label, tip };
  if (wins > oppWins) return { level: "moderate", label, tip };
  return { level: "neutral", label, tip };
};

// ── Full two-sided angle computation ────────────────────────────────────────
// Returns an array of two matchup objects: [ f1→f2, f2→f1 ]
// Each object has { attacker, defender, angles: [striking, wrestling, submission] }
export const _computeAngles = (f1, f2) => {
  const s1 = f1.stats || {};
  const s2 = f2.stats || {};
  const subWins1 = f1.wins_submission ?? 0;
  const subWins2 = f2.wins_submission ?? 0;
  const subAtt1 = f1.avg_sub_attempts ?? s1.avg_sub_attempts ?? 0;
  const subAtt2 = f2.avg_sub_attempts ?? s2.avg_sub_attempts ?? 0;
  return [
    {
      attacker: f1.name,
      defender: f2.name,
      angles: [
        _evalAngle("Striking", s1.slpm, _parsePct(s2.striking_defense)),
        _evalAngle("Wrestling", s1.td_avg, _parsePct(s2.td_defense)),
        _evalSubAngle(subWins1, subAtt1, subWins2, subAtt2),
      ],
    },
    {
      attacker: f2.name,
      defender: f1.name,
      angles: [
        _evalAngle("Striking", s2.slpm, _parsePct(s1.striking_defense)),
        _evalAngle("Wrestling", s2.td_avg, _parsePct(s1.td_defense)),
        _evalSubAngle(subWins2, subAtt2, subWins1, subAtt1),
      ],
    },
  ];
};

// ── Severity level → Tailwind class map ─────────────────────────────────────
// Used by both FightAnalyzer and DFSPicksProjections to style angle badges.
// Each level has: dot color, card border, card background, badge color, badge label.
export const _LEVEL = {
  strong: {
    dot: "bg-red-500",
    border: "border-red-700/60",
    bg: "bg-red-950/50",
    badge: "bg-red-700 text-red-100",
    label: "Exploit",
  },
  moderate: {
    dot: "bg-orange-400",
    border: "border-orange-700/50",
    bg: "bg-orange-950/30",
    badge: "bg-orange-800 text-orange-100",
    label: "Edge",
  },
  neutral: {
    dot: "bg-stone-600",
    border: "border-stone-700",
    bg: "bg-stone-900/40",
    badge: "bg-stone-700 text-stone-300",
    label: "Even",
  },
};
