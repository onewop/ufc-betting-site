import React, { useState } from "react";
import api from "../services/api";

const TRIAL_END_DATE = "May 15, 2026";
const STORAGE_KEY = "cv_trial_dismissed";

/**
 * FreeTrialModal — shown to first-time visitors who aren't logged in.
 *
 * Props:
 *   isOpen       — boolean
 *   onClose      — () => void  (called on dismiss without signing up)
 *   onSuccess    — (token, user) => void  (called after successful trial signup)
 */
export default function FreeTrialModal({ isOpen, onClose, onSuccess }) {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (!isOpen) return null;

  const handleDismiss = () => {
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {}
    onClose();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !trimmed.includes("@")) {
      setError("Please enter a valid email address.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const data = await api.post("/api/trial-signup", { email: trimmed });
      if (data.access_token) {
        // Fetch the full user profile so the app shell has all fields
        const user = await api.get("/auth/me", data.access_token);
        try {
          localStorage.setItem(STORAGE_KEY, "1");
        } catch {}
        onSuccess(data.access_token, user);
      } else {
        setError(data.detail || "Something went wrong. Please try again.");
      }
    } catch (err) {
      setError(err.message || "Network error — please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="trial-modal-title"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={handleDismiss}
      />

      {/* Panel */}
      <div className="relative z-10 w-full max-w-md bg-stone-950 border border-yellow-700/50 rounded-2xl shadow-2xl overflow-hidden">
        {/* Top accent bar */}
        <div className="bg-gradient-to-r from-yellow-900/60 via-amber-900/40 to-stone-900 px-5 py-3 flex items-center justify-between border-b border-yellow-800/40">
          <span className="text-yellow-500 text-xs font-bold tracking-[0.3em] uppercase">
            ⚡ FREE ACCESS — LIMITED TIME
          </span>
          <button
            onClick={handleDismiss}
            className="text-stone-500 hover:text-stone-300 text-lg leading-none transition"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="px-6 py-7">
          {/* Headline */}
          <h2
            id="trial-modal-title"
            className="text-2xl font-black text-white tracking-tight mb-2"
          >
            Try Combat Vault Free
          </h2>
          <p className="text-stone-400 text-sm mb-1">
            Full Pro access — no credit card, no password.
          </p>
          <p className="text-yellow-500/80 text-xs font-semibold tracking-wide mb-6">
            Free until {TRIAL_END_DATE}
          </p>

          {/* Feature bullets */}
          <ul className="space-y-2 mb-7">
            {[
              ["🎯", "Smart AI Lineup Picks"],
              ["📊", "DFS Projections & Value Scoring"],
              ["🃏", "Parlay Builder with AI combos"],
              ["💰", "+EV Value Bets backed by model data"],
              ["🥊", "Full fighter profiles & fight history"],
            ].map(([icon, text]) => (
              <li
                key={text}
                className="flex items-center gap-2 text-stone-300 text-xs"
              >
                <span className="text-base">{icon}</span>
                <span>{text}</span>
              </li>
            ))}
          </ul>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-3">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              required
              autoFocus
              className="w-full bg-stone-900 border border-stone-700 focus:border-yellow-600 rounded-xl px-4 py-3 text-sm text-white placeholder-stone-500 focus:outline-none transition"
            />
            {error && (
              <p className="text-red-400 text-xs bg-red-950/40 border border-red-800/40 rounded-lg px-3 py-2">
                {error}
              </p>
            )}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-yellow-500 hover:bg-yellow-400 disabled:opacity-60 disabled:cursor-not-allowed text-stone-900 font-black py-3 rounded-xl text-sm tracking-wide transition"
            >
              {loading
                ? "Activating…"
                : `Unlock Free Access Until ${TRIAL_END_DATE}`}
            </button>
          </form>

          <p className="text-center text-stone-600 text-[10px] mt-4 leading-relaxed">
            By signing up you agree to our{" "}
            <a
              href="/privacy"
              className="text-stone-500 hover:text-stone-300 underline"
            >
              Privacy Policy
            </a>{" "}
            and{" "}
            <a
              href="/terms"
              className="text-stone-500 hover:text-stone-300 underline"
            >
              Terms of Service
            </a>
            . No spam. Unsubscribe anytime.
          </p>
        </div>
      </div>
    </div>
  );
}
