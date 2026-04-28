"""
scripts/ai_predict.py — Python mirror of fightAnalyzerHelpers.js

Full 10-category Smart AI prediction engine.  Mirrors the JS logic exactly so
offline batch processing (e.g. re-scoring track_record.json) produces the same
picks as the live React UI.

Tier 1 tuning (2026-04-27):
  • Sigmoid recalibrated: /20 instead of /25
      lock (≥12pt) → ~82%   strong (≥7) → ~74%   lean (≥3) → ~59%
  • Decision Caution Rule: if BOTH fighters have finish_rate_pct < 48,
      reduce confidence one tier (lock→strong, strong→lean, lean→tossup).
      Adds a note to the narrative.
  • Tossup threshold unchanged (<3pt margin).

Usage:
    from scripts.ai_predict import predict, predict_card

    result = predict(fighter1_dict, fighter2_dict)
    # result = {
    #   'pick': str, 'win_prob': int, 'confidence': str,
    #   'margin': float, 'decision_caution': bool,
    #   'f1_score': float, 'f2_score': float,
    # }
"""

import math
import re

# ─── Utilities ──────────────────────────────────────────────────────────────

def _parse_pct(v):
    if v is None:
        return None
    try:
        return float(str(v).replace("%", ""))
    except (ValueError, TypeError):
        return None


def _parse_height(h):
    if not h:
        return None
    m = re.match(r"(\d+)'\s*(\d+)", str(h))
    return int(m.group(1)) * 12 + int(m.group(2)) if m else None


def _parse_reach(r):
    if not r:
        return None
    try:
        return float(str(r).replace('"', ""))
    except (ValueError, TypeError):
        return None


def _parse_record_str(rec):
    if not rec:
        return None
    m = re.match(r"(\d+)-(\d+)", str(rec))
    return (int(m.group(1)), int(m.group(2))) if m else None


def _fl(v, default=0.0):
    if v is None:
        return float(default)
    try:
        return float(v)
    except (ValueError, TypeError):
        return float(default)


def _norm(v, mn, mx):
    v = _fl(v, (mn + mx) / 2)
    return max(0.0, min(100.0, (v - mn) / (mx - mn) * 100))


def _clamp(v, lo, hi):
    return max(lo, min(hi, v))


def _get_stat(value, default_value):
    """
    Return a stat value, substituting the league-average default when the
    value is None or exactly 0.  In UFCStats data, fighters with no UFC
    fights have slpm/sapm/td_avg stored as 0 ("no data"), not genuine zeros.
    Using the default prevents them from being scored as elite defenders /
    perfect wrestlers / etc.
    """
    if value is None or value == 0:
        return default_value
    return value


# ─── Derived fight history stats ─────────────────────────────────────────────

def _derive_hist(f):
    """Mirror of deriveFightHistoryStats() in fightAnalyzerHelpers.js."""
    history = [h for h in f.get("fight_history", []) if h.get("fight_type") == "pro"]
    if not history:
        return None
    last5 = history[:5]
    wins5 = sum(1 for h in last5 if h["result"] == "win")
    ws = ls = 0
    for h in history:
        if ws == 0 and ls == 0:
            if h["result"] == "win":
                ws = 1
            else:
                ls = 1
        elif ws > 0:
            if h["result"] == "win":
                ws += 1
            else:
                break
        else:
            if h["result"] != "win":
                ls += 1
            else:
                break
    return {"r5": f"{wins5}-{len(last5) - wins5}", "ws": ws, "ls": ls}


# ─── Category scorers ────────────────────────────────────────────────────────

def _score_striking_offense(f):
    s = f.get("stats", {})
    slpm = _get_stat(_fl(s.get("slpm")), 3.0)
    acc = _get_stat(_fl(_parse_pct(s.get("striking_accuracy")), 45), 45)
    kd = _fl(s.get("avg_kd_per_fight"))
    head_pct = _fl(s.get("head_str_pct"), 40)
    return (
        _norm(slpm, 0, 8) * 0.4
        + _norm(acc, 25, 65) * 0.25
        + _norm(kd, 0, 1.5) * 0.25
        + _norm(head_pct, 20, 60) * 0.1
    )


def _score_striking_defense(f):
    s = f.get("stats", {})
    def_ = _get_stat(_fl(_parse_pct(s.get("striking_defense")), 50), 50)
    sapm = _get_stat(_fl(s.get("sapm"), 3.8), 3.8)
    dist_pct = _fl(s.get("distance_str_pct"), 60)
    return (
        _norm(def_, 35, 70) * 0.45
        + (100 - _norm(sapm, 1, 8)) * 0.35
        + _norm(dist_pct, 40, 85) * 0.2
    )


def _score_grappling_offense(f):
    s = f.get("stats", {})
    td_avg = _get_stat(_fl(s.get("td_avg")), 1.8)
    td_acc = _get_stat(_fl(_parse_pct(s.get("td_accuracy")), 35), 35)
    ctrl_secs = _fl(s.get("avg_ctrl_secs"))
    sub_att = _fl(f.get("avg_sub_attempts"))
    return (
        _norm(td_avg, 0, 5) * 0.35
        + _norm(td_acc, 20, 65) * 0.2
        + _norm(ctrl_secs, 0, 300) * 0.3
        + _norm(sub_att, 0, 2) * 0.15
    )


