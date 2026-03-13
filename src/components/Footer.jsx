import React from "react";

const Footer = () => (
  <footer className="bg-gray-800 text-gray-300 text-center py-6 mt-auto border-t border-yellow-900/60">
    <p className="text-sm px-4">
      21+. Gambling problem? Call 1-800-GAMBLER. Not affiliated with UFC or any
      sportsbook.
    </p>
    <p className="text-sm mt-2 px-4">
      Ready to bet on UFC? Sign up at{" "}
      <a
        href="PASTE_YOUR_DRAFTKINGS_AFFILIATE_LINK_HERE"
        target="_blank"
        rel="noopener noreferrer"
        className="text-yellow-400 hover:underline"
      >
        DraftKings
      </a>{" "}
      and get $200 in bonus bets (affiliate link &mdash; we may earn a
      commission at no extra cost to you).
    </p>
  </footer>
);

export default Footer;
