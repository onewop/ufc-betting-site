/**
 * WeighInClips.jsx
 *
 * Component for displaying weigh-in video clips for fighters.
 * Shows small cards with fighter name, photo, and embedded video player.
 */

import { useState } from "react";

const WeighInClips = ({ fighters }) => {
  if (!fighters || fighters.length === 0) return null;

  return (
    <div className="mt-6 border-t border-stone-700 pt-6">
      <h3 className="text-stone-300 text-lg font-bold mb-4 uppercase tracking-wide">
        Weigh-In Clips
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {fighters.map((fighter) => (
          <div
            key={fighter.name}
            className="border border-stone-700 rounded-lg p-4 bg-stone-900"
          >
            <div className="flex items-center gap-3 mb-3">
              <img
                src={fighter.image || "/placeholder.svg"}
                alt={fighter.name}
                className="w-12 h-12 rounded-full object-cover"
                onError={(e) => {
                  e.target.src = "/placeholder.svg";
                }}
              />
              <div>
                <h4 className="text-stone-100 font-semibold">{fighter.name}</h4>
                <p className="text-stone-500 text-sm">
                  Weigh-In Moment (5–10 sec)
                </p>
              </div>
            </div>
            <div
              className="relative w-full"
              style={{ paddingBottom: "56.25%" }}
            >
              <iframe
                className="absolute inset-0 w-full h-full rounded"
                src="https://www.youtube.com/embed/dQw4w9WgXcQ" // Placeholder URL - replace with real YouTube timestamps or hosted clips
                title={`${fighter.name} Weigh-In Clip`}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
            <p className="text-stone-600 text-xs mt-2 italic">
              {/* TODO: Add real YouTube timestamp or hosted video URL for {fighter.name}'s weigh-in clip */}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default WeighInClips;
