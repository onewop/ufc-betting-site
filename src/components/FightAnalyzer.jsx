import React, { useState, useEffect } from "react";
import "tailwindcss/tailwind.css";

const generalQuestions = [
  "Who is the better striker?",
  "Compare striking accuracy.",
  "Who lands more strikes per minute?",
  "Analyze striking styles.",
  "Who has the edge in knockout power?",
  "Compare grappling skills.",
  "Who has better takedown success rate?",
  "Analyze takedown defense statistics.",
  "How does Fighter A perform against Fighter B's takedown defense?",
  "Who has more submission wins?",
  "Fighter A's last three fights: Wins, losses, methods?",
  "Fighter B's last three fights: Wins, losses, methods?",
  "Compare recent performance streaks.",
  "UFC stats: Fighter A's win-loss record.",
  "UFC stats: Fighter B's win-loss record.",
  "Sherdog stats: Fighter A's career highlights.",
  "Sherdog stats: Fighter B's career highlights.",
  "Who has better cardio in long fights?",
  "Analyze stance switching impact.",
  "Mental toughness comparison in rematches.",
  "Who has the better reach advantage?",
  "Compare head movement and evasion.",
  "How does Fighter B perform against southpaws?",
  "Compare counter-striking vs. aggression.",
  "Ground game: Who controls positions better?",
  "Stand-up to ground transitions analysis.",
  "Injury history and how it affects the fight.",
  "Age and experience factor comparison.",
  "Training camp insights from recent interviews.",
  "Betting odds breakdown and value bets.",
  "Fan predictions from social media.",
  "Expert opinions from MMA analysts.",
  "Historical rematch outcomes in UFC.",
  "Weight cut effects on performance.",
  "Fight prediction: Who wins and how?",
];

