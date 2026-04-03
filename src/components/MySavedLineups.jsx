import React, { useState, useEffect, useCallback } from "react";

const SALARY_MODE_LABELS = {
  diverse: "DIVERSE",
  medium: "MEDIUM",
  higher: "AGGRESSIVE",
};

const SALARY_MODE_COLORS = {
  diverse: "text-yellow-400 border-yellow-700/60",
  medium: "text-orange-400 border-orange-700/60",
  higher: "text-red-400 border-red-700/60",
};

const MySavedLineups = () => {
  const [lineups, setLineups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [expandedId, setExpandedId] = useState(null);

  const token = localStorage.getItem("authToken");

  const fetchLineups = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("http://localhost:8000/api/lineups", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401) {
        setError("You must be logged in to view saved lineups.");
        return;
      }
      if (!res.ok) throw new Error(`Server error ${res.status}`);
      const data = await res.json();
      setLineups(data);
    } catch (err) {
      setError(`Failed to load lineups: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (!token) {
      setError("You must be logged in to view saved lineups.");
      setLoading(false);
      return;
    }
    fetchLineups();
  }, [token, fetchLineups]);

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this saved lineup set?")) return;
    setDeletingId(id);
    try {
      const res = await fetch(`http://localhost:8000/api/lineups/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`Error ${res.status}`);
      setLineups((prev) => prev.filter((l) => l.id !== id));
    } catch (err) {
      setError(`Failed to delete lineup: ${err.message}`);
    } finally {
      setDeletingId(null);
    }
  };

  const formatDate = (iso) => {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  return (
    <div
      className="min-h-screen bg-stone-950"
      style={{ fontFamily: "'Courier New', monospace" }}
    >
      {/* Classification banner */}
      <div className="flex items-center justify-between border-b border-yellow-700/40 bg-yellow-900/10 px-6 py-2">
        <span className="text-yellow-500 text-xs font-bold tracking-widest uppercase">
          ⚡ CLASSIFIED OPS
        </span>
        <span className="text-yellow-500/50 text-xs tracking-wider hidden sm:block">
          CLEARANCE: LEVEL 5
        </span>
        <span className="text-yellow-500 text-xs font-bold tracking-widest uppercase">
          DFS COMMAND ⚡
        </span>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8 md:py-10">
        {/* Page header */}
        <div className="text-center mb-8">
          <p className="text-xs text-stone-500 tracking-[0.5em] uppercase mb-2">
            ◆ OPERATION COMBAT VAULT — DFS DIVISION ◆
          </p>
          <h1
            className="text-3xl md:text-5xl font-black text-stone-100 tracking-wider uppercase"
            style={{
              fontFamily: "'Impact', sans-serif",
              textShadow: "2px 2px 0 #4a5240, 0 0 40px rgba(100,120,80,0.3)",
            }}
          >
            MY SAVED <span className="text-yellow-600">LINEUPS</span>
          </h1>
          <div className="w-32 h-px bg-gradient-to-r from-transparent via-yellow-700 to-transparent mx-auto mt-3" />
        </div>

        {/* Error */}
        {error && (
          <div className="text-center text-red-400 mb-6 p-3 border border-red-900/60 rounded bg-red-950/30">
            {error}
          </div>
        )}

        {/* Loading */}
        {loading && (
          <p className="text-stone-500 tracking-widest animate-pulse uppercase text-sm text-center mt-16">
            Loading…
          </p>
        )}

        {/* Empty state */}
        {!loading && !error && lineups.length === 0 && (
          <div className="text-center mt-16 border border-stone-800 rounded-lg p-10 bg-stone-900/40">
            <p className="text-stone-500 text-sm tracking-widest uppercase mb-2">
              ◈ No saved lineups yet
            </p>
            <p className="text-stone-600 text-xs">
              Generate lineups on the Fantasy Teams page and click "Save Lineup"
              to store them here.
            </p>
          </div>
        )}

        {/* Lineup list */}
        {!loading && lineups.length > 0 && (
          <div className="space-y-4">
            <p className="text-stone-500 text-xs tracking-widest uppercase mb-4">
              {lineups.length} SAVED LINEUP{lineups.length !== 1 ? "S" : ""}
            </p>
            {lineups.map((lineup) => {
              const modeKey = lineup.salary_mode || "diverse";
              const modeLabel =
                SALARY_MODE_LABELS[modeKey] ?? modeKey.toUpperCase();
              const modeColor =
                SALARY_MODE_COLORS[modeKey] ??
                "text-stone-400 border-stone-700/60";
              const isExpanded = expandedId === lineup.id;

              return (
                <div
                  key={lineup.id}
                  className="bg-stone-900 border border-yellow-700/30 rounded-lg overflow-hidden"
                >
                  {/* Card header */}
                  <div className="p-5 flex flex-col sm:flex-row sm:items-center gap-4">
                    {/* Left: name + meta */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 flex-wrap">
                        <h2 className="text-stone-100 font-bold tracking-wide truncate text-sm sm:text-base">
                          {lineup.name}
                        </h2>
                        <span
                          className={`text-[10px] font-bold tracking-widest border rounded px-1.5 py-0.5 ${modeColor}`}
                        >
                          {modeLabel}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-x-5 gap-y-1 mt-2 text-xs text-stone-400 tracking-wider">
                        <span>
                          AVG SALARY{" "}
                          <span className="text-stone-200">
                            ${lineup.total_salary.toLocaleString()}
                          </span>
                        </span>
                        <span>
                          PROJ FPTS{" "}
                          <span className="text-yellow-400">
                            {lineup.projected_fpts}
                          </span>
                        </span>
                        <span>
                          SAVED{" "}
                          <span className="text-stone-300">
                            {formatDate(lineup.created_at)}
                          </span>
                        </span>
                        {Array.isArray(lineup.lineup_data) && (
                          <span>
                            {lineup.lineup_data.length} LINEUP
                            {lineup.lineup_data.length !== 1 ? "S" : ""}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Right: actions */}
                    <div className="flex items-center gap-2 shrink-0">
                      {Array.isArray(lineup.lineup_data) &&
                        lineup.lineup_data.length > 0 && (
                          <button
                            onClick={() =>
                              setExpandedId(isExpanded ? null : lineup.id)
                            }
                            className="text-xs text-stone-400 hover:text-yellow-400 border border-stone-700 hover:border-yellow-700/60 rounded px-3 py-1.5 transition tracking-wider uppercase"
                          >
                            {isExpanded ? "Hide" : "View"}
                          </button>
                        )}
                      <button
                        onClick={() => handleDelete(lineup.id)}
                        disabled={deletingId === lineup.id}
                        className="text-xs text-stone-500 hover:text-red-400 border border-stone-700 hover:border-red-900/60 rounded px-3 py-1.5 transition tracking-wider uppercase disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {deletingId === lineup.id ? "…" : "Delete"}
                      </button>
                    </div>
                  </div>

                  {/* Expanded: individual lineups */}
                  {isExpanded && Array.isArray(lineup.lineup_data) && (
                    <div className="border-t border-stone-800 px-5 py-4 space-y-3">
                      {lineup.lineup_data.map((team, idx) => (
                        <div key={idx}>
                          <p className="text-[10px] text-stone-500 tracking-widest uppercase mb-1">
                            Lineup {idx + 1}
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {(Array.isArray(team) ? team : []).map((f) => (
                              <span
                                key={f.id ?? idx}
                                className="text-xs bg-stone-800 border border-stone-700 text-stone-300 rounded px-2 py-1"
                              >
                                {f.name}{" "}
                                <span className="text-stone-500">
                                  ${(f.salary ?? 0).toLocaleString()}
                                </span>
                              </span>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default MySavedLineups;
