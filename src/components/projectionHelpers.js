/**
 * projectionHelpers.js — Ownership estimation and narrative reasoning.
 *
 * Exports:
 *   estimateOwnership(salary, avgPPG, medianSalary, medianPPG)
 *     → { label: "20–30%", ownerNum: 25 }  — rough ownership pct tiers
 *
 *   buildReasoning(fighter, projMid, ownerNum)
 *     → string  — one-sentence DFS narrative shown in the picks table
 *
 * No React. No external imports.
 * Used by:  DFSPicksProjections.jsx
 * Rollback: Delete this file and restore DFSPicksProjections_ORIGINAL_PRESPLIT.jsx
 *           from _archive/src_components/
 */

export const estimateOwnership = (salary, avgPPG, medianSalary, medianPPG) => {
  const salaryPct = salary / (medianSalary || salary);
  const ppgPct = (avgPPG || 0) / (medianPPG || 1);

  if (salary >= 9000 && ppgPct >= 1.2) return { label: "30–40%", ownerNum: 35 };
  if (salary >= 8500 && ppgPct >= 1.0) return { label: "20–30%", ownerNum: 25 };
  if (salary >= 8000) return { label: "15–25%", ownerNum: 20 };
  if (salary >= 7000 && ppgPct >= 1.1) return { label: "10–18%", ownerNum: 14 };
  if (salary >= 7000) return { label: "8–15%", ownerNum: 11 };
  if (salaryPct < 0.85) return { label: "5–10%", ownerNum: 7 };
  return { label: "5–12%", ownerNum: 8 };
};

// ─── Narrative Reasoning ───────────────────────────────────────────────────
// Added submission wins, KO/TKO, and decision breakdown to reasoning for
// better DFS context. Finish types are now combined into one summary phrase
// instead of showing only one category at a time.
// Data priority: wins_ko_tko / wins_submission / wins_decision from the
// fighter object (populated from this_weeks_stats.json enrichment), then
// finish_rate_pct. Falls back to generic phrases when data is missing.
export const buildReasoning = (fighter, projMid, ownerNum) => {
  const parts = [];
  const avg = fighter.avgPointsPerGame;
  const slpm = fighter.stats?.slpm;
  const tdAvg = fighter.stats?.td_avg;
  const koWins = fighter.wins_ko_tko || 0;
  const subWins = fighter.wins_submission || 0;
  const decWins = fighter.wins_decision || 0;
  const finRate = fighter.finish_rate_pct;
  const streak = fighter.current_win_streak;

  if (avg && avg > 0) {
    parts.push(`Averaging ${avg} DK pts/game historically`);
  } else if (avg === 0) {
    // avgPointsPerGame of exactly 0 means no DraftKings game history exists,
    // not a real score of zero — fall through to stat-based description.
    parts.push(
      slpm
        ? `No DK history — ${slpm} SLpM (stat-based estimate)`
        : "No DK history",
    );
  } else if (slpm) {
    parts.push(`${slpm} SLpM striking output`);
  }

  // Build a combined finish-type summary so KO and submission wins are both
  // visible — both score high DFS points and users need to see both at once.
  const hasFinishData = koWins > 0 || subWins > 0 || decWins > 0;
  if (hasFinishData) {
    const totalWins = koWins + subWins + decWins;
    const finishParts = [];
    if (koWins > 0) finishParts.push(`${koWins} KO/TKO`);
    if (subWins > 0) finishParts.push(`${subWins} sub`);
    if (decWins > 0) finishParts.push(`${decWins} dec`);

    if (koWins === 0 && subWins === 0 && decWins > 0) {
      // Pure decision fighter — flag it as that style
      parts.push(`decision specialist (${decWins}/${totalWins} wins by dec)`);
    } else if (koWins === 0 && subWins > 0) {
      // Sub-only finisher with no KOs
      parts.push(`submission finisher: ${finishParts.join(", ")} wins`);
    } else {
      // Mixed or KO-led — show all available breakdown
      parts.push(`finishes: ${finishParts.join(", ")} wins`);
    }
  }

  // Add finish rate context when not already implicit from the summary above.
  // High finish rate signals ceiling upside; low rate flags a grinder.
  if (finRate && finRate !== "N/A") {
    const fr = parseFloat(finRate);
    if (fr >= 60) parts.push(`${fr}% finish rate`);
    else if (fr <= 30 && !hasFinishData)
      parts.push(`tends toward decisions (${fr}% finish rate)`);
  }

  if (streak && streak > 1) parts.push(`on a ${streak}-fight win streak`);
  if (tdAvg && tdAvg > 1.5) parts.push(`active wrestler (${tdAvg} TD/15min)`);

  // ── Recent form / loss context ─────────────────────────────────────────
  // Adds a second sentence with loss signals so users can see both ceiling
  // (wins above) and floor/risk (recent form below) at a glance.
  // Source: record_last_5, last_fight_result, current_loss_streak,
  // and stats.subs_conceded from this_weeks_stats.json.
  const formParts = [];

  // Last-5 record (e.g. "3-2")
  if (fighter.record_last_5) formParts.push(`Last 5: ${fighter.record_last_5}`);

  // Most recent fight result — normalize separators ("L – Sub" → "L-Sub")
  if (fighter.last_fight_result) {
    const compact = fighter.last_fight_result.replace(/\s*[–—-]\s*/g, "-");
    formParts.push(`last: ${compact}`);
  }

  // Submission vulnerability: subs_conceded comes from the stats aggregator
  // and counts how many times this fighter was submitted in analyzed fights.
  const subsConceded = fighter.stats?.subs_conceded;
  if (subsConceded != null && subsConceded > 0) {
    formParts.push(`submitted ${subsConceded}× in recent fights`);
  }

  const lossStreak = fighter.current_loss_streak || 0;
  // Show all active loss streaks (>= 2) but only add the ⚠️ warning for
  // serious streaks (> 2, i.e. 3+ consecutive losses).
  if (lossStreak >= 2) {
    const warning = lossStreak > 2 ? "⚠️ " : "";
    formParts.push(`${warning}${lossStreak}-fight loss streak`);
  }

  const ownRisk =
    ownerNum >= 28
      ? "⚠️ Very high ownership — consider fading in large fields"
      : ownerNum >= 18
        ? "Moderate ownership risk"
        : "Low ownership — GPP leverage play";

  const offenseLine = parts.length
    ? `${parts.join(", ")}.`
    : `${fighter.record || "N/A"} record.`;
  const formLine = formParts.length ? ` ${formParts.join(" · ")}.` : "";

  return `${offenseLine}${formLine} ${ownRisk}.`;
};

