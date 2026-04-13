/**
 * WelcomeBonusSelector.jsx — Reusable affiliate welcome-bonus cards.
 *
 * Drop this on any page:
 *   import WelcomeBonusSelector from "./WelcomeBonusSelector";
 *   <WelcomeBonusSelector />
 */
import React from "react";

// ─── Offer data (easy to update in one place) ────────────────────────────────
const OFFERS = [
  {
    name: "DraftKings",
    bonus: "Bet $5, Get $300 in Bonus Bets",
    tag: "DFS + Sportsbook",
    url: "https://sportsbook.draftkings.com/?wpcid=COMBATVAULT&wpsrc=combat_vault_web&wpcn=WelcomeBonus",
    colors: {
      bg: "bg-emerald-950/40",
      border: "border-emerald-700/40",
      accent: "text-emerald-400",
      hover: "hover:border-emerald-500/60 hover:bg-emerald-950/60",
      tagBg: "bg-emerald-800/30 text-emerald-300",
    },
  },
  {
    name: "FanDuel",
    bonus: "Bet $5, Get $200 in Bonus Bets",
    tag: "Sportsbook",
    url: "https://sportsbook.fanduel.com/?btag=a_COMBATVAULT_b_WelcomeBonus",
    colors: {
      bg: "bg-blue-950/40",
      border: "border-blue-700/40",
      accent: "text-blue-400",
      hover: "hover:border-blue-500/60 hover:bg-blue-950/60",
      tagBg: "bg-blue-800/30 text-blue-300",
    },
  },
  {
    name: "bet365",
    bonus: "Up to $1,000 First Bet Safety Net",
    tag: "Sportsbook",
    url: "https://www.bet365.com/#/AS/B13/",
    colors: {
      bg: "bg-yellow-950/30",
      border: "border-yellow-700/40",
      accent: "text-yellow-400",
      hover: "hover:border-yellow-500/60 hover:bg-yellow-950/50",
      tagBg: "bg-yellow-800/30 text-yellow-300",
    },
  },
  {
    name: "BetMGM",
    bonus: "Up to $1,500 in Bonus Bets If Your First Bet Loses",
    tag: "Sportsbook",
    url: "https://sports.betmgm.com/en/sports",
    colors: {
      bg: "bg-amber-950/30",
      border: "border-amber-700/40",
      accent: "text-amber-400",
      hover: "hover:border-amber-500/60 hover:bg-amber-950/50",
      tagBg: "bg-amber-800/30 text-amber-300",
    },
  },
  {
    name: "Underdog Fantasy",
    bonus: "100% Deposit Match up to $100",
    tag: "DFS",
    url: "https://play.underdogfantasy.com/",
    colors: {
      bg: "bg-purple-950/40",
      border: "border-purple-700/40",
      accent: "text-purple-400",
      hover: "hover:border-purple-500/60 hover:bg-purple-950/60",
      tagBg: "bg-purple-800/30 text-purple-300",
    },
  },
  {
    name: "PrizePicks",
    bonus: "100% Deposit Match up to $100",
    tag: "DFS",
    url: "https://app.prizepicks.com/",
    colors: {
      bg: "bg-cyan-950/40",
      border: "border-cyan-700/40",
      accent: "text-cyan-400",
      hover: "hover:border-cyan-500/60 hover:bg-cyan-950/60",
      tagBg: "bg-cyan-800/30 text-cyan-300",
    },
  },
];

// ─── Component ────────────────────────────────────────────────────────────────
export default function WelcomeBonusSelector() {
  return (
    <section className="mt-10 mb-6">
      {/* Header */}
      <div className="text-center mb-5">
        <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
          🎁 Best Welcome Offers Right Now
        </h2>
        <p className="text-stone-400 text-sm mt-1">
          New-user bonuses from top sportsbooks &amp; DFS platforms
        </p>
      </div>

      {/* Offer grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {OFFERS.map((o) => (
          <a
            key={o.name}
            href={o.url}
            target="_blank"
            rel="noopener noreferrer"
            className={`group block rounded-xl border p-4 transition-all duration-150
              ${o.colors.bg} ${o.colors.border} ${o.colors.hover}`}
          >
            {/* Top row: name + tag */}
            <div className="flex items-center justify-between mb-2">
              <span className={`text-base font-bold ${o.colors.accent}`}>
                {o.name}
              </span>
              <span
                className={`text-[10px] font-semibold uppercase tracking-wide rounded-full px-2 py-0.5 ${o.colors.tagBg}`}
              >
                {o.tag}
              </span>
            </div>

            {/* Bonus text */}
            <p className="text-stone-100 text-sm font-medium leading-snug">
              {o.bonus}
            </p>

            {/* CTA */}
            <div
              className={`mt-3 text-xs font-semibold ${o.colors.accent} group-hover:underline`}
            >
              Claim Offer →
            </div>
          </a>
        ))}
      </div>

      {/* Disclaimer */}
      <p className="text-center text-[11px] text-stone-600 mt-4 leading-relaxed">
        21+ | Terms apply | Gambling problem? Call{" "}
        <span className="text-stone-500 font-semibold">1-800-GAMBLER</span>
      </p>
    </section>
  );
}
