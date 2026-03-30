const downloadFanDuelCSV = () => {
  const today = new Date();
  const dateStr = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`;
  const csvContent = [
    'Name,Position,Salary,Team,Opponent,Matchup,Projected Points (FD)',
    ...picks.map(p => 
      `${p.name},${p.position},${p.salary},${p.team},${p.opponent},${p.matchup},${p.projMid}`
    )
  ].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `CombatVault_UFC_${dateStr}_FanDuel.csv`;
  a.click();
  URL.revokeObjectURL(url);
};

const downloadBothCSVs = () => {
  Promise.all([
    downloadOptimalCSV(),
    downloadFanDuelCSV()
  ]).then(() => {
    // Both downloads completed
  });
};

<div className="flex space-x-2">
  <button
    onClick={downloadOptimalCSV}
    className="neon-button bg-green-900 hover:bg-green-800"
  >
    Download DraftKings CSV
  </button>
  <button
    onClick={downloadFanDuelCSV}
    className="neon-button bg-stone-700 hover:bg-stone-600"
  >
    Download FanDuel CSV
  </button>
  <button
    onClick={downloadBothCSVs}
    className="neon-button bg-stone-700 hover:bg-stone-600"
  >
    Download Both (DK + FD)
  </button>
</div>
