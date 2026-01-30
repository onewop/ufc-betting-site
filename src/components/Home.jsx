import React, { useEffect } from "react";
import { Link } from "react-router-dom";

const Home = () => {
  useEffect(() => {
    console.log(
      "Video source URL:",
      window.location.origin + "/ufc-fight-loop.mp4"
    );
    console.log("Checking video playback...");
    const video = document.querySelector("video");
    if (video) {
      video.addEventListener("loadeddata", () =>
        console.log("Video loaded successfully!")
      );
      video.addEventListener("error", (e) =>
        console.log(
          "Video load error: Verify public/ufc-fight-loop.mp4 exists, is H.264 MP4, 5-15s, under 10MB. Check Network tab for 404 or other errors.",
          e
        )
      );
    }
  }, []);

  return (
    <div className="container mx-auto p-6 min-h-screen bg-gray-900 relative overflow-hidden">
      {/* Video Background */}
      <video
        autoPlay
        loop
        muted
        playsInline
        preload="auto"
        className="absolute inset-0 w-full h-full object-cover opacity-100 !z-0"
      >
        <source src="/ufc-fight-loop.mp4" type="video/mp4" />
      </video>
      {/* Dark Overlay */}
      <div className="absolute inset-0 bg-black/70 z-10"></div>
      {/* Content */}
      <div className="relative z-20 flex flex-col items-center justify-center min-h-screen">
        <header className="text-center mb-12">
          <h1
            className="text-5xl md:text-6xl font-bold text-[#7f0000] tracking-tight drop-shadow-[0_0_10px_rgba(127,0,0,0.8)] animate-fadeIn"
            style={{
              fontFamily: "'Impact', sans-serif",
              WebkitTextStroke: "2px white",
            }}
          >
            The Combat Vault
          </h1>
          <p className="text-xl md:text-2xl text-gray-300 mt-4 mb-6 animate-slideUp">
            Step into the octagon with cutting-edge MMA betting tools—analyze
            fights, build DFS teams, and dominate the cage!
          </p>
          <p className="text-base md:text-lg text-primary font-semibold animate-slideUp">
            <strong>Warning:</strong> For entertainment only. DFS and betting
            are 21+. Call 1-800-GAMBLER for help. We’re not liable for
            losses—fight smart!
          </p>
        </header>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 w-full max-w-5xl">
          <div className="card pearl-border shadow-neon hover:scale-105 transition duration-300">
            <h2 className="text-2xl font-orbitron font-semibold text-white mb-2">
              Fight Analyzer
            </h2>
            <p className="text-gray-300 mb-4">
              Dive into gritty stats on striking, grappling, and more to predict
              fight outcomes like a pro.
            </p>
            <Link
              to="/fight-analyzer"
              className="neon-button mt-4 inline-block"
            >
              Analyze Now
            </Link>
          </div>
          <div className="card pearl-border shadow-neon hover:scale-105 transition duration-300">
            <h2 className="text-2xl font-orbitron font-semibold text-white mb-2">
              DFS Team Builder
            </h2>
            <p className="text-gray-300 mb-4">
              Generate or hand-pick DraftKings teams with custom fighter limits
              for maximum edge.
            </p>
            <Link
              to="/team-combinations"
              className="neon-button mt-4 inline-block"
            >
              Build Teams
            </Link>
          </div>
          <div className="card pearl-border shadow-neon hover:scale-105 transition duration-300">
            <h2 className="text-2xl font-orbitron font-semibold text-white mb-2">
              UFC Roster
            </h2>
            <p className="text-gray-300 mb-4">
              Explore the full UFC roster with detailed bios and hard-hitting
              stats.
            </p>
            <Link to="/roster" className="neon-button mt-4 inline-block">
              View Roster
            </Link>
          </div>
          <div className="card pearl-border shadow-neon hover:scale-105 transition duration-300">
            <h2 className="text-2xl font-orbitron font-semibold text-white mb-2">
              Video Vault
            </h2>
            <p className="text-gray-300 mb-4">
              Relive the wildest, bloodiest, and funniest moments in MMA
              history.
            </p>
            <Link to="/video-vault" className="neon-button mt-4 inline-block">
              Watch Now
            </Link>
          </div>
          <div className="card pearl-border shadow-neon hover:scale-105 transition duration-300">
            <h2 className="text-2xl font-orbitron font-semibold text-white mb-2">
              Latest Odds
            </h2>
            <p className="text-gray-300 mb-4">
              Check real-time UFC betting odds from top bookmakers.
            </p>
            <Link to="/latest-odds" className="neon-button mt-4 inline-block">
              View Odds
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Home;
