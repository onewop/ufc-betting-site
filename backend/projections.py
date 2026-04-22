"""
backend/projections.py — Matchup-aware DFS projection engine.

Replaces raw DK career averages with projections that account for:
  - Opponent defensive vulnerabilities (striking, grappling, sub defense)
  - Fighter finish rates and method-of-victory profiles
  - Recent form (last-5 record, win/loss streaks)
  - Fight duration estimates (finish rate → expected rounds → scoring volume)
  - Weight-class scoring profiles (HW finishes > FW decisions)
  - Betting odds implied win probability (when available)
  - DraftKings MMA scoring rules

DK MMA Scoring Reference:
  Significant Strikes Landed    +0.5 each
  Knockdowns                    +10 each
  Takedowns                     +5 each
  Submission Attempts           +3 each
  Advances/Reversals            +3/+5 each
  Fight Win                     +50
  Win by KO/TKO                 +50 bonus (total 100)
  Win by Submission              +40 bonus (total 90)
  Win by Decision                +30 bonus (total 80)
  Significant Strikes Absorbed  −0.5 each (penalty removed in some slates)

Used by: backend/optimizer.py, backend/routers/optimize.py (projections endpoint)
"""
from __future__ import annotations

import json
import logging
import re
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)

# From backend/ → parent = repo root → public/
# Falls back to filesystem scan if the standard paths miss (Railway layout varies)
_STATS_PATH = next(
    (p for p in [
        Path("/app/public/this_weeks_stats.json"),
        Path(__file__).resolve().parent.parent / "public" / "this_weeks_stats.json",
    ] if p.exists()),
    Path("/app/public/this_weeks_stats.json"),  # best-guess default for error messages
)


# ═══════════════════════════════════════════════════════════════════════════
# Weight-class scoring multipliers
# HW and LHW produce more finishes and higher striking damage → higher ceilings
# Lighter classes tend toward longer fights with more volume but fewer finishes
# ═══════════════════════════════════════════════════════════════════════════
_WEIGHT_CLASS_MULTIPLIER: dict[str, float] = {
    "Heavyweight":       1.10,
    "Light Heavyweight": 1.08,
    "Middleweight":      1.03,
    "Welterweight":      1.00,
    "Lightweight":       1.00,
    "Featherweight":     0.98,
    "Bantamweight":      0.97,
    "Flyweight":         0.95,
    "Women's Strawweight":     0.93,
    "Women's Flyweight":       0.95,
    "Women's Bantamweight":    0.97,
    "Women's Featherweight":   0.98,
}


def _parse_pct(val: Any) -> float:
    """Parse a percentage string like '56%' or 'N/A' to a float 0-100."""
    if val is None or val == "N/A":
        return 50.0  # neutral default
    if isinstance(val, (int, float)):
        return float(val)
    m = re.search(r"([\d.]+)", str(val))
    return float(m.group(1)) if m else 50.0


def _parse_record_last_5(record_str: str | None) -> tuple[int, int]:
    """Parse '3-2' → (3, 2). Returns (0, 0) on failure."""
    if not record_str:
        return 0, 0
    m = re.match(r"(\d+)-(\d+)", str(record_str))
    if m:
        return int(m.group(1)), int(m.group(2))
    return 0, 0


def _estimate_rounds(fighter: dict, opponent: dict, fight: dict) -> float:
    """Estimate expected fight duration in rounds (1.0 – 3.0 for 3-rounders)."""
    # 1. Use betting odds O/U if available
    bo = fight.get("betting_odds", {})
    if bo:
        ou = bo.get("over_under_rounds")
        if ou and ou != "N/A":
            m = re.search(r"([\d.]+)", str(ou))
            if m:
                return float(m.group(1))

    # 2. Average fight duration from both fighters
    durations = []
    for f in [fighter, opponent]:
        dur = f.get("avg_fight_duration")
        if dur and isinstance(dur, (int, float)) and dur > 0:
            durations.append(min(max(dur / 5.0, 1.0), 3.0))  # minutes → rounds
    if durations:
        return sum(durations) / len(durations)

    # 3. Finish-rate based estimate
    rates = []
    for f in [fighter, opponent]:
        fr = f.get("finish_rate_pct")
        if fr is not None and fr != "N/A":
            fr_val = float(fr)
            if fr_val >= 70:
                rates.append(1.5)
            elif fr_val >= 50:
                rates.append(2.0)
            elif fr_val >= 25:
                rates.append(2.5)
            else:
                rates.append(3.0)
    if rates:
        return sum(rates) / len(rates)

    return 2.5  # fallback


def _win_probability(fighter: dict, opponent: dict, fight: dict) -> float:
    """
    Estimate win probability (0.0 - 1.0) for the fighter.
    Priority: betting odds moneyline → salary ratio → record-based estimate.
    """
    bo = fight.get("betting_odds", {})

    # 1. Moneyline-based (most accurate when available)
    ml_str = bo.get("moneyline") if bo else None
    if ml_str and ml_str != "N/A":
        # Try to parse fighter-specific moneyline
        # Format varies: could be dict or string
        if isinstance(ml_str, dict):
            fighter_ml = ml_str.get(fighter.get("name"))
            if fighter_ml is not None:
                try:
                    odds = float(fighter_ml)
                    if odds < 0:
                        return abs(odds) / (abs(odds) + 100)
                    else:
                        return 100 / (odds + 100)
                except (ValueError, TypeError):
                    pass

    # 2. Salary ratio as proxy (DK prices imply win probability)
    f_sal = fighter.get("salary", 0) or 0
    o_sal = opponent.get("salary", 0) or 0
    if f_sal > 0 and o_sal > 0:
        total = f_sal + o_sal
        # Salary ratio with mild regression toward 50%
        raw_prob = f_sal / total
        return 0.35 + raw_prob * 0.30  # maps [0.4-0.6] salary ratio → [0.47-0.53]

    return 0.50


def _finish_probability(fighter: dict, opponent: dict, fight: dict | None = None) -> float:
    """Estimate probability this fighter wins by finish (KO/TKO or Sub)."""
    # 1. Use method-specific betting odds when available (most accurate signal)
    if fight:
        bo = fight.get("betting_odds", {})
        if bo:
            # Determine if this fighter is fighter1 or fighter2 in the fight record
            fight_fighters = fight.get("fighters", [])
            is_fighter1 = (
                len(fight_fighters) > 0
                and fight_fighters[0].get("name") == fighter.get("name")
            )
            prefix = "fighter1" if is_fighter1 else "fighter2"
            ko_odds = bo.get(f"{prefix}_ko_odds")
            sub_odds = bo.get(f"{prefix}_sub_odds")
            dec_odds = bo.get(f"{prefix}_decision_odds")

            if ko_odds and sub_odds and dec_odds and ko_odds != "N/A":
                try:
                    def _ml_to_prob(ml: Any) -> float:
                        v = float(ml)
                        return abs(v) / (abs(v) + 100) if v < 0 else 100 / (v + 100)

                    ko_p = _ml_to_prob(ko_odds)
                    sub_p = _ml_to_prob(sub_odds)
                    dec_p = _ml_to_prob(dec_odds)
                    total = ko_p + sub_p + dec_p
                    if total > 0:
                        return min((ko_p + sub_p) / total, 0.95)
                except (ValueError, TypeError):
                    pass

    # 2. Stats-based fallback
    fr = fighter.get("finish_rate_pct")
    if fr is not None and fr != "N/A":
        fighter_finish_rate = float(fr) / 100.0
    else:
        ko = fighter.get("wins_ko_tko", 0) or 0
        sub = fighter.get("wins_submission", 0) or 0
        dec = fighter.get("wins_decision", 0) or 0
        total = ko + sub + dec
        fighter_finish_rate = (ko + sub) / total if total > 0 else 0.50

    # Opponent vulnerability: their loss rate by finish
    opp_losses = opponent.get("losses", 0) or 0
    opp_wins = opponent.get("wins", 0) or 0
    opp_total = opp_wins + opp_losses
    opp_loss_rate = opp_losses / opp_total if opp_total > 0 else 0.50

    # Blend: fighter's finishing ability + opponent's vulnerability
    return min(fighter_finish_rate * 0.6 + opp_loss_rate * 0.4, 0.95)


