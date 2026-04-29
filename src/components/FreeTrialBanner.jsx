import React, { useState } from "react";

const TRIAL_END = new Date("2026-05-15T23:59:59Z");

/**
 * FreeTrialBanner — sticky top banner shown while a user has an active trial.
 * Automatically hides after May 15 or if the user is a paying Pro subscriber.
 *
 * Props:
 *   currentUser — user object from auth state (or null)
 *   onUpgrade   — () => void  called when user clicks "Upgrade"
 */
export default function FreeTrialBanner({ currentUser, onUpgrade }) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  const now = new Date();
  if (now > TRIAL_END) return null;

  // Only show for trial users (not paying Pro)
  if (!currentUser || currentUser.subscription_status !== "trial") return null;

  const daysLeft = Math.ceil((TRIAL_END - now) / (1000 * 60 * 60 * 24));

  return (
    <div className="w-full bg-gradient-to-r from-yellow-900/80 via-amber-900/70 to-yellow-900/80 border-b border-yellow-700/60 px-4 py-2 flex items-center justify-between gap-3 text-xs z-50">
      <span className="text-yellow-300 font-semibold">
        ⚡ Free Pro Access Active —{" "}
        <span className="text-yellow-100 font-black">
          {daysLeft} day{daysLeft !== 1 ? "s" : ""} left
        </span>{" "}
        (until May 15)
      </span>
      <div className="flex items-center gap-3 shrink-0">
        <button
          onClick={onUpgrade}
          className="bg-yellow-500 hover:bg-yellow-400 text-stone-900 font-black px-3 py-1 rounded-lg text-[10px] tracking-wide transition"
        >
          Keep Access — $19.99/mo
        </button>
        <button
          onClick={() => setDismissed(true)}
          className="text-yellow-600 hover:text-yellow-400 transition"
          aria-label="Dismiss banner"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
