/**
 * MatchupIntel.jsx — Comprehensive Fight Predictions for every fight on the card.
 *
 * Uses the 10-category prediction engine from fightAnalyzerHelpers.js to produce
 * a win prediction with confidence rating, narrative explanation, and category
 * breakdown for each fight.
 *
 * Props:
 *   fights        — array of fight objects from this_weeks_stats.json
 *   focusFightId  — optional fight_id to filter to a single fight
 *   onClearFocus  — callback to clear single-fight focus
 *
 * Imported by:  DFSPicksProjections.jsx
 */

import React, { useState } from "react";
import { predictFight, CONFIDENCE_LEVELS } from "./fightAnalyzerHelpers";

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
          FIGHT PREDICTIONS
        </span>
        <div className="h-px flex-1 bg-yellow-700/30" />
      </div>
      <p className="text-stone-400 text-center text-sm mb-6">
        Comprehensive predictions using all available stats, records, physical attributes & fight history.{" "}
        <span className="text-emerald-400">🟢 High Confidence</span> ·{" "}
        <span className="text-sky-400">🔵 Confident</span> ·{" "}
        <span className="text-amber-400">🟡 Slight Lean</span> ·{" "}
        <span className="text-stone-400">⚪ Toss-Up</span>
      </p>
      {focusFightId != null && (
        <div className="mb-4 text-center">
          <span className="text-xs text-yellow-500 tracking-wide">
            Showing prediction for this fight only.
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
          return (
            <PredictionCard key={fight.fight_id} fight={fight} f1={f1} f2={f2} />
          );
        })}
      </div>
    </section>
  );
};

function PredictionCard({ fight, f1, f2 }) {
  const [expanded, setExpanded] = useState(false);
  const pred = predictFight(f1, f2);
  const style = CONFIDENCE_LEVELS[pred.confidence];
  const wBreak = pred.categories[pred.winner.name];
  const lBreak = pred.categories[pred.loser.name];

  return (
    <div
      id={`fight-${fight.fight_id}`}
      className={`bg-stone-900 rounded-lg border ${style.border} p-4 ${style.glow}`}
    >
      {/* Header: fighter names + confidence badge */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${style.dot}`} />
          <span className="text-stone-100 font-bold text-sm">
            {f1.name}
            <span className="text-stone-500 mx-2">vs</span>
            {f2.name}
          </span>
        </div>
        <span className={`text-[10px] px-2 py-0.5 rounded font-bold tracking-wider ${style.badge}`}>
          {style.label}
        </span>
      </div>

      {/* Weight class */}
      {fight.weight_class && (
        <p className="text-[10px] text-stone-500 mb-2 tracking-wide uppercase">{fight.weight_class}</p>
      )}

      {/* Winner pick + win probability bar */}
      <div className="mb-2">
        <div className="flex justify-between text-xs mb-1">
          <span className="font-bold text-emerald-400">{pred.winner.name} — {pred.winner.winProb}%</span>
          <span className="text-stone-400">{pred.loser.name} — {pred.loser.winProb}%</span>
        </div>
        <div className="h-2.5 bg-stone-800 rounded-full overflow-hidden flex">
          <div className={`${style.barColor} rounded-l-full transition-all`} style={{ width: `${pred.winner.winProb}%` }} />
          <div className="bg-stone-600 flex-1 rounded-r-full" />
        </div>
      </div>

      {/* Narrative */}
      <p className="text-xs text-stone-300 leading-relaxed border-t border-stone-700/50 pt-2 mb-2">
        {pred.narrative}
      </p>

      {/* Expandable category breakdown */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="text-[10px] text-yellow-500 hover:text-yellow-400 uppercase tracking-widest font-bold flex items-center gap-1"
      >
        <span>{expanded ? "▾" : "▸"}</span>
        <span>Category Breakdown ({pred.catWins.winner.length}–{pred.catWins.loser.length}–{pred.catWins.tied.length})</span>
      </button>

      {expanded && (
        <div className="mt-2 border-t border-stone-700/50 pt-2">
          <div className="grid gap-1.5">
            {Object.entries(pred.catLabels).map(([key, label]) => {
              const wScore = wBreak[key]?.score ?? 50;
              const lScore = lBreak[key]?.score ?? 50;
              const isWinnerCat = pred.catWins.winner.includes(key);
              const isLoserCat = pred.catWins.loser.includes(key);
              return (
                <div key={key} className="flex items-center gap-2">
                  <span className="text-[10px] text-stone-400 w-28 flex-shrink-0 truncate">{label}</span>
                  <div className="flex-1 flex items-center gap-1">
                    <span className={`text-[10px] w-6 text-right font-mono ${isWinnerCat ? "text-emerald-400 font-bold" : "text-stone-400"}`}>{wScore}</span>
                    <div className="flex-1 h-1.5 bg-stone-800 rounded-full overflow-hidden flex">
                      <div
                        className={`rounded-l-full ${isWinnerCat ? "bg-emerald-500" : isLoserCat ? "bg-stone-600" : "bg-stone-500"}`}
                        style={{ width: `${(wScore / (wScore + lScore)) * 100}%` }}
                      />
                      <div
                        className={`rounded-r-full flex-1 ${isLoserCat ? "bg-red-500/70" : "bg-stone-700"}`}
                      />
                    </div>
                    <span className={`text-[10px] w-6 font-mono ${isLoserCat ? "text-red-400 font-bold" : "text-stone-400"}`}>{lScore}</span>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="flex justify-between mt-2 text-[10px] text-stone-500">
            <span>◼ {pred.winner.name.split(" ").pop()} wins {pred.catWins.winner.length} categories</span>
            <span>{pred.loser.name.split(" ").pop()} wins {pred.catWins.loser.length} ◼</span>
          </div>
        </div>
      )}
    </div>
  );
}

export default MatchupIntel;