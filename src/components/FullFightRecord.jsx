import { useState, useMemo } from "react";

const FALLBACK_AVATAR_SM = null;

const FullFightRecord = ({ fighter }) => {
  // Try all possible places where fight history might be stored
  const fightHistory = 
    fighter?.fight_history || 
    fighter?.fights || 
    fighter?.fightHistory || 
    [];

  const hasAmateur = fightHistory.some(f => f.fight_type === 'amateur');

  const [selectedYear, setSelectedYear] = useState("All");
  const [selectedMethod, setSelectedMethod] = useState("All");
  const [selectedType, setSelectedType] = useState("All");

  // Career record counts pro fights only (or all if no type data)
  const record = useMemo(() => {
    const source = hasAmateur ? fightHistory.filter(f => f.fight_type !== 'amateur') : fightHistory;
    const wins   = source.filter(f => String(f.result || "").toUpperCase().startsWith("W")).length;
    const losses = source.filter(f => String(f.result || "").toUpperCase().startsWith("L")).length;
    const draws  = source.filter(f => String(f.result || "").toUpperCase().startsWith("D")).length;
    return { wins, losses, draws };
  }, [fightHistory, hasAmateur]);

  const filteredFights = useMemo(() => {
    return fightHistory
      .filter(fight => {
        const yearMatch = selectedYear === "All" || (String(fight.date || "").match(/\d{4}/) || [""])[0] === selectedYear;
        const methodMatch = selectedMethod === "All" ||
          String(fight.method || "").toLowerCase().includes(selectedMethod.toLowerCase());
        const typeMatch = selectedType === "All" ||
          (selectedType === "pro"     && fight.fight_type !== 'amateur') ||
          (selectedType === "amateur" && fight.fight_type === 'amateur');
        return yearMatch && methodMatch && typeMatch;
      })
      .sort((a, b) => {
        const yearA = parseInt((String(a.date || "").match(/\d{4}/) || [0])[0]);
        const yearB = parseInt((String(b.date || "").match(/\d{4}/) || [0])[0]);
        return yearB - yearA;
      });
  }, [fightHistory, selectedYear, selectedMethod, selectedType]);

  const years = useMemo(() => {
    const uniqueYears = [...new Set(
      fightHistory.map(f => {
        const m = String(f.date || "").match(/\d{4}/);
        return m ? m[0] : "";
      }).filter(Boolean)
    )].sort().reverse();
    return ["All", ...uniqueYears];
  }, [fightHistory]);

  if (fightHistory.length === 0) {
    return (
      <div className="py-12 text-center">
        <div className="text-5xl mb-4">📭</div>
        <h3 className="text-xl font-semibold text-stone-100 mb-2">No Fight History Found</h3>
        <p className="text-stone-400 max-w-sm mx-auto">
          We couldn't find any fight history for {fighter?.name}. 
          This is likely a data loading issue from Sherdog/UFCStats.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      <div className="text-center mb-8">
        <h2 className="text-xl sm:text-3xl font-bold text-stone-100 mb-1">
          {fighter?.name}'s Full Fight Record
        </h2>
        <p className="text-stone-400">Data from Sherdog • Professional Career</p>
      </div>

      <div className="bg-stone-800/50 rounded-2xl p-4 sm:p-6 mb-8 border border-stone-700 text-center">
        <div className="text-3xl sm:text-5xl font-black text-stone-100">
          {record.wins}-{record.losses}-{record.draws}
        </div>
        <div className="text-stone-400 mt-1">
          Pro Record{hasAmateur ? ` • ${fightHistory.filter(f => f.fight_type === 'amateur').length} amateur fights` : ""}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4 mb-8 justify-center">
        <div className="flex items-center gap-3 bg-stone-800/50 rounded-xl px-5 py-2.5 border border-stone-700">
          <span className="text-stone-300 text-sm">Year</span>
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(e.target.value)}
            className="bg-stone-900 text-stone-100 px-4 py-1.5 rounded-lg border border-stone-600 text-sm"
          >
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>

        <div className="flex items-center gap-3 bg-stone-800/50 rounded-xl px-5 py-2.5 border border-stone-700">
          <span className="text-stone-300 text-sm">Method</span>
          <select
            value={selectedMethod}
            onChange={(e) => setSelectedMethod(e.target.value)}
            className="bg-stone-900 text-stone-100 px-4 py-1.5 rounded-lg border border-stone-600 text-sm"
          >
            <option value="All">All</option>
            <option value="KO">KO/TKO</option>
            <option value="Submission">Submission</option>
            <option value="Decision">Decision</option>
          </select>
        </div>

        {hasAmateur && (
          <div className="flex items-center gap-3 bg-stone-800/50 rounded-xl px-5 py-2.5 border border-stone-700">
            <span className="text-stone-300 text-sm">Type</span>
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="bg-stone-900 text-stone-100 px-4 py-1.5 rounded-lg border border-stone-600 text-sm"
            >
              <option value="All">All</option>
              <option value="pro">Pro Only</option>
              <option value="amateur">Amateur Only</option>
            </select>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="bg-stone-900 rounded-2xl overflow-x-auto border border-stone-700">
        <table className="w-full min-w-[480px]">
          <thead>
            <tr className="bg-stone-800">
              <th className="py-3 px-2 sm:px-6 text-left text-xs font-semibold text-stone-400">DATE</th>
              <th className="py-3 px-2 sm:px-6 text-left text-xs font-semibold text-stone-400">OPPONENT</th>
              <th className="py-3 px-2 sm:px-6 text-center text-xs font-semibold text-stone-400">RESULT</th>
              <th className="py-3 px-2 sm:px-6 text-left text-xs font-semibold text-stone-400">METHOD</th>
              <th className="py-3 px-2 sm:px-6 text-center text-xs font-semibold text-stone-400">ROUND</th>
              <th className="py-3 px-2 sm:px-6 text-center text-xs font-semibold text-stone-400">TIME</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-800">
            {filteredFights.map((fight, i) => {
              const isAmateur = fight.fight_type === 'amateur';
              return (
              <tr key={i} className={`hover:bg-stone-800/50 ${isAmateur ? 'opacity-60' : ''}`}>
                <td className="py-3 px-2 sm:px-6 text-xs sm:text-sm text-stone-300 whitespace-nowrap">
                  {fight.date ? new Date(fight.date).toLocaleDateString('en-US', {year:'numeric', month:'short', day:'numeric'}) : '—'}
                </td>
                <td className="py-3 px-2 sm:px-6">
                  <div className="flex items-center gap-2">
                    {/* avatar removed — fallback was a distracting ? circle */}
                    <div>
                      <span className="font-medium text-stone-200 text-xs sm:text-sm">{fight.opponent || fight.opponent_name || "Unknown"}</span>
                      {isAmateur && (
                        <span className="ml-1 px-1 py-0.5 rounded text-[10px] font-bold bg-amber-900/60 text-amber-400 border border-amber-700/40">AM</span>
                      )}
                    </div>
                  </div>
                </td>
                <td className="py-3 px-2 sm:px-6 text-center">
                  <span className={`inline-block px-2 sm:px-3 py-0.5 rounded text-xs font-bold ${
                    String(fight.result || "").toUpperCase().startsWith('W') ? 'bg-green-600 text-white' : 
                    String(fight.result || "").toUpperCase().startsWith('L') ? 'bg-red-600 text-white' : 'bg-stone-600 text-white'
                  }`}>
                    {String(fight.result || "?").toUpperCase()}
                  </span>
                </td>
                <td className="py-3 px-2 sm:px-6 text-xs sm:text-sm text-stone-300">{fight.method || "—"}</td>
                <td className="py-3 px-2 sm:px-6 text-center text-xs sm:text-sm text-stone-300">{fight.round || "—"}</td>
                <td className="py-3 px-2 sm:px-6 text-center text-xs sm:text-sm text-stone-300">{fight.time || "—"}</td>
              </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-6 text-center text-xs text-stone-500">
        Showing {filteredFights.length} of {fightHistory.length} fights • Data from Sherdog
      </div>
    </div>
  );
};

export default FullFightRecord;
