import React, { useState, useEffect } from "react";
import "tailwindcss/tailwind.css";

const TeamCombinations = () => {
  const [fighters, setFighters] = useState([]);
  const [combinations, setCombinations] = useState([]);
  const [randomTeams, setRandomTeams] = useState([]);

  useEffect(() => {
    fetch("/fighters.json")
      .then((res) => res.json())
      .then((data) => setFighters(data))
      .catch((err) => console.error("Error fetching fighters:", err));

    fetch("/combinations.json")
      .then((res) => res.json())
      .then((data) => setCombinations(data))
      .catch((err) => console.error("Error fetching combinations:", err));
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
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {randomTeams.map((team, index) => (
          <div key={index} className="card p-6">
            <h2 className="text-2xl font-semibold mb-4">Team {index + 1}</h2>
            <ul className="text-gray-300">
              {team.map((fighter, i) => (
                <li key={i} className="mb-2">
                  {fighter.name} - ${fighter.salary}
                </li>
              ))}
            </ul>
            <p className="text-green-400 font-bold mt-4">
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
