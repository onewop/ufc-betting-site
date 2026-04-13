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

const CACHE_KEY = "ufc_odds_cache_v3"; // bump version to bust stale cache
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours
const ALERTS_KEY = "ufc_local_alerts_v1";
const ALERTS_ENABLED_KEY = "ufc_local_alerts_enabled_v1";
const ALERT_POLL_MS = 120000;

const parseAmericanOdds = (value) => {
  const parsed = parseInt(String(value).trim(), 10);
  return Number.isNaN(parsed) ? null : parsed;
};

const findBestOddsForFighter = (events, fighterName) => {
  if (!fighterName) return null;
  const fighter = fighterName.trim().toLowerCase();
  let best = null;
  events.forEach((event) => {
    const matched = [event.home_team, event.away_team]
      .filter(Boolean)
      .some((name) => name.trim().toLowerCase() === fighter);
    if (!matched) return;
    const candidate = bestOdds(event.bookmakers || [], fighterName);
    if (candidate != null && (best == null || candidate > best))
      best = candidate;
  });
  return best;
};

const evaluateAlertHit = (direction, currentOdds, targetOdds) => {
  if (currentOdds == null || targetOdds == null) return false;
  return direction === "better"
    ? currentOdds > targetOdds
    : currentOdds < targetOdds;
};