def _striking_projection(fighter: dict, opponent: dict, rounds: float) -> float:
    """Project DK points from significant strikes."""
    slpm = fighter.get("stats", {}).get("slpm") or 0
    if not slpm:
        return 0.0

    # Opponent striking defense: lower = more strikes land
    opp_str_def = _parse_pct(opponent.get("stats", {}).get("striking_defense"))
    def_factor = 1.0 + (50.0 - opp_str_def) / 100.0  # avg defense → 1.0, bad defense → 1.5

    # Fighter accuracy
    accuracy = _parse_pct(fighter.get("stats", {}).get("striking_accuracy"))
    acc_factor = accuracy / 50.0  # normalize to avg=1.0

    # Net striking edge: fighters who land much more than they absorb get a bonus
    # sapm = significant strikes absorbed per minute (lower is better defensively)
    sapm = fighter.get("stats", {}).get("sapm") or 0
    if sapm > 0 and slpm > 0:
        net_rate = (slpm - sapm) / slpm  # positive = lands more than absorbs
        edge_factor = 1.0 + max(min(net_rate * 0.3, 0.25), -0.15)
    else:
        edge_factor = 1.0

    # Sig strikes per round, adjusted for opponent defense, accuracy, and net edge
    adjusted_slpm = slpm * def_factor * acc_factor * edge_factor * 0.7  # 0.7 = conservative blending
    sig_strikes = adjusted_slpm * 5.0 * rounds  # 5 min per round

    return sig_strikes * 0.5  # DK: 0.5 pts per sig strike landed


def _grappling_projection(fighter: dict, opponent: dict, rounds: float) -> float:
    """Project DK points from takedowns and submission attempts."""
    td_avg = fighter.get("stats", {}).get("td_avg") or 0
    if not td_avg:
        sub_attempts = fighter.get("avg_sub_attempts", 0) or 0
        return sub_attempts * rounds * 3.0  # 3 pts per sub attempt

    # Opponent TD defense
    opp_td_def = _parse_pct(opponent.get("stats", {}).get("td_defense"))
    def_factor = 1.0 + (50.0 - opp_td_def) / 100.0

    # Fighter TD accuracy
    td_acc = _parse_pct(fighter.get("stats", {}).get("td_accuracy"))
    acc_factor = td_acc / 50.0

    # Takedowns per round
    adjusted_td = td_avg * def_factor * acc_factor * 0.6  # conservative blend
    takedowns = adjusted_td * rounds

    # Submission attempts — scale by opponent's submission defense vulnerability
    sub_attempts = fighter.get("avg_sub_attempts", 0) or 0
    opp_sub_def = _parse_pct(opponent.get("stats", {}).get("implied_sub_def_pct"))
    sub_def_factor = 1.0 + (50.0 - opp_sub_def) / 100.0  # weak sub defense → more value
    sub_pts = sub_attempts * rounds * 3.0 * sub_def_factor

    # Control time bonus: average ctrl secs → proxy for advance/position points
    # DK: ~3 pts per advance; sustained control correlates with ground advances
    avg_ctrl_secs = fighter.get("stats", {}).get("avg_ctrl_secs") or 0
    ctrl_bonus = (float(avg_ctrl_secs) / 60.0) * rounds * 0.5  # ~0.5 pts per minute of ctrl per round

    # Reversals: 5 pts each in DK scoring; relatively rare but meaningful
    avg_reversals = fighter.get("stats", {}).get("avg_reversals_per_fight") or 0
    reversal_pts = float(avg_reversals) * rounds / 2.5 * 5.0

    return takedowns * 5.0 + sub_pts + ctrl_bonus + reversal_pts  # DK: 5 pts per TD


def _form_adjustment(fighter: dict) -> float:
    """
    Adjustment based on recent form.
    Range: roughly -6.0 to +6.0 points.
    """
    adj = 0.0

    # Last-5 record
    wins, losses = _parse_record_last_5(fighter.get("record_last_5"))
    if wins + losses > 0:
        adj += (wins - losses) * 1.2  # +6 for 5-0, -6 for 0-5

    # Win/loss streak intensity
    win_streak = fighter.get("current_win_streak", 0) or 0
    loss_streak = fighter.get("current_loss_streak", 0) or 0
    if win_streak >= 3:
        adj += min(win_streak - 2, 3) * 1.0  # +1 to +3 for 3-5+ streak
    if loss_streak >= 2:
        adj -= min(loss_streak, 3) * 1.5  # -3 to -4.5 for 2-3+ streak

    return adj


def _knockdown_bonus(fighter: dict, opponent: dict, rounds: float) -> float:
    """Estimate knockdown scoring bonus."""
    # Prefer direct avg_kd_per_fight stat when available (more accurate than estimate)
    avg_kd = fighter.get("stats", {}).get("avg_kd_per_fight") or 0
    if avg_kd > 0:
        kd_per_fight = float(avg_kd)
    else:
        ko_wins = fighter.get("wins_ko_tko", 0) or 0
        total_wins = (fighter.get("wins", 0) or 0)
        if total_wins == 0:
            return 0.0
        # Estimate: high-volume, high-KO-rate strikers generate ~0.3-0.8 KD per fight
        ko_rate = ko_wins / total_wins
        slpm = fighter.get("stats", {}).get("slpm") or 0
        kd_per_fight = ko_rate * (slpm / 5.0) * 0.15  # conservative

    return kd_per_fight * rounds / 2.5 * 10.0  # DK: 10 pts per knockdown


# ═══════════════════════════════════════════════════════════════════════════
# Strategy edge scores (used by wrestling_advantage / striking_advantage)
# ═══════════════════════════════════════════════════════════════════════════

def _wrestling_edge_score(fighter: dict, opponent: dict) -> float:
    """
    Balanced wrestling edge with robust small-sample correction.
    Dampens inflated stats from fighters with very few/short UFC fights.
    Duration dampener only applies to low-experience fighters (< 12 wins).

    Key design decisions:
      - avg_fight_duration and record are TOP-LEVEL fields, not inside stats{}.
      - Duration dampener is gated on total_pro_fights < 12 so experienced
        finishers (Blaydes: 19 wins, 8.9 min avg) are not penalised for
        ending fights early — only true small-sample cases like Hokit (8 wins,
        dur=None) are caught.
      - td_def_factor floored at 0.25 (raised from 0.10): prevents a 100% TD
        defense from a tiny sample (Hokit: 0 TDs ever attempted against him)
        from nearly zeroing a legitimate grappler's volume projection. A floor
        of 0.25 is still conservative — it implies even a "perfect defender"
        in our data concedes 1 in 4 TD attempts in reality.
      - ctrl_secs dampened only for low-experience fighters (same gate).
    """
    if not fighter or not opponent:
        return 0.0

    stats_f = fighter.get("stats", {}) or {}
    stats_o = opponent.get("stats", {}) or {}

    # ── Fighter A offense ────────────────────────────────────────────────
    td_avg_raw = float(stats_f.get("td_avg", 0) or 0)
    td_acc = _parse_pct(stats_f.get("td_accuracy")) / 100.0        # 0.0–1.0

    # ── Fighter B defense — may be string like "73%" ──────────────────────
    # Floor at 0.25: a 100% TD-defense in a tiny sample should not nearly zero
    # out a legitimate grappler's volume projection against that opponent.
    td_def_b = _parse_pct(stats_o.get("td_defense"))                # 0–100
    td_def_factor = max(0.25, (100.0 - td_def_b) / 100.0)          # 0.25–1.0

    # ── Small-sample dampener ─────────────────────────────────────────────
    # avg_fight_duration is top-level (minutes). Preserve None as None so we
    # can distinguish "unknown" from "actually very short" — collapsing None→0
    # incorrectly triggers the harshest dampener for fighters whose durations
    # simply aren't in the ufcstats cache yet (e.g. DWCS / pre-UFC fights).
    _afd_raw = fighter.get("avg_fight_duration")
    avg_fight_duration = float(_afd_raw) if _afd_raw is not None else None

    # record is top-level ("8-0-0"). First segment = wins proxy for experience.
    record_str = str(fighter.get("record", "0-0") or "0-0")
    try:
        total_pro_fights = int(record_str.split("-")[0])
    except (ValueError, IndexError):
        total_pro_fights = 0

    sample_factor = 1.0

    # Duration dampener is only applied when experience is limited.
    # This prevents penalising proven finishers (e.g. Blaydes) who have short
    # avg durations simply because they stop fights efficiently.
    if total_pro_fights < 12:
        if avg_fight_duration is None:
            # Duration not in ufcstats cache (pre-UFC / DWCS fights).  Apply a
            # moderate penalty — these fights often contain high-quality wrestling
            # volume (e.g. Hokit's 5–6 TDs vs Uriel in DWCS) that would be
            # unfairly erased by assuming an extremely short fight.
            sample_factor *= 0.65
        elif avg_fight_duration < 7.0:  # Confirmed extremely short fights
            sample_factor *= 0.45
        elif avg_fight_duration < 10.0:
            sample_factor *= 0.70

    # Light career-experience penalty regardless of duration
    if total_pro_fights <= 5:
        sample_factor *= 0.75
    elif total_pro_fights <= 10:
        sample_factor *= 0.90

    adjusted_td_avg = td_avg_raw * sample_factor

    # ── Volume component (5 DK pts per successful TD) ────────────────────
    projected_tds = adjusted_td_avg * td_acc * td_def_factor
    volume_points = projected_tds * 5.0

    # ── Control time component (~3.3 pts per minute of top control) ──────
    # ctrl_secs is also dampened for low-experience fighters only —
    # the same short-fight bias that inflates td_avg inflates ctrl_secs too.
    ctrl_secs_raw = float(stats_f.get("avg_ctrl_secs", 0) or 0)
    adjusted_ctrl_secs = ctrl_secs_raw * sample_factor if total_pro_fights < 12 else ctrl_secs_raw
    control_points = (adjusted_ctrl_secs / 60.0) * 3.3

    # ── Bonuses ──────────────────────────────────────────────────────────
    rev_bonus = float(stats_f.get("avg_reversals_per_fight", 0) or 0) * 2.0
    # avg_sub_attempts lives at top-level, not inside stats{}
    sub_bonus = float(fighter.get("avg_sub_attempts", 0) or 0) * 1.5

    # ── Blend: 48% volume + 42% control + full bonuses ───────────────────
    total = (volume_points * 0.48) + (control_points * 0.42) + rev_bonus + sub_bonus

    return max(total, 0.0)


