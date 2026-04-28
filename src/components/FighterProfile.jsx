/**
 * FighterProfile.jsx — Combat Dossier: Individual Fighter Profile
 *
 * Route: /fighters/:slug
 *
 * Sections:
 *  1. Hero — photo, name, record, bio
 *  2. CageVault AI Pick (current-card fighters only)
 *  3. Career Stats — tabbed (striking / grappling / physical / record)
 *  4. Fight History table
 *  5. DFS Projection (current-card fighters only)
 *  6. Community Vote
 *  7. CageVault AI Track Record vs this fighter
 */
import React, { useState, useEffect, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import api from "../services/api";
import { predictFight, CONFIDENCE_LEVELS } from "./fightAnalyzerHelpers";

// ── Constants ────────────────────────────────────────────────────────────────

const SECTION_LABELS = {
  strikingOffense: "Striking Off.",
  strikingDefense: "Striking Def.",
  grapplingOffense: "Grappling Off.",
  grapplingDefense: "Grappling Def.",
  finishing: "Finishing",
  record: "Record / Exp.",
  momentum: "Momentum",
  physical: "Physical",
  fightHistory: "Fight History",
  styleMatchup: "Style Matchup",
};

const RESULT_COLORS = {
  win: "text-emerald-400 border-emerald-700/40",
  loss: "text-red-400 border-red-700/40",
  draw: "text-yellow-400 border-yellow-700/40",
  nc: "text-stone-400 border-stone-700/40",
};

// ── Helpers ──────────────────────────────────────────────────────────────────

const pct = (v) => (v == null ? "—" : typeof v === "string" ? v : `${v}%`);
const num = (v, dec = 2) => (v == null ? "—" : Number(v).toFixed(dec));
const fmtDate = (d) => {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return d;
  }
};

// ── Sub-components ───────────────────────────────────────────────────────────

function StatRow({ label, value, isHighlight = false }) {
  return (
    <div
      className={`flex items-center justify-between py-2 border-b border-stone-800/80 ${isHighlight ? "bg-stone-800/30 px-2 -mx-2 rounded" : ""}`}
    >
      <span className="text-xs font-mono text-stone-400">{label}</span>
      <span className="text-xs font-mono text-white font-semibold">
        {value ?? "—"}
      </span>
    </div>
  );
}

function SectionHeader({ icon, title, subtitle }) {
  return (
    <div className="flex items-start gap-3 mb-4">
      <div className="text-yellow-500 text-lg leading-none mt-0.5">{icon}</div>
      <div>
        <h2 className="text-sm font-black text-white tracking-wider uppercase">
          {title}
        </h2>
        {subtitle && (
          <p className="text-[10px] text-stone-500 font-mono mt-0.5">
            {subtitle}
          </p>
        )}
      </div>
    </div>
  );
}

function ClassifiedBanner({ text = "CLASSIFIED" }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <div className="h-px flex-1 bg-yellow-700/30" />
      <span className="text-[9px] font-mono text-yellow-700 tracking-[0.4em]">
        {text}
      </span>
      <div className="h-px flex-1 bg-yellow-700/30" />
    </div>
  );
}

// Win probability bar used in AI pick section
function WinProbBar({ winnerName, winnerProb, loserName, loserProb }) {
  const safeWinner = winnerProb || 50;
  const safeLoser = 100 - safeWinner;
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-[10px] font-mono">
        <span className="text-yellow-400 font-bold">{winnerName}</span>
        <span className="text-stone-400">{loserName}</span>
      </div>
      <div className="flex h-6 rounded overflow-hidden">
        <div
          className="bg-yellow-600/80 flex items-center justify-center text-[10px] font-mono font-bold text-black transition-all"
          style={{ width: `${safeWinner}%` }}
        >
          {safeWinner >= 35 ? `${safeWinner}%` : ""}
        </div>
        <div
          className="bg-stone-700/80 flex items-center justify-center text-[10px] font-mono text-stone-400 transition-all"
          style={{ width: `${safeLoser}%` }}
        >
          {safeLoser >= 35 ? `${safeLoser}%` : ""}
        </div>
      </div>
    </div>
  );
}

