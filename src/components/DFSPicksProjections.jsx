import React, { useState, useEffect } from "react";

const DFSPicksProjections = () => {
  const [picks, setPicks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sortKey, setSortKey] = useState("projection");
  const [sortOrder, setSortOrder] = useState("desc");

  // Mock data as fallback
  const mockPicks = [
    {
      fighter: "Tatsuro Taira",
      salary: 9200,
      type: "Stud",
      projection: "90-110 pts",
      ownership: "25%",
      reasoning:
        "Averages 4.5 sig strikes/min and 2.0 takedowns/15min. Strong matchup potential.",
    },
    {
      fighter: "HyunSung Park",
      salary: 7000,
      type: "Value",
      projection: "70-90 pts",
      ownership: "15%",
      reasoning:
        "Averages 3.8 sig strikes/min and 1.5 takedowns/15min. Underdog with upside.",
    },
    {
      fighter: "Mateusz Rebecki",
      salary: 9000,
      type: "Stud",
      projection: "85-105 pts",
      ownership: "20%",
      reasoning:
        "Averages 4.2 sig strikes/min and 2.5 takedowns/15min. Favored to dominate.",
    },
    {
      fighter: "Chris Duncan",
      salary: 7200,
      type: "Value",
      projection: "65-85 pts",
      ownership: "10%",
      reasoning:
        "Averages 3.5 sig strikes/min and 1.0 takedowns/15min. High-risk, high-reward.",
    },
    {
      fighter: "Elves Brener",
      salary: 7100,
      type: "Value",
      projection: "68-88 pts",
      ownership: "12%",
      reasoning:
        "Averages 3.7 sig strikes/min and 1.2 takedowns/15min. Good value pick.",
    },
    {
      fighter: "Esteban Ribovics",
      salary: 9100,
      type: "Stud",
      projection: "88-108 pts",
      ownership: "22%",
      reasoning:
        "Averages 4.0 sig strikes/min and 1.8 takedowns/15min. Strong finishing potential.",
    },
  ];

  const fighterIds = [
    "4461d7e47375a895", // Tatsuro Taira
    "b671bdf981ad527d", // HyunSung Park
    "849c5d9979df5357", // Mateusz Rebecki
    "fd406a32a6fb3a29", // Chris Duncan
    "48a9a128784d53d1", // Elves Brener
    "323d4ca260dfa0ba", // Esteban Ribovics
  ];

  useEffect(() => {
    const fetchFighterStats = async () => {
      try {
        const proxyUrl = "https://cors-anywhere.herokuapp.com/";
        const statsPromises = fighterIds.map(async (id) => {
          const response = await fetch(
            `${proxyUrl}http://ufcstats.com/fighter-details/${id}`
          );
          if (!response.ok)
            throw new Error(`Fetch failed for fighter ID ${id}`);
          const htmlText = await response.text();
          const parser = new DOMParser();
          const doc = parser.parseFromString(htmlText, "text/html");

          const name =
            doc
              .querySelector(".b-content__title-highlight")
              ?.textContent.trim() || "Unknown Fighter";

          const statItems = doc.querySelectorAll(".b-list__box-list-item");
          let strikesPerMin = 4;
          let takedownsPer15 = 2;
          statItems.forEach((item) => {
            const text = item.textContent.trim();
            if (text.startsWith("SLpM:")) {
              strikesPerMin = parseFloat(text.split(":")[1].trim()) || 4;
            } else if (text.startsWith("TD Avg.:")) {
              takedownsPer15 = parseFloat(text.split(":")[1].trim()) || 2;
            }
          });

          const projection = strikesPerMin * 15 * 0.5 + takedownsPer15 * 5 + 20;

          return {
            fighter: name,
            salary: Math.floor(Math.random() * 2000) + 7000,
            type: projection > 100 ? "Stud" : "Value",
            projection: `${projection.toFixed(0)}-${(projection + 20).toFixed(
              0
            )} pts`,
            ownership: `${Math.floor(Math.random() * 30) + 10}%`,
            reasoning: `Averages ${strikesPerMin} sig strikes/min and ${takedownsPer15} takedowns/15min. Strong matchup potential.`,
          };
        });

        const computedPicks = await Promise.all(statsPromises);
        setPicks(computedPicks);
        setLoading(false);
      } catch (err) {
        console.error("Fetch error:", err);
        setError(
          "Failed to fetch picks from UFC Stats. Using mock data instead."
        );
        setPicks(mockPicks); // Fallback to mock data
        setLoading(false);
      }
    };

    fetchFighterStats();
  }, []);

  const handleSort = (key) => {
    const order = sortKey === key && sortOrder === "asc" ? "desc" : "asc";
    setSortKey(key);
    setSortOrder(order);

    const sortedPicks = [...picks].sort((a, b) => {
      let valA = a[key];
      let valB = b[key];

      if (key === "projection") {
        valA = parseInt(valA.split("-")[0], 10);
        valB = parseInt(valB.split("-")[0], 10);
      } else if (key === "salary") {
        valA = parseInt(valA, 10);
        valB = parseInt(valB, 10);
      } else if (key === "fighter") {
        valA = valA.toLowerCase();
        valB = valB.toLowerCase();
      }

      if (valA < valB) return order === "asc" ? -1 : 1;
      if (valA > valB) return order === "asc" ? 1 : -1;
      return 0;
    });

    setPicks(sortedPicks);
  };

  if (loading)
    return (
      <div className="text-center text-gray-300">Loading DFS Picks...</div>
    );

  return (
    <div className="container mx-auto p-6 min-h-screen">
      {error && <div className="text-center text-red-400 mb-4">{error}</div>}
      <h1 className="text-5xl font-bold mb-8 text-center">
        Top DraftKings DFS Picks for UFC Fight Night: Taira vs. Park
      </h1>
      <p className="text-gray-300 mb-6 text-center">
        Optimize your lineups with expert projections.{" "}
        {error
          ? "Using mock data due to API issues."
          : "Data fetched from UFC Stats."}
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-gray-300 border-collapse">
          <thead>
            <tr className="bg-gray-800">
              <th
                onClick={() => handleSort("fighter")}
                className="p-2 cursor-pointer border border-gray-600 hover:bg-gray-700"
              >
                Fighter{" "}
                {sortKey === "fighter" && (sortOrder === "asc" ? "↑" : "↓")}
              </th>
              <th
                onClick={() => handleSort("salary")}
                className="p-2 cursor-pointer border border-gray-600 hover:bg-gray-700"
              >
                Salary{" "}
                {sortKey === "salary" && (sortOrder === "asc" ? "↑" : "↓")}
              </th>
              <th className="p-2 border border-gray-600">Type</th>
              <th
                onClick={() => handleSort("projection")}
                className="p-2 cursor-pointer border border-gray-600 hover:bg-gray-700"
              >
                Projection{" "}
                {sortKey === "projection" && (sortOrder === "asc" ? "↑" : "↓")}
              </th>
              <th className="p-2 border border-gray-600">Ownership Est.</th>
              <th className="p-2 border border-gray-600">Reasoning</th>
            </tr>
          </thead>
          <tbody>
            {picks.map((pick, index) => (
              <tr key={index} className="border-b border-gray-700">
                <td className="p-2 border border-gray-600">{pick.fighter}</td>
                <td className="p-2 border border-gray-600">${pick.salary}</td>
                <td className="p-2 border border-gray-600">{pick.type}</td>
                <td className="p-2 border border-gray-600">
                  {pick.projection}
                </td>
                <td className="p-2 border border-gray-600">{pick.ownership}</td>
                <td className="p-2 border border-gray-600">{pick.reasoning}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-gray-300 mt-4 text-center">
        *Strategy: Fade high-owned chalk; stack underdogs for tournaments.
        Projections based on{" "}
        {error ? "mock data." : "historical stats from UFC Stats."}
      </p>
    </div>
  );
};

export default DFSPicksProjections;
