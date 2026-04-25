/**
 * fightAnalyzerHelpers.js — Comprehensive Fight Prediction Engine
 *
 * Analyzes ALL available fighter stats, records, physical attributes, fight
 * history, momentum, and style matchups to produce a detailed win prediction
 * with confidence rating and narrative explanation.
 *
 * 10 scoring categories (each 0–100, weighted):
 *   1. Striking Offense     (15%)  — slpm, accuracy, KDs, head targeting
 *   2. Striking Defense      (12%)  — defense %, absorption rate, range mgmt
 *   3. Grappling Offense     (13%)  — TD avg, TD accuracy, control time, reversals
 *   4. Grappling Defense     (10%)  — TD defense, opp control, sub defense
 *   5. Finishing Ability     (12%)  — finish rate, KO/sub wins, first-round wins
 *   6. Record & Experience   (10%)  — career win %, recent form, longevity, title bouts
 *   7. Momentum & Form       (8%)  — streaks, last result
 *   8. Physical Attributes   (8%)  — reach, height, age prime, stance
 *   9. Fight History Trends  (5%)  — method patterns, trajectory
 *   10. Style Matchup        (7%)  — cross-referencing offense vs defense gaps
 *
 * Exported:
 *   predictFight(f1, f2)     — full prediction object for one fight
 *   predictAllFights(fights) — predictions for every fight on the card
 *   CONFIDENCE_LEVELS        — Tailwind styling per confidence tier
 *
 * Imported by: FightAnalyzer.jsx, MatchupIntel.jsx
 */

// ─── Utilities ──────────────────────────────────────────────────────────────

/** Parse "64%" or 64 or "64" → 64.0 (or null) */
export const _parsePct = (v) => {
  if (v == null) return null;
  const n = parseFloat(String(v).replace("%", ""));
  return isNaN(n) ? null : n;
};

