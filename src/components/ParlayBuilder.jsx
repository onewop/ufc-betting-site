import React, { useState, useEffect, useCallback, useRef } from "react";
import api from "../services/api";
import { motion, AnimatePresence } from "framer-motion";
import WelcomeBonusSelector from "./WelcomeBonusSelector";
import { isPro as checkIsPro } from "../utils/devAccess";

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
// Shown only when the odds API cache hasn't loaded yet. These are the current
// card (UFC Fight Night — April 25, 2026) with estimated lines.
// Update this block each week if you want an accurate offline fallback.
const PLACEHOLDER_FIGHTS = [
  {
    id: "f1",
    section: "Main Event",
    home: { name: "Youssef Zalal", ml: -140 },
    away: { name: "Aljamain Sterling", ml: +118 },
    total: { point: 2.5, overOdds: -120, underOdds: -110 },
    props: [],
  },
  {
    id: "f2",
    section: "Co-Main Event",
    home: { name: "Norma Dumont", ml: -200 },
    away: { name: "Joselyne Edwards", ml: +165 },
    total: { point: 2.5, overOdds: -155, underOdds: +125 },
    props: [],
  },
  {
    id: "f3",
    section: "Main Card",
    home: { name: "Alexander Hernandez", ml: -160 },
    away: { name: "Rafa Garcia", ml: +132 },
    total: { point: 1.5, overOdds: -195, underOdds: +155 },
    props: [],
  },
  {
    id: "f4",
    section: "Main Card",
    home: { name: "Montel Jackson", ml: -185 },
    away: { name: "Raoni Barcelos", ml: +150 },
    total: { point: 2.5, overOdds: -145, underOdds: +115 },
    props: [],
  },
  {
    id: "f5",
    section: "Main Card",
    home: { name: "Marcus Buchecha", ml: -150 },
    away: { name: "Ryan Spann", ml: +126 },
    total: { point: 1.5, overOdds: -300, underOdds: +230 },
    props: [],
  },
  {
    id: "f6",
    section: "Main Card",
    home: { name: "Juan Adrian Martinetti", ml: -130 },
    away: { name: "Davey Grant", ml: +108 },
    total: { point: 2.5, overOdds: -200, underOdds: +160 },
    props: [],
  },
  {
    id: "f7",
    section: "Prelims",
    home: { name: "Jackson McVey", ml: -190 },
    away: { name: "Sedriques Dumas", ml: +155 },
    total: { point: 1.5, overOdds: -220, underOdds: +170 },
    props: [],
  },
  {
    id: "f8",
    section: "Prelims",
    home: { name: "Rodolfo Vieira", ml: -280 },
    away: { name: "Eric McConico", ml: +225 },
    total: { point: 1.5, overOdds: -320, underOdds: +245 },
    props: [],
  },
  {
    id: "f9",
    section: "Prelims",
    home: { name: "Julia Polastri", ml: -250 },
    away: { name: "Talita Alencar", ml: +200 },
    total: { point: 1.5, overOdds: -280, underOdds: +215 },
    props: [],
  },
  {
    id: "f10",
    section: "Prelims",
    home: { name: "Michelle Montague", ml: -180 },
    away: { name: "Mayra Bueno Silva", ml: +148 },
    total: { point: 2.5, overOdds: -200, underOdds: +160 },
    props: [],
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
                    : currentUser && checkIsPro(currentUser)
                      ? "💾 Save Parlay to Account"
                      : "🔒 Pro — Save Parlay"}
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

// ─── Recommended Parlays — generated dynamically from the loaded fights ───────
// Built from whatever fights are currently in state (live or placeholder).
// Returns up to 5 parlay ideas using fighters actually on this week's card.
const buildRecommendedParlays = (fights) => {
  const withOdds = fights.filter(
    (f) =>
      f.home?.ml &&
      f.away?.ml &&
      Number.isFinite(f.home.ml) &&
      Number.isFinite(f.away.ml) &&
      f.home.ml !== 0 &&
      f.away.ml !== 0,
  );
  if (withOdds.length < 2) return [];

  // American odds → decimal multiplier
  const toDecimal = (n) => (n >= 100 ? n / 100 + 1 : 100 / Math.abs(n) + 1);

  // Returns the favorite (lowest decimal odds = best implied probability)
  const favoriteOf = (f) =>
    toDecimal(f.home.ml) <= toDecimal(f.away.ml)
      ? { name: f.home.name, odds: f.home.ml }
      : { name: f.away.name, odds: f.away.ml };

  // Returns the underdog
  const underdogOf = (f) =>
    toDecimal(f.home.ml) > toDecimal(f.away.ml)
      ? { name: f.home.name, odds: f.home.ml }
      : { name: f.away.name, odds: f.away.ml };

  const mainCard = withOdds.filter((f) =>
    ["Main Event", "Co-Main Event", "Main Card"].includes(f.section),
  );
  const allSorted = [
    ...mainCard,
    ...withOdds.filter((f) => !mainCard.includes(f)),
  ];

  const parlays = [];

  // 1. Top 3 card favorites
  if (allSorted.length >= 3) {
    parlays.push({
      id: "rp-1",
      name: "Card Favorites",
      badge: "🔥 Top Pick",
      badgeColor: "bg-yellow-600 text-yellow-100",
      description: "Stack the top three favorites from this week's card.",
      legs: allSorted.slice(0, 3).map((f) => ({
        description: `${favoriteOf(f).name} ML`,
        odds: favoriteOf(f).odds,
      })),
    });
  }

  // 2. Two heaviest favorites (sorted by most negative / lowest decimal odds)
  const byFavStrength = [...allSorted].sort(
    (a, b) => toDecimal(favoriteOf(a).odds) - toDecimal(favoriteOf(b).odds),
  );
  if (byFavStrength.length >= 2) {
    parlays.push({
      id: "rp-2",
      name: "Heavy Favorites",
      badge: "💰 Safer Play",
      badgeColor: "bg-blue-700 text-blue-100",
      description:
        "Two of the card's biggest favorites for a lower-risk return.",
      legs: byFavStrength.slice(0, 2).map((f) => ({
        description: `${favoriteOf(f).name} ML`,
        odds: favoriteOf(f).odds,
      })),
    });
  }

  // 3. Two best-value underdogs (highest positive ML first)
  const byUnderdogValue = [...allSorted].sort(
    (a, b) => underdogOf(b).odds - underdogOf(a).odds,
  );
  if (byUnderdogValue.length >= 2) {
    parlays.push({
      id: "rp-3",
      name: "Underdog Value Play",
      badge: "💎 High Upside",
      badgeColor: "bg-emerald-700 text-emerald-100",
      description: "Two underdogs with realistic paths to victory.",
      legs: byUnderdogValue.slice(0, 2).map((f) => ({
        description: `${underdogOf(f).name} ML`,
        odds: underdogOf(f).odds,
      })),
    });
  }

  // 4. Main event + co-main favorites (or top-2 fights)
  const mainEvent = withOdds.find((f) => f.section === "Main Event");
  const coMain = withOdds.find((f) => f.section === "Co-Main Event");
  const headliners = [mainEvent, coMain].filter(Boolean);
  if (headliners.length >= 2) {
    parlays.push({
      id: "rp-4",
      name: "Headline Parlay",
      badge: "⚡ Staff Pick",
      badgeColor: "bg-purple-700 text-purpleged-100",
      description: "Favorites from the main and co-main events.",
      legs: headliners.map((f) => ({
        description: `${favoriteOf(f).name} ML`,
        odds: favoriteOf(f).odds,
      })),
    });
  } else if (allSorted.length >= 2) {
    parlays.push({
      id: "rp-4",
      name: "2-Leg Special",
      badge: "⚡ Staff Pick",
      badgeColor: "bg-purple-700 text-purple-100",
      description: "Two solid picks from this week's card.",
      legs: allSorted.slice(0, 2).map((f) => ({
        description: `${favoriteOf(f).name} ML`,
        odds: favoriteOf(f).odds,
      })),
    });
  }

  // 5. Mixed: main card favorite + prelim underdog
  const mainFav = mainCard[0] ? favoriteOf(mainCard[0]) : null;
  const prelimDog = withOdds.find(
    (f) => f.section === "Prelims" && underdogOf(f).odds > 0,
  );
  if (mainFav && prelimDog) {
    parlays.push({
      id: "rp-5",
      name: "Fav + Dog Combo",
      badge: "🎯 Value Mix",
      badgeColor: "bg-orange-700 text-orange-100",
      description: "A top main card pick paired with a prelim value underdog.",
      legs: [
        { description: `${mainFav.name} ML`, odds: mainFav.odds },
        {
          description: `${underdogOf(prelimDog).name} ML`,
          odds: underdogOf(prelimDog).odds,
        },
      ],
    });
  }

  return parlays.filter((p) => p.legs.length > 0);
};

const RecommendedParlays = ({ fights, onAddAll }) => {
  const [expanded, setExpanded] = useState(null);
  const parlays = buildRecommendedParlays(fights);

  if (parlays.length === 0) return null;

  return (
    <div className="mb-6">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xs font-bold uppercase tracking-widest text-yellow-500">
          ⭐ Recommended Parlays
        </span>
        <div className="flex-1 h-px bg-stone-700" />
        <span className="text-[10px] text-stone-500 italic">
          This week's card
        </span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
        {parlays.map((p) => {
          const combined = p.legs.reduce(
            (acc, l) => acc * americanToDecimal(l.odds),
            1,
          );
          const american = decimalToAmerican(combined);
          const isOpen = expanded === p.id;
          return (
            <div
              key={p.id}
              className="bg-stone-900 border border-stone-700 rounded-xl overflow-hidden hover:border-yellow-700/60 transition-colors"
            >
              <button
                className="w-full text-left px-4 py-3"
                onClick={() => setExpanded(isOpen ? null : p.id)}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="font-bold text-stone-100 text-sm">
                        {p.name}
                      </span>
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${p.badgeColor}`}
                      >
                        {p.badge}
                      </span>
                    </div>
                    <p className="text-stone-500 text-xs leading-snug">
                      {p.description}
                    </p>
                  </div>
                  <div className="text-right shrink-0 ml-2">
                    <div
                      className={`text-lg font-black ${american > 0 ? "text-green-400" : "text-red-400"}`}
                    >
                      {american > 0 ? `+${american}` : american}
                    </div>
                    <div className="text-[10px] text-stone-500">
                      {p.legs.length} legs
                    </div>
                  </div>
                </div>
              </button>
              {isOpen && (
                <div className="px-4 pb-3 border-t border-stone-800">
                  <div className="space-y-1.5 my-2">
                    {p.legs.map((leg, i) => (
                      <div
                        key={i}
                        className="flex justify-between items-center text-xs"
                      >
                        <span className="text-stone-300 truncate pr-2">
                          <span className="text-stone-500 mr-1">{i + 1}.</span>
                          {leg.description}
                        </span>
                        <span
                          className={`font-bold shrink-0 ${leg.odds > 0 ? "text-green-400" : "text-red-400"}`}
                        >
                          {leg.odds > 0 ? `+${leg.odds}` : leg.odds}
                        </span>
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={() => onAddAll(p.legs)}
                    className="w-full mt-2 py-2 rounded-lg bg-yellow-600 hover:bg-yellow-500 text-stone-900 font-bold text-xs transition active:scale-95"
                  >
                    Add All Legs to Slip
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ─── ParlayBuilder (main) ─────────────────────────────────────────────────────
export default function ParlayBuilder({ currentUser }) {
  const isPro = checkIsPro(currentUser);
  const [fights, setFights] = useState(PLACEHOLDER_FIGHTS);
  const [loadingOdds, setLoadingOdds] = useState(true);
  const [usingLive, setUsingLive] = useState(false);
  const [legs, setLegs] = useState([]);
  const [stake, setStake] = useState(10);
  const [activeTab, setActiveTab] = useState("picks"); // mobile tab
  const [placingTarget, setPlacingTarget] = useState(null); // "dk" | "fd"
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [saveStatus, setSaveStatus] = useState("idle"); // idle | saving | saved | error
  const [dkFighters, setDkFighters] = useState([]);
  // dkLoaded gates the odds effect so we never filter before names are ready
  const [dkLoaded, setDkLoaded] = useState(false);

  // Load current-card fighter names from DKSalaries.csv for odds filtering.
  // Always sets dkLoaded=true on completion so the odds effect knows to run.
  useEffect(() => {
    fetch("/DKSalaries.csv")
      .then((r) => r.text())
      .then((text) => {
        const rows = text.trim().split("\n").slice(1);
        const names = rows
          .map((row) => row.split(",")[2]?.trim())
          .filter(Boolean);
        setDkFighters(names);
      })
      .catch(() => {})
      .finally(() => setDkLoaded(true)); // always gate-open, even on failure
  }, []);

  // Load and filter live odds. Only runs after DKSalaries.csv has settled so
  // we always have fighter names available to filter the 80-event API response
  // down to the current card. Falls back to a direct API fetch if no cache.
  useEffect(() => {
    if (!dkLoaded) return; // wait for CSV to settle

    const ODDS_API_KEY = process.env.REACT_APP_ODDS_API_KEY;

    const applyEvents = (rawEvents) => {
      let events = rawEvents;

      // Filter to current card via word-overlap on DK fighter names.
      // Handles nickname variants: "Lupita Godinez" ↔ "Loopy Godinez", etc.
      if (dkFighters.length > 0) {
        const cardWordSet = new Set(
          dkFighters
            .flatMap((n) => n.toLowerCase().split(/\s+/))
            .filter((w) => w.length >= 3),
        );
        const filtered = events.filter((event) =>
          [event.home_team, event.away_team].filter(Boolean).some((name) =>
            name
              .toLowerCase()
              .split(/\s+/)
              .some((w) => w.length >= 3 && cardWordSet.has(w)),
          ),
        );
        if (filtered.length > 0) events = filtered;
      }

      // Narrow to the next event only — exclude future-card false positives
      // (e.g. Carlos Ulberg appearing again in a June event).
      if (events.length > 0) {
        const earliest = new Date(events[0].commence_time).getTime();
        events = events.filter(
          (e) =>
            new Date(e.commence_time).getTime() - earliest <=
            2 * 24 * 60 * 60 * 1000,
        );
      }

      const transformed = events
        .map(transformApiEvent)
        .filter(Boolean)
        .slice(0, 15);
      if (transformed.length > 0) {
        setFights(transformed);
        setUsingLive(true);
      }
      setLoadingOdds(false);
    };

    // 1. Try the shared LatestOdds cache first (free, instant)
    try {
      const cached = JSON.parse(localStorage.getItem(ODDS_CACHE_KEY));
      if (cached?.data?.length > 0) {
        applyEvents(cached.data);
        return;
      }
    } catch {
      // Cache corrupt — fall through to fetch
    }

    // 2. No usable cache — fetch directly and populate the shared cache
    if (!ODDS_API_KEY) {
      setLoadingOdds(false);
      return;
    }
    fetch(
      `https://api.the-odds-api.com/v4/sports/mma_mixed_martial_arts/odds?apiKey=${ODDS_API_KEY}&regions=us&markets=h2h&oddsFormat=american`,
    )
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
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
            JSON.stringify({ data: sorted, timestamp: Date.now() }),
          );
          applyEvents(sorted);
        } else {
          setLoadingOdds(false);
        }
      })
      .catch(() => setLoadingOdds(false));
  }, [dkLoaded]); // runs exactly once: after CSV settles

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
        await api.post(
          "/api/lineups",
          {
            name,
            lineup_data: legs,
            total_salary: 0,
            projected_fpts: 0,
            salary_mode: "parlay",
          },
          token,
        );
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
      <div
        className="min-h-screen bg-stone-950 text-stone-100"
        style={{ fontFamily: "'Courier New', monospace" }}
      >
        {/* ── CLASSIFIED HEADER ── */}
        <div className="relative border-b border-yellow-700/40 overflow-hidden">
          {/* Diagonal camo overlay */}
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
                <h1
                  className="text-2xl sm:text-3xl font-black tracking-wider font-mono flex items-center gap-3"
                >
                  <span className="text-yellow-500 text-2xl">🎯</span>
                  OPERATION: <span className="text-yellow-400">PARLAY BUILDER</span>
                </h1>
                <p className="text-stone-500 text-xs tracking-widest uppercase mt-2 font-mono">
                  BUILD YOUR LEGS · CALCULATE PAYOUT · PLACE ON DK OR FANDUEL
                </p>
              </div>
              <div className="flex flex-col items-start sm:items-end gap-2 shrink-0">
                <span
                  className={`inline-flex items-center gap-1.5 text-[11px] px-3 py-1 rounded font-mono tracking-wider uppercase border ${
                    usingLive
                      ? "text-green-400 border-green-700/60 bg-green-950/50"
                      : "text-stone-400 border-stone-600/60 bg-stone-900/50"
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${usingLive ? "bg-green-400 animate-pulse" : "bg-stone-500"}`}
                  />
                  {usingLive ? "LIVE ODDS LOADED" : "PLACEHOLDER ODDS"}
                </span>
                {!usingLive && (
                  <span className="text-[10px] text-stone-600 font-mono">
                    Visit Live Odds to sync real lines
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-6xl mx-auto px-3 sm:px-4 py-4">
          {/* Mobile tab bar */}
          <div className="lg:hidden flex rounded-lg overflow-hidden border border-yellow-700/30 mb-4">
            <button
              onClick={() => setActiveTab("picks")}
              className={`flex-1 py-2.5 text-xs font-mono font-bold tracking-widest uppercase transition ${
                activeTab === "picks"
                  ? "bg-yellow-900/60 text-yellow-300 border-b-2 border-yellow-500"
                  : "bg-stone-900 text-stone-400 hover:text-stone-200"
              }`}
            >
              Pick Fights
            </button>
            <button
              onClick={() => setActiveTab("slip")}
              className={`flex-1 py-2.5 text-xs font-mono font-bold tracking-widest uppercase transition relative ${
                activeTab === "slip"
                  ? "bg-yellow-900/60 text-yellow-300 border-b-2 border-yellow-500"
                  : "bg-stone-900 text-stone-400 hover:text-stone-200"
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
              {/* Recommended parlays — built from this week's loaded fights */}
              <RecommendedParlays
                fights={fights}
                onAddAll={(legs) => {
                  legs.forEach((leg) => {
                    const id = `rec-${leg.description.replace(/\s/g, "-")}`;
                    setLegs((prev) => {
                      if (prev.find((l) => l.id === id)) return prev;
                      return [
                        ...prev,
                        {
                          id,
                          fightId: "rec",
                          description: leg.description,
                          team: leg.description,
                          betType: "Moneyline",
                          odds: leg.odds,
                        },
                      ];
                    });
                  });
                }}
              />
              <div className="flex flex-col gap-3">
                {sectionOrder
                  .filter((s) => sections[s])
                  .map((sectionName) => (
                    <div key={sectionName}>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-[10px] font-mono font-bold uppercase tracking-[0.3em] text-yellow-700">
                          {sectionName}
                        </span>
                        <div className="flex-1 h-px bg-yellow-900/30" />
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
                  onSave={() => {
                    if (!isPro) {
                      window.location.href = "/dashboard?upgrade=1";
                      return;
                    }
                    if (hasLegs) setShowSaveModal(true);
                  }}
                  saveStatus={saveStatus}
                  currentUser={currentUser}
                />
              </div>
            </div>
          </div>

          {/* Welcome bonus offers */}
          <WelcomeBonusSelector />

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
