import React, { useState, useEffect, useCallback } from "react";
import api from "../services/api";

// ─────────────────────────────────────────────────────────────────────────────
// YouTube Data API v3 key (optional).  If set, the component will search for
// the first matching video and show a real thumbnail + embed iframe.
// Leave empty ("") to fall back to a styled YouTube-search card.
// ─────────────────────────────────────────────────────────────────────────────
const YOUTUBE_API_KEY = "";

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Query YouTube Data API v3 for a fighter's highlight reel.
 *  Returns { videoId, title, thumbnail } or null when no key / no results. */
async function fetchFirstYouTubeVideo(query) {
  if (!YOUTUBE_API_KEY) return null;
  try {
    const url =
      `https://www.googleapis.com/youtube/v3/search` +
      `?part=snippet&maxResults=1&type=video` +
      `&q=${encodeURIComponent(query)}` +
      `&key=${YOUTUBE_API_KEY}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const json = await res.json();
    const item = json.items?.[0];
    if (!item) return null;
    const videoId = item.id.videoId;
    return {
      videoId,
      title: item.snippet.title,
      thumbnail:
        item.snippet.thumbnails?.high?.url ||
        `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
    };
  } catch {
    return null;
  }
}

/** Extract the opponent name from a matchup string given one fighter's name. */
function getOpponent(matchup = "", fighterName = "") {
  return (
    (matchup || "")
      .replace(fighterName, "")
      .replace(/\bvs\.?\b/gi, "")
      .trim() || "TBD"
  );
}

// ─── Shield SVG ──────────────────────────────────────────────────────────────
const Shield = ({ accent = "#fbbf24", fill = "#1c1a13", size = 44 }) => (
  <svg
    viewBox="0 0 200 265"
    width={size}
    height={size * 1.325}
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <defs>
      <linearGradient
        id={`vv2-grad-${accent.replace("#", "")}`}
        x1="0%"
        y1="0%"
        x2="60%"
        y2="100%"
      >
        <stop offset="0%" stopColor={accent} stopOpacity="0.7" />
        <stop offset="100%" stopColor={fill} stopOpacity="1" />
      </linearGradient>
    </defs>
    <path
      d="M 22,0 L 178,0 Q 200,0 200,22 L 200,158 Q 200,192 100,265 Q 0,192 0,158 L 0,22 Q 0,0 22,0 Z"
      fill={`url(#vv2-grad-${accent.replace("#", "")})`}
      stroke={accent}
      strokeWidth="4"
    />
    <path
      d="M 30,10 L 170,10 Q 188,10 188,30 L 188,155 Q 188,184 100,249 Q 12,184 12,155 L 12,30 Q 12,10 30,10 Z"
      fill="none"
      stroke={accent}
      strokeWidth="1.5"
      strokeOpacity="0.4"
    />
    <text
      x="100"
      y="148"
      textAnchor="middle"
      fill={accent}
      fontSize="72"
      fontFamily="'Impact', sans-serif"
      fontWeight="bold"
      opacity="0.25"
    >
      ✦
    </text>
  </svg>
);

// ─── Accent palette ───────────────────────────────────────────────────────────
const ACCENTS = [
  "#fbbf24",
  "#ea8c34",
  "#a3a830",
  "#d6c68a",
  "#f59e0b",
  "#c084fc",
  "#38bdf8",
  "#4ade80",
  "#fb7185",
  "#a78bfa",
];