def _score_grappling_defense(f):
    s = f.get("stats", {})
    td_def = _get_stat(_fl(_parse_pct(s.get("td_defense")), 60), 60)
    opp_ctrl = _fl(s.get("avg_opp_ctrl_secs"), 60)
    sub_def = _fl(s.get("implied_sub_def_pct"), 80)
    return (
        _norm(td_def, 40, 85) * 0.4
        + (100 - _norm(opp_ctrl, 0, 200)) * 0.3
        + _norm(sub_def, 50, 100) * 0.3
    )


def _score_finishing(f):
    fin_rate = _fl(f.get("finish_rate_pct"), 50)
    ko_wins = _fl(f.get("wins_ko_tko"))
    sub_wins = _fl(f.get("wins_submission"))
    first_rd = _fl(f.get("first_round_wins"))
    kd = _fl((f.get("stats") or {}).get("avg_kd_per_fight"))
    return (
        _norm(fin_rate, 30, 90) * 0.3
        + _norm(ko_wins, 0, 10) * 0.25
        + _norm(sub_wins, 0, 5) * 0.15
        + _norm(first_rd, 0, 5) * 0.15
        + _norm(kd, 0, 1) * 0.15
    )


def _score_record(f):
    wins = _fl(f.get("wins"))
    losses = _fl(f.get("losses"))
    tot = wins + losses or 1
    longevity = _fl(f.get("career_longevity_years"), 3)
    title = _fl(f.get("total_title_bouts"))
    d = _derive_hist(f)
    r5 = _parse_record_str(d["r5"] if d else f.get("record_last_5"))
    r5s = _norm((r5[0] / (r5[0] + r5[1] or 1)) * 100, 20, 100) if r5 else 50
    return (
        _norm(wins / tot * 100, 40, 90) * 0.35
        + r5s * 0.3
        + _norm(longevity, 0, 12) * 0.15
        + _norm(title, 0, 5) * 0.2
    )


def _score_momentum(f):
    d = _derive_hist(f)
    ws = d["ws"] if d else _fl(f.get("current_win_streak"))
    ls = d["ls"] if d else _fl(f.get("current_loss_streak"))
    longest = _fl(f.get("longest_win_streak"))
    lr = str(f.get("last_fight_result") or "")
    ss = (
        _norm(ws, 0, 8) if ws > 0
        else (100 - _norm(ls, 0, 4) if ls > 0 else 50)
    )
    lrs = 75 if lr.lower().startswith("w") else (25 if lr.lower().startswith("l") else 50)
    return ss * 0.5 + lrs * 0.3 + _norm(longest, 0, 10) * 0.2


def _score_physical(f, opp):
    h1 = _parse_height(f.get("height"))
    h2 = _parse_height(opp.get("height"))
    r1 = _parse_reach(f.get("reach"))
    r2 = _parse_reach(opp.get("reach"))
    age = _fl(f.get("age"), 30)
    st = str(f.get("stance") or "").lower()
    ost = str(opp.get("stance") or "").lower()
    ha = _clamp(50 + (h1 - h2) * 5, 20, 80) if h1 and h2 else 50
    ra = _clamp(50 + (r1 - r2) * 4, 20, 80) if r1 and r2 else 50
    if 28 <= age <= 32:
        age_s = 80
    elif 25 <= age <= 35:
        age_s = 65
    elif age < 25:
        age_s = 50
    else:
        age_s = max(20, 80 - (age - 32) * 5)
    stance_s = 60 if st == "southpaw" and ost == "orthodox" else (40 if st == "orthodox" and ost == "southpaw" else 50)
    return ra * 0.35 + ha * 0.2 + age_s * 0.3 + stance_s * 0.15


def _score_fight_history(f):
    history = [h for h in f.get("fight_history", []) if h.get("fight_type") == "pro"]
    if not history:
        return 50.0
    r5 = history[:5]
    wins = [h for h in r5 if h["result"] == "win"]
    kf = [h for h in wins if h.get("method") and ("KO" in h["method"] or "TKO" in h["method"])]
    sf = [h for h in wins if h.get("method") and "ubmission" in h["method"]]
    l3 = history[:3]
    rw = sum(1 for h in l3 if h["result"] == "win")
    return _norm(rw, 0, 3) * 0.5 + _norm(len(kf) + len(sf), 0, 4) * 0.3 + _norm(min(len(history), 20), 0, 20) * 0.2


