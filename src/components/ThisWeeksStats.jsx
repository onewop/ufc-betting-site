import { useState, useEffect } from "react";

const ThisWeeksStats = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/this_weeks_stats.json") // Updated path
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load JSON");
        return res.json();
      })
      .then((json) => {
        setData(json);
        setLoading(false);
      })
      .catch((err) => {
        setError("Failed to load data. Check this_weeks_stats.json.");
        setLoading(false);
      });
  }, []);

  if (loading)
    return <p className="text-center text-pearl-white">Loading...</p>;
  if (error) return <p className="text-red-600 text-center">{error}</p>;

  return (
    <div className="container mx-auto p-6 min-h-screen bg-gray-900">
      <header className="text-center mb-12">
        <h1
          className="text-4xl font-bold text-blood-red tracking-tight drop-shadow-[0_0_10px_rgba(230,230,250,0.8)]"
          style={{ fontFamily: "'Nosifer', sans-serif" }}
        >
          This Week's Stats
        </h1>
        <p className="text-xl text-pearl-white mt-2">
          {data.event.name} - {data.event.date} - {data.event.location}
        </p>
      </header>
      <div className="grid grid-cols-1 gap-6">
        {data.fights.map((fight, index) => (
          <div key={index} className="card">
            <h2 className="text-2xl font-semibold text-pearl-white mb-2">
              {fight.matchup} ({fight.weight_class})
            </h2>
            {fight.fighters.map((fighter, fIndex) => (
              <div key={fIndex} className="mt-4">
                <h3 className="text-xl font-bold text-primary">
                  {fighter.name}{" "}
                  {fighter.nickname !== "N/A" ? `("${fighter.nickname}")` : ""}
                </h3>
                <ul className="list-disc list-inside text-gray-300 space-y-1">
                  <li>
                    <span className="text-primary">Record:</span>{" "}
                    {fighter.record}
                  </li>
                  <li>
                    <span className="text-primary">Salary:</span>{" "}
                    {fighter.salary || "N/A"}
                  </li>
                  <li>
                    <span className="text-primary">Height:</span>{" "}
                    {fighter.height}
                  </li>
                  <li>
                    <span className="text-primary">Weight:</span>{" "}
                    {fighter.weight}
                  </li>
                  <li>
                    <span className="text-primary">Reach:</span> {fighter.reach}
                  </li>
                  <li>
                    <span className="text-primary">Stance:</span>{" "}
                    {fighter.stance}
                  </li>
                  <li>
                    <span className="text-primary">DOB:</span> {fighter.dob}
                  </li>
                  <li>
                    <span className="text-primary">SLpM:</span>{" "}
                    {fighter.stats.slpm}
                  </li>
                  <li>
                    <span className="text-primary">Striking Accuracy:</span>{" "}
                    {fighter.stats.striking_accuracy}
                  </li>
                  <li>
                    <span className="text-primary">SApM:</span>{" "}
                    {fighter.stats.sapm}
                  </li>
                  <li>
                    <span className="text-primary">Striking Defense:</span>{" "}
                    {fighter.stats.striking_defense}
                  </li>
                  <li>
                    <span className="text-primary">TD Avg:</span>{" "}
                    {fighter.stats.td_avg}
                  </li>
                  <li>
                    <span className="text-primary">TD Accuracy:</span>{" "}
                    {fighter.stats.td_accuracy}
                  </li>
                  <li>
                    <span className="text-primary">TD Defense:</span>{" "}
                    {fighter.stats.td_defense}
                  </li>
                  <li>
                    <span className="text-primary">Sub Avg:</span>{" "}
                    {fighter.stats.sub_avg}
                  </li>
                  <li>
                    <span className="text-primary">Recent Fights:</span>
                    <ul className="list-disc list-inside ml-4 space-y-1">
                      {fighter.recent_fights.map((fight, rfIndex) => (
                        <li key={rfIndex}>
                          vs. {fight.opponent} - {fight.result} ({fight.date},
                          Round {fight.round}, Time {fight.time})
                        </li>
                      ))}
                    </ul>
                  </li>
                </ul>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};

export default ThisWeeksStats;