// ─── Curated vault videos ─────────────────────────────────────────────────────
const curatedVideos = [
  {
    title: "Bambi Meets Godzilla (1969 Animation)",
    url: "https://www.youtube.com/watch?v=5R-rbzcEM8A",
  },
  {
    title: "Godzilla vs Bambi (Fan Animation)",
    url: "https://www.youtube.com/watch?v=b8zOPlGjJU0",
  },
  {
    title: "1 Man vs 2 Women MMA (RXF Romania Match)",
    url: "https://www.youtube.com/watch?v=LzTuulD6g",
  },
  {
    title: "Female MMA Fighter vs Fat Man (Epic Mismatch)",
    url: "https://www.youtube.com/watch?v=ojBjiFaG5Iw",
  },
  {
    title: "2 Women vs 1 Man Pillow Fight-Style (Bulgarian Weird Fight)",
    url: "https://www.youtube.com/watch?v=IoeuV4Y8kGs",
  },
  {
    title: "Weird Bulgarian Ultras Street Fight",
    url: "https://www.youtube.com/watch?v=lWSQz_t_tWWvA",
  },
  {
    title: "20 Weirdest MMA Moments Compilation",
    url: "https://www.youtube.com/watch?v=ZTGtUrI-t1k",
  },
  {
    title: "Strange and Funny Fights Playlist",
    url: "https://www.youtube.com/playlist?list=PLGqkiMCyZ_6kVBV-ISO8-DctlwcKQY--z",
  },
  {
    title: "Ridiculous MMA Fight Endings",
    url: "https://www.youtube.com/watch?v=QnKIhrtvM3A",
  },
  {
    title: "Hilarious Fight Opening Moments",
    url: "https://www.youtube.com/watch?v=k_1wZ_t_tWWvA",
  },
  {
    title: "Craziest Women's MMA Fights Marathon",
    url: "https://www.youtube.com/watch?v=Wn4uZdJK3woE",
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// FighterCard — shows shield, info, YouTube thumbnail or search fallback.
// Click the thumbnail → expands inline iframe embed.
// ─────────────────────────────────────────────────────────────────────────────
const FighterCard = ({ fighter, accent, matchup }) => {
  // null = not loaded, false = API miss / no key, object = { videoId, title, thumbnail }
  const [ytData, setYtData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [playing, setPlaying] = useState(false);

  const query = `${fighter.name} UFC MMA highlights`;
  const ytSearch = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
  const opponent = getOpponent(matchup, fighter.name);

  const handleFindClick = useCallback(async () => {
    if (ytData !== null) {
      // Already loaded — if we have a video ID, toggle the embed
      if (ytData && ytData.videoId) setPlaying((p) => !p);
      return;
    }
    setLoading(true);
    const result = await fetchFirstYouTubeVideo(query);
    setYtData(result || false); // false = no API key / no results
    setLoading(false);
    if (result?.videoId) setPlaying(true);
  }, [ytData, query]);

  const salaryLabel = fighter.salary
    ? fighter.salary >= 8500
      ? "HIGH-VALUE"
      : "ASSET"
    : null;

  return (
    <div
      className="group relative flex flex-col bg-stone-900 border rounded-lg overflow-hidden transition-all duration-300 hover:scale-[1.01]"
      style={{ borderColor: `${accent}30`, boxShadow: `0 0 20px ${accent}14` }}
    >
      {/* ── Header strip ─────────────────────────────── */}
      <div
        className="flex items-center gap-3 px-4 pt-4 pb-3"
        style={{ borderBottom: `1px solid ${accent}20` }}
      >
        <Shield accent={accent} fill="#0f0e09" size={44} />
        <div className="flex-1 min-w-0">
          <p
            className="text-sm font-bold uppercase tracking-wide truncate leading-tight"
            style={{ color: accent }}
          >
            {fighter.name}
          </p>
          <p className="text-stone-500 text-[10px] tracking-wider mt-0.5">
            {fighter.record && fighter.record !== "N/A" ? fighter.record : "—"}
            {" · "}vs. {opponent}
          </p>
          <p className="text-stone-600 text-[10px] tracking-wide">
            {fighter.weight_class || ""}
          </p>
        </div>
        {salaryLabel && (
          <span
            className="shrink-0 text-[9px] font-bold tracking-widest px-1.5 py-0.5 rounded self-start"
            style={{
              color: accent,
              background: `${accent}18`,
              border: `1px solid ${accent}30`,
            }}
          >
            {salaryLabel}
          </span>
        )}
      </div>

      {/* ── Salary / stats row ────────────────────────── */}
      <div className="flex items-center justify-between px-4 py-2 text-[10px] text-stone-500">
        {fighter.salary ? (
          <span style={{ color: accent }}>
            DK{" "}
            <span className="font-bold">
              ${fighter.salary.toLocaleString()}
            </span>
          </span>
        ) : (
          <span />
        )}
        {fighter.avgPointsPerGame != null && (
          <span>
            Avg{" "}
            <span className="font-semibold text-stone-300">
              {Number(fighter.avgPointsPerGame).toFixed(1)}
            </span>{" "}
            pts
          </span>
        )}
        {fighter.finish_rate_pct != null && (
          <span>
            Fin{" "}
            <span className="font-semibold text-stone-300">
              {Number(fighter.finish_rate_pct).toFixed(0)}%
            </span>
          </span>
        )}
      </div>

      {/* ── YouTube area ─────────────────────────────── */}
      <div className="px-4 pb-4 flex-1 flex flex-col justify-end">
        {/* State: playing — show iframe embed */}
        {playing && ytData?.videoId && (
          <div
            className="relative w-full mb-3 rounded overflow-hidden"
            style={{ paddingTop: "56.25%" /* 16:9 */ }}
          >
            <iframe
              className="absolute inset-0 w-full h-full"
              src={`https://www.youtube.com/embed/${ytData.videoId}?rel=0&autoplay=1`}
              title={ytData.title}
              allow="autoplay; encrypted-media"
              allowFullScreen
              loading="lazy"
            />
          </div>
        )}

        {/* State: have thumbnail but not playing — show thumbnail with play overlay */}
        {!playing && ytData?.thumbnail && (
          <button
            onClick={() => setPlaying(true)}
            className="relative w-full mb-3 rounded overflow-hidden block group/thumb"
            style={{ paddingTop: "56.25%" }}
            aria-label="Play highlights"
          >
            <img
              src={ytData.thumbnail}
              alt={ytData.title}
              className="absolute inset-0 w-full h-full object-cover"
            />
            {/* play button overlay */}
            <span className="absolute inset-0 flex items-center justify-center bg-black/40 group-hover/thumb:bg-black/20 transition">
              <span
                className="flex items-center justify-center w-12 h-12 rounded-full"
                style={{ background: accent }}
              >
                <svg viewBox="0 0 24 24" className="w-6 h-6 fill-stone-950">
                  <polygon points="5,3 19,12 5,21" />
                </svg>
              </span>
            </span>
          </button>
        )}

        {/* State: ytData loaded but false (no API key / no results) — already handled by fallback below */}
        {/* State: no API key — show search CTA directly */}
        {ytData === false && (
          <p className="text-[9px] text-stone-600 text-center mb-2 tracking-wide">
            No API key — opens YouTube search
          </p>
        )}

        {/* Primary action button */}
        {YOUTUBE_API_KEY ? (
          /* With API key: fetch + play button */
          <button
            onClick={handleFindClick}
            disabled={loading}
            className="w-full text-center text-[11px] font-bold tracking-widest uppercase py-2 rounded transition-all duration-200 disabled:opacity-50"
            style={{ color: "#0f0e09", background: accent }}
          >
            {loading
              ? "SEARCHING…"
              : playing
                ? "⏹ CLOSE"
                : ytData?.videoId
                  ? "▶ REPLAY"
                  : "▶ FIND HIGHLIGHTS"}
          </button>
        ) : (
          /* No API key: search link */
          <a
            href={ytSearch}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full text-center text-[11px] font-bold tracking-widest uppercase py-2 rounded transition-all duration-200 block"
            style={{ color: "#0f0e09", background: accent }}
          >
            ▶ SEARCH HIGHLIGHTS
          </a>
        )}
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// FightSection — collapsible accordion card for one fight matchup.
// ─────────────────────────────────────────────────────────────────────────────
const FightSection = ({ fight, fightIndex }) => {
  const [open, setOpen] = useState(false);

  const accent1 = ACCENTS[(fightIndex * 2) % ACCENTS.length];
  const accent2 = ACCENTS[(fightIndex * 2 + 1) % ACCENTS.length];

  const ml = fight.betting_odds;
  const oddsLine = ml
    ? (() => {
        const a = ml.fighter1_moneyline;
        const b = ml.fighter2_moneyline;
        if (a && b && a !== "N/A" && b !== "N/A") return `${a} / ${b}`;
        if (ml.over_under_rounds && ml.over_under_rounds !== "N/A")
          return `O/U ${ml.over_under_rounds}`;
        return null;
      })()
    : null;

  return (
    <div
      className="rounded-lg overflow-hidden border mb-3 transition-all duration-200"
      style={{
        borderColor: open ? `${accent1}50` : "#3a3530",
        boxShadow: open ? `0 0 24px ${accent1}18` : "none",
      }}
    >
      {/* ── Accordion header / toggle ───────────────── */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-5 py-4 text-left transition-colors duration-200 hover:bg-stone-800/60 bg-stone-900/80"
      >
        <div className="flex items-center gap-3 min-w-0">
          {/* Mini shield pair */}
          <span style={{ opacity: 0.85 }}>
            <Shield accent={accent1} fill="#0f0e09" size={22} />
          </span>
          <span className="text-stone-600 text-xs mx-0.5">vs</span>
          <span style={{ opacity: 0.85 }}>
            <Shield accent={accent2} fill="#0f0e09" size={22} />
          </span>
          <div className="min-w-0 ml-1">
            <p className="text-stone-100 text-sm font-semibold tracking-wide truncate">
              {fight.matchup}
            </p>
            <p className="text-stone-500 text-[10px] tracking-wider">
              {fight.weight_class || ""}
              {oddsLine ? ` · ${oddsLine}` : ""}
            </p>
          </div>
        </div>
        {/* Chevron */}
        <span
          className="shrink-0 ml-3 text-stone-400 text-xs transition-transform duration-200"
          style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)" }}
        >
          ▾
        </span>
      </button>

      {/* ── Expanded body ───────────────────────────── */}
      {open && (
        <div
          className="bg-stone-950/60 px-4 pt-4 pb-5 border-t"
          style={{ borderColor: "#3a3530" }}
        >
          {/* Betting odds summary row */}
          {ml && (
            <div className="flex flex-wrap gap-3 mb-4 justify-center">
              {[
                { label: "F1 ML", val: ml.fighter1_moneyline },
                { label: "F2 ML", val: ml.fighter2_moneyline },
                { label: "O/U Rounds", val: ml.over_under_rounds },
                { label: "Method", val: ml.method_odds },
              ].map(({ label, val }) =>
                val && val !== "N/A" ? (
                  <span
                    key={label}
                    className="text-[10px] tracking-wide px-2 py-0.5 rounded bg-stone-800 border border-stone-700 text-stone-300"
                  >
                    <span className="text-stone-500">{label}: </span>
                    {val}
                  </span>
                ) : null,
              )}
            </div>
          )}

          {/* Fighter cards grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {(fight.fighters || []).map((fighter, idx) => (
              <FighterCard
                key={idx}
                fighter={fighter}
                accent={idx === 0 ? accent1 : accent2}
                matchup={fight.matchup}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// VideosV2 — main page component
// ─────────────────────────────────────────────────────────────────────────────
const VideosV2 = () => {
  const [fights, setFights] = useState([]);
  const [eventName, setEventName] = useState("This Week's Card");
  const [loading, setLoading] = useState(true);
  const [allOpen, setAllOpen] = useState(false);

  // ── useEffect: fetch /this_weeks_stats.json ──────────────────────────────
  // Before:  (VideoVault) flattened fighters into a flat grid — no grouping
  // After:   keeps fights array intact so FightSection renders per-matchup
  useEffect(() => {
    api.get("/api/this-weeks-stats")
      .then((data) => {
        // data.event may be an object {name, date, location} or a plain string
        if (data.event) setEventName(data.event.name || data.event);
        setFights(data.fights || []);
        setLoading(false);
      })
      .catch((err) => {
        console.error("VideosV2: failed to load stats", err);
        setLoading(false);
      });
  }, []);

  return (
    <div
      className="min-h-screen bg-stone-950"
      style={{ fontFamily: "'Courier New', monospace" }}
    >
      {/* ── Classification banner ────────────────────────────────────────── */}
      <div className="flex items-center justify-between border-b border-yellow-700/40 bg-yellow-900/10 px-6 py-2">
        <span className="text-yellow-500 text-xs font-bold tracking-widest uppercase">
          ⚡ CLASSIFIED FOOTAGE
        </span>
        <span className="text-yellow-500/50 text-xs tracking-wider hidden sm:block">
          CLEARANCE: LEVEL 5
        </span>
        <span className="text-yellow-500 text-xs font-bold tracking-widest uppercase">
          ARCHIVE ACCESS ⚡
        </span>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-10">
        {/* ── Page header ─────────────────────────────────────────────────── */}
        <div className="text-center mb-10">
          <p className="text-xs text-stone-500 tracking-[0.5em] uppercase mb-2">
            ◆ OPERATION COMBAT VAULT — VIDEO DIVISION ◆
          </p>
          <h1
            className="text-4xl md:text-5xl font-black text-stone-100 tracking-wider uppercase"
            style={{
              fontFamily: "'Impact', sans-serif",
              textShadow: "2px 2px 0 #4a5240, 0 0 40px rgba(100,120,80,0.3)",
            }}
          >
            VIDEO <span className="text-yellow-600">VAULT</span>{" "}
            <span className="text-2xl text-stone-500 align-middle">v2</span>
          </h1>
          <div className="w-32 h-px bg-gradient-to-r from-transparent via-yellow-700 to-transparent mx-auto mt-3" />
          {!YOUTUBE_API_KEY && (
            <p className="text-stone-600 text-[10px] mt-3 tracking-wide">
              Add a YouTube Data v3 API key in{" "}
              <code className="text-stone-400">VideosV2.jsx</code> to enable
              inline thumbnails &amp; embeds.
            </p>
          )}
        </div>

        {/* ── Fighter Highlights by Matchup ───────────────────────────────── */}
        <section className="mb-14">
          <div className="flex items-center gap-3 mb-2">
            <div className="h-px flex-1 bg-yellow-700/30" />
            <h2 className="text-xs font-bold tracking-[0.4em] uppercase text-yellow-600">
              ◈ FIGHTER INTELLIGENCE — {eventName}
            </h2>
            <div className="h-px flex-1 bg-yellow-700/30" />
          </div>

          {/* Expand/collapse all toggle */}
          <div className="flex justify-end mb-4">
            <button
              onClick={() => setAllOpen((o) => !o)}
              className="text-[10px] font-bold tracking-widest uppercase px-3 py-1.5 rounded border border-yellow-700/50 text-yellow-600 hover:bg-yellow-900/20 transition"
            >
              {allOpen ? "▲ COLLAPSE ALL" : "▼ EXPAND ALL"}
            </button>
          </div>

          {loading ? (
            <p className="text-center text-stone-500 tracking-widest animate-pulse py-10">
              LOADING ASSETS…
            </p>
          ) : fights.length === 0 ? (
            <p className="text-center text-stone-600 py-10">
              No fight data available.
            </p>
          ) : (
            /* Each FightSection is its own accordion; allOpen drives an internal
               prop so the parent can force-expand without controlling deep state */
            fights.map((fight, fi) => (
              <FightSectionControlled
                key={fi}
                fight={fight}
                fightIndex={fi}
                forceOpen={allOpen}
              />
            ))
          )}
        </section>

        {/* ── Event Highlights placeholder ─────────────────────────────────── */}
        <section className="mb-14">
          <div className="flex items-center gap-3 mb-6">
            <div className="h-px flex-1 bg-yellow-700/30" />
            <h2 className="text-xs font-bold tracking-[0.4em] uppercase text-yellow-600">
              ◈ EVENT HIGHLIGHTS — {eventName}
            </h2>
            <div className="h-px flex-1 bg-yellow-700/30" />
          </div>
          <div
            className="border rounded-lg p-8 text-center"
            style={{ borderColor: "#fbbf2430", background: "#fbbf2408" }}
          >
            <p className="text-yellow-600 text-xs tracking-[0.4em] uppercase mb-2">
              ◈ POST-FIGHT DEBRIEF
            </p>
            <p className="text-stone-400 text-sm mb-4">
              Event highlights will be added after the card concludes.
            </p>
            <a
              href={`https://www.youtube.com/results?search_query=${encodeURIComponent(eventName + " highlights")}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block text-[11px] font-bold tracking-widest uppercase px-4 py-2 rounded transition-all duration-200"
              style={{ color: "#0f0e09", background: "#fbbf24" }}
            >
              ▶ SEARCH EVENT HIGHLIGHTS
            </a>
          </div>
        </section>

        {/* ── Curated Vault ────────────────────────────────────────────────── */}
        <section>
          <div className="flex items-center gap-3 mb-6">
            <div className="h-px flex-1 bg-yellow-700/30" />
            <h2 className="text-xs font-bold tracking-[0.4em] uppercase text-yellow-600">
              ◈ CLASSIFIED ARCHIVE — UNUSUAL COMBAT FOOTAGE
            </h2>
            <div className="h-px flex-1 bg-yellow-700/30" />
          </div>
          <p className="text-stone-500 text-xs text-center mb-6 tracking-wide">
            Strange, funny, and weird fights for entertainment. Viewer
            discretion advised.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {curatedVideos.map((video, index) => (
              <div
                key={index}
                className="group bg-stone-900 border border-stone-700/50 rounded-lg p-4 flex flex-col items-center hover:border-yellow-700/50 hover:scale-[1.01] transition-all duration-300"
                style={{ boxShadow: "0 0 12px rgba(0,0,0,0.4)" }}
              >
                <p className="text-[10px] text-stone-600 tracking-widest uppercase mb-2">
                  FILE #{String(index + 1).padStart(2, "0")}
                </p>
                <h3 className="text-sm font-semibold text-stone-300 text-center mb-4 leading-snug">
                  {video.title}
                </h3>
                <a
                  href={video.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-auto text-[11px] font-bold tracking-widest uppercase px-4 py-2 rounded w-full text-center transition-all duration-200"
                  style={{ color: "#0f0e09", background: "#fbbf24" }}
                >
                  ▶ ACCESS FILE
                </a>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// FightSectionControlled — wraps FightSection, responds to forceOpen prop.
// ─────────────────────────────────────────────────────────────────────────────
const FightSectionControlled = ({ fight, fightIndex, forceOpen }) => {
  const [open, setOpen] = useState(false);

  // Sync open state when parent toggles "expand all"
  useEffect(() => {
    setOpen(forceOpen);
  }, [forceOpen]);

  const accent1 = ACCENTS[(fightIndex * 2) % ACCENTS.length];
  const accent2 = ACCENTS[(fightIndex * 2 + 1) % ACCENTS.length];

  const ml = fight.betting_odds;
  const oddsLine = ml
    ? (() => {
        const a = ml.fighter1_moneyline;
        const b = ml.fighter2_moneyline;
        if (a && b && a !== "N/A" && b !== "N/A") return `${a} / ${b}`;
        if (ml.over_under_rounds && ml.over_under_rounds !== "N/A")
          return `O/U ${ml.over_under_rounds}`;
        return null;
      })()
    : null;

  return (
    <div
      className="rounded-lg overflow-hidden border mb-3 transition-all duration-200"
      style={{
        borderColor: open ? `${accent1}50` : "#3a3530",
        boxShadow: open ? `0 0 24px ${accent1}18` : "none",
      }}
    >
      {/* Accordion header */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-5 py-4 text-left transition-colors duration-200 hover:bg-stone-800/60 bg-stone-900/80"
      >
        <div className="flex items-center gap-3 min-w-0">
          <span style={{ opacity: 0.85 }}>
            <Shield accent={accent1} fill="#0f0e09" size={22} />
          </span>
          <span className="text-stone-600 text-xs mx-0.5">vs</span>
          <span style={{ opacity: 0.85 }}>
            <Shield accent={accent2} fill="#0f0e09" size={22} />
          </span>
          <div className="min-w-0 ml-1">
            <p className="text-stone-100 text-sm font-semibold tracking-wide truncate">
              {fight.matchup}
            </p>
            <p className="text-stone-500 text-[10px] tracking-wider">
              {fight.weight_class || ""}
              {oddsLine ? ` · ${oddsLine}` : ""}
            </p>
          </div>
        </div>
        <span
          className="shrink-0 ml-3 text-stone-400 text-xs transition-transform duration-200"
          style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)" }}
        >
          ▾
        </span>
      </button>

      {/* Expanded body */}
      {open && (
        <div
          className="bg-stone-950/60 px-4 pt-4 pb-5 border-t"
          style={{ borderColor: "#3a3530" }}
        >
          {/* Odds row */}
          {ml && (
            <div className="flex flex-wrap gap-3 mb-4 justify-center">
              {[
                { label: "F1 ML", val: ml.fighter1_moneyline },
                { label: "F2 ML", val: ml.fighter2_moneyline },
                { label: "O/U", val: ml.over_under_rounds },
                { label: "Method", val: ml.method_odds },
              ].map(({ label, val }) =>
                val && val !== "N/A" ? (
                  <span
                    key={label}
                    className="text-[10px] tracking-wide px-2 py-0.5 rounded bg-stone-800 border border-stone-700 text-stone-300"
                  >
                    <span className="text-stone-500">{label}: </span>
                    {val}
                  </span>
                ) : null,
              )}
            </div>
          )}

          {/* Fighter cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {(fight.fighters || []).map((fighter, idx) => (
              <FighterCard
                key={idx}
                fighter={fighter}
                accent={idx === 0 ? accent1 : accent2}
                matchup={fight.matchup}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default VideosV2;
