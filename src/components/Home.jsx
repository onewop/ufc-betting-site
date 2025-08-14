import React, { useEffect } from "react";
import "tailwindcss/tailwind.css";

const Home = () => {
  useEffect(() => {
    console.log(
      "Video source URL:",
      window.location.origin + "/videos/ufc-fight-loop.mp4"
    );
    console.log("Checking video playback readiness...");
    const video = document.querySelector("video");
    if (video) {
      video.addEventListener("loadeddata", () =>
        console.log("Video loaded successfully!")
      );
      video.addEventListener("error", (e) =>
        console.log("Video playback error:", e)
      );
    }
  }, []);

  return (
    <div className="container mx-auto p-6 min-h-screen bg-gray-900">
      <header className="relative text-center mb-12 h-80">
        <video
          autoPlay
          loop
          muted
          playsInline
          preload="auto"
          className="absolute inset-0 w-full h-full object-cover"
          style={{ zIndex: -1 }}
          onError={(e) =>
            console.log(
              "Video load error: Ensure public/videos/ufc-fight-loop.mp4 is a valid H.264 MP4, 5-15s, under 10MB.",
              e
            )
          }
        >
          <source
            src="/videos/ufc-fight-loop.mp4"
            type="video/mp4; codecs=avc1.42E01E,mp4a.40.2"
          />
          <img
            src="/images/ufc-fight-scene.jpg"
            alt="MMA Fight Fallback"
            className="absolute inset-0 w-full h-full object-cover"
          />
        </video>
        <div className="absolute inset-0 bg-gray-900/70"></div>{" "}
        {/* Darker overlay for readability */}
        <h1
          className="relative text-6xl font-bold text-blood-red tracking-tight drop-shadow-[0_0_10px_rgba(230,230,250,0.8)]"
          style={{ fontFamily: "'Nosifer', sans-serif" }}
        >
          The Combat Vault
        </h1>
        <p className="relative text-2xl text-pearl-white mb-6">
          Step into the octagon with cutting-edge MMA betting tools—analyze
          fights, build DFS teams, and dominate the cage!
        </p>
        <p className="relative text-red-800 font-semibold">
          <strong>Warning:</strong> For entertainment only. DFS and betting are
          21+. Call 1-800-GAMBLER for help. We’re not liable for losses—fight
          smart!
        </p>
      </header>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="card bg-gray-800 border-pearl-white">
          <h2 className="text-2xl font-semibold text-pearl-white mb-2">
            Fight Analyzer
          </h2>
          <p className="text-gray-300">
            Dive into gritty stats on striking, grappling, and more to predict
            fight outcomes like a pro.
          </p>
          <a
            href="/fight-analyzer"
            className="mt-4 inline-block bg-gradient-to-r from-pearl-white to-gray-200 text-gray-900 font-bold py-2 px-4 rounded-lg shadow-[0_0_10px_rgba(230,230,250,0.8)] hover:shadow-[0_0_15px_rgba(230,230,250,1)] transition duration-300"
          >
            Analyze Now
          </a>
        </div>
        <div className="card bg-gray-800 border-pearl-white">
          <h2 className="text-2xl font-semibold text-pearl-white mb-2">
            DFS Team Builder
          </h2>
          <p className="text-gray-300">
            Generate or hand-pick DraftKings teams with custom fighter limits
            for maximum edge.
          </p>
          <a
            href="/team-combinations"
            className="mt-4 inline-block bg-gradient-to-r from-pearl-white to-gray-200 text-gray-900 font-bold py-2 px-4 rounded-lg shadow-[0_0_10px_rgba(230,230,250,0.8)] hover:shadow-[0_0_15px_rgba(230,230,250,1)] transition duration-300"
          >
            Build Teams
          </a>
        </div>
        <div className="card bg-gray-800 border-pearl-white">
          <h2 className="text-2xl font-semibold text-pearl-white mb-2">
            UFC Roster
          </h2>
          <p className="text-gray-300">
            Explore the full UFC roster with detailed bios and hard-hitting
            stats.
          </p>
          <a
            href="/roster"
            className="mt-4 inline-block bg-gradient-to-r from-pearl-white to-gray-200 text-gray-900 font-bold py-2 px-4 rounded-lg shadow-[0_0_10px_rgba(230,230,250,0.8)] hover:shadow-[0_0_15px_rgba(230,230,250,1)] transition duration-300"
          >
            View Roster
          </a>
        </div>
        <div className="card bg-gray-800 border-pearl-white">
          <h2 className="text-2xl font-semibold text-pearl-white mb-2">
            Video Vault
          </h2>
          <p className="text-gray-300">
            Relive the wildest, bloodiest, and funniest moments in MMA history.
          </p>
          <a
            href="/video-vault"
            className="mt-4 inline-block bg-gradient-to-r from-pearl-white to-gray-200 text-gray-900 font-bold py-2 px-4 rounded-lg shadow-[0_0_10px_rgba(230,230,250,0.8)] hover:shadow-[0_0_15px_rgba(230,230,250,1)] transition duration-300"
          >
            Watch Now
          </a>
        </div>
        <div className="card bg-gray-800 border-pearl-white">
          <h2 className="text-2xl font-semibold text-pearl-white mb-2">
            Shop Tattoos
          </h2>
          <p className="text-gray-300">
            Get inked with MMA-inspired designs—show your fighter spirit!
          </p>
          <a
            href="/shop-tattoos"
            className="mt-4 inline-block bg-gradient-to-r from-pearl-white to-gray-200 text-gray-900 font-bold py-2 px-4 rounded-lg shadow-[0_0_10px_rgba(230,230,250,0.8)] hover:shadow-[0_0_15px_rgba(230,230,250,1)] transition duration-300"
          >
            Shop Tattoos
          </a>
        </div>
        <div className="card bg-gray-800 border-pearl-white">
          <h2 className="text-2xl font-semibold text-pearl-white mb-2">
            Latest Odds
          </h2>
          <p className="text-gray-300">
            Check real-time UFC betting odds from top bookmakers.
          </p>
          <a
            href="/latest-odds"
            className="mt-4 inline-block bg-gradient-to-r from-pearl-white to-gray-200 text-gray-900 font-bold py-2 px-4 rounded-lg shadow-[0_0_10px_rgba(230,230,250,0.8)] hover:shadow-[0_0_15px_rgba(230,230,250,1)] transition duration-300"
          >
            View Odds
          </a>
        </div>
      </div>
    </div>
  );
};

export default Home;
