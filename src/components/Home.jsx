import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";

export default function Home() {
  const [eventTitle, setEventTitle] = useState("UFC Fight Night");

  useEffect(() => {
    fetch("/current_event.json")
      .then((r) => r.json())
      .then((d) => { if (d.title) setEventTitle(d.title); })
      .catch(() => {});
  }, []);

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-stone-950">
      {/* Video bg */}
      <video
        autoPlay
        loop
        muted
        playsInline
        preload="auto"
        className="absolute inset-0 w-full h-full object-cover opacity-25 grayscale sepia"
      >
        <source src="/ufc-fight-loop.mp4" type="video/mp4" />
      </video>

      {/* Camo texture overlay */}
      <div
        className="absolute inset-0 z-10 pointer-events-none opacity-5"
        style={{
          backgroundImage: `radial-gradient(circle at 25% 35%, #4a5240 15%, transparent 15%),
            radial-gradient(circle at 75% 15%, #3a4230 10%, transparent 10%),
            radial-gradient(circle at 55% 65%, #4a5240 20%, transparent 20%),
            radial-gradient(circle at 10% 80%, #3a4230 12%, transparent 12%),
            radial-gradient(circle at 90% 70%, #4a5240 18%, transparent 18%)`,
          backgroundSize: "120px 120px",
          backgroundColor: "#2d3020",
        }}
      ></div>

      {/* Dark gradient overlay */}
      <div
        className="absolute inset-0 z-10 pointer-events-none"
        style={{
          background:
            "linear-gradient(to bottom, rgba(0,0,0,0.45) 0%, rgba(0,0,0,0.2) 50%, rgba(0,0,0,0.55) 100%)",
        }}
      ></div>

      <div
        className="relative z-20 flex flex-col items-center justify-center min-h-screen px-4 py-4"
        style={{ fontFamily: "'Courier New', monospace" }}
      >
        {/* Classification banner */}
        <div className="w-full max-w-7xl mb-4">
          <div className="flex items-center justify-between border border-yellow-700/50 bg-yellow-900/20 px-4 py-2">
            <span className="text-yellow-500 text-xs font-bold tracking-widest uppercase">
              ⚡ CLASSIFIED
            </span>
            <span className="text-yellow-500/60 text-xs tracking-wider hidden sm:inline">
              CLEARANCE: LEVEL 5
            </span>
            <span className="text-yellow-500 text-xs font-bold tracking-widest uppercase">
              TOP SECRET ⚡
            </span>
          </div>
        </div>

        {/* Header / Hero */}
        <div className="text-center mb-8 max-w-4xl">
          <div className="text-xs text-stone-400 tracking-[0.5em] uppercase mb-3">
            ◆ UFC FIGHT NIGHT ◆
          </div>
          <h1
            className="text-2xl sm:text-3xl md:text-5xl font-black text-stone-100 tracking-wider uppercase leading-tight mb-4"
            style={{
              fontFamily: "'Impact', sans-serif",
              textShadow:
                "2px 2px 0 #4a5240, 4px 4px 0 #2d3020, 0 0 40px rgba(100,120,80,0.3)",
            }}
          >
            {eventTitle}
          </h1>
          <div className="w-32 h-1 bg-gradient-to-r from-transparent via-yellow-700 to-transparent mx-auto mb-4"></div>
          <p className="text-stone-400 text-sm leading-relaxed tracking-wide mb-4">
            Live Odds & Analysis – Prelims start at 4 PM CT
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center items-center">
            <Link
              to="/fight-analyzer"
              className="bg-yellow-700 hover:bg-yellow-600 text-stone-950 font-bold px-6 py-3 rounded-lg uppercase tracking-wide transition-colors duration-200"
            >
              ▶ Start with Fight Analyzer
            </Link>
            <Link
              to="/parlay-builder"
              className="bg-stone-800 hover:bg-stone-700 text-stone-200 font-bold px-6 py-3 rounded-lg uppercase tracking-wide transition-colors duration-200 border border-stone-600"
            >
              Build Your Parlay
            </Link>
            <Link
              to="/odds"
              className="bg-stone-800 hover:bg-stone-700 text-stone-200 font-bold px-6 py-3 rounded-lg uppercase tracking-wide transition-colors duration-200 border border-stone-600"
            >
              View Latest Odds
            </Link>
          </div>
        </div>

        {/* Latest News Section */}
        <div className="w-full max-w-5xl mb-8">
          <div className="border border-yellow-700/50 rounded-lg bg-stone-900 p-6">
            <h2 className="text-xl font-bold text-yellow-500 mb-4 uppercase tracking-wide">
              Latest News – Fight Week Updates
            </h2>

            {/* Weigh-In Videos */}
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-stone-200 mb-3">
                This Week's Weigh-In Videos
              </h3>
              <p className="text-stone-400 text-sm leading-relaxed mb-4">
                Weigh-In Videos will be available Friday morning after the official weigh-ins.
                <br />
                <span className="text-stone-500">Full Weigh-In Video (~2 hours) • Official Highlights (~5–6 minutes) • Individual 5–10 second fighter clips</span>
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="border border-stone-700 rounded-lg p-4 bg-stone-950 text-center">
                  <div className="text-yellow-500 text-2xl mb-2">🎥</div>
                  <h4 className="text-stone-200 font-semibold mb-1">Full Weigh-In Video</h4>
                  <p className="text-stone-500 text-xs">Coming Friday morning</p>
                </div>
                <div className="border border-stone-700 rounded-lg p-4 bg-stone-950 text-center">
                  <div className="text-yellow-500 text-2xl mb-2">✂️</div>
                  <h4 className="text-stone-200 font-semibold mb-1">Official Highlights</h4>
                  <p className="text-stone-500 text-xs">Coming Friday morning</p>
                </div>
                <div className="border border-stone-700 rounded-lg p-4 bg-stone-950 text-center">
                  <div className="text-yellow-500 text-2xl mb-2">👤</div>
                  <h4 className="text-stone-200 font-semibold mb-1">Fighter Clips</h4>
                  <p className="text-stone-500 text-xs">Coming Friday morning</p>
                </div>
              </div>
            </div>

            {/* Last-Minute Changes */}
            <div>
              <h3 className="text-lg font-semibold text-stone-200 mb-3">
                Last-Minute Fight Changes & News
              </h3>
              <p className="text-stone-400 text-sm leading-relaxed">
                No last-minute changes reported yet.
              </p>
            </div>
          </div>
        </div>

        {/* Quick Tools Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 w-full max-w-5xl">
          <Link
            to="/fight-analyzer"
            className="border border-yellow-700/50 rounded-lg bg-stone-900 hover:bg-stone-800 p-4 transition-colors duration-200 group"
          >
            <div className="text-yellow-500 text-2xl mb-2">⊕</div>
            <h3 className="text-stone-200 font-bold mb-1 uppercase tracking-wide">Fight Analyzer</h3>
            <p className="text-stone-400 text-sm">Deep stats & analysis</p>
          </Link>
          <Link
            to="/parlay-builder"
            className="border border-stone-700 rounded-lg bg-stone-900 hover:bg-stone-800 p-4 transition-colors duration-200 group"
          >
            <div className="text-stone-400 text-2xl mb-2">🎯</div>
            <h3 className="text-stone-200 font-bold mb-1 uppercase tracking-wide">Parlay Builder</h3>
            <p className="text-stone-400 text-sm">Build winning parlays</p>
          </Link>
          <Link
            to="/odds"
            className="border border-stone-700 rounded-lg bg-stone-900 hover:bg-stone-800 p-4 transition-colors duration-200 group"
          >
            <div className="text-stone-400 text-2xl mb-2">$</div>
            <h3 className="text-stone-200 font-bold mb-1 uppercase tracking-wide">Live Odds</h3>
            <p className="text-stone-400 text-sm">Real-time betting lines</p>
          </Link>
          <Link
            to="/team-combinations"
            className="border border-stone-700 rounded-lg bg-stone-900 hover:bg-stone-800 p-4 transition-colors duration-200 group"
          >
            <div className="text-stone-400 text-2xl mb-2">◈</div>
            <h3 className="text-stone-200 font-bold mb-1 uppercase tracking-wide">DFS Teams</h3>
            <p className="text-stone-400 text-sm">Optimize fantasy squads</p>
          </Link>
        </div>

        {/* Footer */}
        <div className="mt-8 w-full max-w-7xl">
          <div className="border-t border-stone-700/50 pt-4 flex justify-between items-center">
            <span className="text-stone-600 text-xs tracking-widest uppercase">
              End Of Briefing
            </span>
            <Link
              to="/"
              className="text-stone-500 hover:text-yellow-500 text-xs tracking-widest uppercase transition-colors duration-200"
            >
              ← Back To Base
            </Link>
            <span className="text-stone-600 text-xs tracking-widest uppercase">
              Destroy After Reading
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
