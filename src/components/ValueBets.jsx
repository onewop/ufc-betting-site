import React, { useState, useEffect, useMemo, useCallback } from "react";
import { estimateFightRounds } from "./projectionMath";
import FighterImage from "./FighterImage";
import PaywallGate from "./PaywallGate";
import { isPro } from "../utils/devAccess";

// ─── Odds utilities (same cache as LatestOdds.jsx) ──────────────────────────

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
  { label: "+15%", value: 15 },
];

const BET_TYPE_FILTERS = ["All", "Moneyline", "Totals"];

const SORT_OPTIONS = [
  { label: "Best +EV", value: "ev_desc" },
  { label: "EV ↑", value: "ev_asc" },
  { label: "A–Z", value: "fighter_asc" },
  { label: "Best Odds", value: "odds_asc" },
];

// ─── Recommendation labels ───────────────────────────────────────────────────

const getRecommendation = (ev) => {
  if (ev >= 20)
    return {
      label: "ELITE EDGE",
      cls: "text-green-400 font-bold",
      badge: "bg-green-500/25 border-green-400/70 text-green-300",
      glow: "shadow-[0_0_25px_rgba(34,197,94,0.25)] hover:shadow-[0_0_35px_rgba(34,197,94,0.35)]",
      border: "border-green-400/50",
      accent: "bg-gradient-to-r from-green-500 to-emerald-400",
      ring: "ring-1 ring-green-500/20",
    };
  if (ev >= 12)
    return {
      label: "STRONG BET",
      cls: "text-green-400 font-bold",
      badge: "bg-green-500/20 border-green-500/60 text-green-400",
      glow: "shadow-[0_0_18px_rgba(34,197,94,0.18)] hover:shadow-[0_0_25px_rgba(34,197,94,0.25)]",
      border: "border-green-500/40",
      accent: "bg-green-500",
      ring: "ring-1 ring-green-500/10",
    };
  if (ev >= 6)
    return {
      label: "GOOD VALUE",
      cls: "text-amber-400 font-bold",
      badge: "bg-amber-500/20 border-amber-500/60 text-amber-400",
      glow: "shadow-[0_0_14px_rgba(245,158,11,0.12)] hover:shadow-[0_0_20px_rgba(245,158,11,0.2)]",
      border: "border-amber-500/40",
      accent: "bg-amber-500",
      ring: "",
    };
  if (ev >= 3)
    return {
      label: "SLIGHT EDGE",
      cls: "text-yellow-500",
      badge: "bg-yellow-500/15 border-yellow-600/40 text-yellow-500",
      glow: "hover:shadow-[0_0_12px_rgba(234,179,8,0.1)]",
      border: "border-yellow-700/30",
      accent: "bg-yellow-600",
      ring: "",
    };
  return {
    label: "MARGINAL",
    cls: "text-stone-400",
    badge: "bg-stone-700/30 border-stone-600/40 text-stone-400",
    glow: "",
    border: "border-stone-700/30",
    accent: "bg-stone-600",
    ring: "",
  };
};

// ─── Reasoning generators ────────────────────────────────────────────────────

/** Returns a contextual label for the INTEL section based on the primary edge */
const getIntelLabel = (bet) => {
  if (bet.stats) {
    const { stats, oppStats, finishRate } = bet;
    const kd = stats?.avg_kd_per_fight || 0;
    const tdDiff = (stats?.td_avg || 0) - (oppStats?.td_avg || 0);
    const slpmDiff = (stats?.slpm || 0) - (oppStats?.slpm || 0);
    if (kd >= 0.5) return "POWER THREAT";
    if (tdDiff > 0.8) return "WRESTLING EDGE";
    if (slpmDiff > 0.8) return "STRIKING EDGE";
    if (finishRate && finishRate > 65) return "FINISH UPSIDE";
    return "VALUE PICK";
  }
  const { type, avgFinRate } = bet;
  if (type?.includes("Under") && avgFinRate > 55) return "EARLY FINISH";
  if (type?.includes("Over") && avgFinRate < 45) return "DISTANCE LIKELY";
  return "ROUND PROP";
};

const generateMoneylineReasoning = (bet) => {
  const { fighter, opponent, modelProb, impliedProb, stats, oppStats, ev, bestOdds, finishRate } = bet;
  const lastName = fighter.split(" ").pop();
  const oppLastName = (opponent || "").split(" ").pop();
  const modelPct = (modelProb * 100).toFixed(1);
  const impliedPct = impliedProb ? (impliedProb * 100).toFixed(1) : null;
  const gapPts = impliedPct
    ? (modelProb * 100 - parseFloat(impliedPct)).toFixed(1)
    : null;

  const parts = [];

  // Sentence 1: The core pricing gap
  if (gapPts && parseFloat(gapPts) > 0) {
    parts.push(
      `Books price ${lastName} at ${impliedPct}% — our model finds ${modelPct}%, a ${gapPts}pt gap the market hasn't fully corrected.`
    );
  } else {
    parts.push(`Model projects ${lastName} at ${modelPct}% win probability.`);
  }

  // Sentence 2: Named statistical edge vs opponent
  const slpmDiff = ((stats?.slpm || 0) - (oppStats?.slpm || 0)).toFixed(1);
  const tdDiff = ((stats?.td_avg || 0) - (oppStats?.td_avg || 0)).toFixed(1);
  const defA = parseFloat(stats?.striking_defense) || 0;
  const defB = parseFloat(oppStats?.striking_defense) || 0;
  const kd = stats?.avg_kd_per_fight || 0;
  if (kd >= 0.5) {
    parts.push(
      `${lastName} averages ${kd.toFixed(1)} knockdowns/fight — a genuine one-shot threat that books tend to underprice against ${oppLastName}.`
    );
  } else if (parseFloat(tdDiff) > 0.8) {
    parts.push(
      `Grappling edge is significant: ${stats?.td_avg?.toFixed(1) || "—"} TDs/fight vs ${oppStats?.td_avg?.toFixed(1) || "—"} for ${oppLastName} — expect cage control rounds to dominate the scoring.`
    );
  } else if (parseFloat(slpmDiff) > 0.8) {
    parts.push(
      `Outstrikes ${oppLastName} by ${slpmDiff} SLpM (${stats?.slpm?.toFixed(1) || "—"} vs ${oppStats?.slpm?.toFixed(1) || "—"}) — volume advantage should show clearly if this reaches the scorecards.`
    );
  } else if (defA - defB > 5) {
    parts.push(
      `${lastName} absorbs less damage (${defA.toFixed(0)}% defense vs ${defB.toFixed(0)}% for ${oppLastName}) — harder to hurt, which keeps win probability elevated in close rounds.`
    );
  } else if (finishRate && finishRate > 65) {
    parts.push(
      `${finishRate.toFixed(0)}% career finish rate means this isn't just a win — it often comes with a bonus-earning stoppage.`
    );
  }

  // Sentence 3: Actionable context
  if (bestOdds > 0) {
    parts.push(
      `At ${fmt(bestOdds)}, the underdog payout amplifies the value — this is a high-ceiling play ideal for parlays or small standalone bets.`
    );
  } else if (bestOdds != null && bestOdds < -200) {
    parts.push(
      `At ${fmt(bestOdds)}, chalk — best used as a parlay anchor. The EV comes from the line being softer than it should be.`
    );
  } else if (ev >= 10) {
    parts.push(
      `+${ev.toFixed(1)}% EV makes this one of the sharpest value opportunities on the card this week.`
    );
  }

  return parts.join(" ");
};