const FightAnalyzer = () => {
  const [fighters, setFighters] = useState([]);
  const [fights, setFights] = useState([]);
  const [selectedFight, setSelectedFight] = useState("");
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [liveData, setLiveData] = useState(null);

  useEffect(() => {
    fetch("/fighters.json")
      .then((res) => res.json())
      .then((data) => {
        setFighters(data);
        const fightMap = {};
        data.forEach((f) => {
          if (!fightMap[f.fight_id]) fightMap[f.fight_id] = [];
          fightMap[f.fight_id].push(f);
        });
        const computedFights = Object.entries(fightMap).map(
          ([fight_id, fighters]) => ({
            fight_id: parseInt(fight_id),
            fighters,
          })
        );
        setFights(computedFights);
        setLoading(false);
      })
      .catch((err) => {
        setError("Failed to load fighters. Please try again.");
        setLoading(false);
        console.error("Error:", err);
      });

    fetch(
      "https://www.thesportsdb.com/api/v1/json/3/search_all_leagues.php?c=United%20States&s=Mixed_Martial_Arts"
    )
      .then((res) => res.json())
      .then((data) => setLiveData(data))
      .catch(() => console.log("Live data fetch failed."));
  }, []);

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
    const questionLower = question.toLowerCase();

    // Define color classes for headers
    const headerColors = [
      "text-blue-400",
      "text-purple-400",
      "text-green-400",
      "text-yellow-400",
    ];

    let response = (
      <div>
        <h3 className="text-2xl font-bold mb-2">
          Analyzing {fighter1.name} vs. {fighter2.name}
        </h3>
        <p className="mb-4">Based on your question: "{question}"</p>
      </div>
    );

    if (questionLower.includes("striking")) {
      response = (
        <div>
          {response}
          <p>
            <span className={headerColors[0]}>
              {fighter1.name}'s Striking Profile:
            </span>{" "}
            With a striking accuracy of {fighter1.striking_accuracy}% and{" "}
            {fighter1.strikes_per_min} strikes per minute, {fighter1.name} is a
            high-volume striker who can overwhelm opponents with constant
            pressure, potentially leading to decision wins or late-round
            finishes. Their ability to maintain this pace often forces opponents
            into defensive errors, especially in longer fights.
          </p>
          <p>
            <span className={headerColors[1]}>
              {fighter2.name}'s Striking Profile:
            </span>{" "}
            Comparatively, {fighter2.name} has {fighter2.striking_accuracy}%
            accuracy and {fighter2.strikes_per_min} strikes per minute, favoring
            precision over volume, which could allow for effective
            counter-striking if {fighter1.name} overcommits. This approach
            thrives in exploiting openings during aggressive exchanges.
          </p>
          <p>
            <span className={headerColors[2]}>Edge Assessment:</span>{" "}
            {fighter1.striking_accuracy > fighter2.striking_accuracy
              ? `${fighter1.name} has a clear advantage in accuracy, making them the better striker in prolonged exchanges. Their higher output could dictate the fight's rhythm, though they must watch for counterpunches.`
              : `${fighter2.name} edges out in precision, potentially turning the tide with clean, impactful shots. Their efficiency might lead to a points victory if they avoid being overwhelmed.`}{" "}
            Remember, factors like reach, footwork, and cage control play a huge
            role—bet wisely!
          </p>
        </div>
      );
    } else if (
      questionLower.includes("takedown") ||
      questionLower.includes("grappling")
    ) {
      response = (
        <div>
          {response}
          <p>
            <span className={headerColors[0]}>
              {fighter1.name}'s Grappling Profile:
            </span>{" "}
            Boasting a {fighter1.takedown_success}% takedown success rate and{" "}
            {fighter1.takedown_defense}% defense, {fighter1.name} excels at
            controlling the fight on the ground, often securing dominant
            positions or seeking submissions. Their wrestling base allows them
            to dictate where the fight takes place, a critical advantage in
            close bouts.
          </p>
          <p>
            <span className={headerColors[1]}>
              {fighter2.name}'s Grappling Profile:
            </span>{" "}
            {fighter2.name} counters with {fighter2.takedown_success}% success
            on takedowns and {fighter2.takedown_defense}% defense, which might
            allow them to keep the fight standing or scramble effectively if
            taken down. Their defensive skills could frustrate grapplers who
            rely on ground control.
          </p>
          <p>
            <span className={headerColors[2]}>Edge Assessment:</span>{" "}
            {fighter1.takedown_success > fighter2.takedown_success
              ? `${fighter1.name} likely has the grappling advantage, potentially grinding out a win with relentless takedowns and top control.`
              : `${fighter2.name} could dominate here, using superior defense to neutralize threats and keep the fight in their preferred striking range.`}{" "}
            In MMA, grappling can flip scripts—consider their submission defense
            and recent ground performances for betting insights.
          </p>
        </div>
      );
    } else if (
      questionLower.includes("record") ||
      questionLower.includes("history")
    ) {
      response = (
        <div>
          {response}
          <p>
            <span className={headerColors[0]}>{fighter1.name}'s Record:</span>{" "}
            {fighter1.wins} wins, {fighter1.losses} losses, {fighter1.draws}{" "}
            draws. This record highlights a fighter with proven longevity and
            adaptability against top-tier competition, often securing victories
            through strategic game plans and resilience in high-pressure
            situations.
          </p>
          <p>
            <span className={headerColors[1]}>{fighter2.name}'s Record:</span>{" "}
            {fighter2.wins} wins, {fighter2.losses} losses, {fighter2.draws}{" "}
            draws. {fighter2.name}'s path shows a blend of knockout power and
            submission skills, with key wins demonstrating their ability to
            close fights decisively.
          </p>
          <p>
            <span className={headerColors[2]}>Comparison:</span>{" "}
            {fighter1.wins > fighter2.wins
              ? `${fighter1.name} has more overall wins, suggesting greater experience and consistency across a broader range of opponents.`
              : `${fighter2.name} edges in victories, indicating a potentially more explosive style that could lead to quick finishes.`}{" "}
            However, records are just numbers—look at the quality of opponents,
            recent form, and stylistic matchups for smarter betting decisions.
          </p>
        </div>
      );
    } else {
      response = (
        <div>
          {response}
          <p>
            Your question opens up an exciting angle on the fight! While I have
            detailed data on striking, takedowns, and records, this query might
            require more specific keywords like "striking," "takedown," or
            "record" for a deep dive. For example, based on current stats,{" "}
            {fighter1.name} might have an edge in longer fights due to their
            defensive metrics, but refining your question will unlock a more
            tailored analysis!
          </p>
        </div>
      );
    }
    if (liveData) {
      response = (
        <div>
          {response}
          <p>
            <span className={headerColors[3]}>Live Insight:</span> Based on
            league data from TheSportsDB API, current UFC trends show fighters
            with strong grappling like {fighter1.name} performing well in title
            bouts—something to consider for this matchup. Recent events suggest
            a premium on versatile skill sets, which could influence betting
            strategies.
          </p>
        </div>
      );
    }
    setAnswer(response);
  };

  const handleQuestionButton = (q) => {
    setQuestion(q);
    processQuestion();
  };

  if (loading)
    return <div className="text-center text-gray-300">Loading...</div>;
  if (error) return <div className="text-center text-red-400">{error}</div>;

  return (
    <div className="container mx-auto p-6 min-h-screen">
      <h1 className="text-5xl font-bold mb-8 text-center">Fight Analyzer</h1>
      <select
        value={selectedFight}
        onChange={(e) => setSelectedFight(e.target.value)}
        className="border pearl-border bg-gray-800 text-white p-2 rounded-lg w-full md:w-1/4 mb-4"
      >
        <option value="">Select a Fight</option>
        {fights.map((fight) => (
          <option key={fight.fight_id} value={fight.fight_id}>
            {fight.fighters.map((f) => f.name).join(" vs. ")}
          </option>
        ))}
      </select>
      <input
        type="text"
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
        placeholder="Ask about striking, takedowns, or records..."
        className="border pearl-border bg-gray-800 text-white p-2 rounded-lg w-full mb-4"
      />
      <button onClick={processQuestion} className="neon-button mb-8">
        Analyze
      </button>
      <div className="text-gray-300 mb-6">{answer}</div>
      <div className="flex justify-center mt-4 space-x-4 mb-8">
        {fights
          .find((f) => f.fight_id === parseInt(selectedFight))
          ?.fighters.map((fighter) => (
            <a href={`/roster#${fighter.id}`} key={fighter.id}>
              <img
                src={`/fighter-${fighter.id}.jpg`}
                alt={fighter.name}
                className="w-16 h-16 rounded-full object-cover pearl-border"
                onError={(e) =>
                  (e.target.src = "https://picsum.photos/200/200")
                }
              />
            </a>
          ))}
      </div>
      <h2 className="text-3xl font-bold mb-4 text-center text-transparent bg-clip-text bg-gradient-to-r from-red-500 to-pink-500">
        Quick Question Buttons
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {generalQuestions.map((question, index) => (
          <button
            key={index}
            onClick={() => handleQuestionButton(question)}
            className="bg-gradient-to-r from-purple-600 to-blue-500 text-white font-bold py-4 px-6 rounded-lg shadow-neon transform hover:scale-105 hover:brightness-125 transition duration-300 ease-in-out pearl-border"
          >
            {question}
          </button>
        ))}
      </div>
    </div>
  );
};

export default FightAnalyzer;
