import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Home from "./components/Home";
import ShopTattoos from "./components/ShopTattoos";
import TeamCombinations from "./components/TeamCombinations";
import FightAnalyzer from "./components/FightAnalyzer";
import Roster from "./components/Roster";
import VideoVault from "./components/VideoVault";
import LatestOdds from "./components/LatestOdds";
import ManualTeams from "./components/ManualTeams";
import DFSPicksProjections from "./components/DFSPicksProjections";
import "./App.css";
import "./components/Home.css";
import "./components/ShopTattoos.css"; // Add this line

const App = () => {
  return (
    <Router>
      <div className="min-h-screen bg-gray-900">
        <nav className="bg-blue-800 text-white p-4">
          <ul className="flex space-x-4">
            <li>
              <a href="/" className="hover:underline">
                Home
              </a>
            </li>
            <li>
              <a href="/shop-tattoos" className="hover:underline">
                Shop Tattoos
              </a>
            </li>
            <li>
              <a href="/team-combinations" className="hover:underline">
                DFS Teams
              </a>
            </li>
            <li>
              <a href="/manual-teams" className="hover:underline">
                Manual Teams
              </a>
            </li>
            <li>
              <a href="/fight-analyzer" className="hover:underline">
                Fight Analyzer
              </a>
            </li>
            <li>
              <a href="/roster" className="hover:underline">
                UFC Roster
              </a>
            </li>
            <li>
              <a href="/video-vault" className="hover:underline">
                Video Vault
              </a>
            </li>
            <li>
              <a href="/latest-odds" className="hover:underline">
                Latest Odds
              </a>
            </li>
            <li>
              <a href="/dfs-picks" className="hover:underline">
                {" "}
                // New link DFS Picks
              </a>
            </li>
          </ul>
        </nav>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/shop-tattoos" element={<ShopTattoos />} />
          <Route path="/team-combinations" element={<TeamCombinations />} />
          <Route path="/manual-teams" element={<ManualTeams />} />
          <Route path="/fight-analyzer" element={<FightAnalyzer />} />
          <Route path="/roster" element={<Roster />} />
          <Route path="/video-vault" element={<VideoVault />} />
          <Route path="/latest-odds" element={<LatestOdds />} />
          <Route path="/dfs-picks" element={<DFSPicksProjections />} /> // New
          route
        </Routes>
      </div>
    </Router>
  );
};

export default App;
