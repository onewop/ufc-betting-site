/**
 * DebugFighterStats.jsx
 *
 * PRIVATE OWNER-ONLY TOOL — not linked anywhere in the public UI.
 * Exact functional copy of the live stats section from FightAnalyzer,
 * extended with per-stat source-tracing labels.
 *
 * DO NOT import this component from any public-facing page.
 */

import { useState } from "react";

// ─── Source metadata ────────────────────────────────────────────────────────
// For every stat key, describe:
//   path   — exact JS access path on the fighter object
//   origin — where the value is ultimately seeded from
const SOURCE_MAP = {
  // Basics
  nickname: {
    path: "fighter.nickname",
    origin:
      "this_weeks_stats.json → aggregate_stats.py → ufc-master.csv / Sherdog",
  },
  age: {
    path: "fighter.age",
    origin: "this_weeks_stats.json → aggregate_stats.py → ufc-master.csv (DOB)",
  },
  height: {
    path: "fighter.height",
    origin:
      "this_weeks_stats.json → aggregate_stats.py → ufc-master.csv / Sherdog",
  },
  reach: {
    path: "fighter.reach",
    origin:
      "this_weeks_stats.json → aggregate_stats.py → ufc-master.csv / Sherdog",
  },
  stance: {
    path: "fighter.stance",
    origin: "this_weeks_stats.json → aggregate_stats.py → ufc-master.csv",
  },
  weight_class: {
    path: "fighter.weight_class",
    origin: "this_weeks_stats.json → DKSalaries.csv / ufc-master.csv",
  },
  record: {
    path: "fighter.record",
    origin:
      "this_weeks_stats.json → aggregate_stats.py → ufc-master.csv (full MMA career / UFC-only fallback)",
  },
  salary: {
    path: "fighter.salary",
    origin: "this_weeks_stats.json → DKSalaries.csv (DraftKings)",
  },
  avgPointsPerGame: {
    path: "fighter.avgPointsPerGame",
    origin: "this_weeks_stats.json → DKSalaries.csv (DraftKings avg DFS pts)",
  },

  // Striking
  "stats.slpm": {
    path: "fighter.stats.slpm",
    origin:
      "this_weeks_stats.json → scrape_ufcstats_perfight.py → UFCStats career page",
  },
  "stats.sapm": {
    path: "fighter.stats.sapm",
    origin:
      "this_weeks_stats.json → scrape_ufcstats_perfight.py → UFCStats career page",
  },
  striking_accuracy: {
    path: "fighter.striking_accuracy",
    origin:
      "this_weeks_stats.json → aggregate_stats.py (mirrors fighter.stats.striking_accuracy) → UFCStats",
  },
  "stats.striking_defense": {
    path: "fighter.stats.striking_defense",
    origin:
      "this_weeks_stats.json → scrape_ufcstats_perfight.py → UFCStats career page",
  },

  // Strike distribution (currently not populated by scraper)
  "stats.head_str_pct": {
    path: "fighter.stats.head_str_pct",
    origin:
      "this_weeks_stats.json → scrape_ufcstats_perfight.py → UFCStats ⚠️ NOT YET SCRAPED",
  },
  "stats.body_str_pct": {
    path: "fighter.stats.body_str_pct",
    origin:
      "this_weeks_stats.json → scrape_ufcstats_perfight.py → UFCStats ⚠️ NOT YET SCRAPED",
  },
  "stats.leg_str_pct": {
    path: "fighter.stats.leg_str_pct",
    origin:
      "this_weeks_stats.json → scrape_ufcstats_perfight.py → UFCStats ⚠️ NOT YET SCRAPED",
  },
  "stats.distance_str_pct": {
    path: "fighter.stats.distance_str_pct",
    origin:
      "this_weeks_stats.json → scrape_ufcstats_perfight.py → UFCStats ⚠️ NOT YET SCRAPED",
  },
  "stats.clinch_str_pct": {
    path: "fighter.stats.clinch_str_pct",
    origin:
      "this_weeks_stats.json → scrape_ufcstats_perfight.py → UFCStats ⚠️ NOT YET SCRAPED",
  },
  "stats.ground_str_pct": {
    path: "fighter.stats.ground_str_pct",
    origin:
      "this_weeks_stats.json → scrape_ufcstats_perfight.py → UFCStats ⚠️ NOT YET SCRAPED",
  },

  // Grappling
  "stats.td_avg": {
    path: "fighter.stats.td_avg",
    origin:
      "this_weeks_stats.json → scrape_ufcstats_perfight.py → UFCStats (TDs per 15 min)",
  },
  "stats.td_accuracy": {
    path: "fighter.stats.td_accuracy",
    origin: "this_weeks_stats.json → scrape_ufcstats_perfight.py → UFCStats",
  },
  "stats.td_defense": {
    path: "fighter.stats.td_defense",
    origin: "this_weeks_stats.json → scrape_ufcstats_perfight.py → UFCStats",
  },
  submission_wins_pct: {
    path: "fighter.submission_wins_pct",
    origin:
      "this_weeks_stats.json → aggregate_stats.py (wins_submission / total_wins × 100) → ufc-master.csv",
  },
  avg_sub_attempts: {
    path: "fighter.avg_sub_attempts",
    origin:
      "this_weeks_stats.json → scrape_ufcstats_perfight.py → UFCStats per-fight totals",
  },
  "stats.avg_kd_per_fight": {
    path: "fighter.stats.avg_kd_per_fight",
    origin:
      "this_weeks_stats.json → scrape_ufcstats_perfight.py → UFCStats ⚠️ NOT YET SCRAPED",
  },
  "stats.avg_ctrl_secs": {
    path: "fighter.stats.avg_ctrl_secs",
    origin:
      "this_weeks_stats.json → scrape_ufcstats_perfight.py → UFCStats ⚠️ NOT YET SCRAPED",
  },
  "stats.grappling_control_pct": {
    path: "fighter.stats.grappling_control_pct",
    origin:
      "this_weeks_stats.json → scrape_ufcstats_perfight.py → UFCStats ⚠️ NOT YET SCRAPED",
  },

  // Defensive grappling
  "stats.implied_sub_def_pct": {
    path: "fighter.stats.implied_sub_def_pct",
    origin:
      "this_weeks_stats.json → aggregate_stats.py (derived) ⚠️ NOT YET SCRAPED",
  },
  "stats.avg_opp_ctrl_secs": {
    path: "fighter.stats.avg_opp_ctrl_secs",
    origin:
      "this_weeks_stats.json → scrape_ufcstats_perfight.py → UFCStats ⚠️ NOT YET SCRAPED",
  },
  "stats.avg_reversals_per_fight": {
    path: "fighter.stats.avg_reversals_per_fight",
    origin:
      "this_weeks_stats.json → scrape_ufcstats_perfight.py → UFCStats ⚠️ NOT YET SCRAPED",
  },
  "stats.subs_conceded": {
    path: "fighter.stats.subs_conceded",
    origin:
      "this_weeks_stats.json → scrape_ufcstats_perfight.py → UFCStats per-fight totals",
  },
  "stats.opp_sub_attempts_vs": {
    path: "fighter.stats.opp_sub_attempts_vs",
    origin:
      "this_weeks_stats.json → scrape_ufcstats_perfight.py → UFCStats ⚠️ NOT YET SCRAPED",
  },

  // Record & Awards
  current_win_streak: {
    path: "fighter.current_win_streak",
    origin:
      "this_weeks_stats.json → aggregate_stats.py → UFCStats fight results",
  },
  longest_win_streak: {
    path: "fighter.longest_win_streak",
    origin:
      "this_weeks_stats.json → aggregate_stats.py → UFCStats fight results",
  },
  current_loss_streak: {
    path: "fighter.current_loss_streak",
    origin:
      "this_weeks_stats.json → aggregate_stats.py → UFCStats fight results",
  },
  last_fight_result: {
    path: "fighter.last_fight_result",
    origin:
      "this_weeks_stats.json → aggregate_stats.py → UFCStats fight results",
  },
  record_last_5: {
    path: "fighter.record_last_5",
    origin:
      "this_weeks_stats.json → aggregate_stats.py → UFCStats fight results (last 5)",
  },
  record_last_10: {
    path: "fighter.record_last_10",
    origin:
      "this_weeks_stats.json → aggregate_stats.py → UFCStats fight results (last 10)",
  },
  wins_ko_tko: {
    path: "fighter.wins_ko_tko",
    origin:
      "this_weeks_stats.json → aggregate_stats.py → ufc-master.csv (full pro career)",
  },
  wins_submission: {
    path: "fighter.wins_submission",
    origin:
      "this_weeks_stats.json → aggregate_stats.py → ufc-master.csv (full pro career)",
  },
  wins_decision: {
    path: "fighter.wins_decision",
    origin:
      "this_weeks_stats.json → aggregate_stats.py → ufc-master.csv (full pro career)",
  },
  finish_rate_pct: {
    path: "fighter.finish_rate_pct",
    origin:
      "this_weeks_stats.json → aggregate_stats.py (ko+sub wins / total wins × 100)",
  },
  decision_rate_pct: {
    path: "fighter.decision_rate_pct",
    origin:
      "this_weeks_stats.json → aggregate_stats.py (dec wins / total wins × 100)",
  },
  total_title_bouts: {
    path: "fighter.total_title_bouts",
    origin: "this_weeks_stats.json → aggregate_stats.py → ufc-master.csv",
  },

  // Advanced / DFS
  ufc_ranking: {
    path: "fighter.ufc_ranking",
    origin:
      "this_weeks_stats.json → aggregate_stats.py → ufc-master.csv (manual or scraped rankings)",
  },
  career_longevity_years: {
    path: "fighter.career_longevity_years",
    origin:
      "this_weeks_stats.json → aggregate_stats.py (first UFC fight date → now)",
  },
  avg_fight_duration: {
    path: "fighter.avg_fight_duration",
    origin:
      "this_weeks_stats.json → aggregate_stats.py → UFCStats per-fight times",
  },
  first_round_wins: {
    path: "fighter.first_round_wins",
    origin:
      "this_weeks_stats.json → aggregate_stats.py → UFCStats fight results R1 finishes",
  },
};

