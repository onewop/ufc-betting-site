import React, { useState, useEffect } from "react";
import "./LowBlowLottery.css"; // Reference the CSS (see step 2)

// Mock fighter data (replace with API call in production)
const mockFighters = [
  { id: 1, name: "Fighter A", weightClass: "Lightweight" },
  { id: 2, name: "Fighter B", weightClass: "Welterweight" },
  { id: 3, name: "Fighter C", weightClass: "Middleweight" },
  { id: 4, name: "Fighter D", weightClass: "Heavyweight" },
  { id: 5, name: "Fighter E", weightClass: "Lightweight" },
  { id: 6, name: "Fighter F", weightClass: "Welterweight" },
];

function LowBlowLottery() {
  const [user, setUser] = useState(null);
  const [selectedFighters, setSelectedFighters] = useState([]);
  const [leaderboard, setLeaderboard] = useState([]);
  const maxPicks = 6;

  useEffect(() => {
    setUser({ username: "User123" });
    setLeaderboard([
      { username: "User123", score: 12, rank: 1 },
      { username: "ChallengerX", score: 15, rank: 2 },
    ]);
  }, []);

  const handleFighterSelect = (fighter) => {
    if (
      selectedFighters.length < maxPicks &&
      !selectedFighters.some((f) => f.id === fighter.id)
    ) {
      setSelectedFighters([...selectedFighters, fighter]);
    }
  };

  const handleSubmit = () => {
    if (selectedFighters.length === maxPicks) {
      alert(
        `Submitted picks for ${user.username}: ${selectedFighters
          .map((f) => f.name)
          .join(", ")}`
      );
    } else {
      alert(`Please select exactly ${maxPicks} fighters.`);
    }
  };

  const handleRemoveFighter = (fighterId) => {
    setSelectedFighters(selectedFighters.filter((f) => f.id !== fighterId));
  };

  return (
    <div className="container">
      <h1 className="text-4xl font-bold text-center mb-6">
        Low Blow Lottery: Shoot the Moon
      </h1>
      <div className="bg-gray-700 p-4 rounded-lg mb-6">
        <p className="text-sm">
          The Low Blow Lottery is all about fun, not disrespect. We deeply
          admire the hard work, dedication, and courage of every UFC fighter.
          This game celebrates the unpredictable thrill of fight night by
          letting you pick fighters likely to score the lowest fantasy points—no
          judgment on their skill or heart, just a playful twist to keep the
          excitement alive!
        </p>
      </div>
      {!user ? (
        <div className="text-center">
          <p>Please log in to participate.</p>
          <button className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded mt-4">
            Log In
          </button>
        </div>
      ) : (
        <>
          <h2 className="text-2xl font-semibold mb-4">
            Pick Your 6 Lowest-Scoring Fighters
          </h2>
          <div className="grid grid-cols-2 gap-4 mb-6">
            {mockFighters.map((fighter) => (
              <button
                key={fighter.id}
                onClick={() => handleFighterSelect(fighter)}
                disabled={selectedFighters.some((f) => f.id === fighter.id)}
                className={`p-4 rounded ${
                  selectedFighters.some((f) => f.id === fighter.id)
                    ? "bg-gray-600"
                    : "bg-blue-600 hover:bg-blue-700"
                } text-white`}
              >
                {fighter.name} ({fighter.weightClass})
              </button>
            ))}
          </div>
          <h3 className="text-xl font-semibold mb-2">
            Your Picks ({selectedFighters.length}/{maxPicks})
          </h3>
          <ul className="mb-6">
            {selectedFighters.map((fighter) => (
              <li
                key={fighter.id}
                className="flex justify-between items-center p-2 bg-gray-800 rounded mb-2"
              >
                <span>{fighter.name}</span>
                <button
                  onClick={() => handleRemoveFighter(fighter.id)}
                  className="bg-red-600 hover:bg-red-700 text-white py-1 px-2 rounded"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
          <button
            onClick={handleSubmit}
            className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded w-full"
          >
            Submit Your Picks
          </button>
          <h2 className="text-2xl font-semibold mt-8 mb-4">Leaderboard</h2>
          <div className="bg-gray-800 p-4 rounded-lg">
            {leaderboard.length > 0 ? (
              <ul>
                {leaderboard.map((entry) => (
                  <li key={entry.username} className="py-2">
                    Rank {entry.rank}: {entry.username} - {entry.score} points
                  </li>
                ))}
              </ul>
            ) : (
              <p>Leaderboard updates after the event!</p>
            )}
          </div>
          <p className="text-sm mt-4">
            Prizes: Top 3 lowest scores win exclusive site badges or premium
            access. Check back post-event!
          </p>
        </>
      )}
    </div>
  );
}

export default LowBlowLottery;
