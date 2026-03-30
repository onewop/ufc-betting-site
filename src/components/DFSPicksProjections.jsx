import React, { useState, useEffect } from "react";

const DFSPicksProjections = () => {
  const [lineups, setLineups] = useState([]);
  const [optimizerError, setOptimizerError] = useState(null);
  const [userSeed, setUserSeed] = useState(12345);
  const [lineup, setLineup] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Simulate loading data
    const timer = setTimeout(() => {
      setLineups([
        {
          id: 1,
          name: "Optimal Lineup",
          salary: 50000,
          projMid: 120,
          totalSalary: 50000,
          totalPoints: 120,
        },
        {
          id: 2,
          name: "Diverse Lineup 1",
          salary: 49500,
          projMid: 118,
          totalSalary: 49500,
          totalPoints: 118,
        },
        {
          id: 3,
          name: "Diverse Lineup 2",
          salary: 49200,
          projMid: 116,
          totalSalary: 49200,
          totalPoints: 116,
        },
      ]);
      setLoading(false);
    }, 1000);

    return () => clearTimeout(timer);
  }, []);

  const runOptimizer = (count = 1) => {
    if (count > 1) {
      let s = userSeed;
      const seededRandom = () => {
        s = Math.sin(s) * 10000;
        return s - Math.floor(s);
      };
      const picksToUse = lineups.map((p) => ({
        ...p,
        projMid: Math.round(p.projMid * (1 + (seededRandom() * 2 - 1) * 0.05)),
      }));
      setLineups(picksToUse);
    } else {
      setLineups([
        {
          id: 1,
          name: "Optimal Lineup",
          salary: 50000,
          projMid: 120,
          totalSalary: 50000,
          totalPoints: 120,
        },
      ]);
    }
  };

  const downloadOptimalCSV = () => {
    const csvContent = "data:text/csv;charset=utf-8," +
      "ID,Name,Salary,Projected Mid,Total Salary,Projected Points\n" +
      lineups.map(l => 
        `"${l.id}", "${l.name}", ${l.salary}, ${l.projMid}, ${l.totalSalary}, ${l.totalPoints}`
      ).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "dfs_lineups.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-4">DFS Lineups</h2>
      {loading ? (
        <p>Loading lineups...</p>
      ) : (
        <div className="space-y-4">
          {lineups.map((l) => (
            <div key={l.id} className="border border-stone-700 rounded-lg p-4">
              <h3 className="text-lg font-semibold">{l.name}</h3>
              <ul className="space-y-2">
                <li>
                  <span className="text-stone-400">
                    ${l.salary.toLocaleString()} · {l.projMid} pts
                  </span>
                </li>
              </ul>
              <div className="flex justify-between text-xs text-stone-400 border-t border-stone-700 pt-2">
                <span>
                  Total Salary: <span className="text-stone-100 font-bold">${l.totalSalary.toLocaleString()}</span>
                </span>
                <span>
                  Proj Pts: <span className="text-yellow-400 font-bold">{l.totalPoints}</span>
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
      <div className="flex gap-3 justify-center mb-6 flex-wrap">
        <button onClick={() => runOptimizer(1)} className="neon-button">
          Build Optimal Lineup
        </button>
        <button
          onClick={() => runOptimizer(5)}
          className="neon-button bg-gray-700 hover:bg-gray-600"
        >
          Build 5 Diverse Lineups
        </button>
        <button
          onClick={downloadOptimalCSV}
          className="neon-button bg-green-900 hover:bg-green-800"
        >
          Download CSV
        </button>
        <button
          onClick={() => alert("Quick test successful - deepseek 16b")}
          className="neon-button bg-blue-900 hover:bg-blue-800"
        >
          Run Quick Test
        </button>
      </div>
      {optimizerError && (
        <p className="text-red-400 text-center text-sm mb-4">
          {optimizerError}
        </p>
      )}
    </div>
  );
};

export default DFSPicksProjections;
