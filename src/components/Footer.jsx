import React from "react";
import { Link } from "react-router-dom";

const TRIAL_END = new Date("2026-05-15T23:59:59Z");

const Footer = () => {
  const isTrial = new Date() < TRIAL_END;

  return (
    <footer className="bg-stone-950 border-t border-yellow-900/30 mt-auto">
      {isTrial && (
        <div className="bg-yellow-900/20 border-b border-yellow-900/30 px-4 py-2 text-center">
          <p className="text-yellow-600 text-[10px] font-semibold tracking-wide">
            ⚡ FREE PRO ACCESS UNTIL MAY 15, 2026 —{" "}
            <Link to="/" className="underline hover:text-yellow-400 transition">
              Sign up free →
            </Link>
          </p>
        </div>
      )}
      <div className="max-w-6xl mx-auto px-4 py-6 flex flex-col sm:flex-row items-center justify-between gap-3">
        <span className="text-[10px] font-mono text-stone-600 tracking-[0.3em] uppercase">
          ⚡ COMBAT VAULT
        </span>
        <p className="text-xs text-stone-500 text-center">
          18+ · Gambling problem?{" "}
          <span className="text-stone-400 font-semibold">1-800-GAMBLER</span> ·
          Not affiliated with UFC or any sportsbook.
        </p>
        <div className="flex items-center gap-4">
          <p className="text-[10px] text-stone-600 tracking-widest uppercase">
            FOR ENTERTAINMENT ONLY
          </p>
          <Link
            to="/privacy"
            className="text-[10px] text-stone-600 hover:text-stone-400 tracking-widest uppercase transition"
          >
            Privacy
          </Link>
          <Link
            to="/terms"
            className="text-[10px] text-stone-600 hover:text-stone-400 tracking-widest uppercase transition"
          >
            Terms
          </Link>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
