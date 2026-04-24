/**
 * FightStatsSection.jsx — Side-by-side fighter stats comparison panel.
 *
 * A memoized component that renders the "📋 View Full Fighter Stats & Comparisons"
 * collapsible panel inside FightAnalyzer.  It displays every stat category in
 * either desktop (two-column side-by-side) or mobile (accordion) layout.
 *
 * Props:
 *   fight          — the fight object from this_weeks_stats.json
 *   activeTab      — currently selected tab id (string)
 *   setActiveTab   — state setter for the active tab
 *   openRecordModal — callback(fighter) to open the FullFightRecord modal
 *
 * Stat tabs:
 *   basics · striking · strikeDistribution · grappling · defGrappling
 *   recordAwards · advanced
 *
 * Extracted from FightAnalyzer.jsx to prevent re-renders caused by unrelated
 * state changes (modal open/close, AI question/answer, etc.).
 *
 * Imported by:  FightAnalyzer.jsx
 * Rollback:     Delete this file and restore FightAnalyzer_ORIGINAL_PRESPLIT.jsx
 *               from _archive/src_components/
 */

import { memo } from "react";
import WeighInClips from "./WeighInClips";
import KeyNotes from "./KeyNotes";

/* ── FightStatsSection ────────────────────────────────────────────────────── */

