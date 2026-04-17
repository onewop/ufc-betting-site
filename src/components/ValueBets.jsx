import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  computeProjection,
  estimateFightRounds,
  estimateWinProbability,
} from "./projectionMath";

// ─── Odds utilities (same as LatestOdds.jsx) ────────────────────────────────

const ODDS_CACHE_KEY = "ufc_odds_cache_v3";

/** Format American moneyline for display */
const fmt = (price) => {
  if (price == null) return "—";
  return price > 0 ? `+${price}` : `${price}`;
};

/** American odds → implied probability (0-1) */
const impliedProbFromAmerican = (price) => {
  if (price == null) return null;
  return price < 0
    ? Math.abs(price) / (Math.abs(price) + 100)
    : 100 / (price + 100);
};

/** Find best (highest) moneyline price for a fighter across bookmakers */
const bestOddsForName = (bookmakers, name) => {
  let best = null;
  (bookmakers || []).forEach((bm) => {
    const h2h = bm.markets?.find((m) => m.key === "h2h");
    if (!h2h) return;
    const outcome = h2h.outcomes?.find((o) => o.name === name);
    if (outcome && (best === null || outcome.price > best))
      best = outcome.price;
  });
  return best;
};

/** Find best totals (O/U rounds) across bookmakers */
const bestTotalsForFight = (bookmakers) => {
  const totals = [];
  (bookmakers || []).forEach((bm) => {
    const market = bm.markets?.find((m) => m.key === "totals");
    if (!market) return;
    market.outcomes?.forEach((o) => {
      totals.push({
        name: o.name,
        point: o.point,
        price: o.price,
        book: bm.key,
      });
    });
  });
  return totals;
};

// ─── Fuzzy name matching ─────────────────────────────────────────────────────

const normalize = (n) =>
  (n || "")
    .toLowerCase()
    .replace(/[^a-z ]/g, "")
    .trim();

const nameParts = (n) => normalize(n).split(/\s+/);

const fuzzyMatch = (statsName, oddsName) => {
  if (!statsName || !oddsName) return false;
  const a = normalize(statsName);
  const b = normalize(oddsName);
  if (a === b) return true;
  // Last-name match
  const ap = nameParts(statsName);
  const bp = nameParts(oddsName);
  if (ap.length && bp.length && ap[ap.length - 1] === bp[bp.length - 1])
    return true;
  return false;
};

// ─── +EV Calculation ─────────────────────────────────────────────────────────

/**
 * Calculate +EV percentage.
 * +EV = (modelProb * decimalOdds) - 1
 * Where decimalOdds = american-to-decimal conversion.
 */
const americanToDecimal = (price) => {
  if (price == null) return null;
  return price > 0 ? price / 100 + 1 : 100 / Math.abs(price) + 1;
};

const calcEV = (modelProb, americanOdds) => {
  if (modelProb == null || americanOdds == null) return null;
  const decimal = americanToDecimal(americanOdds);
  if (decimal == null) return null;
  return (modelProb * decimal - 1) * 100; // percentage
};

// ─── EV threshold presets ────────────────────────────────────────────────────

const EV_THRESHOLDS = [
  { label: "All", value: 0 },
  { label: "+3%", value: 3 },
  { label: "+5%", value: 5 },
  { label: "+8%", value: 8 },
  { label: "+12%", value: 12 },
];

const BET_TYPE_FILTERS = ["All", "Moneyline", "Totals"];

// ─── Recommendation labels ───────────────────────────────────────────────────

const getRecommendation = (ev) => {
  if (ev >= 15) return { label: "STRONG BET", cls: "text-green-400 font-bold" };
  if (ev >= 8) return { label: "GOOD VALUE", cls: "text-green-500" };
  if (ev >= 3) return { label: "SLIGHT EDGE", cls: "text-yellow-400" };
  return { label: "MARGINAL", cls: "text-stone-400" };
};

const getRowBg = (ev) => {
  if (ev >= 15) return "bg-green-900/20 border-l-2 border-green-500";
  if (ev >= 8) return "bg-green-900/10 border-l-2 border-green-700";
  if (ev >= 3) return "bg-yellow-900/10 border-l-2 border-yellow-700/60";
  return "";
};

// ─── Component ───────────────────────────────────────────────────────────────

