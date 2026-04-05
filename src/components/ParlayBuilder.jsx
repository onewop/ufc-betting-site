import React, { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

// ─── Constants ────────────────────────────────────────────────────────────────
const ODDS_CACHE_KEY = "ufc_odds_cache_v3"; // same key as LatestOdds
const SAVED_PARLAYS_KEY = "combat_vault_saved_parlays_v1";
const AUTH_TOKEN_KEY = "authToken";

// Affiliate base URLs — deep-link to UFC section with tracking params.
// NOTE: True betslip pre-population requires DraftKings/FanDuel Partner API.
// These links open the correct sport with affiliate attribution; the "Place"
// modal gives users the exact picks to add manually, with a one-click copy.
const DK_BASE = "https://sportsbook.draftkings.com/sports/mma";
const FD_BASE = "https://sportsbook.fanduel.com/sports/mma";
const DK_AFF = "wpcid=COMBATVAULT&wpsrc=combat_vault_web&wpcn=ParlayBuilder";
const FD_AFF = "btag=a_COMBATVAULT_b_ParlayBuilder&WT.srch=1";

// ─── Parlay math ──────────────────────────────────────────────────────────────
const americanToDecimal = (n) => {
  const v = Number(n);
  if (!isFinite(v) || v === 0) return 1;
  return v >= 100 ? v / 100 + 1 : 100 / Math.abs(v) + 1;
};

const decimalToAmerican = (d) => {
  if (d <= 1) return 0;
  return d >= 2 ? Math.round((d - 1) * 100) : Math.round(-100 / (d - 1));
};

const calcParlay = (legs, stake) => {
  if (!legs.length) return { combined: 1, toWin: 0, total: 0, american: 0 };
  const combined = legs.reduce((acc, l) => acc * americanToDecimal(l.odds), 1);
  const total = stake * combined;
  return {
    combined,
    toWin: total - stake,
    total,
    american: decimalToAmerican(combined),
  };
};

// ─── Display helpers ──────────────────────────────────────────────────────────
const fmtOdds = (n) => (n == null ? "—" : n > 0 ? `+${n}` : `${n}`);
const fmtMoney = (n) => `$${Math.abs(n).toFixed(2)}`;
const oddsColor = (n) => (n > 0 ? "text-green-400" : "text-red-400");

// ─── Deep link helpers ────────────────────────────────────────────────────────
const buildDkLink = () => `${DK_BASE}?${DK_AFF}`;
const buildFdLink = () => `${FD_BASE}?${FD_AFF}`;

const legsToCopyText = (legs, stake, payout) => {
  const lines = legs.map(
    (l, i) => `${i + 1}. ${l.description}  ${fmtOdds(l.odds)}`,
  );
  return [
    `🥊 Combat Vault Parlay — ${legs.length} leg${legs.length !== 1 ? "s" : ""}`,
    ...lines,
    `---`,
    `Stake: $${stake}  |  To Win: ${fmtMoney(payout.toWin)}  |  Parlay Odds: ${fmtOdds(payout.american)}`,
    `via thecombatvault.com`,
  ].join("\n");
};

// ─── Placeholder fight data ───────────────────────────────────────────────────
// Shown when the odds API cache hasn't loaded or has expired.
// Props are added manually — the API only returns h2h + totals.
const PLACEHOLDER_FIGHTS = [
  {
    id: "f1",
    section: "Main Event",
    home: { name: "Jon Jones", ml: -580 },
    away: { name: "Stipe Miocic", ml: +420 },
    total: { point: 1.5, overOdds: -130, underOdds: +105 },
    props: [
      { id: "p1a", label: "Jones by KO/TKO", odds: -105 },
      { id: "p1b", label: "Jones by Decision", odds: +340 },
      { id: "p1c", label: "Miocic by KO/TKO", odds: +700 },
      { id: "p1d", label: "Goes to Decision", odds: -130 },
    ],
  },
  {
    id: "f2",
    section: "Co-Main Event",
    home: { name: "Charles Oliveira", ml: -165 },
    away: { name: "Michael Chandler", ml: +140 },
    total: { point: 1.5, overOdds: -140, underOdds: +115 },
    props: [
      { id: "p2a", label: "Finish in Rd 1", odds: +220 },
      { id: "p2b", label: "Finish in Rd 2", odds: +250 },
      { id: "p2c", label: "Goes to Decision", odds: +160 },
      { id: "p2d", label: "Oliveira by Sub", odds: +210 },
    ],
  },
  {
    id: "f3",
    section: "Main Card",
    home: { name: "Bo Nickal", ml: -500 },
    away: { name: "Paul Craig", ml: +370 },
    total: { point: 1.5, overOdds: -110, underOdds: -110 },
    props: [
      { id: "p3a", label: "Nickal by Sub", odds: +175 },
      { id: "p3b", label: "Nickal by KO/TKO", odds: +320 },
      { id: "p3c", label: "Craig by Sub", odds: +600 },
      { id: "p3d", label: "Goes to Decision", odds: +260 },
    ],
  },
  {
    id: "f4",
    section: "Main Card",
    home: { name: "Dustin Poirier", ml: +115 },
    away: { name: "Benoit Saint Denis", ml: -135 },
    total: { point: 1.5, overOdds: -120, underOdds: -100 },
    props: [
      { id: "p4a", label: "Finish inside distance", odds: -180 },
      { id: "p4b", label: "Goes to Decision", odds: +155 },
      { id: "p4c", label: "Poirier by KO/TKO", odds: +270 },
      { id: "p4d", label: "BSD by Sub", odds: +550 },
    ],
  },
  {
    id: "f5",
    section: "Prelims",
    home: { name: "Matt Frevola", ml: +130 },
    away: { name: "Ludovit Klein", ml: -155 },
    total: { point: 1.5, overOdds: -110, underOdds: -110 },
    props: [
      { id: "p5a", label: "KO/TKO finish", odds: -140 },
      { id: "p5b", label: "Submission finish", odds: +600 },
      { id: "p5c", label: "Goes to Decision", odds: +190 },
    ],
  },
  {
    id: "f6",
    section: "Prelims",
    home: { name: "Chris Weidman", ml: +170 },
    away: { name: "Eryk Anders", ml: -200 },
    total: { point: 1.5, overOdds: -115, underOdds: -105 },
    props: [
      { id: "p6a", label: "KO/TKO finish", odds: -120 },
      { id: "p6b", label: "Submission finish", odds: +450 },
      { id: "p6c", label: "Goes to Decision", odds: +170 },
    ],
  },
  {
    id: "f7",
    section: "Early Prelims",
    home: { name: "Yana Santos", ml: -145 },
    away: { name: "Julija Stoliarenko", ml: +120 },
    total: { point: 2.5, overOdds: -120, underOdds: -100 },
    props: [
      { id: "p7a", label: "Santos by KO/TKO", odds: +400 },
      { id: "p7b", label: "Santos by Decision", odds: +130 },
      { id: "p7c", label: "Submission finish", odds: +290 },
    ],
  },
];

// Transform The Odds API event into our flat fight format
const transformApiEvent = (event, idx) => {
  const dk =
    event.bookmakers?.find((b) => b.key === "draftkings") ||
    event.bookmakers?.[0];
  if (!dk) return null;
  const h2h = dk.markets?.find((m) => m.key === "h2h");
  const totals = dk.markets?.find((m) => m.key === "totals");
  if (!h2h?.outcomes?.length) return null;

  const [o1, o2] = h2h.outcomes;
  const over = totals?.outcomes?.find((o) => o.name === "Over");
  const under = totals?.outcomes?.find((o) => o.name === "Under");

  const section =
    idx === 0
      ? "Main Event"
      : idx === 1
        ? "Co-Main Event"
        : idx < 5
          ? "Main Card"
          : "Prelims";

  return {
    id: event.id || `api-${idx}`,
    section,
    home: { name: o1.name, ml: o1.price },
    away: { name: o2.name, ml: o2.price },
    total:
      over && under
        ? {
            point: over.point ?? 1.5,
            overOdds: over.price,
            underOdds: under.price,
          }
        : null,
    props: [],
  };
};

// ─── OddsChip ─────────────────────────────────────────────────────────────────
const OddsChip = ({ label, odds, active, onClick, size = "sm" }) => (
  <button
    onClick={onClick}
    className={`inline-flex flex-col items-center justify-center rounded border px-2 transition-all duration-150 select-none
      ${size === "sm" ? "py-1 min-w-[60px]" : "py-1.5 min-w-[72px]"}
      ${
        active
          ? "border-yellow-400 bg-yellow-400/15 text-yellow-300"
          : "border-stone-600 bg-stone-800 text-stone-300 hover:border-yellow-600 hover:bg-stone-700"
      }`}
  >
    <span className="text-[10px] leading-none text-stone-400 truncate max-w-full">
      {label}
    </span>
    <span
      className={`${size === "sm" ? "text-xs" : "text-sm"} font-bold mt-0.5 ${active ? "text-yellow-300" : oddsColor(odds)}`}
    >
      {fmtOdds(odds)}
    </span>
  </button>
);

// ─── FightRow ─────────────────────────────────────────────────────────────────
const FightRow = ({ fight, legs, onAdd, onRemove }) => {
  const [expanded, setExpanded] = useState(false);

  const isActive = (legId) => legs.some((l) => l.id === legId);
  const toggle = (leg) => (isActive(leg.id) ? onRemove(leg.id) : onAdd(leg));

  const makeMoneylineLeg = (fighter, odds) => ({
    id: `${fight.id}-ml-${fighter.replace(/\s/g, "")}`,
    fightId: fight.id,
    description: `${fighter} ML`,
    team: fighter,
    betType: "Moneyline",
    odds,
  });

  const makeTotalLeg = (side) => {
    const total = fight.total;
    const odds = side === "over" ? total.overOdds : total.underOdds;
    return {
      id: `${fight.id}-total-${side}`,
      fightId: fight.id,
      description: `${side === "over" ? "Over" : "Under"} ${total.point} Rds (${fight.home.name.split(" ").pop()} vs ${fight.away.name.split(" ").pop()})`,
      team: side === "over" ? "Over" : "Under",
      betType: `${side === "over" ? "Over" : "Under"} ${total.point} Rds`,
      odds,
    };
  };

  const makePropLeg = (prop) => ({
    id: `${fight.id}-prop-${prop.id}`,
    fightId: fight.id,
    description: `${prop.label} (${fight.home.name.split(" ").pop()} vs ${fight.away.name.split(" ").pop()})`,
    team: prop.label,
    betType: "Prop",
    odds: prop.odds,
  });

  const sectionColor =
    {
      "Main Event": "border-l-yellow-400",
      "Co-Main Event": "border-l-amber-500",
      "Main Card": "border-l-stone-400",
      Prelims: "border-l-stone-600",
      "Early Prelims": "border-l-stone-700",
    }[fight.section] || "border-l-stone-600";

  return (
    <div
      className={`bg-stone-900 border border-stone-700 border-l-4 ${sectionColor} rounded-lg overflow-hidden`}
    >
      {/* Fight header */}
      <div className="px-3 pt-2 pb-1 flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-widest text-stone-500 font-semibold">
          {fight.section}
        </span>
      </div>

      {/* Main matchup row */}
      <div className="px-3 pb-3">
        <div className="flex flex-wrap gap-2 items-end justify-between">
          {/* Home fighter */}
          <div className="flex flex-col gap-1 items-start min-w-0">
            <span className="text-sm font-semibold text-stone-100 truncate">
              {fight.home.name}
            </span>
            <OddsChip
              label="Moneyline"
              odds={fight.home.ml}
              active={isActive(
                `${fight.id}-ml-${fight.home.name.replace(/\s/g, "")}`,
              )}
              onClick={() =>
                toggle(makeMoneylineLeg(fight.home.name, fight.home.ml))
              }
            />
          </div>

          <span className="text-stone-600 font-bold text-xs self-center pb-1">
            vs
          </span>

          {/* Away fighter */}
          <div className="flex flex-col gap-1 items-end min-w-0">
            <span className="text-sm font-semibold text-stone-100 truncate text-right">
              {fight.away.name}
            </span>
            <OddsChip
              label="Moneyline"
              odds={fight.away.ml}
              active={isActive(
                `${fight.id}-ml-${fight.away.name.replace(/\s/g, "")}`,
              )}
              onClick={() =>
                toggle(makeMoneylineLeg(fight.away.name, fight.away.ml))
              }
            />
          </div>
        </div>

        {/* Totals row */}
        {fight.total && (
          <div className="mt-2 flex gap-2 flex-wrap">
            <OddsChip
              label={`O ${fight.total.point}`}
              odds={fight.total.overOdds}
              active={isActive(`${fight.id}-total-over`)}
              onClick={() => toggle(makeTotalLeg("over"))}
            />
            <OddsChip
              label={`U ${fight.total.point}`}
              odds={fight.total.underOdds}
              active={isActive(`${fight.id}-total-under`)}
              onClick={() => toggle(makeTotalLeg("under"))}
            />
            {fight.props.length > 0 && (
              <button
                onClick={() => setExpanded((e) => !e)}
                className="text-[11px] text-stone-400 hover:text-yellow-400 transition ml-auto self-center"
              >
                {expanded ? "Hide props ▲" : `Props (${fight.props.length}) ▼`}
              </button>
            )}
          </div>
        )}

        {/* Props section */}
        <AnimatePresence>
          {expanded && fight.props.length > 0 && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="mt-2 pt-2 border-t border-stone-700 flex flex-wrap gap-2">
                {fight.props.map((prop) => (
                  <OddsChip
                    key={prop.id}
                    label={prop.label}
                    odds={prop.odds}
                    active={isActive(`${fight.id}-prop-${prop.id}`)}
                    onClick={() => toggle(makePropLeg(prop))}
                    size="md"
                  />
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

// ─── ParlaySlip ───────────────────────────────────────────────────────────────
const ParlaySlip = ({
  legs,
  stake,
  onStakeChange,
  onRemoveLeg,
  onPlaceDk,
  onPlaceFd,
  onSave,
  saveStatus,
  currentUser,
}) => {
  const payout = calcParlay(legs, stake);
  const hasLegs = legs.length > 0;

  return (
    <div className="bg-stone-900 border border-stone-700 rounded-xl overflow-hidden flex flex-col">
      {/* Slip header */}
      <div className="bg-gradient-to-r from-amber-900/50 to-stone-900 px-4 py-3 border-b border-stone-700 flex items-center justify-between">
        <span className="font-bold text-stone-100 text-sm tracking-wide uppercase">
          Parlay Slip
        </span>
        {hasLegs && (
          <span className="bg-yellow-500 text-stone-900 text-xs font-black px-2 py-0.5 rounded-full">
            {legs.length} leg{legs.length !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      <div className="flex-1 p-4 flex flex-col gap-4">
        {/* Empty state */}
        {!hasLegs && (
          <div className="text-center py-8">
            <div className="text-4xl mb-3">🥊</div>
            <p className="text-stone-400 text-sm">
              Select odds from any fight to start building your parlay.
            </p>
          </div>
        )}

        {/* Legs list */}
        <AnimatePresence initial={false}>
          {legs.map((leg) => (
            <motion.div
              key={leg.id}
              initial={{ opacity: 0, x: 20, height: 0 }}
              animate={{ opacity: 1, x: 0, height: "auto" }}
              exit={{ opacity: 0, x: -20, height: 0 }}
              transition={{ duration: 0.18 }}
              className="flex items-start justify-between gap-2 py-2 border-b border-stone-800 last:border-0"
            >
              <div className="min-w-0 flex-1">
                <p className="text-stone-100 text-xs font-semibold truncate">
                  {leg.description}
                </p>
                <p className="text-stone-500 text-[10px] mt-0.5">
                  {leg.betType}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className={`text-sm font-bold ${oddsColor(leg.odds)}`}>
                  {fmtOdds(leg.odds)}
                </span>
                <button
                  onClick={() => onRemoveLeg(leg.id)}
                  className="text-stone-600 hover:text-red-400 transition text-base leading-none"
                  aria-label="Remove leg"
                >
                  ×
                </button>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Stake + payout */}
        {hasLegs && (
          <div className="bg-stone-800/60 rounded-lg p-3 flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <label className="text-stone-400 text-xs whitespace-nowrap">
                Stake ($)
              </label>
              <input
                type="number"
                min="1"
                max="10000"
                step="1"
                value={stake}
                onChange={(e) =>
                  onStakeChange(Math.max(1, Number(e.target.value)))
                }
                className="flex-1 bg-stone-900 border border-stone-600 rounded px-2 py-1.5 text-stone-100 text-sm focus:outline-none focus:border-yellow-500 min-w-0"
              />
            </div>
            <div className="grid grid-cols-2 gap-2 text-center">
              <div className="bg-stone-900 rounded px-2 py-2">
                <p className="text-[10px] text-stone-500 uppercase tracking-wider">
                  Parlay Odds
                </p>
                <p
                  className={`text-base font-black mt-0.5 ${payout.american > 0 ? "text-green-400" : "text-red-400"}`}
                >
                  {fmtOdds(payout.american)}
                </p>
              </div>
              <div className="bg-stone-900 rounded px-2 py-2">
                <p className="text-[10px] text-stone-500 uppercase tracking-wider">
                  To Win
                </p>
                <p className="text-base font-black mt-0.5 text-yellow-400">
                  {fmtMoney(payout.toWin)}
                </p>
              </div>
            </div>
            <div className="flex justify-between items-center text-xs text-stone-400 border-t border-stone-700 pt-2">
              <span>Stake: ${stake.toFixed(2)}</span>
              <span className="font-semibold text-stone-200">
                Total return: {fmtMoney(payout.total)}
              </span>
            </div>
          </div>
        )}

        {/* CTA Buttons */}
        {hasLegs && (
          <div className="flex flex-col gap-2 mt-1">
            <button
              onClick={onPlaceDk}
              className="w-full py-3 rounded-lg font-bold text-sm tracking-wide text-white transition active:scale-95"
              style={{
                background: "linear-gradient(135deg, #1a3a6c 0%, #0e2548 100%)",
                border: "1px solid #2a5aaa",
              }}
            >
              <span className="mr-2">🏆</span>
              Place on DraftKings
            </button>
            <button
              onClick={onPlaceFd}
              className="w-full py-3 rounded-lg font-bold text-sm tracking-wide text-white transition active:scale-95"
              style={{
                background: "linear-gradient(135deg, #1a6c3a 0%, #0e4824 100%)",
                border: "1px solid #2aaa5a",
              }}
            >
              <span className="mr-2">🏆</span>
              Place on FanDuel
            </button>
            <button
              onClick={onSave}
              disabled={saveStatus === "saving"}
              className={`w-full py-2.5 rounded-lg font-semibold text-sm tracking-wide transition active:scale-95 border
                ${
                  saveStatus === "saved"
                    ? "bg-green-900/40 border-green-600 text-green-400"
                    : saveStatus === "error"
                      ? "bg-red-900/40 border-red-600 text-red-400"
                      : "bg-stone-800 border-stone-600 text-stone-200 hover:border-amber-600 hover:text-amber-300"
                }`}
            >
              {saveStatus === "saving"
                ? "Saving…"
                : saveStatus === "saved"
                  ? "✓ Saved!"
                  : saveStatus === "error"
                    ? "Save failed — try again"
                    : currentUser
                      ? "💾 Save Parlay to Account"
                      : "💾 Save Parlay (local)"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

// ─── PlacingModal ─────────────────────────────────────────────────────────────
const PlacingModal = ({ target, legs, stake, onClose }) => {
  const [copied, setCopied] = useState(false);
  const payout = calcParlay(legs, stake);
  const url = target === "dk" ? buildDkLink() : buildFdLink();
  const bookName = target === "dk" ? "DraftKings" : "FanDuel";
  const bookColor = target === "dk" ? "#1a4fa0" : "#1a8a40";
  const text = legsToCopyText(legs, stake, payout);

  const handleCopy = () => {
    navigator.clipboard
      .writeText(text)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      })
      .catch(() => {
        /* fallback silent */
      });
  };

  const handleGo = () => {
    window.open(url, "_blank", "noopener,noreferrer");
    onClose();
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
        onClick={(e) => e.target === e.currentTarget && onClose()}
      >
        <motion.div
          initial={{ y: 40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 40, opacity: 0 }}
          className="w-full max-w-md bg-stone-900 border border-stone-700 rounded-2xl overflow-hidden"
        >
          {/* Header */}
          <div
            className="px-5 py-4 flex items-center justify-between"
            style={{
              background: `linear-gradient(135deg, ${bookColor}33, #1c1917)`,
            }}
          >
            <div>
              <p className="text-stone-400 text-xs uppercase tracking-widest">
                Ready to place on
              </p>
              <h3 className="text-xl font-black text-white">{bookName}</h3>
            </div>
            <button
              onClick={onClose}
              className="text-stone-400 hover:text-stone-100 text-2xl leading-none transition"
            >
              ×
            </button>
          </div>

          <div className="p-5 flex flex-col gap-4">
            {/* Parlay summary */}
            <div className="bg-stone-800 rounded-lg p-3 flex flex-col gap-2">
              {legs.map((l, i) => (
                <div
                  key={l.id}
                  className="flex items-center justify-between text-sm"
                >
                  <span className="text-stone-200">
                    <span className="text-stone-500 mr-1.5">{i + 1}.</span>
                    {l.description}
                  </span>
                  <span
                    className={`font-bold ml-2 shrink-0 ${oddsColor(l.odds)}`}
                  >
                    {fmtOdds(l.odds)}
                  </span>
                </div>
              ))}
              <div className="border-t border-stone-700 mt-1 pt-2 flex justify-between text-xs text-stone-400">
                <span>Stake: ${stake}</span>
                <span className="text-yellow-400 font-semibold">
                  To win: {fmtMoney(payout.toWin)}
                </span>
              </div>
            </div>

            <p className="text-stone-400 text-xs text-center leading-relaxed">
              Copy your picks below, then open {bookName} and add each leg to
              your bet slip.
            </p>

            {/* Copy button */}
            <button
              onClick={handleCopy}
              className={`w-full py-2.5 rounded-lg font-semibold text-sm border transition active:scale-95
                ${
                  copied
                    ? "bg-green-900/40 border-green-500 text-green-400"
                    : "bg-stone-800 border-stone-600 text-stone-200 hover:border-yellow-500 hover:text-yellow-300"
                }`}
            >
              {copied ? "✓ Copied to clipboard!" : "📋 Copy picks to clipboard"}
            </button>

            {/* Go button */}
            <button
              onClick={handleGo}
              className="w-full py-3 rounded-xl font-black text-base text-white transition active:scale-95"
              style={{
                background: `linear-gradient(135deg, ${bookColor}, ${bookColor}99)`,
                border: `1px solid ${bookColor}`,
              }}
            >
              Open {bookName} →
            </button>
          </div>

          <div className="px-5 pb-4 text-center text-[10px] text-stone-600 leading-relaxed">
            18+ only. Gambling problem? Call 1-800-GAMBLER. Must be in a legal
            sports betting state. Combat Vault earns a referral fee if you sign
            up via this link.
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

// ─── SaveNameModal ────────────────────────────────────────────────────────────
const SaveNameModal = ({ onConfirm, onClose }) => {
  const [name, setName] = useState("");
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ scale: 0.92, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="w-full max-w-sm bg-stone-900 border border-stone-700 rounded-xl p-6 flex flex-col gap-4"
      >
        <h3 className="font-bold text-stone-100 text-lg">Name this parlay</h3>
        <input
          ref={inputRef}
          type="text"
          maxLength={80}
          placeholder="e.g. Jones Nickal 2-legger"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) =>
            e.key === "Enter" && name.trim() && onConfirm(name.trim())
          }
          className="bg-stone-800 border border-stone-600 rounded-lg px-3 py-2.5 text-stone-100 text-sm focus:outline-none focus:border-yellow-500"
        />
        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 py-2 rounded-lg border border-stone-600 text-stone-400 text-sm hover:text-stone-200 transition"
          >
            Cancel
          </button>
          <button
            onClick={() => name.trim() && onConfirm(name.trim())}
            disabled={!name.trim()}
            className="flex-1 py-2 rounded-lg bg-amber-700 hover:bg-amber-600 disabled:opacity-40 text-white font-semibold text-sm transition"
          >
            Save
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
};

// ─── ParlayBuilder (main) ─────────────────────────────────────────────────────
export default function ParlayBuilder({ currentUser }) {
  const [fights, setFights] = useState(PLACEHOLDER_FIGHTS);
  const [loadingOdds, setLoadingOdds] = useState(true);
  const [usingLive, setUsingLive] = useState(false);
  const [legs, setLegs] = useState([]);
  const [stake, setStake] = useState(10);
  const [activeTab, setActiveTab] = useState("picks"); // mobile tab
  const [placingTarget, setPlacingTarget] = useState(null); // "dk" | "fd"
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [saveStatus, setSaveStatus] = useState("idle"); // idle | saving | saved | error

  // Try to load live odds from existing LatestOdds cache
  useEffect(() => {
    try {
      const cached = JSON.parse(localStorage.getItem(ODDS_CACHE_KEY));
      if (
        cached?.data &&
        Array.isArray(cached.data) &&
        cached.data.length > 0
      ) {
        const transformed = cached.data
          .map(transformApiEvent)
          .filter(Boolean)
          .slice(0, 10);
        if (transformed.length > 0) {
          setFights(transformed);
          setUsingLive(true);
        }
      }
    } catch {
      // Use placeholder
    } finally {
      setLoadingOdds(false);
    }
  }, []);

  const addLeg = useCallback((leg) => {
    // Prevent conflicting same-fight moneyline (both fighters)
    setLegs((prev) => {
      const sameMarket = prev.filter(
        (l) =>
          l.fightId === leg.fightId &&
          l.betType === leg.betType &&
          (leg.betType === "Moneyline" ||
            leg.betType.startsWith("Over") ||
            leg.betType.startsWith("Under")),
      );
      const filtered =
        sameMarket.length > 0
          ? prev.filter(
              (l) =>
                !(
                  l.fightId === leg.fightId &&
                  l.betType === leg.betType &&
                  (leg.betType === "Moneyline" ||
                    leg.betType.startsWith("Over") ||
                    leg.betType.startsWith("Under"))
                ),
            )
          : prev;
      return [...filtered, leg];
    });
    setActiveTab("picks"); // keep on picks tab, slip updates in panel
  }, []);

  const removeLeg = useCallback((legId) => {
    setLegs((prev) => prev.filter((l) => l.id !== legId));
  }, []);

  const handleSave = async (name) => {
    setSaveStatus("saving");
    setShowSaveModal(false);
    const token = localStorage.getItem(AUTH_TOKEN_KEY);

    if (currentUser && token) {
      // Save to backend — reuse lineups endpoint with salary_mode: "parlay"
      try {
        const res = await fetch("http://localhost:8000/api/lineups", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            name,
            lineup_data: legs,
            total_salary: 0,
            projected_fpts: 0,
            salary_mode: "parlay",
          }),
        });
        if (!res.ok) throw new Error("Server error");
        setSaveStatus("saved");
      } catch {
        setSaveStatus("error");
      }
    } else {
      // Save to localStorage for guests
      try {
        const existing = JSON.parse(
          localStorage.getItem(SAVED_PARLAYS_KEY) || "[]",
        );
        const newParlay = {
          id: `${Date.now()}-${Math.random().toString(16).slice(2, 6)}`,
          name,
          legs,
          stake,
          savedAt: new Date().toISOString(),
        };
        localStorage.setItem(
          SAVED_PARLAYS_KEY,
          JSON.stringify([newParlay, ...existing].slice(0, 20)),
        );
        setSaveStatus("saved");
      } catch {
        setSaveStatus("error");
      }
    }

    setTimeout(() => setSaveStatus("idle"), 3000);
  };

  const payout = calcParlay(legs, stake);
  const hasLegs = legs.length > 0;

  // Group fights by section
  const sections = fights.reduce((acc, f) => {
    if (!acc[f.section]) acc[f.section] = [];
    acc[f.section].push(f);
    return acc;
  }, {});
  const sectionOrder = [
    "Main Event",
    "Co-Main Event",
    "Main Card",
    "Prelims",
    "Early Prelims",
  ];

  return (
    <>
      <div className="min-h-screen bg-gray-900 text-stone-100">
        {/* Page header */}
        <div
          className="border-b border-yellow-900/40 px-4 py-5"
          style={{
            background: "linear-gradient(180deg, #451a03 0%, #1c1917 100%)",
          }}
        >
          <div className="max-w-6xl mx-auto">
            <div className="flex flex-wrap items-end gap-3 justify-between">
              <div>
                <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                  Parlay Builder
                </h1>
                <p className="text-stone-400 text-sm mt-1">
                  Pick your legs · Calculate your payout · Place on DK or
                  FanDuel
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={`text-[11px] px-2 py-0.5 rounded-full font-semibold border ${
                    usingLive
                      ? "text-green-400 border-green-600 bg-green-950"
                      : "text-stone-400 border-stone-600 bg-stone-800"
                  }`}
                >
                  {usingLive ? "● Live odds" : "● Placeholder odds"}
                </span>
                {!usingLive && (
                  <span className="text-[10px] text-stone-500">
                    Visit Live Odds to load real data
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-6xl mx-auto px-3 sm:px-4 py-4">
          {/* Mobile tab bar */}
          <div className="lg:hidden flex rounded-lg overflow-hidden border border-stone-700 mb-4">
            <button
              onClick={() => setActiveTab("picks")}
              className={`flex-1 py-2.5 text-sm font-semibold transition ${
                activeTab === "picks"
                  ? "bg-amber-800 text-white"
                  : "bg-stone-800 text-stone-400 hover:text-stone-200"
              }`}
            >
              Pick Fights
            </button>
            <button
              onClick={() => setActiveTab("slip")}
              className={`flex-1 py-2.5 text-sm font-semibold transition relative ${
                activeTab === "slip"
                  ? "bg-amber-800 text-white"
                  : "bg-stone-800 text-stone-400 hover:text-stone-200"
              }`}
            >
              Parlay Slip
              {hasLegs && (
                <span className="ml-1.5 inline-flex items-center justify-center w-4 h-4 bg-yellow-500 text-stone-900 text-[9px] font-black rounded-full">
                  {legs.length}
                </span>
              )}
            </button>
          </div>

          <div className="flex flex-col lg:flex-row gap-4">
            {/* Fight selection panel */}
            <div
              className={`flex-1 min-w-0 ${activeTab === "slip" ? "hidden lg:block" : ""}`}
            >
              <div className="flex flex-col gap-3">
                {sectionOrder
                  .filter((s) => sections[s])
                  .map((sectionName) => (
                    <div key={sectionName}>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs font-bold uppercase tracking-widest text-stone-500">
                          {sectionName}
                        </span>
                        <div className="flex-1 h-px bg-stone-800" />
                      </div>
                      <div className="flex flex-col gap-2">
                        {sections[sectionName].map((fight) => (
                          <FightRow
                            key={fight.id}
                            fight={fight}
                            legs={legs}
                            onAdd={addLeg}
                            onRemove={removeLeg}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
              </div>
            </div>

            {/* Parlay slip panel — sticky on desktop */}
            <div
              className={`w-full lg:w-80 xl:w-96 shrink-0 ${
                activeTab === "picks" ? "hidden lg:block" : ""
              }`}
            >
              <div className="lg:sticky lg:top-24">
                <ParlaySlip
                  legs={legs}
                  stake={stake}
                  onStakeChange={setStake}
                  onRemoveLeg={removeLeg}
                  onPlaceDk={() => setPlacingTarget("dk")}
                  onPlaceFd={() => setPlacingTarget("fd")}
                  onSave={() => hasLegs && setShowSaveModal(true)}
                  saveStatus={saveStatus}
                  currentUser={currentUser}
                />
              </div>
            </div>
          </div>

          {/* Responsible gambling footer */}
          <div className="mt-8 py-4 border-t border-stone-800 text-center text-xs text-stone-600 leading-relaxed">
            <p className="font-semibold text-stone-500 mb-1">
              Responsible Gambling
            </p>
            <p>
              Must be 18+ and located in a state where sports betting is legal.
              Parlay odds are calculated from displayed lines and may differ
              from actual sportsbook odds at time of placement. Always gamble
              responsibly. If you or someone you know has a gambling problem,
              call the National Problem Gambling Helpline:{" "}
              <span className="text-stone-400 font-semibold">
                1-800-522-4700
              </span>
              .
            </p>
            <p className="mt-1.5 text-stone-700">
              Combat Vault may earn a commission from DraftKings and FanDuel
              when you sign up or deposit via our links. This does not affect
              the odds or promotions shown to you.
            </p>
          </div>
        </div>
      </div>

      {/* Mobile sticky CTA when legs are selected */}
      {hasLegs && activeTab === "picks" && (
        <div className="lg:hidden fixed bottom-0 left-0 right-0 z-50 px-3 pb-[calc(env(safe-area-inset-bottom)+64px)] pt-3 bg-stone-950/95 border-t border-stone-800 backdrop-blur">
          <button
            onClick={() => setActiveTab("slip")}
            className="w-full py-3 rounded-xl font-black text-base text-stone-900 bg-yellow-400 hover:bg-yellow-300 transition active:scale-95"
          >
            View Slip ({legs.length} leg{legs.length !== 1 ? "s" : ""}) —{" "}
            {fmtOdds(payout.american)}
          </button>
        </div>
      )}

      {/* Placing modal */}
      {placingTarget && (
        <PlacingModal
          target={placingTarget}
          legs={legs}
          stake={stake}
          onClose={() => setPlacingTarget(null)}
        />
      )}

      {/* Save name modal */}
      <AnimatePresence>
        {showSaveModal && (
          <SaveNameModal
            onConfirm={handleSave}
            onClose={() => setShowSaveModal(false)}
          />
        )}
      </AnimatePresence>
    </>
  );
}
