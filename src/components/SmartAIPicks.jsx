/**
 * SmartAIPicks.jsx — AI Expert Recommendations page.
 *
 * Strategy-based lineup generation:
 *  - Users pick a strategy (Highest Projection, Best Value, Contrarian, etc.)
 *  - First click loads 3 strong lineups for that strategy
 *  - "Generate More" keeps producing fresh, varied lineups (10–20+)
 *  - Lineups can be saved to dashboard or downloaded as DK CSV
 *  - Per-lineup reasoning explains WHY each one was chosen
 *  - Full projection breakdown available in a collapsible section
 */
import React, { useState, useEffect, useCallback, useRef } from "react";
import WelcomeBonusSelector from "./WelcomeBonusSelector";
import api from "../services/api";

// ─── Strategy metadata (mirrors backend STRATEGIES dict) ────────────────
const STRATEGIES = [
  {
    key: "highest_projection",
    label: "Highest Projection",
    icon: "🎯",
    color: "yellow",
    description: "Picks the highest-projected fighter from each matchup.",
    tip: "Best for cash games and safe plays.",
  },
  {
    key: "best_value",
    label: "Best Value",
    icon: "💰",
    color: "green",
    description: "Maximizes projection per salary dollar.",
    tip: "Find underpriced fighters with strong matchups.",
  },
  {
    key: "contrarian",
    label: "Contrarian",
    icon: "🔮",
    color: "purple",
    description: "Low-ownership fighters with viable projections.",
    tip: "High-risk, high-reward for GPP tournaments.",
  },
  {
    key: "finish_upside",
    label: "Finish Upside",
    icon: "💥",
    color: "red",
    description: "Fighters most likely to win by KO/TKO or submission.",
    tip: "Maximum ceiling for large-field tournaments.",
  },
  {
    key: "balanced",
    label: "Balanced",
    icon: "⚖️",
    color: "blue",
    description: "Blends projection strength with salary efficiency.",
    tip: "Good all-around lineup for any contest type.",
  },
  {
    key: "wrestling_advantage",
    label: "Wrestling Edge",
    icon: "🤼",
    color: "cyan",
    description:
      "Targets fighters with dominant grappling and control time advantage.",
    tip: "Great when heavy wrestlers face weak TD defenders.",
  },
  {
    key: "striking_advantage",
    label: "Striking Edge",
    icon: "👊",
    color: "orange",
    description:
      "High-volume strikers with knockdown power and defensive efficiency.",
    tip: "Stack power strikers in favourable matchups.",
  },
];

const colorMap = {
  yellow: {
    border: "border-yellow-600/50",
    bg: "bg-yellow-900/15",
    text: "text-yellow-400",
    ring: "ring-yellow-500",
    badge: "bg-yellow-600/20 text-yellow-400",
    btn: "border-yellow-600/40 text-yellow-400 hover:bg-yellow-900/30",
  },
  green: {
    border: "border-green-600/50",
    bg: "bg-green-900/15",
    text: "text-green-400",
    ring: "ring-green-500",
    badge: "bg-green-600/20 text-green-400",
    btn: "border-green-600/40 text-green-400 hover:bg-green-900/30",
  },
  purple: {
    border: "border-purple-600/50",
    bg: "bg-purple-900/15",
    text: "text-purple-400",
    ring: "ring-purple-500",
    badge: "bg-purple-600/20 text-purple-400",
    btn: "border-purple-600/40 text-purple-400 hover:bg-purple-900/30",
  },
  red: {
    border: "border-red-600/50",
    bg: "bg-red-900/15",
    text: "text-red-400",
    ring: "ring-red-500",
    badge: "bg-red-600/20 text-red-400",
    btn: "border-red-600/40 text-red-400 hover:bg-red-900/30",
  },
  blue: {
    border: "border-blue-600/50",
    bg: "bg-blue-900/15",
    text: "text-blue-400",
    ring: "ring-blue-500",
    badge: "bg-blue-600/20 text-blue-400",
    btn: "border-blue-600/40 text-blue-400 hover:bg-blue-900/30",
  },
  cyan: {
    border: "border-cyan-600/50",
    bg: "bg-cyan-900/15",
    text: "text-cyan-400",
    ring: "ring-cyan-500",
    badge: "bg-cyan-600/20 text-cyan-400",
    btn: "border-cyan-600/40 text-cyan-400 hover:bg-cyan-900/30",
  },
  orange: {
    border: "border-orange-600/50",
    bg: "bg-orange-900/15",
    text: "text-orange-400",
    ring: "ring-orange-500",
    badge: "bg-orange-600/20 text-orange-400",
    btn: "border-orange-600/40 text-orange-400 hover:bg-orange-900/30",
  },
};

