import { useState, useEffect } from "react";
import "tailwindcss/tailwind.css"; // or your correct Tailwind import path

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
  "What is Fighter A's DK Salary?",
  "What is Fighter A's Average Points Per Game?",
];

const FightAnalyzer = ({ eventTitle = "Latest UFC Event" }) => {
  const [fighters, setFighters] = useState([]);
  const [fights, setFights] = useState([]);
  const [selectedFight, setSelectedFight] = useState("");
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [liveData, setLiveData] = useState(null);
  const [showOdds, setShowOdds] = useState(false);
  const [cachedOdds, setCachedOdds] = useState([]);
  const [expandedStats, setExpandedStats] = useState(false);
  const [activeTab, setActiveTab] = useState("basics");

  useEffect(() => {
    console.log("🔍 Starting fetch for /this_weeks_stats.json");
    setError(null); // Clear previous errors

    console.log("📡 Initiating fetch with cache: no-store");
    fetch("/this_weeks_stats.json", {
      cache: "no-store", // Bypass cache
      headers: {
        Accept: "application/json",
      },
    })
      .then((res) => {
        console.log("📊 Response received:", {
          status: res.status,
          ok: res.ok,
          statusText: res.statusText,
          contentType: res.headers.get("Content-Type"),
        });

        if (!res.ok) {
          throw new Error(
            `HTTP error! Status: ${res.status} ${res.statusText}`,
          );
        }

        return res.text(); // Get raw text first to debug
      })
      .then((text) => {
        console.log(
          "📄 Raw response (first 500 chars):",
          text.substring(0, 500),
        );
        console.log("   Total response length:", text.length, "bytes");

        try {
          const data = JSON.parse(text);
          console.log("✅ JSON.parse succeeded!");
          console.log("   Data structure keys:", Object.keys(data));
          console.log(
            "   Fights array length:",
            data.fights?.length || "missing",
          );
          console.log("   Full parsed data:", data);
          if (data.fights && data.fights.length > 0) {
            console.log("   First fight:", data.fights[0]);
            console.log(
              "   First fighter stats:",
              data.fights[0].fighters?.[0]?.stats,
            );
          }

          // Use data.fights (correct structure from JSON)
          const rawFights = data.fights || [];

          // Add fight_id to each fight and map fighter data
          const processedFights = rawFights.map((fight, index) => ({
            fight_id: index,
            matchup: fight.matchup,
            weight_class: fight.weight_class,
            fighters: (fight.fighters || []).map((f) => ({
              // Spread all fields from JSON first so nothing is lost
              ...f,
              // Normalise the id field used for display/lookup
              id: f.dk_id || f.id || index,
              salary: f.salary,
              avgPointsPerGame: f.avgPointsPerGame || 0,
              // Record — use real values from JSON, never override with 0
              wins: f.wins ?? 0,
              losses: f.losses ?? 0,
              draws: f.draws ?? 0,
              record:
                f.record ||
                (f.wins != null ? `${f.wins}-${f.losses}-${f.draws}` : "N/A"),
              // Physical
              nickname: f.nickname || null,
              height: f.height || "N/A",
              reach: f.reach || "N/A",
              stance: f.stance || "N/A",
              // Career milestones — populated by ufc-master.csv enrichment
              current_win_streak: f.current_win_streak ?? "N/A",
              current_loss_streak: f.current_loss_streak ?? "N/A",
              wins_ko_tko: f.wins_ko_tko ?? "N/A",
              wins_submission: f.wins_submission ?? "N/A",
              wins_decision: f.wins_decision ?? "N/A",
              finish_rate_pct: f.finish_rate_pct ?? "N/A",
              decision_rate_pct: f.decision_rate_pct ?? "N/A",
              // Stats object — keep nested for getValue("stats.slpm") dot-path
              stats: {
                slpm: f.stats?.slpm ?? 0,
                sapm: f.stats?.sapm ?? 0,
                striking_accuracy: f.stats?.striking_accuracy ?? 0,
                striking_defense: f.stats?.striking_defense ?? "N/A",
                td_avg: f.stats?.td_avg ?? 0,
                td_accuracy: f.stats?.td_accuracy ?? 0,
                td_defense: f.stats?.td_defense ?? "N/A",
              },
              // Flat aliases used by processQuestion helpers
              striking_accuracy: f.stats?.striking_accuracy ?? 0,
              takedown_accuracy: f.stats?.td_accuracy ?? 0,
            })),
          }));

          console.log("🥊 Processed fights (with fight_id):", processedFights);

          setFights(processedFights);

          // Flatten fighters for setFighters if needed
          const allFighters = processedFights.flatMap(
            (fight) => fight.fighters || [],
          );
          setFighters(allFighters);
          console.log("👥 All fighters flattened:", allFighters);

          setLoading(false);
          console.log("✨ Fetch complete - loading set to false");
        } catch (parseErr) {
          console.error("❌ JSON.parse failed!");
          console.error("   Error message:", parseErr.message);
          console.error("   Error stack:", parseErr.stack);
          throw new Error("Invalid JSON format: " + parseErr.message);
        }
      })
      .catch((err) => {
        console.error("💥 Fetch error:", err.message);
        console.error("   Full error object:", err);
        setError("Failed to load fighters: " + err.message);
        setLoading(false);
      });

    // Load live odds from localStorage cache (populated by LatestOdds page)
    try {
      const cached = JSON.parse(localStorage.getItem("ufc_odds_cache_v2"));
      if (cached?.data) setCachedOdds(cached.data);
    } catch (_) {}

    // Separate fetch for live data
    fetch(
      "https://www.thesportsdb.com/api/v1/json/3/search_all_leagues.php?c=United%20States&s=Mixed_Martial_Arts",
    )
      .then((res) => res.json())
      .then((data) => setLiveData(data))
      .catch(() => console.log("Live data fetch failed."));
  }, []);

  const processQuestion = (questionOverride) => {
    const activeQuestion = questionOverride ?? question;
    if (!selectedFight || !activeQuestion) {
      setAnswer("Please select a fight and enter a question.");
      return;
    }

    const fight = fights.find((f) => f.fight_id === parseInt(selectedFight));
    if (!fight) {
      setAnswer("Fight not found.");
      return;
    }

    const [fighter1, fighter2] = fight.fighters;
    const questionLower = activeQuestion.toLowerCase();

    // Debug log: show actual stats structure
    console.log("Using stats for", fighter1.name, ":", fighter1.stats);
    console.log("Using stats for", fighter2.name, ":", fighter2.stats);

    // Helper functions to safely get stats with correct JSON keys
    const getStrikesPerMin = (fighter) => {
      const val = fighter?.stats?.slpm;
      return val !== undefined && val !== null ? val : 0;
    };

    const getStrikingAccuracy = (fighter) => {
      // Try sapm (strikes attempted per minute) or striking_accuracy, fallback to 0
      if (
        fighter?.stats?.striking_accuracy !== undefined &&
        fighter?.stats?.striking_accuracy !== null
      ) {
        return fighter.stats.striking_accuracy;
      }
      if (fighter?.stats?.sapm !== undefined && fighter?.stats?.sapm !== null) {
        return fighter.stats.sapm;
      }
      return 0;
    };

    const getTakedownAvg = (fighter) => {
      const val = fighter?.stats?.td_avg;
      return val !== undefined && val !== null ? val : 0;
    };

    const getTakedownDefense = (fighter) => {
      const defense = fighter?.stats?.td_defense;
      if (defense === undefined || defense === null) {
        return "N/A";
      }
      return defense === "N/A" ? "N/A" : defense;
    };

    const getRecordStat = (fighter, stat) => {
      const val = fighter?.[stat];
      return val !== undefined && val !== null ? val : 0;
    };

    // Extract stats for both fighters using correct JSON keys
    const f1StrikesPerMin = getStrikesPerMin(fighter1);
    const f1Accuracy = getStrikingAccuracy(fighter1);
    const f1TakedownAvg = getTakedownAvg(fighter1);
    const f1TakedownDef = getTakedownDefense(fighter1);

    const f2StrikesPerMin = getStrikesPerMin(fighter2);
    const f2Accuracy = getStrikingAccuracy(fighter2);
    const f2TakedownAvg = getTakedownAvg(fighter2);
    const f2TakedownDef = getTakedownDefense(fighter2);

    // Debug: log extracted stats
    console.log(
      `${fighter1.name} - Strikes/min: ${f1StrikesPerMin}, Accuracy: ${f1Accuracy}, TD Avg: ${f1TakedownAvg}, TD Def: ${f1TakedownDef}`,
    );
    console.log(
      `${fighter2.name} - Strikes/min: ${f2StrikesPerMin}, Accuracy: ${f2Accuracy}, TD Avg: ${f2TakedownAvg}, TD Def: ${f2TakedownDef}`,
    );

    // Define color classes for headers
    const headerColors = [
      "text-blue-400",
      "text-purple-400",
      "text-green-400",
      "text-yellow-400",
    ];

    // Wrap all response-building in try/catch so a bad stat value never silently crashes
    let response;
    try {
      response = (
        <div>
          <h3 className="text-2xl font-bold mb-2">
            Analyzing {fighter1.name} vs. {fighter2.name}
          </h3>
          <p className="mb-4">Based on your question: "{activeQuestion}"</p>
        </div>
      );

      // Salary query
      if (questionLower.includes("dk salary")) {
        console.log("Using stats for", fighter1.name, ":", fighter1);
        console.log("Using stats for", fighter2.name, ":", fighter2);
        response = (
          <div>
            {response}
            <p>
              <span className={headerColors[0]}>
                {fighter1.name}'s DK Salary:
              </span>{" "}
              ${fighter1.salary}
            </p>
            <p>
              <span className={headerColors[1]}>
                {fighter2.name}'s DK Salary:
              </span>{" "}
              ${fighter2.salary}
            </p>
            <p>
              <span className={headerColors[2]}>Edge Assessment:</span>{" "}
              {fighter1.salary > fighter2.salary
                ? `${fighter1.name} has the higher salary, which might indicate a stronger expected performance.`
                : fighter2.salary > fighter1.salary
                  ? `${fighter2.name} boasts the higher salary.`
                  : "Both fighters have the same salary."}
            </p>
          </div>
        );
      } else if (
        questionLower.includes("average points") ||
        questionLower.includes("avg points")
      ) {
        console.log("Using stats for", fighter1.name, ":", fighter1);
        console.log("Using stats for", fighter2.name, ":", fighter2);
        const f1avg = fighter1.avgPointsPerGame ?? "N/A";
        const f2avg = fighter2.avgPointsPerGame ?? "N/A";
        console.log(
          "f1avg:",
          f1avg,
          "fighter1.avgPointsPerGame:",
          fighter1.avgPointsPerGame,
        );
        console.log(
          "f2avg:",
          f2avg,
          "fighter2.avgPointsPerGame:",
          fighter2.avgPointsPerGame,
        );
        response = (
          <div>
            {response}
            <p>
              <span className={headerColors[0]}>
                {fighter1.name}'s Avg Points:
              </span>{" "}
              {f1avg}
            </p>
            <p>
              <span className={headerColors[1]}>
                {fighter2.name}'s Avg Points:
              </span>{" "}
              {f2avg}
            </p>
            <p>
              <span className={headerColors[2]}>Comparison:</span>{" "}
              {typeof f1avg === "number" && typeof f2avg === "number"
                ? f1avg > f2avg
                  ? `${fighter1.name} has a higher average.`
                  : f2avg > f1avg
                    ? `${fighter2.name} has a higher average.`
                    : "Both fighters have the same average."
                : "Average points data not available for comparison."}
            </p>
          </div>
        );
      } else if (questionLower.includes("striking")) {
        console.log("Using stats for " + fighter1.name + ":", fighter1.stats);
        console.log("Using stats for " + fighter2.name + ":", fighter2.stats);
        console.log("💥 Striking analysis requested");
        console.log(
          `  ${fighter1.name}: slpm=${f1StrikesPerMin}, accuracy=${f1Accuracy}`,
        );
        console.log(
          `  ${fighter2.name}: slpm=${f2StrikesPerMin}, accuracy=${f2Accuracy}`,
        );
        const strikingDataMissing =
          (!f1StrikesPerMin && f1StrikesPerMin !== 0) ||
          (!f2StrikesPerMin && f2StrikesPerMin !== 0);
        if (strikingDataMissing) {
          response = (
            <div>
              {response}
              <p className="text-yellow-400 italic">
                ⚠️ Limited stats available — striking comparison based on known
                data (record, SLpM, TD avg, etc.).
              </p>
            </div>
          );
        } else
          response = (
            <div>
              {response}
              <p>
                <span className={headerColors[0]}>
                  {fighter1.name}'s Striking Profile:
                </span>{" "}
                With a striking accuracy of {f1Accuracy}% and {f1StrikesPerMin}{" "}
                strikes per minute, {fighter1.name} is a high-volume striker who
                can overwhelm opponents with constant pressure, potentially
                leading to decision wins or late-round finishes. Their ability
                to maintain this pace often forces opponents into defensive
                errors, especially in longer fights.
              </p>
              <p>
                <span className={headerColors[1]}>
                  {fighter2.name}'s Striking Profile:
                </span>{" "}
                Comparatively, {fighter2.name} has {f2Accuracy}% accuracy and{" "}
                {f2StrikesPerMin} strikes per minute, favoring precision over
                volume, which could allow for effective counter-striking if{" "}
                {fighter1.name} overcommits. This approach thrives in exploiting
                openings during aggressive exchanges.
              </p>
              <p>
                <span className={headerColors[2]}>Edge Assessment:</span>{" "}
                {f1Accuracy &&
                f2Accuracy &&
                typeof f1Accuracy === "number" &&
                typeof f2Accuracy === "number" &&
                f1Accuracy > f2Accuracy
                  ? `${fighter1.name} has a clear advantage in accuracy, making them the better striker in prolonged exchanges. Their higher output could dictate the fight's rhythm, though they must watch for counterpunches.`
                  : f1Accuracy &&
                      f2Accuracy &&
                      typeof f1Accuracy === "number" &&
                      typeof f2Accuracy === "number"
                    ? `${fighter2.name} edges out in precision, potentially turning the tide with clean, impactful shots. Their efficiency might lead to a points victory if they avoid being overwhelmed.`
                    : "Both fighters have solid striking profiles. The advantage may come down to technique and fight pace."}{" "}
                Remember, factors like reach, footwork, and cage control play a
                huge role—bet wisely!
              </p>
            </div>
          );
      } else if (
        questionLower.includes("takedown") ||
        questionLower.includes("grappling")
      ) {
        console.log("Using stats for " + fighter1.name + ":", fighter1.stats);
        console.log("Using stats for " + fighter2.name + ":", fighter2.stats);
        console.log("🤼 Grappling analysis requested");
        console.log(
          `  ${fighter1.name}: td_avg=${f1TakedownAvg}, td_defense=${f1TakedownDef}`,
        );
        console.log(
          `  ${fighter2.name}: td_avg=${f2TakedownAvg}, td_defense=${f2TakedownDef}`,
        );
        const grapplingDataMissing =
          (!f1TakedownAvg && f1TakedownAvg !== 0) ||
          (!f2TakedownAvg && f2TakedownAvg !== 0);
        if (grapplingDataMissing) {
          response = (
            <div>
              {response}
              <p className="text-yellow-400 italic">
                ⚠️ Limited stats available — grappling comparison based on known
                data (record, TD avg, TD defense).
              </p>
            </div>
          );
        } else
          response = (
            <div>
              {response}
              <p>
                <span className={headerColors[0]}>
                  {fighter1.name}'s Grappling Profile:
                </span>{" "}
                Boasting a {f1TakedownAvg}% takedown success rate and{" "}
                {f1TakedownDef}% defense, {fighter1.name} excels at controlling
                the fight on the ground, often securing dominant positions or
                seeking submissions. Their wrestling base allows them to dictate
                where the fight takes place, a critical advantage in close
                bouts.
              </p>
              <p>
                <span className={headerColors[1]}>
                  {fighter2.name}'s Grappling Profile:
                </span>{" "}
                {fighter2.name} counters with {f2TakedownAvg}% success on
                takedowns and {f2TakedownDef}% defense, which might allow them
                to keep the fight standing or scramble effectively if taken
                down. Their defensive skills could frustrate grapplers who rely
                on ground control.
              </p>
              <p>
                <span className={headerColors[2]}>Edge Assessment:</span>{" "}
                {f1TakedownAvg &&
                f2TakedownAvg &&
                typeof f1TakedownAvg === "number" &&
                typeof f2TakedownAvg === "number" &&
                f1TakedownAvg > f2TakedownAvg
                  ? `${fighter1.name} likely has the grappling advantage, potentially grinding out a win with relentless takedowns and top control.`
                  : f1TakedownAvg &&
                      f2TakedownAvg &&
                      typeof f1TakedownAvg === "number" &&
                      typeof f2TakedownAvg === "number"
                    ? `${fighter2.name} could dominate here, using superior defense to neutralize threats and keep the fight in their preferred striking range.`
                    : "Both fighters have notable grappling skills. Execution will be key."}{" "}
                In MMA, grappling can flip scripts—consider their submission
                defense and recent ground performances for betting insights.
              </p>
            </div>
          );
      } else if (
        questionLower.includes("record") ||
        questionLower.includes("history")
      ) {
        console.log("Using stats for " + fighter1.name + ":", fighter1.stats);
        console.log("Using stats for " + fighter2.name + ":", fighter2.stats);
        console.log("📊 Record analysis requested");
        const f1Wins = getRecordStat(fighter1, "wins");
        const f1Losses = getRecordStat(fighter1, "losses");
        const f1Draws = getRecordStat(fighter1, "draws");
        const f2Wins = getRecordStat(fighter2, "wins");
        const f2Losses = getRecordStat(fighter2, "losses");
        const f2Draws = getRecordStat(fighter2, "draws");
        console.log(`  ${fighter1.name}: ${f1Wins}W-${f1Losses}L-${f1Draws}D`);
        console.log(`  ${fighter2.name}: ${f2Wins}W-${f2Losses}L-${f2Draws}D`);

        response = (
          <div>
            {response}
            <p>
              <span className={headerColors[0]}>{fighter1.name}'s Record:</span>{" "}
              {f1Wins} wins, {f1Losses} losses, {f1Draws} draws. This record
              highlights a fighter with proven longevity and adaptability
              against top-tier competition, often securing victories through
              strategic game plans and resilience in high-pressure situations.
            </p>
            <p>
              <span className={headerColors[1]}>{fighter2.name}'s Record:</span>{" "}
              {f2Wins} wins, {f2Losses} losses, {f2Draws} draws. {fighter2.name}
              's path shows a blend of knockout power and submission skills,
              with key wins demonstrating their ability to close fights
              decisively.
            </p>
            <p>
              <span className={headerColors[2]}>Comparison:</span>{" "}
              {f1Wins > f2Wins
                ? `${fighter1.name} has more overall wins, suggesting greater experience and consistency across a broader range of opponents.`
                : `${fighter2.name} edges in victories, indicating a potentially more explosive style that could lead to quick finishes.`}{" "}
              However, records are just numbers—look at the quality of
              opponents, recent form, and stylistic matchups for smarter betting
              decisions.
            </p>
          </div>
        );
      } else {
        response = (
          <div>
            {response}
            <p>
              Your question opens up an exciting angle on the fight! While I
              have detailed data on striking, takedowns, and records, this query
              might require more specific keywords like "striking," "takedown,"
              or "record" for a deep dive. For example, based on current stats,{" "}
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
              with strong grappling like {fighter1.name} performing well in
              title bouts—something to consider for this matchup. Recent events
              suggest a premium on versatile skill sets, which could influence
              betting strategies.
            </p>
          </div>
        );
      }

      setAnswer(response);
    } catch (err) {
      console.error("[FightAnalyzer] Error generating answer:", err);
      setAnswer(
        <p className="text-red-400">
          ⚠️ Error generating answer — try again or check that fighter stats are
          loaded.
        </p>,
      );
    }
  };

  const handleQuestionButton = (q) => {
    setQuestion(q);
    // Pass `q` directly — React state updates are async, so the `question`
    // state variable would still hold the old value if we called processQuestion()
    // without an argument here.
    processQuestion(q);
  };

  if (loading)
    return (
      <div
        className="min-h-screen bg-stone-950 flex items-center justify-center"
        style={{ fontFamily: "'Courier New', monospace" }}
      >
        <p className="text-stone-500 tracking-widest animate-pulse uppercase text-sm">
          Loading Intel…
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
          ⚡ CLASSIFIED INTEL
        </span>
        <span className="text-yellow-500/50 text-xs tracking-wider hidden sm:block">
          CLEARANCE: LEVEL 5
        </span>
        <span className="text-yellow-500 text-xs font-bold tracking-widest uppercase">
          FIGHT ANALYSIS ⚡
        </span>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-10">
        {/* Page header */}
        <div className="text-center mb-10">
          <p className="text-xs text-stone-500 tracking-[0.5em] uppercase mb-2">
            ◆ OPERATION COMBAT VAULT — FIGHT DIVISION ◆
          </p>
          <h1
            className="text-4xl md:text-5xl font-black text-stone-100 tracking-wider uppercase"
            style={{
              fontFamily: "'Impact', sans-serif",
              textShadow: "2px 2px 0 #4a5240, 0 0 40px rgba(100,120,80,0.3)",
            }}
          >
            FIGHT <span className="text-yellow-600">ANALYZER</span>
          </h1>
          <p className="text-stone-400 mt-2 text-sm tracking-wide">
            {eventTitle}
          </p>
          <div className="w-32 h-px bg-gradient-to-r from-transparent via-yellow-700 to-transparent mx-auto mt-3" />
        </div>

        <select
          value={selectedFight}
          onChange={(e) => setSelectedFight(e.target.value)}
          className="border border-yellow-700/40 bg-stone-900 text-stone-100 p-2 rounded-lg w-full md:w-1/4 mb-4"
        >
          <option value="">Select a Fight</option>
          {fights.map((fight) => (
            <option key={fight.fight_id} value={fight.fight_id}>
              {fight.fighters.map((f) => f.name).join(" vs. ")}
            </option>
          ))}
        </select>

        {/* Live odds strip from cached API data */}
        {selectedFight &&
          (() => {
            const fight = fights.find(
              (f) => f.fight_id === parseInt(selectedFight),
            );
            if (!fight || fight.fighters.length < 2) return null;
            const [f1, f2] = fight.fighters;

            // Fuzzy-match by last name
            const lastName = (name) =>
              name.trim().split(" ").pop().toLowerCase();
            const matchEvent = cachedOdds.find((ev) => {
              const names = [ev.home_team, ev.away_team].map((n) =>
                lastName(n),
              );
              return (
                names.includes(lastName(f1.name)) ||
                names.includes(lastName(f2.name))
              );
            });

            const fmt = (p) => (p == null ? "N/A" : p > 0 ? `+${p}` : `${p}`);
            const impliedProb = (p) => {
              if (p == null) return null;
              return p < 0
                ? ((-p / (-p + 100)) * 100).toFixed(0)
                : ((100 / (p + 100)) * 100).toFixed(0);
            };
            const bestOddsFor = (bookmakers, name) => {
              let best = null;
              const last = lastName(name);
              bookmakers.forEach((bm) => {
                const h2h = bm.markets.find((m) => m.key === "h2h");
                if (!h2h) return;
                const outcome = h2h.outcomes.find(
                  (o) => lastName(o.name) === last,
                );
                if (outcome && (best === null || outcome.price > best))
                  best = outcome.price;
              });
              return best;
            };

            if (!matchEvent) {
              return (
                <div className="mb-4 px-3 py-2 bg-stone-900 border border-stone-700 rounded text-stone-500 text-xs">
                  Live odds not in cache yet — visit{" "}
                  <span className="text-yellow-500">Live Odds</span> page to
                  load them.
                </div>
              );
            }

            const o1 = bestOddsFor(matchEvent.bookmakers, f1.name);
            const o2 = bestOddsFor(matchEvent.bookmakers, f2.name);
            const f1Fav = o1 != null && o2 != null && o1 < o2;
            const f2Fav = o1 != null && o2 != null && o2 < o1;

            return (
              <div className="mb-5 border border-yellow-700/40 rounded-lg overflow-hidden bg-stone-900">
                <div className="flex items-center justify-between px-3 py-1.5 border-b border-yellow-700/20 bg-yellow-900/10">
                  <span className="text-yellow-500 text-xs font-bold tracking-widest uppercase">
                    ⚡ Live Odds
                  </span>
                  <span className="text-stone-500 text-xs">
                    {matchEvent.bookmakers.length} books · best available
                  </span>
                </div>
                <div className="grid grid-cols-[1fr_auto_1fr] items-center px-4 py-3 gap-2">
                  {/* Fighter 1 */}
                  <div>
                    <div className="text-stone-100 text-sm font-semibold">
                      {f1.name}
                    </div>
                    <div className="flex items-baseline gap-1.5 mt-0.5">
                      <span
                        className={`text-xl font-black ${f1Fav ? "text-red-400" : "text-green-400"}`}
                      >
                        {fmt(o1)}
                      </span>
                      {o1 != null && (
                        <span className="text-stone-500 text-xs">
                          {impliedProb(o1)}%
                        </span>
                      )}
                      {f1Fav && (
                        <span className="text-xs text-red-500/70 uppercase">
                          FAV
                        </span>
                      )}
                      {!f1Fav && o1 != null && (
                        <span className="text-xs text-green-500/70 uppercase">
                          DOG
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-stone-600 text-xs font-bold text-center px-2">
                    VS
                  </div>
                  {/* Fighter 2 */}
                  <div className="items-end flex flex-col">
                    <div className="text-stone-100 text-sm font-semibold text-right">
                      {f2.name}
                    </div>
                    <div className="flex items-baseline gap-1.5 mt-0.5">
                      {f2Fav && (
                        <span className="text-xs text-red-500/70 uppercase">
                          FAV
                        </span>
                      )}
                      {!f2Fav && o2 != null && (
                        <span className="text-xs text-green-500/70 uppercase">
                          DOG
                        </span>
                      )}
                      {o2 != null && (
                        <span className="text-stone-500 text-xs">
                          {impliedProb(o2)}%
                        </span>
                      )}
                      <span
                        className={`text-xl font-black ${f2Fav ? "text-red-400" : "text-green-400"}`}
                      >
                        {fmt(o2)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}

        <input
          type="text"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Ask about striking, takedowns, or records..."
          className="border border-yellow-700/40 bg-stone-900 text-stone-100 p-2 rounded-lg w-full mb-4"
        />

        <button onClick={() => processQuestion()} className="neon-button mb-8">
          Analyze
        </button>

        <div className="text-stone-300 mb-6">{answer}</div>

        <div className="flex justify-center mt-4 space-x-4 mb-8">
          {fights
            .find((f) => f.fight_id === parseInt(selectedFight))
            ?.fighters.map((fighter) => (
              <a href={`/roster#${fighter.id}`} key={fighter.id}>
                <img
                  src={`/fighter-${fighter.id}.jpg`}
                  alt={fighter.name}
                  className="w-16 h-16 rounded-full object-cover border border-yellow-700/40"
                  onError={(e) =>
                    (e.target.src = "https://picsum.photos/200/200")
                  }
                />
              </a>
            ))}
        </div>

        {/* Odds Display Section */}
        <div className="max-w-2xl mx-auto mb-8">
          <button
            onClick={() => setShowOdds(!showOdds)}
            className="w-full bg-gradient-to-r from-yellow-700 to-yellow-600 text-stone-950 font-bold py-3 px-4 rounded-lg hover:brightness-110 transition duration-300 ease-in-out border border-yellow-700/50 flex justify-between items-center"
          >
            <span>📊 Betting Odds</span>
            <span>{showOdds ? "▼" : "▶"}</span>
          </button>

          {showOdds && selectedFight && (
            <div className="mt-4 bg-stone-900 border border-yellow-700/50 rounded-lg p-6">
              {(() => {
                const fight = fights.find(
                  (f) => f.fight_id === parseInt(selectedFight),
                );
                if (!fight || fight.fighters.length < 2) return null;
                const [fighter1, fighter2] = fight.fighters;
                const bo = fight.betting_odds || {};
                const hasRealOdds =
                  bo.fighter1_moneyline && bo.fighter1_moneyline !== "N/A";

                // Moneyline colour helper: negative = favourite (green), positive = underdog (red)
                const mlColour = (ml) => {
                  if (!ml || ml === "N/A") return "text-gray-400";
                  const n = parseInt(String(ml).replace(/[^0-9-+]/g, ""), 10);
                  return isNaN(n)
                    ? "text-gray-400"
                    : n < 0
                      ? "text-green-400"
                      : "text-red-400";
                };

                return (
                  <div>
                    <h3 className="text-2xl font-bold text-yellow-300 mb-4 text-center">
                      {fighter1.name} vs. {fighter2.name}
                    </h3>

                    {/* ── Moneyline ── */}
                    <h4 className="text-yellow-400 font-semibold mb-2">
                      Moneyline
                    </h4>
                    <div className="overflow-x-auto mb-5">
                      <table className="w-full text-gray-200 border-collapse">
                        <thead>
                          <tr className="border-b border-yellow-700/60">
                            <th className="px-4 py-2 text-left text-yellow-300">
                              Fighter
                            </th>
                            <th className="px-4 py-2 text-center text-yellow-300">
                              Moneyline
                            </th>
                            <th className="px-4 py-2 text-center text-yellow-300">
                              KO/TKO (Knockout)
                            </th>
                            <th className="px-4 py-2 text-center text-yellow-300">
                              Sub (Submission)
                            </th>
                            <th className="px-4 py-2 text-center text-yellow-300">
                              Decision
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {[
                            {
                              fighter: fighter1,
                              ml: bo.fighter1_moneyline ?? "N/A",
                              ko: bo.fighter1_ko_odds ?? "N/A",
                              sub: bo.fighter1_sub_odds ?? "N/A",
                              dec: bo.fighter1_decision_odds ?? "N/A",
                            },
                            {
                              fighter: fighter2,
                              ml: bo.fighter2_moneyline ?? "N/A",
                              ko: bo.fighter2_ko_odds ?? "N/A",
                              sub: bo.fighter2_sub_odds ?? "N/A",
                              dec: bo.fighter2_decision_odds ?? "N/A",
                            },
                          ].map(({ fighter, ml, ko, sub, dec }) => (
                            <tr
                              key={fighter.id}
                              className="border-b border-stone-700 hover:bg-stone-800/60 transition"
                            >
                              <td className="px-4 py-3 font-semibold text-white">
                                {fighter.name}
                              </td>
                              <td
                                className={`px-4 py-3 text-center font-mono font-bold ${mlColour(ml)}`}
                              >
                                {ml}
                              </td>
                              <td className="px-4 py-3 text-center text-blue-300 font-mono">
                                {ko}
                              </td>
                              <td className="px-4 py-3 text-center text-orange-300 font-mono">
                                {sub}
                              </td>
                              <td className="px-4 py-3 text-center text-purple-300 font-mono">
                                {dec}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* ── Over/Under ── */}
                    {(bo.over_under_rounds && bo.over_under_rounds !== "N/A") ||
                    (bo.over_odds && bo.over_odds !== "N/A") ? (
                      <>
                        <h4 className="text-yellow-400 font-semibold mb-2">
                          Over / Under Rounds
                        </h4>
                        <div className="flex gap-4 mb-5">
                          <div className="flex-1 bg-gray-900 rounded-lg p-3 text-center border border-gray-600">
                            <p className="text-xs text-gray-400 mb-1">Line</p>
                            <p className="text-white font-mono font-bold">
                              {bo.over_under_rounds ?? "N/A"}
                            </p>
                          </div>
                          <div className="flex-1 bg-gray-900 rounded-lg p-3 text-center border border-green-700">
                            <p className="text-xs text-gray-400 mb-1">Over</p>
                            <p className="text-green-400 font-mono font-bold">
                              {bo.over_odds ?? "N/A"}
                            </p>
                          </div>
                          <div className="flex-1 bg-gray-900 rounded-lg p-3 text-center border border-red-700">
                            <p className="text-xs text-gray-400 mb-1">Under</p>
                            <p className="text-red-400 font-mono font-bold">
                              {bo.under_odds ?? "N/A"}
                            </p>
                          </div>
                        </div>
                      </>
                    ) : null}

                    <p className="text-xs text-gray-400 mt-2 text-center italic">
                      {hasRealOdds
                        ? "* Odds sourced from BestFightOdds.com at time of data pull. Always verify with your sportsbook."
                        : "* Live odds unavailable — BestFightOdds did not return data for this matchup. Check sportsbooks directly."}
                    </p>
                  </div>
                );
              })()}
            </div>
          )}
        </div>

        {selectedFight &&
          (() => {
            const fight = fights.find(
              (f) => f.fight_id === parseInt(selectedFight),
            );

            const renderStats = (fighter) => {
              const statsList = {
                basics: [
                  { label: "Nickname", key: "nickname" },
                  { label: "Age", key: "age" },
                  { label: "Height", key: "height" },
                  { label: "Reach", key: "reach" },
                  { label: "Stance", key: "stance" },
                  { label: "Weight Class", key: "weight_class" },
                  { label: "Record", key: "record" },
                  { label: "Wins", key: "wins" },
                  { label: "Losses", key: "losses" },
                  { label: "Draws", key: "draws" },
                  {
                    label: "DK (DraftKings) Salary",
                    key: "salary",
                    isMoney: true,
                  },
                  {
                    label: "Avg Points (DFS — Daily Fantasy Sports)",
                    key: "avgPointsPerGame",
                    isHighlight: true,
                  },
                ],
                striking: [
                  {
                    label: "SLpM (Sig. Strikes Landed per Min)",
                    key: "stats.slpm",
                  },
                  {
                    label: "SApM (Sig. Strikes Absorbed per Min)",
                    key: "stats.sapm",
                  },
                  { label: "Striking Accuracy %", key: "striking_accuracy" },
                  { label: "Striking Defense", key: "stats.striking_defense" },
                  { label: "Strikes/Min", key: "stats.slpm" },
                ],
                grappling: [
                  {
                    label: "TD Avg (Takedowns per 15 min)",
                    key: "stats.td_avg",
                  },
                  {
                    label: "TD Accuracy % (Takedown Accuracy)",
                    key: "stats.td_accuracy",
                  },
                  {
                    label: "TD Defense % (Takedown Defense)",
                    key: "stats.td_defense",
                  },
                  {
                    label: "Sub Win % (Submission Win %)",
                    key: "submission_wins_pct",
                  },
                  { label: "Avg Sub Attempts", key: "avg_sub_attempts" },
                  {
                    label: "Avg KD (Knockdowns) / Fight",
                    key: "stats.avg_kd_per_fight",
                  },
                  {
                    label: "Avg CTRL (Control) Time (secs)",
                    key: "stats.avg_ctrl_secs",
                  },
                  {
                    label: "CTRL (Control) Time %",
                    key: "stats.grappling_control_pct",
                  },
                ],
                recordAwards: [
                  { label: "Current Win Streak", key: "current_win_streak" },
                  { label: "Longest Win Streak", key: "longest_win_streak" },
                  { label: "Current Loss Streak", key: "current_loss_streak" },
                  { label: "Last Fight Result", key: "last_fight_result" },
                  { label: "Record (Last 5)", key: "record_last_5" },
                  { label: "Record (Last 10)", key: "record_last_10" },
                  {
                    label: "Wins by KO/TKO (Knockout/Technical Knockout)",
                    key: "wins_ko_tko",
                  },
                  { label: "Wins by Submission (Sub)", key: "wins_submission" },
                  { label: "Wins by Decision (Dec)", key: "wins_decision" },
                  { label: "Finish Rate %", key: "finish_rate_pct" },
                  { label: "Decision Rate %", key: "decision_rate_pct" },
                  { label: "Total Title Bouts", key: "total_title_bouts" },
                ],
                advanced: [
                  { label: "UFC Ranking", key: "ufc_ranking" },
                  {
                    label: "Career Longevity (Years)",
                    key: "career_longevity_years",
                  },
                  {
                    label: "Avg Fight Duration (mins)",
                    key: "avg_fight_duration",
                  },
                  { label: "First-Round Wins", key: "first_round_wins" },
                ],
              };

              const getValue = (fighter, keyPath) => {
                const keys = keyPath.split(".");
                let value = fighter;
                for (const key of keys) {
                  value = value?.[key];
                }
                return value;
              };

              const stats = statsList[activeTab] || statsList.basics;

              return (
                <div className="space-y-2">
                  {stats.map((stat) => (
                    <div
                      key={stat.key}
                      className="flex justify-between py-1 border-b border-stone-700/50"
                    >
                      <span className="text-stone-500 text-sm">
                        {stat.label}:
                      </span>
                      <span
                        className={`font-semibold ${
                          stat.isMoney || stat.isHighlight
                            ? "text-yellow-400"
                            : "text-stone-200"
                        }`}
                      >
                        {stat.isMoney
                          ? `$${getValue(fighter, stat.key) || "N/A"}`
                          : getValue(fighter, stat.key) || "N/A"}
                      </span>
                    </div>
                  ))}
                </div>
              );
            };

            return fight && fight.fighters.length >= 2 ? (
              <div className="mb-8">
                {/* Research-First Tagline */}
                <p className="text-center text-stone-400 text-sm mb-3 italic tracking-wide">
                  📊 Research every stat side-by-side — make your own decisions
                </p>

                {/* Collapsible Header */}
                <button
                  onClick={() => {
                    setExpandedStats(!expandedStats);
                    if (!expandedStats) console.log("Stats section expanded");
                  }}
                  className="w-full bg-stone-900 hover:bg-stone-800 border border-yellow-700/50 text-yellow-500 font-bold py-3 px-4 rounded-t-lg flex justify-between items-center transition cursor-pointer"
                >
                  <span className="text-xl">
                    📋 View Full Fighter Stats & Comparisons
                  </span>
                  <span className="text-lg">{expandedStats ? "▼" : "▶"}</span>
                </button>

                {/* Expanded Content */}
                {expandedStats && (
                  <div className="bg-stone-900 border border-t-0 border-yellow-700/50 p-6 rounded-b-lg">
                    {/* Tab Buttons */}
                    <div className="flex flex-wrap gap-2 mb-6 border-b border-gray-600 pb-4">
                      {[
                        { id: "basics", label: "Basics" },
                        { id: "striking", label: "Striking" },
                        { id: "grappling", label: "Grappling" },
                        { id: "recordAwards", label: "Record & Awards" },
                        {
                          id: "advanced",
                          label: "Advanced/DFS (Daily Fantasy Sports)",
                        },
                      ].map((tab) => (
                        <button
                          key={tab.id}
                          onClick={() => setActiveTab(tab.id)}
                          className={`px-4 py-2 rounded-lg font-bold tracking-wide uppercase text-xs transition ${
                            activeTab === tab.id
                              ? "bg-yellow-700 text-stone-950"
                              : "bg-stone-800 text-stone-400 hover:bg-stone-700 hover:text-stone-200"
                          }`}
                        >
                          {tab.label}
                        </button>
                      ))}
                    </div>

                    {/* Side-by-Side Fighter Stats */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="border border-yellow-700/50 rounded-lg p-4 bg-stone-950">
                        <h4 className="text-lg font-bold text-yellow-500 mb-4 text-center border-b border-yellow-700/40 pb-2 tracking-wide uppercase">
                          {fight.fighters[0].name}
                        </h4>
                        {renderStats(fight.fighters[0])}
                      </div>

                      <div className="border border-yellow-700/30 rounded-lg p-4 bg-stone-950">
                        <h4 className="text-lg font-bold text-yellow-400/80 mb-4 text-center border-b border-yellow-700/30 pb-2 tracking-wide uppercase">
                          {fight.fighters[1].name}
                        </h4>
                        {renderStats(fight.fighters[1])}
                      </div>
                    </div>

                    <p className="text-xs text-stone-600 mt-4 italic text-center tracking-wide">
                      ✓ Stats from DraftKings, UFCStats, Sherdog, Tapology.
                      Public sources only. Not betting advice.
                    </p>
                  </div>
                )}
              </div>
            ) : selectedFight ? (
              <div className="text-center text-stone-500 mb-8 tracking-wide">
                ⚠️ Select a valid fight to view comprehensive stats
              </div>
            ) : (
              <div className="text-center text-stone-500 mb-8 py-4 tracking-wide">
                👉 Select a fight above to compare fighter stats side-by-side
              </div>
            );
          })()}

        <div className="flex items-center gap-3 mb-4">
          <div className="h-px flex-1 bg-yellow-700/30" />
          <h2 className="text-xs font-bold tracking-[0.4em] uppercase text-yellow-600">
            ◈ QUICK QUESTION BUTTONS
          </h2>
          <div className="h-px flex-1 bg-yellow-700/30" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 pb-10">
          {generalQuestions.map((question, index) => (
            <button
              key={index}
              onClick={() => handleQuestionButton(question)}
              className="bg-stone-900 border border-yellow-700/40 text-stone-300 text-xs font-bold tracking-wide py-3 px-4 rounded-lg hover:bg-stone-800 hover:border-yellow-600/60 hover:text-yellow-400 transition duration-200 text-left"
            >
              {question}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default FightAnalyzer;
