import React, { useState, useEffect } from "react";

const ManualTeams = () => {
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
  const [currentTeam, setCurrentTeam] = useState([]);
  const [savedTeams, setSavedTeams] = useState([]);
  const [fighterCounts, setFighterCounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const maxTeamSize = 6;
  const maxSalary = 50000;

  useEffect(() => {
    const initialCounts = {};
    fighters.forEach((f) => (initialCounts[f.id] = 0));
    setFighterCounts(initialCounts);
    setLoading(false);
  }, [fighters]);

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

  const filteredFighters = fighters.filter((f) =>
    f.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading)
    return <div className="text-center text-gray-300">Loading...</div>;
  if (error) return <div className="text-center text-red-400">{error}</div>;

  return (
    <div className="container mx-auto p-6 min-h-screen">
      <h1 className="text-5xl font-bold mb-8 text-center">
        Manual Team Builder
      </h1>
      <input
        type="text"
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        placeholder="Search fighters..."
        className="border pearl-border bg-gray-800 text-white p-2 rounded-lg w-full mb-4"
      />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="card">
          <h2 className="text-2xl font-semibold mb-4">Available Fighters</h2>
          <ul className="text-gray-300">
            {filteredFighters.map((fighter) => (
              <li key={fighter.id} className="mb-2 flex justify-between">
                {fighter.name} - ${fighter.salary}
                <button
                  onClick={() => addToTeam(fighter)}
                  className="text-green-400 hover:text-green-300 text-sm"
                >
                  Add
                </button>
              </li>
            ))}
          </ul>
        </div>
        <div className="card">
          <h2 className="text-2xl font-semibold mb-4">Current Team</h2>
          <p>
            Current Salary: $
            {currentTeam.reduce((sum, f) => sum + f.salary, 0).toLocaleString()}{" "}
            / $50,000
          </p>
          <p>Fighters Selected: {currentTeam.length} / 6</p>
          <ul className="text-gray-300 mb-4">
            {currentTeam.map((fighter) => (
              <li key={fighter.id} className="flex justify-between">
                {fighter.name} - ${fighter.salary}
                <button
                  onClick={() => removeFromTeam(fighter.id)}
                  className="text-red-400 hover:text-red-300 text-sm"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
          <button onClick={saveTeam} className="neon-button">
            Save Team
          </button>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="card">
          <h2 className="text-2xl font-semibold mb-4">Saved Teams</h2>
          {savedTeams.map((team, index) => (
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
            {fighters.map((fighter) => (
              <li key={fighter.id} className="p-2 border pearl-border rounded">
                {fighter.name}: {fighterCounts[fighter.id] || 0} teams
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
};

export default ManualTeams;
