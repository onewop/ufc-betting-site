/**
 * PaywallGate.jsx — Reusable paywall overlay for Pro-only pages.
 *
 * Usage:
 *   const isPro = currentUser?.subscription_status === "pro";
 *   if (!isPro) return <PaywallGate currentUser={currentUser} featureName="Smart AI Picks" />;
 */
import React, { useState } from "react";

const PaywallGate = ({ currentUser, featureName = "this feature" }) => {
  const [upgrading, setUpgrading] = useState(false);
  const [upgradeError, setUpgradeError] = useState("");

  const handleUpgrade = async () => {
    const token = localStorage.getItem("authToken");
    if (!token) {
      // Ask App shell to open the login modal via custom event
      window.dispatchEvent(
        new CustomEvent("cagevault:openAuthModal", { detail: { tab: "login" } })
      );
      return;
    }
    setUpgrading(true);
    setUpgradeError("");
    try {
      const res = await fetch("/api/create-checkout-session", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        setUpgradeError(
          data.detail === "Failed to create checkout session"
            ? "Payment setup is not yet complete. Please contact support at cagevault.com."
            : data.detail || "Checkout failed — please try again."
        );
      }
    } catch {
      setUpgradeError("Network error — please try again.");
    } finally {
      setUpgrading(false);
    }
  };

  return (
    <div className="min-h-screen bg-stone-950 flex flex-col items-center justify-center px-4 text-center">
      {/* Decorative header bar */}
      <div className="absolute top-0 left-0 right-0 flex items-center justify-between border-b border-yellow-700/40 bg-yellow-900/10 px-6 py-2">
        <span className="text-yellow-500 text-xs font-bold tracking-widest uppercase">
          ⚡ Pro Feature
        </span>
        <span className="text-yellow-500/50 text-xs tracking-wider hidden sm:block">
          CageVault Pro
        </span>
        <span className="text-yellow-500 text-xs font-bold tracking-widest uppercase">
          Unlock Today ⚡
        </span>
      </div>

      <div className="max-w-md mt-16">
        {/* Lock icon */}
        <div className="text-6xl mb-5">🔒</div>

        <h1 className="text-3xl md:text-4xl font-black text-stone-100 tracking-tight mb-3">
          {featureName}
        </h1>

        <p className="text-stone-400 text-sm leading-relaxed mb-8">
          {currentUser
            ? "Upgrade to CageVault Pro to unlock this feature, plus AI lineups, DFS projections, parlay tools, and more."
            : "Create a free account and upgrade to Pro to unlock this feature."}
        </p>

        {upgradeError && (
          <p className="text-red-400 text-sm mb-4 bg-red-950/40 border border-red-800/50 rounded-lg px-4 py-2">
            {upgradeError}
          </p>
        )}

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={handleUpgrade}
            disabled={upgrading}
            className="bg-yellow-500 hover:bg-yellow-400 disabled:opacity-60 disabled:cursor-not-allowed text-stone-900 font-black py-3 px-8 rounded-xl text-sm tracking-wide transition"
          >
            {upgrading ? "Loading…" : currentUser ? "Upgrade to Pro — $19.99/mo" : "Log In to Upgrade"}
          </button>
          {!currentUser && (
            <button
              onClick={() =>
                window.dispatchEvent(
                  new CustomEvent("cagevault:openAuthModal", { detail: { tab: "register" } })
                )
              }
              className="border border-stone-600 hover:border-stone-400 text-stone-300 font-semibold py-3 px-6 rounded-xl text-sm transition"
            >
              Create Free Account
            </button>
          )}
        </div>

        {/* Feature bullets */}
        <div className="mt-10 text-left space-y-2">
          {[
            "🎯 Smart AI Lineup Picks across every strategy",
            "📊 DFS Projections with value scoring",
            "🃏 Parlay Builder with recommended combos",
            "💰 +EV Value Bets backed by model probabilities",
            "🏆 Team Combinations optimizer",
          ].map((f) => (
            <div key={f} className="flex items-start gap-2 text-stone-400 text-xs">
              <span className="mt-0.5">{f.split(" ")[0]}</span>
              <span>{f.split(" ").slice(1).join(" ")}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default PaywallGate;
