import React, { useState, useEffect } from "react";
import { BrowserRouter as Router, Routes, Route, Link } from "react-router-dom";
import Home from "./components/Home";
import TeamCombinations from "./components/TeamCombinations";
import FightAnalyzer from "./components/FightAnalyzer";
import VideoVault from "./components/VideoVault";
import ManualTeams from "./components/ManualTeams";
import DFSPicksProjections from "./components/DFSPicksProjections";
import VideosV2 from "./components/VideosV2";
import LatestOdds from "./components/LatestOdds";
import Footer from "./components/Footer";

// Updated navLinks with event context for current card
const navLinks = [
  { to: "/", label: "Home" },
  {
    to: "/team-combinations",
    label: "DFS (Daily Fantasy Sports) Teams - Mar 14 Card",
  },
  { to: "/manual-teams", label: "Manual Teams" },
  { to: "/fight-analyzer", label: "Fight Analyzer - Latest Card" },
  { to: "/video-vault", label: "Video Vault" },
  { to: "/odds", label: "Live Odds" },
  { to: "/predictions", label: "Predictions & Projections" },
];

const currentEvent = "UFC Fight Night - March 14, 2026";

const App = () => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [eventTitle, setEventTitle] = useState("Latest UFC Event");

  useEffect(() => {
    fetch("/current_event.json")
      .then((res) => res.json())
      .then((data) => setEventTitle(data.title || "Latest UFC Event"))
      .catch(() => setEventTitle("Latest UFC Event"));
  }, []);

  return (
    <Router>
      <div className="min-h-screen bg-gray-900">
        <nav
          className="sticky top-0 z-50 text-stone-100 shadow-lg border-b border-yellow-900/60"
          style={{ backgroundColor: "#92400e" }}
        >
          <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between md:justify-center flex-col">
            {/* Desktop nav links */}
            <ul className="hidden md:flex space-x-8">
              {navLinks.map(({ to, label }) => (
                <li key={to}>
                  <Link to={to} className="hover:underline whitespace-nowrap">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>

            {/* Mobile: event name + hamburger */}
            <div className="w-full flex items-center justify-between md:hidden">
              <span className="font-bold tracking-wide text-lg">
                {eventTitle} - Combat Vault
              </span>
              <button
                className="flex flex-col gap-1.5 p-2 focus:outline-none"
                onClick={() => setMenuOpen((o) => !o)}
                aria-label="Toggle menu"
              >
                <span
                  className={`block h-0.5 w-6 bg-stone-100 transition-transform duration-200 ${menuOpen ? "translate-y-2 rotate-45" : ""}`}
                />
                <span
                  className={`block h-0.5 w-6 bg-stone-100 transition-opacity duration-200 ${menuOpen ? "opacity-0" : ""}`}
                />
                <span
                  className={`block h-0.5 w-6 bg-stone-100 transition-transform duration-200 ${menuOpen ? "-translate-y-2 -rotate-45" : ""}`}
                />
              </button>
            </div>

            {/* Mobile dropdown */}
            {menuOpen && (
              <ul className="md:hidden flex flex-col border-t border-yellow-900/60 w-full">
                {navLinks.map(({ to, label }) => (
                  <li key={to}>
                    <Link
                      to={to}
                      className="block px-6 py-3 hover:bg-yellow-900/40 transition"
                      onClick={() => setMenuOpen(false)}
                    >
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </nav>
        <div className="bg-gray-800 text-yellow-400 text-center py-3 font-semibold text-xl border-b border-yellow-900/60">
          {eventTitle}
        </div>

        <Routes>
          <Route path="/" element={<Home />} />
          <Route
            path="/team-combinations"
            element={<TeamCombinations eventTitle={eventTitle} />}
          />
          <Route path="/manual-teams" element={<ManualTeams />} />
          <Route
            path="/fight-analyzer"
            element={<FightAnalyzer eventTitle={eventTitle} />}
          />
          <Route path="/video-vault" element={<VideoVault />} />
          <Route path="/videos-v2" element={<VideosV2 />} />
          <Route path="/odds" element={<LatestOdds />} />
          <Route
            path="/predictions"
            element={<DFSPicksProjections eventTitle={eventTitle} />}
          />
        </Routes>
        <Footer />
      </div>
    </Router>
  );
};

export default App;
