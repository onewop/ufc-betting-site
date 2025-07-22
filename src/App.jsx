import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Home from "./components/Home";
import ShopTattoos from "./components/ShopTattoos";
import TeamCombinations from "./components/TeamCombinations";
import FightAnalyzer from "./components/FightAnalyzer";
import "./App.css";

const App = () => {
  return (
    <Router>
      <div className="min-h-screen bg-gray-100">
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
              <a href="/fight-analyzer" className="hover:underline">
                Fight Analyzer
              </a>
            </li>
          </ul>
        </nav>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route
            path="/shop-tattoos"
            className="hover:underline"
            element={<ShopTattoos />}
          />
          <Route
            path="/team-combinations"
            className="hover:underline"
            element={<TeamCombinations />}
          />
          <Route
            path="/fight-analyzer"
            className="hover:underline"
            element={<FightAnalyzer />}
          />
        </Routes>
      </div>
    </Router>
  );
};

export default App;
