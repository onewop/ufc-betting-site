/**
 * WeighInClips.jsx
 *
 * Displays weigh-in video clips for fighters that have a weighInVideoId set.
 * Hidden entirely when no fighters have videos assigned yet.
 * Each fighter card shows a YouTube embed when weighInVideoId is present.
 */

import { memo } from "react";

// Inline 1×1 grey circle SVG — no network request, no 404, no alt-text flash
const FALLBACK_AVATAR =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='48' height='48'%3E%3Ccircle cx='24' cy='24' r='24' fill='%2344403a'/%3E%3Ctext x='24' y='30' text-anchor='middle' fill='%23a8a29e' font-size='18'%3E?%3C/text%3E%3C/svg%3E";

const WeighInClips = memo(({ fighters }) => {
  if (!fighters || fighters.length === 0) return null;

  // Only show the section if at least one fighter has a real weigh-in video
  const fightersWithVideos = fighters.filter((f) => f.weighInVideoId);
  if (fightersWithVideos.length === 0) return null;

  return (
    <div className="mt-6 border-t border-stone-700 pt-6">
      <h3 className="text-stone-300 text-lg font-bold mb-4 uppercase tracking-wide">
        Weigh-In Clips
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {fightersWithVideos.map((fighter) => (
          <div
            key={fighter.name}
            className="border border-stone-700 rounded-lg p-4 bg-stone-900"
          >
            <div className="flex items-center gap-3 mb-3">
              <img
                src={fighter.image || FALLBACK_AVATAR}
                alt=""
                className="w-12 h-12 rounded-full object-cover bg-stone-700"
                onError={(e) => {
                  e.target.onerror = null;
                  e.target.src = FALLBACK_AVATAR;
                }}
              />
              <div>
                <h4 className="text-stone-100 font-semibold">{fighter.name}</h4>
                <p className="text-stone-500 text-sm">Weigh-In</p>
              </div>
            </div>
            <div className="relative w-full rounded overflow-hidden" style={{ paddingBottom: "56.25%" }}>
              <iframe
                className="absolute inset-0 w-full h-full"
                src={`https://www.youtube.com/embed/${fighter.weighInVideoId}`}
                title={`${fighter.name} weigh-in`}
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
});

WeighInClips.displayName = "WeighInClips";

export default WeighInClips;
