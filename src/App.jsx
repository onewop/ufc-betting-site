import React from "react";
import { BrowserRouter as Router, Routes, Route, Link } from "react-router-dom";
import Home from "./components/Home";
import ShopTattoos from "./components/ShopTattoos";
import TeamCombinations from "./components/TeamCombinations";
import FightAnalyzer from "./components/FightAnalyzer";
import Roster from "./components/Roster";
import VideoVault from "./components/VideoVault";
import LatestOdds from "./components/LatestOdds";
import ManualTeams from "./components/ManualTeams";
import DFSPicksProjections from "./components/DFSPicksProjections";
import ThisWeeksStats from "./components/ThisWeeksStats";

const App = () => {
  return (
    <Router>
      <div className="min-h-screen bg-gray-900">
        <nav className="bg-blue-800 text-white p-4">
          <ul className="flex space-x-4">
            <li>
              <Link to="/" className="hover:underline">
                Home
              </Link>
            </li>
            <li>
              <Link to="/shop-tattoos" className="hover:underline">
                Shop Tattoos
              </Link>
            </li>
            <li>
              <Link to="/team-combinations" className="hover:underline">
                DFS Teams
              </Link>
            </li>
            <li>
              <Link to="/manual-teams" className="hover:underline">
                Manual Teams
              </Link>
            </li>
            <li>
              <Link to="/this_weeks_stats" className="hover:underline">
                Fight Analyzer
              </Link>
            </li>
            <li>
              <Link to="/roster" className="hover:underline">
                UFC Roster
              </Link>
            </li>
            <li>
              <Link to="/video-vault" className="hover:underline">
                Video Vault
              </Link>
            </li>
            <li>
              <Link to="/latest-odds" className="hover:underline">
                Latest Odds
              </Link>
            </li>
            <li>
              <Link to="/dfs-picks" className="hover:underline">
                MMA Handicapper Predictions
              </Link>
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
          <Route path="/dfs-picks" element={<DFSPicksProjections />} />
          <Route path="/this_weeks_stats" element={<ThisWeeksStats />} />
        </Routes>
      </div>
    </Router>
  );
};

export default App;