const ValueBets = ({ eventTitle }) => {
  const [fights, setFights] = useState([]);
  const [oddsData, setOddsData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [evThreshold, setEvThreshold] = useState(3);
  const [betTypeFilter, setBetTypeFilter] = useState("All");
  const [showExplainer, setShowExplainer] = useState(false);
  const [eventInfo, setEventInfo] = useState({ name: "", date: "" });

  // ── Load fighter stats ──
  useEffect(() => {
    fetch("/this_weeks_stats.json")
      .then((r) => r.json())
      .then((data) => {
        setFights(data.fights || []);
        setEventInfo({
          name: data.event?.name || "",
          date: data.event?.date || "",
        });
      })
      .catch(() => {});
  }, []);

  // ── Load odds from localStorage cache (same cache as LatestOdds page) ──
  const loadOddsFromCache = useCallback(() => {
    try {
      const cached = JSON.parse(localStorage.getItem(ODDS_CACHE_KEY));
      if (cached?.data) {
        setOddsData(cached.data);
        setLastUpdated(cached.timestamp);
        setLoading(false);
        return true;
      }
    } catch (_) {}
    return false;
  }, []);

  // ── Fetch fresh odds from API ──
  const fetchOdds = useCallback(
    async (force = false) => {
      if (!force && loadOddsFromCache()) return;
      setLoading(true);
      const key = process.env.REACT_APP_ODDS_API_KEY;
      if (!key) {
        setLoading(false);
        return;
      }
      try {
        const res = await fetch(
          `https://api.the-odds-api.com/v4/sports/mma_mixed_martial_arts/odds?apiKey=${key}&regions=us&markets=h2h,totals&oddsFormat=american`,
        );
        const data = await res.json();
        const now = Date.now();
        const sorted = [...data]
          .filter(
            (e) =>
              new Date(e.commence_time).getTime() > now - 3 * 60 * 60 * 1000,
          )
          .sort(
            (a, b) => new Date(a.commence_time) - new Date(b.commence_time),
          );
        localStorage.setItem(
          ODDS_CACHE_KEY,
          JSON.stringify({ data: sorted, timestamp: now }),
        );
        setOddsData(sorted);
        setLastUpdated(now);
      } catch (_) {}
      setLoading(false);
    },
    [loadOddsFromCache],
  );

  useEffect(() => {
    fetchOdds();
  }, [fetchOdds]);

  // ── Build model probabilities and +EV data ──
  const valueBets = useMemo(() => {
    if (!fights.length) return { moneyline: [], totals: [] };

    const moneyline = [];
    const totals = [];

    fights.forEach((fight) => {
      const [f1, f2] = fight.fighters || [];
      if (!f1 || !f2) return;

      // Find matching odds event
      const oddsEvent = oddsData.find((e) => {
        const names = [e.home_team, e.away_team].filter(Boolean);
        return names.some(
          (n) => fuzzyMatch(f1.name, n) || fuzzyMatch(f2.name, n),
        );
      });

      const bookmakers = oddsEvent?.bookmakers || [];

      // ── Model probability via composite scoring ──
      // Our model blends: moneyline implied prob, stat-based projection,
      // finish rate advantages, and striking/grappling differentials.
      const buildModelProb = (fighter, opponent) => {
        const stats = fighter.stats || {};
        const oppStats = opponent.stats || {};

        // Start with moneyline-implied probability if available
        const bestMl = bestOddsForName(bookmakers, fighter.name);
        const oppBestMl = bestOddsForName(bookmakers, opponent.name);
        let mlProb = null;
        if (bestMl != null && oppBestMl != null) {
          const rawA = impliedProbFromAmerican(bestMl);
          const rawB = impliedProbFromAmerican(oppBestMl);
          if (rawA != null && rawB != null) {
            mlProb = rawA / (rawA + rawB); // vig-removed
          }
        }

        // Stat-based edges (each contributes a small adjustment ±0–5%)
        let statAdj = 0;

        // Striking differential
        const slpmDiff = (stats.slpm || 0) - (oppStats.slpm || 0);
        statAdj += Math.max(-0.04, Math.min(0.04, slpmDiff * 0.005));

        // Striking defense edge
        const defA = parseFloat(stats.striking_defense) || 50;
        const defB = parseFloat(oppStats.striking_defense) || 50;
        statAdj += (defA - defB) * 0.0003;

        // Takedown differential
        const tdDiff = (stats.td_avg || 0) - (oppStats.td_avg || 0);
        statAdj += Math.max(-0.03, Math.min(0.03, tdDiff * 0.008));

        // Finish rate edge
        const frA = fighter.finish_rate_pct || 0;
        const frB = opponent.finish_rate_pct || 0;
        statAdj += Math.max(-0.03, Math.min(0.03, (frA - frB) * 0.0003));

        // Win streak momentum
        const streakA = fighter.ufc_win_streak || 0;
        const streakB = opponent.ufc_win_streak || 0;
        statAdj += Math.max(-0.02, Math.min(0.02, (streakA - streakB) * 0.008));

        // Combine: if we have ML implied, use it as base + stat adjustments
        // Otherwise use a pure stat-based estimate
        let modelProb;
        if (mlProb != null) {
          modelProb = Math.max(0.05, Math.min(0.95, mlProb + statAdj));
        } else {
          // No odds available — rough stat estimate
          modelProb = 0.5 + statAdj;
        }

        return { modelProb, bestMl };
      };

      const { modelProb: modelProbF1, bestMl: mlF1 } = buildModelProb(f1, f2);
      const { modelProb: modelProbF2, bestMl: mlF2 } = buildModelProb(f2, f1);

      // ── Moneyline +EV ──
      [
        { fighter: f1, modelProb: modelProbF1, bestMl: mlF1 },
        { fighter: f2, modelProb: modelProbF2, bestMl: mlF2 },
      ].forEach(({ fighter, modelProb, bestMl }) => {
        const ev = calcEV(modelProb, bestMl);
        if (ev != null) {
          moneyline.push({
            fighter: fighter.name,
            opponent: fighter.name === f1.name ? f2.name : f1.name,
            matchup: fight.matchup,
            bestOdds: bestMl,
            impliedProb: impliedProbFromAmerican(bestMl),
            modelProb,
            ev,
            salary: fighter.salary,
            record: fighter.record,
            weightClass: fight.weight_class,
          });
        }
      });

      // ── Totals (O/U) +EV ──
      const allTotals = bestTotalsForFight(bookmakers);
      if (allTotals.length > 0) {
        // Group by over/under and find best price
        const overBets = allTotals.filter((t) => t.name === "Over");
        const underBets = allTotals.filter((t) => t.name === "Under");

        const bestOver =
          overBets.length > 0
            ? overBets.reduce((a, b) => (a.price > b.price ? a : b))
            : null;
        const bestUnder =
          underBets.length > 0
            ? underBets.reduce((a, b) => (a.price > b.price ? a : b))
            : null;

        // Model expectation: use our round estimation
        const { rounds: estRounds } = estimateFightRounds(
          f1,
          f2,
          fight.betting_odds || {},
        );

        [bestOver, bestUnder].forEach((bet) => {
          if (!bet) return;
          const point = bet.point || 2.5;
          // Model probability the bet hits
          let modelP;
          if (bet.name === "Over") {
            // If our model expects more rounds than the line, Over is +EV
            modelP = Math.max(
              0.1,
              Math.min(0.9, 0.5 + (estRounds - point) * 0.25),
            );
          } else {
            modelP = Math.max(
              0.1,
              Math.min(0.9, 0.5 + (point - estRounds) * 0.25),
            );
          }
          // Adjust for fighters with extreme finish rates
          const avgFinRate =
            ((f1.finish_rate_pct || 50) + (f2.finish_rate_pct || 50)) / 2;
          if (bet.name === "Under" && avgFinRate > 60) modelP += 0.05;
          if (bet.name === "Over" && avgFinRate < 35) modelP += 0.05;
          modelP = Math.max(0.1, Math.min(0.9, modelP));

          const ev = calcEV(modelP, bet.price);
          if (ev != null) {
            totals.push({
              matchup: fight.matchup,
              type: `${bet.name} ${point} Rounds`,
              bestOdds: bet.price,
              impliedProb: impliedProbFromAmerican(bet.price),
              modelProb: modelP,
              ev,
              estRounds,
              fighterA: f1.name,
              fighterB: f2.name,
            });
          }
        });
      }
    });

    // Sort by +EV descending
    moneyline.sort((a, b) => b.ev - a.ev);
    totals.sort((a, b) => b.ev - a.ev);

    return { moneyline, totals };
  }, [fights, oddsData]);

  // ── Apply filters ──
  const filteredMoneyline = useMemo(
    () => valueBets.moneyline.filter((b) => b.ev >= evThreshold),
    [valueBets.moneyline, evThreshold],
  );

  const filteredTotals = useMemo(
    () => valueBets.totals.filter((b) => b.ev >= evThreshold),
    [valueBets.totals, evThreshold],
  );

  const showMoneyline =
    betTypeFilter === "All" || betTypeFilter === "Moneyline";
  const showTotals = betTypeFilter === "All" || betTypeFilter === "Totals";

  const totalValueBets =
    (showMoneyline ? filteredMoneyline.length : 0) +
    (showTotals ? filteredTotals.length : 0);

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-stone-950 text-stone-200 pb-32 xl:pb-8">
      {/* ── CLASSIFIED HEADER ── */}
      <div className="border-b border-yellow-700/40 bg-yellow-900/10">
        <div className="max-w-5xl mx-auto px-4 py-5 sm:py-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-wider font-mono">
                OPERATION: <span className="text-yellow-500">VALUE EDGE</span>
              </h1>
              <p className="text-stone-400 text-xs tracking-widest uppercase mt-1 font-mono">
                +EV / VALUE BETS — CLASSIFIED ANALYSIS
              </p>
              <p className="text-stone-500 text-xs mt-1">
                {eventInfo.name}
                {eventInfo.date ? ` — ${eventInfo.date}` : ""}
              </p>
            </div>
            <div className="flex items-center gap-3">
              {lastUpdated && (
                <span className="text-stone-500 text-[10px] tracking-wide">
                  ODDS:{" "}
                  {new Date(lastUpdated).toLocaleTimeString("en-US", {
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </span>
              )}
              <button
                onClick={() => fetchOdds(true)}
                className="border border-yellow-700/60 text-yellow-400 px-4 py-1.5 text-xs tracking-widest uppercase hover:bg-yellow-900/20 transition rounded"
              >
                {loading ? "LOADING…" : "REFRESH"}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        {/* ── FILTERS BAR ── */}
        <div className="flex flex-col sm:flex-row gap-4 sm:items-center sm:justify-between bg-stone-900 border border-stone-800 rounded-lg p-4">
          <div>
            <span className="text-yellow-500 text-[10px] font-bold tracking-widest uppercase block mb-2">
              MIN +EV THRESHOLD
            </span>
            <div className="flex gap-1.5 flex-wrap">
              {EV_THRESHOLDS.map((t) => (
                <button
                  key={t.value}
                  onClick={() => setEvThreshold(t.value)}
                  className={`px-3 py-1.5 text-xs tracking-wide rounded border transition ${
                    evThreshold === t.value
                      ? "bg-yellow-700/30 border-yellow-600 text-yellow-400 font-bold"
                      : "border-stone-700 text-stone-400 hover:border-yellow-700/60 hover:text-yellow-500"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <span className="text-yellow-500 text-[10px] font-bold tracking-widest uppercase block mb-2">
              BET TYPE
            </span>
            <div className="flex gap-1.5">
              {BET_TYPE_FILTERS.map((f) => (
                <button
                  key={f}
                  onClick={() => setBetTypeFilter(f)}
                  className={`px-3 py-1.5 text-xs tracking-wide rounded border transition ${
                    betTypeFilter === f
                      ? "bg-yellow-700/30 border-yellow-600 text-yellow-400 font-bold"
                      : "border-stone-700 text-stone-400 hover:border-yellow-700/60 hover:text-yellow-500"
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>
          <div className="text-right">
            <span className="text-stone-500 text-[10px] tracking-widest uppercase block mb-1">
              BETS FOUND
            </span>
            <span className="text-yellow-400 text-2xl font-bold font-mono">
              {totalValueBets}
            </span>
          </div>
        </div>

        {/* ── LOADING STATE ── */}
        {loading && (
          <div className="text-center py-16">
            <div className="text-yellow-500 text-sm tracking-widest uppercase animate-pulse font-mono">
              SCANNING INTEL…
            </div>
            <p className="text-stone-500 text-xs mt-2">
              Loading odds and fighter data
            </p>
          </div>
        )}

        {/* ── NO RESULTS ── */}
        {!loading && totalValueBets === 0 && (
          <div className="text-center py-16 bg-stone-900 rounded-lg border border-stone-800">
            <p className="text-stone-400 text-sm">
              No value bets found above {evThreshold}% threshold.
            </p>
            <p className="text-stone-500 text-xs mt-1">
              Try lowering the threshold or check back closer to fight night
              when odds sharpen.
            </p>
          </div>
        )}

        {/* ── MONEYLINE VALUE BETS ── */}
        {!loading && showMoneyline && filteredMoneyline.length > 0 && (
          <section>
            <div className="flex items-center gap-3 mb-3">
              <h2 className="text-yellow-500 text-xs font-bold tracking-widest uppercase font-mono">
                MONEYLINE VALUE BETS
              </h2>
              <span className="text-stone-600 text-[10px] tracking-wider">
                ({filteredMoneyline.length} FOUND)
              </span>
            </div>

            {/* Desktop Table */}
            <div className="hidden sm:block bg-stone-900 border border-stone-800 rounded-lg overflow-hidden">
              <table className="w-full text-xs sm:text-sm font-mono">
                <thead>
                  <tr className="border-b border-stone-700 text-left">
                    <th className="text-yellow-500 font-bold px-4 py-3">
                      FIGHTER
                    </th>
                    <th className="text-yellow-500 font-bold px-3 py-3 text-center">
                      BEST ODDS
                    </th>
                    <th className="text-yellow-500 font-bold px-3 py-3 text-center">
                      BOOK IMPLIED
                    </th>
                    <th className="text-yellow-500 font-bold px-3 py-3 text-center">
                      OUR MODEL
                    </th>
                    <th className="text-yellow-500 font-bold px-3 py-3 text-center">
                      +EV %
                    </th>
                    <th className="text-yellow-500 font-bold px-3 py-3 text-right">
                      VERDICT
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredMoneyline.map((bet, i) => {
                    const rec = getRecommendation(bet.ev);
                    return (
                      <tr
                        key={`ml-${i}`}
                        className={`border-b border-stone-800 hover:bg-stone-800/50 transition ${getRowBg(bet.ev)}`}
                      >
                        <td className="px-4 py-3">
                          <div className="font-bold text-stone-100">
                            {bet.fighter}
                          </div>
                          <div className="text-stone-500 text-[10px]">
                            vs {bet.opponent} • {bet.record}
                          </div>
                        </td>
                        <td className="px-3 py-3 text-center">
                          <span
                            className={`font-bold ${bet.bestOdds > 0 ? "text-green-400" : "text-red-400"}`}
                          >
                            {fmt(bet.bestOdds)}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-center text-stone-400">
                          {bet.impliedProb != null
                            ? `${(bet.impliedProb * 100).toFixed(1)}%`
                            : "—"}
                        </td>
                        <td className="px-3 py-3 text-center text-yellow-400 font-bold">
                          {(bet.modelProb * 100).toFixed(1)}%
                        </td>
                        <td className="px-3 py-3 text-center">
                          <span className="inline-block bg-green-900/30 text-green-400 px-2 py-0.5 rounded font-bold text-xs">
                            +{bet.ev.toFixed(1)}%
                          </span>
                        </td>
                        <td className={`px-3 py-3 text-right ${rec.cls}`}>
                          {rec.label}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards */}
            <div className="sm:hidden space-y-3">
              {filteredMoneyline.map((bet, i) => {
                const rec = getRecommendation(bet.ev);
                return (
                  <div
                    key={`ml-m-${i}`}
                    className={`bg-stone-900 border border-stone-800 rounded-lg p-4 ${getRowBg(bet.ev)}`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <div className="font-bold text-stone-100 text-sm">
                          {bet.fighter}
                        </div>
                        <div className="text-stone-500 text-[10px]">
                          vs {bet.opponent} • {bet.record}
                        </div>
                      </div>
                      <span className="inline-block bg-green-900/30 text-green-400 px-2 py-0.5 rounded font-bold text-xs font-mono">
                        +{bet.ev.toFixed(1)}%
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center text-[10px] tracking-wide">
                      <div>
                        <div className="text-stone-500 uppercase mb-0.5">
                          Best Odds
                        </div>
                        <div
                          className={`font-bold font-mono ${bet.bestOdds > 0 ? "text-green-400" : "text-red-400"}`}
                        >
                          {fmt(bet.bestOdds)}
                        </div>
                      </div>
                      <div>
                        <div className="text-stone-500 uppercase mb-0.5">
                          Book Implied
                        </div>
                        <div className="text-stone-400 font-mono">
                          {bet.impliedProb != null
                            ? `${(bet.impliedProb * 100).toFixed(1)}%`
                            : "—"}
                        </div>
                      </div>
                      <div>
                        <div className="text-stone-500 uppercase mb-0.5">
                          Our Model
                        </div>
                        <div className="text-yellow-400 font-bold font-mono">
                          {(bet.modelProb * 100).toFixed(1)}%
                        </div>
                      </div>
                    </div>
                    <div className={`text-right mt-2 text-xs ${rec.cls}`}>
                      {rec.label}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* ── TOTALS VALUE BETS ── */}
        {!loading && showTotals && filteredTotals.length > 0 && (
          <section>
            <div className="flex items-center gap-3 mb-3">
              <h2 className="text-yellow-500 text-xs font-bold tracking-widest uppercase font-mono">
                TOTALS / ROUND PROPS — VALUE BETS
              </h2>
              <span className="text-stone-600 text-[10px] tracking-wider">
                ({filteredTotals.length} FOUND)
              </span>
            </div>

            {/* Desktop Table */}
            <div className="hidden sm:block bg-stone-900 border border-stone-800 rounded-lg overflow-hidden">
              <table className="w-full text-xs sm:text-sm font-mono">
                <thead>
                  <tr className="border-b border-stone-700 text-left">
                    <th className="text-yellow-500 font-bold px-4 py-3">
                      MATCHUP
                    </th>
                    <th className="text-yellow-500 font-bold px-3 py-3">BET</th>
                    <th className="text-yellow-500 font-bold px-3 py-3 text-center">
                      BEST ODDS
                    </th>
                    <th className="text-yellow-500 font-bold px-3 py-3 text-center">
                      BOOK IMPLIED
                    </th>
                    <th className="text-yellow-500 font-bold px-3 py-3 text-center">
                      OUR MODEL
                    </th>
                    <th className="text-yellow-500 font-bold px-3 py-3 text-center">
                      +EV %
                    </th>
                    <th className="text-yellow-500 font-bold px-3 py-3 text-right">
                      VERDICT
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTotals.map((bet, i) => {
                    const rec = getRecommendation(bet.ev);
                    return (
                      <tr
                        key={`tot-${i}`}
                        className={`border-b border-stone-800 hover:bg-stone-800/50 transition ${getRowBg(bet.ev)}`}
                      >
                        <td className="px-4 py-3">
                          <div className="text-stone-100">{bet.matchup}</div>
                        </td>
                        <td className="px-3 py-3 text-yellow-300 font-bold">
                          {bet.type}
                        </td>
                        <td className="px-3 py-3 text-center">
                          <span
                            className={`font-bold ${bet.bestOdds > 0 ? "text-green-400" : "text-red-400"}`}
                          >
                            {fmt(bet.bestOdds)}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-center text-stone-400">
                          {bet.impliedProb != null
                            ? `${(bet.impliedProb * 100).toFixed(1)}%`
                            : "—"}
                        </td>
                        <td className="px-3 py-3 text-center text-yellow-400 font-bold">
                          {(bet.modelProb * 100).toFixed(1)}%
                        </td>
                        <td className="px-3 py-3 text-center">
                          <span className="inline-block bg-green-900/30 text-green-400 px-2 py-0.5 rounded font-bold text-xs">
                            +{bet.ev.toFixed(1)}%
                          </span>
                        </td>
                        <td className={`px-3 py-3 text-right ${rec.cls}`}>
                          {rec.label}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards */}
            <div className="sm:hidden space-y-3">
              {filteredTotals.map((bet, i) => {
                const rec = getRecommendation(bet.ev);
                return (
                  <div
                    key={`tot-m-${i}`}
                    className={`bg-stone-900 border border-stone-800 rounded-lg p-4 ${getRowBg(bet.ev)}`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <div className="text-stone-100 text-sm">
                          {bet.matchup}
                        </div>
                        <div className="text-yellow-300 font-bold text-xs mt-0.5">
                          {bet.type}
                        </div>
                      </div>
                      <span className="inline-block bg-green-900/30 text-green-400 px-2 py-0.5 rounded font-bold text-xs font-mono">
                        +{bet.ev.toFixed(1)}%
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center text-[10px] tracking-wide">
                      <div>
                        <div className="text-stone-500 uppercase mb-0.5">
                          Best Odds
                        </div>
                        <div
                          className={`font-bold font-mono ${bet.bestOdds > 0 ? "text-green-400" : "text-red-400"}`}
                        >
                          {fmt(bet.bestOdds)}
                        </div>
                      </div>
                      <div>
                        <div className="text-stone-500 uppercase mb-0.5">
                          Book Implied
                        </div>
                        <div className="text-stone-400 font-mono">
                          {bet.impliedProb != null
                            ? `${(bet.impliedProb * 100).toFixed(1)}%`
                            : "—"}
                        </div>
                      </div>
                      <div>
                        <div className="text-stone-500 uppercase mb-0.5">
                          Our Model
                        </div>
                        <div className="text-yellow-400 font-bold font-mono">
                          {(bet.modelProb * 100).toFixed(1)}%
                        </div>
                      </div>
                    </div>
                    <div className={`text-right mt-2 text-xs ${rec.cls}`}>
                      {rec.label}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* ── HOW +EV IS CALCULATED (Explainer) ── */}
        <section className="bg-stone-900 border border-stone-800 rounded-lg overflow-hidden">
          <button
            onClick={() => setShowExplainer(!showExplainer)}
            className="w-full flex items-center justify-between px-4 py-3 hover:bg-stone-800/50 transition"
          >
            <span className="text-yellow-500 text-xs font-bold tracking-widest uppercase font-mono">
              HOW +EV IS CALCULATED
            </span>
            <span className="text-stone-500 text-sm">
              {showExplainer ? "▲" : "▼"}
            </span>
          </button>
          {showExplainer && (
            <div className="px-4 pb-4 border-t border-stone-800 space-y-3 text-sm text-stone-300">
              <div className="pt-3">
                <p className="font-bold text-yellow-400 mb-1">
                  What is +EV (Expected Value)?
                </p>
                <p>
                  A bet is +EV when the sportsbook odds imply a lower
                  probability of winning than our model predicts. In simple
                  terms: the book is offering better odds than they should be.
                </p>
              </div>
              <div className="bg-stone-800 rounded p-3 font-mono text-xs">
                <p className="text-yellow-500 mb-1">FORMULA:</p>
                <p className="text-stone-300">
                  +EV % = (Our Model Probability × Decimal Odds) − 1
                </p>
                <p className="text-stone-500 mt-1">
                  Example: If our model gives a fighter 55% chance to win, but
                  the best odds imply only 47% — that's a +EV bet.
                </p>
              </div>
              <div>
                <p className="font-bold text-yellow-400 mb-1">
                  How Our Model Works
                </p>
                <p>
                  We start with vig-removed implied probabilities from the
                  sharpest sportsbook lines, then adjust based on:
                </p>
                <ul className="list-none space-y-1 mt-2 text-stone-400 text-xs">
                  <li>
                    <span className="text-yellow-600 mr-2">▸</span>
                    Striking differential (SLpM, accuracy, defense)
                  </li>
                  <li>
                    <span className="text-yellow-600 mr-2">▸</span>
                    Grappling edge (TD average, TD defense)
                  </li>
                  <li>
                    <span className="text-yellow-600 mr-2">▸</span>
                    Finish rate advantage
                  </li>
                  <li>
                    <span className="text-yellow-600 mr-2">▸</span>
                    Win streak momentum
                  </li>
                  <li>
                    <span className="text-yellow-600 mr-2">▸</span>
                    Historical fight duration vs O/U lines
                  </li>
                </ul>
              </div>
              <div className="bg-yellow-900/20 border border-yellow-700/40 rounded p-3 text-xs text-yellow-300">
                <span className="font-bold">⚠ DISCLAIMER:</span> +EV does not
                guarantee a win. It means that over many bets at these odds, you
                would expect to profit. Always bet responsibly and never wager
                more than you can afford to lose.
              </div>
            </div>
          )}
        </section>

        {/* ── CONFIDENCE LEGEND ── */}
        <div className="flex flex-wrap gap-4 justify-center text-[10px] tracking-wider uppercase text-stone-500">
          <span>
            <span className="inline-block w-2 h-2 rounded-full bg-green-500 mr-1" />
            STRONG BET (+15%+)
          </span>
          <span>
            <span className="inline-block w-2 h-2 rounded-full bg-green-700 mr-1" />
            GOOD VALUE (+8%+)
          </span>
          <span>
            <span className="inline-block w-2 h-2 rounded-full bg-yellow-600 mr-1" />
            SLIGHT EDGE (+3%+)
          </span>
        </div>
      </div>
    </div>
  );
};

export default ValueBets;