def _score_style_matchup(f, opp):
    s = f.get("stats", {})
    os = opp.get("stats", {})
    score = 50.0
    slpm = _fl(s.get("slpm"))
    od = _fl(_parse_pct(os.get("striking_defense")), 55)
    if slpm >= 4 and od < 50:
        score += 12
    elif slpm >= 3 and od < 45:
        score += 8
    td = _fl(s.get("td_avg"))
    otd = _fl(_parse_pct(os.get("td_defense")), 60)
    if td >= 2 and otd < 55:
        score += 12
    elif td >= 1.5 and otd < 50:
        score += 8
    sw = _fl(f.get("wins_submission"))
    osd = _fl(os.get("implied_sub_def_pct"), 80)
    if sw >= 3 and osd < 70:
        score += 8
    kd = _fl(s.get("avg_kd_per_fight"))
    if kd >= 0.5 and od < 50:
        score += 6
    ctrl = _fl(s.get("avg_ctrl_secs"))
    oc = _fl(os.get("avg_opp_ctrl_secs"), 30)
    if ctrl >= 120 and oc >= 90:
        score += 6
    bp = _fl(s.get("body_str_pct"))
    lp = _fl(s.get("leg_str_pct"))
    if bp + lp >= 40:
        score += 3
    return _clamp(score, 0, 100)


# ─── Weighted totals ─────────────────────────────────────────────────────────

WEIGHTS = {
    "strikingOffense": 0.15,
    "strikingDefense": 0.12,
    "grapplingOffense": 0.13,
    "grapplingDefense": 0.10,
    "finishing": 0.12,
    "record": 0.10,
    "momentum": 0.08,
    "physical": 0.08,
    "fightHistory": 0.05,
    "styleMatchup": 0.07,
}

DECISION_CAUTION_THRESHOLD = 48  # finish_rate_pct below which both fighters trigger caution


def _score_fighter(f, opp):
    return (
        _score_striking_offense(f) * 0.15
        + _score_striking_defense(f) * 0.12
        + _score_grappling_offense(f) * 0.13
        + _score_grappling_defense(f) * 0.10
        + _score_finishing(f) * 0.12
        + _score_record(f) * 0.10
        + _score_momentum(f) * 0.08
        + _score_physical(f, opp) * 0.08
        + _score_fight_history(f) * 0.05
        + _score_style_matchup(f, opp) * 0.07
    )


# ─── Main prediction entry point ─────────────────────────────────────────────

def predict(f1: dict, f2: dict) -> dict:
    """
    Predict outcome for one matchup.

    Returns:
        {
          'pick': str,           — winning fighter's name
          'win_prob': int,       — winner's win probability 0-100
          'confidence': str,     — 'tossup'|'lean'|'strong'|'lock'
          'decision_caution': bool,
          'margin': float,       — raw score gap (0-100 scale)
          'f1_score': float,
          'f2_score': float,
        }
    """
    t1 = _score_fighter(f1, f2)
    t2 = _score_fighter(f2, f1)

    diff = t1 - t2
    margin = abs(diff)

    # Recalibrated sigmoid: /20 so labels match true probabilities
    wp1 = 1 / (1 + 10 ** (-diff / 20))

    if margin >= 12:
        confidence = "lock"
    elif margin >= 7:
        confidence = "strong"
    elif margin >= 3:
        confidence = "lean"
    else:
        confidence = "tossup"

    # Decision Caution Rule
    f1_fin = _fl(f1.get("finish_rate_pct"), 50)
    f2_fin = _fl(f2.get("finish_rate_pct"), 50)
    decision_caution = f1_fin < DECISION_CAUTION_THRESHOLD and f2_fin < DECISION_CAUTION_THRESHOLD
    if decision_caution:
        if confidence == "lock":
            confidence = "strong"
        elif confidence == "strong":
            confidence = "lean"
        elif confidence == "lean":
            confidence = "tossup"
        # tossup stays tossup

    winner = f1 if t1 >= t2 else f2
    win_prob = round((wp1 if t1 >= t2 else 1 - wp1) * 100)

    return {
        "pick": winner["name"],
        "win_prob": win_prob,
        "confidence": confidence,
        "decision_caution": decision_caution,
        "margin": round(margin, 1),
        "f1_score": round(t1, 1),
        "f2_score": round(t2, 1),
    }


def predict_card(fights: list) -> list:
    """
    Predict all fights on a card.

    Args:
        fights: list of fight dicts with 'fighters': [f1, f2], 'matchup': str
    Returns:
        list of {matchup, prediction} dicts
    """
    results = []
    for fight in fights:
        fighters = fight.get("fighters", [])
        if len(fighters) < 2:
            continue
        f1, f2 = fighters[0], fighters[1]
        results.append({
            "matchup": fight.get("matchup", f"{f1['name']} vs {f2['name']}"),
            "prediction": predict(f1, f2),
        })
    return results


# ─── CLI helper ──────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import sys, json

    if len(sys.argv) < 2:
        print("Usage: python scripts/ai_predict.py <backup_file.json>")
        sys.exit(1)

    data = json.load(open(sys.argv[1]))
    card = predict_card(data["fights"])
    for item in card:
        p = item["prediction"]
        dc = " ⚠ DECISION CAUTION" if p["decision_caution"] else ""
        print(f"  {item['matchup']}")
        print(f"    → {p['pick']} ({p['confidence']}, {p['win_prob']}%){dc}")