def _striking_edge_score(fighter: dict, opponent: dict) -> float:
    """
    Striking advantage: Fighter A's offense vs Fighter B's defensive weakness.
    Higher = fighter has more striking upside in this matchup.
    Used by the Striking Edge strategy picker.

    Core formula: (SLpM × accuracy) × (1 − opponent_str_def) × 12 + KD bonus.
    Clean offense-vs-defense framing — no SApM conflation.
    """
    if not fighter or not opponent:
        return 0.0

    stats_f = fighter.get("stats", {}) or {}
    stats_o = opponent.get("stats", {}) or {}

    # ── Fighter A offense ────────────────────────────────────────────────
    slpm_a = float(stats_f.get("slpm", 0) or 0)
    str_acc_a = _parse_pct(stats_f.get("striking_accuracy")) / 100.0  # 0.0–1.0

    # ── Fighter B defense — may be string like "54%" ─────────────────────
    str_def_b = _parse_pct(stats_o.get("striking_defense")) / 100.0   # 0.0–1.0

    # ── Knockdown bonus ──────────────────────────────────────────────────
    avg_kd = float(stats_f.get("avg_kd_per_fight", 0) or 0)
    kd_bonus = avg_kd * 12.0

    # ── Core edge: offense vs defensive weakness ─────────────────────────
    offense_score = slpm_a * str_acc_a
    defense_weakness = 1.0 - str_def_b

    striking_edge = offense_score * defense_weakness * 12.0
    total_edge = striking_edge + kd_bonus

    return max(total_edge, 0.0)


# ═══════════════════════════════════════════════════════════════════════════
# Main projection function
# ═══════════════════════════════════════════════════════════════════════════

def project_fighter(
    fighter: dict,
    opponent: dict,
    fight: dict,
) -> dict[str, Any]:
    """
    Build a matchup-adjusted DFS projection for one fighter.

    Returns dict with:
      - proj_fppg: float          — projected fantasy points (main number)
      - proj_low: float           — floor estimate (~85% of proj)
      - proj_high: float          — ceiling estimate (~115% of proj)
      - proj_components: dict     — breakdown of where points come from
      - reasoning: str            — human-readable explanation
      - win_prob: float           — estimated win probability 0-1
      - finish_prob: float        — estimated probability of winning by finish
      - est_rounds: float         — expected fight duration in rounds
      - confidence: str           — "high" | "medium" | "low" based on data quality
    """
    name = fighter.get("name", "Unknown")
    salary = fighter.get("salary", 0) or 0
    base_fppg = fighter.get("avgPointsPerGame") or fighter.get("avgFPPG") or 0

    est_rounds = _estimate_rounds(fighter, opponent, fight)
    win_prob = _win_probability(fighter, opponent, fight)
    finish_prob = _finish_probability(fighter, opponent, fight)

    weight_class = fight.get("weight_class") or fighter.get("weight_class") or "N/A"
    wc_mult = _WEIGHT_CLASS_MULTIPLIER.get(weight_class, 1.0)

    # ── Component projections ────────────────────────────────────────────
    striking_pts = _striking_projection(fighter, opponent, est_rounds)
    grappling_pts = _grappling_projection(fighter, opponent, est_rounds)
    kd_pts = _knockdown_bonus(fighter, opponent, est_rounds)
    form_adj = _form_adjustment(fighter)

    # Win bonus: 50 base + method bonus (KO=50, Sub=40, Dec=30)
    ko_wins = fighter.get("wins_ko_tko", 0) or 0
    sub_wins = fighter.get("wins_submission", 0) or 0
    dec_wins = fighter.get("wins_decision", 0) or 0
    total_wins = ko_wins + sub_wins + dec_wins

    if total_wins > 0:
        avg_method_bonus = (ko_wins * 50 + sub_wins * 40 + dec_wins * 30) / total_wins
    else:
        avg_method_bonus = 35.0  # default blend

    win_bonus_pts = win_prob * (50.0 + finish_prob * avg_method_bonus)

    # Combine components
    component_total = (striking_pts + grappling_pts + kd_pts + win_bonus_pts + form_adj) * wc_mult

    # ── Blend with DK historical average ─────────────────────────────────
    # If we have DK history, blend our model with the historical average.
    # This prevents wild deviations while still improving on raw averages.
    if base_fppg > 0:
        # Scale DK avg by expected fight length
        dk_scaled = base_fppg * (est_rounds / 2.5)
        # 55% model, 45% historical — model gets more weight as we add more data
        proj = component_total * 0.55 + dk_scaled * 0.45
        confidence = "high"
    else:
        # No DK history — use pure model with salary anchor
        salary_anchor = 48.0 + max(0, salary - 7500) * 0.005
        proj = component_total * 0.65 + salary_anchor * 0.35
        confidence = "low"

    # Apply floor
    proj = max(proj, 10.0)

    # ── Build reasoning ──────────────────────────────────────────────────
    reasoning_parts = []

    slpm = fighter.get("stats", {}).get("slpm") or 0
    td_avg = fighter.get("stats", {}).get("td_avg") or 0
    opp_name = opponent.get("name", "opponent")
    opp_td_def = _parse_pct(opponent.get("stats", {}).get("td_defense"))
    opp_str_def = _parse_pct(opponent.get("stats", {}).get("striking_defense"))

    # 1. Win probability context (most actionable first)
    if win_prob >= 0.60:
        reasoning_parts.append(f"Solid favorite ({win_prob:.0%} implied win)")
    elif win_prob <= 0.40:
        reasoning_parts.append(f"Live underdog ({win_prob:.0%} implied win)")

    # 2. Key style traits
    if slpm > 4.5:
        reasoning_parts.append(f"High-volume striker ({slpm:.1f} SLpM)")
    if td_avg > 3.0:
        reasoning_parts.append(f"Active wrestler ({td_avg:.1f} TD/15min)")

    # 3. Opponent matchup weaknesses
    if opp_td_def < 45:
        reasoning_parts.append(f"{opp_name} weak TD defense ({opp_td_def:.0f}%)")
    if opp_str_def < 45:
        reasoning_parts.append(f"{opp_name} porous striking defense ({opp_str_def:.0f}%)")

    # 4. Finish threat
    fr = fighter.get("finish_rate_pct")
    if fr and fr != "N/A" and float(fr) >= 60:
        reasoning_parts.append(f"{float(fr):.0f}% career finish rate")

    # 5. Recent form
    wins_l5, losses_l5 = _parse_record_last_5(fighter.get("record_last_5"))
    if wins_l5 + losses_l5 > 0:
        reasoning_parts.append(f"Last 5: {wins_l5}-{losses_l5}")

    # 6. DK historical baseline (last — context only)
    if base_fppg > 0:
        reasoning_parts.append(f"DK avg {base_fppg:.1f} pts")
    else:
        reasoning_parts.append("UFC debut / no DK history")

    reasoning = "\n".join(reasoning_parts)

    proj_low = round(proj * 0.82, 1)
    proj_high = round(proj * 1.20, 1)

    # ── Strategy edge scores (for wrestling/striking advantage pickers) ──
    wrestling_score = _wrestling_edge_score(fighter, opponent)
    striking_score = _striking_edge_score(fighter, opponent)

    return {
        "proj_fppg": round(proj, 2),
        "proj_low": proj_low,
        "proj_high": proj_high,
        "proj_components": {
            "striking": round(striking_pts, 1),
            "grappling": round(grappling_pts, 1),
            "knockdowns": round(kd_pts, 1),
            "win_bonus": round(win_bonus_pts, 1),
            "form_adj": round(form_adj, 1),
            "wc_multiplier": wc_mult,
        },
        "reasoning": reasoning,
        "win_prob": round(win_prob, 3),
        "finish_prob": round(finish_prob, 3),
        "est_rounds": round(est_rounds, 1),
        "confidence": confidence,
        "dk_avg_fppg": base_fppg,
        "wrestling_score": round(wrestling_score, 2),
        "striking_score": round(striking_score, 2),
    }