/** Parse height string "5' 10\"" → inches (70) */
const parseHeight = (h) => {
  if (!h || typeof h !== "string") return null;
  const m = h.match(/(\d+)'\s*(\d+)/);
  return m ? parseInt(m[1]) * 12 + parseInt(m[2]) : null;
};

/** Parse reach string "72\"" → 72 */
const parseReach = (r) => {
  if (!r) return null;
  const n = parseFloat(String(r).replace('"', ""));
  return isNaN(n) ? null : n;
};

/** Parse "3-2" record string → { w, l } */
const parseRecord = (rec) => {
  if (!rec || typeof rec !== "string") return null;
  const m = rec.match(/(\d+)-(\d+)/);
  return m ? { w: parseInt(m[1]), l: parseInt(m[2]) } : null;
};

/**
 * Derive record_last_5, current_win_streak, and current_loss_streak directly
 * from fight_history (pro fights only, newest-first ordering from ufcstats).
 * This always reflects the most recent fights regardless of when the static
 * JSON was last generated, fixing stale pre-computed fields like record_last_5.
 */
const deriveFightHistoryStats = (f) => {
  const history = (f.fight_history || []).filter((h) => h.fight_type === "pro");
  if (history.length === 0) return null;

  // fight_history is newest-first (index 0 = most recent fight)
  const last5 = history.slice(0, 5);
  const wins5 = last5.filter((h) => h.result === "win").length;
  const losses5 = last5.length - wins5;

  let winStreak = 0;
  let lossStreak = 0;
  for (const h of history) {
    if (winStreak === 0 && lossStreak === 0) {
      if (h.result === "win") winStreak = 1;
      else lossStreak = 1;
    } else if (winStreak > 0) {
      if (h.result === "win") winStreak++;
      else break;
    } else {
      if (h.result !== "win") lossStreak++;
      else break;
    }
  }

  return {
    record_last_5: `${wins5}-${losses5}`,
    current_win_streak: winStreak,
    current_loss_streak: lossStreak,
  };
};

/** Clamp a value between min and max */
const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

/** Normalize a value to 0–100 scale given known min/max for the stat */
const norm = (v, min, max) => {
  if (v == null) return 50;
  return clamp(((v - min) / (max - min)) * 100, 0, 100);
};

/** Get last name from full name */
const lastName = (name) => {
  if (!name) return "";
  const parts = name.trim().split(" ");
  return parts[parts.length - 1];
};

// ─── Category Scorers ───────────────────────────────────────────────────────

function scoreStrikingOffense(f) {
  const s = f.stats || {};
  const slpm = s.slpm ?? 0;
  const acc = _parsePct(s.striking_accuracy) ?? 45;
  const kd = s.avg_kd_per_fight ?? 0;
  const headPct = s.head_str_pct ?? 40;

  const slpmScore = norm(slpm, 0, 8);
  const accScore = norm(acc, 25, 65);
  const kdScore = norm(kd, 0, 1.5);
  const headScore = norm(headPct, 20, 60);

  const score = slpmScore * 0.4 + accScore * 0.25 + kdScore * 0.25 + headScore * 0.1;

  const notes = [];
  if (slpm >= 5) notes.push(`high-volume striker at ${slpm.toFixed(1)} SLpM`);
  else if (slpm < 2.5) notes.push(`low-volume striker at ${slpm.toFixed(1)} SLpM`);
  if (acc >= 52) notes.push(`accurate (${acc.toFixed(0)}% landing)`);
  if (kd >= 0.5) notes.push(`knockdown threat (${kd.toFixed(1)} KD/fight)`);
  if (headPct >= 55) notes.push(`targets head heavily (${headPct}%)`);

  return { score, notes };
}

function scoreStrikingDefense(f) {
  const s = f.stats || {};
  const def = _parsePct(s.striking_defense) ?? 50;
  const sapm = s.sapm ?? 4;
  const distPct = s.distance_str_pct ?? 60;
  const groundPct = s.ground_str_pct ?? 20;

  const defScore = norm(def, 35, 70);
  const sapmScore = 100 - norm(sapm, 1, 8);
  const rangeScore = norm(distPct, 40, 85);

  const score = defScore * 0.45 + sapmScore * 0.35 + rangeScore * 0.2;

  const notes = [];
  if (def >= 60) notes.push(`elite defense (${def.toFixed(0)}% avoided)`);
  else if (def < 45) notes.push(`porous defense (only ${def.toFixed(0)}% avoided)`);
  if (sapm >= 5) notes.push(`absorbs heavy damage (${sapm.toFixed(1)} SApM)`);
  else if (sapm < 2.5) notes.push(`rarely gets hit (${sapm.toFixed(1)} SApM)`);
  if (distPct >= 75) notes.push("fights primarily at range");
  if (groundPct >= 30) notes.push("significant ground striking exposure");

  return { score, notes };
}

function scoreGrapplingOffense(f) {
  const s = f.stats || {};
  const tdAvg = s.td_avg ?? 0;
  const tdAcc = _parsePct(s.td_accuracy) ?? 35;
  const ctrlSecs = s.avg_ctrl_secs ?? 0;
  const subAttempts = f.avg_sub_attempts ?? 0;

  const tdScore = norm(tdAvg, 0, 5);
  const tdAccScore = norm(tdAcc, 20, 65);
  const ctrlScore = norm(ctrlSecs, 0, 300);
  const subAttScore = norm(subAttempts, 0, 2);

  const score = tdScore * 0.35 + tdAccScore * 0.2 + ctrlScore * 0.3 + subAttScore * 0.15;

  const notes = [];
  if (tdAvg >= 3) notes.push(`aggressive wrestler (${tdAvg.toFixed(1)} TD/15min)`);
  else if (tdAvg < 0.5) notes.push("rarely attempts takedowns");
  if (tdAcc >= 50) notes.push(`efficient TDs (${tdAcc.toFixed(0)}% accuracy)`);
  if (ctrlSecs >= 120) notes.push(`dominant control (${(ctrlSecs / 60).toFixed(1)} min avg)`);
  if (subAttempts >= 1) notes.push(`active sub game (${subAttempts.toFixed(1)} att/fight)`);

  return { score, notes };
}

function scoreGrapplingDefense(f) {
  const s = f.stats || {};
  const tdDef = _parsePct(s.td_defense) ?? 60;
  const oppCtrl = s.avg_opp_ctrl_secs ?? 60;
  const subDef = s.implied_sub_def_pct ?? 80;
  const subsConceded = s.subs_conceded ?? 0;

  const tdDefScore = norm(tdDef, 40, 85);
  const oppCtrlScore = 100 - norm(oppCtrl, 0, 200);
  const subDefScore = norm(subDef, 50, 100);

  const score = tdDefScore * 0.4 + oppCtrlScore * 0.3 + subDefScore * 0.3;

  const notes = [];
  if (tdDef >= 75) notes.push(`elite TD defense (${tdDef.toFixed(0)}%)`);
  else if (tdDef < 50) notes.push(`vulnerable to takedowns (${tdDef.toFixed(0)}%)`);
  if (oppCtrl >= 120) notes.push(`gets controlled often (${(oppCtrl / 60).toFixed(1)} min avg)`);
  else if (oppCtrl < 20) notes.push("rarely held down");
  if (subsConceded >= 2) notes.push(`has been submitted ${subsConceded}× in analyzed fights`);
  if (subDef >= 95) notes.push("virtually immune to submissions");

  return { score, notes };
}

function scoreFinishing(f) {
  const finRate = f.finish_rate_pct ?? 50;
  const koWins = f.wins_ko_tko ?? 0;
  const subWins = f.wins_submission ?? 0;
  const firstRdWins = f.first_round_wins ?? 0;
  const s = f.stats || {};
  const kd = s.avg_kd_per_fight ?? 0;

  const finScore = norm(finRate, 30, 90);
  const koScore = norm(koWins, 0, 10);
  const subScore = norm(subWins, 0, 5);
  const firstRdScore = norm(firstRdWins, 0, 5);
  const kdFinScore = norm(kd, 0, 1);

  const score = finScore * 0.3 + koScore * 0.25 + subScore * 0.15 + firstRdScore * 0.15 + kdFinScore * 0.15;

  const notes = [];
  if (finRate >= 70) notes.push(`elite finisher (${finRate.toFixed(0)}% finish rate)`);
  else if (finRate < 35) notes.push(`tends to go the distance (${finRate.toFixed(0)}% finish rate)`);
  if (koWins >= 5) notes.push(`dangerous KO power (${koWins} KO/TKO wins)`);
  if (subWins >= 3) notes.push(`submission specialist (${subWins} sub wins)`);
  if (firstRdWins >= 3) notes.push(`fast starter (${firstRdWins} first-round finishes)`);

  return { score, notes };
}

function scoreRecordExperience(f) {
  const wins = f.wins ?? 0;
  const losses = f.losses ?? 0;
  const total = wins + losses || 1;
  const winPct = (wins / total) * 100;
  const longevity = f.career_longevity_years ?? 3;
  const titleBouts = f.total_title_bouts ?? 0;

  // Always derive from fight_history so stale pre-computed fields can't mislead
  const derived = deriveFightHistoryStats(f);
  const last5Str = derived ? derived.record_last_5 : f.record_last_5;
  const rec5 = parseRecord(last5Str);

  const winPctScore = norm(winPct, 40, 90);
  const longevityScore = norm(longevity, 0, 12);
  const titleScore = norm(titleBouts, 0, 5);
  const rec5Score = rec5 ? norm((rec5.w / (rec5.w + rec5.l || 1)) * 100, 20, 100) : 50;

  const score = winPctScore * 0.35 + rec5Score * 0.3 + longevityScore * 0.15 + titleScore * 0.2;

  const notes = [];
  notes.push(`${wins}-${losses}${f.draws ? `-${f.draws}` : ""} career (${winPct.toFixed(0)}% win rate)`);
  if (last5Str) notes.push(`last 5: ${last5Str}`);
  if (longevity >= 8) notes.push(`seasoned veteran (${longevity.toFixed(0)}yr career)`);
  else if (longevity < 2) notes.push(`relatively new (${longevity.toFixed(1)}yr career)`);
  if (titleBouts >= 1) notes.push(`${titleBouts} title bout${titleBouts > 1 ? "s" : ""}`);

  return { score, notes };
}

function scoreMomentum(f) {
  // Derive streaks from fight_history to avoid stale pre-computed values
  const derived = deriveFightHistoryStats(f);
  const winStreak = derived ? derived.current_win_streak : (f.current_win_streak ?? 0);
  const lossStreak = derived ? derived.current_loss_streak : (f.current_loss_streak ?? 0);
  const longestStreak = f.longest_win_streak ?? 0;
  const lastResult = f.last_fight_result ?? "";

  const streakScore = winStreak > 0
    ? norm(winStreak, 0, 8)
    : (lossStreak > 0 ? 100 - norm(lossStreak, 0, 4) : 50);
  const longestScore = norm(longestStreak, 0, 10);
  const lastResultScore = lastResult.toLowerCase().startsWith("w") ? 75
    : (lastResult.toLowerCase().startsWith("l") ? 25 : 50);

  const score = streakScore * 0.5 + lastResultScore * 0.3 + longestScore * 0.2;

  const notes = [];
  if (winStreak >= 3) notes.push(`on a ${winStreak}-fight win streak`);
  else if (winStreak === 2) notes.push("won last 2 fights");
  if (lossStreak >= 2) notes.push(`on a ${lossStreak}-fight losing skid`);
  if (lastResult) notes.push(`last result: ${lastResult}`);

  return { score, notes };
}

function scorePhysical(f, opponent) {
  const h1 = parseHeight(f.height);
  const h2 = parseHeight(opponent.height);
  const r1 = parseReach(f.reach);
  const r2 = parseReach(opponent.reach);
  const age = f.age ?? 30;
  const stance = (f.stance || "").toLowerCase();
  const oppStance = (opponent.stance || "").toLowerCase();

  let heightAdv = 50, reachAdv = 50;
  if (h1 != null && h2 != null) {
    heightAdv = clamp(50 + (h1 - h2) * 5, 20, 80);
  }
  if (r1 != null && r2 != null) {
    reachAdv = clamp(50 + (r1 - r2) * 4, 20, 80);
  }

  let ageScore;
  if (age >= 28 && age <= 32) ageScore = 80;
  else if (age >= 25 && age <= 35) ageScore = 65;
  else if (age < 25) ageScore = 50;
  else ageScore = Math.max(20, 80 - (age - 32) * 5);

  const stanceScore = (stance === "southpaw" && oppStance === "orthodox") ? 60
    : (stance === "orthodox" && oppStance === "southpaw") ? 40 : 50;

  const score = reachAdv * 0.35 + heightAdv * 0.2 + ageScore * 0.3 + stanceScore * 0.15;

  const notes = [];
  if (r1 && r2 && Math.abs(r1 - r2) >= 2) {
    notes.push(`${r1 > r2 ? "+" : ""}${r1 - r2}" reach ${r1 > r2 ? "advantage" : "disadvantage"}`);
  }
  if (h1 && h2 && Math.abs(h1 - h2) >= 2) {
    notes.push(`${h1 > h2 ? "taller" : "shorter"} by ${Math.abs(h1 - h2)}"`);
  }
  if (age >= 36) notes.push(`age concern at ${age}`);
  else if (age >= 28 && age <= 32) notes.push(`in prime fighting years (${age})`);
  else if (age < 25) notes.push(`young prospect (${age})`);
  if (stance === "southpaw") notes.push("southpaw stance advantage vs orthodox");

  return { score, notes };
}

function scoreFightHistory(f) {
  const history = f.fight_history || [];
  if (history.length === 0) return { score: 50, notes: ["no fight history data"] };

  const proFights = history.filter((h) => h.fight_type === "pro");
  const recent5 = proFights.slice(0, 5);
  const wins = recent5.filter((h) => h.result === "win");
  const koFinishes = wins.filter((h) => h.method && /KO|TKO/i.test(h.method));
  const subFinishes = wins.filter((h) => h.method && /submission/i.test(h.method));
  const r1Finishes = wins.filter((h) => h.round === "1");

  const last3 = proFights.slice(0, 3);
  const recentWins = last3.filter((h) => h.result === "win").length;
  const trajectoryScore = norm(recentWins, 0, 3);

  const finishCount = koFinishes.length + subFinishes.length;
  const finishScore = norm(finishCount, 0, 4);

  const score = trajectoryScore * 0.5 + finishScore * 0.3 + norm(Math.min(proFights.length, 20), 0, 20) * 0.2;

  const notes = [];
  if (recentWins === 3) notes.push("won all last 3 fights");
  else if (recentWins === 0 && last3.length >= 3) notes.push("lost all last 3 fights");
  if (koFinishes.length >= 2) notes.push(`${koFinishes.length} KO/TKOs in last 5`);
  if (subFinishes.length >= 2) notes.push(`${subFinishes.length} subs in last 5`);
  if (r1Finishes.length >= 2) notes.push("multiple first-round finishes recently");
  if (proFights.length < 5) notes.push(`limited pro experience (${proFights.length} fights)`);

  return { score, notes };
}

function scoreStyleMatchup(f, opponent) {
  const s = f.stats || {};
  const os = opponent.stats || {};
  let score = 50;
  const notes = [];

  const slpm = s.slpm ?? 0;
  const oppDef = _parsePct(os.striking_defense) ?? 55;
  if (slpm >= 4 && oppDef < 50) {
    score += 12;
    notes.push(`high output (${slpm.toFixed(1)} SLpM) vs weak defense (${oppDef.toFixed(0)}%)`);
  } else if (slpm >= 3 && oppDef < 45) {
    score += 8;
    notes.push("solid output vs porous defense");
  }

  const tdAvg = s.td_avg ?? 0;
  const oppTdDef = _parsePct(os.td_defense) ?? 60;
  if (tdAvg >= 2 && oppTdDef < 55) {
    score += 12;
    notes.push(`active wrestler (${tdAvg.toFixed(1)} TD avg) vs poor TD defense (${oppTdDef.toFixed(0)}%)`);
  } else if (tdAvg >= 1.5 && oppTdDef < 50) {
    score += 8;
    notes.push("wrestling advantage vs weak TD defense");
  }

  const subWins = f.wins_submission ?? 0;
  const oppSubDef = os.implied_sub_def_pct ?? 80;
  if (subWins >= 3 && oppSubDef < 70) {
    score += 8;
    notes.push(`submission threat (${subWins} sub wins) vs questionable sub defense`);
  }

  const kdRate = s.avg_kd_per_fight ?? 0;
  if (kdRate >= 0.5 && oppDef < 50) {
    score += 6;
    notes.push("KO threat — high KD rate vs hittable opponent");
  }

  const ctrl = s.avg_ctrl_secs ?? 0;
  const oppCtrl = os.avg_opp_ctrl_secs ?? 30;
  if (ctrl >= 120 && oppCtrl >= 90) {
    score += 6;
    notes.push("likely to dominate on the ground if fight goes there");
  }

  const bodyPct = s.body_str_pct ?? 0;
  const legPct = s.leg_str_pct ?? 0;
  if (bodyPct + legPct >= 40) {
    notes.push("diversified attack (body + legs)");
    score += 3;
  }

  return { score: clamp(score, 0, 100), notes };
}


// ─── Main Prediction Engine ─────────────────────────────────────────────────

const WEIGHTS = {
  strikingOffense:  0.15,
  strikingDefense:  0.12,
  grapplingOffense: 0.13,
  grapplingDefense: 0.10,
  finishing:        0.12,
  record:           0.10,
  momentum:         0.08,
  physical:         0.08,
  fightHistory:     0.05,
  styleMatchup:     0.07,
};

const CAT_LABELS = {
  strikingOffense: "Striking Offense",
  strikingDefense: "Striking Defense",
  grapplingOffense: "Grappling Offense",
  grapplingDefense: "Grappling Defense",
  finishing: "Finishing Ability",
  record: "Record & Experience",
  momentum: "Momentum",
  physical: "Physical Attributes",
  fightHistory: "Fight History",
  styleMatchup: "Style Matchup",
};

/**
 * predictFight(f1, f2) — Full prediction for one matchup.
 *
 * Returns {
 *   winner: { name, score, winProb },
 *   loser:  { name, score, winProb },
 *   confidence: "lock" | "strong" | "lean" | "tossup",
 *   margin: number (0–100),
 *   categories: { ... scored breakdown for both fighters },
 *   catWins: { winner: [], loser: [], tied: [] },
 *   catLabels: { ... },
 *   narrative: string,
 * }
 */
export function predictFight(f1, f2) {
  const cats1 = {
    strikingOffense:  scoreStrikingOffense(f1),
    strikingDefense:  scoreStrikingDefense(f1),
    grapplingOffense: scoreGrapplingOffense(f1),
    grapplingDefense: scoreGrapplingDefense(f1),
    finishing:        scoreFinishing(f1),
    record:           scoreRecordExperience(f1),
    momentum:         scoreMomentum(f1),
    physical:         scorePhysical(f1, f2),
    fightHistory:     scoreFightHistory(f1),
    styleMatchup:     scoreStyleMatchup(f1, f2),
  };
  const cats2 = {
    strikingOffense:  scoreStrikingOffense(f2),
    strikingDefense:  scoreStrikingDefense(f2),
    grapplingOffense: scoreGrapplingOffense(f2),
    grapplingDefense: scoreGrapplingDefense(f2),
    finishing:        scoreFinishing(f2),
    record:           scoreRecordExperience(f2),
    momentum:         scoreMomentum(f2),
    physical:         scorePhysical(f2, f1),
    fightHistory:     scoreFightHistory(f2),
    styleMatchup:     scoreStyleMatchup(f2, f1),
  };

  let total1 = 0, total2 = 0;
  const breakdown1 = {}, breakdown2 = {};
  for (const [cat, weight] of Object.entries(WEIGHTS)) {
    const s1 = cats1[cat].score;
    const s2 = cats2[cat].score;
    total1 += s1 * weight;
    total2 += s2 * weight;
    breakdown1[cat] = { score: Math.round(s1), notes: cats1[cat].notes };
    breakdown2[cat] = { score: Math.round(s2), notes: cats2[cat].notes };
  }

  total1 = Math.round(total1 * 10) / 10;
  total2 = Math.round(total2 * 10) / 10;

  // Sigmoid-style win probability
  const diff = total1 - total2;
  const winProb1 = 1 / (1 + Math.pow(10, -diff / 25));
  const winProb2 = 1 - winProb1;

  const margin = Math.abs(diff);
  let confidence;
  if (margin >= 12) confidence = "lock";
  else if (margin >= 7) confidence = "strong";
  else if (margin >= 3) confidence = "lean";
  else confidence = "tossup";

  const isF1 = total1 >= total2;
  const winner = {
    name: isF1 ? f1.name : f2.name,
    score: isF1 ? total1 : total2,
    winProb: Math.round((isF1 ? winProb1 : winProb2) * 100),
  };
  const loser = {
    name: isF1 ? f2.name : f1.name,
    score: isF1 ? total2 : total1,
    winProb: Math.round((isF1 ? winProb2 : winProb1) * 100),
  };

  const catNames = Object.keys(WEIGHTS);
  const wCats = isF1 ? cats1 : cats2;
  const lCats = isF1 ? cats2 : cats1;
  const wBreak = isF1 ? breakdown1 : breakdown2;
  const lBreak = isF1 ? breakdown2 : breakdown1;

  const catWins = { winner: [], loser: [], tied: [] };
  for (const cat of catNames) {
    const ws = wBreak[cat].score;
    const ls = lBreak[cat].score;
    if (ws > ls + 3) catWins.winner.push(cat);
    else if (ls > ws + 3) catWins.loser.push(cat);
    else catWins.tied.push(cat);
  }

  const narrative = buildNarrative(
    { name: winner.name, cats: wCats, breakdown: wBreak, winProb: winner.winProb },
    { name: loser.name, cats: lCats, breakdown: lBreak, winProb: loser.winProb },
    catWins,
    CAT_LABELS,
    confidence,
    margin,
  );

  return {
    winner,
    loser,
    confidence,
    margin: Math.round(margin * 10) / 10,
    categories: {
      [winner.name]: wBreak,
      [loser.name]: lBreak,
    },
    catWins,
    catLabels: CAT_LABELS,
    narrative,
  };
}

// ─── Narrative Builder ──────────────────────────────────────────────────────

function buildNarrative(w, l, catWins, catLabels, confidence, margin) {
  const wLast = lastName(w.name);
  const lLast = lastName(l.name);
  const lines = [];

  const confWords = {
    lock: "is the clear favorite",
    strong: "holds a significant edge",
    lean: "has a slight advantage",
    tossup: "faces a near coin-flip matchup against",
  };
  if (confidence === "tossup") {
    lines.push(`${wLast} ${confWords[confidence]} ${lLast} — the model gives ${wLast} a thin ${w.winProb}% win probability.`);
  } else {
    lines.push(`${wLast} ${confWords[confidence]} at ${w.winProb}% win probability.`);
  }

  const wAdvCats = catWins.winner.slice(0, 3);
  if (wAdvCats.length > 0) {
    const advNames = wAdvCats.map((c) => catLabels[c]);
    const advDetails = [];
    for (const cat of wAdvCats) {
      const topNotes = w.cats[cat].notes.slice(0, 2);
      if (topNotes.length > 0) advDetails.push(...topNotes);
    }
    lines.push(`Key strengths: wins ${advNames.join(", ")} categories${advDetails.length > 0 ? " — " + advDetails.slice(0, 3).join("; ") : ""}.`);
  }

  const lAdvCats = catWins.loser.slice(0, 2);
  if (lAdvCats.length > 0) {
    const lAdvNames = lAdvCats.map((c) => catLabels[c]);
    const lDetails = [];
    for (const cat of lAdvCats) {
      const topNotes = l.cats[cat].notes.slice(0, 2);
      if (topNotes.length > 0) lDetails.push(...topNotes);
    }
    lines.push(`${lLast}'s path to victory: ${lAdvNames.join(", ")}${lDetails.length > 0 ? " — " + lDetails.slice(0, 2).join("; ") : ""}.`);
  }

  const wStyleNotes = w.cats.styleMatchup.notes;
  const lStyleNotes = l.cats.styleMatchup.notes;
  if (wStyleNotes.length > 0) {
    lines.push(`Matchup edge: ${wStyleNotes[0]}.`);
  } else if (lStyleNotes.length > 0) {
    lines.push(`Watch for: ${lStyleNotes[0]}.`);
  }

  const wRecNotes = w.cats.record.notes;
  const lRecNotes = l.cats.record.notes;
  if (wRecNotes.length >= 1 && lRecNotes.length >= 1) {
    lines.push(`Records: ${wLast} ${wRecNotes[0]}${wRecNotes[1] ? " (" + wRecNotes[1] + ")" : ""} vs ${lLast} ${lRecNotes[0]}${lRecNotes[1] ? " (" + lRecNotes[1] + ")" : ""}.`);
  }

  const wMomNotes = w.cats.momentum.notes.filter((n) => !n.startsWith("last result"));
  const lMomNotes = l.cats.momentum.notes.filter((n) => !n.startsWith("last result"));
  if (wMomNotes.length > 0 || lMomNotes.length > 0) {
    const parts = [];
    if (wMomNotes.length > 0) parts.push(`${wLast} ${wMomNotes[0]}`);
    if (lMomNotes.length > 0) parts.push(`${lLast} ${lMomNotes[0]}`);
    lines.push(`Momentum: ${parts.join(" while ")}.`);
  }

  const wPhysNotes = w.cats.physical.notes;
  if (wPhysNotes.length > 0) {
    lines.push(`Physical: ${wPhysNotes.slice(0, 2).join(", ")}.`);
  }

  return lines.join(" ");
}

// ─── Batch Predictor ────────────────────────────────────────────────────────

/**
 * predictAllFights(fights) — Predict every fight on the card.
 */
export function predictAllFights(fights) {
  if (!fights || fights.length === 0) return [];
  return fights
    .filter((fight) => fight.fighters && fight.fighters.length >= 2)
    .map((fight) => {
      const [f1, f2] = fight.fighters;
      return {
        fightId: fight.fight_id,
        matchup: fight.matchup || `${f1.name} vs ${f2.name}`,
        weightClass: fight.weight_class || f1.weight_class || "",
        prediction: predictFight(f1, f2),
      };
    });
}

// ─── Confidence Level Styling ───────────────────────────────────────────────

export const CONFIDENCE_LEVELS = {
  lock: {
    label: "HIGH CONFIDENCE",
    badge: "bg-emerald-700 text-emerald-100",
    border: "border-emerald-600/60",
    bg: "bg-emerald-950/30",
    glow: "shadow-emerald-500/20 shadow-lg",
    dot: "bg-emerald-400",
    icon: "🟢",
    barColor: "bg-emerald-500",
  },
  strong: {
    label: "CONFIDENT",
    badge: "bg-sky-700 text-sky-100",
    border: "border-sky-600/50",
    bg: "bg-sky-950/20",
    glow: "",
    dot: "bg-sky-400",
    icon: "🔵",
    barColor: "bg-sky-500",
  },
  lean: {
    label: "SLIGHT LEAN",
    badge: "bg-amber-700 text-amber-100",
    border: "border-amber-600/50",
    bg: "bg-amber-950/20",
    glow: "",
    dot: "bg-amber-400",
    icon: "🟡",
    barColor: "bg-amber-500",
  },
  tossup: {
    label: "TOSS-UP",
    badge: "bg-stone-600 text-stone-200",
    border: "border-stone-600/50",
    bg: "bg-stone-900/40",
    glow: "",
    dot: "bg-stone-400",
    icon: "⚪",
    barColor: "bg-stone-500",
  },
};

// ─── Legacy exports (backward compat) ───────────────────────────────────────
export const _evalAngle = () => ({ level: "neutral", label: "", tip: "" });
export const _evalSubAngle = () => ({ level: "neutral", label: "", tip: "" });
export const _computeAngles = (f1, f2) => [
  { attacker: f1.name, defender: f2.name, angles: [] },
  { attacker: f2.name, defender: f1.name, angles: [] },
];
export const _LEVEL = {
  strong: { dot: "bg-red-500", border: "border-red-700/60", bg: "bg-red-950/50", badge: "bg-red-700 text-red-100", label: "Exploit" },
  moderate: { dot: "bg-orange-400", border: "border-orange-700/50", bg: "bg-orange-950/30", badge: "bg-orange-800 text-orange-100", label: "Edge" },
  neutral: { dot: "bg-stone-600", border: "border-stone-700", bg: "bg-stone-900/40", badge: "bg-stone-700 text-stone-300", label: "Even" },
};
