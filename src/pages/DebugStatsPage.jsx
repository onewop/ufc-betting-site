/**
 * DebugStatsPage.jsx
 *
 * PRIVATE OWNER-ONLY TOOL — reachable at /debug-stats.
 * Not linked in any public navigation (desktop or mobile).
 *
 * Fetches the same /this_weeks_stats.json used by the live Fight Analyzer,
 * lets you pick a fight, and renders DebugFighterStats with full source tracing.
 *
 * This page has zero impact on any public pages or the live stats section.
 */

import { useState, useEffect } from "react";
import DebugFighterStats from "../components/DebugFighterStats";
import api from "../services/api";

const DebugStatsPage = ({ currentUser }) => {
  const [fights, setFights] = useState([]);
  const [selectedFightId, setSelectedFightId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showRaw, setShowRaw] = useState(false);

  // Pull from the same data source as the live site — no special endpoint needed.
  useEffect(() => {
    setLoading(true);
    api
      .get("/api/this-weeks-stats")
      .then((data) => {
        const fightList = data?.fights ?? [];
        setFights(fightList);
        if (fightList.length > 0) {
          setSelectedFightId(fightList[0].fight_id);
        }
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  const selectedFight =
    fights.find((f) => f.fight_id === selectedFightId) ?? null;

  return (
    <div className="min-h-screen bg-stone-950 text-stone-100 px-4 py-8 max-w-5xl mx-auto">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="border border-yellow-700/60 rounded-xl bg-stone-900 p-5 mb-8">
        <h1 className="text-2xl font-black text-yellow-400 tracking-wide mb-1">
          🔧 Debug Fighter Stats – Source Tracing Mode
        </h1>
        <p className="text-yellow-600 font-bold text-sm uppercase tracking-wider mb-3">
          Owner Tool Only
        </p>
        <p className="text-stone-400 text-sm leading-relaxed">
          This is a private troubleshooting tool for the site owner to identify
          missing stats before fight weeks. Every stat shows its exact data path
          and origin source. Missing or null values are highlighted in red with
          the raw JSON value so you can trace exactly where data needs to be
          fixed.
        </p>
        <div className="mt-3 text-stone-400 text-sm leading-relaxed">
          This tool helps identify missing stats before fight weeks. Use the
          Copy button to export issues.
        </div>
        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          <span className="bg-stone-800 text-stone-400 rounded px-2 py-1">
            Data source:{" "}
            <code className="text-yellow-500">/this_weeks_stats.json</code>
          </span>
          <span className="bg-stone-800 text-stone-400 rounded px-2 py-1">
            Same data as live Fight Analyzer — read-only, no writes
          </span>
          {currentUser && (
            <span className="bg-stone-800 text-green-400/80 rounded px-2 py-1">
              Logged in as: {currentUser.username || currentUser.email}
            </span>
          )}
        </div>
      </div>

      {/* ── Loading / Error states ──────────────────────────────────────── */}
      {loading && (
        <div className="text-stone-400 text-center py-12">
          Loading this_weeks_stats.json…
        </div>
      )}
      {error && (
        <div className="bg-red-900/30 border border-red-700/50 rounded-lg p-4 mb-6 text-red-400 text-sm">
          <strong>Error loading data:</strong> {error}
          <br />
          <span className="text-xs text-stone-500 mt-1 block">
            Make sure the dev server is running and /this_weeks_stats.json is in
            the public folder.
          </span>
        </div>
      )}

      {!loading && !error && fights.length === 0 && (
        <div className="text-stone-500 text-center py-12">
          No fights found in this_weeks_stats.json.
        </div>
      )}

      {!loading && fights.length > 0 && (
        <>
          {/* ── Fight selector ───────────────────────────────────────────── */}
          <div className="mb-6">
            <label
              htmlFor="debug-fight-select"
              className="block text-stone-400 text-xs uppercase tracking-wider font-bold mb-2"
            >
              Select Fight to Inspect
            </label>
            <select
              id="debug-fight-select"
              value={selectedFightId ?? ""}
              onChange={(e) => setSelectedFightId(Number(e.target.value))}
              className="w-full bg-stone-800 border border-stone-700 text-stone-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-yellow-600"
            >
              {fights.map((fight) => (
                <option key={fight.fight_id} value={fight.fight_id}>
                  {fight.matchup ||
                    fight.fighters?.map((f) => f.name).join(" vs ") ||
                    `Fight #${fight.fight_id}`}
                  {fight.weight_class ? ` — ${fight.weight_class}` : ""}
                </option>
              ))}
            </select>
            <p className="text-stone-600 text-xs mt-1">
              {fights.length} fight(s) loaded from this week's card
            </p>
          </div>

          {/* ── All fights quick-list ────────────────────────────────────── */}
          <details className="mb-6 border border-stone-800 rounded-lg">
            <summary className="px-4 py-2 text-xs text-stone-500 uppercase tracking-wider cursor-pointer hover:text-stone-300">
              Full Card Overview ({fights.length} fights)
            </summary>
            <div className="p-3 grid gap-1">
              {fights.map((fight) => {
                const f1 = fight.fighters?.[0];
                const f2 = fight.fighters?.[1];
                const missingCount = fight.fighters?.reduce((acc, fighter) => {
                  const allStatKeys = [
                    ...Object.values({
                      slpm: "stats.slpm",
                      sapm: "stats.sapm",
                      striking_accuracy: "striking_accuracy",
                      striking_defense: "stats.striking_defense",
                      td_avg: "stats.td_avg",
                      td_accuracy: "stats.td_accuracy",
                      td_defense: "stats.td_defense",
                    }),
                  ];
                  return (
                    acc +
                    allStatKeys.filter((key) => {
                      const keys = key.split(".");
                      let val = fighter;
                      for (const k of keys) val = val?.[k];
                      return val == null || val === "N/A";
                    }).length
                  );
                }, 0);

                return (
                  <button
                    key={fight.fight_id}
                    onClick={() => setSelectedFightId(fight.fight_id)}
                    className={`text-left px-3 py-2 rounded text-xs flex justify-between items-center transition ${
                      selectedFightId === fight.fight_id
                        ? "bg-yellow-900/30 text-yellow-300"
                        : "hover:bg-stone-800 text-stone-400"
                    }`}
                  >
                    <span>
                      {f1?.name ?? "?"} vs {f2?.name ?? "?"}
                      {fight.weight_class ? (
                        <span className="ml-2 text-stone-600">
                          {fight.weight_class}
                        </span>
                      ) : null}
                    </span>
                    {missingCount > 0 && (
                      <span className="text-red-400/70 font-mono ml-2">
                        ⚠ {missingCount} missing
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </details>

          {/* ── Debug stats for selected fight ───────────────────────────── */}
          {selectedFight ? (
            <DebugFighterStats
              fighters={selectedFight.fighters ?? []}
              matchup={
                selectedFight.matchup ||
                selectedFight.fighters?.map((f) => f.name).join(" vs ") ||
                `Fight #${selectedFight.fight_id}`
              }
            />
          ) : (
            <div className="text-stone-500 text-center py-8">
              Select a fight above to inspect stats.
            </div>
          )}

          {/* ── Raw JSON dump ────────────────────────────────────────────── */}
          <div className="mt-8 border border-stone-800 rounded-lg">
            <button
              onClick={() => setShowRaw((v) => !v)}
              className="w-full px-4 py-2 text-xs text-stone-500 uppercase tracking-wider hover:text-stone-300 text-left"
            >
              {showRaw ? "▼" : "▶"} Raw this_weeks_stats.json — full fight array
            </button>
            {showRaw && (
              <pre className="text-[9px] text-stone-500 bg-stone-900 p-3 overflow-x-auto max-h-96 rounded-b-lg whitespace-pre-wrap break-all">
                {JSON.stringify(fights, null, 2)}
              </pre>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default DebugStatsPage;
