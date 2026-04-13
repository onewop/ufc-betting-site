/**
 * MatchupIntel.jsx — Directional exploit analysis grid for every fight.
 *
 * Local pure helpers (not exported externally):
 *   parsePct(v)                               — "54%" → 54
 *   evalAngle(label, attackerVal, defPct)     — single directional angle
 *   evalSubAngle(wins, atts, oppWins, oppAtts) — submission angle
 *   computeMatchupAngles(f1, f2)              — full angle set for a fight
 *   LEVEL_STYLE                               — color config per level
 *
 * Note: parsePct/evalAngle/evalSubAngle are intentionally kept local here
 * (rather than re-using fightAnalyzerHelpers.js) because the export shapes
 * are slightly different. If they diverge further, consider unifying later.
 *
 * Props:
 *   fights        — array of fight objects from this_weeks_stats.json
 *   focusFightId  — optional fight_id to filter to a single fight
 *   onClearFocus  — callback to clear single-fight focus
 *
 * Imported by:  DFSPicksProjections.jsx
 * Rollback:     Delete this file and restore DFSPicksProjections_ORIGINAL_PRESPLIT.jsx
 *               from _archive/src_components/
 */

import React from "react";

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

// Evaluate submission threat using actual career submission wins as the primary
// metric. avg_sub_attempts is shown as secondary context only.
const evalSubAngle = (
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
  const subWins1 = f1.wins_submission ?? 0;
  const subWins2 = f2.wins_submission ?? 0;
  const subAtt1 = f1.avg_sub_attempts ?? s1.avg_sub_attempts ?? 0;
  const subAtt2 = f2.avg_sub_attempts ?? s2.avg_sub_attempts ?? 0;

  return [
    // ── F1 attacking F2 ──────────────────────────────────────────────────
    {
      attacker: f1.name,
      defender: f2.name,
      angles: [
        evalAngle("Striking", slpm1, strDef2),
        evalAngle("Wrestling", tdAvg1, tdDef2),
        evalSubAngle(subWins1, subAtt1, subWins2, subAtt2),
      ],
    },
    // ── F2 attacking F1 ──────────────────────────────────────────────────
    {
      attacker: f2.name,
      defender: f1.name,
      angles: [
        evalAngle("Striking", slpm2, strDef1),
        evalAngle("Wrestling", tdAvg2, tdDef1),
        evalSubAngle(subWins2, subAtt2, subWins1, subAtt1),
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

const MatchupIntel = ({ fights, focusFightId = null, onClearFocus }) => {
  if (!fights || fights.length === 0) return null;

  const visibleFights =
    focusFightId == null
      ? fights
      : fights.filter(
          (fight) => String(fight.fight_id) === String(focusFightId),
        );

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
      {focusFightId != null && (
        <div className="mb-4 text-center">
          <span className="text-xs text-yellow-500 tracking-wide">
            Showing matchup intel for this fight only.
          </span>
          {onClearFocus && (
            <button
              onClick={onClearFocus}
              className="ml-3 px-2 py-0.5 rounded bg-stone-700 text-stone-200 text-xs hover:bg-stone-600"
            >
              Show all fights
            </button>
          )}
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {visibleFights.map((fight) => {
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

export default MatchupIntel;