// ─── Stat definitions (identical to FightAnalyzer live) ─────────────────────
const STATS_LIST = {
  basics: [
    { label: "Nickname", key: "nickname" },
    { label: "Age", key: "age" },
    { label: "Height", key: "height" },
    { label: "Reach", key: "reach" },
    { label: "Stance", key: "stance" },
    { label: "Weight Class", key: "weight_class" },
    {
      label:
        "Record (Full MMA career when Sherdog data available, otherwise UFC only)",
      key: "record",
    },
    { label: "DK (DraftKings) Salary", key: "salary", isMoney: true },
    {
      label: "Avg Points (DFS — Daily Fantasy Sports)",
      key: "avgPointsPerGame",
      isHighlight: true,
    },
  ],
  striking: [
    { label: "SLpM (Sig. Strikes Landed per Min)", key: "stats.slpm" },
    { label: "SApM (Sig. Strikes Absorbed per Min)", key: "stats.sapm" },
    { label: "Striking Accuracy %", key: "striking_accuracy", isPct: true },
    { label: "Striking Defense %", key: "stats.striking_defense", isPct: true },
  ],
  strikeDistribution: [
    {
      label: "Head % (of landed sig strikes)",
      key: "stats.head_str_pct",
      isPct: true,
    },
    {
      label: "Body % (of landed sig strikes)",
      key: "stats.body_str_pct",
      isPct: true,
    },
    {
      label: "Leg % (of landed sig strikes)",
      key: "stats.leg_str_pct",
      isPct: true,
    },
    {
      label: "Distance % (of strikes by position)",
      key: "stats.distance_str_pct",
      isPct: true,
    },
    {
      label: "Clinch % (of strikes by position)",
      key: "stats.clinch_str_pct",
      isPct: true,
    },
    {
      label: "Ground % (of strikes by position)",
      key: "stats.ground_str_pct",
      isPct: true,
    },
  ],
  grappling: [
    { label: "TD Avg (Takedowns per 15 min)", key: "stats.td_avg" },
    {
      label: "TD Accuracy % (Takedown Accuracy)",
      key: "stats.td_accuracy",
      isPct: true,
    },
    {
      label: "TD Defense % (Takedown Defense)",
      key: "stats.td_defense",
      isPct: true,
    },
    {
      label: "Sub Win % (Submission Win %)",
      key: "submission_wins_pct",
      isPct: true,
    },
    { label: "Avg Sub Attempts", key: "avg_sub_attempts" },
    { label: "Avg KD (Knockdowns) / Fight", key: "stats.avg_kd_per_fight" },
    { label: "Avg CTRL (Control) Time (secs)", key: "stats.avg_ctrl_secs" },
    {
      label: "CTRL (Control) Time %",
      key: "stats.grappling_control_pct",
      isPct: true,
    },
  ],
  defGrappling: [
    {
      label: "TD Defense % (Takedown Defense)",
      key: "stats.td_defense",
      isPct: true,
    },
    {
      label: "Implied Sub Defense % (est.)",
      key: "stats.implied_sub_def_pct",
      isPct: true,
    },
    {
      label: "Avg Opp Control Time (secs / fight)",
      key: "stats.avg_opp_ctrl_secs",
    },
    {
      label: "Reversals / Fight (bottom→top escapes)",
      key: "stats.avg_reversals_per_fight",
    },
    {
      label: "Subs Conceded (recent fights analyzed)",
      key: "stats.subs_conceded",
    },
    { label: "Opp Sub Attempts vs Fighter", key: "stats.opp_sub_attempts_vs" },
  ],
  recordAwards: [
    { label: "UFC Win Streak (UFCStats)", key: "current_win_streak" },
    { label: "Longest UFC Win Streak (UFCStats)", key: "longest_win_streak" },
    { label: "UFC Loss Streak (UFCStats)", key: "current_loss_streak" },
    { label: "Last Fight Result", key: "last_fight_result" },
    { label: "UFC Record (Last 5 fights)", key: "record_last_5" },
    { label: "UFC Record (Last 10 fights)", key: "record_last_10" },
    { label: "Wins by KO/TKO — pro career total", key: "wins_ko_tko" },
    { label: "Wins by Submission — pro career total", key: "wins_submission" },
    { label: "Wins by Decision — pro career total", key: "wins_decision" },
    { label: "Finish Rate %", key: "finish_rate_pct", isPct: true },
    { label: "Decision Rate %", key: "decision_rate_pct", isPct: true },
    { label: "Total Title Bouts", key: "total_title_bouts" },
  ],
  advanced: [
    { label: "UFC Ranking", key: "ufc_ranking" },
    { label: "Career Longevity (Years)", key: "career_longevity_years" },
    { label: "Avg Fight Duration (mins)", key: "avg_fight_duration" },
    { label: "First-Round Wins", key: "first_round_wins" },
  ],
};

