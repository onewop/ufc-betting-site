import React from "react";
import { Link } from "react-router-dom";
import "tailwindcss/tailwind.css";

const Home = () => {
  return (
    <div className="container mx-auto p-4 min-h-screen flex flex-col items-center justify-center">
      <h1 className="text-5xl font-bold mb-8 text-center">Eon UFC Betting</h1>
      <p className="text-red-400 mb-6 text-center max-w-md">
        <strong>Warning:</strong> For entertainment only. DFS is 21+. Call
        1-800-GAMBLER for help. [YourSite] not liable for losses.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-4xl">
        <div className="card p-6 text-center">
          <h2 className="text-2xl font-semibold mb-4">Tramp Stamp Shop</h2>
          <p className="text-gray-300 mb-4">
            Get your *Eon: Time’s a Mess* tramp stamps! 18+ only.
          </p>
          <Link to="/shop-tattoos" className="neon-button">
            Shop Now
          </Link>
        </div>
        <div className="card p-6 text-center">
          <h2 className="text-2xl font-semibold mb-4">DFS Team Combinations</h2>
          <p className="text-gray-300 mb-4">
            Build DraftKings teams for UFC 319 with AI.
          </p>
          <Link to="/team-combinations" className="neon-button">
            Build Teams
          </Link>
        </div>
        <div className="card p-6 text-center">
          <h2 className="text-2xl font-semibold mb-4">Fight Analyzer</h2>
          <p className="text-gray-300 mb-4">
            Ask AI about UFC 319 fights for stats.
          </p>
          <Link to="/fight-analyzer" className="neon-button">
            Analyze Fights
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Home;
