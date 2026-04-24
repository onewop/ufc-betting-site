import React from "react";

const Footer = () => (
  <footer className="bg-stone-950 border-t border-yellow-900/30 mt-auto">
    <div className="max-w-6xl mx-auto px-4 py-6 flex flex-col sm:flex-row items-center justify-between gap-3">
      <span className="text-[10px] font-mono text-stone-600 tracking-[0.3em] uppercase">
        ⚡ COMBAT VAULT
      </span>
      <p className="text-xs text-stone-500 text-center">
        21+ · Gambling problem? Call{" "}
        <span className="text-stone-400 font-semibold">1-800-GAMBLER</span> ·
        Not affiliated with UFC or any sportsbook.
      </p>
      <p className="text-[10px] text-stone-600 tracking-widest uppercase">
        FOR ENTERTAINMENT ONLY
      </p>
    </div>
  </footer>
);

export default Footer;
