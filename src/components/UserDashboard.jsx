import React, { useState, useEffect } from "react";
import api from "../services/api";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";

const UserDashboard = ({ currentUser }) => {
  const [lineups, setLineups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [fightResults, setFightResults] = useState([]);
  const [resultsLoading, setResultsLoading] = useState(true);

  // Paywall check — driven by prop from App.jsx
  const isPro = currentUser?.subscription_status === "pro";

  useEffect(() => {
    if (!isPro) return;
    const token = localStorage.getItem("authToken");
    if (!token) {
      setError("Please log in to view your dashboard");
      setLoading(false);
      return;
    }

    api
      .get("/api/lineups", token)
      .then((data) => {
        setLineups(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setError("Failed to load your saved lineups");
        setLoading(false);
      });

    // Load fight results
    fetch("/ufcstats_raw/ufc_fight_results.csv")
      .then((res) => res.text())
      .then((csvText) => {
        const lines = csvText.split("\n").filter((line) => line.trim());
        if (lines.length < 2) return;

        const headers = lines[0].split(",");
        const allData = lines.slice(1).map((line) => {
          const values = line.split(",");
          const obj = {};
          headers.forEach((h, i) => {
            obj[h.trim()] = values[i]?.trim() || "";
          });
          return obj;
        });

        // Get most recent event
        const mostRecentEvent = allData[0].EVENT;
        const recentResults = allData.filter(
          (result) => result.EVENT === mostRecentEvent,
        );

        setFightResults(recentResults);
        setResultsLoading(false);
      })
      .catch((err) => {
        console.error("Failed to load fight results:", err);
        setResultsLoading(false);
      });
  }, [isPro]);

  const handleUpgrade = async () => {
    const token = localStorage.getItem("authToken");
    if (!token) return;
    try {
      const data = await api.post("/api/create-checkout-session", {}, token);
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (err) {
      console.error("Upgrade error:", err);
    }
  };

  if (!isPro) {
    return (
      <div
        className="min-h-screen bg-gradient-to-br from-background via-stone-900 to-background"
        style={{ fontFamily: "'Courier New', monospace" }}
      >
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between border-b border-primary/40 bg-primary/10 px-6 py-2 backdrop-blur-sm"
        >
          <span className="text-primary text-xs font-bold tracking-widest uppercase">
            ⚡ CLASSIFIED OPS
          </span>
          <span className="text-primary/50 text-xs tracking-wider hidden sm:block">
            CLEARANCE: LEVEL 5
          </span>
          <span className="text-primary text-xs font-bold tracking-widest uppercase">
            DFS COMMAND ⚡
          </span>
        </motion.div>
        <div className="max-w-4xl mx-auto px-4 py-8 md:py-10 text-center">
          <motion.h1
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
            className="text-3xl md:text-5xl font-black text-white tracking-wider uppercase mb-4 bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent"
          >
            UPGRADE TO PRO
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="text-stone-400 mb-6 text-lg"
          >
            Access your saved lineups and advanced analytics.
          </motion.p>
          <motion.button
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            whileHover={{
              scale: 1.05,
              boxShadow: "0 0 20px rgba(10, 255, 153, 0.3)",
            }}
            whileTap={{ scale: 0.95 }}
            onClick={handleUpgrade}
            className="bg-gradient-to-r from-secondary to-primary hover:from-secondary/80 hover:to-primary/80 text-white font-bold py-4 px-8 rounded-xl transition-all duration-300 shadow-neon"
          >
            Upgrade to Pro - $19.99/month
          </motion.button>
        </div>
      </div>
    );
  }

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this lineup set?")) return;

    const token = localStorage.getItem("authToken");
    await api.del(`/api/lineups/${id}`, token);

    setLineups(lineups.filter((l) => l.id !== id));
  };

  if (loading)
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-stone-900 to-background flex items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full"
        />
      </div>
    );
  if (error)
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-stone-900 to-background flex items-center justify-center">
        <div className="bg-red-900/20 border border-red-500/50 rounded-xl p-6 text-red-400 text-center max-w-md">
          {error}
        </div>
      </div>
    );

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-stone-900 to-background">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <motion.h1
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-2xl sm:text-4xl font-black text-white mb-8 bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent"
        >
          My Dashboard
        </motion.h1>

        {/* Overview Stats */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12"
        >
          <motion.div
            whileHover={{ scale: 1.05 }}
            className="bg-card/80 backdrop-blur-sm border border-stone-700/50 rounded-xl p-4 sm:p-6 shadow-pearl hover:shadow-neon transition-all duration-300"
          >
            <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 bg-primary/20 rounded-lg flex items-center justify-center">
                📊
              </div>
              <div className="text-stone-400 text-xs uppercase tracking-wider">
                Saved Sets
              </div>
            </div>
            <div className="text-xl sm:text-3xl font-bold text-white">
              {lineups.length}
            </div>
          </motion.div>

          <motion.div
            whileHover={{ scale: 1.05 }}
            className="bg-card/80 backdrop-blur-sm border border-stone-700/50 rounded-xl p-4 sm:p-6 shadow-pearl hover:shadow-neon transition-all duration-300"
          >
            <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 bg-secondary/20 rounded-lg flex items-center justify-center">
                👥
              </div>
              <div className="text-stone-400 text-xs uppercase tracking-wider">
                Total Lineups
              </div>
            </div>
            <div className="text-xl sm:text-3xl font-bold text-white">
              {lineups.reduce(
                (sum, l) => sum + (l.lineup_data?.length || 0),
                0,
              )}
            </div>
          </motion.div>

          <motion.div
            whileHover={{ scale: 1.05 }}
            className="bg-card/80 backdrop-blur-sm border border-stone-700/50 rounded-xl p-4 sm:p-6 shadow-pearl hover:shadow-neon transition-all duration-300"
          >
            <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 bg-green-500/20 rounded-lg flex items-center justify-center">
                🏆
              </div>
              <div className="text-stone-400 text-xs uppercase tracking-wider">
                Best Proj FPTS
              </div>
            </div>
            <div className="text-xl sm:text-3xl font-bold text-secondary">
              {lineups.length
                ? Math.max(...lineups.map((l) => l.projected_fpts || 0))
                : 0}
            </div>
          </motion.div>

          <motion.div
            whileHover={{ scale: 1.05 }}
            className="bg-card/80 backdrop-blur-sm border border-stone-700/50 rounded-xl p-4 sm:p-6 shadow-pearl hover:shadow-neon transition-all duration-300"
          >
            <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 bg-blue-500/20 rounded-lg flex items-center justify-center">
                📅
              </div>
              <div className="text-stone-400 text-xs uppercase tracking-wider">
                Last Saved
              </div>
            </div>
            <div className="text-lg font-bold text-white">
              {lineups.length
                ? new Date(
                    Math.max(...lineups.map((l) => new Date(l.created_at))),
                  ).toLocaleDateString()
                : "Never"}
            </div>
          </motion.div>
        </motion.div>

        {/* Saved Lineups Section */}
        <motion.h2
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.4 }}
          className="text-2xl font-bold text-white mb-8 flex items-center gap-3"
        >
          <div className="w-8 h-8 bg-primary/20 rounded-lg flex items-center justify-center">
            💾
          </div>
          My Saved Lineups
        </motion.h2>

        {lineups.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.6 }}
            className="bg-card/80 backdrop-blur-sm border border-stone-700/50 rounded-2xl p-12 text-center shadow-pearl"
          >
            <div className="w-16 h-16 bg-stone-800 rounded-full flex items-center justify-center mx-auto mb-4">
              📝
            </div>
            <p className="text-stone-400 mb-6 text-lg">
              You haven't saved any lineups yet.
            </p>
            <Link
              to="/team-combinations"
              className="inline-flex items-center gap-2 bg-gradient-to-r from-primary to-secondary hover:from-primary/80 hover:to-secondary/80 text-white font-semibold px-8 py-4 rounded-xl transition-all duration-300 shadow-neon hover:shadow-neon"
            >
              <span>⚡</span>
              Generate & Save Lineups
            </Link>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            {lineups.map((lineup, index) => (
              <motion.div
                key={lineup.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 * index }}
                whileHover={{ y: -5 }}
                className="bg-card/80 backdrop-blur-sm border border-stone-700/50 rounded-2xl p-6 shadow-pearl hover:shadow-neon hover:border-primary/50 transition-all duration-300 group"
              >
                <div className="flex justify-between items-start mb-4">
                  <div className="flex-1">
                    <h3 className="font-bold text-xl text-white mb-2 group-hover:text-primary transition-colors">
                      {lineup.name}
                    </h3>
                    <span
                      className={`inline-flex items-center gap-1 px-3 py-1 text-xs font-medium rounded-full ${
                        lineup.salary_mode === "higher"
                          ? "bg-red-900/60 text-red-300 border border-red-500/30"
                          : lineup.salary_mode === "medium"
                            ? "bg-yellow-900/60 text-yellow-300 border border-yellow-500/30"
                            : "bg-blue-900/60 text-blue-300 border border-blue-500/30"
                      }`}
                    >
                      {lineup.salary_mode.toUpperCase()}
                    </span>
                  </div>
                  <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => handleDelete(lineup.id)}
                    className="text-red-400 hover:text-red-300 text-sm p-2 hover:bg-red-900/20 rounded-lg transition-colors"
                  >
                    🗑️
                  </motion.button>
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm mb-6">
                  <div className="bg-stone-800/50 rounded-lg p-3">
                    <span className="text-stone-400 block text-xs uppercase tracking-wider mb-1">
                      Avg Salary
                    </span>
                    <div className="font-mono text-white text-lg font-bold">
                      ${lineup.total_salary.toLocaleString()}
                    </div>
                  </div>
                  <div className="bg-stone-800/50 rounded-lg p-3">
                    <span className="text-stone-400 block text-xs uppercase tracking-wider mb-1">
                      Proj FPTS
                    </span>
                    <div className="font-mono text-secondary text-lg font-bold">
                      {lineup.projected_fpts}
                    </div>
                  </div>
                </div>

                <div className="text-xs text-stone-500 mb-4 flex items-center gap-2">
                  <span>📅</span>
                  Saved {new Date(lineup.created_at).toLocaleDateString()}
                </div>

                {/* Expandable fighters / parlay legs */}
                <details className="mt-4">
                  <summary className="cursor-pointer text-primary hover:text-primary/80 text-sm font-medium flex items-center gap-2 transition-colors">
                    <span>👀</span>
                    {lineup.salary_mode === "parlay"
                      ? `View ${lineup.lineup_data?.length || 0} legs`
                      : `View ${lineup.lineup_data?.length || 0} lineups`}
                    <span className="text-xs">▼</span>
                  </summary>
                  <motion.div
                    initial={false}
                    className="mt-4 space-y-3 text-xs"
                  >
                    {lineup.salary_mode === "parlay" ? (
                      // Parlay legs — each item is { description, odds, betType }
                      <div className="bg-stone-950/80 backdrop-blur-sm p-4 rounded-xl border border-stone-800/50">
                        <div className="font-medium text-stone-300 mb-3 flex items-center gap-2">
                          <span>🎯</span>
                          Parlay Legs
                        </div>
                        <div className="grid grid-cols-1 gap-y-2">
                          {lineup.lineup_data?.map((leg, i) => (
                            <div
                              key={i}
                              className="text-stone-300 flex justify-between items-center py-1"
                            >
                              <span>{leg.description}</span>
                              <span
                                className={`font-mono font-bold ${leg.odds > 0 ? "text-green-400" : "text-red-400"}`}
                              >
                                {leg.odds > 0 ? `+${leg.odds}` : leg.odds}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      // DFS lineups — each item is an array of fighters
                      lineup.lineup_data?.map((l, idx) => (
                        <motion.div
                          key={idx}
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          className="bg-stone-950/80 backdrop-blur-sm p-4 rounded-xl border border-stone-800/50"
                        >
                          <div className="font-medium text-stone-300 mb-3 flex items-center gap-2">
                            <span>🏃</span>
                            Lineup {idx + 1}
                          </div>
                          <div className="grid grid-cols-1 gap-y-2">
                            {Array.isArray(l) &&
                              l.map((f, i) => (
                                <div
                                  key={i}
                                  className="text-stone-300 flex justify-between items-center py-1"
                                >
                                  <span>{f.name}</span>
                                  <span className="font-mono text-primary font-bold">
                                    ${f.salary}
                                  </span>
                                </div>
                              ))}
                          </div>
                        </motion.div>
                      ))
                    )}
                  </motion.div>
                </details>
              </motion.div>
            ))}
          </motion.div>
        )}
      </div>

      {/* Fight Results Accordion */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.8 }}
        className="mt-8"
      >
        <details className="group bg-card/80 backdrop-blur-sm border border-stone-700/50 rounded-2xl shadow-pearl">
          <summary className="cursor-pointer p-6 text-xl font-bold text-white flex items-center justify-between hover:bg-stone-800/50 transition-colors">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-primary/20 rounded-lg flex items-center justify-center">
                🥊
              </div>
              Fight Results
              <span className="text-sm font-normal text-stone-400">
                ({fightResults.length} fights)
              </span>
            </div>
            <span className="text-stone-400 group-open:rotate-180 transition-transform">
              ▼
            </span>
          </summary>
          <div className="p-6 pt-0">
            {resultsLoading ? (
              <div className="text-center py-8 text-stone-400">
                Loading fight results...
              </div>
            ) : fightResults.length > 0 ? (
              <div className="space-y-4">
                {fightResults.map((fight, index) => {
                  const [fighter1, fighter2] = fight.BOUT.split(" vs. ");
                  const winner = fight.OUTCOME === "W/L" ? fighter1 : fighter2;
                  const loser = fight.OUTCOME === "W/L" ? fighter2 : fighter1;

                  return (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.05 * index }}
                      className="bg-stone-800/50 rounded-xl p-4 border border-stone-700/30"
                    >
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <span className="text-stone-300">{fighter1}</span>
                            <span className="text-stone-500">vs</span>
                            <span className="text-stone-300">{fighter2}</span>
                          </div>
                          <div className="text-sm text-stone-400">
                            {fight.WEIGHTCLASS} • {fight.METHOD} • Round{" "}
                            {fight.ROUND} • {fight.TIME}
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <div className="text-secondary font-bold">
                              🏆 {winner}
                            </div>
                            <div className="text-xs text-stone-500">Winner</div>
                          </div>
                          <div className="text-right">
                            <div className="text-stone-400">--</div>
                            <div className="text-xs text-stone-500">
                              DK Score
                            </div>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8 text-stone-400">
                No fight results available
              </div>
            )}
          </div>
        </details>
      </motion.div>

      {/* Your Lineup Performance & Advice Accordion */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.0 }}
        className="mt-6"
      >
        <details className="group bg-card/80 backdrop-blur-sm border border-stone-700/50 rounded-2xl shadow-pearl">
          <summary className="cursor-pointer p-6 text-xl font-bold text-white flex items-center justify-between hover:bg-stone-800/50 transition-colors">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-secondary/20 rounded-lg flex items-center justify-center">
                📈
              </div>
              Your Lineup Performance & Advice
            </div>
            <span className="text-stone-400 group-open:rotate-180 transition-transform">
              ▼
            </span>
          </summary>
          <div className="p-6 pt-0">
            {lineups.length > 0 ? (
              <div className="space-y-6">
                {/* Performance Summary */}
                <div className="bg-gradient-to-r from-primary/10 to-secondary/10 rounded-xl p-4 border border-primary/20">
                  <h3 className="font-bold text-white mb-3">
                    Performance Summary
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                    <div>
                      <span className="text-stone-400">Lineups Saved:</span>
                      <span className="text-white font-bold ml-2">
                        {lineups.length}
                      </span>
                    </div>
                    <div>
                      <span className="text-stone-400">Avg Projected:</span>
                      <span className="text-secondary font-bold ml-2">
                        {(
                          lineups.reduce(
                            (sum, l) => sum + (l.projected_fpts || 0),
                            0,
                          ) / lineups.length
                        ).toFixed(1)}{" "}
                        pts
                      </span>
                    </div>
                    <div>
                      <span className="text-stone-400">Best Lineup:</span>
                      <span className="text-white font-bold ml-2">
                        {Math.max(
                          ...lineups.map((l) => l.projected_fpts || 0),
                        ).toFixed(1)}{" "}
                        pts
                      </span>
                    </div>
                  </div>
                </div>

                {/* Personalized Advice */}
                <div className="space-y-4">
                  <h3 className="font-bold text-white flex items-center gap-2">
                    <span>💡</span>
                    Personalized Advice
                  </h3>

                  <div className="space-y-3">
                    {fightResults.some(
                      (r) => r.METHOD === "KO/TKO" && r.ROUND === "1",
                    ) && (
                      <div className="flex items-start gap-3 p-4 bg-stone-800/50 rounded-xl border border-yellow-500/20">
                        <div className="w-6 h-6 bg-yellow-500/20 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                          <span className="text-yellow-400 text-sm">⚡</span>
                        </div>
                        <div>
                          <p className="text-stone-300">
                            <strong>Early Finishes:</strong> This event had
                            several first-round knockouts. Consider weighting
                            fighters with strong striking more heavily in future
                            lineups.
                          </p>
                        </div>
                      </div>
                    )}

                    {lineups.some((l) => (l.projected_fpts || 0) < 100) && (
                      <div className="flex items-start gap-3 p-4 bg-stone-800/50 rounded-xl border border-blue-500/20">
                        <div className="w-6 h-6 bg-blue-500/20 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                          <span className="text-blue-400 text-sm">🎯</span>
                        </div>
                        <div>
                          <p className="text-stone-300">
                            <strong>Salary Optimization:</strong> Some of your
                            lineups scored below 100 points. Try focusing on
                            value plays and avoiding overpriced fighters in
                            future events.
                          </p>
                        </div>
                      </div>
                    )}

                    <div className="flex items-start gap-3 p-4 bg-stone-800/50 rounded-xl border border-green-500/20">
                      <div className="w-6 h-6 bg-green-500/20 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                        <span className="text-green-400 text-sm">📊</span>
                      </div>
                      <div>
                        <p className="text-stone-300">
                          <strong>Decision Focus:</strong> Many fights went to
                          decision. Consider prioritizing fighters with strong
                          cardio and wrestling backgrounds for longer fights.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Disclaimer */}
                <div className="bg-stone-800/30 rounded-xl p-4 border border-stone-600/30">
                  <p className="text-stone-400 text-sm italic">
                    <strong>Disclaimer:</strong> This analysis is based on real
                    fight results and is for informational purposes only — no
                    guarantees for future events. Past performance does not
                    predict future results.
                  </p>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-stone-400">
                <div className="w-16 h-16 bg-stone-800 rounded-full flex items-center justify-center mx-auto mb-4">
                  📝
                </div>
                <p>You haven't saved any lineups yet.</p>
                <p className="text-sm mt-2">
                  Create and save lineups to see personalized performance
                  analysis.
                </p>
              </div>
            )}
          </div>
        </details>
      </motion.div>
    </div>
  );
};

export default UserDashboard;