const FightStatsSection = memo(
  ({ fight, activeTab, setActiveTab, openRecordModal }) => {
    if (!fight || fight.fighters.length < 2) return null;

    // ── Stat definitions per tab ─────────────────────────────────────────────
    // Each entry is { label, key, isMoney?, isPct?, isHighlight? }
    // key uses dot-notation for nested paths (e.g. "stats.slpm")
    const renderStats = (fighter, tabKey = activeTab) => {
      const statsList = {
        // ── Basic bio + DFS info ──
        basics: [
          { label: "Nickname", key: "nickname" },
          { label: "Age", key: "age" },
          { label: "Height", key: "height" },
          { label: "Reach", key: "reach" },
          { label: "Stance", key: "stance" },
          { label: "Weight Class", key: "weight_class" },
          {
            label: "DK (DraftKings) Salary",
            key: "salary",
            isMoney: true,
          },
          {
            label: "Avg Points (DFS — Daily Fantasy Sports)",
            key: "avgPointsPerGame",
            isHighlight: true,
          },
        ],
        // ── Striking offense + defense ──
        striking: [
          {
            label: "SLpM (Sig. Strikes Landed per Min)",
            key: "stats.slpm",
          },
          {
            label: "SApM (Sig. Strikes Absorbed per Min)",
            key: "stats.sapm",
          },
          {
            label: "Striking Accuracy %",
            key: "striking_accuracy",
            isPct: true,
          },
          {
            label: "Striking Defense %",
            key: "stats.striking_defense",
            isPct: true,
          },
        ],
        // ── Where strikes land / come from (from per-fight scraper) ──
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
        // ── Grappling offense ──
        grappling: [
          {
            label: "TD Avg (Takedowns per 15 min)",
            key: "stats.td_avg",
          },
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
          {
            label: "Avg KD (Knockdowns) / Fight",
            key: "stats.avg_kd_per_fight",
          },
          {
            label: "Avg CTRL (Control) Time (secs)",
            key: "stats.avg_ctrl_secs",
          },
          {
            label: "CTRL (Control) Time %",
            key: "stats.grappling_control_pct",
            isPct: true,
          },
        ],
        // ── Grappling defense (from scrape_ufcstats_def_grappling) ──
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
          {
            label: "Opp Sub Attempts vs Fighter",
            key: "stats.opp_sub_attempts_vs",
          },
        ],
        // ── Career record + finish breakdown (Sherdog data when available) ──
        recordAwards: [
          {
            label: "UFC Win Streak (UFCStats)",
            key: "current_win_streak",
          },
          {
            label: "Longest UFC Win Streak (UFCStats)",
            key: "longest_win_streak",
          },
          {
            label: "UFC Loss Streak (UFCStats)",
            key: "current_loss_streak",
          },
          { label: "Last Fight Result", key: "last_fight_result" },
          { label: "UFC Record (Last 5 fights)", key: "record_last_5" },
          {
            label: "UFC Record (Last 10 fights)",
            key: "record_last_10",
          },
          {
            label: "Wins by KO/TKO — pro career total",
            key: "wins_ko_tko",
          },
          {
            label: "Wins by Submission — pro career total",
            key: "wins_submission",
          },
          {
            label: "Wins by Decision — pro career total",
            key: "wins_decision",
          },
          {
            label: "Finish Rate %",
            key: "finish_rate_pct",
            isPct: true,
          },
          {
            label: "Decision Rate %",
            key: "decision_rate_pct",
            isPct: true,
          },
          { label: "Total Title Bouts", key: "total_title_bouts" },
        ],
        // ── Advanced / DFS context ──
        advanced: [
          { label: "UFC Ranking", key: "ufc_ranking" },
          {
            label: "Career Longevity (Years)",
            key: "career_longevity_years",
          },
          {
            label: "Avg Fight Duration (mins)",
            key: "avg_fight_duration",
          },
          { label: "First-Round Wins", key: "first_round_wins" },
        ],
      };

      // ── Value accessors ──────────────────────────────────────────────────
      const getValue = (fighter, keyPath) => {
        const keys = keyPath.split(".");
        let value = fighter;
        for (const key of keys) {
          value = value?.[key];
        }
        return value;
      };

      const formatPct = (raw) => {
        if (raw === null || raw === undefined) return "N/A";
        const stripped = String(raw).replace(/%$/, "").trim();
        if (stripped === "" || stripped === "N/A") return "N/A";
        return `${stripped}%`;
      };

      const stats = statsList[tabKey] || statsList.basics;

      const getDisplayVal = (stat) => {
        const rawVal = getValue(fighter, stat.key);
        if (stat.isMoney) return rawVal != null ? `$${rawVal}` : null;
        if (stat.isPct) {
          const f = formatPct(rawVal);
          return f === "N/A" ? null : f;
        }
        return rawVal != null ? rawVal : null;
      };

      // Show "no data" message for tabs where all stats are null
      const allNull = stats.every((stat) => getDisplayVal(stat) === null);
      if (allNull && tabKey !== "basics") {
        return (
          <div className="text-stone-500 text-sm italic py-4 text-center">
            No career data available for {fighter.name} in this dataset.
            <br />
            <span className="text-xs">
              (Fighter not found in ufc-master.csv enrichment source)
            </span>
          </div>
        );
      }

      return (
        <div className="space-y-2">
          {stats.map((stat, i) => {
            const displayVal = getDisplayVal(stat);

            if (tabKey === "defGrappling" && displayVal === null) {
              return null;
            }
            if (tabKey === "strikeDistribution" && displayVal === null) {
              return null;
            }

            return (
              <div
                key={`${tabKey}-${i}`}
                className="flex items-baseline justify-between gap-2 py-1 border-b border-stone-700/50"
              >
                <span className="text-stone-500 text-sm flex-1 min-w-0">
                  {stat.label}:
                </span>
                {displayVal !== null ? (
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
                  <span className="text-stone-600 text-sm italic shrink-0">
                    No data
                  </span>
                )}
              </div>
            );
          })}

        </div>
      );
    };

    // ── Tab definitions ──────────────────────────────────────────────────────
    const tabList = [
      { id: "basics", label: "Basics" },
      { id: "striking", label: "Striking" },
      { id: "strikeDistribution", label: "Strike Dist." },
      { id: "grappling", label: "Grappling" },
      { id: "defGrappling", label: "Def. Grappling" },
      { id: "recordAwards", label: "Record & Awards" },
      { id: "advanced", label: "Advanced / DFS" },
    ];

    const mobileTabList = [
      { id: "basics", label: "Basics" },
      { id: "striking", label: "Striking" },
      { id: "strikeDistribution", label: "Strike Distribution" },
      { id: "grappling", label: "Grappling" },
      { id: "defGrappling", label: "Defensive Grappling" },
      { id: "recordAwards", label: "Record & Awards" },
      { id: "advanced", label: "Advanced / DFS" },
    ];

    // ── Render ───────────────────────────────────────────────────────────────
    return (
      <div className="mb-8">
        <p className="text-center text-stone-400 text-sm mb-3 italic tracking-wide">
          📊 Research every stat side-by-side — make your own decisions
        </p>

        <details className="group border border-yellow-700/50 rounded-lg bg-stone-900">
          <summary
            className="w-full bg-stone-900 hover:bg-stone-800 text-yellow-500 font-bold py-3 px-4 flex justify-between items-center transition"
            aria-label="Toggle full fighter stats and comparisons"
          >
            <span className="text-base sm:text-xl">
              📋 View Full Fighter Stats & Comparisons
            </span>
            <span className="text-lg group-open:hidden">▶</span>
            <span className="text-lg hidden group-open:inline">▼</span>
          </summary>

          <div className="border-t border-yellow-700/30 p-4 sm:p-6">
            {/* Desktop tab bar */}
            <div className="hidden md:flex flex-wrap gap-2 mb-6 border-b border-gray-600 pb-4">
              {tabList.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`min-h-[42px] px-4 py-2 rounded-lg font-bold tracking-wide uppercase text-xs transition ${
                    activeTab === tab.id
                      ? "bg-yellow-700 text-stone-950"
                      : "bg-stone-800 text-stone-400 hover:bg-stone-700 hover:text-stone-200"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Mobile: category accordions */}
            <div className="md:hidden space-y-3 mb-6">
              {mobileTabList.map((tab) => (
                <details
                  key={`mobile-tab-${tab.id}`}
                  className="rounded-lg border border-stone-700 bg-stone-950/70"
                >
                  <summary
                    className="px-3 py-2.5 text-xs font-bold uppercase tracking-wider text-yellow-500"
                    aria-label={`Toggle ${tab.label} stats`}
                  >
                    {tab.label}
                  </summary>
                  <div className="grid grid-cols-1 gap-3 p-3 border-t border-stone-700">
                    <div className="rounded border border-yellow-700/40 p-3 bg-stone-950">
                      <h4 className="text-sm font-bold text-yellow-500 mb-2 tracking-wide uppercase">
                        {fight.fighters[0].name}
                      </h4>
                      {renderStats(fight.fighters[0], tab.id)}
                    </div>
                    <div className="rounded border border-yellow-700/20 p-3 bg-stone-950">
                      <h4 className="text-sm font-bold text-yellow-400/80 mb-2 tracking-wide uppercase">
                        {fight.fighters[1].name}
                      </h4>
                      {renderStats(fight.fighters[1], tab.id)}
                    </div>
                  </div>
                </details>
              ))}
            </div>

            {/* Desktop side-by-side stats */}
            <div className="hidden md:grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="border border-yellow-700/50 rounded-lg p-4 bg-stone-950">
                <h4 className="text-lg font-bold text-yellow-500 mb-4 text-center border-b border-yellow-700/40 pb-2 tracking-wide uppercase">
                  {fight.fighters[0].name}
                </h4>
                {renderStats(fight.fighters[0])}
              </div>

              <div className="border border-yellow-700/30 rounded-lg p-4 bg-stone-950">
                <h4 className="text-lg font-bold text-yellow-400/80 mb-4 text-center border-b border-yellow-700/30 pb-2 tracking-wide uppercase">
                  {fight.fighters[1].name}
                </h4>
                {renderStats(fight.fighters[1])}
              </div>
            </div>

            {/* Weigh-In Clips — embedded video clips for the current card */}
            <WeighInClips fighters={fight.fighters} />

            {/* Fight Context notes (static advisory text) */}
            <KeyNotes />

            {/* Full Fight Record modal buttons */}
            <div className="mt-10 mb-6 border-t border-stone-700/60 pt-8">
              <div className="flex items-center gap-3 mb-5">
                <div className="h-px flex-1 bg-yellow-700/30" />
                <h3 className="text-yellow-500 text-xs font-bold uppercase tracking-widest">
                  📊 Full Career Records
                </h3>
                <div className="h-px flex-1 bg-yellow-700/30" />
              </div>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <button
                  onClick={() => openRecordModal(fight.fighters[0])}
                  className="bg-yellow-600 hover:bg-yellow-500 text-stone-900 px-6 py-3 rounded-lg border-2 border-yellow-500 hover:border-yellow-400 font-bold text-sm uppercase tracking-wide shadow-lg hover:shadow-xl"
                >
                  📈 {fight.fighters[0].name}
                </button>
                <button
                  onClick={() => openRecordModal(fight.fighters[1])}
                  className="bg-yellow-600 hover:bg-yellow-500 text-stone-900 px-6 py-3 rounded-lg border-2 border-yellow-500 hover:border-yellow-400 font-bold text-sm uppercase tracking-wide shadow-lg hover:shadow-xl"
                >
                  📈 {fight.fighters[1].name}
                </button>
              </div>
            </div>

            <p className="text-xs text-stone-600 mt-4 italic text-center tracking-wide leading-relaxed">
              ✓ Stats from DraftKings, UFCStats, Sherdog. Per-fight rates (SLpM,
              SApM, TDs) = UFC bouts only. Record &amp; finish counts = full pro
              career. Public sources only. Not betting advice.
            </p>
          </div>
        </details>
      </div>
    );
  },
);

FightStatsSection.displayName = "FightStatsSection";

export default FightStatsSection;