const generateTotalsReasoning = (bet) => {
  const { type, estRounds, avgFinRate, fighterA, fighterB, bestOdds, ev, modelProb } = bet;
  const isOver = type.includes("Over");
  const point = parseFloat(type.match(/[\d.]+/)?.[0] || "2.5");
  const roundStr = estRounds?.toFixed(1) || "2.5";
  const modelPct = (modelProb * 100).toFixed(0);
  const lastA = (fighterA || "").split(" ").pop();
  const lastB = (fighterB || "").split(" ").pop();
  const parts = [];

  // Sentence 1: Duration projection with context
  if (isOver) {
    if (parseFloat(roundStr) > point) {
      parts.push(
        `Model projects ${roundStr} avg rounds — above the ${point} line — driven by both fighters' tendency to grind out late decisions.`
      );
    } else {
      parts.push(
        `Despite projecting ${roundStr} rounds, the Over at ${fmt(bestOdds)} carries +${ev.toFixed(1)}% EV based on historical pacing patterns for this style matchup.`
      );
    }
  } else {
    if (parseFloat(roundStr) < point) {
      parts.push(
        `Model estimates only ${roundStr} rounds — well under the ${point} line — suggesting this fight ends before the scorecards are needed.`
      );
    } else {
      parts.push(
        `Projecting ${roundStr} rounds, but the Under at ${fmt(bestOdds)} carries +${ev.toFixed(1)}% EV given the finishers involved.`
      );
    }
  }

  // Sentence 2: Fighter context
  if (avgFinRate != null) {
    const finRateStr = avgFinRate.toFixed(0);
    if (!isOver && avgFinRate > 60) {
      parts.push(
        `${lastA} and ${lastB} combine for a ${finRateStr}% finish rate — neither fighter is comfortable taking a fight the full distance.`
      );
    } else if (!isOver && avgFinRate > 45) {
      parts.push(
        `Combined ${finRateStr}% finish rate — at least one of these fighters has a strong track record of early stoppages.`
      );
    } else if (isOver && avgFinRate < 40) {
      parts.push(
        `${lastA} and ${lastB} combine for just ${finRateStr}% finishes — both are comfortable grinding out five rounds if necessary.`
      );
    } else {
      parts.push(
        `Combined ${finRateStr}% finish rate. The duration projection gives this ${modelPct}% probability — lean on the model's historical accuracy here.`
      );
    }
  }

  // Sentence 3: Recommendation
  parts.push(
    `Look for ${isOver ? "a gritty pace war and late-round action" : "early aggression in rounds 1–2 — if neither fighter gets hurt early, reassess live"}.`
  );

  return parts.join(" ");
};

// ─── Sample bet builder ──────────────────────────────────────────────────────

