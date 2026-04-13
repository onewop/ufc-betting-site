import React, { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";

// ── constants ─────────────────────────────────────────────────────────────────

const MODE_META = {
  diverse: {
    label: "DIVERSE",
    bg: "bg-yellow-900/30",
    text: "text-yellow-400",
    border: "border-yellow-700/50",
  },
  medium: {
    label: "MEDIUM",
    bg: "bg-orange-900/30",
    text: "text-orange-400",
    border: "border-orange-700/50",
  },
  higher: {
    label: "AGGRESSIVE",
    bg: "bg-red-900/30",
    text: "text-red-400",
    border: "border-red-700/50",
  },
};

const modeMeta = (key) =>
  MODE_META[key] ?? {
    label: (key ?? "UNKNOWN").toUpperCase(),
    bg: "bg-stone-800",
    text: "text-stone-400",
    border: "border-stone-700",
  };

const formatDate = (iso) =>
  new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

const formatTime = (iso) =>
  new Date(iso).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });

// ── stat card ─────────────────────────────────────────────────────────────────

const StatCard = ({ label, value, sub, accent = "text-yellow-400" }) => (
  <div className="bg-stone-900 border border-stone-700/60 rounded-xl p-5 flex flex-col gap-1">
    <p className="text-[10px] tracking-[0.2em] uppercase text-stone-500">
      {label}
    </p>
    <p className={`text-3xl font-black ${accent}`}>{value}</p>
    {sub && <p className="text-xs text-stone-500">{sub}</p>}
  </div>
);

// ── badge ─────────────────────────────────────────────────────────────────────

const ModeBadge = ({ mode }) => {
  const m = modeMeta(mode);
  return (
    <span
      className={`inline-flex items-center text-[10px] font-bold tracking-widest border rounded px-2 py-0.5 ${m.bg} ${m.text} ${m.border}`}
    >
      {m.label}
    </span>
  );
};

// ── lineup card ────────────────────────────────────────────────────────────────

