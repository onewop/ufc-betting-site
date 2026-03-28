const buildTeam = (teamsRemaining) => {
  // 1. Identify fights that must be included (have a fighter with unmet min)
  const urgentFights = [];
  const nonUrgentFights = [];
  availableFights.forEach((fg) => {
    const hasShortfall = fg.some((f) => {
      const minReq = fighterLimits[String(f.id)]?.min || 0;
      return (usageCounts[f.id] || 0) < minReq;
    });
    if (hasShortfall) urgentFights.push(fg);
    else nonUrgentFights.push(fg);
  });

  // 2. Build team from urgent fights first
  let team = [];
  let teamFightIds = new Set();
  let teamSalary = 0;
  let teamFPPG = 0;

  // 3. Add urgent fights first (up to 6)
  const forcedCount = Math.min(urgentFights.length, 6);
  const shuffledUrgent = shuffleFresh(urgentFights).slice(0, forcedCount);
  const remaining = 6 - forcedCount;
  const shuffledRest = shuffleFresh(nonUrgentFights).slice(0, remaining);
  const selected = [...shuffledUrgent, ...shuffledRest];

  // 4. Select one fighter per fight (randomly)
  const team = selected.map((fg) => {
    const scored = [...fg].map((f) => {
      const minReq = fighterLimits[String(f.id)]?.min || 0;
      const currentCount = usageCounts[f.id] || 0;
      const shortfall = Math.max(0, minReq - currentCount);
      const urgency =
        teamsRemaining > 0
          ? shortfall / teamsRemaining
          : shortfall > 0
            ? 1
            : 0;
      const urgencyAdj = urgency > 0 ? -urgency * 9000 : 0;
      return {
        f,
        score: f.salary + (usageCounts[f.id] ?? 0) * 600 + urgencyAdj,
      };
    });
    scored.sort((a, b) => a.score - b.score);
    return scored[0].f;
  });

  // 5. Check salary cap
  const totalSalary = team.reduce((sum, f) => sum + f.salary, 0);
  if (totalSalary <= 50000) return team;
}