// ─── Per-strategy visual overrides (extend this map to theme other strategies) ──
const STRATEGY_STYLES = {
  wrestling_advantage: {
    opponentText: "text-stone-300",
    reasoningText: "text-stone-100",
    reasoningBullet: "text-cyan-400",
    rowHover: "hover:bg-cyan-900/10",
    cardBorder: "border-cyan-800/40",
    cardBg: "bg-stone-950/60",
  },
};
const DEFAULT_STRATEGY_STYLE = {
  opponentText: "text-stone-600",
  reasoningText: "text-stone-200",
  reasoningBullet: "text-stone-400",
  rowHover: "hover:bg-stone-800/20",
  cardBorder: "border-stone-800",
  cardBg: "bg-stone-950/50",
};

// ─── Pre-UFC Background collapsible sub-component ───────────────────────
const PreUFCBackground = ({ notes, ufcFightCount }) => {
  const [isOpen, setIsOpen] = useState(false);

  if (!notes || notes.length === 0 || ufcFightCount >= 3) return null;

  return (
    <div className="mt-2">
      <button
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "6px",
          padding: "3px 10px",
          borderRadius: "9999px",
          backgroundColor: "#06b6d4",
          color: "#0f172a",
          fontSize: "10px",
          fontWeight: 800,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          border: "1px solid rgba(34,211,238,0.5)",
          cursor: "pointer",
          transition: "background-color 0.15s",
        }}
        onMouseEnter={(e) =>
          (e.currentTarget.style.backgroundColor = "#22d3ee")
        }
        onMouseLeave={(e) =>
          (e.currentTarget.style.backgroundColor = "#06b6d4")
        }
      >
        PRE-UFC BACKGROUND
        <span
          style={{
            display: "inline-block",
            transition: "transform 0.2s",
            transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
          }}
        >
          ▼
        </span>
      </button>

      {isOpen && (
        <div
          style={{
            marginTop: "6px",
            paddingLeft: "8px",
            borderLeft: "2px solid rgba(6,182,212,0.5)",
          }}
        >
          {notes.map((note, index) => (
            <div
              key={index}
              style={{
                color: "#cbd5e1",
                fontSize: "11px",
                marginBottom: "3px",
              }}
            >
              • {note}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ─── Component ──────────────────────────────────────────────────────────
const SmartAIPicks = ({ currentUser }) => {
  const [activeStrategy, setActiveStrategy] = useState(null);
  const [lineups, setLineups] = useState([]);
  const [projections, setProjections] = useState([]);
  const [loading, setLoading] = useState(false);
  const [initialLoad, setInitialLoad] = useState(true);
  const [error, setError] = useState(null);
  const [expandedLineup, setExpandedLineup] = useState(null);
  const [showProjections, setShowProjections] = useState(false);
  const [expandedProj, setExpandedProj] = useState(null);
  const [saveStatus, setSaveStatus] = useState(null);
  const [generating, setGenerating] = useState(false);
  const lineupSectionRef = useRef(null);

  // Load projections on mount
  useEffect(() => {
    const fetchProjections = async () => {
      try {
        const data = await api.get("/api/projections");
        setProjections(data.projections || []);
      } catch (err) {
        console.error("Failed to load projections:", err);
      } finally {
        setInitialLoad(false);
      }
    };
    fetchProjections();
  }, []);

  // Collect fingerprints of existing lineups to exclude on regenerate
  const getExcludeParam = useCallback(() => {
    if (lineups.length === 0) return "";
    return lineups
      .map((l) => l.fingerprint)
      .filter(Boolean)
      .join("|");
  }, [lineups]);

  // Fetch lineups for a strategy
  const fetchLineups = useCallback(
    async (strategyKey, count = 3, append = false) => {
      setGenerating(true);
      setError(null);

      const exclude = append ? getExcludeParam() : "";
      const params = new URLSearchParams({
        strategy: strategyKey,
        num_lineups: String(count),
      });
      if (exclude) params.set("exclude", exclude);

      try {
        const data = await api.get(`/api/smart-lineups?${params.toString()}`);
        const newLineups = data.lineups || [];

        if (newLineups.length === 0 && append) {
          setError(
            "No more unique lineups available for this strategy. Try a different strategy or clear and start over.",
          );
        } else if (append) {
          setLineups((prev) => [...prev, ...newLineups]);
        } else {
          setLineups(newLineups);
          setExpandedLineup(0);
        }
      } catch (err) {
        setError(`Failed to generate lineups: ${err.message}`);
      } finally {
        setGenerating(false);
        setLoading(false);
      }
    },
    [getExcludeParam],
  );

  // Select a strategy
  const selectStrategy = useCallback(
    (strategyKey) => {
      if (activeStrategy === strategyKey && lineups.length > 0) {
        lineupSectionRef.current?.scrollIntoView({ behavior: "smooth" });
        return;
      }
      setActiveStrategy(strategyKey);
      setLineups([]);
      setExpandedLineup(null);
      setError(null);
      setLoading(true);
      fetchLineups(strategyKey, 3, false);
    },
    [activeStrategy, lineups.length, fetchLineups],
  );

  // Generate more lineups
  const generateMore = useCallback(() => {
    if (!activeStrategy) return;
    fetchLineups(activeStrategy, 3, true);
  }, [activeStrategy, fetchLineups]);

  // Clear and restart current strategy
  const clearLineups = useCallback(() => {
    setLineups([]);
    setExpandedLineup(null);
    setError(null);
    if (activeStrategy) {
      setLoading(true);
      fetchLineups(activeStrategy, 3, false);
    }
  }, [activeStrategy, fetchLineups]);

  // Download all lineups as DK CSV
  const downloadCSV = useCallback(() => {
    if (lineups.length === 0) return;
    const allFighters = projections.length > 0 ? projections : [];
    const csvRows = ["F,F,F,F,F,F,,Instructions"];
    const instructions = [
      "1. Locate the player you want to select in the list below",
      "2. Copy the ID of your player",
      "3. Paste the ID into the roster position desired",
      "4. You must include an ID for each player",
      "5. Generated by Combat Vault AI Recommendations",
    ];
    const rightSide = [
      ...instructions,
      "",
      "Position,Name + ID,Name,ID,Roster Position,Salary,Game Info,TeamAbbrev,AvgPointsPerGame",
      ...allFighters.map(
        (f) =>
          `F,${f.name} (${f.id}),${f.name},${f.id},F,${f.salary},,,${f.proj_fppg}`,
      ),
    ];
    const lineupRows = lineups.map((l) =>
      l.fighters.map((f) => f.id).join(","),
    );
    const totalRows = Math.max(lineupRows.length, rightSide.length);
    for (let i = 0; i < totalRows; i++) {
      const left = lineupRows[i] || ",,,,,";
      const right = rightSide[i] !== undefined ? rightSide[i] : "";
      csvRows.push(`${left},,${right}`);
    }
    const blob = new Blob([csvRows.join("\r\n")], {
      type: "application/octet-stream",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `dk-ufc-ai-${activeStrategy || "picks"}-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [lineups, projections, activeStrategy]);

  // Save lineup to backend
  const saveLineup = async (lineup, index) => {
    const token = localStorage.getItem("authToken");
    if (!token) {
      setError("Log in to save lineups.");
      return;
    }
    setSaveStatus(`saving-${index}`);
    try {
      await api.post("/api/lineups", {
        name: `AI: ${lineup.strategy} #${index + 1} – ${new Date().toLocaleDateString()}`,
        lineup_data: [lineup.fighters],
        total_salary: lineup.total_salary,
        projected_fpts: lineup.projected_fpts,
        salary_mode: "ai_pick",
      }, token);
      setSaveStatus(`saved-${index}`);
      setTimeout(() => setSaveStatus(null), 3000);
    } catch (err) {
      setSaveStatus(null);
      setError(`Save failed: ${err.message}`);
    }
  };

  const activeStrategyMeta = STRATEGIES.find((s) => s.key === activeStrategy);
  const colors = activeStrategyMeta
    ? colorMap[activeStrategyMeta.color]
    : colorMap.yellow;
  const stratStyle = STRATEGY_STYLES[activeStrategy] ?? DEFAULT_STRATEGY_STYLE;

  // ─── Initial loading state ────────────────────────────────────────────
  if (initialLoad)
    return (
      <div
        className="min-h-screen bg-stone-950 flex items-center justify-center"
        style={{ fontFamily: "'Courier New', monospace" }}
      >
        <div className="text-center">
          <p className="text-yellow-500 tracking-widest animate-pulse uppercase text-sm mb-2">
            Loading projection engine…
          </p>
          <p className="text-stone-600 text-xs">
            Analyzing fighter matchups and building projections
          </p>
        </div>
      </div>
    );

  // ─── Main render ──────────────────────────────────────────────────────
  return (
    <div
      className="min-h-screen bg-stone-950"
      style={{ fontFamily: "'Courier New', monospace" }}
    >
      {/* Header bar */}
      <div className="flex items-center justify-between border-b border-yellow-700/40 bg-yellow-900/10 px-4 sm:px-6 py-2">
        <span className="text-yellow-500 text-xs font-bold tracking-widest uppercase">
          ⚡ AI EXPERT
        </span>
        <span className="text-yellow-500/50 text-xs tracking-wider hidden sm:block">
          MATCHUP-AWARE PROJECTIONS
        </span>
        <span className="text-yellow-500 text-xs font-bold tracking-widest uppercase">
          RECOMMENDATIONS ⚡
        </span>
      </div>

      <div className="max-w-6xl mx-auto px-3 sm:px-4 py-4 md:py-8">
        {/* Page title */}
        <div className="text-center mb-6 md:mb-8">
          <p className="text-xs text-stone-500 tracking-[0.4em] uppercase mb-1.5">
            ◆ COMBAT VAULT ◆
          </p>
          <h1
            className="text-2xl sm:text-3xl md:text-4xl font-black text-stone-100 tracking-wider uppercase"
            style={{
              fontFamily: "'Impact', sans-serif",
              textShadow: "2px 2px 0 #4a5240, 0 0 40px rgba(100,120,80,0.3)",
            }}
          >
            AI <span className="text-yellow-600">RECOMMENDATIONS</span>
          </h1>
          <p className="text-stone-500 text-xs sm:text-sm mt-2 max-w-lg mx-auto leading-relaxed">
            Choose a strategy below. The AI builds lineups using matchup
            analysis, striking output, grappling upside, finish rates, and form.
            Generate as many as you need.
          </p>
          <div className="w-24 h-px bg-gradient-to-r from-transparent via-yellow-700 to-transparent mx-auto mt-3" />
        </div>

        {/* ─── Strategy selector ─────────────────────────────────────── */}
        <div className="mb-6 md:mb-8">
          <p className="text-xs text-stone-500 tracking-[0.3em] uppercase text-center mb-3">
            Choose Your Strategy
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 sm:gap-3">
            {STRATEGIES.map((strat) => {
              const sc = colorMap[strat.color];
              const isActive = activeStrategy === strat.key;
              return (
                <button
                  key={strat.key}
                  onClick={() => selectStrategy(strat.key)}
                  className={`relative rounded-lg border p-3 sm:p-4 text-left transition-all duration-200 ${
                    isActive
                      ? `${sc.border} ${sc.bg} ring-1 ${sc.ring}`
                      : "border-stone-700/50 bg-stone-900/50 hover:bg-stone-800/60 hover:border-stone-600"
                  }`}
                >
                  <div className="text-xl sm:text-2xl mb-1">{strat.icon}</div>
                  <h3
                    className={`text-xs sm:text-sm font-bold tracking-wide uppercase ${
                      isActive ? sc.text : "text-stone-300"
                    }`}
                  >
                    {strat.label}
                  </h3>
                  <p className="text-stone-500 text-[10px] sm:text-xs mt-1 leading-tight hidden sm:block">
                    {strat.tip}
                  </p>
                  {isActive && lineups.length > 0 && (
                    <span
                      className={`absolute top-2 right-2 text-[10px] font-bold px-1.5 py-0.5 rounded ${sc.badge}`}
                    >
                      {lineups.length}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* ─── Active strategy description + controls ────────────────── */}
        {activeStrategyMeta && (
          <div
            ref={lineupSectionRef}
            className={`rounded-lg border ${colors.border} ${colors.bg} p-4 mb-6`}
          >
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="text-3xl">{activeStrategyMeta.icon}</span>
                <div>
                  <h2
                    className={`text-sm sm:text-base font-bold tracking-wider uppercase ${colors.text}`}
                  >
                    {activeStrategyMeta.label}
                  </h2>
                  <p className="text-stone-400 text-xs mt-0.5">
                    {activeStrategyMeta.description}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={generateMore}
                  disabled={generating || loading}
                  className={`border px-4 py-1.5 rounded text-xs font-bold tracking-wider uppercase transition disabled:opacity-40 ${colors.btn}`}
                >
                  {generating ? "Generating…" : "+ Generate More"}
                </button>
                <button
                  onClick={clearLineups}
                  disabled={generating || loading}
                  className="border border-stone-600/40 text-stone-400 px-4 py-1.5 rounded text-xs font-bold tracking-wider uppercase hover:bg-stone-800/40 transition disabled:opacity-40"
                >
                  ↻ Start Over
                </button>
                <button
                  onClick={downloadCSV}
                  disabled={lineups.length === 0}
                  className="border border-green-600/40 text-green-400 px-4 py-1.5 rounded text-xs font-bold tracking-wider uppercase hover:bg-green-900/30 transition disabled:opacity-40"
                >
                  ↓ CSV
                </button>
              </div>
            </div>
            {lineups.length > 0 && (
              <p className="text-stone-500 text-xs mt-2">
                {lineups.length} lineup{lineups.length !== 1 ? "s" : ""}{" "}
                generated — click "Generate More" for additional unique lineups
              </p>
            )}
          </div>
        )}

        {/* ─── Error message ─────────────────────────────────────────── */}
        {error && (
          <div className="bg-red-900/20 border border-red-700/40 rounded-lg px-4 py-3 mb-6">
            <p className="text-red-400 text-xs">{error}</p>
          </div>
        )}

        {/* ─── Loading indicator ─────────────────────────────────────── */}
        {loading && !generating && (
          <div className="text-center py-12">
            <p className="text-yellow-500 tracking-widest animate-pulse uppercase text-sm mb-1">
              Building lineups…
            </p>
            <p className="text-stone-600 text-xs">
              Running {activeStrategyMeta?.label || "strategy"} analysis
            </p>
          </div>
        )}

        {/* ─── No strategy selected prompt ───────────────────────────── */}
        {!activeStrategy && !loading && (
          <div className="text-center py-16 border border-dashed border-stone-700/50 rounded-lg">
            <p className="text-stone-500 text-sm mb-1">
              Select a strategy above to generate AI-recommended lineups
            </p>
            <p className="text-stone-600 text-xs">
              Each strategy uses different criteria to find optimal fighter
              combinations
            </p>
          </div>
        )}

        {/* ─── Generated lineups ─────────────────────────────────────── */}
        {lineups.length > 0 && (
          <div className="space-y-3 mb-8">
            {lineups.map((lineup, idx) => {
              const isExpanded = expandedLineup === idx;
              return (
                <div
                  key={lineup.fingerprint || idx}
                  className={`bg-stone-900 border rounded-lg overflow-hidden transition-all ${colors.border}`}
                >
                  {/* Lineup header */}
                  <button
                    onClick={() => setExpandedLineup(isExpanded ? null : idx)}
                    className="w-full flex items-center justify-between px-4 py-3 hover:bg-stone-800/40 transition text-left"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span
                        className={`text-xs font-bold px-2 py-0.5 rounded ${colors.badge} shrink-0`}
                      >
                        #{idx + 1}
                      </span>
                      <p className="text-stone-400 text-xs truncate">
                        {lineup.reasoning}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 sm:gap-4 text-right shrink-0 ml-3">
                      <div className="hidden sm:block">
                        <span className="text-stone-400 text-xs">
                          ${lineup.total_salary.toLocaleString()}
                        </span>
                      </div>
                      <div>
                        <span className={`font-bold text-base ${colors.text}`}>
                          {lineup.projected_fpts}
                        </span>
                        <span className="text-stone-500 text-xs ml-0.5">
                          pts
                        </span>
                      </div>
                      <span className="text-stone-600 text-sm">
                        {isExpanded ? "▲" : "▼"}
                      </span>
                    </div>
                  </button>

                  {/* Expanded details */}
                  {isExpanded && (
                    <div className="border-t border-stone-800 px-4 py-3">
                      {/* Summary bar */}
                      <div className="flex flex-wrap gap-3 mb-3 text-xs text-stone-500">
                        <span>
                          Salary:{" "}
                          <span className="text-stone-300">
                            ${lineup.total_salary.toLocaleString()} / $50,000
                          </span>
                        </span>
                        <span>
                          Remaining:{" "}
                          <span className="text-stone-300">
                            ${(50000 - lineup.total_salary).toLocaleString()}
                          </span>
                        </span>
                        <span>
                          Avg Salary:{" "}
                          <span className="text-stone-300">
                            $
                            {Math.round(
                              lineup.total_salary / lineup.fighters.length,
                            ).toLocaleString()}
                          </span>
                        </span>
                      </div>

                      {/* Desktop table */}
                      <div className="hidden md:block">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="text-stone-400 text-xs uppercase tracking-wider border-b border-stone-800">
                              <th className="text-left py-2 px-2">Fighter</th>
                              <th className="text-left py-2 px-2 text-stone-500">
                                vs
                              </th>
                              <th className="text-right py-2 px-2">Salary</th>
                              <th className="text-right py-2 px-2">Proj</th>
                              {activeStrategy !== "wrestling_advantage" && (
                                <>
                                  <th className="text-right py-2 px-2">
                                    Floor / Ceil
                                  </th>
                                  <th className="text-right py-2 px-2">Win%</th>
                                  <th className="text-right py-2 px-2">Own</th>
                                </>
                              )}
                              <th className="text-left py-2 pl-4 pr-2 min-w-[300px]">
                                Why
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {lineup.fighters.map((f) => (
                              <tr
                                key={f.id}
                                className={`border-b border-stone-800/40 ${stratStyle.rowHover}`}
                              >
                                <td className="py-2 px-2 text-stone-200 font-medium">
                                  {f.name}
                                </td>
                                <td
                                  className={`py-2 px-2 text-xs ${stratStyle.opponentText}`}
                                >
                                  {f.opponent}
                                </td>
                                <td className="py-2 px-2 text-right text-yellow-500/80 text-xs">
                                  ${f.salary.toLocaleString()}
                                </td>
                                <td
                                  className={`py-2 px-2 text-right font-bold ${colors.text}`}
                                >
                                  {f.proj_fppg.toFixed(1)}
                                </td>
                                {activeStrategy !== "wrestling_advantage" && (
                                  <>
                                    <td className="py-2 px-2 text-right text-stone-500 text-xs">
                                      {f.proj_low?.toFixed(0) ?? "—"} /{" "}
                                      {f.proj_high?.toFixed(0) ?? "—"}
                                    </td>
                                    <td className="py-2 px-2 text-right text-stone-300 text-xs">
                                      {(f.win_prob * 100).toFixed(0)}%
                                    </td>
                                    <td className="py-2 px-2 text-right text-stone-400 text-xs">
                                      {f.ownership_label || "—"}
                                    </td>
                                  </>
                                )}
                                <td
                                  className={`py-2 text-left pl-4 pr-2 text-xs min-w-[300px] align-top ${stratStyle.reasoningText}`}
                                >
                                  {f.reasoning.split("\n").map((line, i) => (
                                    <div
                                      key={i}
                                      className="flex gap-1 leading-snug"
                                    >
                                      <span
                                        className={`shrink-0 ${stratStyle.reasoningBullet}`}
                                      >
                                        •
                                      </span>
                                      <span>{line}</span>
                                    </div>
                                  ))}
                                  <PreUFCBackground
                                    notes={f.pre_ufc_notes}
                                    ufcFightCount={f.ufc_fight_count ?? 99}
                                  />
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {/* Mobile cards */}
                      <div className="md:hidden space-y-2">
                        {lineup.fighters.map((f) => (
                          <div
                            key={f.id}
                            className={`rounded p-2.5 border ${stratStyle.cardBorder} ${stratStyle.cardBg}`}
                          >
                            <div className="flex justify-between items-start mb-1">
                              <div>
                                <span className="text-stone-200 font-medium text-sm">
                                  {f.name}
                                </span>
                                <span
                                  className={`text-xs ml-1.5 ${stratStyle.opponentText}`}
                                >
                                  vs {f.opponent}
                                </span>
                              </div>
                              <span
                                className={`font-bold text-sm ${colors.text}`}
                              >
                                {f.proj_fppg.toFixed(1)}
                              </span>
                            </div>
                            <div className="flex gap-2.5 text-[10px] text-stone-500 mb-1.5 flex-wrap">
                              <span>${f.salary.toLocaleString()}</span>
                              {activeStrategy !== "wrestling_advantage" && (
                                <>
                                  <span>
                                    Win: {(f.win_prob * 100).toFixed(0)}%
                                  </span>
                                  <span>
                                    Floor {f.proj_low?.toFixed(0) ?? "—"} / Ceil{" "}
                                    {f.proj_high?.toFixed(0) ?? "—"}
                                  </span>
                                  {f.ownership_label && (
                                    <span>Own: {f.ownership_label}</span>
                                  )}
                                </>
                              )}
                            </div>
                            <div
                              className={`text-xs space-y-0.5 mt-1 ${stratStyle.reasoningText}`}
                            >
                              {f.reasoning.split("\n").map((line, i) => (
                                <div key={i} className="flex gap-1">
                                  <span
                                    className={`shrink-0 ${stratStyle.reasoningBullet}`}
                                  >
                                    •
                                  </span>
                                  <span>{line}</span>
                                </div>
                              ))}
                            </div>
                            <PreUFCBackground
                              notes={f.pre_ufc_notes}
                              ufcFightCount={f.ufc_fight_count ?? 99}
                            />
                          </div>
                        ))}
                      </div>

                      {/* Save button */}
                      <div className="mt-3 flex justify-end">
                        <button
                          onClick={() => saveLineup(lineup, idx)}
                          disabled={saveStatus === `saving-${idx}`}
                          className={`border px-4 py-1.5 rounded text-xs font-bold tracking-wider uppercase transition disabled:opacity-40 ${colors.btn}`}
                        >
                          {saveStatus === `saving-${idx}`
                            ? "Saving…"
                            : saveStatus === `saved-${idx}`
                              ? "✓ Saved"
                              : "Save to Dashboard"}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            {/* Generate more button below lineups */}
            <div className="text-center pt-2">
              <button
                onClick={generateMore}
                disabled={generating}
                className={`border px-6 py-2 rounded-lg text-sm font-bold tracking-wider uppercase transition disabled:opacity-40 ${colors.btn}`}
              >
                {generating
                  ? "Generating…"
                  : `+ Generate 3 More ${activeStrategyMeta?.label || ""} Lineups`}
              </button>
            </div>
          </div>
        )}

        {/* ─── Full Projection Breakdown (collapsible) ───────────────── */}
        {projections.length > 0 && (
          <div className="mt-8 mb-4">
            <button
              onClick={() => setShowProjections(!showProjections)}
              className="w-full flex items-center justify-between bg-stone-900 border border-stone-700/40 rounded-lg px-4 py-3 hover:bg-stone-800/50 transition"
            >
              <div className="flex items-center gap-2">
                <span className="text-lg">📊</span>
                <span className="text-xs font-bold tracking-[0.3em] uppercase text-yellow-600">
                  Full Projection Breakdown
                </span>
                <span className="text-stone-600 text-xs hidden sm:inline">
                  — {projections.length} fighters
                </span>
              </div>
              <span className="text-stone-500">
                {showProjections ? "▲" : "▼"}
              </span>
            </button>

            {showProjections && (
              <div className="bg-stone-900 border border-stone-700/40 border-t-0 rounded-b-lg p-4">
                <p className="text-stone-500 text-xs mb-3">
                  Matchup-adjusted projections for every fighter. Click a row
                  for detailed reasoning.
                </p>

                {/* Desktop table */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-stone-500 text-xs uppercase tracking-wider border-b border-stone-800">
                        <th className="text-left py-1.5">Fighter</th>
                        <th className="text-left py-1.5">vs</th>
                        <th className="text-right py-1.5">Salary</th>
                        <th className="text-right py-1.5">DK Avg</th>
                        <th className="text-right py-1.5">Proj</th>
                        <th className="text-right py-1.5">Floor</th>
                        <th className="text-right py-1.5">Ceil</th>
                        <th className="text-right py-1.5">Win%</th>
                        <th className="text-right py-1.5">Fin%</th>
                        <th className="text-center py-1.5">Own</th>
                      </tr>
                    </thead>
                    <tbody>
                      {projections.map((p, idx) => (
                        <React.Fragment key={p.id}>
                          <tr
                            onClick={() =>
                              setExpandedProj(expandedProj === idx ? null : idx)
                            }
                            className="border-b border-stone-800/40 hover:bg-stone-800/30 cursor-pointer transition"
                          >
                            <td className="py-1.5 text-stone-200 font-medium">
                              {p.name}
                            </td>
                            <td className="py-1.5 text-stone-500 text-xs">
                              {p.opponent}
                            </td>
                            <td className="py-1.5 text-right text-yellow-500/80 text-xs">
                              ${p.salary.toLocaleString()}
                            </td>
                            <td className="py-1.5 text-right text-stone-400 text-xs">
                              {p.dk_avg_fppg > 0
                                ? p.dk_avg_fppg.toFixed(1)
                                : "—"}
                            </td>
                            <td className="py-1.5 text-right text-yellow-400 font-bold">
                              {p.proj_fppg.toFixed(1)}
                            </td>
                            <td className="py-1.5 text-right text-stone-500 text-xs">
                              {p.proj_low.toFixed(0)}
                            </td>
                            <td className="py-1.5 text-right text-stone-500 text-xs">
                              {p.proj_high.toFixed(0)}
                            </td>
                            <td className="py-1.5 text-right text-stone-300 text-xs">
                              {(p.win_prob * 100).toFixed(0)}%
                            </td>
                            <td className="py-1.5 text-right text-stone-300 text-xs">
                              {(p.finish_prob * 100).toFixed(0)}%
                            </td>
                            <td className="py-1.5 text-center text-stone-400 text-xs">
                              {p.ownership_label}
                            </td>
                          </tr>
                          {expandedProj === idx && (
                            <tr>
                              <td
                                colSpan={10}
                                className="bg-stone-950/50 px-4 py-2.5"
                              >
                                <div className="text-stone-400 text-xs space-y-1 mb-2">
                                  {p.reasoning.split("\n").map((line, i) => (
                                    <div key={i} className="flex gap-1.5">
                                      <span className="text-stone-600 shrink-0">
                                        •
                                      </span>
                                      <span>{line}</span>
                                    </div>
                                  ))}
                                </div>
                                <PreUFCBackground
                                  notes={p.pre_ufc_notes}
                                  ufcFightCount={p.ufc_fight_count ?? 99}
                                />
                                <div className="flex flex-wrap gap-3 text-xs text-stone-500">
                                  <span>
                                    Striking:{" "}
                                    <span className="text-yellow-500">
                                      {p.proj_components.striking} pts
                                    </span>
                                  </span>
                                  <span>
                                    Grappling:{" "}
                                    <span className="text-yellow-500">
                                      {p.proj_components.grappling} pts
                                    </span>
                                  </span>
                                  <span>
                                    KD:{" "}
                                    <span className="text-yellow-500">
                                      {p.proj_components.knockdowns} pts
                                    </span>
                                  </span>
                                  <span>
                                    Win bonus:{" "}
                                    <span className="text-yellow-500">
                                      {p.proj_components.win_bonus} pts
                                    </span>
                                  </span>
                                  <span>
                                    Form:{" "}
                                    <span
                                      className={
                                        p.proj_components.form_adj >= 0
                                          ? "text-green-500"
                                          : "text-red-400"
                                      }
                                    >
                                      {p.proj_components.form_adj > 0
                                        ? "+"
                                        : ""}
                                      {p.proj_components.form_adj}
                                    </span>
                                  </span>
                                  <span>
                                    Est rounds:{" "}
                                    <span className="text-stone-300">
                                      {p.est_rounds}
                                    </span>
                                  </span>
                                  <span>
                                    Confidence:{" "}
                                    <span
                                      className={
                                        p.confidence === "high"
                                          ? "text-green-400"
                                          : "text-yellow-500"
                                      }
                                    >
                                      {p.confidence}
                                    </span>
                                  </span>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile cards */}
                <div className="md:hidden space-y-2">
                  {projections.map((p, idx) => (
                    <div key={p.id}>
                      <button
                        onClick={() =>
                          setExpandedProj(expandedProj === idx ? null : idx)
                        }
                        className="w-full text-left bg-stone-950/40 border border-stone-700 rounded p-2.5 hover:bg-stone-800/30 transition"
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <span className="text-stone-200 text-sm font-medium">
                              {p.name}
                            </span>
                            <span className="text-stone-600 text-xs ml-1.5">
                              vs {p.opponent}
                            </span>
                          </div>
                          <span className="text-yellow-400 font-bold text-sm">
                            {p.proj_fppg.toFixed(1)}
                          </span>
                        </div>
                        <div className="flex gap-2.5 text-[10px] text-stone-500 mt-1">
                          <span>${p.salary.toLocaleString()}</span>
                          <span>Win: {(p.win_prob * 100).toFixed(0)}%</span>
                          <span>Own: {p.ownership_label}</span>
                        </div>
                      </button>
                      {expandedProj === idx && (
                        <div className="bg-stone-950/50 border border-stone-700 border-t-0 rounded-b p-2.5 -mt-1">
                          <div className="text-stone-400 text-xs space-y-1 mb-1.5">
                            {p.reasoning.split("\n").map((line, i) => (
                              <div key={i} className="flex gap-1.5">
                                <span className="text-stone-600 shrink-0">
                                  •
                                </span>
                                <span>{line}</span>
                              </div>
                            ))}
                          </div>
                          <PreUFCBackground
                            notes={p.pre_ufc_notes}
                            ufcFightCount={p.ufc_fight_count ?? 99}
                          />
                          <div className="grid grid-cols-2 gap-1 text-[10px] text-stone-500">
                            <span>
                              Striking:{" "}
                              <span className="text-yellow-500">
                                {p.proj_components.striking}
                              </span>
                            </span>
                            <span>
                              Grappling:{" "}
                              <span className="text-yellow-500">
                                {p.proj_components.grappling}
                              </span>
                            </span>
                            <span>
                              KD:{" "}
                              <span className="text-yellow-500">
                                {p.proj_components.knockdowns}
                              </span>
                            </span>
                            <span>
                              Win bonus:{" "}
                              <span className="text-yellow-500">
                                {p.proj_components.win_bonus}
                              </span>
                            </span>
                            <span>Floor: {p.proj_low.toFixed(0)}</span>
                            <span>Ceiling: {p.proj_high.toFixed(0)}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Welcome bonus offers */}
        <div className="max-w-6xl mx-auto px-3 sm:px-4">
          <WelcomeBonusSelector />
        </div>
      </div>
    </div>
  );
};

export default SmartAIPicks;
