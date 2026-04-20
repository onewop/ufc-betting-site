/**
 * FighterHighlights.jsx
 *
 * Displays side-by-side YouTube highlight video thumbnails for two fighters
 * inside the Fight Analyzer comparison view.  Clicking a thumbnail opens the
 * full YouTube video in a new tab.
 *
 * Only rendered on the side-by-side comparison view (FightStatsSection).
 * Never shown on individual full fighter stats pages.
 *
 * Props:
 *   fighter1  — { name, youtubeHighlightUrl, highlightVideoId }
 *   fighter2  — { name, youtubeHighlightUrl, highlightVideoId }
 *
 *   Both props are optional; if a fighter has no highlightVideoId the card
 *   renders a "No highlight available" placeholder instead of breaking.
 *
 * ── Example usage ────────────────────────────────────────────────────────────
 *
 *   const fighter1 = {
 *     name: "Marcio Barbosa",
 *     youtubeHighlightUrl: "https://www.youtube.com/watch?v=XXXXXXXXXXX",
 *     highlightVideoId: "XXXXXXXXXXX",
 *   };
 *
 *   const fighter2 = {
 *     name: "Dennis Buzukja",
 *     youtubeHighlightUrl: "https://www.youtube.com/watch?v=YYYYYYYYYYY",
 *     highlightVideoId: "YYYYYYYYYYY",
 *   };
 *
 *   <FighterHighlights fighter1={fighter1} fighter2={fighter2} />
 *
 * ── Data shape reminder ───────────────────────────────────────────────────────
 *
 *   To hydrate from this_weeks_stats.json, add these two fields to each
 *   fighter object in the JSON (or derive them client-side):
 *
 *     "youtubeHighlightUrl": "https://www.youtube.com/watch?v=VIDEO_ID",
 *     "highlightVideoId": "VIDEO_ID"
 *
 *   VIDEO_ID is the 11-character string after ?v= in any YouTube URL.
 *
 * Imported by: FightStatsSection.jsx
 */

import { memo, useState } from "react";

/* ── helpers ─────────────────────────────────────────────────────────────── */

/**
 * Returns the best-available YouTube thumbnail URL for a given video ID.
 * maxresdefault is ~1280×720; hqdefault is always present as a safe fallback.
 */
const thumbUrl = (videoId, quality = "maxresdefault") =>
  `https://img.youtube.com/vi/${videoId}/${quality}.jpg`;

/* ── ThumbnailCard ───────────────────────────────────────────────────────── */

/**
 * A single fighter's highlight card.
 * Falls back to hqdefault if maxresdefault 404s (common for older videos).
 */
const ThumbnailCard = ({ fighter }) => {
  const [imgSrc, setImgSrc] = useState(
    fighter.highlightVideoId ? thumbUrl(fighter.highlightVideoId) : null,
  );
  const [hovered, setHovered] = useState(false);

  const hasVideo =
    Boolean(fighter.highlightVideoId) && Boolean(fighter.youtubeHighlightUrl);

  return (
    <div className="flex flex-col items-center gap-2">
      {/* ── Thumbnail wrapper ────────────────────────────────────────────── */}
      {hasVideo ? (
        <a
          href={fighter.youtubeHighlightUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Watch ${fighter.name} highlight video on YouTube`}
          className="block w-full rounded-lg overflow-hidden border border-yellow-700/40 hover:border-yellow-500 transition-all duration-200 shadow-md hover:shadow-yellow-900/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-yellow-500"
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
        >
          {/* 16:9 aspect-ratio container */}
          <div className="relative w-full" style={{ paddingBottom: "56.25%" }}>
            {/* Thumbnail image */}
            <img
              src={imgSrc}
              alt={`${fighter.name} YouTube highlight thumbnail`}
              className={`absolute inset-0 w-full h-full object-cover transition-transform duration-300 ${
                hovered ? "scale-105 brightness-75" : "scale-100 brightness-90"
              }`}
              /* Fallback: maxresdefault → hqdefault → solid colour */
              onError={(e) => {
                if (e.target.src.includes("maxresdefault")) {
                  setImgSrc(thumbUrl(fighter.highlightVideoId, "hqdefault"));
                } else {
                  // Final fallback: hide broken img, show placeholder bg
                  e.target.style.display = "none";
                }
              }}
            />

            {/* Play-button overlay */}
            <div
              className={`absolute inset-0 flex items-center justify-center pointer-events-none transition-opacity duration-200 ${
                hovered ? "opacity-100" : "opacity-80"
              }`}
            >
              {/* YouTube-style red play button */}
              <div
                className={`flex items-center justify-center rounded-xl bg-red-600 shadow-lg transition-transform duration-200 ${
                  hovered ? "scale-110" : "scale-100"
                }`}
                style={{ width: 56, height: 40 }}
                aria-hidden="true"
              >
                {/* Right-pointing triangle */}
                <svg viewBox="0 0 24 24" fill="white" width="22" height="22">
                  <path d="M8 5v14l11-7z" />
                </svg>
              </div>
            </div>
          </div>
        </a>
      ) : (
        /* ── No-video placeholder ────────────────────────────────────────── */
        <div
          className="relative w-full rounded-lg border border-stone-700 bg-stone-900 flex items-center justify-center text-stone-500"
          style={{ paddingBottom: "56.25%" }}
          role="img"
          aria-label={`No highlight video available for ${fighter.name}`}
        >
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1">
            <span className="text-3xl" aria-hidden="true">
              🎬
            </span>
            <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">
              No Highlight Available
            </p>
          </div>
        </div>
      )}

      {/* ── Label ────────────────────────────────────────────────────────── */}
      <p className="text-xs font-bold uppercase tracking-widest text-stone-400 text-center">
        {hasVideo ? "UFC Highlights" : fighter.name}
      </p>
    </div>
  );
};

/* ── FighterHighlights ───────────────────────────────────────────────────── */

const FighterHighlights = memo(({ fighter1, fighter2 }) => {
  if (!fighter1 && !fighter2) return null;

  const f1 = fighter1 ?? { name: "Fighter 1" };
  const f2 = fighter2 ?? { name: "Fighter 2" };

  return (
    <section className="mb-6" aria-label="Fighter highlight videos">
      {/* Section heading */}
      <h3 className="text-stone-300 text-sm font-bold uppercase tracking-widest mb-3 text-center">
        🎥 Career Highlights
      </h3>

      {/* Fighter name headers */}
      <div className="grid grid-cols-2 gap-4 mb-1">
        <p className="text-yellow-500 text-xs font-bold uppercase tracking-wide text-center truncate">
          {f1.name}
        </p>
        <p className="text-yellow-400/80 text-xs font-bold uppercase tracking-wide text-center truncate">
          {f2.name}
        </p>
      </div>

      {/* Two thumbnail cards side by side */}
      <div className="grid grid-cols-2 gap-4">
        <ThumbnailCard fighter={f1} />
        <ThumbnailCard fighter={f2} />
      </div>

      <p className="text-xs text-stone-600 mt-2 italic text-center">
        Click to watch on YouTube
      </p>
    </section>
  );
});

FighterHighlights.displayName = "FighterHighlights";

export default FighterHighlights;
