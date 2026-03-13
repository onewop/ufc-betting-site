import React, { useState, useEffect, useRef } from "react";
import axios from "axios";

// Format American-style moneyline for display (e.g. -150 → "-150", 120 → "+120")
const fmt = (price) => {
  if (price == null) return "N/A";
  return price > 0 ? `+${price}` : `${price}`;
};

// Convert American odds to implied probability %
const impliedProb = (price) => {
  if (price == null) return null;
  if (price < 0) return ((-price / (-price + 100)) * 100).toFixed(1);
  return ((100 / (price + 100)) * 100).toFixed(1);
};

// Find best (highest) price for a given fighter name across all bookmakers
const bestOdds = (bookmakers, name) => {
  let best = null;
  bookmakers.forEach((bm) => {
    const h2h = bm.markets.find((m) => m.key === "h2h");
    if (!h2h) return;
    const outcome = h2h.outcomes.find((o) => o.name === name);
    if (outcome && (best === null || outcome.price > best))
      best = outcome.price;
  });
  return best;
};

const CACHE_KEY = "ufc_odds_cache_v2"; // v2 = american odds format
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

const LatestOdds = () => {
  const [odds, setOdds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [fromCache, setFromCache] = useState(false);

  // Alert form state
  const [alertEmail, setAlertEmail] = useState("");
  const [alertFighter, setAlertFighter] = useState("");
  const [alertDirection, setAlertDirection] = useState("better");
  const [alertOdds, setAlertOdds] = useState("");
  const [alertSubmitted, setAlertSubmitted] = useState(false);

  const handleAlertSubmit = (e) => {
    e.preventDefault();
    console.log("🔔 Odds Alert Request:", {
      email: alertEmail,
      fighter: alertFighter,
      direction: alertDirection,
      targetOdds: alertOdds,
      requestedAt: new Date().toISOString(),
    });
    setAlertSubmitted(true);
    setAlertEmail("");
    setAlertFighter("");
    setAlertDirection("better");
    setAlertOdds("");
    setTimeout(() => setAlertSubmitted(false), 5000);
  };

  const alertFormRef = useRef(null);
  const [alertFormOpen, setAlertFormOpen] = useState(true);

  const selectFighterForAlert = (name) => {
    setAlertFighter(name);
    setAlertFormOpen(true);
    setTimeout(() => {
      alertFormRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 50);
  };

  const ODDS_API_KEY = process.env.REACT_APP_ODDS_API_KEY;

  const applyData = (sorted, timestamp, cached) => {
    setOdds(sorted);
    setLastUpdated(
      new Date(timestamp).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      }),
    );
    setFromCache(cached);
  };

  const fetchOdds = async (force = false) => {
    // Check cache first (unless forced)
    if (!force) {
      try {
        const cached = JSON.parse(localStorage.getItem(CACHE_KEY));
        if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
          applyData(cached.data, cached.timestamp, true);
          setLoading(false);
          return;
        }
      } catch (_) {
        // Corrupt cache — fall through to fetch
      }
    }

    setLoading(true);
    setError(null);
    try {
      const response = await axios.get(
        `https://api.the-odds-api.com/v4/sports/mma_mixed_martial_arts/odds?apiKey=${ODDS_API_KEY}&regions=us&markets=h2h&oddsFormat=american`,
      );
      if (response.data.length === 0) {
        setError("No UFC events currently available. Try again later.");
      } else {
        const sorted = [...response.data].sort(
          (a, b) => new Date(a.commence_time) - new Date(b.commence_time),
        );
        const timestamp = Date.now();
        localStorage.setItem(
          CACHE_KEY,
          JSON.stringify({ data: sorted, timestamp }),
        );
        applyData(sorted, timestamp, false);
      }
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Failed to fetch odds. Check your API key or try again later.",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOdds(false);
  }, []);

  // Load fighter list from DKSalaries.csv (Name column, salary-desc order)
  const [dkFighters, setDkFighters] = useState([]);
  useEffect(() => {
    fetch("/DKSalaries.csv")
      .then((r) => r.text())
      .then((text) => {
        const rows = text.trim().split("\n").slice(1); // skip header
        const names = rows
          .map((row) => {
            const cols = row.split(",");
            return cols[2]?.trim(); // Name column (index 2)
          })
          .filter(Boolean);
        setDkFighters(names);
      })
      .catch(() => {}); // silently fall back to empty
  }, []);

  return (
    <div
      className="min-h-screen bg-stone-950 text-stone-200"
      style={{ fontFamily: "'Courier New', monospace" }}
    >
      {/* Compact header */}
      <div className="max-w-4xl mx-auto px-4 pt-6 pb-3 flex flex-wrap items-center justify-between gap-3 border-b border-yellow-900/40">
        <div>
          <h1 className="text-xl font-black text-stone-100 uppercase tracking-widest">
            ⚡ Live <span className="text-yellow-500">Betting Odds</span>
          </h1>
          <p className="text-stone-500 text-xs mt-0.5">
            Best moneylines across US books ·{" "}
            {lastUpdated
              ? `${fromCache ? "Cached" : "Updated"}: ${lastUpdated}`
              : ""}
          </p>
        </div>
        <button
          onClick={() => fetchOdds(true)}
          disabled={loading}
          className="border border-yellow-700/60 text-yellow-400 px-4 py-1.5 text-xs tracking-widest uppercase hover:bg-yellow-900/20 transition disabled:opacity-40"
        >
          {loading ? "Loading..." : "↻ Refresh"}
        </button>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-4">
        {/* ── Odds Alert Request Form ── */}
        <details
          ref={alertFormRef}
          open={alertFormOpen}
          onToggle={(e) => setAlertFormOpen(e.currentTarget.open)}
          className="mb-6 border border-yellow-700/30 rounded-lg overflow-hidden"
        >
          <summary className="px-4 py-3 bg-yellow-900/10 border-b border-yellow-700/20 cursor-pointer select-none list-none flex items-center gap-2">
            <span className="text-yellow-500 text-xs font-bold tracking-widest uppercase">
              🔔 Set an Odds Alert
            </span>
            <span className="text-stone-500 text-xs hidden sm:inline">
              — tap 🔔 next to any fighter, or pick one below
            </span>
            <span className="ml-auto text-stone-600 text-xs">
              {alertFormOpen ? "▾" : "▸"}
            </span>
          </summary>
          <div className="px-4 py-4 bg-stone-900">
            {alertSubmitted ? (
              <div className="border border-green-700/50 bg-green-900/20 rounded px-4 py-3 text-green-400 text-sm">
                ✓ Alert request sent! We'll add it manually for now.
              </div>
            ) : (
              <form
                onSubmit={handleAlertSubmit}
                className="flex flex-col gap-3"
              >
                <input
                  type="email"
                  required
                  placeholder="your@email.com"
                  value={alertEmail}
                  onChange={(e) => setAlertEmail(e.target.value)}
                  className="bg-stone-800 border border-stone-700 text-stone-100 text-sm px-3 py-2 rounded focus:outline-none focus:border-yellow-600 placeholder-stone-500"
                />
                <select
                  required
                  value={alertFighter}
                  onChange={(e) => setAlertFighter(e.target.value)}
                  className="bg-stone-800 border border-stone-700 text-stone-100 text-sm px-3 py-2 rounded focus:outline-none focus:border-yellow-600"
                >
                  <option value="">Select fighter…</option>
                  {dkFighters.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
                <select
                  value={alertDirection}
                  onChange={(e) => setAlertDirection(e.target.value)}
                  className="bg-stone-800 border border-stone-700 text-stone-100 text-sm px-3 py-2 rounded focus:outline-none focus:border-yellow-600"
                >
                  <option value="better">
                    Alert me if the odds become… better than
                  </option>
                  <option value="worse">
                    Alert me if the odds become… worse than
                  </option>
                </select>
                <div>
                  <input
                    type="text"
                    required
                    placeholder="e.g. -180 or +220"
                    value={alertOdds}
                    onChange={(e) => setAlertOdds(e.target.value)}
                    pattern="^[+-]?\d+$"
                    title="Enter American odds like -180 or +220"
                    className="w-full bg-stone-800 border border-stone-700 text-stone-100 text-sm px-3 py-2 rounded focus:outline-none focus:border-yellow-600 placeholder-stone-500"
                  />
                  <p className="text-stone-500 text-xs mt-1">
                    {alertDirection === "better"
                      ? "You'll get paid more if this happens (e.g. -250 → -180 or +180 → +220)"
                      : "Alert if the line moves against you (e.g. -180 → -250 or +220 → +180)"}
                  </p>
                </div>
                <button
                  type="submit"
                  className="border border-yellow-700/60 text-yellow-400 px-5 py-2 text-xs tracking-widest uppercase hover:bg-yellow-900/20 transition"
                >
                  Request Alert
                </button>
              </form>
            )}
            <p className="text-stone-600 text-xs mt-4">
              Alerts coming soon — request one and we'll set it up! 21+ only.
            </p>
            <p className="text-stone-600 text-xs mt-1">
              By submitting you agree to receive a one-time email notification.
              Reply STOP to unsubscribe.
            </p>
          </div>
        </details>

        {loading && (
          <p className="text-center text-stone-500 animate-pulse text-sm py-10">
            Fetching lines...
          </p>
        )}

        {error && !loading && (
          <div className="bg-red-950/30 border border-red-900/50 rounded p-4 text-center text-red-400 text-sm mt-4">
            {error}
          </div>
        )}

        {!loading && !error && odds.length === 0 && (
          <p className="text-center text-stone-500 text-sm py-10">
            No upcoming UFC events found.
          </p>
        )}

        {!loading &&
          odds.length > 0 &&
          (() => {
            const earliest = new Date(odds[0].commence_time).getTime();
            const TWO_DAYS_MS = 2 * 24 * 60 * 60 * 1000;
            const nextEventFights = odds.filter(
              (e) =>
                new Date(e.commence_time).getTime() - earliest <= TWO_DAYS_MS,
            );
            const futureFights = odds.filter(
              (e) =>
                new Date(e.commence_time).getTime() - earliest > TWO_DAYS_MS,
            );
            const futureByDate = futureFights.reduce((acc, e) => {
              const dateKey = new Date(e.commence_time).toLocaleDateString(
                "en-US",
                {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                },
              );
              if (!acc[dateKey]) acc[dateKey] = [];
              acc[dateKey].push(e);
              return acc;
            }, {});
            const nextEventDate = new Date(
              odds[0].commence_time,
            ).toLocaleDateString("en-US", {
              weekday: "long",
              month: "long",
              day: "numeric",
              year: "numeric",
            });

            // Compact single-row fight card
            const renderFightRow = (event) => {
              const f1 = event.home_team;
              const f2 = event.away_team;
              const best1 = bestOdds(event.bookmakers, f1);
              const best2 = bestOdds(event.bookmakers, f2);
              const f1Fav = best1 != null && best2 != null && best1 < best2;
              const f2Fav = best1 != null && best2 != null && best2 < best1;

              return (
                <div
                  key={event.id}
                  className="border-b border-stone-800 last:border-0"
                >
                  <div className="grid grid-cols-[1fr_auto_1fr] items-center py-2 px-3 gap-2 hover:bg-stone-900/50 transition">
                    {/* Fighter 1 (left) */}
                    <div className="flex flex-col">
                      <div className="flex items-center gap-1">
                        <span className="text-stone-100 text-sm font-semibold leading-tight">
                          {f1}
                        </span>
                        <button
                          type="button"
                          onClick={() => selectFighterForAlert(f1)}
                          title={`Set alert for ${f1}`}
                          className="text-stone-600 hover:text-yellow-400 transition text-xs leading-none"
                        >
                          🔔
                        </button>
                      </div>
                      <div className="flex items-baseline gap-1.5 mt-0.5">
                        <span
                          className={`text-base font-black ${f1Fav ? "text-red-400" : "text-green-400"}`}
                        >
                          {fmt(best1)}
                        </span>
                        {best1 != null && (
                          <span className="text-stone-600 text-xs">
                            {impliedProb(best1)}%
                          </span>
                        )}
                        {f1Fav && (
                          <span className="text-xs text-red-500/60 uppercase">
                            FAV
                          </span>
                        )}
                        {!f1Fav && best1 != null && (
                          <span className="text-xs text-green-500/60 uppercase">
                            DOG
                          </span>
                        )}
                      </div>
                    </div>

                    {/* VS divider */}
                    <div className="text-stone-600 text-xs font-bold px-2 text-center">
                      VS
                    </div>

                    {/* Fighter 2 (right) */}
                    <div className="flex flex-col items-end">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => selectFighterForAlert(f2)}
                          title={`Set alert for ${f2}`}
                          className="text-stone-600 hover:text-yellow-400 transition text-xs leading-none"
                        >
                          🔔
                        </button>
                        <span className="text-stone-100 text-sm font-semibold leading-tight text-right">
                          {f2}
                        </span>
                      </div>
                      <div className="flex items-baseline gap-1.5 mt-0.5">
                        {f2Fav && (
                          <span className="text-xs text-red-500/60 uppercase">
                            FAV
                          </span>
                        )}
                        {!f2Fav && best2 != null && (
                          <span className="text-xs text-green-500/60 uppercase">
                            DOG
                          </span>
                        )}
                        {best2 != null && (
                          <span className="text-stone-600 text-xs">
                            {impliedProb(best2)}%
                          </span>
                        )}
                        <span
                          className={`text-base font-black ${f2Fav ? "text-red-400" : "text-green-400"}`}
                        >
                          {fmt(best2)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Collapsed bookmaker rows */}
                  {event.bookmakers.length > 0 && (
                    <details className="bg-stone-900/30">
                      <summary className="px-3 py-1 text-xs text-stone-600 cursor-pointer hover:text-stone-400 select-none">
                        ▸ {event.bookmakers.length} books
                      </summary>
                      <table className="w-full text-xs text-stone-400 mb-1">
                        <tbody>
                          {event.bookmakers.map((bm) => {
                            const h2h = bm.markets.find((m) => m.key === "h2h");
                            const o1 = h2h?.outcomes.find((o) => o.name === f1);
                            const o2 = h2h?.outcomes.find((o) => o.name === f2);
                            return (
                              <tr
                                key={bm.key}
                                className="border-t border-stone-800/40"
                              >
                                <td className="px-3 py-1 text-stone-500 capitalize w-32">
                                  {bm.title}
                                </td>
                                <td
                                  className={`px-3 py-1 ${o1?.price === best1 ? "text-yellow-400 font-bold" : ""}`}
                                >
                                  {fmt(o1?.price)}
                                </td>
                                <td
                                  className={`px-3 py-1 text-right ${o2?.price === best2 ? "text-yellow-400 font-bold" : ""}`}
                                >
                                  {fmt(o2?.price)}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </details>
                  )}
                </div>
              );
            };

            return (
              <>
                {/* Next Event */}
                <div className="mb-4">
                  <div className="flex items-center gap-3 mb-2 pb-2 border-b border-yellow-900/40">
                    <span className="text-yellow-500 text-xs font-bold tracking-widest uppercase">
                      ⚡ Next Event
                    </span>
                    <span className="text-stone-400 text-xs">
                      {nextEventDate}
                    </span>
                    <span className="text-stone-600 text-xs ml-auto">
                      {nextEventFights.length} fights
                    </span>
                  </div>
                  <div className="border border-stone-800 rounded-lg overflow-hidden">
                    {nextEventFights.map(renderFightRow)}
                  </div>
                </div>

                {/* Coming Soon */}
                {Object.keys(futureByDate).length > 0 && (
                  <details className="border border-stone-800 rounded-lg overflow-hidden mt-4">
                    <summary className="px-4 py-2.5 bg-stone-900 cursor-pointer text-stone-500 text-xs tracking-widest uppercase hover:text-stone-300 select-none">
                      ▸ Coming Soon — {futureFights.length} more fights across{" "}
                      {Object.keys(futureByDate).length} event
                      {Object.keys(futureByDate).length > 1 ? "s" : ""}
                    </summary>
                    <div className="divide-y divide-stone-800">
                      {Object.entries(futureByDate).map(
                        ([dateLabel, fights]) => (
                          <details key={dateLabel}>
                            <summary className="px-4 py-2 cursor-pointer text-stone-500 text-xs hover:text-stone-300 select-none bg-stone-950">
                              ▸ {dateLabel} — {fights.length} fight
                              {fights.length > 1 ? "s" : ""}
                            </summary>
                            <div className="border-t border-stone-800">
                              {fights.map(renderFightRow)}
                            </div>
                          </details>
                        ),
                      )}
                    </div>
                  </details>
                )}
              </>
            );
          })()}
      </div>
    </div>
  );
};

export default LatestOdds;