# ═══════════════════════════════════════════════════════════════════════════
# Pre-UFC Background helpers (for fighters with < 3 UFC fights)
# ═══════════════════════════════════════════════════════════════════════════

def _count_ufc_fights(fighter: dict) -> int:
    """Return how many of a fighter's pro fights were in the UFC."""
    history = fighter.get("fight_history") or []
    return sum(
        1 for h in history
        if h.get("fight_type") == "pro" and h.get("event", "").startswith("UFC")
    )


_ORG_LABELS: list[tuple[str, str]] = [
    ("Contender Series", "DWCS"),
    ("Bellator", "Bellator"),
    ("PFL", "PFL"),
    ("LFA", "LFA"),
    ("RIZIN", "RIZIN"),
    ("ONE ", "ONE Championship"),
    ("Invicta", "Invicta FC"),
    ("Cage Warriors", "Cage Warriors"),
    ("Shooto", "Shooto"),
    ("ACB", "ACB"),
]

# ─── Hand-curated notes for specific fighters ────────────────────────────
# Keys are lowercased fighter names. These override auto-generation entirely
# so notes stay accurate when the fight history lacks per-fight detail.
# Update this dict as new fighters join the card with < 3 UFC fights.
_MANUAL_PRE_UFC_NOTES: dict[str, list[str]] = {
    "josh hokit": [
        "High school state wrestling champion with college wrestling background",
        "Landed 5–6 takedowns vs Guilherme Uriel in DWCS (Aug 2025), finished with ground-and-pound elbows",
        "Multiple submission wins in LFA/Bellator using wrestling setups (3 career sub wins)",
        "Only 2 UFC fights — both very short R1 finishes, inflates TD/15min stat (1 UFC TD total)",
        "Limited UFC sample — projections carry higher uncertainty than established fighters",
    ],
}


# ─── Weekly core-wrestler override for Wrestling Edge strategy ───────────────
# List the EXACT fighter names (any case) you want treated as "Core Wrestlers"
# for this week's Wrestling Edge lineups. Overrides the score-based threshold.
#
# Rules:
#   • If this list is non-empty, ONLY these fighters are eligible for Core.
#   • Fighters not in this list automatically become Fillers.
#   • Because DFS enforces one fighter per fight, opponents of a Core fighter
#     will simply never appear in the same lineup — no extra logic needed.
#   • To revert to automatic score-based selection, set this to an empty list: []
#
# Update each week before generating lineups. Keep the old entries as comments
# so there's a history of which week each configuration was used.
#
# Week of UFC Fight Night - April 25, 2026:
# Previous week (UFC 327 - Apr 11 2026): Tatiana Suarez, Mateusz Gamrot, Josh Hokit
WRESTLING_CORE_OVERRIDE: list[str] = [
    "Michelle Montague",   # Elite grappler: 5.0 TD/15min, 10.7 min ctrl avg
    "Norma Dumont",        # Dominant control game: 332s avg ctrl, wrestling-heavy style
    "Rafa Garcia",         # Active wrestler: 3.4 TD/15min, 187s ctrl
]