const LatestOdds = () => {
  const [odds, setOdds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [fromCache, setFromCache] = useState(false);
  const [cacheTimestamp, setCacheTimestamp] = useState(null);
  const stalenessChecked = useRef(false);

  // Alert form state
  const [alertEmail, setAlertEmail] = useState("");
  const [alertFighter, setAlertFighter] = useState("");
  const [alertDirection, setAlertDirection] = useState("better");
  const [alertOdds, setAlertOdds] = useState("");
  const [alertSubmitted, setAlertSubmitted] = useState(false);
  const [localAlerts, setLocalAlerts] = useState([]);
  const [alertsEnabled, setAlertsEnabled] = useState(false);
  const [alertEvents, setAlertEvents] = useState([]);
  const [lastPolledAt, setLastPolledAt] = useState(null);

  const alertFormRef = useRef(null);
  const [alertFormOpen, setAlertFormOpen] = useState(true);

  const pushAlertEvents = (triggered) => {
    if (!triggered.length) return;
    const nowLabel = new Date().toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    });
    const next = triggered.map((item) => ({
      id: `${item.id}-${Date.now()}`,
      message: `${item.fighter} hit ${fmt(item.lastSeenOdds)} (${item.direction === "better" ? "better" : "worse"} than ${fmt(item.targetOdds)})`,
      time: nowLabel,
    }));
    setAlertEvents((prev) => [...next, ...prev].slice(0, 6));

    if (
      alertsEnabled &&
      "Notification" in window &&
      Notification.permission === "granted"
    ) {
      next.forEach((event) => {
        new Notification("UFC Odds Alert", { body: event.message });
      });
    }
  };

  const evaluateAlerts = (events, alerts) => {
    const nextAlerts = alerts.map((alert) => {
      if (!alert.active) return alert;
      const currentOdds = findBestOddsForFighter(events, alert.fighter);
      if (currentOdds == null) return { ...alert, lastCheckedAt: Date.now() };
      const hit = evaluateAlertHit(
        alert.direction,
        currentOdds,
        alert.targetOdds,
      );
      if (!hit) {
        return {
          ...alert,
          lastSeenOdds: currentOdds,
          lastCheckedAt: Date.now(),
        };
      }
      return {
        ...alert,
        active: false,
        lastSeenOdds: currentOdds,
        triggeredAt: Date.now(),
      };
    });

    const triggered = nextAlerts.filter(
      (alert, idx) => !alerts[idx]?.triggeredAt && alert.triggeredAt,
    );

    return { nextAlerts, triggered };
  };

  const handleAlertSubmit = (e) => {
    e.preventDefault();
    const targetOdds = parseAmericanOdds(alertOdds);
    if (targetOdds == null || !alertFighter) {
      return;
    }

    const alert = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
      email: alertEmail,
      fighter: alertFighter,
      direction: alertDirection,
      targetOdds,
      active: true,
      createdAt: Date.now(),
      lastSeenOdds: null,
      lastCheckedAt: null,
      triggeredAt: null,
    };

    setLocalAlerts((prev) => [alert, ...prev].slice(0, 30));
    setAlertSubmitted(true);
    setAlertEmail("");
    setAlertFighter("");
    setAlertDirection("better");
    setAlertOdds("");
    setTimeout(() => setAlertSubmitted(false), 3500);

    // Save to backend
    const backendAlert = {
      email: alert.email,
      fighter_name: alert.fighter,
      direction: alert.direction,
      target_odds: alert.targetOdds,
      active: alert.active,
    };
    fetch("http://localhost:3001/api/save-alert", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(backendAlert),
    })
      .then((response) => {
        if (response.ok) {
          console.log("Alert saved to backend");
        } else {
          console.error("Failed to save alert to backend");
        }
      })
      .catch((error) => {
        console.error("Error saving alert:", error);
      });
  };

  const selectFighterForAlert = (name, odds = null) => {
    setAlertFighter(name);
    if (odds != null) {
      setAlertOdds(odds.toString());
    }
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
    setCacheTimestamp(timestamp);

    if (localAlerts.length > 0) {
      const { nextAlerts, triggered } = evaluateAlerts(sorted, localAlerts);
      setLocalAlerts(nextAlerts);
      pushAlertEvents(triggered);
    }
  };

  const fetchOdds = async (force = false, silent = false) => {
    // Check cache first (unless forced)
    if (!force) {
      try {
        const cached = JSON.parse(localStorage.getItem(CACHE_KEY));
        if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
          applyData(cached.data, cached.timestamp, true);
          if (!silent) setLoading(false);
          return;
        }
      } catch (_) {
        // Corrupt cache — fall through to fetch
      }
    }

    if (!silent) {
      setLoading(true);
      setError(null);
    }
    try {
      const response = await axios.get(
        `https://api.the-odds-api.com/v4/sports/mma_mixed_martial_arts/odds?apiKey=${ODDS_API_KEY}&regions=us&markets=h2h&oddsFormat=american`,
      );
      if (response.data.length === 0) {
        setError("No UFC events currently available. Try again later.");
      } else {
        const now = Date.now();
        const sorted = [...response.data]
          .filter(
            (e) =>
              new Date(e.commence_time).getTime() > now - 3 * 60 * 60 * 1000,
          ) // only upcoming + events started < 3h ago
          .sort(
            (a, b) => new Date(a.commence_time) - new Date(b.commence_time),
          );
        const timestamp = Date.now();
        localStorage.setItem(
          CACHE_KEY,
          JSON.stringify({ data: sorted, timestamp }),
        );
        applyData(sorted, timestamp, false);
        setLastPolledAt(
          new Date(timestamp).toLocaleTimeString("en-US", {
            hour: "numeric",
            minute: "2-digit",
          }),
        );
      }
    } catch (err) {
      if (!silent) {
        setError(
          err.response?.data?.message ||
            "Failed to fetch odds. Check your API key or try again later.",
        );
      }
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    fetchOdds(false);
  }, []);

  useEffect(() => {
    try {
      const storedAlerts = JSON.parse(localStorage.getItem(ALERTS_KEY));
      if (Array.isArray(storedAlerts)) {
        setLocalAlerts(storedAlerts);
      }
    } catch (_) {
      setLocalAlerts([]);
    }

    const storedEnabled = localStorage.getItem(ALERTS_ENABLED_KEY);
    setAlertsEnabled(storedEnabled === "true");
  }, []);

  useEffect(() => {
    localStorage.setItem(ALERTS_KEY, JSON.stringify(localAlerts));
  }, [localAlerts]);

  useEffect(() => {
    localStorage.setItem(ALERTS_ENABLED_KEY, String(alertsEnabled));
  }, [alertsEnabled]);

  useEffect(() => {
    const activeCount = localAlerts.filter((alert) => alert.active).length;
    if (!alertsEnabled || activeCount === 0) return;

    const intervalId = setInterval(() => {
      fetchOdds(true, true);
    }, ALERT_POLL_MS);

    return () => clearInterval(intervalId);
  }, [alertsEnabled, localAlerts]);

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

  // Staleness detection: if cache was loaded but none of the DK fighters
  // appear in the API events, the cache is stale — clear everything and
  // force a fresh fetch so we always show the current card.
  useEffect(() => {
    if (stalenessChecked.current) return;
    if (!fromCache || dkFighters.length === 0 || odds.length === 0) return;
    stalenessChecked.current = true;

    const apiNames = new Set(
      odds
        .flatMap((e) => [e.home_team, e.away_team])
        .filter(Boolean)
        .map((n) => n.trim().toLowerCase()),
    );
    const hasMatch = dkFighters.some((f) =>
      apiNames.has(f.trim().toLowerCase()),
    );

    if (!hasMatch) {
      Object.keys(localStorage)
        .filter((k) => k.startsWith("ufc_odds_cache"))
        .forEach((k) => localStorage.removeItem(k));
      fetchOdds(true);
    }
  }, [dkFighters, odds, fromCache]);

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
        <div className="flex gap-2">
          <button
            onClick={() => fetchOdds(true)}
            disabled={loading}
            className="border border-yellow-700/60 text-yellow-400 px-4 py-1.5 text-xs tracking-widest uppercase hover:bg-yellow-900/20 transition disabled:opacity-40"
          >
            {loading ? "Loading..." : "↻ Refresh"}
          </button>
          <button
            onClick={() => {
              // Wipe ALL ufc_odds_cache_* keys so no stale version survives
              Object.keys(localStorage)
                .filter((k) => k.startsWith("ufc_odds_cache"))
                .forEach((k) => localStorage.removeItem(k));
              fetchOdds(true);
            }}
            disabled={loading}
            className="border border-red-700/60 text-red-400 px-4 py-1.5 text-xs tracking-widest uppercase hover:bg-red-900/20 transition disabled:opacity-40"
          >
            ✕ Clear Cache
          </button>
        </div>
      </div>

      {/* ── Debug info bar ── */}
      <div className="max-w-4xl mx-auto px-4 py-2 flex flex-wrap gap-x-5 gap-y-1 text-[11px] text-stone-600 border-b border-stone-800/60">
        <span>
          <span className="text-stone-500 font-bold uppercase tracking-wider">
            API event:{" "}
          </span>
          {odds.length > 0
            ? new Date(odds[0].commence_time).toLocaleDateString("en-US", {
                weekday: "short",
                month: "short",
                day: "numeric",
                year: "numeric",
              })
            : loading
              ? "loading…"
              : "—"}
        </span>
        <span>
          <span className="text-stone-500 font-bold uppercase tracking-wider">
            API fights:{" "}
          </span>
          {odds.length}
        </span>
        <span>
          <span className="text-stone-500 font-bold uppercase tracking-wider">
            DK slate:{" "}
          </span>
          {dkFighters.length > 0 ? `${dkFighters.length} fighters` : "loading…"}
        </span>
        <span>
          <span className="text-stone-500 font-bold uppercase tracking-wider">
            Cache fetched:{" "}
          </span>
          {cacheTimestamp
            ? new Date(cacheTimestamp).toLocaleString("en-US", {
                month: "short",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
              })
            : "—"}
          {fromCache && <span className="ml-1 text-yellow-600">(cached)</span>}
        </span>
        {(() => {
          if (!fromCache || dkFighters.length === 0 || odds.length === 0)
            return null;
          const apiNames = new Set(
            odds
              .flatMap((e) => [e.home_team, e.away_team])
              .filter(Boolean)
              .map((n) => n.trim().toLowerCase()),
          );
          const hasMatch = dkFighters.some((f) =>
            apiNames.has(f.trim().toLowerCase()),
          );
          return hasMatch ? (
            <span className="text-green-600">✓ DK slate matches API</span>
          ) : (
            <span className="text-red-500">
              ⚠ Cache appears stale — auto-refreshing
            </span>
          );
        })()}
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
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3 pb-3 border-b border-stone-700/60">
              <label className="flex items-center gap-2 text-xs text-stone-300">
                <input
                  type="checkbox"
                  checked={alertsEnabled}
                  onChange={async (e) => {
                    const enabled = e.target.checked;
                    if (
                      enabled &&
                      "Notification" in window &&
                      Notification.permission === "default"
                    ) {
                      try {
                        await Notification.requestPermission();
                      } catch (_) {
                        // Ignore notification permission errors.
                      }
                    }
                    setAlertsEnabled(enabled);
                  }}
                />
                Enable local line polling
              </label>
              <span className="text-[11px] text-stone-500">
                {alertsEnabled
                  ? `Polling every ${Math.floor(ALERT_POLL_MS / 60000)} min`
                  : "Polling paused"}
                {alertsEnabled && lastPolledAt ? ` · last ${lastPolledAt}` : ""}
              </span>
            </div>

            {alertSubmitted ? (
              <div className="border border-green-700/50 bg-green-900/20 rounded px-4 py-3 text-green-400 text-sm">
                ✓ Alert saved locally. This page will watch line movement.
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
                  Save Local Alert
                </button>
              </form>
            )}

            {alertEvents.length > 0 && (
              <div className="mt-4 rounded border border-green-700/40 bg-green-950/20 p-3">
                <p className="text-[11px] text-green-400 uppercase tracking-wider font-bold mb-2">
                  Recent Alert Hits
                </p>
                <ul className="space-y-1">
                  {alertEvents.map((event) => (
                    <li
                      key={event.id}
                      className="text-xs text-stone-300 flex justify-between gap-2"
                    >
                      <span>{event.message}</span>
                      <span className="text-stone-500 shrink-0">
                        {event.time}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {localAlerts.length > 0 && (
              <div className="mt-4 rounded border border-stone-700/60 p-3">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <p className="text-[11px] text-stone-400 uppercase tracking-wider font-bold">
                    Saved Alerts
                  </p>
                  <button
                    type="button"
                    onClick={() => setLocalAlerts([])}
                    className="text-[10px] uppercase tracking-wider text-stone-500 hover:text-red-400 transition"
                  >
                    Clear all
                  </button>
                </div>
                <ul className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                  {localAlerts.map((alert) => (
                    <li
                      key={alert.id}
                      className="text-xs text-stone-300 border border-stone-800 rounded px-2.5 py-2 flex items-center justify-between gap-2"
                    >
                      <span className="min-w-0 truncate">
                        {alert.fighter}{" "}
                        {alert.direction === "better"
                          ? "better than"
                          : "worse than"}{" "}
                        {fmt(alert.targetOdds)}
                        {alert.lastSeenOdds != null && (
                          <span className="text-stone-500">
                            {" "}
                            · now {fmt(alert.lastSeenOdds)}
                          </span>
                        )}
                        {alert.triggeredAt && (
                          <span className="text-green-400"> · triggered</span>
                        )}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setLocalAlerts((prev) =>
                            prev.filter((item) => item.id !== alert.id),
                          )
                        }
                        className="text-[10px] uppercase tracking-wider text-stone-500 hover:text-red-400 transition shrink-0"
                      >
                        remove
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <p className="text-stone-600 text-xs mt-4">
              Local alerts check live lines while this page is open. 21+ only.
            </p>
            <p className="text-stone-600 text-xs mt-1">
              Browser notifications are optional; you can still monitor hits
              in-page.
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
            // Filter to only fights on the current card by matching fighter
            // names against the DK slate (word-overlap handles nickname variants
            // like "Lupita Godinez" ↔ "Loopy Godinez", "Patricio Pitbull" ↔
            // "Patricio Freire"). Falls back to all events if slate not loaded.
            const cardWordSet =
              dkFighters.length > 0
                ? new Set(
                    dkFighters
                      .flatMap((n) => n.toLowerCase().split(/\s+/))
                      .filter((w) => w.length >= 3),
                  )
                : null;
            const isCardFight = (event) => {
              if (!cardWordSet) return true;
              return [event.home_team, event.away_team]
                .filter(Boolean)
                .some((name) =>
                  name
                    .toLowerCase()
                    .split(/\s+/)
                    .some((w) => w.length >= 3 && cardWordSet.has(w)),
                );
            };
            const cardOdds = odds.filter(isCardFight);
            const displayOdds = cardOdds.length > 0 ? cardOdds : odds;

            const earliest = new Date(displayOdds[0].commence_time).getTime();
            const TWO_DAYS_MS = 2 * 24 * 60 * 60 * 1000;
            const nextEventFights = displayOdds.filter(
              (e) =>
                new Date(e.commence_time).getTime() - earliest <= TWO_DAYS_MS,
            );
            const futureFights = displayOdds.filter(
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
              displayOdds[0].commence_time,
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
                  <div className="hidden md:grid grid-cols-[1fr_auto_1fr] items-center py-2 px-3 gap-2 hover:bg-stone-900/50 transition">
                    {/* Fighter 1 (left) */}
                    <div className="flex items-center gap-2">
                      <span className="text-stone-100 text-sm font-semibold leading-tight">
                        {f1}
                      </span>
                      <span
                        className={`text-lg font-black ${f1Fav ? "text-red-400" : "text-green-400"}`}
                      >
                        {fmt(best1)}
                      </span>
                      {best1 != null && (
                        <span className="text-stone-600 text-xs">
                          ({impliedProb(best1)}%)
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => selectFighterForAlert(f1, best1)}
                        title={`Set alert for ${f1}`}
                        className="text-stone-600 hover:text-yellow-400 transition text-xs leading-none ml-1"
                      >
                        🔔
                      </button>
                    </div>

                    {/* VS divider */}
                    <div className="text-stone-600 text-xs font-bold px-2 text-center">
                      VS
                    </div>

                    {/* Fighter 2 (right) */}
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => selectFighterForAlert(f2, best2)}
                        title={`Set alert for ${f2}`}
                        className="text-stone-600 hover:text-yellow-400 transition text-xs leading-none mr-1"
                      >
                        🔔
                      </button>
                      {best2 != null && (
                        <span className="text-stone-600 text-xs">
                          ({impliedProb(best2)}%)
                        </span>
                      )}
                      <span
                        className={`text-lg font-black ${f2Fav ? "text-red-400" : "text-green-400"}`}
                      >
                        {fmt(best2)}
                      </span>
                      <span className="text-stone-100 text-sm font-semibold leading-tight">
                        {f2}
                      </span>
                    </div>
                  </div>

                  <article className="md:hidden p-3 bg-stone-950/60">
                    <div className="flex items-center justify-between gap-2 border-b border-stone-800 pb-2">
                      <span className="text-[11px] uppercase tracking-wider text-stone-500">
                        Best Available Lines
                      </span>
                      <span className="text-[11px] text-stone-600">
                        {event.bookmakers.length} books
                      </span>
                    </div>

                    <div className="mobile-kv-row mt-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <button
                          type="button"
                          onClick={() => selectFighterForAlert(f1, best1)}
                          title={`Set alert for ${f1}`}
                          className="text-stone-500 hover:text-yellow-400 transition text-xs"
                        >
                          🔔
                        </button>
                        <span className="text-sm font-semibold text-stone-100 truncate">
                          {f1}
                        </span>
                      </div>
                      <div className="text-right">
                        <span
                          className={`text-xl font-black ${f1Fav ? "text-red-400" : "text-green-400"}`}
                        >
                          {fmt(best1)}
                        </span>
                        {best1 != null && (
                          <p className="text-[11px] text-stone-500">
                            {impliedProb(best1)}% implied
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="mobile-kv-row">
                      <div className="flex items-center gap-2 min-w-0">
                        <button
                          type="button"
                          onClick={() => selectFighterForAlert(f2, best2)}
                          title={`Set alert for ${f2}`}
                          className="text-stone-500 hover:text-yellow-400 transition text-xs"
                        >
                          🔔
                        </button>
                        <span className="text-sm font-semibold text-stone-100 truncate">
                          {f2}
                        </span>
                      </div>
                      <div className="text-right">
                        <span
                          className={`text-xl font-black ${f2Fav ? "text-red-400" : "text-green-400"}`}
                        >
                          {fmt(best2)}
                        </span>
                        {best2 != null && (
                          <p className="text-[11px] text-stone-500">
                            {impliedProb(best2)}% implied
                          </p>
                        )}
                      </div>
                    </div>
                  </article>

                  {/* Collapsed bookmaker rows */}
                  {event.bookmakers.length > 0 && (
                    <details className="bg-stone-900/30">
                      <summary className="px-3 py-1 text-xs text-stone-600 cursor-pointer hover:text-stone-400 select-none">
                        ▸ {event.bookmakers.length} books
                      </summary>
                      <div className="overflow-x-auto hidden md:block">
                        <table className="w-full text-xs text-stone-400 mb-1">
                          <tbody>
                            {event.bookmakers.map((bm) => {
                              const h2h = bm.markets.find(
                                (m) => m.key === "h2h",
                              );
                              const o1 = h2h?.outcomes.find(
                                (o) => o.name === f1,
                              );
                              const o2 = h2h?.outcomes.find(
                                (o) => o.name === f2,
                              );
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
                        </table>{" "}
                      </div>
                      <div className="md:hidden px-3 pb-2 space-y-1.5">
                        {event.bookmakers.map((bm) => {
                          const h2h = bm.markets.find((m) => m.key === "h2h");
                          const o1 = h2h?.outcomes.find((o) => o.name === f1);
                          const o2 = h2h?.outcomes.find((o) => o.name === f2);
                          return (
                            <div
                              key={`mobile-book-${bm.key}`}
                              className="mobile-data-card"
                            >
                              <p className="text-[11px] text-stone-500 uppercase tracking-wider mb-1">
                                {bm.title}
                              </p>
                              <div className="mobile-kv-row">
                                <span className="mobile-kv-label">{f1}</span>
                                <span
                                  className={`mobile-kv-value ${o1?.price === best1 ? "text-yellow-400" : ""}`}
                                >
                                  {fmt(o1?.price)}
                                </span>
                              </div>
                              <div className="mobile-kv-row">
                                <span className="mobile-kv-label">{f2}</span>
                                <span
                                  className={`mobile-kv-value ${o2?.price === best2 ? "text-yellow-400" : ""}`}
                                >
                                  {fmt(o2?.price)}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
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
