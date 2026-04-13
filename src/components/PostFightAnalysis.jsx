import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";

const PostFightAnalysis = ({ currentUser }) => {
  const [fightResults, setFightResults] = useState([]);
  const [userLineups, setUserLineups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [analysis, setAnalysis] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);

      // Load fight results
      const fightRes = await fetch("/ufcstats_raw/ufc_fight_results.csv");
      if (!fightRes.ok) throw new Error("Failed to load fight results");
      const csvText = await fightRes.text();

      const lines = csvText.split("\n").filter((line) => line.trim());
      if (lines.length < 2) throw new Error("No fight data available");

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

      // Load user lineups if logged in
      if (currentUser) {
        const token = localStorage.getItem("authToken");
        if (token) {
          const lineupRes = await fetch("http://localhost:8000/api/lineups", {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (lineupRes.ok) {
            const lineups = await lineupRes.json();
            setUserLineups(lineups);
          }
        }
      }

      // Generate analysis
      generateAnalysis(recentResults, currentUser ? userLineups : []);
    } catch (err) {
      console.error("Error loading data:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const generateAnalysis = (results, lineups) => {
    const analysis = {
      eventName: results[0]?.EVENT || "Unknown Event",
      totalFights: results.length,
      upsets: [],
      valueFighters: [],
      userPerformance: null,
      suggestions: [],
      cardAnalysis: {},
    };

    // Calculate upsets (unexpected outcomes)
    // For now, we'll consider KO/TKO in round 1 as potential upsets
    results.forEach((result) => {
      const [fighter1, fighter2] = result.BOUT.split(" vs. ");
      const [winner, loser] =
        result.OUTCOME === "W/L" ? [fighter1, fighter2] : [fighter2, fighter1];

      if (result.METHOD === "KO/TKO" && result.ROUND === "1") {
        analysis.upsets.push({
          winner,
          loser,
          method: result.METHOD,
          round: result.ROUND,
          time: result.TIME,
          reason: "First round KO/TKO",
        });
      }
    });

    // Best value fighters (high impact with efficient method)
    results.forEach((result) => {
      const [fighter1, fighter2] = result.BOUT.split(" vs. ");
      const winner = result.OUTCOME === "W/L" ? fighter1 : fighter2;

      if (result.METHOD === "KO/TKO" || result.METHOD === "Submission") {
        analysis.valueFighters.push({
          name: winner,
          method: result.METHOD,
          round: result.ROUND,
          time: result.TIME,
          weightclass: result.WEIGHTCLASS,
        });
      }
    });

    // User performance analysis
    if (lineups.length > 0) {
      const userStats = {
        totalLineups: lineups.length,
        totalFighters: lineups.reduce(
          (sum, l) => sum + (l.lineup_data?.length || 0),
          0,
        ),
        avgProjectedPoints:
          lineups.reduce((sum, l) => sum + (l.projected_fpts || 0), 0) /
          lineups.length,
        bestLineup: lineups.reduce(
          (best, l) =>
            l.projected_fpts > (best?.projected_fpts || 0) ? l : best,
          null,
        ),
      };

      analysis.userPerformance = userStats;
    }

    // Generate suggestions
    if (analysis.upsets.length > 0) {
      analysis.suggestions.push(
        "Consider the underdog more in future events - several upsets occurred",
      );
    }
    if (analysis.valueFighters.length > 0) {
      analysis.suggestions.push(
        "Focus on fighters with strong finishing ability in early rounds",
      );
    }
    if (lineups.length === 0) {
      analysis.suggestions.push(
        "Save your lineups to get personalized post-fight analysis",
      );
    }

    // Card analysis
    const methods = results.reduce((acc, result) => {
      acc[result.METHOD] = (acc[result.METHOD] || 0) + 1;
      return acc;
    }, {});

    analysis.cardAnalysis = {
      totalFights: results.length,
      finishRate: (
        (results.filter(
          (r) =>
            r.METHOD !== "Decision - Unanimous" &&
            r.METHOD !== "Decision - Split",
        ).length /
          results.length) *
        100
      ).toFixed(1),
      avgRound: (
        results.reduce((sum, r) => sum + parseInt(r.ROUND), 0) / results.length
      ).toFixed(1),
      methodBreakdown: methods,
    };

    setAnalysis(analysis);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-stone-900 to-background flex items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full"
        />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-stone-900 to-background flex items-center justify-center">
        <div className="bg-red-900/20 border border-red-500/50 rounded-xl p-6 text-red-400 text-center max-w-md">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-stone-900 to-background">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <h1 className="text-2xl sm:text-4xl font-black text-white mb-2 bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
            Post-Fight Analysis
          </h1>
          <p className="text-stone-400 text-lg">{analysis?.eventName}</p>
        </motion.div>

        {/* Event Overview */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mb-8"
        >
          <div className="bg-card/80 backdrop-blur-sm border border-stone-700/50 rounded-xl p-4 sm:p-6 shadow-pearl">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 bg-primary/20 rounded-lg flex items-center justify-center">
                🥊
              </div>
              <div className="text-stone-400 text-xs uppercase tracking-wider">
                Total Fights
              </div>
            </div>
            <div className="text-xl sm:text-3xl font-bold text-white">
              {analysis?.totalFights}
            </div>
          </div>

          <div className="bg-card/80 backdrop-blur-sm border border-stone-700/50 rounded-xl p-4 sm:p-6 shadow-pearl">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 bg-secondary/20 rounded-lg flex items-center justify-center">
                ⚡
              </div>
              <div className="text-stone-400 text-xs uppercase tracking-wider">
                Finish Rate
              </div>
            </div>
            <div className="text-xl sm:text-3xl font-bold text-secondary">
              {analysis?.cardAnalysis.finishRate}%
            </div>
          </div>

          <div className="bg-card/80 backdrop-blur-sm border border-stone-700/50 rounded-xl p-4 sm:p-6 shadow-pearl">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 bg-green-500/20 rounded-lg flex items-center justify-center">
                📊
              </div>
              <div className="text-stone-400 text-xs uppercase tracking-wider">
                Avg Round
              </div>
            </div>
            <div className="text-xl sm:text-3xl font-bold text-white">
              {analysis?.cardAnalysis.avgRound}
            </div>
          </div>

          <div className="bg-card/80 backdrop-blur-sm border border-stone-700/50 rounded-xl p-4 sm:p-6 shadow-pearl">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 bg-blue-500/20 rounded-lg flex items-center justify-center">
                👤
              </div>
              <div className="text-stone-400 text-xs uppercase tracking-wider">
                Your Lineups
              </div>
            </div>
            <div className="text-xl sm:text-3xl font-bold text-white">
              {userLineups.length}
            </div>
          </div>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Biggest Upsets */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4 }}
            className="bg-card/80 backdrop-blur-sm border border-stone-700/50 rounded-2xl p-6 shadow-pearl"
          >
            <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
              <div className="w-8 h-8 bg-red-500/20 rounded-lg flex items-center justify-center">
                💥
              </div>
              Biggest Upsets
            </h2>

            {analysis?.upsets.length > 0 ? (
              <div className="space-y-4">
                {analysis.upsets.map((upset, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 * index }}
                    className="bg-stone-800/50 rounded-xl p-4 border border-red-500/20"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <div className="font-bold text-white text-lg">
                          {upset.winner}
                        </div>
                        <div className="text-stone-400">def. {upset.loser}</div>
                      </div>
                      <span className="bg-red-900/60 text-red-300 px-3 py-1 rounded-full text-xs font-medium">
                        {upset.method} R{upset.round}
                      </span>
                    </div>
                    <div className="text-stone-500 text-sm">
                      {upset.reason} • {upset.time}
                    </div>
                  </motion.div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-stone-400">
                No major upsets in this event
              </div>
            )}
          </motion.div>

          {/* Best Value Fighters */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4 }}
            className="bg-card/80 backdrop-blur-sm border border-stone-700/50 rounded-2xl p-6 shadow-pearl"
          >
            <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
              <div className="w-8 h-8 bg-green-500/20 rounded-lg flex items-center justify-center">
                💎
              </div>
              Best Value Fighters
            </h2>

            {analysis?.valueFighters.length > 0 ? (
              <div className="space-y-4">
                {analysis.valueFighters.map((fighter, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 * index }}
                    className="bg-stone-800/50 rounded-xl p-4 border border-green-500/20"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <div className="font-bold text-white text-lg">
                          {fighter.name}
                        </div>
                        <div className="text-stone-400 text-sm">
                          {fighter.weightclass}
                        </div>
                      </div>
                      <span className="bg-green-900/60 text-green-300 px-3 py-1 rounded-full text-xs font-medium">
                        {fighter.method} R{fighter.round}
                      </span>
                    </div>
                    <div className="text-stone-500 text-sm">
                      Finished in {fighter.time}
                    </div>
                  </motion.div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-stone-400">
                No standout performances
              </div>
            )}
          </motion.div>
        </div>

        {/* User Performance (if logged in) */}
        {currentUser && analysis?.userPerformance && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="mt-8 bg-card/80 backdrop-blur-sm border border-stone-700/50 rounded-2xl p-6 shadow-pearl"
          >
            <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
              <div className="w-8 h-8 bg-primary/20 rounded-lg flex items-center justify-center">
                📈
              </div>
              Your Performance
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
              <div className="bg-stone-800/50 rounded-lg p-4">
                <div className="text-stone-400 text-sm uppercase tracking-wider mb-2">
                  Lineups Saved
                </div>
                <div className="text-2xl font-bold text-white">
                  {analysis.userPerformance.totalLineups}
                </div>
              </div>

              <div className="bg-stone-800/50 rounded-lg p-4">
                <div className="text-stone-400 text-sm uppercase tracking-wider mb-2">
                  Total Fighters
                </div>
                <div className="text-2xl font-bold text-white">
                  {analysis.userPerformance.totalFighters}
                </div>
              </div>

              <div className="bg-stone-800/50 rounded-lg p-4">
                <div className="text-stone-400 text-sm uppercase tracking-wider mb-2">
                  Avg Projected Points
                </div>
                <div className="text-2xl font-bold text-secondary">
                  {analysis.userPerformance.avgProjectedPoints.toFixed(1)}
                </div>
              </div>
            </div>

            {analysis.userPerformance.bestLineup && (
              <div className="bg-gradient-to-r from-primary/10 to-secondary/10 rounded-xl p-4 border border-primary/20">
                <h3 className="font-bold text-white mb-2">Your Best Lineup</h3>
                <div className="text-stone-300">
                  <strong>{analysis.userPerformance.bestLineup.name}</strong> -{" "}
                  {analysis.userPerformance.bestLineup.projected_fpts} pts
                </div>
              </div>
            )}
          </motion.div>
        )}

        {/* Personalized Suggestions */}
        {analysis?.suggestions.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8 }}
            className="mt-8 bg-card/80 backdrop-blur-sm border border-stone-700/50 rounded-2xl p-6 shadow-pearl"
          >
            <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
              <div className="w-8 h-8 bg-yellow-500/20 rounded-lg flex items-center justify-center">
                💡
              </div>
              Personalized Suggestions
            </h2>

            <div className="space-y-3">
              {analysis.suggestions.map((suggestion, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.1 * index }}
                  className="flex items-start gap-3 p-4 bg-stone-800/50 rounded-xl border border-yellow-500/20"
                >
                  <div className="w-6 h-6 bg-yellow-500/20 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-yellow-400 text-sm">💡</span>
                  </div>
                  <p className="text-stone-300">{suggestion}</p>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Card Analysis */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.0 }}
          className="mt-8 bg-card/80 backdrop-blur-sm border border-stone-700/50 rounded-2xl p-6 shadow-pearl"
        >
          <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
            <div className="w-8 h-8 bg-purple-500/20 rounded-lg flex items-center justify-center">
              📊
            </div>
            Event Breakdown
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="font-bold text-white mb-4">Finish Methods</h3>
              <div className="space-y-2">
                {Object.entries(
                  analysis?.cardAnalysis.methodBreakdown || {},
                ).map(([method, count]) => (
                  <div
                    key={method}
                    className="flex justify-between items-center"
                  >
                    <span className="text-stone-300">{method}</span>
                    <span className="font-bold text-white">{count}</span>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h3 className="font-bold text-white mb-4">Key Insights</h3>
              <div className="space-y-3 text-stone-300">
                <p>
                  • {analysis?.cardAnalysis.finishRate}% of fights ended by
                  finish
                </p>
                <p>
                  • Average fight went {analysis?.cardAnalysis.avgRound} rounds
                </p>
                <p>• {analysis?.totalFights} total bouts on the card</p>
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Call-to-Action for logged-in users */}
      {currentUser && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.2 }}
          className="mt-12 bg-gradient-to-r from-primary/10 via-secondary/10 to-primary/10 border border-primary/30 rounded-2xl p-8 text-center shadow-neon"
        >
          <div className="w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center mx-auto mb-4">
            📊
          </div>
          <h3 className="text-2xl font-bold text-white mb-3">
            See How Your Lineups Performed
          </h3>
          <p className="text-stone-300 mb-6 max-w-2xl mx-auto">
            Logged in? Check your dashboard to see detailed analysis of how your
            saved lineups performed against these actual fight results, plus
            personalized advice for future events.
          </p>
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-2 bg-gradient-to-r from-primary to-secondary hover:from-primary/80 hover:to-secondary/80 text-white font-semibold px-8 py-4 rounded-xl transition-all duration-300 shadow-neon hover:shadow-neon"
          >
            <span>📈</span>
            View Your Performance
          </Link>
        </motion.div>
      )}
    </div>
  );
};

export default PostFightAnalysis;