const TABS = [
  { id: "basics", label: "Basics" },
  { id: "striking", label: "Striking" },
  { id: "strikeDistribution", label: "Strike Dist." },
  { id: "grappling", label: "Grappling" },
  { id: "defGrappling", label: "Def. Grappling" },
  { id: "recordAwards", label: "Record & Awards" },
  { id: "advanced", label: "Advanced / DFS" },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────
const getValue = (fighter, keyPath) => {
  const keys = keyPath.split(".");
  let value = fighter;
  for (const key of keys) {
    value = value?.[key];
  }
  return value;
};

const formatPct = (raw) => {
  if (raw === null || raw === undefined) return null;
  const stripped = String(raw).replace(/%$/, "").trim();
  if (stripped === "" || stripped === "N/A") return null;
  return `${stripped}%`;
};

const getDisplayVal = (fighter, stat) => {
  const rawVal = getValue(fighter, stat.key);
  if (stat.isMoney) return rawVal != null ? `$${rawVal}` : null;
  if (stat.isPct) return formatPct(rawVal);
  return rawVal != null ? rawVal : null;
};

// ─── Single-fighter debug stats panel ────────────────────────────────────────
const FighterDebugPanel = ({ fighter }) => {
  const [activeTab, setActiveTab] = useState("basics");

  const stats = STATS_LIST[activeTab] || STATS_LIST.basics;

  const allNull = stats.every((s) => getDisplayVal(fighter, s) === null);

  return (
    <div className="border border-yellow-700/50 rounded-lg bg-stone-950 p-4">
      <h3 className="text-lg font-bold text-yellow-400 text-center mb-4 uppercase tracking-wide">
        {fighter.name}
      </h3>

      {/* Tab bar */}
      <div className="flex flex-wrap gap-2 mb-4">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-3 py-1.5 rounded text-xs font-bold uppercase tracking-wide transition ${
              activeTab === tab.id
                ? "bg-yellow-700 text-stone-950"
                : "bg-stone-800 text-stone-400 hover:bg-stone-700 hover:text-stone-200"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Stats list */}
      {allNull && activeTab !== "basics" ? (
        <div className="text-stone-500 text-sm italic py-4 text-center">
          No career data available for {fighter.name} in this dataset.
          <br />
          <span className="text-xs">
            (Fighter not found in ufc-master.csv enrichment source)
          </span>
        </div>
      ) : (
        <div className="space-y-0">
          {stats.map((stat, i) => {
            const displayVal = getDisplayVal(fighter, stat);
            const src = SOURCE_MAP[stat.key];
            const isMissing = displayVal === null;
            const isUnscraped = src?.origin?.includes("NOT YET SCRAPED");

            return (
              <div
                key={`${activeTab}-${i}`}
                className={`py-2 border-b border-stone-800 ${isMissing ? "opacity-70" : ""}`}
              >
                {/* Stat row — identical layout to live site */}
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-stone-400 text-sm flex-1 min-w-0">
                    {stat.label}:
                  </span>
                  {!isMissing ? (
                    <span
                      className={`font-semibold shrink-0 text-right ${
                        stat.isMoney || stat.isHighlight
                          ? "text-yellow-400"
                          : "text-stone-200"
                      }`}
                    >
                      {displayVal}
                    </span>
                  ) : (
                    <span className="text-red-400/70 text-sm font-mono shrink-0">
                      MISSING / N/A
                    </span>
                  )}
                </div>

                {/* Source trace line */}
                {src ? (
                  <p
                    className={`text-[10px] mt-0.5 font-mono leading-tight ${
                      isMissing
                        ? "text-red-500/60"
                        : isUnscraped
                          ? "text-orange-500/60"
                          : "text-stone-600"
                    }`}
                  >
                    <span className="text-stone-500">Source:</span>{" "}
                    <span className="text-stone-400">{src.path}</span>
                    {" — "}
                    <span
                      className={
                        isUnscraped ? "text-orange-400/70" : "text-stone-500"
                      }
                    >
                      {src.origin}
                    </span>
                    {isMissing && (
                      <span className="ml-1 text-red-400/80">
                        ← value is {String(getValue(fighter, stat.key))} in JSON
                      </span>
                    )}
                  </p>
                ) : (
                  <p className="text-[10px] mt-0.5 font-mono text-stone-700">
                    Source: (no source mapping defined for key "{stat.key}")
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Raw JSON dump for the active tab keys */}
      <details className="mt-4">
        <summary className="text-[10px] text-stone-600 cursor-pointer hover:text-stone-400 uppercase tracking-wider">
          Raw JSON — all fighter fields
        </summary>
        <pre className="text-[9px] text-stone-500 bg-stone-900 rounded p-2 mt-1 overflow-x-auto max-h-60 whitespace-pre-wrap break-all">
          {JSON.stringify(fighter, null, 2)}
        </pre>
      </details>
    </div>
  );
};

// ─── Public export ────────────────────────────────────────────────────────────
/**
 * DebugFighterStats
 *
 * Props:
 *   fighters  — array of fighter objects from this_weeks_stats.json
 *   matchup   — optional string label for the fight header
 */
const DebugFighterStats = ({ fighters = [], matchup = "" }) => {
  if (!fighters || fighters.length === 0) {
    return (
      <div className="text-stone-500 text-sm italic text-center py-6">
        No fighters to display. Select a fight above.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {matchup && (
        <h2 className="text-stone-300 text-base font-bold text-center tracking-wide">
          {matchup}
        </h2>
      )}

      {/* Side-by-side on md+, stacked on mobile */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {fighters.map((fighter) => (
          <FighterDebugPanel key={fighter.name} fighter={fighter} />
        ))}
      </div>

      {/* Missing stat summary */}
      <details className="border border-red-800/40 rounded-lg bg-stone-950">
        <summary className="px-4 py-2 text-red-400 text-sm font-bold uppercase tracking-wider cursor-pointer hover:text-red-300">
          ⚠️ Missing Stats Summary
        </summary>
        <div className="p-4">
          <MissingStatSummary fighters={fighters} />
        </div>
      </details>
    </div>
  );
};

// ─── Missing stat summary card ────────────────────────────────────────────────
const MissingStatSummary = ({ fighters }) => {
  const [copied, setCopied] = useState(false);
  const allStatKeys = Object.values(STATS_LIST)
    .flat()
    .map((s) => s.key);
  // Deduplicate (td_defense appears in both grappling and defGrappling)
  const uniqueKeys = [...new Set(allStatKeys)];

  const rows = [];
  fighters.forEach((fighter) => {
    uniqueKeys.forEach((key) => {
      const stat = Object.values(STATS_LIST)
        .flat()
        .find((s) => s.key === key);
      if (!stat) return;
      const val = getDisplayVal(fighter, stat);
      if (val === null) {
        rows.push({
          fighter: fighter.name,
          key,
          path: SOURCE_MAP[key]?.path ?? key,
          origin: SOURCE_MAP[key]?.origin ?? "—",
          rawValue: String(getValue(fighter, key)),
        });
      }
    });
  });

  if (rows.length === 0) {
    return (
      <div className="text-green-400/70 text-xs text-center py-3">
        ✓ No missing stats detected for this fight.
      </div>
    );
  }

  return (
    <div>
      <button
        onClick={() => {
          const text = rows
            .map(
              (r) =>
                `Fighter: ${r.fighter}\nStat Key: ${r.key}\nRaw Value: ${r.rawValue}\nOrigin: ${r.origin}`,
            )
            .join("\n\n");
          navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        }}
        className="mb-3 px-3 py-1 bg-red-800/50 text-red-300 text-xs rounded hover:bg-red-700/50 transition"
      >
        Copy Missing Stats to Clipboard
      </button>
      {copied && <span className="text-green-400 text-xs ml-2">Copied!</span>}
      <div className="overflow-x-auto">
        <table className="w-full text-[10px] font-mono">
          <thead>
            <tr className="text-stone-500 border-b border-stone-800">
              <th className="text-left py-1 pr-3">Fighter</th>
              <th className="text-left py-1 pr-3">Key</th>
              <th className="text-left py-1 pr-3">Raw JSON value</th>
              <th className="text-left py-1">Origin</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr
                key={i}
                className="border-b border-stone-900 hover:bg-stone-900/40"
              >
                <td className="py-1 pr-3 text-stone-300">{r.fighter}</td>
                <td className="py-1 pr-3 text-yellow-600">{r.path}</td>
                <td className="py-1 pr-3 text-red-400/70">{r.rawValue}</td>
                <td className="py-1 text-stone-500 break-all">
                  {r.origin.includes("NOT YET SCRAPED") ? (
                    <span className="font-bold text-orange-400">
                      {r.origin}
                    </span>
                  ) : (
                    r.origin
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default DebugFighterStats;
