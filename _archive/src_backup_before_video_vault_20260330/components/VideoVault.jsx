import React, { useState, useEffect } from "react";

// ─── Shield SVG (simplified heater shape, reused per card) ─────────────────
const Shield = ({ accent = "#fbbf24", fill = "#1c1a13", size = 48 }) => (
  <svg
    viewBox="0 0 200 265"
    width={size}
    height={size * 1.325}
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <defs>
      <linearGradient id="sv-grad" x1="0%" y1="0%" x2="60%" y2="100%">
        <stop offset="0%" stopColor={accent} stopOpacity="0.7" />
        <stop offset="100%" stopColor={fill} stopOpacity="1" />
      </linearGradient>
    </defs>
    <path
      d="M 22,0 L 178,0 Q 200,0 200,22 L 200,158 Q 200,192 100,265 Q 0,192 0,158 L 0,22 Q 0,0 22,0 Z"
      fill="url(#sv-grad)"
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

// ─── Existing curated videos ──────────────────────────────────────────────
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

// Accent colours cycle for fighter cards
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

const VideoVault = () => {
  const [fights, setFights] = useState([]);
  const [eventName, setEventName] = useState("This Week's Card");
  const [loadingFighters, setLoadingFighters] = useState(true);

  useEffect(() => {
    fetch("/this_weeks_stats.json", { cache: "no-store" })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => {
        if (data.event) setEventName(data.event.name || data.event);
        setFights(data.fights || []);
        setLoadingFighters(false);
      })
      .catch((err) => {
        console.error("VideoVault: failed to load fighters", err);
        setLoadingFighters(false);
      });
  }, []);

  // Flatten to unique fighters, keeping fight index for accent colour
  const fighters = fights.flatMap((fight, fi) =>
    (fight.fighters || []).map((f, idx) => ({
      ...f,
      matchup: fight.matchup,
      accentIdx: (fi * 2 + idx) % ACCENTS.length,
    })),
  );

  return (
    <div
      className="min-h-screen bg-stone-950"
      style={{ fontFamily: "'Courier New', monospace" }}
    >
      {/* ── Classification banner ─────────────────────────────────────── */}
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

      <div className="max-w-7xl mx-auto px-4 py-4 md:py-10">
        {/* ── Page header ───────────────────────────────────────────────── */}
        <div className="text-center mb-10">
          <p className="text-xs text-stone-500 tracking-[0.5em] uppercase mb-2">
            ◆ OPERATION COMBAT VAULT — VIDEO DIVISION ◆
          </p>
          <h1
            className="text-3xl md:text-5xl font-black text-stone-100 tracking-wider uppercase"
            style={{
              fontFamily: "'Impact', sans-serif",
              textShadow: "2px 2px 0 #4a5240, 0 0 40px rgba(100,120,80,0.3)",
            }}
          >
            VIDEO <span className="text-yellow-600">VAULT</span>
          </h1>
          <div className="w-32 h-px bg-gradient-to-r from-transparent via-yellow-700 to-transparent mx-auto mt-3" />
        </div>

        {/* ── Fighter Highlights ─────────────────────────────────────────── */}
        <section className="mb-14">
          <div className="flex items-center gap-3 mb-1">
            <div className="h-px flex-1 bg-yellow-700/30" />
            <h2 className="text-xs font-bold tracking-[0.4em] uppercase text-yellow-600">
              ◈ FIGHTER INTELLIGENCE — {eventName}
            </h2>
            <div className="h-px flex-1 bg-yellow-700/30" />
          </div>
          <p className="text-stone-500 text-xs text-center mb-6 tracking-wide">
            Search for fighter highlight reels on YouTube
          </p>

          {loadingFighters ? (
            <p className="text-center text-stone-500 tracking-widest animate-pulse py-10">
              LOADING ASSETS…
            </p>
          ) : fighters.length === 0 ? (
            <p className="text-center text-stone-600 py-10">
              No fighter data available.
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 max-h-[30rem] overflow-y-auto md:max-h-none md:overflow-visible pr-1">
              {fighters.map((fighter, i) => {
                const accent = ACCENTS[fighter.accentIdx];
                const query = encodeURIComponent(
                  `${fighter.name} MMA highlights`,
                );
                const ytSearch = `https://www.youtube.com/results?search_query=${query}`;

                return (
                  <div
                    key={i}
                    className="group relative flex flex-col items-center bg-stone-900 border rounded-lg p-4 transition-all duration-300 hover:scale-[1.02]"
                    style={{
                      borderColor: `${accent}30`,
                      boxShadow: `0 0 18px ${accent}18`,
                    }}
                  >
                    {/* Corner classification tag */}
                    <span
                      className="absolute top-2 right-2 text-[9px] font-bold tracking-widest px-1.5 py-0.5 rounded"
                      style={{
                        color: accent,
                        background: `${accent}18`,
                        border: `1px solid ${accent}30`,
                      }}
                    >
                      {fighter.salary
                        ? fighter.salary >= 8500
                          ? "HIGH-VALUE"
                          : "ASSET"
                        : "ASSET"}
                    </span>

                    {/* Shield icon */}
                    <div className="mb-3 opacity-90 group-hover:opacity-100 transition-opacity">
                      <Shield accent={accent} fill="#0f0e09" size={52} />
                    </div>

                    {/* Fighter name */}
                    <p
                      className="text-sm font-bold text-center tracking-wide uppercase leading-tight mb-1"
                      style={{ color: accent }}
                    >
                      {fighter.name}
                    </p>

                    {/* Record & matchup */}
                    <p className="text-stone-500 text-[10px] text-center tracking-wider mb-1">
                      {fighter.record && fighter.record !== "N/A"
                        ? fighter.record
                        : "—"}
                    </p>
                    <p className="text-stone-600 text-[10px] text-center tracking-wide mb-3 leading-tight">
                      vs.{" "}
                      {fighter.matchup
                        ?.replace(fighter.name, "")
                        .replace("vs.", "")
                        .trim() || "TBD"}
                    </p>

                    {/* DK salary badge */}
                    {fighter.salary && (
                      <span
                        className="text-[10px] font-semibold px-2 py-0.5 rounded mb-3"
                        style={{
                          color: accent,
                          background: `${accent}15`,
                          border: `1px solid ${accent}25`,
                        }}
                      >
                        DK ${fighter.salary.toLocaleString()}
                      </span>
                    )}

                    {/* YouTube link */}
                    <a
                      href={ytSearch}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full text-center text-[11px] font-bold tracking-widest uppercase py-2 rounded transition-all duration-200"
                      style={{
                        color: "#0f0e09",
                        background: accent,
                      }}
                    >
                      ▶ FIND HIGHLIGHTS
                    </a>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* ── Event Highlights placeholder ─────────────────────────────── */}
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

        {/* ── Curated Vault ─────────────────────────────────────────────── */}
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

          <details className="md:hidden rounded border border-stone-700 bg-stone-900/60">
            <summary className="px-4 py-3 text-xs font-bold uppercase tracking-widest text-yellow-500">
              Show Classified Archive ({curatedVideos.length})
            </summary>
            <div className="grid grid-cols-1 gap-3 p-3 border-t border-stone-700 max-h-[26rem] overflow-y-auto">
              {curatedVideos.map((video, index) => (
                <div
                  key={`mobile-curated-${index}`}
                  className="mobile-data-card flex flex-col items-center"
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
                    style={{
                      color: "#0f0e09",
                      background: "#fbbf24",
                    }}
                  >
                    ▶ ACCESS FILE
                  </a>
                </div>
              ))}
            </div>
          </details>

          <div className="hidden md:grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
                  style={{
                    color: "#0f0e09",
                    background: "#fbbf24",
                  }}
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

export default VideoVault;
