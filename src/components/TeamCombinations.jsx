import React, { useState, useEffect } from "react";
import "tailwindcss/tailwind.css";

const TeamCombinations = () => {
  const [fighters, setFighters] = useState([]);
  const [combinations, setCombinations] = useState([]);
  const [randomTeams, setRandomTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    Promise.all([
      fetch("/fighters.json").then((res) => res.json()),
      fetch("/combinations.json").then((res) => res.json()),
    ])
      .then(([fightersData, combinationsData]) => {
        setFighters(fightersData);
        setCombinations(combinationsData);
        setLoading(false);
      })
      .catch((err) => {
        setError("Failed to load data. Please try again.");
        setLoading(false);
        console.error("Error:", err);
      });
  }, []);

  const generateRandomTeams = () => {
    const shuffled = [...combinations].sort(() => 0.5 - Math.random());
    const selectedTeams = shuffled
      .slice(0, 5)
      .map((team) =>
        team.map((fighterId) => fighters.find((f) => f.id === fighterId))
      );
    setRandomTeams(selectedTeams);
  };

  if (loading)
    return <div className="text-center text-gray-300">Loading...</div>;
  if (error) return <div className="text-center text-red-400">{error}</div>;

  return (
    <div className="container mx-auto p-6 min-h-screen">
      <h1 className="text-5xl font-bold mb-8 text-center">
        DFS Team Combinations
      </h1>
      <p className="text-red-400 mb-6 text-center">
        <strong>Warning:</strong> For entertainment only. DFS is 21+. Call
        1-800-GAMBLER for help. [YourSite] not liable for losses.
      </p>
      <p className="text-gray-300 mb-6 text-center">
        Total combinations: {combinations.length.toLocaleString()}. Max 6
        fighters, $50,000 salary cap, one fighter per fight.
      </p>
      <div className="flex justify-center mb-8">
        <button onClick={generateRandomTeams} className="neon-button">
          Generate 5 Random Teams
        </button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {randomTeams.map((team, index) => (
          <div key={index} className="card">
            <h2 className="text-2xl font-semibold mb-4">Team {index + 1}</h2>
            <ul className="text-gray-300">
              {team.map((fighter, i) => (
                <li key={i} className="mb-4 flex items-center">
                  <img
                    src={`/fighter-${fighter.id}.jpg`}
                    alt={fighter.name}
                    className="w-12 h-12 rounded-full mr-3 object-cover pearl-border"
                    onError={(e) =>
                      (e.target.src = "https://picsum.photos/200/200")
                    } // Fallback
                  />
                  <span>
                    {fighter.name} - ${fighter.salary}
                  </span>
                </li>
              ))}
            </ul>
            <p className="text-green-400 font-bold mt-4 pearl-gradient p-2 rounded">
              Total Salary: $
              {team.reduce((sum, f) => sum + f.salary, 0).toLocaleString()}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default TeamCombinations;
