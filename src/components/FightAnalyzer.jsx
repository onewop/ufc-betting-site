import React, { useState, useEffect } from "react";
import "tailwindcss/tailwind.css";

const FightAnalyzer = () => {
  const [fighters, setFighters] = useState([]);
  const [selectedFight, setSelectedFight] = useState("");
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch("/fighters.json")
      .then((res) => res.json())
      .then((data) => {
        setFighters(data);
        setLoading(false);
      })
      .catch((err) => {
        setError("Failed to load fighters. Please try again.");
        setLoading(false);
        console.error("Error:", err);
      });
  }, []);

  const fights = Array.from(
    new Map(
      fighters.map((f) => [
        f.fight_id,
        {
          fight_id: f.fight_id,
          fighters: fighters
            .filter((fighter) => fighter.fight_id === f.fight_id)
            .map((fighter) => ({ name: fighter.name, id: fighter.id })),
        },
      ])
    ).values()
  );

  const processQuestion = () => {
    if (!selectedFight || !question) {
      setAnswer("Please select a fight and enter a question.");
      return;
    }
    const fight = fights.find((f) => f.fight_id === parseInt(selectedFight));
    if (!fight) {
      setAnswer("Fight not found.");
      return;
    }
    const [fighter1, fighter2] = fight.fighters;
    const fighter1Data = fighters.find((f) => f.name === fighter1.name);
    const fighter2Data = fighters.find((f) => f.name === fighter2.name);
    const questionLower = question.toLowerCase();

    let response = `Analyzing ${fighter1.name} vs. ${fighter2.name}...\n\n`;
    if (questionLower.includes("striking")) {
      response += `${fighter1.name} has a striking accuracy of ${fighter1Data.striking_accuracy}% and lands ${fighter1Data.strikes_per_min} strikes/min.\n`;
      response += `${fighter2.name} has a striking accuracy of ${fighter2Data.striking_accuracy}% and lands ${fighter2Data.strikes_per_min} strikes/min.\n`;
      response +=
        fighter1Data.striking_accuracy > fighter2Data.striking_accuracy
          ? `${fighter1.name} has the edge in striking accuracy.`
          : `${fighter2.name} has the edge in striking accuracy.`;
    } else if (
      questionLower.includes("takedown") ||
      questionLower.includes("grappling")
    ) {
      response += `${fighter1.name} has a takedown success rate of ${fighter1Data.takedown_success}% and defends ${fighter1Data.takedown_defense}%.\n`;
      response += `${fighter2.name} has a takedown success rate of ${fighter2Data.takedown_success}% and defends ${fighter2Data.takedown_defense}%.\n`;
      response +=
        fighter1Data.takedown_success > fighter2Data.takedown_success
          ? `${fighter1.name} has the edge in takedowns.`
          : `${fighter2.name} has the edge in takedowns.`;
    } else if (
      questionLower.includes("record") ||
      questionLower.includes("history")
    ) {
      response += `${fighter1.name} has a record of ${fighter1Data.wins}-${fighter1Data.losses}-${fighter1Data.draws}.\n`;
      response += `${fighter2.name} has a record of ${fighter2Data.wins}-${fighter2Data.losses}-${fighter2Data.draws}.\n`;
      response +=
        fighter1Data.wins > fighter2Data.wins
          ? `${fighter1.name} has more wins overall.`
          : `${fighter2.name} has more wins overall.`;
    } else {
      response +=
        'I can analyze striking, takedowns, or fight records. Try keywords like "striking," "takedown," or "record"!';
    }
    setAnswer(response);
  };

  if (loading)
    return <div className="text-center text-gray-300">Loading...</div>;
  if (error) return <div className="text-center text-red-400">{error}</div>;

  return (
    <div className="container mx-auto p-6 min-h-screen">
      <h1 className="text-5xl font-bold mb-8 text-center">
        UFC Fight Analyzer
      </h1>
      <p className="text-red-400 mb-6 text-center">
        <strong>Warning:</strong> For entertainment only. DFS is 21+. Call
        1-800-GAMBLER for help. [YourSite] not liable for losses.
      </p>
      <p className="text-gray-300 mb-6 text-center">
        Get your{" "}
        <a href="/shop-tattoos" className="text-green-400 hover:text-green-300">
          Chrona Sparkle tramp stamp
        </a>{" "}
        for UFC 319 flair!
      </p>
      <div className="card mb-6">
        <label className="block text-lg text-gray-300 mb-2">
          Select Fight:
        </label>
        <select
          value={selectedFight}
          onChange={(e) => setSelectedFight(e.target.value)}
          className="border pearl-border bg-gray-800 text-white p-2 rounded-lg w-full md:w-1/2"
        >
          <option value="">Select a fight...</option>
          {fights.map((fight) => (
            <option key={fight.fight_id} value={fight.fight_id}>
              {fight.fighters.map((f) => f.name).join(" vs. ")}
            </option>
          ))}
        </select>
        {selectedFight && (
          <div className="flex justify-center mt-4 space-x-4">
            {fights
              .find((f) => f.fight_id === parseInt(selectedFight))
              ?.fighters.map((fighter) => (
                <img
                  key={fighter.id}
                  src={`/fighter-${fighter.id}.jpg`}
                  alt={fighter.name}
                  className="w-16 h-16 rounded-full object-cover pearl-border"
                  onError={(e) =>
                    (e.target.src = "https://picsum.photos/200/200")
                  }
                />
              ))}
          </div>
        )}
      </div>
      <div className="card mb-6">
        <label className="block text-lg text-gray-300 mb-2">
          Ask a Question:
        </label>
        <textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="E.g., Who has better striking stats?"
          className="border pearl-border bg-gray-800 text-white p-2 rounded-lg w-full h-32"
        />
      </div>
      <div className="flex justify-center mb-6">
        <button onClick={processQuestion} className="neon-button">
          Get Answer
        </button>
      </div>
      {answer && (
        <div className="card">
          <h2 className="text-2xl font-semibold mb-4">AI Response</h2>
          <p className="text-gray-300 whitespace-pre-line">{answer}</p>
        </div>
      )}
    </div>
  );
};

export default FightAnalyzer;