const buildSampleBets = (fights) => {
  if (!fights || fights.length === 0) return { moneyline: [], totals: [] };

  const moneyline = [];
  const totals = [];

  fights.forEach((fight) => {
    const [f1, f2] = fight.fighters || [];
    if (!f1 || !f2) return;
    const s1 = f1.stats || {};
    const s2 = f2.stats || {};

    const f1Score =
      (s1.slpm || 0) * 0.3 +
      (s1.td_avg || 0) * 0.2 +
      (f1.finish_rate_pct || 50) * 0.01 +
      (parseFloat(s1.striking_defense) || 50) * 0.01;
    const f2Score =
      (s2.slpm || 0) * 0.3 +
      (s2.td_avg || 0) * 0.2 +
      (f2.finish_rate_pct || 50) * 0.01 +
      (parseFloat(s2.striking_defense) || 50) * 0.01;

    const stronger = f1Score >= f2Score ? f1 : f2;
    const weaker = f1Score >= f2Score ? f2 : f1;
    const sStats = stronger === f1 ? s1 : s2;
    const wStats = weaker === f1 ? s1 : s2;
    const diff = Math.abs(f1Score - f2Score);

    let favOdds, dogOdds;
    if (diff > 2.0) {
      favOdds = -(220 + Math.floor(diff * 50));
      dogOdds = 180 + Math.floor(diff * 45);
    } else if (diff > 1.2) {
      favOdds = -(160 + Math.floor(diff * 40));
      dogOdds = 135 + Math.floor(diff * 35);
    } else if (diff > 0.4) {
      favOdds = -(120 + Math.floor(diff * 30));
      dogOdds = 105 + Math.floor(diff * 25);
    } else {
      favOdds = -(108 + Math.floor(diff * 18));
      dogOdds = 100 + Math.floor(diff * 15);
    }

    const favImplied = impliedProbFromAmerican(favOdds);
    const dogImplied = impliedProbFromAmerican(dogOdds);

    // Deterministic adjustment based on stat edge
    const favModelAdj = 0.035 + Math.min(0.07, diff * 0.025);
    const favModel = Math.min(0.92, favImplied + favModelAdj);
    const favEv = calcEV(favModel, favOdds);

    if (favEv != null && favEv > 1.5) {
      moneyline.push({
        fighter: stronger.name,
        opponent: weaker.name,
        matchup: fight.matchup,
        bestOdds: favOdds,
        impliedProb: favImplied,
        modelProb: favModel,
        ev: favEv,
        salary: stronger.salary,
        record: stronger.record,
        weightClass: fight.weight_class,
        stats: sStats,
        oppStats: wStats,
        finishRate: stronger.finish_rate_pct,
        isSample: true,
      });
    }

    const dogModelAdj = 0.055 + Math.min(0.09, diff * 0.03);
    const dogModel = Math.min(0.68, dogImplied + dogModelAdj);
    const dogEv = calcEV(dogModel, dogOdds);

    if (dogEv != null && dogEv > 3) {
      moneyline.push({
        fighter: weaker.name,
        opponent: stronger.name,
        matchup: fight.matchup,
        bestOdds: dogOdds,
        impliedProb: dogImplied,
        modelProb: dogModel,
        ev: dogEv,
        salary: weaker.salary,
        record: weaker.record,
        weightClass: fight.weight_class,
        stats: wStats,
        oppStats: sStats,
        finishRate: weaker.finish_rate_pct,
        isSample: true,
      });
    }

    const avgFinRate =
      ((f1.finish_rate_pct || 50) + (f2.finish_rate_pct || 50)) / 2;
    const { rounds: estRounds } = estimateFightRounds(
      f1,
      f2,
      fight.betting_odds || {},
    );

    if (avgFinRate > 65) {
      const underOdds = -(120 + Math.floor(avgFinRate * 0.3));
      const underImplied = impliedProbFromAmerican(underOdds);
      const underModel = Math.min(
        0.75,
        underImplied + 0.04 + Math.min(0.06, (avgFinRate - 65) * 0.002),
      );
      const underEv = calcEV(underModel, underOdds);
      if (underEv != null && underEv > 3) {
        totals.push({
          matchup: fight.matchup,
          type: "Under 2.5 Rounds",
          bestOdds: underOdds,
          impliedProb: underImplied,
          modelProb: underModel,
          ev: underEv,
          estRounds,
          fighterA: f1.name,
          fighterB: f2.name,
          avgFinRate,
          isSample: true,
        });
      }
    }
  });

  moneyline.sort((a, b) => b.ev - a.ev);
  totals.sort((a, b) => b.ev - a.ev);

  return {
    moneyline: moneyline.slice(0, 8),
    totals: totals.slice(0, 4),
  };
};

// ─── Component ───────────────────────────────────────────────────────────────

