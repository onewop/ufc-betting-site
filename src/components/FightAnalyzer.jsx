import React, { useState, useEffect } from "react";
import "tailwindcss/tailwind.css";

const FightAnalyzer = () => {
  const [fighters, setFighters] = useState([]);
  const [selectedFight, setSelectedFight] = useState("");
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");

  useEffect(() => {
    fetch("/fighters.json")
      .then((res) => res.json())
      .then((data) => setFighters(data))
      .catch((err) => console.error("Error fetching fighters:", err));
  }, []);

  const fights = Array.from(
    new Map(
      fighters.map((f) => [
        f.fight_id,
        {
          fight_id: f.fight_id,
          fighters: fighters
            .filter((fighter) => fighter.fight_id === f.fight_id)
            .map((fighter) => fighter.name),
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
    const fighter1Data = fighters.find((f) => f.name === fighter1);
    const fighter2Data = fighters.find((f) => f.name === fighter2);
    const questionLower = question.toLowerCase();

    let response = `Analyzing ${fighter1} vs. ${fighter2}...\n\n`;

    if (questionLower.includes("striking")) {
      response += `${fighter1} has a striking accuracy of ${
        fighter1Data.striking_accuracy || "N/A"
      }% and lands ${
        fighter1Data.strikes_per_min || "N/A"
      } significant strikes per minute.\n`;
      response += `${fighter2} has a striking accuracy of ${
        fighter2Data.striking_accuracy || "N/A"
      }% and lands ${
        fighter2Data.strikes_per_min || "N/A"
      } significant strikes per minute.\n`;
      response +=
        fighter1Data.striking_accuracy > fighter2Data.striking_accuracy
          ? `${fighter1} has the edge in striking accuracy.`
          : `${fighter2} has the edge in striking accuracy.`;
    } else if (
      questionLower.includes("takedown") ||
      questionLower.includes("grappling")
    ) {
      response += `${fighter1} has a takedown success rate of ${
        fighter1Data.takedown_success || "N/A"
      }% and defends ${
        fighter1Data.takedown_defense || "N/A"
      }% of takedowns.\n`;
      response += `${fighter2} has a takedown success rate of ${
        fighter2Data.takedown_success || "N/A"
      }% and defends ${
        fighter2Data.takedown_defense || "N/A"
      }% of takedowns.\n`;
      response +=
        fighter1Data.takedown_success > fighter2Data.takedown_success
          ? `${fighter1} has the edge in takedowns.`
          : `${fighter2} has the edge in takedowns.`;
    } else if (
      questionLower.includes("record") ||
      questionLower.includes("history")
    ) {
      response += `${fighter1} has a record of ${fighter1Data.wins || "N/A"}-${
        fighter1Data.losses || "N/A"
      }-${fighter1Data.draws || "N/A"}.\n`;
      response += `${fighter2} has a record of ${fighter2Data.wins || "N/A"}-${
        fighter2Data.losses || "N/A"
      }-${fighter2Data.draws || "N/A"}.\n`;
      response +=
        fighter1Data.wins > fighter2Data.wins
          ? `${fighter1} has more wins overall.`
          : `${fighter2} has more wins overall.`;
    } else {
      response +=
        'I can analyze striking, takedowns, or fight records. Please include keywords like "striking," "takedown," or "record" in your question!';
    }

    setAnswer(response);
  };

  return (
    <div className="container mx-auto p-6 min-h-screen">
      <h1 className="text-5xl font-bold mb-8 text-center">
        UFC Fight Analyzer
      </h1>
      <p className="text-red-400 mb-6 text-center">
        <strong>Warning:</strong> For entertainment only. DFS is 21+. Call
        1-800-GAMBLER for help. [YourSite] not liable for losses. Answers are
        based on available stats.
      </p>
      <p className="text-gray-300 mb-6 text-center">
        Get your{" "}
        <a href="/shop-tattoos" className="text-green-400 hover:text-green-300">
          Chrona Sparkle tramp stamp
        </a>{" "}
        for UFC 319 flair!
      </p>
      <div className="card p-6 mb-6">
        <label className="block text-lg text-gray-300 mb-2">
          Select Fight:
        </label>
        <select
          value={selectedFight}
          onChange={(e) => setSelectedFight(e.target.value)}
          className="border border-gray-700 bg-gray-800 text-white p-2 rounded-lg w-full md:w-1/2"
        >
          <option value="">Select a fight...</option>
          {fights.map((fight) => (
            <option key={fight.fight_id} value={fight.fight_id}>
              {fight.fighters.join(" vs. ")}
            </option>
          ))}
        </select>
      </div>
      <div className="card p-6 mb-6">
        <label className="block text-lg text-gray-300 mb-2">
          Ask a Question:
        </label>
        <textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="E.g., Who has better striking stats?"
          className="border border-gray-700 bg-gray-800 text-white p-2 rounded-lg w-full h-32"
        />
      </div>
      <div className="flex justify-center mb-6">
        <button onClick={processQuestion} className="neon-button">
          Get Answer
        </button>
      </div>
      {answer && (
        <div className="card p-6">
          <h2 className="text-2xl font-semibold mb-4">AI Response</h2>
          <p className="text-gray-300 whitespace-pre-line">{answer}</p>
        </div>
      )}
    </div>
  );
};

export default FightAnalyzer;