// Finish rate donut substitute — just a styled stat block
function RecordBreakdown({
  wins,
  losses,
  draws,
  wins_ko_tko,
  wins_submission,
  wins_decision,
  finish_rate_pct,
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <div className="bg-stone-800/50 rounded-lg p-3 text-center border border-stone-700/40">
        <p className="text-2xl font-black text-white">
          {wins}-{losses}-{draws}
        </p>
        <p className="text-[9px] text-stone-500 font-mono mt-0.5">W-L-D</p>
      </div>
      <div className="bg-stone-800/50 rounded-lg p-3 text-center border border-stone-700/40">
        <p className="text-2xl font-black text-yellow-400">
          {finish_rate_pct ?? 0}%
        </p>
        <p className="text-[9px] text-stone-500 font-mono mt-0.5">
          FINISH RATE
        </p>
      </div>
      <div className="bg-red-900/20 rounded-lg p-3 text-center border border-red-800/30">
        <p className="text-xl font-black text-red-400">{wins_ko_tko ?? 0}</p>
        <p className="text-[9px] text-stone-500 font-mono mt-0.5">KO / TKO</p>
      </div>
      <div className="bg-blue-900/20 rounded-lg p-3 text-center border border-blue-800/30">
        <p className="text-xl font-black text-blue-400">
          {wins_submission ?? 0}
        </p>
        <p className="text-[9px] text-stone-500 font-mono mt-0.5">
          SUBMISSIONS
        </p>
      </div>
      <div className="col-span-2 bg-stone-800/30 rounded-lg p-3 text-center border border-stone-700/30">
        <p className="text-xl font-black text-stone-300">
          {wins_decision ?? 0}
        </p>
        <p className="text-[9px] text-stone-500 font-mono mt-0.5">DECISIONS</p>
      </div>
    </div>
  );
}

// ── SEO helpers ──────────────────────────────────────────────────────────────