def _build_pre_ufc_notes(fighter: dict, ufc_fight_count: int) -> list[str]:
    """Generate up to 5 Pre-UFC Background bullet points for display in the UI.

    Checks _MANUAL_PRE_UFC_NOTES first; falls back to automatic generation.
    """
    name_key = (fighter.get("name") or "").strip().lower()
    if name_key in _MANUAL_PRE_UFC_NOTES:
        return _MANUAL_PRE_UFC_NOTES[name_key]

    notes: list[str] = []
    history = fighter.get("fight_history") or []
    stats = fighter.get("stats") or {}

    # Separate non-UFC pro fights
    non_ufc = [
        h for h in history
        if h.get("fight_type") == "pro" and not h.get("event", "").startswith("UFC")
    ]

    # Key stats
    td_avg = float(stats.get("td_avg", 0) or 0)
    avg_ctrl_secs = float(stats.get("avg_ctrl_secs", 0) or 0)
    ground_str_pct = float(stats.get("ground_str_pct", 0) or 0)

    # ── 1. DWCS callout (highest priority) ───────────────────────────────
    dwcs_wins = [
        h for h in non_ufc
        if "Contender Series" in h.get("event", "") and h.get("result") == "win"
    ]
    if dwcs_wins:
        df = dwcs_wins[0]
        method = df.get("method", "finish")
        opp = df.get("opponent", "")
        rnd = df.get("round", "")
        rnd_str = f" (R{rnd})" if rnd else ""
        method_lower = method.lower()
        is_gnp = any(kw in method_lower for kw in ("elbow", "punch", "tko", "knee"))
        is_sub = "submission" in method_lower
        if is_gnp and ground_str_pct >= 30:
            notes.append(
                f"DWCS contract win: ground-and-pound {method} vs {opp}{rnd_str}"
            )
        elif is_sub:
            notes.append(
                f"DWCS contract win: {method} vs {opp}{rnd_str}"
            )
        else:
            notes.append(
                f"Earned UFC contract via DWCS — {method} vs {opp}{rnd_str}"
            )

    # ── 2. Elite wrestling output ─────────────────────────────────────────
    if td_avg >= 5.0:
        ctrl_str = ""
        if avg_ctrl_secs >= 120:
            ctrl_min = int(avg_ctrl_secs // 60)
            ctrl_sec = int(avg_ctrl_secs % 60)
            ctrl_str = f", {ctrl_min}m {ctrl_sec:02d}s control avg"
        gnp_str = (
            f", {ground_str_pct:.0f}% of strikes landed from ground"
            if ground_str_pct >= 35 else ""
        )
        notes.append(f"Elite wrestler: {td_avg:.1f} TDs/15min{ctrl_str}{gnp_str}")
    elif td_avg >= 2.0 or avg_ctrl_secs >= 90:
        parts: list[str] = []
        if td_avg >= 1.5:
            parts.append(f"{td_avg:.1f} TDs/15min")
        if avg_ctrl_secs >= 60:
            ctrl_min = int(avg_ctrl_secs // 60)
            ctrl_sec = int(avg_ctrl_secs % 60)
            parts.append(f"{ctrl_min}m {ctrl_sec:02d}s ctrl/fight")
        notes.append(f"Active wrestling: {', '.join(parts)}")

    # ── 3. Submission wins pre-UFC ────────────────────────────────────────
    sub_wins = [
        h for h in non_ufc
        if h.get("result") == "win" and "Submission" in h.get("method", "")
    ]
    if sub_wins:
        count = len(sub_wins)
        sub_orgs: list[str] = []
        for org_match, org_label in _ORG_LABELS:
            if org_label == "DWCS":
                continue
            if any(org_match in h.get("event", "") for h in sub_wins):
                if org_label not in sub_orgs:
                    sub_orgs.append(org_label)
        org_str = f" in {'/'.join(sub_orgs[:2])}" if sub_orgs else ""
        if count > 1:
            notes.append(f"{count} submission wins pre-UFC{org_str} — wrestling-based setups")
        else:
            sw = sub_wins[0]
            notes.append(f"Submission win — {sw.get('method', 'Sub')} vs {sw.get('opponent', '')}")

    # ── 4. UFC experience warning (with finish detail when all R1) ────────
    ufc_fights_hist = [
        h for h in history
        if h.get("fight_type") == "pro" and h.get("event", "").startswith("UFC")
    ]
    if ufc_fight_count == 0:
        total = len(non_ufc)
        suffix = f" ({total}-fight pre-UFC record)" if total else ""
        notes.append(f"UFC debut — projections rely entirely on pre-UFC output{suffix}")
    elif ufc_fight_count == 1:
        notes.append("Only 1 UFC fight — octagon sample too small to draw firm conclusions")
    else:
        all_r1 = all(h.get("round") == "1" for h in ufc_fights_hist[:ufc_fight_count])
        if all_r1:
            notes.append(
                f"Only {ufc_fight_count} UFC fights — both early R1 finishes, limited octagon data"
            )
        else:
            notes.append(
                f"Only {ufc_fight_count} UFC fights — limited sample, higher projection uncertainty"
            )

    return notes[:5]


# ═══════════════════════════════════════════════════════════════════════════
# Batch projection: process the full card
# ═══════════════════════════════════════════════════════════════════════════

def project_full_card(stats: dict[str, Any] | None = None) -> list[dict[str, Any]]:
    """
    Run matchup-aware projections on every fighter on this week's card.

    Returns a list of dicts, one per fighter, containing:
      - All fields from project_fighter()
      - Fighter identity: id, name, salary, fight_id, weight_class
      - Opponent name for context
      - Ownership estimate
    """
    if stats is None:
        if not _STATS_PATH.exists():
            raise FileNotFoundError(f"this_weeks_stats.json not found at {_STATS_PATH}")
        with _STATS_PATH.open("r", encoding="utf-8") as f:
            stats = json.load(f)

    projections = []
    all_salaries = []
    all_fppg = []

    # First pass: collect medians for ownership estimation
    for fight in stats.get("fights", []):
        for f in fight.get("fighters", []):
            sal = f.get("salary", 0) or 0
            fppg = f.get("avgPointsPerGame") or 0
            if sal > 0:
                all_salaries.append(sal)
            if fppg > 0:
                all_fppg.append(fppg)

    median_salary = sorted(all_salaries)[len(all_salaries) // 2] if all_salaries else 8000
    median_fppg = sorted(all_fppg)[len(all_fppg) // 2] if all_fppg else 65.0

    # Second pass: project each fighter
    for fight in stats.get("fights", []):
        fighters_in_fight = fight.get("fighters", [])
        if len(fighters_in_fight) != 2:
            continue

        for i, fighter in enumerate(fighters_in_fight):
            opponent = fighters_in_fight[1 - i]

            proj = project_fighter(fighter, opponent, fight)

            # Ownership estimation (salary + projection based)
            sal = fighter.get("salary", 0) or 0
            proj_fppg = proj["proj_fppg"]
            sal_pct = sal / median_salary if median_salary else 1.0
            proj_pct = proj_fppg / median_fppg if median_fppg else 1.0

            if sal >= 9000 and proj_pct >= 1.2:
                own_label, own_num = "30-40%", 35
            elif sal >= 8500 and proj_pct >= 1.0:
                own_label, own_num = "20-30%", 25
            elif sal >= 8000:
                own_label, own_num = "15-25%", 20
            elif sal >= 7000 and proj_pct >= 1.1:
                own_label, own_num = "10-18%", 14
            elif sal >= 7000:
                own_label, own_num = "8-15%", 11
            elif sal_pct < 0.85:
                own_label, own_num = "5-10%", 7
            else:
                own_label, own_num = "5-12%", 8

            # Parse total wins from record string for small-sample warnings in lineup reasoning
            _rec = str(fighter.get("record", "0-0") or "0-0")
            try:
                _total_pro_fights = int(_rec.split("-")[0])
            except (ValueError, IndexError):
                _total_pro_fights = 0

            _stats_f = fighter.get("stats") or {}
            _stats_o = opponent.get("stats") or {}
            _td_avg = float(_stats_f.get("td_avg", 0) or 0)
            _avg_ctrl_secs = float(_stats_f.get("avg_ctrl_secs", 0) or 0)
            _opp_td_def = _parse_pct(_stats_o.get("td_defense"))
            # Striking fields for Striking Edge strategy per-fighter reasoning
            _slpm = float(_stats_f.get("slpm", 0) or 0)
            _kd_avg_proj = float(_stats_f.get("avg_kd_per_fight", 0) or 0)
            _opp_str_def = _parse_pct(_stats_o.get("striking_defense"))
            _ufc_fight_count = _count_ufc_fights(fighter)
            _pre_ufc_notes = (
                _build_pre_ufc_notes(fighter, _ufc_fight_count)
                if _ufc_fight_count < 3
                else []
            )

            projections.append({
                "id": str(fighter.get("dk_id", "")),
                "name": fighter.get("name", "Unknown"),
                "salary": sal,
                "fight_id": str(fight.get("fight_id", "")),
                "weight_class": fight.get("weight_class") or fighter.get("weight_class") or "N/A",
                "opponent": opponent.get("name", "Unknown"),
                "ownership_label": own_label,
                "ownership_num": own_num,
                "total_pro_fights": _total_pro_fights,
                "ufc_fight_count": _ufc_fight_count,
                "pre_ufc_notes": _pre_ufc_notes,
                "td_avg": _td_avg,
                "avg_ctrl_secs": _avg_ctrl_secs,
                "opp_td_def": _opp_td_def,
                "slpm": _slpm,
                "kd_avg": _kd_avg_proj,
                "opp_str_def": _opp_str_def,
                **proj,
            })

    # Sort by projected FPPG descending
    projections.sort(key=lambda x: -x["proj_fppg"])

    logger.info("Projected %d fighters for %s", len(projections), stats.get("event", {}).get("name", "event"))
    return projections


# ═══════════════════════════════════════════════════════════════════════════
# Smart lineup generation: build a small set of recommended lineups
# with reasoning for each
# ═══════════════════════════════════════════════════════════════════════════

def _lineup_fingerprint(fighter_ids: frozenset[str]) -> str:
    """Create a short fingerprint string from a set of fighter IDs."""
    return ",".join(sorted(fighter_ids))


# ═══════════════════════════════════════════════════════════════════════════
# Strategy definitions
# ═══════════════════════════════════════════════════════════════════════════

STRATEGIES = {
    "highest_projection": {
        "label": "Highest Projection",
        "icon": "🎯",
        "description": "Picks the highest-projected fighter from each matchup. Best for cash games and safe plays.",
        "short": "Maximize raw projected fantasy points.",
    },
    "best_value": {
        "label": "Best Value",
        "icon": "💰",
        "description": "Maximizes projection per salary dollar. Finds underpriced fighters with strong matchups.",
        "short": "Best points-per-dollar efficiency.",
    },
    "contrarian": {
        "label": "Tournament Contrarian",
        "icon": "🔮",
        "description": "Targets low-ownership fighters with viable projections. High-risk, high-reward for GPPs.",
        "short": "Low-owned fighters for unique lineups.",
    },
    "finish_upside": {
        "label": "Finish Upside",
        "icon": "💥",
        "description": "Prioritizes fighters most likely to win by finish. Maximum ceiling for tournaments.",
        "short": "Chase KO/Sub bonus points.",
    },
    "balanced": {
        "label": "Balanced",
        "icon": "⚖️",
        "description": "Blends projection strength with salary efficiency. Good all-around lineup for any contest type.",
        "short": "Mix of projection + value.",
    },
    "wrestling_advantage": {
        "label": "Wrestling Edge",
        "icon": "🤼",
        "description": "Targets fighters with dominant grappling, control time, and submission threat over their opponents.",
        "short": "Control + takedowns + submission threat.",
    },
    "striking_advantage": {
        "label": "Striking Edge",
        "icon": "👊",
        "description": "Targets high-volume strikers with knockdown power and defensive efficiency who have a clear striking edge.",
        "short": "High-output striking with KO power.",
    },
}


def generate_smart_lineups(
    stats: dict[str, Any] | None = None,
    num_lineups: int = 5,
    strategy: str | None = None,
    exclude_fingerprints: list[str] | None = None,
) -> list[dict[str, Any]]:
    """
    Generate recommended lineups with reasoning.

    If ``strategy`` is None, returns the single best lineup for each strategy
    (legacy behaviour). If a specific strategy key is given, returns up to
    ``num_lineups`` diverse lineups for that one strategy with randomized
    variation so repeated calls produce fresh results.

    ``exclude_fingerprints`` — comma-joined sorted fighter-ID strings the
    client already has. These are skipped to guarantee new lineups each call.
    """
    import random
    from itertools import combinations

    projections = project_full_card(stats)
    if len(projections) < 6:
        raise ValueError("Not enough fighters to build lineups")

    by_id = {p["id"]: p for p in projections}
    by_fight: dict[str, list[dict]] = {}
    for p in projections:
        by_fight.setdefault(p["fight_id"], []).append(p)

    fight_ids = list(by_fight.keys())
    if len(fight_ids) < 6:
        raise ValueError(f"Need at least 6 fights, have {len(fight_ids)}")

    for p in projections:
        p["value"] = p["proj_fppg"] / (p["salary"] / 1000) if p["salary"] > 0 else 0

    # Resolve wrestling override for the current card.
    # If WRESTLING_CORE_OVERRIDE contains names not on this week's roster (i.e. it
    # was set for a previous event and not updated), strip the stale names so the
    # strategy falls back to pure wrestling-score mode rather than silently
    # degrading to an all-filler striking lineup.
    _all_fighter_names_lower = {p["name"].lower() for p in projections}
    _wrestling_override = [
        n for n in WRESTLING_CORE_OVERRIDE
        if n.lower() in _all_fighter_names_lower
    ]
    if WRESTLING_CORE_OVERRIDE and not _wrestling_override:
        logger.warning(
            "WRESTLING_CORE_OVERRIDE contains no current-card fighters "
            "(%s). Falling back to pure wrestling-score mode.",
            WRESTLING_CORE_OVERRIDE,
        )

    # Track already-seen lineups (client exclusions + within this call)
    seen: set[frozenset[str]] = set()
    if exclude_fingerprints:
        for fp in exclude_fingerprints:
            seen.add(frozenset(fp.split(",")))

    # ── Helper: build a lineup dict from fight→fighter picks ─────────────
    def _build_lineup(
        fight_picks: dict[str, str],
        strat_key: str,
        reasoning: str,
        fighter_reasoning_overrides: dict[str, str] | None = None,
    ) -> dict | None:
        fighters = [by_id[pid] for pid in fight_picks.values() if pid in by_id]
        if len(fighters) != 6:
            return None
        total_salary = sum(f["salary"] for f in fighters)
        if total_salary > 50000:
            return None
        proj_fpts = sum(f["proj_fppg"] for f in fighters)
        meta = STRATEGIES.get(strat_key, {})
        return {
            "fighters": [
                {
                    "id": f["id"],
                    "name": f["name"],
                    "salary": f["salary"],
                    "avgFPPG": f["dk_avg_fppg"],
                    "proj_fppg": f["proj_fppg"],
                    "proj_low": f["proj_low"],
                    "proj_high": f["proj_high"],
                    "fight_id": f["fight_id"],
                    "opponent": f["opponent"],
                    "win_prob": f["win_prob"],
                    "finish_prob": f["finish_prob"],
                    "ownership_label": f["ownership_label"],
                    "reasoning": (fighter_reasoning_overrides or {}).get(f["id"], f["reasoning"]),
                    "ufc_fight_count": f.get("ufc_fight_count", 99),
                    "pre_ufc_notes": f.get("pre_ufc_notes", []),
                }
                for f in fighters
            ],
            "total_salary": total_salary,
            "projected_fpts": round(proj_fpts, 2),
            "strategy": meta.get("label", strat_key),
            "strategy_key": strat_key,
            "reasoning": reasoning,
            "fingerprint": _lineup_fingerprint(frozenset(f["id"] for f in fighters)),
        }

    # ── Per-fight picker functions (with optional noise) ─────────────────
    def _pick_highest_proj(fid: str, noise: float = 0.0) -> str | None:
        fighters = by_fight.get(fid, [])
        if not fighters:
            return None
        return max(fighters, key=lambda f: f["proj_fppg"] + random.uniform(-noise, noise))["id"]

    def _pick_best_value(fid: str, noise: float = 0.0) -> str | None:
        fighters = by_fight.get(fid, [])
        if not fighters:
            return None
        return max(fighters, key=lambda f: f["value"] + random.uniform(-noise, noise))["id"]

    def _pick_contrarian(fid: str, noise: float = 0.0) -> str | None:
        fighters = by_fight.get(fid, [])
        if not fighters:
            return None
        sorted_f = sorted(fighters, key=lambda f: f["ownership_num"] + random.uniform(-noise, noise))
        for f in sorted_f:
            if f["proj_fppg"] >= 35:
                return f["id"]
        return sorted_f[0]["id"]

    def _pick_finish_upside(fid: str, noise: float = 0.0) -> str | None:
        fighters = by_fight.get(fid, [])
        if not fighters:
            return None
        return max(fighters, key=lambda f: f["finish_prob"] * f["proj_fppg"] + random.uniform(-noise, noise))["id"]

    def _pick_balanced(fid: str, noise: float = 0.0) -> str | None:
        fighters = by_fight.get(fid, [])
        if not fighters:
            return None
        return max(fighters, key=lambda f: f["proj_fppg"] * 0.6 + f["value"] * 4.0 + random.uniform(-noise, noise))["id"]

    def _pick_wrestling_advantage(fid: str, noise: float = 0.0) -> str | None:
        fighters = by_fight.get(fid, [])
        if not fighters:
            return None
        if _wrestling_override:
            _core_keys = {n.lower() for n in _wrestling_override}
            # If a designated core wrestler is in this fight, always pick them.
            # No noise applied — cores are locked regardless of variation pass.
            for f in fighters:
                if f.get("name", "").lower() in _core_keys:
                    return f["id"]
            # Non-core fight: pick by wrestling score — stay on-theme.
            return max(
                fighters,
                key=lambda f: (
                    f.get("wrestling_score", 0)
                    + random.uniform(-noise, noise)
                ),
            )["id"]
        # No override — pure wrestling score mode.
        return max(fighters, key=lambda f: f.get("wrestling_score", 0) + random.uniform(-noise, noise))["id"]
    def _pick_striking_advantage(fid: str, noise: float = 0.0) -> str | None:
        fighters = by_fight.get(fid, [])
        if not fighters:
            return None
        return max(fighters, key=lambda f: f.get("striking_score", 0) + random.uniform(-noise, noise))["id"]

    strategy_pickers = {
        "highest_projection": (_pick_highest_proj, "Highest-projected fighter from each matchup."),
        "best_value": (_pick_best_value, "Best projection-per-salary-dollar from each matchup."),
        "contrarian": (_pick_contrarian, "Low-ownership fighters with viable projections."),
        "finish_upside": (_pick_finish_upside, "Fighters most likely to win by KO/TKO or submission."),
        "balanced": (_pick_balanced, "Blend of projection strength and salary efficiency."),
        "wrestling_advantage": (_pick_wrestling_advantage, "Fighters with dominant grappling and control time edge."),
        "striking_advantage": (_pick_striking_advantage, "High-volume strikers with knockdown power and defensive efficiency."),
    }

    # ── Scoring function per strategy (for ranking candidates) ───────────
    def _score_lineup(fighters_list: list[dict], strat_key: str) -> float:
        proj_total = sum(f["proj_fppg"] for f in fighters_list)
        if strat_key == "best_value":
            return sum(f["value"] for f in fighters_list)
        elif strat_key == "contrarian":
            return proj_total - sum(f["ownership_num"] for f in fighters_list) * 0.5
        elif strat_key == "finish_upside":
            return sum(f["finish_prob"] * f["proj_fppg"] for f in fighters_list)
        elif strat_key == "wrestling_advantage":
            if _wrestling_override:
                # Core fighters get a large fixed bonus each (ensures all 3 are
                # selected before any non-core consideration).
                # Non-core fights are ALSO scored by wrestling_score — keeps the
                # entire lineup on-theme and prevents striking-bias contamination.
                _core_keys = {n.lower() for n in _wrestling_override}
                core_bonus = sum(
                    50.0 for f in fighters_list
                    if f.get("name", "").lower() in _core_keys
                )
                non_core_score = sum(
                    f.get("wrestling_score", 0)
                    for f in fighters_list
                    if f.get("name", "").lower() not in _core_keys
                )
                return core_bonus + non_core_score
            else:
                # Pure wrestling score mode with threshold bonus.
                CORE_THRESHOLD = 4.5
                base = sum(f.get("wrestling_score", 0) for f in fighters_list)
                core_bonus = sum(
                    15.0 for f in fighters_list
                    if f.get("wrestling_score", 0) >= CORE_THRESHOLD
                )
                return base + core_bonus
        elif strat_key == "striking_advantage":
            return sum(f.get("striking_score", 0) for f in fighters_list)
        else:
            return proj_total

    # ── Generate lineups for a single strategy with variation ────────────
    def _generate_for_strategy(strat_key: str, count: int) -> list[dict]:
        picker_fn, base_reasoning = strategy_pickers[strat_key]
        results: list[dict] = []

        # Build ALL valid candidate lineups (scored) from 6-fight combos
        all_combos = list(combinations(fight_ids, 6))

        # Sort by strategy score for the "no noise" pick first, then add noise
        for noise_level in [0.0, 3.0, 6.0, 10.0, 15.0, 20.0]:
            if len(results) >= count:
                break

            # Shuffle combos for variety at each noise level
            random.shuffle(all_combos)

            candidates: list[tuple[float, dict]] = []
            for fight_combo in all_combos:
                picks = {}
                for fid in fight_combo:
                    pid = picker_fn(fid, noise=noise_level)
                    if pid:
                        picks[fid] = pid
                if len(picks) != 6:
                    continue

                fset = frozenset(picks.values())
                if fset in seen:
                    continue

                fighters_list = [by_id[pid] for pid in picks.values() if pid in by_id]
                total_sal = sum(f["salary"] for f in fighters_list)
                if total_sal > 50000:
                    continue

                score = _score_lineup(fighters_list, strat_key)
                candidates.append((score, picks, fset))

            # Sort best-first and take what we need
            candidates.sort(key=lambda x: -x[0])
            for score, picks, fset in candidates:
                if len(results) >= count:
                    break
                if fset in seen:
                    continue
                seen.add(fset)

                # Build a descriptive per-lineup reasoning
                fighters_list = [by_id[pid] for pid in picks.values() if pid in by_id]
                top_pick = max(fighters_list, key=lambda f: f["proj_fppg"])
                total_sal = sum(f["salary"] for f in fighters_list)
                proj_total = sum(f["proj_fppg"] for f in fighters_list)

                # Per-fighter reasoning overrides (reset for each lineup)
                strat_overrides: dict[str, str] = {}

                if strat_key == "highest_projection":
                    reason = f"Led by {top_pick['name']} ({top_pick['proj_fppg']:.1f} pts). Total projection: {proj_total:.1f}."
                    _sorted_by_proj = sorted(fighters_list, key=lambda f: -f["proj_fppg"])
                    _proj_rank = {f["id"]: i + 1 for i, f in enumerate(_sorted_by_proj)}
                    for _f in fighters_list:
                        _rank   = _proj_rank[_f["id"]]
                        _p      = _f.get("proj_fppg", 0.0)
                        _wp     = _f.get("win_prob", 0.5)
                        _fp     = _f.get("finish_prob", 0.0)
                        _sl     = _f.get("slpm", 0.0)
                        _td_hp  = _f.get("td_avg", 0.0)
                        _dk     = _f.get("dk_avg_fppg", 0.0)
                        _sal    = _f.get("salary", 0)
                        _pts: list[str] = []
                        if _wp >= 0.60:
                            _pts.append(f"{_wp:.0%} win prob")
                        if _sl >= 4.0:
                            _pts.append(f"{_sl:.1f} SLpM")
                        elif _td_hp >= 2.5:
                            _pts.append(f"{_td_hp:.1f} TD/15min")
                        if _fp >= 0.60:
                            _pts.append(f"{_fp:.0%} finish prob")
                        if _dk > 0:
                            _pts.append(f"DK avg {_dk:.0f} pts")
                        _detail = f" — {', '.join(_pts)}" if _pts else ""
                        strat_overrides[_f["id"]] = f"#{_rank} projection ({_p:.1f} pts, ${_sal:,}){_detail}."

                elif strat_key == "best_value":
                    cheapest = min(fighters_list, key=lambda f: f["salary"])
                    reason = f"Value anchored by {cheapest['name']} (${cheapest['salary']:,} / {cheapest['proj_fppg']:.1f} pts). Salary: ${total_sal:,}."
                    _sorted_by_val = sorted(fighters_list, key=lambda f: -f.get("value", 0))
                    for _rank, _f in enumerate(_sorted_by_val, 1):
                        _p      = _f.get("proj_fppg", 0.0)
                        _sal    = _f.get("salary", 0)
                        _val    = _f.get("value", 0.0)
                        _dk     = _f.get("dk_avg_fppg", 0.0)
                        _wp     = _f.get("win_prob", 0.5)
                        _pts: list[str] = []
                        if _wp >= 0.60:
                            _pts.append(f"{_wp:.0%} win prob")
                        if _dk > 0:
                            _pts.append(f"DK avg {_dk:.0f} pts")
                        _detail = f" — {', '.join(_pts)}" if _pts else ""
                        _star = "\u2605 " if _rank <= 2 else ""
                        strat_overrides[_f["id"]] = f"{_star}{_val:.1f} pts/$K — {_p:.1f} pts at ${_sal:,}{_detail}."

                elif strat_key == "contrarian":
                    lowest_own = min(fighters_list, key=lambda f: f["ownership_num"])
                    reason = f"Low-owned pivot: {lowest_own['name']} ({lowest_own['ownership_label']} ownership). Differentiated lineup."
                    for _f in fighters_list:
                        _own_label = _f.get("ownership_label", "unknown")
                        _own_num   = _f.get("ownership_num", 20)
                        _p         = _f.get("proj_fppg", 0.0)
                        _sal       = _f.get("salary", 0)
                        _wp        = _f.get("win_prob", 0.5)
                        if _own_num <= 10:
                            _pts: list[str] = [f"{_p:.1f} proj pts"]
                            if _wp >= 0.55:
                                _pts.append(f"{_wp:.0%} win prob")
                            strat_overrides[_f["id"]] = f"\u2605 Low-owned ({_own_label}) — {', '.join(_pts)}."
                        else:
                            strat_overrides[_f["id"]] = f"Chalk anchor ({_own_label} own, {_p:.1f} pts at ${_sal:,})."

                elif strat_key == "finish_upside":
                    best_fin = max(fighters_list, key=lambda f: f["finish_prob"])
                    reason = f"Finish threat: {best_fin['name']} ({best_fin['finish_prob']:.0%} finish prob). High bonus ceiling."
                    for _f in fighters_list:
                        _fp    = _f.get("finish_prob", 0.0)
                        _wp    = _f.get("win_prob", 0.5)
                        _p     = _f.get("proj_fppg", 0.0)
                        _sal   = _f.get("salary", 0)
                        _kd_f  = _f.get("kd_avg", 0.0)
                        _td_fu = _f.get("td_avg", 0.0)
                        _comps = _f.get("proj_components", {})
                        _kd_c  = _comps.get("knockdowns", 0.0)
                        _grap  = _comps.get("grappling", 0.0)
                        _stk   = _comps.get("striking", 0.0)
                        if _fp >= 0.55:
                            if _kd_c >= 3.0 or _kd_f >= 0.30:
                                _style = " (KO threat)"
                            elif _grap > _stk and _td_fu >= 1.5:
                                _style = " (submission threat)"
                            elif _grap > _stk:
                                _style = " (grappling finisher)"
                            else:
                                _style = ""
                            strat_overrides[_f["id"]] = f"\u2605 Finish threat — {_fp:.0%} finish prob{_style}, {_p:.1f} proj pts."
                        elif _fp >= 0.35:
                            strat_overrides[_f["id"]] = f"Finish upside — {_fp:.0%} finish prob, {_p:.1f} proj pts at ${_sal:,}."
                        else:
                            if _wp >= 0.60:
                                strat_overrides[_f["id"]] = f"Safe floor — {_wp:.0%} win prob, {_p:.1f} proj pts."
                            else:
                                strat_overrides[_f["id"]] = f"Value floor — {_p:.1f} proj pts at ${_sal:,}."
                elif strat_key == "wrestling_advantage":
                    # ── Core + Fillers model ──────────────────────────────────────
                    # Determine who counts as "Core" for this lineup.
                    # _wrestling_override (card-filtered from WRESTLING_CORE_OVERRIDE)
                    # takes precedence; if empty, fall back to score >= CORE_THRESHOLD.
                    if _wrestling_override:
                        _override_keys = {n.lower() for n in _wrestling_override}
                        core_ids   = {f["id"] for f in fighters_list if f.get("name","").lower() in _override_keys}
                        filler_ids = {f["id"] for f in fighters_list if f["id"] not in core_ids}
                        _core_names = [f["name"] for f in fighters_list if f["id"] in core_ids]
                        n_core = len(core_ids)
                        if n_core > 0:
                            _names_str = ", ".join(_core_names)
                            reason = (
                                f"Wrestling Edge — {n_core} core wrestler{'s' if n_core != 1 else ''} "
                                f"({_names_str}) + {len(filler_ids)} best wrestling-edge pick{'s' if len(filler_ids) != 1 else ''} from remaining fights."
                            )
                        else:
                            reason = "Wrestling Edge — designated core wrestlers not available; best-value fillers used."
                    else:
                        CORE_THRESHOLD = 4.5
                        core_ids   = {f["id"] for f in fighters_list if f.get("wrestling_score", 0) >= CORE_THRESHOLD}
                        filler_ids = {f["id"] for f in fighters_list if f["id"] not in core_ids}
                        n_core = len(core_ids)
                        if n_core > 0:
                            reason = (
                                f"Wrestling Edge — {n_core} core wrestler{'s' if n_core != 1 else ''} "
                                f"(score ≥ {CORE_THRESHOLD}) + {len(filler_ids)} best-value filler{'s' if len(filler_ids) != 1 else ''}."
                            )
                        else:
                            reason = "Wrestling Edge — no elite wrestlers available; filled with grappling-capable value picks."

                    # ── Per-fighter reasoning (core vs filler) ────────────────────────
                    wres_overrides: dict[str, str] = {}
                    for _f in fighters_list:
                        _name    = _f.get("name", "Fighter")
                        _opp     = _f.get("opponent", "opponent")
                        _td      = _f.get("td_avg", 0.0)
                        _ctrl    = _f.get("avg_ctrl_secs", 0.0) / 60.0
                        _opp_def = _f.get("opp_td_def", 0.0)
                        _pro     = _f.get("total_pro_fights", 99)
                        _wscore  = _f.get("wrestling_score", 0.0)
                        _is_core = _f["id"] in core_ids

                        if _is_core:
                            # Detailed wrestling label
                            if _td >= 4.0 and _ctrl >= 2.0:
                                _label = "★ Core — Elite grappler"
                            elif _td >= 2.5 or (_td >= 1.5 and _ctrl >= 1.5):
                                _label = "★ Core — Strong wrestling edge"
                            else:
                                _label = "★ Core wrestler"

                            _details: list[str] = []
                            if _td >= 1.0:
                                _details.append(f"{_td:.1f} TD/15min")
                            if _ctrl >= 0.5:
                                _details.append(f"{_ctrl:.1f} min ctrl/fight")
                            if _td >= 1.0 and _opp_def < 70:
                                _details.append(f"vs {_opp}'s {_opp_def:.0f}% TD def")
                            elif _td >= 1.0 and _opp_def >= 70:
                                _details.append(f"vs {_opp}'s solid {_opp_def:.0f}% TD def")
                            if _pro < 10 and _td >= 2.0:
                                _details.append("limited sample")
                            _stat_str = f" ({', '.join(_details)})" if _details else ""
                            wres_overrides[_f["id"]] = f"{_label}{_stat_str}."

                        else:
                            # Non-core fighter — show wrestling-relevant reasoning
                            # (never reference striking on a wrestling lineup).
                            _proj    = _f.get("proj_fppg", 0.0)
                            _td_nc   = _f.get("td_avg", 0.0)
                            _ctrl_nc = _f.get("avg_ctrl_secs", 0.0) / 60.0
                            _wscore_nc = _f.get("wrestling_score", 0.0)
                            _opp_nc  = _f.get("opponent", "opponent")
                            _opp_def_nc = _f.get("opp_td_def", 0.0)

                            _nc_details: list[str] = []
                            if _td_nc >= 0.5:
                                _nc_details.append(f"{_td_nc:.1f} TD/15min")
                            if _ctrl_nc >= 0.5:
                                _nc_details.append(f"{_ctrl_nc:.1f} min ctrl/fight")
                            if _td_nc >= 0.5 and _opp_def_nc < 70:
                                _nc_details.append(f"vs {_opp_nc}'s {_opp_def_nc:.0f}% TD def")
                            elif _td_nc >= 0.5 and _opp_def_nc >= 70:
                                _nc_details.append(f"vs {_opp_nc}'s solid {_opp_def_nc:.0f}% TD def")

                            if _wscore_nc >= 4.0 or _td_nc >= 3.0:
                                _nc_label = "Strong wrestling edge"
                            elif _wscore_nc >= 2.0 or _td_nc >= 1.5 or _ctrl_nc >= 1.5:
                                _nc_label = "Grappling upside"
                            elif _wscore_nc >= 0.5 or _td_nc >= 0.5 or _ctrl_nc >= 0.5:
                                _nc_label = "Wrestling lean"
                            else:
                                _nc_label = "Best available"
                                _nc_details = [f"{_proj:.1f} proj pts"]

                            _nc_stat_str = f" ({', '.join(_nc_details)})" if _nc_details else ""
                            wres_overrides[_f["id"]] = f"{_nc_label}{_nc_stat_str}."

                    lineup = _build_lineup(picks, strat_key, reason, wres_overrides)
                    if lineup:
                        results.append(lineup)
                    continue
                elif strat_key == "striking_advantage":
                    best_striker = max(fighters_list, key=lambda f: f.get("striking_score", 0))
                    reason = f"Striking anchor: {best_striker['name']} (volume + power edge). High-ceiling striking lineup."

                    # ── Per-fighter reasoning (striking-specific) ─────────────────
                    # Use the median striking_score of fighters on this card as
                    # the "core striker" threshold — top half = core, bottom = filler.
                    all_stk_scores = [p.get("striking_score", 0.0) for p in projections]
                    _stk_median = sorted(all_stk_scores)[len(all_stk_scores) // 2]
                    stk_overrides: dict[str, str] = {}
                    for _f in fighters_list:
                        _stk_score   = _f.get("striking_score", 0.0)
                        _slpm_f      = _f.get("slpm", 0.0)
                        _kd_avg_f    = _f.get("kd_avg", 0.0)
                        _opp_str_def_f = _f.get("opp_str_def", 50.0)
                        _opp_name_f  = _f.get("opponent", "opponent")
                        _proj_f      = _f.get("proj_fppg", 0.0)
                        _salary_f    = _f.get("salary", 0)
                        _value_f     = _f.get("value", 0.0)

                        if _stk_score >= _stk_median:
                            _parts: list[str] = []
                            if _slpm_f >= 3.0:
                                _parts.append(f"{_slpm_f:.1f} SLpM")
                            if _opp_str_def_f < 55:
                                _parts.append(f"vs {_opp_name_f}'s {_opp_str_def_f:.0f}% str def")
                            if _kd_avg_f >= 0.25:
                                _parts.append(f"{_kd_avg_f:.2f} KD/fight")
                            _stat_str = f" ({', '.join(_parts)})" if _parts else ""
                            stk_overrides[_f["id"]] = f"★ Striking Edge{_stat_str}."
                        else:
                            if _value_f >= 10.0:
                                stk_overrides[_f["id"]] = f"Value filler — top salary efficiency (${_salary_f:,}, {_proj_f:.1f} proj pts)."
                            elif _proj_f >= 65.0:
                                stk_overrides[_f["id"]] = f"High-floor filler — {_proj_f:.1f} proj pts at ${_salary_f:,}."
                            else:
                                stk_overrides[_f["id"]] = f"Salary filler — {_proj_f:.1f} proj pts."

                    lineup = _build_lineup(picks, strat_key, reason, stk_overrides)
                    if lineup:
                        results.append(lineup)
                    continue
                else:
                    reason = f"Balanced — {proj_total:.1f} pts, ${total_sal:,} salary, {proj_total / (total_sal / 1000):.2f} pts/$K avg."
                    for _f in fighters_list:
                        _p   = _f.get("proj_fppg", 0.0)
                        _val = _f.get("value", 0.0)
                        _sal = _f.get("salary", 0)
                        _wp  = _f.get("win_prob", 0.5)
                        _pts: list[str] = [f"{_p:.1f} pts", f"{_val:.1f} pts/$K"]
                        if _wp >= 0.60:
                            _pts.append(f"{_wp:.0%} win prob")
                        strat_overrides[_f["id"]] = f"Balanced — {', '.join(_pts)} at ${_sal:,}."

                lineup = _build_lineup(picks, strat_key, reason, strat_overrides or None)
                if lineup:
                    results.append(lineup)

        return results

    # ── Main dispatch ────────────────────────────────────────────────────
    if strategy and strategy in strategy_pickers:
        return _generate_for_strategy(strategy, num_lineups)

    # Legacy: one best lineup per strategy
    all_results = []
    for strat_key in strategy_pickers:
        best = _generate_for_strategy(strat_key, 1)
        all_results.extend(best)

    all_results.sort(key=lambda x: -x["projected_fpts"])
    return all_results[:num_lineups]
