import React, { useState, useEffect } from "react";

const TeamCombinations = () => {
  const [fighters, setFighters] = useState([
    { id: 1, name: "John Yannis", salary: 6600, fight_id: 1 },
    { id: 2, name: "Austin Bashi", salary: 9600, fight_id: 1 },
    { id: 3, name: "Felipe Bunes", salary: 6700, fight_id: 2 },
    { id: 4, name: "Rafael Estevam", salary: 9500, fight_id: 2 },
    { id: 5, name: "Kevin Vallejos", salary: 9400, fight_id: 3 },
    { id: 6, name: "Danny Silva", salary: 6800, fight_id: 3 },
    { id: 7, name: "Nathan Fletcher", salary: 6900, fight_id: 4 },
    { id: 8, name: "Rinya Nakamura", salary: 9300, fight_id: 4 },
    { id: 9, name: "HyunSung Park", salary: 7000, fight_id: 5 },
    { id: 10, name: "Tatsuro Taira", salary: 9200, fight_id: 5 },
    { id: 11, name: "Esteban Ribovics", salary: 9100, fight_id: 6 },
    { id: 12, name: "Elves Brener", salary: 7100, fight_id: 6 },
    { id: 13, name: "Chris Duncan", salary: 7200, fight_id: 7 },
    { id: 14, name: "Mateusz Rebecki", salary: 9000, fight_id: 7 },
    { id: 15, name: "Tresean Gore", salary: 7300, fight_id: 8 },
    { id: 16, name: "Rodolfo Vieira", salary: 8900, fight_id: 8 },
    { id: 17, name: "Elizeu Zaleski dos Santos", salary: 8800, fight_id: 9 },
    { id: 18, name: "Neil Magny", salary: 7400, fight_id: 9 },
    { id: 19, name: "Ketlen Souza", salary: 7500, fight_id: 10 },
    { id: 20, name: "Piera Rodriguez", salary: 8700, fight_id: 10 },
    { id: 21, name: "Nora Cornolle", salary: 7600, fight_id: 11 },
    { id: 22, name: "Karol Rosa", salary: 8600, fight_id: 11 },
    { id: 23, name: "Andrey Pulyaev", salary: 8400, fight_id: 12 },
    { id: 24, name: "Nick Klein", salary: 7800, fight_id: 12 },
  ]);
  const [combinations, setCombinations] = useState([]);
  const [randomTeams, setRandomTeams] = useState([]);
  const [fighterCounts, setFighterCounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [numTeams, setNumTeams] = useState(5);
  const [fighterLimits, setFighterLimits] = useState({});
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    fetch("/combinations.json")
      .then((res) => res.json())
      .then((data) => {
        setCombinations(data);
        const initialLimits = {};
        fighters.forEach((f) => {
          initialLimits[f.id] = { min: 0, max: Infinity };
        });
        setFighterLimits(initialLimits);
        setLoading(false);
      })
      .catch((err) => {
        setError("Failed to load data. Please try again.");
        setLoading(false);
        console.error("Error:", err);
      });
  }, []);

  const handleLimitChange = (fighterId, type, value) => {
    const parsedValue = parseInt(value);
    setFighterLimits((prev) => ({
      ...prev,
      [fighterId]: {
        ...prev[fighterId],
        [type]: isNaN(parsedValue)
          ? type === "min"
            ? 0
            : Infinity
          : parsedValue,
      },
    }));
  };

  const generateTeamsWithConstraints = () => {
    setError(null);
    setRandomTeams([]);
    setFighterCounts({});

    let filteredCombinations = [...combinations];

    Object.entries(fighterLimits).forEach(([id, { max }]) => {
      const fighterId = parseInt(id);
      if (max === 0) {
        filteredCombinations = filteredCombinations.filter(
          (combo) => !combo.includes(fighterId)
        );
      }
    });

    if (filteredCombinations.length < numTeams) {
      setError(
        `Not enough combinations meet the criteria. Only ${filteredCombinations.length} available after exclusions. Adjust limits or reduce number of teams.`
      );
      return;
    }

    const shuffled = [...filteredCombinations].sort(() => 0.5 - Math.random());

    let selectedTeams = [];
    let attempts = 0;
    const maxAttempts = 5000; // Increased for better success rate

    while (attempts < maxAttempts) {
      selectedTeams = shuffled.slice(0, numTeams);

      // Map to teams with fighters and enforce salary cap
      const teamsWithFighters = [];
      for (const teamIds of selectedTeams) {
        const team = teamIds.map((id) => fighters.find((f) => f.id === id));
        const totalSalary = team.reduce((sum, f) => sum + f.salary, 0);
        if (totalSalary > 50000) {
          // Skip this team if over cap
          continue;
        }
        teamsWithFighters.push(team);
      }

      selectedTeams = teamsWithFighters; // Update to only valid teams

      if (selectedTeams.length < numTeams) {
        // Reshuffle if not enough valid
        shuffled.sort(() => 0.5 - Math.random());
        attempts++;
        continue;
      }

      const counts = {};
      fighters.forEach((f) => (counts[f.id] = 0));
      selectedTeams.forEach((team) => team.forEach((f) => counts[f.id]++));

      let allSatisfied = true;
      Object.entries(fighterLimits).forEach(
        ([id, { min = 0, max = Infinity }]) => {
          const count = counts[parseInt(id)] || 0;
          if (count < min || count > max) {
            allSatisfied = false;
          }
        }
      );

      Object.entries(counts).forEach(([id, count]) => {
        if (fighterLimits[parseInt(id)]?.max === 0 && count > 0) {
          allSatisfied = false;
        }
      });

      if (allSatisfied) {
        break;
      }

      shuffled.sort(() => 0.5 - Math.random());
      attempts++;
    }

    if (attempts >= maxAttempts) {
      setError(
        "Unable to generate teams meeting all constraints after 5000 attempts. Try relaxing min/max limits, removing exclusions, or reducing the number of teams."
      );
      return;
    }

    setRandomTeams(selectedTeams);

    const finalCounts = {};
    fighters.forEach((f) => (finalCounts[f.id] = { name: f.name, count: 0 }));
    selectedTeams.forEach((team) =>
      team.forEach((f) => finalCounts[f.id].count++)
    );
    setFighterCounts(finalCounts);
  };

  const downloadCSV = () => {
    if (randomTeams.length === 0) return;

    const csvContent =
      "data:text/csv;charset=utf-8," +
      "Team Number,Fighter 1,Fighter 2,Fighter 3,Fighter 4,Fighter 5,Fighter 6\n" +
      randomTeams
        .map(
          (team, index) => `${index + 1},` + team.map((f) => f.name).join(",")
        )
        .join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "dfs_teams.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredFighters = fighters.filter((f) =>
    f.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading)
    return <div className="text-center text-gray-300">Loading...</div>;
  if (error) return <div className="text-center text-red-400">{error}</div>;

  return (
    <div className="container mx-auto p-6 min-h-screen">
      <h1 className="text-5xl font-bold mb-8 text-center">
        DFS Team Combinations - UFC Fight Night Aug 2
      </h1>
      <p className="text-red-400 mb-6 text-center">
        <strong>Warning:</strong> For entertainment only. DFS is 21+. Call
        1-800-GAMBLER for help. [YourSite] not liable for losses.
      </p>
      <p className="text-gray-300 mb-6 text-center">
        Total combinations: {combinations.length.toLocaleString()}. Max 6
        fighters, $50,000 salary cap, one fighter per fight.
      </p>
      <div className="flex space-x-6 mb-8">
        <div className="w-2/3">
          <h2 className="text-2xl font-semibold mb-4">Fighter Limits</h2>
          <input
            type="text"
            placeholder="Search fighters..."
            className="w-full p-2 mb-4 bg-gray-800 text-white border border-gray-600 rounded"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <div className="overflow-y-auto h-96 border border-gray-600 rounded">
            <table className="w-full text-left text-gray-300">
              <thead className="sticky top-0 bg-gray-800">
                <tr>
                  <th className="p-2">Name</th>
                  <th className="p-2">Salary</th>
                  <th className="p-2">Min</th>
                  <th className="p-2">Max</th>
                </tr>
              </thead>
              <tbody>
                {filteredFighters.map((fighter) => (
                  <tr key={fighter.id} className="border-b border-gray-700">
                    <td className="p-2">{fighter.name}</td>
                    <td className="p-2">${fighter.salary}</td>
                    <td className="p-2">
                      <input
                        type="number"
                        value={fighterLimits[fighter.id]?.min || ""}
                        onChange={(e) =>
                          handleLimitChange(fighter.id, "min", e.target.value)
                        }
                        className="w-16 bg-gray-800 text-white border border-gray-600 rounded"
                        min="0"
                      />
                    </td>
                    <td className="p-2">
                      <input
                        type="number"
                        value={
                          fighterLimits[fighter.id]?.max === Infinity
                            ? ""
                            : fighterLimits[fighter.id]?.max
                        }
                        onChange={(e) =>
                          handleLimitChange(fighter.id, "max", e.target.value)
                        }
                        className="w-16 bg-gray-800 text-white border border-gray-600 rounded"
                        min="0"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="w-1/3 card">
          <h2 className="text-2xl font-semibold mb-4">Generate Teams</h2>
          <label className="block text-lg mb-2">Number of Teams:</label>
          <input
            type="number"
            value={numTeams}
            onChange={(e) => setNumTeams(parseInt(e.target.value) || 5)}
            className="w-full p-2 mb-4 bg-gray-800 text-white border border-gray-600 rounded"
            min="1"
            max="50"
          />
          <button
            onClick={generateTeamsWithConstraints}
            className="neon-button w-full"
          >
            Generate
          </button>
          {randomTeams.length > 0 && (
            <button onClick={downloadCSV} className="neon-button w-full mt-4">
              Download CSV
            </button>
          )}
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="card">
          <h2 className="text-2xl font-semibold mb-4">Generated Teams</h2>
          {randomTeams.map((team, index) => (
            <div key={index} className="mb-4">
              <h3>Team {index + 1}</h3>
              <ul>
                {team.map((f) => (
                  <li key={f.id}>
                    {f.name} - ${f.salary}
                  </li>
                ))}
              </ul>
              <p>
                Total Salary: $
                {team.reduce((sum, f) => sum + f.salary, 0).toLocaleString()}
              </p>
            </div>
          ))}
        </div>
        <div className="card">
          <h2 className="text-2xl font-semibold mb-4">Fighter Usage Summary</h2>
          <ul className="grid grid-cols-1 gap-2 text-gray-300">
            {Object.values(fighterCounts)
              .filter((fc) => fc.count > 0)
              .map((fc) => (
                <li key={fc.name} className="p-2 border pearl-border rounded">
                  {fc.name}: {fc.count} teams
                </li>
              ))}
          </ul>
        </div>
      </div>
    </div>
  );
};

export default TeamCombinations;