/** Upsert a <meta> tag by property (og:*) or name (twitter:*). */
function setMeta(key, value, attr = "property") {
  if (!value) return;
  let el = document.querySelector(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute("content", value);
}

/** Remove a <meta> tag by property/name. */
function removeMeta(key, attr = "property") {
  document.querySelector(`meta[${attr}="${key}"]`)?.remove();
}

/** Derive Sherdog CDN portrait from a Sherdog profile URL. */
function sherdogPortrait(sherdogUrl) {
  if (!sherdogUrl) return null;
  const m = sherdogUrl.match(/\/fighter\/[^/]+-(\d+)\/?$/);
  return m
    ? `https://www.sherdog.com/image_crop/300/400/_images/fighter/${m[1]}_ff.jpg`
    : null;
}

// ── Main Component ───────────────────────────────────────────────────────────

export default function FighterProfile({ currentUser, authToken }) {
  const { slug } = useParams();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [thisWeek, setThisWeek] = useState(null);
  const [vote, setVote] = useState(null); // "fighter_a" | "fighter_b"
  const [voteSubmitting, setVoteSubmitting] = useState(false);
  const [statsTab, setStatsTab] = useState("striking");
  const [historyExpanded, setHistoryExpanded] = useState(false);

  // Load profile + this week's card in parallel
  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    setError(null);

    Promise.all([
      api.get(`/api/fighters/${slug}`).catch(() => null),
      api.get("/api/this-weeks-stats").catch(() => null),
    ]).then(([profileData, weekData]) => {
      if (!profileData) {
        setError(
          "Fighter not found. Run the data pipeline to generate profiles.",
        );
      } else {
        setProfile(profileData);

        const p = profileData;
        const title = `${p.name} — UFC Fighter Profile | CageVault`;
        const record =
          p.record || `${p.wins ?? 0}-${p.losses ?? 0}-${p.draws ?? 0}`;
        const wc = p.weight_class ? ` • ${p.weight_class}` : "";
        const fin =
          p.finish_rate_pct != null
            ? ` • ${p.finish_rate_pct}% finish rate`
            : "";
        const description = `${p.name} (${record})${wc}${fin} — UFC career stats, fight history & analysis on CageVault.`;
        const url = `https://cagevault.com/fighters/${slug}`;
        const image =
          p.ufc_image_url ||
          sherdogPortrait(p.sherdog_url) ||
          "https://cagevault.com/images/og-default.jpg";

        // Page title
        document.title = title;

        // OpenGraph
        setMeta("og:type", "profile");
        setMeta("og:title", title);
        setMeta("og:description", description);
        setMeta("og:url", url);
        setMeta("og:image", image);
        setMeta("og:site_name", "CageVault");

        // Twitter / X card
        setMeta("twitter:card", "summary_large_image", "name");
        setMeta("twitter:title", title, "name");
        setMeta("twitter:description", description, "name");
        setMeta("twitter:image", image, "name");
        setMeta("twitter:site", "@cagevault", "name");

        // JSON-LD structured data (Person schema)
        const ld = {
          "@context": "https://schema.org",
          "@type": "Person",
          name: p.name,
          description,
          url,
          image,
          jobTitle: p.weight_class ? `${p.weight_class} UFC Fighter` : "UFC Fighter",
          nationality: p.nationality || undefined,
          ...(p.height   ? { height:  { "@type": "QuantitativeValue", description: p.height  } } : {}),
          ...(p.dob && p.dob !== "N/A" ? { birthDate: p.dob } : {}),
        };
        let ldEl = document.querySelector('script[data-cv="fighter-ld"]');
        if (!ldEl) {
          ldEl = document.createElement("script");
          ldEl.type = "application/ld+json";
          ldEl.setAttribute("data-cv", "fighter-ld");
          document.head.appendChild(ldEl);
        }
        ldEl.textContent = JSON.stringify(ld);
      }
      setThisWeek(weekData);
      setLoading(false);
    });

    // Reset tags when navigating away
    return () => {
      document.title = "CageVault — UFC Fighter Intelligence";
      [
        "og:type",
        "og:title",
        "og:description",
        "og:url",
        "og:image",
        "og:site_name",
      ].forEach((k) => removeMeta(k));
      [
        "twitter:card",
        "twitter:title",
        "twitter:description",
        "twitter:image",
        "twitter:site",
      ].forEach((k) => removeMeta(k, "name"));
      document.querySelector('script[data-cv="fighter-ld"]')?.remove();
    };
  }, [slug]);

  // Is this fighter on the current card?
  const currentCardMatch = useMemo(() => {
    if (!profile || !thisWeek) return null;
    const nameLower = (profile.name || "").toLowerCase();
    const fights = thisWeek.fights || thisWeek.bouts || thisWeek.data || [];
    for (const fight of fights) {
      const fighters =
        fight.fighters || [fight.fighter1, fight.fighter2].filter(Boolean);
      const found = fighters.find((f) => {
        const fn = (f.name || f.fighter_name || "").toLowerCase();
        return fn.includes(nameLower) || nameLower.includes(fn.split(" ")[0]);
      });
      if (found) return { fight, fighter: found, fighters };
    }
    return null;
  }, [profile, thisWeek]);

  // Build AI prediction for current-card fighters
  const aiPick = useMemo(() => {
    if (!currentCardMatch) return null;
    const { fight, fighters } = currentCardMatch;
    const f1 = fighters[0];
    const f2 = fighters[1];
    if (!f1 || !f2) return null;
    try {
      return predictFight(f1, f2);
    } catch {
      return null;
    }
  }, [currentCardMatch]);

  const handleVote = async (choice) => {
    if (vote || voteSubmitting) return;
    setVoteSubmitting(true);
    try {
      const result = await api.post(`/api/fighters/${slug}/vote`, {
        vote: choice,
      });
      setVote(choice);
      // Update vote counts in profile
      setProfile((p) => ({ ...p, votes: result.votes }));
    } catch (e) {
      // Vote failed silently — don't block UX
    } finally {
      setVoteSubmitting(false);
    }
  };

  // ── Loading / error states ───────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-stone-950 flex items-center justify-center">
        <div className="text-center font-mono text-stone-500 text-sm">
          <div className="text-2xl mb-3 animate-pulse">⚡</div>
          LOADING DOSSIER...
        </div>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="min-h-screen bg-stone-950 flex items-center justify-center px-4">
        <div className="text-center font-mono max-w-md">
          <p className="text-yellow-600 text-xs tracking-widest mb-2">
            FILE NOT FOUND
          </p>
          <p className="text-stone-300 text-sm mb-4">
            {error || "Fighter profile not available."}
          </p>
          <Link
            to="/fighters"
            className="text-xs text-yellow-600 hover:text-yellow-400 transition-colors"
          >
            ← RETURN TO DIRECTORY
          </Link>
        </div>
      </div>
    );
  }

  const {
    name,
    nickname,
    record,
    weight_class,
    nationality,
    team,
    height,
    reach,
    stance,
    dob,
    age,
    ufc_image_url,
    sherdog_url,
    wins,
    losses,
    draws,
    wins_ko_tko,
    wins_submission,
    wins_decision,
    finish_rate_pct,
    current_win_streak,
    current_loss_streak,
    record_last_5,
    stats = {},
    fight_history = [],
    ai_record,
    votes = { fighter_a: 0, fighter_b: 0 },
  } = profile;

  // Best available portrait — UFC CDN preferred, Sherdog CDN as fallback
  const portraitUrl = ufc_image_url || sherdogPortrait(sherdog_url) || null;

  const totalVotes = (votes.fighter_a || 0) + (votes.fighter_b || 0);
  const voteAPct =
    totalVotes > 0 ? Math.round((votes.fighter_a / totalVotes) * 100) : 50;
  const voteBPct = 100 - voteAPct;

  // History — show last 10 by default
  const historyVisible = historyExpanded
    ? fight_history
    : fight_history.slice(0, 10);

  const confidenceLevelData = aiPick
    ? CONFIDENCE_LEVELS[aiPick.confidence] || CONFIDENCE_LEVELS["tossup"]
    : null;

  return (
    <div className="min-h-screen bg-stone-950">
      {/* ── Hero section ── */}
      <div className="relative overflow-hidden">
        {/* Background splash */}
        <div className="absolute inset-0 bg-gradient-to-b from-stone-900 via-stone-950 to-stone-950" />
        {portraitUrl && (
          <div
            className="absolute inset-0 opacity-15 bg-center bg-cover blur-xl scale-110"
            style={{ backgroundImage: `url(${portraitUrl})` }}
          />
        )}

        <div className="relative max-w-6xl mx-auto px-4 py-10 flex flex-col sm:flex-row gap-6 items-start sm:items-end">
          {/* Portrait */}
          <div className="relative flex-shrink-0">
            {portraitUrl ? (
              <img
                src={portraitUrl}
                alt={name}
                className="w-32 h-40 sm:w-44 sm:h-56 object-cover object-top rounded-xl border-2 border-stone-700/60 shadow-2xl"
              />
            ) : (
              <div className="w-32 h-40 sm:w-44 sm:h-56 rounded-xl border-2 border-stone-700/60 bg-stone-800 flex items-center justify-center text-4xl font-black text-stone-600">
                {(name || "?").slice(0, 2).toUpperCase()}
              </div>
            )}
            {currentCardMatch && (
              <div className="absolute -top-2 -right-2 bg-yellow-600 text-black text-[9px] font-mono font-black px-2 py-0.5 rounded-full shadow-lg">
                THIS WEEK
              </div>
            )}
          </div>

          {/* Bio */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[9px] font-mono text-yellow-600 tracking-[0.3em]">
                COMBAT DOSSIER
              </span>
              {weight_class && (
                <span className="text-[9px] font-mono bg-stone-800 text-stone-400 px-2 py-0.5 rounded border border-stone-700/50">
                  {weight_class.toUpperCase()}
                </span>
              )}
            </div>
            <h1 className="text-3xl sm:text-5xl font-black text-white tracking-tighter leading-none">
              {name}
            </h1>
            {nickname && (
              <p className="text-yellow-500/70 font-mono italic text-sm mt-1">
                "{nickname}"
              </p>
            )}
            <div className="flex items-baseline gap-3 mt-2">
              <span className="text-2xl font-black text-yellow-400 font-mono">
                {record || `${wins}-${losses}-${draws}`}
              </span>
              {current_win_streak >= 3 && (
                <span className="text-xs font-mono text-emerald-400 bg-emerald-900/30 border border-emerald-700/30 px-2 py-0.5 rounded">
                  {current_win_streak}W STREAK
                </span>
              )}
              {current_loss_streak >= 3 && (
                <span className="text-xs font-mono text-red-400 bg-red-900/30 border border-red-700/30 px-2 py-0.5 rounded">
                  {current_loss_streak}L STREAK
                </span>
              )}
            </div>

            {/* Meta details */}
            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3 text-xs font-mono text-stone-400">
              {nationality && <span>🌐 {nationality}</span>}
              {team && <span>🏛 {team}</span>}
              {height && <span>📏 {height}</span>}
              {reach && <span>↔ {reach} reach</span>}
              {stance && <span>🥊 {stance}</span>}
              {age && <span>📅 {age} yrs</span>}
              {dob && dob !== "N/A" && <span>DOB: {dob}</span>}
            </div>

            {/* Quick stat pills */}
            <div className="flex flex-wrap gap-2 mt-3">
              {finish_rate_pct > 0 && (
                <div className="bg-red-900/20 border border-red-800/30 rounded px-2 py-1 text-center">
                  <p className="text-sm font-black text-red-400">
                    {finish_rate_pct}%
                  </p>
                  <p className="text-[8px] text-stone-500 font-mono">
                    FINISH RATE
                  </p>
                </div>
              )}
              {record_last_5 && (
                <div className="bg-stone-800/50 border border-stone-700/30 rounded px-2 py-1 text-center">
                  <p className="text-sm font-black text-white">
                    {record_last_5}
                  </p>
                  <p className="text-[8px] text-stone-500 font-mono">LAST 5</p>
                </div>
              )}
              {stats.slpm != null && (
                <div className="bg-stone-800/50 border border-stone-700/30 rounded px-2 py-1 text-center">
                  <p className="text-sm font-black text-white">
                    {num(stats.slpm)}
                  </p>
                  <p className="text-[8px] text-stone-500 font-mono">SLpM</p>
                </div>
              )}
              {stats.td_avg != null && (
                <div className="bg-stone-800/50 border border-stone-700/30 rounded px-2 py-1 text-center">
                  <p className="text-sm font-black text-white">
                    {num(stats.td_avg)}
                  </p>
                  <p className="text-[8px] text-stone-500 font-mono">TD/15m</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Body content ── */}
      <div className="max-w-6xl mx-auto px-4 pb-16 grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ── LEFT / MAIN column ── */}
        <div className="lg:col-span-2 space-y-5">
          {/* ── 2. AI Pick (current card only) ── */}
          {aiPick && currentCardMatch && (
            <div className="bg-stone-900 border border-yellow-700/40 rounded-xl p-5 shadow-[0_0_30px_rgba(202,138,4,0.08)]">
              <ClassifiedBanner text="CAGEVAULT AI — CURRENT CARD INTEL" />
              <SectionHeader
                icon="⚡"
                title="AI Fight Prediction"
                subtitle={`${currentCardMatch.fight?.event || "Upcoming Bout"}`}
              />

              {confidenceLevelData && (
                <div
                  className={`inline-flex items-center gap-1.5 text-[10px] font-mono font-bold px-3 py-1 rounded-full border mb-4 ${confidenceLevelData.badge || "bg-stone-800 text-stone-400 border-stone-700"}`}
                >
                  <span>
                    {confidenceLevelData.label ||
                      aiPick.confidence.toUpperCase()}
                  </span>
                </div>
              )}

              <WinProbBar
                winnerName={aiPick.winner?.name || name}
                winnerProb={aiPick.winner?.winProb || 50}
                loserName={aiPick.loser?.name || "Opponent"}
                loserProb={aiPick.loser?.winProb || 50}
              />

              {aiPick.narrative && (
                <p className="text-xs text-stone-400 font-mono leading-relaxed mt-4 border-t border-stone-800 pt-3">
                  {aiPick.narrative}
                </p>
              )}
            </div>
          )}

          {/* ── 3. Career Stats (tabbed) ── */}
          <div className="bg-stone-900 border border-stone-700/50 rounded-xl p-5">
            <SectionHeader icon="📊" title="Career Statistics" />

            {/* Tabs */}
            <div className="flex gap-1 mb-4 bg-stone-800/60 p-1 rounded-lg">
              {["striking", "grappling", "physical", "record"].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setStatsTab(tab)}
                  className={`flex-1 text-[10px] font-mono font-bold py-1.5 px-2 rounded transition-all ${
                    statsTab === tab
                      ? "bg-yellow-700/40 text-yellow-400 border border-yellow-700/40"
                      : "text-stone-500 hover:text-stone-300"
                  }`}
                >
                  {tab.toUpperCase()}
                </button>
              ))}
            </div>

            {statsTab === "striking" && (
              <div className="space-y-0.5">
                <StatRow
                  label="Significant Strikes Landed / min"
                  value={num(stats.slpm)}
                  isHighlight
                />
                <StatRow
                  label="Significant Strikes Absorbed / min"
                  value={num(stats.sapm)}
                />
                <StatRow
                  label="Striking Accuracy"
                  value={pct(stats.striking_accuracy)}
                  isHighlight
                />
                <StatRow
                  label="Striking Defense"
                  value={pct(stats.striking_defense)}
                />
              </div>
            )}
            {statsTab === "grappling" && (
              <div className="space-y-0.5">
                <StatRow
                  label="Takedowns / 15 min"
                  value={num(stats.td_avg)}
                  isHighlight
                />
                <StatRow
                  label="Takedown Accuracy"
                  value={pct(stats.td_accuracy)}
                />
                <StatRow
                  label="Takedown Defense"
                  value={pct(stats.td_defense)}
                  isHighlight
                />
                <StatRow
                  label="Submission Attempts / 15 min"
                  value={num(stats.avg_sub_attempts)}
                />
              </div>
            )}
            {statsTab === "physical" && (
              <div className="space-y-0.5">
                <StatRow label="Height" value={height || "—"} isHighlight />
                <StatRow label="Reach" value={reach || "—"} />
                <StatRow label="Stance" value={stance || "—"} isHighlight />
                <StatRow label="Age" value={age ? `${age} yrs` : dob || "—"} />
                <StatRow label="Weight Class" value={weight_class || "—"} />
                <StatRow label="Nationality" value={nationality || "—"} />
                <StatRow label="Team / Gym" value={team || "—"} />
              </div>
            )}
            {statsTab === "record" && (
              <RecordBreakdown
                wins={wins}
                losses={losses}
                draws={draws}
                wins_ko_tko={wins_ko_tko}
                wins_submission={wins_submission}
                wins_decision={wins_decision}
                finish_rate_pct={finish_rate_pct}
              />
            )}
          </div>

          {/* ── 4. Fight History ── */}
          <div className="bg-stone-900 border border-stone-700/50 rounded-xl p-5">
            <SectionHeader
              icon="📋"
              title="Fight History"
              subtitle={`${fight_history.length} professional fights`}
            />

            {fight_history.length === 0 ? (
              <p className="text-xs font-mono text-stone-600">
                No fight history available.
              </p>
            ) : (
              <>
                <div className="overflow-x-auto -mx-2">
                  <table className="w-full text-[11px] font-mono min-w-[480px]">
                    <thead>
                      <tr className="border-b border-stone-800 text-stone-500">
                        <th className="text-left pb-2 px-2 font-normal">RES</th>
                        <th className="text-left pb-2 px-2 font-normal">
                          OPPONENT
                        </th>
                        <th className="text-left pb-2 px-2 font-normal">
                          METHOD
                        </th>
                        <th className="text-left pb-2 px-2 font-normal">
                          EVENT
                        </th>
                        <th className="text-left pb-2 px-2 font-normal">
                          DATE
                        </th>
                        <th className="text-left pb-2 px-2 font-normal">RND</th>
                      </tr>
                    </thead>
                    <tbody>
                      {historyVisible.map((fight, idx) => {
                        const result = (fight.result || "").toLowerCase();
                        const colorCls =
                          RESULT_COLORS[result] || RESULT_COLORS.nc;
                        const opponent =
                          fight.opponent || fight.opponent_name || "—";
                        const oppSlug =
                          opponent !== "—"
                            ? opponent
                                .toLowerCase()
                                .replace(/[^a-z0-9\s-]/g, "")
                                .trim()
                                .replace(/\s+/g, "-")
                            : null;

                        return (
                          <tr
                            key={idx}
                            className="border-b border-stone-800/50 hover:bg-stone-800/30 transition-colors"
                          >
                            <td
                              className={`px-2 py-2.5 font-bold text-xs border-l-2 ${colorCls}`}
                            >
                              {result.toUpperCase() || "—"}
                            </td>
                            <td className="px-2 py-2.5">
                              {oppSlug ? (
                                <Link
                                  to={`/fighters/${oppSlug}`}
                                  className="text-stone-300 hover:text-yellow-400 transition-colors"
                                >
                                  {opponent}
                                </Link>
                              ) : (
                                <span className="text-stone-300">
                                  {opponent}
                                </span>
                              )}
                            </td>
                            <td className="px-2 py-2.5 text-stone-400">
                              {fight.method || "—"}
                            </td>
                            <td className="px-2 py-2.5 text-stone-500 max-w-[140px] truncate">
                              {fight.event || fight.promotion || "—"}
                            </td>
                            <td className="px-2 py-2.5 text-stone-500">
                              {fmtDate(fight.date)}
                            </td>
                            <td className="px-2 py-2.5 text-stone-500">
                              {fight.round || "—"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {fight_history.length > 10 && (
                  <button
                    onClick={() => setHistoryExpanded(!historyExpanded)}
                    className="mt-3 text-[10px] font-mono text-yellow-600 hover:text-yellow-400 transition-colors"
                  >
                    {historyExpanded
                      ? "▲ SHOW LESS"
                      : `▼ SHOW ALL ${fight_history.length} FIGHTS`}
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {/* ── RIGHT sidebar ── */}
        <div className="space-y-5">
          {/* ── 7. Community Vote ── */}
          <div className="bg-stone-900 border border-stone-700/50 rounded-xl p-5">
            <ClassifiedBanner text="COMMUNITY INTEL" />
            <SectionHeader
              icon="🗳"
              title="Community Vote"
              subtitle="Who wins the next fight?"
            />

            <div className="space-y-3">
              {/* Vote A — this fighter */}
              <button
                onClick={() => handleVote("fighter_a")}
                disabled={!!vote || voteSubmitting}
                className={`w-full text-left px-3 py-2.5 rounded-lg border text-xs font-mono transition-all ${
                  vote === "fighter_a"
                    ? "bg-yellow-700/30 border-yellow-600/60 text-yellow-300"
                    : vote
                      ? "opacity-50 cursor-not-allowed bg-stone-800 border-stone-700/50 text-stone-400"
                      : "bg-stone-800 border-stone-700/50 text-stone-300 hover:border-yellow-700/50 hover:text-yellow-400 cursor-pointer"
                }`}
              >
                <span className="font-bold">
                  {vote === "fighter_a" ? "✓ " : ""}
                </span>
                {name} wins
              </button>

              {/* Vote B — opponent */}
              <button
                onClick={() => handleVote("fighter_b")}
                disabled={!!vote || voteSubmitting}
                className={`w-full text-left px-3 py-2.5 rounded-lg border text-xs font-mono transition-all ${
                  vote === "fighter_b"
                    ? "bg-stone-700/50 border-stone-600/60 text-stone-200"
                    : vote
                      ? "opacity-50 cursor-not-allowed bg-stone-800 border-stone-700/50 text-stone-400"
                      : "bg-stone-800 border-stone-700/50 text-stone-300 hover:border-stone-600 cursor-pointer"
                }`}
              >
                <span className="font-bold">
                  {vote === "fighter_b" ? "✓ " : ""}
                </span>
                Opponent wins
              </button>
            </div>

            {/* Vote bar */}
            {totalVotes > 0 && (
              <div className="mt-4 space-y-1.5">
                <div className="flex justify-between text-[9px] font-mono text-stone-500">
                  <span>{name}</span>
                  <span>{totalVotes.toLocaleString()} votes</span>
                  <span>Opponent</span>
                </div>
                <div className="flex h-4 rounded overflow-hidden">
                  <div
                    className="bg-yellow-700/60 transition-all"
                    style={{ width: `${voteAPct}%` }}
                  />
                  <div
                    className="bg-stone-700 transition-all"
                    style={{ width: `${voteBPct}%` }}
                  />
                </div>
                <div className="flex justify-between text-[9px] font-mono font-bold">
                  <span className="text-yellow-400">{voteAPct}%</span>
                  <span className="text-stone-500">{voteBPct}%</span>
                </div>
              </div>
            )}
          </div>

          {/* ── 8. AI Track Record vs this fighter ── */}
          {ai_record && (
            <div className="bg-stone-900 border border-stone-700/50 rounded-xl p-5">
              <ClassifiedBanner text="CAGEVAULT AI TRACK RECORD" />
              <SectionHeader icon="🎯" title="Our AI vs This Fighter" />

              <div className="text-center">
                <p className="text-4xl font-black text-yellow-400 font-mono">
                  {ai_record.record || "0-0"}
                </p>
                <p className="text-[10px] text-stone-500 font-mono mt-1">
                  when our AI picks {ai_record.name || name}
                </p>
              </div>
              {ai_record.picked > 0 && (
                <div className="mt-3 bg-stone-800/50 rounded-lg p-3 text-center border border-stone-700/30">
                  <p className="text-xs text-stone-400 font-mono">
                    {ai_record.correct} correct out of {ai_record.picked} picks{" "}
                    (
                    {ai_record.picked > 0
                      ? Math.round((ai_record.correct / ai_record.picked) * 100)
                      : 0}
                    %)
                  </p>
                </div>
              )}
            </div>
          )}

          {/* ── Quick links ── */}
          <div className="bg-stone-900 border border-stone-700/50 rounded-xl p-4 space-y-2">
            <p className="text-[9px] font-mono text-stone-600 tracking-widest mb-3">
              INTEL SOURCES
            </p>
            {profile.ufcstats_url && (
              <a
                href={profile.ufcstats_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between px-3 py-2 bg-stone-800/50 rounded border border-stone-700/40 text-xs font-mono text-stone-400 hover:text-yellow-400 hover:border-yellow-700/40 transition-all"
              >
                UFCStats.com <span>↗</span>
              </a>
            )}
            {profile.sherdog_url && (
              <a
                href={profile.sherdog_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between px-3 py-2 bg-stone-800/50 rounded border border-stone-700/40 text-xs font-mono text-stone-400 hover:text-yellow-400 hover:border-yellow-700/40 transition-all"
              >
                Sherdog.com <span>↗</span>
              </a>
            )}
            <Link
              to="/fighters"
              className="flex items-center justify-between px-3 py-2 bg-stone-800/50 rounded border border-stone-700/40 text-xs font-mono text-stone-400 hover:text-yellow-400 hover:border-yellow-700/40 transition-all"
            >
              ← All Dossiers <span></span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
