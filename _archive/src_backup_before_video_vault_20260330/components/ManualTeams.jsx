import React, { useState, useEffect } from "react";
import { DK_PLAYERS, DK_BY_NAME } from "../data/dkSlate";

const ManualTeams = () => {
  const [fighters, setFighters] = useState([]);
  const [currentTeam, setCurrentTeam] = useState([]);
  const [savedTeams, setSavedTeams] = useState([]);
  const [fighterCounts, setFighterCounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const maxTeamSize = 6;
  const maxSalary = 50000;

  useEffect(() => {
    fetch("/this_weeks_stats.json")
      .then((res) => res.json())
      .then((data) => {
        const parsed = [];
        (data.fights || []).forEach((fight, fightIdx) => {
          (fight.fighters || []).forEach((f) => {
            parsed.push({
              id: `${fightIdx}-${f.name}`,
              name: f.name,
              salary: f.salary || 0,
              fight_id: fightIdx,
            });
          });
        });
        const initialCounts = {};
        parsed.forEach((f) => (initialCounts[f.id] = 0));
        setFighters(parsed);
        setFighterCounts(initialCounts);
        setLoading(false);
      })
      .catch((err) => {
        setError("Failed to load fighter data.");
        setLoading(false);
      });
  }, []);

  const addToTeam = (fighter) => {
    if (currentTeam.length >= maxTeamSize) {
      alert("Team is full! Maximum of 6 fighters.");
      return;
    }
    const currentSalary = currentTeam.reduce((sum, f) => sum + f.salary, 0);
    if (currentSalary + fighter.salary > maxSalary) {
      alert("Salary cap exceeded! Cannot add this fighter.");
      return;
    }
    // Check for same fight_id
    const sameFight = currentTeam.some((f) => f.fight_id === fighter.fight_id);
    if (sameFight) {
      alert("Cannot add fighters from the same fight!");
      return; // Prevent addition without crashing or resetting state
    }
    setCurrentTeam([...currentTeam, fighter]);
  };

  const removeFromTeam = (id) => {
    setCurrentTeam(currentTeam.filter((f) => f.id !== id));
  };

  const saveTeam = () => {
    if (currentTeam.length !== maxTeamSize) {
      alert("Team must have exactly 6 fighters!");
      return;
    }
    setSavedTeams([...savedTeams, currentTeam]);
    const updatedCounts = { ...fighterCounts };
    currentTeam.forEach((f) => updatedCounts[f.id]++);
    setFighterCounts(updatedCounts);
    setCurrentTeam([]);
  };

  const downloadCSV = () => {
    if (savedTeams.length === 0) {
      alert("No saved teams to export. Save at least one team first.");
      return;
    }

    const skipped = [];
    const lineupRows = [];

    for (let i = 0; i < savedTeams.length; i++) {
      const team = savedTeams[i];

      if (team.length !== 6) {
        skipped.push(`Lineup ${i + 1}: only ${team.length} fighters (need 6)`);
        continue;
      }

      const dkEntries = team.map((f) => {
        const dk = DK_BY_NAME[f.name.toLowerCase()];
        if (!dk) {
          skipped.push(
            `Lineup ${i + 1}: "${f.name}" not found in DK slate — update src/data/dkSlate.js`,
          );
          return null;
        }
        return dk;
      });

      if (dkEntries.some((e) => e === null)) continue;

      lineupRows.push(dkEntries.map((dk) => dk.dkId));
    }

    if (skipped.length > 0) {
      alert(
        `Warning — ${skipped.length} lineup(s) skipped:\n\n${skipped.join("\n")}\n\nUpdate src/data/dkSlate.js if fighters are missing.`,
      );
    }

    if (lineupRows.length === 0) {
      alert(
        "No valid lineups to export. Check that fighter names match dkSlate.js.",
      );
      return;
    }

    const INSTRUCTIONS = [
      "1. Locate the player you want to select in the list below",
      "2. Copy the ID of your player (you can use the Name + ID column or the ID column)",
      "3. Paste the ID into the roster position desired",
      "4. You must include an ID for each player; you cannot use just the player's name",
      "5. You can create up to 500 lineups per file",
    ];

    const rightSide = [
      ...INSTRUCTIONS,
      "",
      "Position,Name + ID,Name,ID,Roster Position,Salary,Game Info,TeamAbbrev,AvgPointsPerGame",
      ...DK_PLAYERS.map(
        (p) =>
          `F,${p.name} (${p.dkId}),${p.name},${p.dkId},F,${p.salary},${p.gameInfo},${p.teamAbbrev},${p.avgFPPG}`,
      ),
    ];

    const csvRows = [];
    csvRows.push("F,F,F,F,F,F,,Instructions");

    const totalRows = Math.max(lineupRows.length, rightSide.length);
    for (let i = 0; i < totalRows; i++) {
      const left = lineupRows[i] ? lineupRows[i].join(",") : ",,,,,";
      const right = rightSide[i] !== undefined ? rightSide[i] : "";
      csvRows.push(`${left},,${right}`);
    }

    const csvContent = csvRows.join("\r\n");
    // application/octet-stream forces download instead of opening in LibreOffice
    const csvBlob = new Blob([csvContent], {
      type: "application/octet-stream",
    });
    const url = URL.createObjectURL(csvBlob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `dk-ufc-lineups-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const filteredFighters = fighters.filter((f) =>
    f.name.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  if (loading)
    return (
      <div
        className="min-h-screen bg-stone-950 flex items-center justify-center"
        style={{ fontFamily: "'Courier New', monospace" }}
      >
        <p className="text-stone-500 tracking-widest animate-pulse uppercase text-sm">
          Loading…
        </p>
      </div>
    );
  if (error)
    return (
      <div
        className="min-h-screen bg-stone-950 flex items-center justify-center"
        style={{ fontFamily: "'Courier New', monospace" }}
      >
        <p className="text-red-400 text-center">{error}</p>
      </div>
    );

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
          FULL COMMAND ⚡
        </span>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-4 md:py-10">
        {/* Page header */}
        <div className="text-center mb-8">
          <p className="text-xs text-stone-500 tracking-[0.5em] uppercase mb-2">
            ◆ OPERATION COMBAT VAULT — COMMAND CENTER ◆
          </p>
          <h1
            className="text-3xl md:text-5xl font-black text-stone-100 tracking-wider uppercase"
            style={{
              fontFamily: "'Impact', sans-serif",
              textShadow: "2px 2px 0 #4a5240, 0 0 40px rgba(100,120,80,0.3)",
            }}
          >
            MANUAL <span className="text-yellow-600">TEAM BUILDER</span>
          </h1>
          <div className="w-32 h-px bg-gradient-to-r from-transparent via-yellow-700 to-transparent mx-auto mt-3" />
        </div>

        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search fighters..."
          className="border border-yellow-700/40 bg-stone-900 text-stone-100 p-2 rounded-lg w-full mb-6"
        />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-stone-900 border border-yellow-700/40 rounded-lg p-5">
            <h2 className="text-sm font-bold tracking-[0.4em] uppercase text-yellow-600 mb-4">
              ◈ AVAILABLE FIGHTERS
            </h2>

            <details
              className="md:hidden rounded border border-stone-700 bg-stone-950/60"
              open
            >
              <summary className="px-3 py-2 text-xs font-bold uppercase tracking-widest text-yellow-500">
                Available Fighters ({filteredFighters.length})
              </summary>
              <ul className="space-y-2 p-3 border-t border-stone-700 max-h-[24rem] overflow-y-auto">
                {filteredFighters.map((fighter, idx) => (
                  <li key={`mobile-${fighter.id}`} className="mobile-data-card">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <span className="text-stone-200 text-sm font-semibold block leading-snug">
                          {fighter.name}
                        </span>
                        <span className="text-yellow-500/80 text-xs">
                          ${fighter.salary} · #{idx + 1}
                        </span>
                      </div>
                      <button
                        onClick={() => addToTeam(fighter)}
                        className="min-h-[40px] px-3 text-yellow-400 hover:text-yellow-300 text-xs font-bold tracking-widest uppercase border border-yellow-700/40 rounded hover:bg-yellow-900/20 transition"
                      >
                        Add
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </details>

            <ul className="space-y-2 hidden md:block overflow-y-auto max-h-96">
              {filteredFighters.map((fighter) => (
                <li
                  key={fighter.id}
                  className="flex justify-between items-center text-sm border-b border-stone-800 pb-2 last:border-0"
                >
                  <span className="text-stone-200">{fighter.name}</span>
                  <span className="flex items-center gap-3">
                    <span className="text-yellow-500/80 text-xs">
                      ${fighter.salary}
                    </span>
                    <button
                      onClick={() => addToTeam(fighter)}
                      className="text-yellow-400 hover:text-yellow-300 text-xs font-bold tracking-widest uppercase border border-yellow-700/40 px-2 py-0.5 rounded hover:bg-yellow-900/20 transition"
                    >
                      Add
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <div className="bg-stone-900 border border-yellow-700/40 rounded-lg p-5">
            <h2 className="text-sm font-bold tracking-[0.4em] uppercase text-yellow-600 mb-4">
              ◈ CURRENT TEAM
            </h2>
            <p className="text-stone-400 text-xs tracking-wide mb-1">
              Salary:{" "}
              <span className="text-yellow-400 font-bold">
                $
                {currentTeam
                  .reduce((sum, f) => sum + f.salary, 0)
                  .toLocaleString()}
              </span>{" "}
              / <span className="text-stone-300">$50,000</span>
            </p>
            <p className="text-stone-400 text-xs tracking-wide mb-4">
              Fighters:{" "}
              <span className="text-yellow-400 font-bold">
                {currentTeam.length}
              </span>{" "}
              / 6
            </p>
            <ul className="space-y-2 mb-4">
              {currentTeam.map((fighter) => (
                <li
                  key={fighter.id}
                  className="flex justify-between items-center text-sm border-b border-stone-800 pb-2 last:border-0"
                >
                  <span className="text-stone-200">{fighter.name}</span>
                  <span className="flex items-center gap-3">
                    <span className="text-yellow-500/80 text-xs">
                      ${fighter.salary}
                    </span>
                    <button
                      onClick={() => removeFromTeam(fighter.id)}
                      className="text-red-400 hover:text-red-300 text-xs font-bold tracking-widest uppercase border border-red-900/40 px-2 py-0.5 rounded hover:bg-red-950/30 transition"
                    >
                      Remove
                    </button>
                  </span>
                </li>
              ))}
            </ul>
            <button onClick={saveTeam} className="neon-button w-full">
              Save Team
            </button>
            <button onClick={downloadCSV} className="neon-button w-full mt-2">
              Download CSV
            </button>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
          <div className="bg-stone-900 border border-yellow-700/40 rounded-lg p-5">
            <h2 className="text-sm font-bold tracking-[0.4em] uppercase text-yellow-600 mb-4">
              ◈ SAVED TEAMS
            </h2>

            <div className="md:hidden space-y-2">
              {savedTeams.map((team, index) => (
                <details
                  key={`mobile-saved-${index}`}
                  className="rounded border border-stone-700 bg-stone-950/60"
                >
                  <summary className="px-3 py-2 text-xs font-bold tracking-widest uppercase text-yellow-500">
                    Team {index + 1}
                  </summary>
                  <div className="p-3 border-t border-stone-700">
                    <ul className="space-y-1">
                      {team.map((f) => (
                        <li key={f.id} className="flex justify-between text-sm">
                          <span className="text-stone-200">{f.name}</span>
                          <span className="text-yellow-500/80">
                            ${f.salary}
                          </span>
                        </li>
                      ))}
                    </ul>
                    <p className="text-stone-400 text-xs mt-2">
                      Total:{" "}
                      <span className="text-yellow-400 font-bold">
                        $
                        {team
                          .reduce((sum, f) => sum + f.salary, 0)
                          .toLocaleString()}
                      </span>
                    </p>
                  </div>
                </details>
              ))}
            </div>

            <div className="hidden md:block">
              {savedTeams.map((team, index) => (
                <div
                  key={index}
                  className="mb-4 pb-4 border-b border-stone-800 last:border-0"
                >
                  <h3 className="text-yellow-500 font-bold tracking-wider uppercase text-xs mb-2">
                    TEAM {index + 1}
                  </h3>
                  <ul className="space-y-1">
                    {team.map((f) => (
                      <li key={f.id} className="flex justify-between text-sm">
                        <span className="text-stone-200">{f.name}</span>
                        <span className="text-yellow-500/80">${f.salary}</span>
                      </li>
                    ))}
                  </ul>
                  <p className="text-stone-400 text-xs mt-2">
                    Total:{" "}
                    <span className="text-yellow-400 font-bold">
                      $
                      {team
                        .reduce((sum, f) => sum + f.salary, 0)
                        .toLocaleString()}
                    </span>
                  </p>
                </div>
              ))}
            </div>
          </div>
          <div className="bg-stone-900 border border-yellow-700/40 rounded-lg p-5">
            <h2 className="text-sm font-bold tracking-[0.4em] uppercase text-yellow-600 mb-4">
              ◈ FIGHTER USAGE SUMMARY
            </h2>
            <ul className="grid grid-cols-1 gap-2">
              {fighters.map((fighter) => (
                <li
                  key={fighter.id}
                  className="p-2 border border-stone-700 rounded text-sm flex justify-between"
                >
                  <span className="text-stone-300">{fighter.name}</span>
                  <span
                    className={
                      fighterCounts[fighter.id] > 0
                        ? "text-yellow-400 font-bold"
                        : "text-stone-600"
                    }
                  >
                    {fighterCounts[fighter.id] || 0} teams
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ManualTeams;
