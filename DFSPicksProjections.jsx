const runOptimizer = (count = 1) => {
  // 1. Apply seeded noise for diversity in multi-lineup builds
  let picksToUse = picks;
  if (count > 1) {
    let s = userSeed;
    const seededRandom = () => {
      s = Math.sin(s) * 10000;
      return s - Math.floor(s);
    };
    picksToUse = picks.map((p) => ({
      ...p,
      projMid: Math.round(p.projMid * (1 + (seededRandom() * 2 - 1) * 0.05)),
    }));
  }

  // 2. Build all valid lineups
  const allValid = buildAllValidLineups(picksToUse, locked, excluded);
  if (!Array.isArray(allValid)) {
    setOptimizerError(allValid.error);
    return;
  }

  // 3. Select lineups with diversity constraints
  if (count === 1) {
    // Simply return the globally optimal lineup
    const best = allValid[0];
    setOptimalLineups([{
      ...best,
      totalPoints: Math.round(best.totalPoints)
    }]);
    return;
  }

  // 4. For multiple lineups: greedily pick the next best lineup that respects
  // the exposure limit — no fighter appears in more than (exposureLimit% × count) lineups.
  // Also enforce that each pair of lineups differs by at least 3 fighters.
  const maxAppearances = Math.max(
    1,
    Math.ceil(count * (exposureLimit / 100)),
  );
  const usageCounts = {}; // fighter name → how many lineups they're in so far
  const selected = [];

  // 5. Phase 1: select from lineups that include ALL locked fighters
  for (const candidate of allValid) {
    if (selected.length >= count) break;
    const overExposed = candidate.team.some(
      (f) => (usageCounts[f.fighter] || 0) >= maxAppearances,
    );
    if (overExposed) continue;
    // Check diversity: must differ by at least 3 fighters from every chosen lineup
    const candNames = new Set(candidate.team.map((f) => f.fighter));
    const tooSimilar = selected.some(
      (existing) =>
        existing.team.filter((f) => candNames.has(f.fighter)).length > 3,
    );
    if (tooSimilar) continue;
    candidate.team.forEach((f) => {
      usageCounts[f.fighter] = (usageCounts[f.fighter] || 0) + 1;
    });
    selected.push(candidate);
  }
}
