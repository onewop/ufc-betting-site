import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";

const UserDashboard = ({ currentUser }) => {
  const [lineups, setLineups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Paywall check — driven by prop from App.jsx
  const isPro = currentUser?.subscription_status === "pro";

  useEffect(() => {
    if (!isPro) return;
    const token = localStorage.getItem("authToken");
    if (!token) {
      setError("Please log in to view your dashboard");
      setLoading(false);
      return;
    }

    fetch("http://localhost:8000/api/lineups", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => {
        setLineups(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setError("Failed to load your saved lineups");
        setLoading(false);
      });
  }, [isPro]);

  const handleUpgrade = async () => {
    const token = localStorage.getItem("authToken");
    if (!token) return;
    try {
      const res = await fetch(
        "http://localhost:8000/api/create-checkout-session",
        {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (err) {
      console.error("Upgrade error:", err);
    }
  };

  if (!isPro) {
    return (
      <div
        className="min-h-screen bg-stone-950"
        style={{ fontFamily: "'Courier New', monospace" }}
      >
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
        <div className="max-w-4xl mx-auto px-4 py-8 md:py-10 text-center">
          <h1 className="text-3xl md:text-5xl font-black text-stone-100 tracking-wider uppercase mb-4">
            UPGRADE TO PRO
          </h1>
          <p className="text-stone-400 mb-6">
            Access your saved lineups and advanced analytics.
          </p>
          <button
            onClick={handleUpgrade}
            className="bg-green-600 hover:bg-green-500 text-white font-bold py-3 px-6 rounded-lg transition"
          >
            Upgrade to Pro - $19.99/month
          </button>
        </div>
      </div>
    );
  }

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this lineup set?")) return;

    const token = localStorage.getItem("authToken");
    await fetch(`http://localhost:8000/api/lineups/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });

    setLineups(lineups.filter((l) => l.id !== id));
  };

  if (loading)
    return (
      <div className="p-8 text-center text-stone-400">
        Loading your dashboard...
      </div>
    );
  if (error) return <div className="p-8 text-red-400">{error}</div>;

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-yellow-400 mb-8">My Dashboard</h1>

      {/* Overview Stats */}
      <div className="flex gap-3 mb-8 overflow-x-auto">
        <div className="bg-stone-900 border border-stone-700 rounded-lg p-3 min-w-[120px] flex-shrink-0">
          <div className="text-stone-400 text-[10px] uppercase tracking-wider">
            Saved Sets
          </div>
          <div className="text-2xl font-bold text-white mt-1">
            {lineups.length}
          </div>
        </div>
        <div className="bg-stone-900 border border-stone-700 rounded-lg p-3 min-w-[120px] flex-shrink-0">
          <div className="text-stone-400 text-[10px] uppercase tracking-wider">
            Total Lineups
          </div>
          <div className="text-2xl font-bold text-white mt-1">
            {lineups.reduce((sum, l) => sum + (l.lineup_data?.length || 0), 0)}
          </div>
        </div>
        <div className="bg-stone-900 border border-stone-700 rounded-lg p-3 min-w-[120px] flex-shrink-0">
          <div className="text-stone-400 text-[10px] uppercase tracking-wider">
            Best Proj FPTS
          </div>
          <div className="text-2xl font-bold text-emerald-400 mt-1">
            {lineups.length
              ? Math.max(...lineups.map((l) => l.projected_fpts || 0))
              : 0}
          </div>
        </div>
        <div className="bg-stone-900 border border-stone-700 rounded-lg p-3 min-w-[120px] flex-shrink-0">
          <div className="text-stone-400 text-[10px] uppercase tracking-wider">
            Last Saved
          </div>
          <div className="text-2xl font-bold text-white mt-1">
            {lineups.length
              ? new Date(
                  Math.max(...lineups.map((l) => new Date(l.created_at))),
                ).toLocaleDateString()
              : "Never"}
          </div>
        </div>
      </div>

      {/* Saved Lineups Section */}
      <h2 className="text-2xl font-semibold text-white mb-6">
        My Saved Lineups
      </h2>

      {lineups.length === 0 ? (
        <div className="bg-stone-900 border border-stone-700 rounded-xl p-12 text-center">
          <p className="text-stone-400 mb-4">
            You haven't saved any lineups yet.
          </p>
          <Link
            to="/team-combinations"
            className="inline-block bg-yellow-600 hover:bg-yellow-500 text-stone-950 font-semibold px-8 py-3 rounded-lg transition"
          >
            Generate & Save Lineups
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {lineups.map((lineup) => (
            <div
              key={lineup.id}
              className="bg-stone-900 border border-stone-700 rounded-xl p-6 hover:border-yellow-500/50 transition"
            >
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="font-semibold text-lg text-white">
                    {lineup.name}
                  </h3>
                  <span
                    className={`inline-block px-3 py-1 text-xs font-medium rounded-full mt-2 ${
                      lineup.salary_mode === "higher"
                        ? "bg-red-900/60 text-red-300"
                        : lineup.salary_mode === "medium"
                          ? "bg-yellow-900/60 text-yellow-300"
                          : "bg-blue-900/60 text-blue-300"
                    }`}
                  >
                    {lineup.salary_mode.toUpperCase()}
                  </span>
                </div>
                <button
                  onClick={() => handleDelete(lineup.id)}
                  className="text-red-400 hover:text-red-500 text-sm"
                >
                  Delete
                </button>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm mb-4">
                <div>
                  <span className="text-stone-400">Avg Salary</span>
                  <div className="font-mono text-white">
                    ${lineup.total_salary.toLocaleString()}
                  </div>
                </div>
                <div>
                  <span className="text-stone-400">Proj FPTS</span>
                  <div className="font-mono text-emerald-400">
                    {lineup.projected_fpts}
                  </div>
                </div>
              </div>

              <div className="text-xs text-stone-500">
                Saved {new Date(lineup.created_at).toLocaleDateString()}
              </div>

              {/* Expandable fighters */}
              <details className="mt-4">
                <summary className="cursor-pointer text-yellow-400 hover:text-yellow-300 text-sm">
                  View {lineup.lineup_data?.length || 0} lineups →
                </summary>
                <div className="mt-3 space-y-3 text-xs">
                  {lineup.lineup_data?.map((l, idx) => (
                    <div
                      key={idx}
                      className="bg-stone-950 p-3 rounded border border-stone-800"
                    >
                      <div className="font-medium text-stone-300 mb-1">
                        Lineup {idx + 1}
                      </div>
                      <div className="grid grid-cols-1 gap-y-1">
                        {l.map((f, i) => (
                          <div key={i} className="text-stone-300">
                            {f.name} —{" "}
                            <span className="font-mono text-yellow-400">
                              ${f.salary}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </details>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default UserDashboard;
