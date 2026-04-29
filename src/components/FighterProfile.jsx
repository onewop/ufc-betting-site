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

/** Parse a percentage value (number or "47%" string) into a plain number. */
const parsePct = (v) => {
  if (v == null) return null;
  const n = typeof v === "number" ? v : parseFloat(v);
  return isNaN(n) ? null : n;
};

/** Return a Tailwind color class for a fight method string. */
const methodColorCls = (method) => {
  const m = (method || "").toLowerCase();
  if (m.includes("ko") || m.includes("tko")) return "text-red-400";
  if (m.includes("sub")) return "text-blue-400";
  return "text-stone-400";
};

// ── Sub-components ───────────────────────────────────────────────────────────

function StatRow({ label, value, isHighlight = false, bar = null }) {
  // bar = { pct: 0-100, color?: tailwind bg class }
  return (
    <div
      className={`flex items-center justify-between py-2.5 border-b border-stone-800/60 ${isHighlight ? "bg-stone-800/30 px-3 -mx-3 rounded" : ""}`}
    >
      <span className="text-xs font-mono text-stone-400 flex-1 pr-3">
        {label}
      </span>
      <div className="flex items-center gap-3">
        {bar != null && (
          <div className="w-16 sm:w-24 h-1.5 bg-stone-800 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${bar.color || "bg-yellow-600/80"}`}
              style={{ width: `${Math.min(Math.max(bar.pct || 0, 0), 100)}%` }}
            />
          </div>
        )}
        <span className="text-xs font-mono text-white font-semibold tabular-nums min-w-[40px] text-right">
          {value ?? "—"}
        </span>
      </div>
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

// Win record with animated method bars
function RecordBreakdown({
  wins,
  losses,
  draws,
  wins_ko_tko,
  wins_submission,
  wins_decision,
  finish_rate_pct,
}) {
  const w = wins || 0;
  const koBar = w > 0 ? ((wins_ko_tko || 0) / w) * 100 : 0;
  const subBar = w > 0 ? ((wins_submission || 0) / w) * 100 : 0;
  const decBar = w > 0 ? ((wins_decision || 0) / w) * 100 : 0;
  return (
    <div className="space-y-4">
      {/* W / L / D boxes */}
      <div className="flex gap-3">
        <div className="flex-1 bg-emerald-950/50 rounded-xl p-4 text-center border border-emerald-800/30">
          <p className="text-3xl font-black text-emerald-400 font-mono">{w}</p>
          <p className="text-[9px] text-stone-500 font-mono mt-0.5">WINS</p>
        </div>
        <div className="flex-1 bg-red-950/50 rounded-xl p-4 text-center border border-red-800/30">
          <p className="text-3xl font-black text-red-400 font-mono">
            {losses || 0}
          </p>
          <p className="text-[9px] text-stone-500 font-mono mt-0.5">LOSSES</p>
        </div>
        <div className="flex-1 bg-stone-800/40 rounded-xl p-4 text-center border border-stone-700/30">
          <p className="text-3xl font-black text-stone-400 font-mono">
            {draws || 0}
          </p>
          <p className="text-[9px] text-stone-500 font-mono mt-0.5">DRAWS</p>
        </div>
      </div>

      {/* Win method bars */}
      <div className="space-y-3 pt-1">
        <p className="text-[9px] font-mono text-stone-600 tracking-widest">
          WIN BREAKDOWN
        </p>

        <div>
          <div className="flex justify-between text-[10px] font-mono mb-1.5">
            <span className="text-stone-400">KO / TKO</span>
            <span className="text-red-400 font-bold">{wins_ko_tko || 0}</span>
          </div>
          <div className="h-2 bg-stone-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-red-600/70 rounded-full transition-all duration-700"
              style={{ width: `${koBar}%` }}
            />
          </div>
        </div>

        <div>
          <div className="flex justify-between text-[10px] font-mono mb-1.5">
            <span className="text-stone-400">SUBMISSION</span>
            <span className="text-blue-400 font-bold">
              {wins_submission || 0}
            </span>
          </div>
          <div className="h-2 bg-stone-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-600/70 rounded-full transition-all duration-700"
              style={{ width: `${subBar}%` }}
            />
          </div>
        </div>

        <div>
          <div className="flex justify-between text-[10px] font-mono mb-1.5">
            <span className="text-stone-400">DECISION</span>
            <span className="text-stone-300 font-bold">
              {wins_decision || 0}
            </span>
          </div>
          <div className="h-2 bg-stone-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-stone-500/70 rounded-full transition-all duration-700"
              style={{ width: `${decBar}%` }}
            />
          </div>
        </div>

        {finish_rate_pct > 0 && (
          <div className="mt-3 bg-stone-800/40 border border-stone-700/30 rounded-lg px-4 py-3 flex justify-between items-center">
            <span className="text-[10px] font-mono text-stone-500 tracking-wider">
              FINISH RATE
            </span>
            <span className="text-xl font-black text-yellow-400 font-mono">
              {finish_rate_pct}%
            </span>
          </div>
        )}
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
  const [highlightVideos, setHighlightVideos] = useState({});
  const [portraitIdx, setPortraitIdx] = useState(0);

  // Load profile + this week's card in parallel
  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    setError(null);
    setPortraitIdx(0);

    Promise.all([
      api.get(`/api/fighters/${slug}`).catch(() => null),
      api.get("/api/this-weeks-stats").catch(() => null),
      fetch("/highlight_videos.json")
        .then((r) => r.json())
        .catch(() => ({})),
    ]).then(([profileData, weekData, videoData]) => {
      setHighlightVideos(videoData || {});
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
          jobTitle: p.weight_class
            ? `${p.weight_class} UFC Fighter`
            : "UFC Fighter",
          nationality: p.nationality || undefined,
          ...(p.height
            ? {
                height: { "@type": "QuantitativeValue", description: p.height },
              }
            : {}),
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

  // Highlight video ID for this fighter
  const highlightVideoId = useMemo(() => {
    if (!profile || !highlightVideos) return null;
    const nameLower = (profile.name || "").toLowerCase();
    const entry = Object.entries(highlightVideos).find(([k]) => {
      if (k.startsWith("_")) return false;
      return (
        k.toLowerCase() === nameLower ||
        nameLower.includes(k.toLowerCase()) ||
        k.toLowerCase().includes(nameLower)
      );
    });
    return entry ? entry[1] : null;
  }, [profile, highlightVideos]);

  // Combat style archetype derived from stats
  const styleArchetype = useMemo(() => {
    if (!profile) return null;
    const {
      wins = 0,
      wins_ko_tko = 0,
      wins_submission = 0,
      finish_rate_pct = 0,
      stats: s = {},
    } = profile;
    const koRate = wins > 0 ? (wins_ko_tko / wins) * 100 : 0;
    const subRate = wins > 0 ? (wins_submission / wins) * 100 : 0;
    const tdAvg = s.td_avg || 0;
    const slpm = s.slpm || 0;
    const strAcc = parsePct(s.striking_accuracy) || 0;
    const tdAcc = parsePct(s.td_accuracy) || 0;
    const strDef = parsePct(s.striking_defense) || 0;
    if (koRate >= 50)
      return {
        label: "KNOCKOUT ARTIST",
        icon: "🔥",
        cls: "text-red-400 border-red-700/40 bg-red-950/50",
      };
    if (subRate >= 40)
      return {
        label: "SUBMISSION SPECIALIST",
        icon: "🔗",
        cls: "text-blue-400 border-blue-700/40 bg-blue-950/50",
      };
    if (tdAvg >= 2.5 && tdAcc >= 40)
      return {
        label: "WRESTLING MACHINE",
        icon: "🤼",
        cls: "text-emerald-400 border-emerald-700/40 bg-emerald-950/50",
      };
    if (slpm >= 5 && strAcc >= 45)
      return {
        label: "VOLUME STRIKER",
        icon: "⚡",
        cls: "text-yellow-400 border-yellow-700/40 bg-yellow-950/50",
      };
    if (finish_rate_pct >= 65)
      return {
        label: "FINISHER",
        icon: "💥",
        cls: "text-orange-400 border-orange-700/40 bg-orange-950/50",
      };
    if (strDef >= 62)
      return {
        label: "COUNTER STRIKER",
        icon: "🛡",
        cls: "text-violet-400 border-violet-700/40 bg-violet-950/50",
      };
    return null;
  }, [profile]);

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
      <div className="min-h-screen bg-stone-950 animate-pulse">
        {/* Hero skeleton */}
        <div className="bg-stone-900/50 border-b border-stone-800/50">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 flex flex-col sm:flex-row gap-8 items-end">
            <div className="w-44 h-56 sm:w-56 sm:h-72 bg-stone-800 rounded-2xl flex-shrink-0 mx-auto sm:mx-0" />
            <div className="flex-1 space-y-4 text-center sm:text-left">
              <div className="h-3 w-32 bg-stone-800 rounded mx-auto sm:mx-0" />
              <div className="h-12 w-72 bg-stone-800 rounded mx-auto sm:mx-0" />
              <div className="h-5 w-48 bg-stone-800 rounded mx-auto sm:mx-0" />
              <div className="h-9 w-24 bg-stone-800 rounded mx-auto sm:mx-0" />
              <div className="flex gap-2 justify-center sm:justify-start">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-14 w-16 bg-stone-800 rounded-lg" />
                ))}
              </div>
            </div>
          </div>
        </div>
        {/* Body skeleton */}
        <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-5">
            {[200, 280, 320].map((h, i) => (
              <div
                key={i}
                className="bg-stone-900 rounded-xl"
                style={{ height: h }}
              />
            ))}
          </div>
          <div className="space-y-5">
            {[160, 200, 120].map((h, i) => (
              <div
                key={i}
                className="bg-stone-900 rounded-xl"
                style={{ height: h }}
              />
            ))}
          </div>
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

  // Portrait fallback chain: UFC CDN → Sherdog CDN → initials placeholder
  const portraitSources = [ufc_image_url, sherdogPortrait(sherdog_url)].filter(
    Boolean,
  );
  const portraitUrl = portraitSources[portraitIdx] ?? null;

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
      <div className="relative overflow-hidden bg-stone-900">
        {/* Blurred portrait backdrop */}
        {portraitUrl && (
          <div
            className="absolute inset-0 opacity-20 bg-center bg-cover blur-2xl scale-125"
            style={{ backgroundImage: `url(${portraitUrl})` }}
          />
        )}
        {/* Dark vignette overlay */}
        <div className="absolute inset-0 bg-gradient-to-b from-stone-950/60 via-stone-950/40 to-stone-950" />
        <div className="absolute inset-0 bg-gradient-to-r from-stone-950/80 via-transparent to-stone-950/60" />

        {/* Top classification tape */}
        <div className="relative border-b border-yellow-800/20 bg-stone-950/60">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-2 flex items-center gap-3">
            <span className="text-[8px] font-mono text-yellow-800 tracking-[0.5em]">
              ◆ CLASSIFICATION: COMBAT DOSSIER ◆
            </span>
            <div className="flex-1 h-px bg-yellow-900/30" />
            <Link
              to="/fighters"
              className="text-[9px] font-mono text-stone-600 hover:text-yellow-600 transition-colors tracking-wider"
            >
              ← ALL FIGHTERS
            </Link>
          </div>
        </div>

        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
          <div className="flex flex-col sm:flex-row gap-8 items-center sm:items-end">
            {/* ── Portrait ── */}
            <div className="relative flex-shrink-0 flex flex-col items-center">
              {portraitUrl ? (
                <img
                  src={portraitUrl}
                  alt={name}
                  className="w-44 h-56 sm:w-56 sm:h-72 md:w-64 md:h-80 object-cover object-top rounded-2xl border border-stone-600/50 shadow-[0_25px_80px_rgba(0,0,0,0.8)]"
                  onError={() => {
                    // Try next source in the chain; if exhausted, portraitUrl goes null and placeholder renders
                    setPortraitIdx((prev) => prev + 1);
                  }}
                />
              ) : (
                <div className="w-44 h-56 sm:w-56 sm:h-72 rounded-2xl border border-stone-700/50 bg-stone-800/80 flex flex-col items-center justify-center gap-3">
                  <span className="text-5xl font-black text-stone-600 font-mono">
                    {(name || "?")
                      .split(" ")
                      .map((w) => w[0] || "")
                      .join("")
                      .slice(0, 2)
                      .toUpperCase()}
                  </span>
                  <span className="text-[9px] font-mono text-stone-700 tracking-widest">
                    NO PHOTO
                  </span>
                </div>
              )}
              {currentCardMatch && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap bg-yellow-500 text-stone-950 text-[9px] font-mono font-black px-3 py-1 rounded-full shadow-lg tracking-widest">
                  ● FIGHTS THIS WEEK
                </div>
              )}
            </div>

            {/* ── Bio block ── */}
            <div className="flex-1 min-w-0 text-center sm:text-left">
              {/* Name */}
              <h1 className="text-4xl sm:text-5xl md:text-6xl font-black text-white tracking-tighter leading-none uppercase">
                {name}
              </h1>
              {nickname && (
                <p className="text-yellow-500/60 font-mono italic text-base mt-2">
                  "{nickname}"
                </p>
              )}

              {/* Combat archetype badge */}
              {styleArchetype && (
                <div
                  className={`inline-flex items-center gap-1.5 mt-2.5 text-[10px] font-mono font-black px-3 py-1 rounded-full border ${styleArchetype.cls}`}
                >
                  <span>{styleArchetype.icon}</span>
                  <span>{styleArchetype.label}</span>
                </div>
              )}

              {/* Record + streaks */}
              <div className="flex items-baseline gap-3 mt-3 justify-center sm:justify-start flex-wrap">
                <span className="text-3xl font-black text-yellow-400 font-mono tracking-tighter">
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

              {/* Last-5 form dots */}
              {fight_history.length > 0 && (
                <div className="flex items-center gap-1.5 mt-2 justify-center sm:justify-start">
                  <span className="text-[8px] font-mono text-stone-600 tracking-wider mr-0.5">
                    FORM
                  </span>
                  {fight_history.slice(0, 5).map((f, i) => {
                    const r = (f.result || "").toLowerCase();
                    return (
                      <div
                        key={i}
                        title={`${r.toUpperCase()} vs ${f.opponent || ""}`}
                        className={`w-2.5 h-2.5 rounded-full ${
                          r === "win"
                            ? "bg-emerald-500"
                            : r === "loss"
                              ? "bg-red-500"
                              : "bg-stone-600"
                        }`}
                      />
                    );
                  })}
                </div>
              )}

              {/* Tag pills */}
              <div className="flex flex-wrap gap-1.5 mt-3 justify-center sm:justify-start">
                {weight_class && (
                  <span className="text-[10px] font-mono bg-yellow-900/30 text-yellow-500/80 px-2.5 py-1 rounded border border-yellow-800/40">
                    {weight_class.toUpperCase()}
                  </span>
                )}
                {nationality && (
                  <span className="text-[10px] font-mono bg-stone-800/70 text-stone-400 px-2.5 py-1 rounded border border-stone-700/40">
                    🌐 {nationality}
                  </span>
                )}
                {team && (
                  <span className="text-[10px] font-mono bg-stone-800/70 text-stone-400 px-2.5 py-1 rounded border border-stone-700/40">
                    🏛 {team}
                  </span>
                )}
                {stance && (
                  <span className="text-[10px] font-mono bg-stone-800/70 text-stone-400 px-2.5 py-1 rounded border border-stone-700/40">
                    🥊 {stance}
                  </span>
                )}
              </div>

              {/* Physical measurements */}
              {(height || reach || age || dob) && (
                <div className="flex flex-wrap gap-x-5 gap-y-1 mt-2 justify-center sm:justify-start text-xs font-mono text-stone-500">
                  {height && <span>{height}</span>}
                  {reach && <span>{reach} reach</span>}
                  {age && <span>{age} yrs</span>}
                  {dob && dob !== "N/A" && <span>b. {dob}</span>}
                </div>
              )}

              {/* Quick stat pills */}
              <div className="flex flex-wrap gap-2 mt-4 justify-center sm:justify-start">
                {finish_rate_pct > 0 && (
                  <div className="bg-red-900/25 border border-red-800/30 rounded-lg px-3 py-2 text-center min-w-[56px]">
                    <p className="text-base font-black text-red-400">
                      {finish_rate_pct}%
                    </p>
                    <p className="text-[8px] text-stone-500 font-mono">
                      FINISH
                    </p>
                  </div>
                )}
                {record_last_5 && (
                  <div className="bg-stone-800/60 border border-stone-700/30 rounded-lg px-3 py-2 text-center min-w-[56px]">
                    <p className="text-base font-black text-white">
                      {record_last_5}
                    </p>
                    <p className="text-[8px] text-stone-500 font-mono">
                      LAST 5
                    </p>
                  </div>
                )}
                {wins_ko_tko > 0 && (
                  <div className="bg-orange-900/20 border border-orange-800/30 rounded-lg px-3 py-2 text-center min-w-[56px]">
                    <p className="text-base font-black text-orange-400">
                      {wins_ko_tko}
                    </p>
                    <p className="text-[8px] text-stone-500 font-mono">
                      KO/TKO
                    </p>
                  </div>
                )}
                {wins_submission > 0 && (
                  <div className="bg-blue-900/20 border border-blue-800/30 rounded-lg px-3 py-2 text-center min-w-[56px]">
                    <p className="text-base font-black text-blue-400">
                      {wins_submission}
                    </p>
                    <p className="text-[8px] text-stone-500 font-mono">SUBS</p>
                  </div>
                )}
                {stats.slpm != null && (
                  <div className="bg-stone-800/60 border border-stone-700/30 rounded-lg px-3 py-2 text-center min-w-[56px]">
                    <p className="text-base font-black text-white">
                      {num(stats.slpm)}
                    </p>
                    <p className="text-[8px] text-stone-500 font-mono">SLpM</p>
                  </div>
                )}
                {stats.td_avg != null && (
                  <div className="bg-stone-800/60 border border-stone-700/30 rounded-lg px-3 py-2 text-center min-w-[56px]">
                    <p className="text-base font-black text-white">
                      {num(stats.td_avg)}
                    </p>
                    <p className="text-[8px] text-stone-500 font-mono">
                      TD/15m
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Body content ── */}
      <div className="max-w-6xl mx-auto px-4 pt-6 pb-16 grid grid-cols-1 lg:grid-cols-3 gap-6">
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
                  label="Sig. Strikes Landed / min"
                  value={num(stats.slpm)}
                  isHighlight
                  bar={{
                    pct: ((stats.slpm || 0) / 10) * 100,
                    color: "bg-yellow-500/80",
                  }}
                />
                <StatRow
                  label="Sig. Strikes Absorbed / min"
                  value={num(stats.sapm)}
                  bar={{
                    pct: ((stats.sapm || 0) / 8) * 100,
                    color: "bg-red-500/70",
                  }}
                />
                <StatRow
                  label="Striking Accuracy"
                  value={pct(stats.striking_accuracy)}
                  isHighlight
                  bar={{
                    pct: parsePct(stats.striking_accuracy),
                    color: "bg-yellow-600/80",
                  }}
                />
                <StatRow
                  label="Striking Defense"
                  value={pct(stats.striking_defense)}
                  bar={{
                    pct: parsePct(stats.striking_defense),
                    color: "bg-emerald-600/70",
                  }}
                />
              </div>
            )}
            {statsTab === "grappling" && (
              <div className="space-y-0.5">
                <StatRow
                  label="Takedowns / 15 min"
                  value={num(stats.td_avg)}
                  isHighlight
                  bar={{
                    pct: ((stats.td_avg || 0) / 5) * 100,
                    color: "bg-blue-500/80",
                  }}
                />
                <StatRow
                  label="Takedown Accuracy"
                  value={pct(stats.td_accuracy)}
                  bar={{
                    pct: parsePct(stats.td_accuracy),
                    color: "bg-blue-600/70",
                  }}
                />
                <StatRow
                  label="Takedown Defense"
                  value={pct(stats.td_defense)}
                  isHighlight
                  bar={{
                    pct: parsePct(stats.td_defense),
                    color: "bg-emerald-600/70",
                  }}
                />
                <StatRow
                  label="Sub Attempts / 15 min"
                  value={num(stats.avg_sub_attempts)}
                  bar={{
                    pct: ((stats.avg_sub_attempts || 0) / 3) * 100,
                    color: "bg-violet-500/70",
                  }}
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
                            <td
                              className={`px-2 py-2.5 font-mono ${methodColorCls(fight.method)}`}
                            >
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

          {/* ── 5. Highlight Reel ── */}
          {highlightVideoId && (
            <div className="bg-stone-900 border border-stone-700/50 rounded-xl overflow-hidden">
              <div className="px-5 pt-5 pb-3">
                <ClassifiedBanner text="INTEL FOOTAGE" />
                <SectionHeader
                  icon="🎬"
                  title="Highlight Reel"
                  subtitle={name}
                />
              </div>
              <div className="relative aspect-video">
                <iframe
                  src={`https://www.youtube.com/embed/${highlightVideoId}?rel=0&modestbranding=1`}
                  title={`${name} UFC highlights`}
                  className="absolute inset-0 w-full h-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  loading="lazy"
                />
              </div>
            </div>
          )}
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

            {(() => {
              // Derive opponent name from currentCardMatch if available
              const oppName = (() => {
                if (!currentCardMatch) return "Opponent";
                const { fighters } = currentCardMatch;
                const opp = (fighters || []).find(
                  (f) =>
                    (f.name || f.fighter_name || "").toLowerCase() !==
                    (name || "").toLowerCase(),
                );
                return opp
                  ? opp.name || opp.fighter_name || "Opponent"
                  : "Opponent";
              })();

              return (
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
                    {oppName} wins
                  </button>
                </div>
              );
            })()}

            {/* Vote bar */}
            {totalVotes > 0 && (
              <div className="mt-4 space-y-1.5">
                {(() => {
                  const oppLabel = (() => {
                    if (!currentCardMatch) return "Opponent";
                    const { fighters } = currentCardMatch;
                    const opp = (fighters || []).find(
                      (f) =>
                        (f.name || f.fighter_name || "").toLowerCase() !==
                        (name || "").toLowerCase(),
                    );
                    return opp
                      ? opp.name || opp.fighter_name || "Opponent"
                      : "Opponent";
                  })();
                  return (
                    <>
                      <div className="flex justify-between text-[9px] font-mono text-stone-500">
                        <span className="truncate max-w-[80px]">{name}</span>
                        <span>{totalVotes.toLocaleString()} votes</span>
                        <span className="truncate max-w-[80px] text-right">
                          {oppLabel}
                        </span>
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
                    </>
                  );
                })()}
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

          {/* ── DFS Insights (current-card only) ── */}
          {currentCardMatch &&
            (() => {
              const f = currentCardMatch.fighter;
              const salary = f?.salary;
              const avgPts = f?.avgPointsPerGame;
              if (!salary && !avgPts) return null;
              const ptsPerK =
                avgPts && salary ? avgPts / (salary / 1000) : null;
              const valueTier =
                ptsPerK == null
                  ? null
                  : ptsPerK >= 12
                    ? {
                        label: "STRONG VALUE",
                        cls: "text-emerald-400 bg-emerald-900/25 border-emerald-800/40",
                      }
                    : ptsPerK >= 10
                      ? {
                          label: "SOLID",
                          cls: "text-yellow-400 bg-yellow-900/25 border-yellow-800/40",
                        }
                      : ptsPerK >= 8
                        ? {
                            label: "NEUTRAL",
                            cls: "text-stone-300 bg-stone-800/60 border-stone-700/40",
                          }
                        : {
                            label: "HIGH COST",
                            cls: "text-red-400 bg-red-900/25 border-red-800/40",
                          };
              return (
                <div className="bg-stone-900 border border-yellow-800/30 rounded-xl p-4">
                  <ClassifiedBanner text="DFS INTEL — DRAFTKINGS" />
                  <SectionHeader icon="💰" title="DFS Projection" />
                  <div className="space-y-2">
                    {salary && (
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] font-mono text-stone-500">
                          DK SALARY
                        </span>
                        <span className="text-sm font-black text-white font-mono">
                          ${salary.toLocaleString()}
                        </span>
                      </div>
                    )}
                    {avgPts && (
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] font-mono text-stone-500">
                          AVG PTS / GAME
                        </span>
                        <span className="text-sm font-black text-yellow-400 font-mono">
                          {avgPts.toFixed(1)}
                        </span>
                      </div>
                    )}
                    {ptsPerK && (
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] font-mono text-stone-500">
                          PTS / $1K
                        </span>
                        <span className="text-sm font-black text-stone-300 font-mono">
                          {ptsPerK.toFixed(1)}
                        </span>
                      </div>
                    )}
                    {valueTier && (
                      <div
                        className={`mt-3 text-center text-[10px] font-mono font-bold px-3 py-1.5 rounded border ${valueTier.cls}`}
                      >
                        {valueTier.label}
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}

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
