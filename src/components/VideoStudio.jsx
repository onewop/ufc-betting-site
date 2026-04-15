import React, { useState, useEffect, useCallback, useRef } from "react";
import api from "../services/api";
import FighterImage from "./FighterImage";

// ── helpers ────────────────────────────────────────────────────────────────
const statLabel = (key) =>
  ({
    slpm: "Strikes Landed/min",
    sapm: "Strikes Absorbed/min",
    striking_accuracy: "Striking Acc %",
    striking_defense: "Striking Def %",
    td_avg: "TD Avg/15min",
    td_defense: "TD Defense %",
    finish_rate_pct: "Finish Rate %",
    avg_fight_duration: "Avg Fight (min)",
  })[key] ?? key;

const fmt = (v) => (v == null ? "—" : typeof v === "number" ? v.toFixed(1) : v);

// colour-code who has the advantage for a given stat
const advantage = (a, b, higherIsBetter = true) => {
  if (a == null || b == null) return [null, null];
  return higherIsBetter
    ? a > b
      ? ["green", "red"]
      : a < b
        ? ["red", "green"]
        : [null, null]
    : a < b
      ? ["green", "red"]
      : a > b
        ? ["red", "green"]
        : [null, null];
};

const STAT_ROWS = [
  { key: "slpm", higherIsBetter: true },
  { key: "sapm", higherIsBetter: false },
  { key: "striking_accuracy", higherIsBetter: true },
  { key: "striking_defense", higherIsBetter: true },
  { key: "td_avg", higherIsBetter: true },
  { key: "td_defense", higherIsBetter: true },
  { key: "finish_rate_pct", higherIsBetter: true },
  { key: "avg_fight_duration", higherIsBetter: false },
];

const numericStat = (val) => parseFloat(String(val).replace("%", "")) || 0;

// copy text to clipboard with brief feedback
function useCopy() {
  const [copied, setCopied] = useState(null);
  const copy = useCallback((text, id) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(id);
      setTimeout(() => setCopied(null), 1500);
    });
  }, []);
  return [copied, copy];
}

// ── sub-components ─────────────────────────────────────────────────────────

function CopyBtn({ text, id, copied, onCopy }) {
  return (
    <button
      onClick={() => onCopy(text, id)}
      title="Copy to clipboard"
      className="ml-1 text-yellow-600 hover:text-yellow-400 text-xs transition"
    >
      {copied === id ? "✓" : "⎘"}
    </button>
  );
}

function FighterCard({ fighter, side, videoMode, shorts }) {
  const textAlign = shorts
    ? "text-center"
    : side === "left"
      ? "text-left"
      : "text-right";
  const flexDir = shorts
    ? "flex-col items-center"
    : side === "left"
      ? "flex-row"
      : "flex-row-reverse";

  return (
    <div className={`flex ${flexDir} items-center gap-3`}>
      <FighterImage
        name={fighter.name}
        size={
          shorts
            ? "w-24 h-24"
            : videoMode
              ? "w-28 h-28 sm:w-36 sm:h-36"
              : "w-20 h-20 sm:w-28 sm:h-28"
        }
        className=""
      />
      <div className={textAlign}>
        <div
          className="font-black text-stone-100 uppercase tracking-wider leading-tight"
          style={{
            fontFamily: "'Impact', sans-serif",
            fontSize: videoMode ? "1.35rem" : "1.05rem",
          }}
        >
          {fighter.name}
        </div>
        <div className="text-yellow-500 text-sm font-bold tracking-widest mt-0.5">
          {fighter.record ?? "—"}
        </div>
        <div className="text-stone-400 text-xs tracking-wide mt-0.5">
          {fighter.weight_class ?? ""}
        </div>
        <div className="text-stone-500 text-xs mt-1">
          {fighter.wins_ko_tko ?? 0}KO · {fighter.wins_submission ?? 0}SUB ·{" "}
          {fighter.wins_decision ?? 0}DEC
        </div>
        {fighter.salary && (
          <div className="text-stone-400 text-xs mt-1">
            DK ${fighter.salary?.toLocaleString()}
          </div>
        )}
      </div>
    </div>
  );
}

// ── main component ─────────────────────────────────────────────────────────

