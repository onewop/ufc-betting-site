/**
 * FullFightRecord.jsx
 *
 * Component for displaying a fighter's full professional fight record in Sherdog-style table.
 * Includes filters, summary, and color-coded results.
 */

import { useState, useMemo } from "react";

const FullFightRecord = ({ fighter }) => {
  // Placeholder fight history data - replace with real data source
  const placeholderFights = [
    {
      date: "2024-03-15",
      opponent: { name: "John Doe", photo: "/placeholder.svg" },
      result: "W",
      method: "KO/TKO",
      round: 2,
      time: "3:45",
      event: "UFC 300",
    },
    {
      date: "2023-12-02",
      opponent: { name: "Jane Smith", photo: "/placeholder.svg" },
      result: "L",
      method: "Submission",
      round: 1,
      time: "2:30",
      event: "UFC 299",
    },
    {
      date: "2023-08-19",
      opponent: { name: "Mike Johnson", photo: "/placeholder.svg" },
      result: "W",
      method: "Decision",
      round: 3,
      time: "5:00",
      event: "UFC 298",
    },
    {
      date: "2023-04-08",
      opponent: { name: "Sarah Wilson", photo: "/placeholder.svg" },
      result: "W",
      method: "KO/TKO",
      round: 1,
      time: "1:15",
      event: "UFC 297",
    },
    {
      date: "2022-11-12",
      opponent: { name: "Tom Brown", photo: "/placeholder.svg" },
      result: "L",
      method: "Decision",
      round: 3,
      time: "5:00",
      event: "UFC 296",
    },
    // Add more as needed
  ];

  const [selectedYear, setSelectedYear] = useState("All");
  const [selectedMethod, setSelectedMethod] = useState("All");

  // Calculate record summary
  const record = useMemo(() => {
    const wins = placeholderFights.filter((f) => f.result === "W").length;
    const losses = placeholderFights.filter((f) => f.result === "L").length;
    const draws = placeholderFights.filter((f) => f.result === "D").length;
    return { wins, losses, draws };
  }, []);

  // Filter fights
  const filteredFights = useMemo(() => {
    return placeholderFights.filter((fight) => {
      const yearMatch =
        selectedYear === "All" || fight.date.startsWith(selectedYear);
      const methodMatch =
        selectedMethod === "All" || fight.method === selectedMethod;
      return yearMatch && methodMatch;
    });
  }, [selectedYear, selectedMethod]);

  // Unique years for dropdown
  const years = useMemo(() => {
    const uniqueYears = [
      ...new Set(placeholderFights.map((f) => f.date.slice(0, 4))),
    ]
      .sort()
      .reverse();
    return ["All", ...uniqueYears];
  }, []);

  // Method icons
  const getMethodIcon = (method) => {
    switch (method) {
      case "KO/TKO":
        return "👊";
      case "Submission":
        return "🥋";
      case "Decision":
        return "📜";
      default:
        return "⚔️";
    }
  };

  // Row color classes
  const getRowClasses = (result) => {
    switch (result) {
      case "W":
        return "bg-green-900/20 border-green-500/30";
      case "L":
        return "bg-red-900/20 border-red-500/30";
      case "D":
        return "bg-gray-900/20 border-gray-500/30";
      default:
        return "bg-stone-900/20 border-stone-500/30";
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6 bg-stone-900 rounded-lg">
      <h2 className="text-2xl font-bold text-stone-100 mb-6 text-center">
        Professional Fight Record - {fighter?.name || "Fighter"}
      </h2>

      {/* Record Summary */}
      <div className="text-center mb-6">
        <div className="text-3xl font-bold text-stone-100">
          {record.wins}-{record.losses}-{record.draws}
        </div>
        <div className="text-stone-400 text-sm">Wins-Losses-Draws</div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4 mb-6 justify-center">
        <div className="flex items-center gap-2">
          <label className="text-stone-300 text-sm">Year:</label>
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(e.target.value)}
            className="bg-stone-800 text-stone-100 px-3 py-1 rounded border border-stone-600"
          >
            {years.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-stone-300 text-sm">Method:</label>
          <select
            value={selectedMethod}
            onChange={(e) => setSelectedMethod(e.target.value)}
            className="bg-stone-800 text-stone-100 px-3 py-1 rounded border border-stone-600"
          >
            <option value="All">All</option>
            <option value="KO/TKO">KO/TKO</option>
            <option value="Submission">Submission</option>
            <option value="Decision">Decision</option>
          </select>
        </div>
      </div>

      {/* Fight Record Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-stone-600">
              <th className="text-left py-3 px-4 text-stone-300 font-semibold">
                Date
              </th>
              <th className="text-left py-3 px-4 text-stone-300 font-semibold">
                Opponent
              </th>
              <th className="text-center py-3 px-4 text-stone-300 font-semibold">
                Result
              </th>
              <th className="text-left py-3 px-4 text-stone-300 font-semibold">
                Method
              </th>
              <th className="text-center py-3 px-4 text-stone-300 font-semibold">
                Round
              </th>
              <th className="text-center py-3 px-4 text-stone-300 font-semibold">
                Time
              </th>
              <th className="text-left py-3 px-4 text-stone-300 font-semibold">
                Event
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredFights.map((fight, index) => (
              <tr
                key={index}
                className={`border-b border-stone-700 ${getRowClasses(fight.result)}`}
              >
                <td className="py-3 px-4 text-stone-200">{fight.date}</td>
                <td className="py-3 px-4">
                  <div className="flex items-center gap-3">
                    <img
                      src={fight.opponent.photo}
                      alt={fight.opponent.name}
                      className="w-8 h-8 rounded-full object-cover"
                      onError={(e) => {
                        e.target.src = "/placeholder.svg";
                      }}
                    />
                    <span className="text-stone-200">
                      {fight.opponent.name}
                    </span>
                  </div>
                </td>
                <td className="py-3 px-4 text-center">
                  <span
                    className={`font-bold ${
                      fight.result === "W"
                        ? "text-green-400"
                        : fight.result === "L"
                          ? "text-red-400"
                          : "text-gray-400"
                    }`}
                  >
                    {fight.result}
                  </span>
                </td>
                <td className="py-3 px-4">
                  <div className="flex items-center gap-2">
                    <span>{getMethodIcon(fight.method)}</span>
                    <span className="text-stone-200">{fight.method}</span>
                  </div>
                </td>
                <td className="py-3 px-4 text-center text-stone-200">
                  {fight.round}
                </td>
                <td className="py-3 px-4 text-center text-stone-200">
                  {fight.time}
                </td>
                <td className="py-3 px-4 text-stone-200 cursor-pointer hover:text-stone-100">
                  {fight.event}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {filteredFights.length === 0 && (
        <div className="text-center py-8 text-stone-400">
          No fights match the selected filters.
        </div>
      )}
    </div>
  );
};

export default FullFightRecord;