const LineupCard = ({ lineup, onDelete, deletingId }) => {
  const [expanded, setExpanded] = useState(false);
  const teams = Array.isArray(lineup.lineup_data) ? lineup.lineup_data : [];

  return (
    <div className="bg-stone-900 border border-stone-700/40 hover:border-yellow-700/40 rounded-xl overflow-hidden transition-colors duration-200">
      {/* Card body */}
      <div className="p-5">
        {/* Name row */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <h3 className="text-stone-100 font-bold tracking-wide text-sm leading-snug flex-1 min-w-0 break-words">
            {lineup.name}
          </h3>
          <ModeBadge mode={lineup.salary_mode} />
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 gap-x-4 gap-y-2 mb-4">
          <div>
            <p className="text-[9px] tracking-widest uppercase text-stone-600 mb-0.5">
              Avg Salary
            </p>
            <p className="text-sm font-semibold text-stone-200">
              ${lineup.total_salary.toLocaleString()}
            </p>
          </div>
          <div>
            <p className="text-[9px] tracking-widest uppercase text-stone-600 mb-0.5">
              Proj FPTS
            </p>
            <p className="text-sm font-semibold text-yellow-400">
              {lineup.projected_fpts}
            </p>
          </div>
          <div>
            <p className="text-[9px] tracking-widest uppercase text-stone-600 mb-0.5">
              Lineups
            </p>
            <p className="text-sm text-stone-300">
              {teams.length} lineup{teams.length !== 1 ? "s" : ""}
            </p>
          </div>
          <div>
            <p className="text-[9px] tracking-widest uppercase text-stone-600 mb-0.5">
              Saved
            </p>
            <p className="text-sm text-stone-400">
              {formatDate(lineup.created_at)}
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          {teams.length > 0 && (
            <button
              onClick={() => setExpanded((v) => !v)}
              className="flex-1 py-1.5 text-xs font-bold tracking-wider uppercase rounded-lg border border-stone-700 hover:border-yellow-700/60 text-stone-400 hover:text-yellow-400 transition"
            >
              {expanded ? "▲ Hide" : "▼ View Fighters"}
            </button>
          )}
          <button
            onClick={() => onDelete(lineup.id)}
            disabled={deletingId === lineup.id}
            className="py-1.5 px-3 text-xs font-bold tracking-wider uppercase rounded-lg border border-stone-700 hover:border-red-800/60 text-stone-500 hover:text-red-400 transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {deletingId === lineup.id ? "…" : "Delete"}
          </button>
        </div>
      </div>

      {/* Expanded fighters */}
      {expanded && (
        <div className="border-t border-stone-800 bg-stone-950/50 px-5 py-4 space-y-4">
          {teams.map((team, idx) => (
            <div key={idx}>
              <p className="text-[9px] tracking-[0.2em] uppercase text-stone-600 mb-2">
                Lineup {idx + 1}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {(Array.isArray(team) ? team : []).map((f, fi) => (
                  <span
                    key={f.id ?? fi}
                    className="inline-flex items-center gap-1.5 text-xs bg-stone-800 border border-stone-700 text-stone-300 rounded-lg px-2.5 py-1"
                  >
                    <span className="font-medium">{f.name}</span>
                    <span className="text-stone-500 text-[10px]">
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
};

// ── main component ─────────────────────────────────────────────────────────────

const UserDashboard = () => {
  const [lineups, setLineups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  const token = localStorage.getItem("authToken");
  const userStr = localStorage.getItem("currentUser");
  const currentUser = (() => {
    try {
      return userStr ? JSON.parse(userStr) : null;
    } catch {
      return null;
    }
  })();

  const fetchLineups = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("http://localhost:8000/api/lineups", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401) {
        setError("You must be logged in to view your dashboard.");
        return;
      }
      if (!res.ok) throw new Error(`Server error ${res.status}`);
      setLineups(await res.json());
    } catch (err) {
      setError(`Failed to load lineups: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (!token) {
      setError("You must be logged in to view your dashboard.");
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

  // ── derived stats ────────────────────────────────────────────────────────────
  const totalLineupSets = lineups.length;
  const totalIndividual = lineups.reduce(
    (s, l) => s + (Array.isArray(l.lineup_data) ? l.lineup_data.length : 0),
    0,
  );
  const bestFpts =
    lineups.length > 0
      ? Math.max(...lineups.map((l) => l.projected_fpts)).toFixed(2)
      : "—";
  const mostRecentDate = lineups.length > 0 ? lineups[0].created_at : null;

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

      <div className="max-w-5xl mx-auto px-4 py-8 md:py-10">
        {/* ── page header ──────────────────────────────────────────────────── */}
        <div className="mb-8">
          <p className="text-[10px] text-stone-500 tracking-[0.4em] uppercase mb-1">
            ◆ OPERATION COMBAT VAULT — DFS DIVISION ◆
          </p>
          <div className="flex items-end justify-between flex-wrap gap-3">
            <h1
              className="text-3xl md:text-4xl font-black text-stone-100 tracking-wider uppercase"
              style={{ fontFamily: "'Impact', sans-serif" }}
            >
              COMMAND <span className="text-yellow-500">DASHBOARD</span>
            </h1>
            {currentUser && (
              <p className="text-stone-500 text-xs tracking-widest uppercase">
                Operator:{" "}
                <span className="text-stone-300">
                  {currentUser.username || currentUser.email}
                </span>
              </p>
            )}
          </div>
          <div className="mt-2 h-px bg-gradient-to-r from-yellow-700/60 via-yellow-700/20 to-transparent" />
        </div>

        {/* ── error ────────────────────────────────────────────────────────── */}
        {error && (
          <div className="mb-6 p-4 border border-red-900/60 rounded-xl bg-red-950/30 text-red-400 text-sm">
            {error}
            {!token && (
              <span className="block mt-1 text-stone-500 text-xs">
                Use the nav bar to log in, then return here.
              </span>
            )}
          </div>
        )}

        {/* ── loading ───────────────────────────────────────────────────────── */}
        {loading && (
          <div className="flex items-center justify-center h-40">
            <p className="text-stone-500 text-sm tracking-widest uppercase animate-pulse">
              Loading…
            </p>
          </div>
        )}

        {!loading && !error && (
          <>
            {/* ── Section 1: Overview ─────────────────────────────────────── */}
            <section className="mb-10">
              <h2 className="text-xs font-bold tracking-[0.3em] uppercase text-stone-500 mb-4">
                ◈ Overview
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <StatCard
                  label="Saved Sets"
                  value={totalLineupSets}
                  sub="lineup groups saved"
                />
                <StatCard
                  label="Total Lineups"
                  value={totalIndividual}
                  sub="individual lineups"
                  accent="text-orange-400"
                />
                <StatCard
                  label="Best Proj FPTS"
                  value={bestFpts}
                  sub="highest projected score"
                  accent="text-green-400"
                />
                <StatCard
                  label="Last Saved"
                  value={mostRecentDate ? formatDate(mostRecentDate) : "—"}
                  sub={
                    mostRecentDate
                      ? formatTime(mostRecentDate)
                      : "no lineups yet"
                  }
                  accent="text-stone-300"
                />
              </div>
            </section>

            {/* ── Section 2: Saved Lineups ────────────────────────────────── */}
            <section>
              <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                <h2 className="text-xs font-bold tracking-[0.3em] uppercase text-stone-500">
                  ◈ My Saved Lineups
                </h2>
                {totalLineupSets > 0 && (
                  <span className="text-[10px] text-stone-600 tracking-widest uppercase">
                    {totalLineupSets} set{totalLineupSets !== 1 ? "s" : ""} ·{" "}
                    {totalIndividual} lineup{totalIndividual !== 1 ? "s" : ""}
                  </span>
                )}
              </div>

              {/* Empty state */}
              {lineups.length === 0 && (
                <div className="flex flex-col items-center justify-center py-20 border border-dashed border-stone-700 rounded-xl bg-stone-900/30 text-center px-6">
                  <p className="text-4xl mb-4 opacity-30">◈</p>
                  <p className="text-stone-400 text-sm font-bold tracking-widest uppercase mb-2">
                    No saved lineups yet
                  </p>
                  <p className="text-stone-600 text-xs max-w-xs">
                    Head to{" "}
                    <Link
                      to="/team-combinations"
                      className="text-yellow-600 hover:underline"
                    >
                      Fantasy Teams
                    </Link>
                    , generate your lineups, and click{" "}
                    <span className="text-stone-400">"Save Lineup"</span> to
                    store them here.
                  </p>
                </div>
              )}

              {/* Grid */}
              {lineups.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {lineups.map((lineup) => (
                    <LineupCard
                      key={lineup.id}
                      lineup={lineup}
                      onDelete={handleDelete}
                      deletingId={deletingId}
                    />
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  );
};

export default UserDashboard;