export default function VideoStudio() {
  const [fights, setFights] = useState([]);
  const [eventName, setEventName] = useState("UFC Event");
  const [selectedFightId, setSelectedFightId] = useState(0);
  const [videoMode, setVideoMode] = useState(false);
  const [layout, setLayout] = useState("wide"); // "wide" | "shorts"
  const [prediction, setPrediction] = useState("");
  const [obsOpen, setObsOpen] = useState(false);
  const [obsFloatOpen, setObsFloatOpen] = useState(true);
  const [testCountdown, setTestCountdown] = useState(null);
  const [flashActive, setFlashActive] = useState(false);
  const [copied, onCopy] = useCopy();
  const containerRef = useRef(null);

  // ── load data ──────────────────────────────────────────────────────────
  useEffect(() => {
    api.get("/api/this-weeks-stats")
      .then((data) => {
        setFights(data.fights ?? []);
        const ev = data.event;
        setEventName(
          ev && typeof ev === "object"
            ? (ev.name ?? "UFC Event")
            : (ev ?? "UFC Event"),
        );
      })
      .catch(() => {});
  }, []);

  // ── test recording countdown tick ──────────────────────────────────────
  useEffect(() => {
    if (testCountdown === null || testCountdown === 0) {
      if (testCountdown === 0) setTestCountdown(null);
      return;
    }
    const t = setTimeout(() => setTestCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [testCountdown]);

  const startTestRecording = () => {
    setFlashActive(true);
    setTimeout(() => setFlashActive(false), 250);
    setTestCountdown(10);
  };

  // ── hide AppShell nav/footer in video mode ─────────────────────────────
  useEffect(() => {
    const nav = document.querySelector("nav[aria-label='Main navigation']");
    const footer = document.querySelector("footer");
    const eventBar = document.querySelector(
      ".bg-gray-800.text-yellow-400.text-center",
    );
    const mobileNav = document.querySelector(
      "nav[aria-label='Mobile quick navigation']",
    );
    [nav, footer, eventBar, mobileNav].forEach((el) => {
      if (el) el.style.display = videoMode ? "none" : "";
    });
    return () => {
      [nav, footer, eventBar, mobileNav].forEach((el) => {
        if (el) el.style.display = "";
      });
    };
  }, [videoMode]);

  const selectedFight =
    fights.find((f) => f.fight_id === selectedFightId) ?? fights[0];
  if (!selectedFight) {
    return (
      <div className="min-h-screen bg-stone-950 flex items-center justify-center text-stone-400 font-mono">
        Loading fight data…
      </div>
    );
  }

  const [f1, f2] = selectedFight.fighters;

  // build stat comparison rows
  const statRows = STAT_ROWS.map(({ key, higherIsBetter }) => {
    const v1 = numericStat(f1.stats?.[key] ?? f1[key]);
    const v2 = numericStat(f2.stats?.[key] ?? f2[key]);
    const [c1, c2] = advantage(v1, v2, higherIsBetter);
    const raw1 = f1.stats?.[key] ?? f1[key];
    const raw2 = f2.stats?.[key] ?? f2[key];
    return { key, label: statLabel(key), v1: raw1, v2: raw2, c1, c2 };
  });

  const cellColor = (c) =>
    c === "green"
      ? "text-green-400"
      : c === "red"
        ? "text-red-400"
        : "text-stone-300";

  // generate a copy-friendly summary
  const buildSummary = () => {
    const rows = statRows
      .map((r) => `${r.label}: ${fmt(r.v1)} vs ${fmt(r.v2)}`)
      .join("\n");
    return `${eventName}\n${f1.name} (${f1.record}) vs ${f2.name} (${f2.record})\n\n${rows}\n\nMY PICK: ${prediction}`;
  };

  // ── video mode wrapper ─────────────────────────────────────────────────
  const containerClass = videoMode
    ? layout === "shorts"
      ? "fixed inset-0 z-[200] bg-stone-950 overflow-auto flex flex-col"
      : "fixed inset-0 z-[200] bg-stone-950 overflow-auto"
    : "min-h-screen bg-stone-950";

  return (
    <div
      ref={containerRef}
      className={containerClass}
      style={{ fontFamily: "'Courier New', monospace" }}
    >
      {/* ── toolbar ─────────────────────────────────────────────────── */}
      {!videoMode && (
        <div className="sticky top-0 z-40 bg-stone-900/95 border-b border-yellow-900/60 backdrop-blur px-4 py-2 flex flex-wrap items-center gap-3">
          <span className="text-yellow-500 text-xs font-bold tracking-widest uppercase">
            ⚡ CREATOR STUDIO
          </span>

          {/* fight selector */}
          <select
            value={selectedFightId}
            onChange={(e) => setSelectedFightId(Number(e.target.value))}
            className="ml-auto bg-stone-800 text-stone-200 border border-yellow-900/60 rounded px-2 py-1 text-xs focus:outline-none focus:border-yellow-600"
          >
            {fights.map((f) => (
              <option key={f.fight_id} value={f.fight_id}>
                {f.fighters[0].name} vs {f.fighters[1].name}
              </option>
            ))}
          </select>

          <button
            onClick={() => setVideoMode(true)}
            className="bg-red-800 hover:bg-red-700 text-white text-xs font-bold tracking-widest uppercase px-3 py-1.5 border border-red-600 transition"
          >
            ● ENTER VIDEO MODE
          </button>
        </div>
      )}

      {/* ── video-mode toolbar ──────────────────────────────────────── */}
      {videoMode && (
        <div className="bg-stone-900 border-b border-yellow-900/60 px-4 py-2 flex flex-wrap items-center gap-3">
          <button
            onClick={() => setVideoMode(false)}
            className="text-stone-400 hover:text-yellow-400 text-xs tracking-widest uppercase transition"
          >
            ✕ EXIT VIDEO MODE
          </button>

          <select
            value={selectedFightId}
            onChange={(e) => setSelectedFightId(Number(e.target.value))}
            className="bg-stone-800 text-stone-200 border border-yellow-900/60 rounded px-2 py-1 text-xs focus:outline-none"
          >
            {fights.map((f) => (
              <option key={f.fight_id} value={f.fight_id}>
                {f.fighters[0].name} vs {f.fighters[1].name}
              </option>
            ))}
          </select>

          <div className="ml-auto flex gap-2 flex-wrap">
            <button
              onClick={() => onCopy(buildSummary(), "toolbar-copy")}
              className="bg-yellow-900/50 hover:bg-yellow-800/60 text-yellow-400 text-[10px] font-bold tracking-widest uppercase px-3 py-1 border border-yellow-900/60 transition"
            >
              {copied === "toolbar-copy" ? "✓ COPIED" : "⎘ COPY SUMMARY"}
            </button>
            <button
              onClick={startTestRecording}
              disabled={testCountdown !== null}
              className="bg-red-950 hover:bg-red-900 text-red-400 text-[10px] font-bold tracking-widest uppercase px-3 py-1 border border-red-900/60 transition disabled:opacity-40"
            >
              {testCountdown !== null
                ? `⏺ ${testCountdown}s`
                : "⏺ TEST CAPTURE"}
            </button>
            <button
              onClick={() => setLayout(layout === "wide" ? "shorts" : "wide")}
              className="bg-stone-800 hover:bg-stone-700 text-yellow-400 text-[10px] tracking-widest uppercase px-3 py-1 border border-yellow-900/60 transition"
            >
              {layout === "wide" ? "☰ LANDSCAPE" : "▯ SHORTS / TIKTOK"}
            </button>
          </div>
        </div>
      )}

      {/* ── Floating OBS Quick Tips (video mode only) ────────────── */}
      {videoMode && (
        <div
          className="fixed top-14 left-3 z-[300] select-none"
          style={{ maxWidth: "230px" }}
        >
          <button
            onClick={() => setObsFloatOpen((o) => !o)}
            className="w-full flex items-center justify-between bg-stone-900/95 border border-yellow-900/60 px-3 py-1.5 text-left backdrop-blur"
          >
            <span className="text-yellow-500 text-[10px] font-bold tracking-widest uppercase">
              ⚡ OBS QUICK TIPS
            </span>
            <span className="text-stone-400 text-xs ml-2">
              {obsFloatOpen ? "▲" : "▼"}
            </span>
          </button>
          {obsFloatOpen && (
            <div className="bg-stone-900/95 border border-yellow-900/40 border-t-0 px-3 py-2 text-[10px] text-stone-400 space-y-1.5 backdrop-blur">
              <div>
                <span className="text-yellow-500 font-bold">1.</span> Window
                Capture this tab in OBS
              </div>
              <div>
                <span className="text-yellow-500 font-bold">2.</span> Add Webcam
                → resize to dashed box
              </div>
              <div>
                <span className="text-yellow-500 font-bold">3.</span> Optional:
                chroma key or circle crop
              </div>
              <div>
                <span className="text-yellow-500 font-bold">4.</span> Record in
                1080p or 4K
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── main content ─────────────────────────────────────────────── */}
      <div
        className={
          videoMode && layout === "shorts"
            ? "flex-1 flex flex-col max-w-[430px] mx-auto w-full px-4 py-4 gap-4"
            : videoMode
              ? "max-w-6xl mx-auto px-4 py-6 space-y-6 pr-[200px] pb-32"
              : "max-w-6xl mx-auto px-4 py-6 space-y-6"
        }
      >
        {/* ── Section 1 · VS Hero ──────────────────────────────────── */}
        <section className="border border-yellow-900/60 bg-stone-900/70">
          {/* header */}
          <div className="flex items-center justify-between border-b border-yellow-900/40 px-4 py-2">
            <span className="text-yellow-600 text-xs font-bold tracking-widest uppercase">
              ◆ MATCHUP
            </span>
            <span className="text-stone-500 text-xs tracking-widest uppercase">
              {eventName}
            </span>
            <CopyBtn
              text={`${f1.name} vs ${f2.name}`}
              id="matchup"
              copied={copied}
              onCopy={onCopy}
            />
          </div>

          {/* Wide layout: fighters side-by-side */}
          {!(videoMode && layout === "shorts") && (
            <div className="flex items-center justify-between px-4 py-6 gap-4">
              <FighterCard
                fighter={f1}
                side="left"
                videoMode={videoMode}
                shorts={false}
              />
              <div className="flex flex-col items-center shrink-0">
                <div
                  className="text-yellow-500 font-black text-2xl sm:text-4xl tracking-widest"
                  style={{ fontFamily: "'Impact', sans-serif" }}
                >
                  VS
                </div>
                <div className="text-stone-500 text-xs tracking-widest uppercase mt-1">
                  {selectedFight.weight_class ?? f1.weight_class}
                </div>
                <div className="text-stone-600 text-xs mt-1">
                  Fight {selectedFight.fight_id + 1} of {fights.length}
                </div>
              </div>
              <FighterCard
                fighter={f2}
                side="right"
                videoMode={videoMode}
                shorts={false}
              />
            </div>
          )}

          {/* Shorts layout: fighters stacked vertically */}
          {videoMode && layout === "shorts" && (
            <div className="flex flex-col items-center gap-3 px-4 py-4">
              <FighterCard
                fighter={f1}
                side="left"
                videoMode={videoMode}
                shorts={true}
              />
              <div className="flex flex-col items-center">
                <div
                  className="text-yellow-500 font-black text-3xl tracking-widest"
                  style={{ fontFamily: "'Impact', sans-serif" }}
                >
                  VS
                </div>
                <div className="text-stone-500 text-xs tracking-widest uppercase">
                  {selectedFight.weight_class ?? f1.weight_class}
                </div>
              </div>
              <FighterCard
                fighter={f2}
                side="right"
                videoMode={videoMode}
                shorts={true}
              />
            </div>
          )}
        </section>

        {/* ── Section 2 · Stats Table ───────────────────────────────── */}
        <section className="border border-yellow-900/60 bg-stone-900/70">
          <div className="flex items-center justify-between border-b border-yellow-900/40 px-4 py-2">
            <span className="text-yellow-600 text-xs font-bold tracking-widest uppercase">
              ◆ STAT BREAKDOWN
            </span>
            <CopyBtn
              text={statRows
                .map((r) => `${r.label}: ${fmt(r.v1)} vs ${fmt(r.v2)}`)
                .join("\n")}
              id="stats"
              copied={copied}
              onCopy={onCopy}
            />
          </div>

          <div className="px-4 py-3">
            <div className="grid grid-cols-3 text-xs text-stone-500 uppercase tracking-widest pb-2 border-b border-stone-800">
              <div>{f1.name.split(" ").pop()}</div>
              <div className="text-center">STAT</div>
              <div className="text-right">{f2.name.split(" ").pop()}</div>
            </div>

            {statRows.map(({ key, label, v1, v2, c1, c2 }) => (
              <div
                key={key}
                className="grid grid-cols-3 text-xs py-1.5 border-b border-stone-800/50 items-center"
              >
                <div className={`font-bold ${cellColor(c1)}`}>{fmt(v1)}</div>
                <div className="text-center text-stone-400 tracking-wide">
                  {label}
                </div>
                <div className={`text-right font-bold ${cellColor(c2)}`}>
                  {fmt(v2)}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Section 3 · Fighter Profiles ─────────────────────────── */}
        <section className="border border-yellow-900/60 bg-stone-900/70">
          <div className="flex items-center border-b border-yellow-900/40 px-4 py-2">
            <span className="text-yellow-600 text-xs font-bold tracking-widest uppercase">
              ◆ FIGHTER INTEL
            </span>
          </div>

          <div className="grid grid-cols-2 gap-px bg-stone-800">
            {[f1, f2].map((f) => (
              <div
                key={f.name}
                className="bg-stone-900/80 px-4 py-3 space-y-1 text-xs"
              >
                <div className="text-stone-300 font-bold tracking-wide">
                  {f.name}
                </div>
                <div className="text-stone-500">
                  Team: <span className="text-stone-300">{f.team ?? "—"}</span>
                </div>
                <div className="text-stone-500">
                  Height:{" "}
                  <span className="text-stone-300">{f.height ?? "—"}</span> ·
                  Reach:{" "}
                  <span className="text-stone-300">{f.reach ?? "—"}</span>
                </div>
                <div className="text-stone-500">
                  Stance:{" "}
                  <span className="text-stone-300">{f.stance ?? "—"}</span>
                </div>
                <div className="text-stone-500">
                  Last 5:{" "}
                  <span className="text-stone-300">
                    {f.record_last_5 ?? "—"}
                  </span>
                </div>
                <div className="text-stone-500">
                  Last fight:{" "}
                  <span
                    className={
                      String(f.last_fight_result ?? "").startsWith("W")
                        ? "text-green-400"
                        : "text-red-400"
                    }
                  >
                    {f.last_fight_result ?? "—"}
                  </span>
                </div>
                <div className="text-stone-500">
                  Streak:{" "}
                  <span className="text-stone-300">
                    {(f.current_win_streak ?? 0) > 0
                      ? `${f.current_win_streak}W`
                      : (f.current_loss_streak ?? 0) > 0
                        ? `${f.current_loss_streak}L`
                        : "—"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Section 4 · My Prediction ────────────────────────────── */}
        <section className="border border-yellow-900/60 bg-stone-900/70">
          <div className="flex items-center justify-between border-b border-yellow-900/40 px-4 py-2">
            <span className="text-yellow-600 text-xs font-bold tracking-widest uppercase">
              ◆ MY PICK / NOTES
            </span>
            <CopyBtn
              text={buildSummary()}
              id="summary"
              copied={copied}
              onCopy={onCopy}
            />
          </div>

          <div className="px-4 py-3">
            <textarea
              value={prediction}
              onChange={(e) => setPrediction(e.target.value)}
              placeholder={`e.g. ${f1.name} by KO R2 — better striking, bigger reach…`}
              rows={videoMode ? 4 : 6}
              className="w-full bg-stone-800 text-stone-200 border border-stone-700 focus:border-yellow-600 rounded-none px-3 py-2 text-sm resize-none focus:outline-none placeholder-stone-600"
              style={{ fontFamily: "'Courier New', monospace" }}
            />
            <div className="flex gap-2 mt-2">
              <button
                onClick={() => onCopy(buildSummary(), "summary-btn")}
                className="bg-yellow-900/50 hover:bg-yellow-800/60 text-yellow-400 text-xs tracking-widest uppercase px-3 py-1.5 border border-yellow-900/60 transition"
              >
                {copied === "summary-btn" ? "✓ COPIED" : "⎘ COPY FULL SUMMARY"}
              </button>
              <button
                onClick={() => setPrediction("")}
                className="text-stone-600 hover:text-stone-400 text-xs tracking-widest uppercase px-3 py-1.5 border border-stone-800 transition"
              >
                CLEAR
              </button>
            </div>
          </div>
        </section>

        {/* ── Section 5 · OBS Tips ─────────────────────────────────── */}
        {!videoMode && (
          <section className="border border-yellow-900/60 bg-stone-900/70">
            <button
              onClick={() => setObsOpen((o) => !o)}
              className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-stone-800/40 transition"
            >
              <span className="text-yellow-600 text-xs font-bold tracking-widest uppercase">
                ◆ OBS SETUP GUIDE
              </span>
              <span className="text-stone-400 text-sm">
                {obsOpen ? "▲" : "▼"}
              </span>
            </button>

            {obsOpen && (
              <div className="px-4 py-4 text-xs text-stone-400 space-y-3 border-t border-yellow-900/40">
                <div>
                  <div className="text-yellow-500 font-bold tracking-widest uppercase mb-1">
                    1 · Browser Source
                  </div>
                  <p>
                    In OBS:{" "}
                    <strong className="text-stone-200">
                      Sources → + → Browser
                    </strong>
                    . Set URL to{" "}
                    <span className="text-yellow-400 font-mono">
                      http://localhost:3000/video-studio
                    </span>
                    . Width:{" "}
                    <span className="font-mono text-stone-200">1920</span>,
                    Height:{" "}
                    <span className="font-mono text-stone-200">1080</span>.
                    Check <em>"Shutdown source when not visible"</em> +{" "}
                    <em>"Refresh browser when scene becomes active"</em>.
                  </p>
                </div>
                <div>
                  <div className="text-yellow-500 font-bold tracking-widest uppercase mb-1">
                    2 · Facecam PiP Zone
                  </div>
                  <p>
                    Click{" "}
                    <strong className="text-stone-200 font-mono">
                      ● ENTER VIDEO MODE
                    </strong>{" "}
                    first — a translucent overlay marks the facecam zone
                    (bottom-right). In OBS, add your webcam source, drag it on
                    top of the overlay region, then remove/hide the overlay.
                  </p>
                </div>
                <div>
                  <div className="text-yellow-500 font-bold tracking-widest uppercase mb-1">
                    3 · Shorts / TikTok
                  </div>
                  <p>
                    Switch to{" "}
                    <strong className="text-stone-200">SHORTS / TIKTOK</strong>{" "}
                    layout in video mode. Resize the browser source to{" "}
                    <span className="font-mono text-stone-200">
                      1080 × 1920
                    </span>
                    . Enable vertical crop in your streaming platform settings.
                  </p>
                </div>
                <div>
                  <div className="text-yellow-500 font-bold tracking-widest uppercase mb-1">
                    4 · Fight Switcher
                  </div>
                  <p>
                    Use the fight selector dropdown (visible in both modes) to
                    jump between bouts live during your stream without touching
                    OBS. All stats update instantly.
                  </p>
                </div>
              </div>
            )}
          </section>
        )}
      </div>

      {/* ── Facecam PiP Overlay (video mode only) ─────────────────── */}
      {videoMode && layout === "wide" && (
        /* Landscape: 16/9 rectangle — bottom-right */
        <div
          className="fixed bottom-6 right-6 z-[300] pointer-events-none select-none"
          style={{ width: "290px", aspectRatio: "16/9" }}
        >
          <div className="w-full h-full border-4 border-dashed border-yellow-400/80 bg-black/30 rounded flex flex-col items-center justify-center text-center px-3 gap-1">
            <span className="text-yellow-300 text-[11px] font-bold uppercase tracking-widest leading-tight">
              DRAG YOUR WEBCAM
            </span>
            <span className="text-yellow-300 text-[11px] font-bold uppercase tracking-widest leading-tight">
              HERE IN OBS
            </span>
            <span className="text-stone-400 text-[9px] uppercase tracking-wide mt-0.5">
              16:9 · PiP
            </span>
          </div>
        </div>
      )}

      {videoMode && layout === "shorts" && (
        /* Shorts/TikTok: circle — bottom-right */
        <div
          className="fixed bottom-6 right-4 z-[300] pointer-events-none select-none"
          style={{ width: "160px", height: "160px" }}
        >
          <div className="w-full h-full border-4 border-dashed border-yellow-400/80 bg-black/30 rounded-full flex flex-col items-center justify-center text-center px-3 gap-0.5">
            <span className="text-yellow-300 text-[9px] font-bold uppercase tracking-widest leading-tight">
              DRAG WEBCAM
            </span>
            <span className="text-yellow-300 text-[9px] font-bold uppercase tracking-widest leading-tight">
              HERE IN OBS
            </span>
            <span className="text-stone-400 text-[8px] uppercase tracking-wide">
              CIRCLE CROP
            </span>
          </div>
        </div>
      )}

      {/* ── Test capture countdown ─────────────────────────────────── */}
      {testCountdown !== null && (
        <div className="fixed inset-0 z-[400] pointer-events-none flex items-center justify-center">
          <div
            className="font-black text-white/80 leading-none"
            style={{
              fontFamily: "'Impact', sans-serif",
              fontSize: "18vw",
              textShadow: "0 0 60px rgba(255,50,50,0.9), 2px 2px 0 #000",
            }}
          >
            {testCountdown}
          </div>
        </div>
      )}

      {/* ── Screen flash ──────────────────────────────────────────── */}
      {flashActive && (
        <div className="fixed inset-0 z-[500] pointer-events-none bg-white/40" />
      )}
    </div>
  );
}