const ValueBets = ({ eventTitle, currentUser }) => {
  if (!isPro(currentUser))
    return (
      <PaywallGate currentUser={currentUser} featureName="+EV Value Bets" />
    );

  const [fights, setFights] = useState([]);
  const [oddsData, setOddsData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [evThreshold, setEvThreshold] = useState(3);
  const [betTypeFilter, setBetTypeFilter] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [showExplainer, setShowExplainer] = useState(false);
  const [eventInfo, setEventInfo] = useState({ name: "", date: "" });
  const [sortBy, setSortBy] = useState("ev_desc");

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

  // ── Build +EV bets from real odds ──
  const realValueBets = useMemo(() => {
    if (!fights.length) return { moneyline: [], totals: [] };

    const moneyline = [];
    const totals = [];

    fights.forEach((fight) => {
      const [f1, f2] = fight.fighters || [];
      if (!f1 || !f2) return;

      const oddsEvent = oddsData.find((e) => {
        const names = [e.home_team, e.away_team].filter(Boolean);
        return names.some(
          (n) => fuzzyMatch(f1.name, n) || fuzzyMatch(f2.name, n),
        );
      });

      const bookmakers = oddsEvent?.bookmakers || [];

      const buildModelProb = (fighter, opponent) => {
        const stats = fighter.stats || {};
        const oppStats = opponent.stats || {};

        const bestMl = bestOddsForName(bookmakers, fighter.name);
        const oppBestMl = bestOddsForName(bookmakers, opponent.name);
        let mlProb = null;
        if (bestMl != null && oppBestMl != null) {
          const rawA = impliedProbFromAmerican(bestMl);
          const rawB = impliedProbFromAmerican(oppBestMl);
          if (rawA != null && rawB != null) {
            mlProb = rawA / (rawA + rawB);
          }
        }

        let statAdj = 0;
        const slpmDiff = (stats.slpm || 0) - (oppStats.slpm || 0);
        statAdj += Math.max(-0.04, Math.min(0.04, slpmDiff * 0.005));
        const defA = parseFloat(stats.striking_defense) || 50;
        const defB = parseFloat(oppStats.striking_defense) || 50;
        statAdj += (defA - defB) * 0.0003;
        const tdDiff = (stats.td_avg || 0) - (oppStats.td_avg || 0);
        statAdj += Math.max(-0.03, Math.min(0.03, tdDiff * 0.008));
        const frA = fighter.finish_rate_pct || 0;
        const frB = opponent.finish_rate_pct || 0;
        statAdj += Math.max(-0.03, Math.min(0.03, (frA - frB) * 0.0003));
        const streakA = fighter.ufc_win_streak || 0;
        const streakB = opponent.ufc_win_streak || 0;
        statAdj += Math.max(-0.02, Math.min(0.02, (streakA - streakB) * 0.008));

        let modelProb;
        if (mlProb != null) {
          modelProb = Math.max(0.05, Math.min(0.95, mlProb + statAdj));
        } else {
          modelProb = 0.5 + statAdj;
        }

        return { modelProb, bestMl };
      };

      const { modelProb: modelProbF1, bestMl: mlF1 } = buildModelProb(f1, f2);
      const { modelProb: modelProbF2, bestMl: mlF2 } = buildModelProb(f2, f1);

      [
        { fighter: f1, opponent: f2, modelProb: modelProbF1, bestMl: mlF1 },
        { fighter: f2, opponent: f1, modelProb: modelProbF2, bestMl: mlF2 },
      ].forEach(({ fighter, opponent, modelProb, bestMl }) => {
        const ev = calcEV(modelProb, bestMl);
        if (ev != null) {
          moneyline.push({
            fighter: fighter.name,
            opponent: opponent.name,
            matchup: fight.matchup,
            bestOdds: bestMl,
            impliedProb: impliedProbFromAmerican(bestMl),
            modelProb,
            ev,
            salary: fighter.salary,
            record: fighter.record,
            weightClass: fight.weight_class,
            stats: fighter.stats,
            oppStats: opponent.stats,
            finishRate: fighter.finish_rate_pct,
            isSample: false,
          });
        }
      });

      // ── Totals ──
      const allTotals = bestTotalsForFight(bookmakers);
      if (allTotals.length > 0) {
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
        const { rounds: estRounds } = estimateFightRounds(
          f1,
          f2,
          fight.betting_odds || {},
        );
        const avgFinRate =
          ((f1.finish_rate_pct || 50) + (f2.finish_rate_pct || 50)) / 2;

        [bestOver, bestUnder].forEach((bet) => {
          if (!bet) return;
          const point = bet.point || 2.5;
          let modelP;
          if (bet.name === "Over") {
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
              avgFinRate,
              isSample: false,
            });
          }
        });
      }
    });

    moneyline.sort((a, b) => b.ev - a.ev);
    totals.sort((a, b) => b.ev - a.ev);
    return { moneyline, totals };
  }, [fights, oddsData]);

  // ── Sample bets as fallback ──
  const sampleBets = useMemo(() => buildSampleBets(fights), [fights]);

  // ── Use real odds if they produce positive-EV bets, else show samples ──
  const realPositiveCount =
    realValueBets.moneyline.filter((b) => b.ev > 0).length +
    realValueBets.totals.filter((b) => b.ev > 0).length;
  const hasRealOdds = oddsData.length > 0 && realPositiveCount > 0;
  const activeBets = hasRealOdds ? realValueBets : sampleBets;
  const usingSamples = !hasRealOdds && sampleBets.moneyline.length > 0;

  // ── Apply filters ──
  const filteredMoneyline = useMemo(() => {
    let bets = activeBets.moneyline.filter((b) => b.ev >= evThreshold);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      bets = bets.filter(
        (b) =>
          b.fighter.toLowerCase().includes(q) ||
          b.opponent.toLowerCase().includes(q),
      );
    }
    if (sortBy === "ev_asc") bets = [...bets].sort((a, b) => a.ev - b.ev);
    else if (sortBy === "fighter_asc") bets = [...bets].sort((a, b) => a.fighter.localeCompare(b.fighter));
    else if (sortBy === "odds_asc") bets = [...bets].sort((a, b) => (b.bestOdds ?? -9999) - (a.bestOdds ?? -9999));
    else bets = [...bets].sort((a, b) => b.ev - a.ev); // ev_desc default
    return bets;
  }, [activeBets.moneyline, evThreshold, searchQuery, sortBy]);

  const filteredTotals = useMemo(() => {
    let bets = activeBets.totals.filter((b) => b.ev >= evThreshold);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      bets = bets.filter(
        (b) =>
          (b.fighterA || "").toLowerCase().includes(q) ||
          (b.fighterB || "").toLowerCase().includes(q),
      );
    }
    if (sortBy === "ev_asc") bets = [...bets].sort((a, b) => a.ev - b.ev);
    else if (sortBy === "fighter_asc") bets = [...bets].sort((a, b) => (a.fighterA || "").localeCompare(b.fighterA || ""));
    else if (sortBy === "odds_asc") bets = [...bets].sort((a, b) => (b.bestOdds ?? -9999) - (a.bestOdds ?? -9999));
    else bets = [...bets].sort((a, b) => b.ev - a.ev); // ev_desc default
    return bets;
  }, [activeBets.totals, evThreshold, searchQuery, sortBy]);

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
      <div className="relative border-b border-yellow-700/40 overflow-hidden">
        {/* Subtle diagonal camo texture */}
        <div className="absolute inset-0 bg-gradient-to-r from-yellow-900/10 via-stone-950 to-yellow-900/10" />
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage:
              "repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(202,138,4,0.15) 10px, rgba(202,138,4,0.15) 11px)",
          }}
        />
        <div className="relative max-w-6xl mx-auto px-4 py-6 sm:py-7">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-[10px] text-yellow-600/80 tracking-[0.3em] uppercase font-mono">
                  CLASSIFIED • LEVEL 5
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-black tracking-wider font-mono flex items-center gap-3">
                <span className="text-yellow-500 text-2xl">⚡</span>
                OPERATION: <span className="text-yellow-400">VALUE EDGE</span>
              </h1>
              <p className="text-stone-500 text-xs tracking-widest uppercase mt-2 font-mono">
                +EV VALUE BETS — REAL-TIME MISPRICING DETECTION
              </p>
              <p className="text-stone-600 text-xs mt-1 font-mono">
                {eventTitle || eventInfo.name}
                {eventInfo.date ? ` — ${eventInfo.date}` : ""}
              </p>
            </div>
            <div className="flex flex-col items-end gap-2">
              <button
                onClick={() => fetchOdds(true)}
                className="group flex items-center gap-2 border border-yellow-700/60 text-yellow-400 px-5 py-2 text-xs tracking-widest uppercase hover:bg-yellow-900/20 hover:border-yellow-600 transition-all rounded font-mono"
              >
                <svg
                  className={
                    loading
                      ? "animate-spin"
                      : "group-hover:rotate-180 transition-transform duration-500"
                  }
                  width="14"
                  height="14"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                  style={{ width: 14, height: 14 }}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  />
                </svg>
                {loading ? "SCANNING…" : "REFRESH INTEL"}
              </button>
              {lastUpdated && (
                <span className="text-stone-600 text-[10px] tracking-wide font-mono flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500/60 animate-pulse" />
                  SYNCED{" "}
                  {new Date(lastUpdated).toLocaleTimeString("en-US", {
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        {/* ── SAMPLE DATA BANNER ── */}
        {usingSamples && !loading && (
          <div className="bg-amber-900/20 border border-amber-600/40 rounded-lg px-4 py-3 flex items-start gap-3">
            <span className="text-amber-400 text-lg mt-0.5">⚠</span>
            <div>
              <p className="text-amber-300 text-sm font-bold font-mono tracking-wide">
                SIMULATED INTEL — LIVE ODDS NOT YET LOADED
              </p>
              <p className="text-amber-400/70 text-xs mt-0.5">
                These projections use modeled odds based on fighter stats. Visit
                the Live Odds page to cache real sportsbook lines, then return
                here for live +EV calculations.
              </p>
            </div>
          </div>
        )}

        {/* ── SUMMARY STATS BAR ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-stone-900/80 border border-stone-800 rounded-xl p-4 text-center relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-0.5 bg-yellow-500/40" />
            <div className="text-stone-500 text-[10px] tracking-widest uppercase font-mono mb-1">
              BETS FOUND
            </div>
            <div className="text-yellow-400 text-3xl font-black font-mono">
              {totalValueBets}
            </div>
          </div>
          <div className="bg-stone-900/80 border border-stone-800 rounded-xl p-4 text-center relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-0.5 bg-green-500/40" />
            <div className="text-stone-500 text-[10px] tracking-widest uppercase font-mono mb-1">
              BEST +EV
            </div>
            <div className="text-green-400 text-3xl font-black font-mono">
              {activeBets.moneyline.length > 0
                ? `+${activeBets.moneyline[0].ev.toFixed(1)}%`
                : "—"}
            </div>
          </div>
          <div className="bg-stone-900/80 border border-stone-800 rounded-xl p-4 text-center relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-0.5 bg-green-500/40" />
            <div className="text-stone-500 text-[10px] tracking-widest uppercase font-mono mb-1">
              STRONG BETS
            </div>
            <div className="text-green-400 text-3xl font-black font-mono">
              {activeBets.moneyline.filter((b) => b.ev >= 12).length +
                activeBets.totals.filter((b) => b.ev >= 12).length}
            </div>
          </div>
          <div className="bg-stone-900/80 border border-stone-800 rounded-xl p-4 text-center relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-0.5 bg-yellow-500/40" />
            <div className="text-stone-500 text-[10px] tracking-widest uppercase font-mono mb-1">
              FIGHTS ANALYZED
            </div>
            <div className="text-yellow-400 text-3xl font-black font-mono">
              {fights.length}
            </div>
          </div>
        </div>

        {/* ── FILTERS BAR ── */}
        <div className="bg-stone-900/80 border border-stone-800 rounded-xl p-4 sm:p-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
            <div>
              <span className="text-yellow-500/80 text-[10px] font-bold tracking-widest uppercase block mb-2.5 font-mono">
                MIN +EV THRESHOLD
              </span>
              <div className="flex gap-1 flex-wrap">
                {EV_THRESHOLDS.map((t) => (
                  <button
                    key={t.value}
                    onClick={() => setEvThreshold(t.value)}
                    className={`px-3 py-2 text-xs tracking-wide rounded-lg border transition-all font-mono ${
                      evThreshold === t.value
                        ? "bg-yellow-600/20 border-yellow-500/70 text-yellow-300 font-bold shadow-[0_0_8px_rgba(234,179,8,0.15)]"
                        : "border-stone-700/60 text-stone-500 hover:border-yellow-700/50 hover:text-yellow-500/80 hover:bg-stone-800/50"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <span className="text-yellow-500/80 text-[10px] font-bold tracking-widest uppercase block mb-2.5 font-mono">
                BET TYPE
              </span>
              <div className="flex gap-1">
                {BET_TYPE_FILTERS.map((f) => (
                  <button
                    key={f}
                    onClick={() => setBetTypeFilter(f)}
                    className={`px-3 py-2 text-xs tracking-wide rounded-lg border transition-all font-mono ${
                      betTypeFilter === f
                        ? "bg-yellow-600/20 border-yellow-500/70 text-yellow-300 font-bold shadow-[0_0_8px_rgba(234,179,8,0.15)]"
                        : "border-stone-700/60 text-stone-500 hover:border-yellow-700/50 hover:text-yellow-500/80 hover:bg-stone-800/50"
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <span className="text-yellow-500/80 text-[10px] font-bold tracking-widest uppercase block mb-2.5 font-mono">
                SORT BY
              </span>
              <div className="flex gap-1 flex-wrap">
                {SORT_OPTIONS.map((s) => (
                  <button
                    key={s.value}
                    onClick={() => setSortBy(s.value)}
                    className={`px-3 py-2 text-xs tracking-wide rounded-lg border transition-all font-mono ${
                      sortBy === s.value
                        ? "bg-yellow-600/20 border-yellow-500/70 text-yellow-300 font-bold shadow-[0_0_8px_rgba(234,179,8,0.15)]"
                        : "border-stone-700/60 text-stone-500 hover:border-yellow-700/50 hover:text-yellow-500/80 hover:bg-stone-800/50"
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <span className="text-yellow-500/80 text-[10px] font-bold tracking-widest uppercase block mb-2.5 font-mono">
                SEARCH FIGHTER
              </span>
              <div className="relative overflow-hidden">
                <svg
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-600"
                  width="14"
                  height="14"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                  style={{ width: 14, height: 14 }}
                >
                  <circle cx="11" cy="11" r="8" />
                  <path strokeLinecap="round" d="M21 21l-4.35-4.35" />
                </svg>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Barbosa, Burns…"
                  className="w-full bg-stone-800/60 border border-stone-700/60 rounded-lg pl-9 pr-3 py-2 text-xs text-stone-200 placeholder-stone-600 focus:border-yellow-600/70 focus:ring-1 focus:ring-yellow-600/20 focus:outline-none transition-all font-mono"
                />
              </div>
            </div>
          </div>
        </div>

        {/* ── LOADING STATE ── */}
        {loading && fights.length === 0 && (
          <div className="text-center py-24">
            <div className="inline-block w-10 h-10 border-2 border-yellow-500 border-t-transparent rounded-full animate-spin mb-5" />
            <div className="text-yellow-500 text-sm tracking-[0.2em] uppercase font-mono font-bold">
              SCANNING INTEL…
            </div>
            <p className="text-stone-600 text-xs mt-2 font-mono">
              Loading fighter data and sportsbook odds
            </p>
          </div>
        )}

        {/* ── NO RESULTS ── */}
        {!loading && totalValueBets === 0 && fights.length > 0 && (
          <div className="text-center py-20 bg-stone-900/80 rounded-xl border border-stone-800">
            <span className="text-stone-700 text-5xl mb-5 block">🔍</span>
            <p className="text-stone-400 text-sm font-mono font-bold">
              No value bets above +{evThreshold}% threshold
            </p>
            <p className="text-stone-600 text-xs mt-2 font-mono">
              Lower the threshold or check back closer to fight night when odds
              sharpen.
            </p>
          </div>
        )}

        {/* ── MONEYLINE VALUE BET CARDS ── */}
        {showMoneyline && filteredMoneyline.length > 0 && (
          <section>
            <div className="flex items-center gap-3 mb-5">
              <div className="h-px flex-1 bg-gradient-to-r from-transparent via-yellow-700/40 to-transparent" />
              <h2 className="text-yellow-500 text-[11px] font-bold tracking-[0.2em] uppercase font-mono flex items-center gap-2">
                <span>🎯</span>
                MONEYLINE VALUE BETS
                <span className="bg-yellow-500/15 text-yellow-400 text-[10px] px-2 py-0.5 rounded-full font-mono">
                  {filteredMoneyline.length}
                </span>
              </h2>
              <div className="h-px flex-1 bg-gradient-to-r from-transparent via-yellow-700/40 to-transparent" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {filteredMoneyline.map((bet, i) => {
                const rec = getRecommendation(bet.ev);
                const reasoning = generateMoneylineReasoning(bet);
                return (
                  <div
                    key={`ml-${i}`}
                    className={`group bg-stone-900/90 border rounded-xl overflow-hidden transition-all duration-300 hover:scale-[1.015] hover:-translate-y-0.5 ${rec.border} ${rec.glow} ${rec.ring}`}
                  >
                    {/* Top accent bar */}
                    <div className={`h-1 ${rec.accent}`} />

                    <div className="p-5">
                      {/* Header: Fighter + EV badge */}
                      <div className="flex items-center justify-between gap-4 mb-4">
                        <div className="flex items-center gap-4 min-w-0">
                          <div className="relative flex-shrink-0">
                            <FighterImage
                              name={bet.fighter}
                              size="w-14 h-14 sm:w-16 sm:h-16"
                              className="ring-2 ring-stone-700/50 group-hover:ring-yellow-700/40 transition-all"
                            />
                          </div>
                          <div className="min-w-0">
                            <div className="font-black text-stone-50 text-base sm:text-lg font-mono truncate leading-tight">
                              {bet.fighter}
                            </div>
                            <div className="text-stone-500 text-xs font-mono mt-0.5">
                              vs {bet.opponent}
                            </div>
                            <div className="text-stone-600 text-[10px] mt-0.5 font-mono">
                              {bet.record}
                              {bet.weightClass && bet.weightClass !== "N/A"
                                ? ` • ${bet.weightClass}`
                                : ""}
                            </div>
                          </div>
                        </div>
                        <div className="flex-shrink-0">
                          <div
                            className={`border-2 rounded-xl px-4 py-2 text-center font-mono ${rec.badge}`}
                          >
                            <div className="text-2xl sm:text-3xl font-black leading-none tracking-tight">
                              +{bet.ev.toFixed(1)}%
                            </div>
                            <div className="text-[8px] tracking-[0.2em] uppercase mt-1 opacity-80 font-bold">
                              {rec.label}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Stats row */}
                      <div className="grid grid-cols-3 gap-2 mb-4">
                        <div className="bg-stone-800/50 rounded-lg p-2.5 text-center border border-stone-700/30">
                          <div className="text-stone-500 text-[8px] tracking-widest uppercase font-mono">
                            BEST ODDS
                          </div>
                          <div
                            className={`text-base font-black font-mono mt-1 ${bet.bestOdds > 0 ? "text-green-400" : "text-red-400"}`}
                          >
                            {fmt(bet.bestOdds)}
                          </div>
                        </div>
                        <div className="bg-stone-800/50 rounded-lg p-2.5 text-center border border-stone-700/30">
                          <div className="text-stone-500 text-[8px] tracking-widest uppercase font-mono">
                            BOOK IMPLIED
                          </div>
                          <div className="text-base font-mono text-stone-400 mt-1">
                            {bet.impliedProb != null
                              ? `${(bet.impliedProb * 100).toFixed(1)}%`
                              : "—"}
                          </div>
                        </div>
                        <div className="bg-stone-800/50 rounded-lg p-2.5 text-center border border-stone-700/30">
                          <div className="text-stone-500 text-[8px] tracking-widest uppercase font-mono">
                            OUR MODEL
                          </div>
                          <div className="text-base font-black font-mono text-yellow-400 mt-1">
                            {(bet.modelProb * 100).toFixed(1)}%
                          </div>
                        </div>
                      </div>

                      {/* Probability comparison bar */}
                      <div className="mb-4">
                        <div className="flex justify-between text-[9px] text-stone-500 font-mono mb-1.5">
                          <span>
                            BOOK{" "}
                            {bet.impliedProb
                              ? `${(bet.impliedProb * 100).toFixed(0)}%`
                              : ""}
                          </span>
                          <span className="text-yellow-500/70">
                            MODEL {(bet.modelProb * 100).toFixed(0)}%
                          </span>
                        </div>
                        <div className="h-2.5 bg-stone-800 rounded-full overflow-hidden relative">
                          {bet.impliedProb && (
                            <div
                              className="absolute h-full bg-stone-700/50 rounded-full transition-all duration-700"
                              style={{
                                width: `${(bet.impliedProb * 100).toFixed(0)}%`,
                              }}
                            />
                          )}
                          <div
                            className={`absolute h-full rounded-full transition-all duration-700 ${bet.ev >= 12 ? "bg-green-500" : bet.ev >= 6 ? "bg-amber-500" : "bg-yellow-600"}`}
                            style={{
                              width: `${(bet.modelProb * 100).toFixed(0)}%`,
                            }}
                          />
                        </div>
                      </div>

                      {/* INTEL label — dynamic based on edge type */}
                        <div className="bg-stone-800/30 border border-stone-700/40 rounded-lg px-3 py-2.5">
                        <div className="flex items-center gap-1.5 mb-1">
                          <span className="text-yellow-600 text-[8px]">▸</span>
                          <span className="text-[8px] text-yellow-600/80 tracking-[0.15em] uppercase font-mono font-bold">
                            {getIntelLabel(bet)}
                          </span>
                        </div>
                        <p className="text-stone-400 text-[11px] leading-relaxed font-mono">
                          {reasoning}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* ── TOTALS VALUE BET CARDS ── */}
        {showTotals && filteredTotals.length > 0 && (
          <section>
            <div className="flex items-center gap-3 mb-5 mt-6">
              <div className="h-px flex-1 bg-gradient-to-r from-transparent via-yellow-700/40 to-transparent" />
              <h2 className="text-yellow-500 text-[11px] font-bold tracking-[0.2em] uppercase font-mono flex items-center gap-2">
                <span>⏱</span>
                TOTALS / ROUND PROPS
                <span className="bg-yellow-500/15 text-yellow-400 text-[10px] px-2 py-0.5 rounded-full font-mono">
                  {filteredTotals.length}
                </span>
              </h2>
              <div className="h-px flex-1 bg-gradient-to-r from-transparent via-yellow-700/40 to-transparent" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {filteredTotals.map((bet, i) => {
                const rec = getRecommendation(bet.ev);
                const reasoning = generateTotalsReasoning(bet);
                return (
                  <div
                    key={`tot-${i}`}
                    className={`group bg-stone-900/90 border rounded-xl overflow-hidden transition-all duration-300 hover:scale-[1.015] hover:-translate-y-0.5 ${rec.border} ${rec.glow} ${rec.ring}`}
                  >
                    <div className={`h-1 ${rec.accent}`} />

                    <div className="p-5">
                      {/* Header */}
                      <div className="flex items-center justify-between gap-4 mb-4">
                        <div>
                          <div className="text-stone-50 text-base sm:text-lg font-black font-mono leading-tight">
                            {bet.fighterA} vs {bet.fighterB}
                          </div>
                          <div className="text-yellow-400 text-xs font-bold font-mono mt-1.5 flex items-center gap-2">
                            <span
                              className={`inline-block w-2 h-2 rounded-full ${bet.type.includes("Over") ? "bg-green-400" : "bg-red-400"}`}
                            />
                            {bet.type}
                          </div>
                        </div>
                        <div className="flex-shrink-0">
                          <div
                            className={`border-2 rounded-xl px-4 py-2 text-center font-mono ${rec.badge}`}
                          >
                            <div className="text-2xl sm:text-3xl font-black leading-none tracking-tight">
                              +{bet.ev.toFixed(1)}%
                            </div>
                            <div className="text-[8px] tracking-[0.2em] uppercase mt-1 opacity-80 font-bold">
                              {rec.label}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Stats row */}
                      <div className="grid grid-cols-3 gap-2 mb-4">
                        <div className="bg-stone-800/50 rounded-lg p-2.5 text-center border border-stone-700/30">
                          <div className="text-stone-500 text-[8px] tracking-widest uppercase font-mono">
                            BEST ODDS
                          </div>
                          <div
                            className={`text-base font-black font-mono mt-1 ${bet.bestOdds > 0 ? "text-green-400" : "text-red-400"}`}
                          >
                            {fmt(bet.bestOdds)}
                          </div>
                        </div>
                        <div className="bg-stone-800/50 rounded-lg p-2.5 text-center border border-stone-700/30">
                          <div className="text-stone-500 text-[8px] tracking-widest uppercase font-mono">
                            EST. ROUNDS
                          </div>
                          <div className="text-base font-mono text-stone-300 mt-1">
                            {bet.estRounds?.toFixed(1) || "2.5"}
                          </div>
                        </div>
                        <div className="bg-stone-800/50 rounded-lg p-2.5 text-center border border-stone-700/30">
                          <div className="text-stone-500 text-[8px] tracking-widest uppercase font-mono">
                            MODEL PROB
                          </div>
                          <div className="text-base font-black font-mono text-yellow-400 mt-1">
                            {(bet.modelProb * 100).toFixed(1)}%
                          </div>
                        </div>
                      </div>

                      {/* Reasoning */}
                      <div className="bg-stone-800/30 border border-stone-700/40 rounded-lg px-3 py-2.5">
                        <div className="flex items-center gap-1.5 mb-1">
                          <span className="text-yellow-600 text-[8px]">▸</span>
                          <span className="text-[8px] text-yellow-600/80 tracking-[0.15em] uppercase font-mono font-bold">
                            {getIntelLabel(bet)}
                          </span>
                        </div>
                        <p className="text-stone-400 text-[11px] leading-relaxed font-mono">
                          {reasoning}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* ── HOW +EV IS CALCULATED (Explainer) ── */}
        <section className="bg-stone-900/80 border border-stone-800 rounded-xl overflow-hidden">
          <button
            onClick={() => setShowExplainer(!showExplainer)}
            className="w-full flex items-center justify-between px-5 py-4 hover:bg-stone-800/50 transition-colors"
          >
            <div>
              <span className="text-yellow-500 text-xs font-bold tracking-widest uppercase font-mono">
                HOW THIS PAGE WORKS
              </span>
              <p className="text-stone-600 text-[10px] font-mono mt-0.5">
                Understanding +EV betting and what each tier means
              </p>
            </div>
            <span className="text-stone-500 text-sm">
              {showExplainer ? "▲" : "▼"}
            </span>
          </button>
          {showExplainer && (
            <div className="px-4 pb-5 border-t border-stone-800 space-y-4 text-sm text-stone-300">
              <div className="pt-4">
                <p className="font-bold text-yellow-400 mb-1.5">💡 What does +EV actually mean?</p>
                <p className="text-stone-400 text-xs leading-relaxed">
                  +EV (positive expected value) means the sportsbook is offering odds that are{" "}
                  <span className="text-stone-200 font-semibold">better than they should be</span>{" "}
                  based on each fighter's real win probability. Think of it like a coin flip that
                  pays $1.10 but only costs $1 to play — even though you'll lose individual flips,
                  the math works in your favor over time.
                </p>
              </div>
              <div className="bg-stone-800/60 rounded-xl p-4 font-mono text-xs space-y-3">
                <p className="text-yellow-500 font-bold">HOW THE MODEL WORKS</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <p className="text-stone-400 leading-relaxed">
                    We start with the sharpest sportsbook lines (vig removed) to get a baseline,
                    then adjust using real UFCStats data:
                  </p>
                  <ul className="space-y-1 text-stone-400">
                    <li><span className="text-yellow-600 mr-1.5">▸</span>Striking volume &amp; accuracy differential</li>
                    <li><span className="text-yellow-600 mr-1.5">▸</span>Takedown game &amp; grappling edge</li>
                    <li><span className="text-yellow-600 mr-1.5">▸</span>Striking defense (damage absorbed)</li>
                    <li><span className="text-yellow-600 mr-1.5">▸</span>Finish rate &amp; knockout power</li>
                    <li><span className="text-yellow-600 mr-1.5">▸</span>Win streak momentum</li>
                  </ul>
                </div>
                <p className="text-stone-500 border-t border-stone-700 pt-2">
                  Formula: <span className="text-stone-300">EV% = (Model Probability × Decimal Odds) − 1</span>
                </p>
              </div>
              <div>
                <p className="font-bold text-yellow-400 mb-2">🎯 Reading the confidence tiers</p>
                <div className="space-y-2 text-xs">
                  <div className="flex items-start gap-3">
                    <span className="w-3 h-3 rounded-full bg-green-400 flex-shrink-0 mt-0.5 shadow-[0_0_6px_rgba(34,197,94,0.4)]" />
                    <div>
                      <span className="text-green-400 font-bold">ELITE EDGE / STRONG BET (+12%+)</span>
                      {" — "}
                      <span className="text-stone-400">Significant model-vs-market gap. These are the bets to prioritize.</span>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="w-3 h-3 rounded-full bg-amber-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <span className="text-amber-400 font-bold">GOOD VALUE (+6%+)</span>
                      {" — "}
                      <span className="text-stone-400">Solid edge with real statistical backing. Good for straight bets or parlay inclusions.</span>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="w-3 h-3 rounded-full bg-yellow-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <span className="text-yellow-500 font-bold">SLIGHT EDGE (+3%+)</span>
                      {" — "}
                      <span className="text-stone-400">Worth noting, best used as supplementary data alongside your own research.</span>
                    </div>
                  </div>
                </div>
              </div>
              <div className="bg-yellow-900/20 border border-yellow-700/40 rounded-lg p-3 text-xs text-yellow-300">
                <span className="font-bold">⚠ IMPORTANT:</span> +EV doesn't guarantee a win on any individual bet.
                It means that if you consistently bet at these prices, the math works in your favor over a large sample.
                Always bet within your means and treat this as one data point among many.
              </div>
            </div>
          )}
        </section>

        {/* ── CONFIDENCE LEGEND ── */}
        <div className="flex flex-wrap gap-6 justify-center text-[10px] tracking-wider uppercase text-stone-500 font-mono py-2">
          <span className="flex items-center gap-2">
            <span className="inline-block w-3.5 h-2 rounded-full bg-green-500 shadow-[0_0_6px_rgba(34,197,94,0.3)]" />
            ELITE / STRONG (+12%+)
          </span>
          <span className="flex items-center gap-2">
            <span className="inline-block w-3.5 h-2 rounded-full bg-amber-500" />
            GOOD VALUE (+6%+)
          </span>
          <span className="flex items-center gap-2">
            <span className="inline-block w-3.5 h-2 rounded-full bg-yellow-600" />
            SLIGHT EDGE (+3%+)
          </span>
        </div>
      </div>
    </div>
  );
};

export default ValueBets;
