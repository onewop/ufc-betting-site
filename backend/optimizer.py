"""
UFC DFS Optimizer — production implementation.
Uses pydfs-lineup-optimizer with DraftKings MMA settings:
  - 6 fighters, $50,000 salary cap
  - one fighter per fight (MaxFromOneTeamRule)
  - salary-mode bias via adjusted fppg
  - flat exposure cap + reduced cap for debutants
  - salary-scaled default projection for debut / 0-FPPG fighters

── Salary Mode Definitions ────────────────────────────────────────────────

  The achievable salary range depends on each card's FPPG structure.
  On cards where the FPPG-best fighter is also the most expensive in many
  fights, even default mode will average high. The modes create RELATIVE
  separation — typically $500–$1,500 between diverse and higher.

  "diverse"  — DEFAULT / Balanced  (lowest avg salary)
    Negative salary bias (-0.012) actively prefers cheaper fighters. High
    random deviation (0.50) creates lineup variety. Negative tier bonuses
    penalize $9k+ fighters. Debut fighters appear at minimal exposure.
    Typical avg ~$47.5k–$48.5k. Best for long-shot tournament entries.

  "medium"   — Higher Salaries  (mid-range avg)
    Mild negative salary bias (-0.003) + small tier penalties. Hard
    salary floor ($48,500 via set_min_salary_cap) anchors the bottom.
    Moderate deviation (0.25). Typical avg ~$48.5k–$49.2k. Good for
    mixed cash/GPP slates.

  "higher"   — Aggressive / Max Salary  (highest avg)
    Moderate positive salary bias (0.002) + tier bonuses for $9k+.
    Hard salary floor ($49,200 via set_min_salary_cap). Low deviation
    (0.08) keeps lineups near the high-salary optimum. Debutants at
    higher exposure. Typical avg ~$49.2k–$50k. Maximum ceiling.

  All modes share:
    - Debut/0-FPPG fighters assigned a salary-scaled default projection
      (48 + max(0, salary - 7500) * 0.0025) so they appear proportionally
      to their DK price. Debut exposure is mode-specific.
    - Fighters with very low historical FPPG (< 6.0) get a small floor
      boost so they don't go completely unused.
    - RandomFantasyPointsStrategy adds per-lineup variance for diversity.
    - Fight-capacity safety ensures per-fight combined exposure is high
      enough for the solver to remain feasible at 50 lineups.

── Tuning changelog ───────────────────────────────────────────────────────
2026-04-01 (v5.3) — Stability fix: restore headroom for 50-lineup runs
  Problem: 47-48/50 returns due to two infeasibility sources:
    1. "max_from_one_team_11" — fight 11 combined capacity too low at _MIN_FIGHT_COMBINED=0.65
       (Tommy 7 + Manolo 14 = 21 slots → only ~42% of lineups covered)
    2. "positions_F,total_players" — general pool exhaustion with 0.28 cap
       (24 fighters × 14 = 336 total slots, margin thin under heavy noise)
  Fix: both are allowed by "unless needed for stability" exception
    - _EXPOSURE_TIERS: 0.28 → 0.32 (16/50 max) — 336 → 384 slots, resolves pool exhaustion
    - _MIN_FIGHT_COMBINED: 0.65 → 0.80 — fight 11 Tommy 7 + Manolo bumped to 33 = 40 slots
  Mode behavior preserved: diverse/medium/higher weights and deviations unchanged.

2026-04-01 (v5.2) — Fine-tune salary targets per mode
  Target ranges:  diverse $47k–$48.5k  |  medium $48.5k–$49.3k  |  higher $49.2k–$50k
  - "higher"  weight: +0.003 → +0.002; tiers: 9500→3.5 / 9000→1.8 (was 5.0/2.5)
  - "higher"  set_min_salary_cap: 49500 → 49200
  - "medium"  set_min_salary_cap: None → 48500  (new hard floor)
  No changes to exposure caps, debut handling, or deviations.

2026-04-01 (v5.1) — Exposure cap refinements
  - _EXPOSURE_TIERS: 0.30 → 0.28 (max 14/50) — caps studs like Abdul at 14 uses
  - _DEBUT_MAX_EXPOSURE["diverse"]: 0.10 → 0.14 — Tommy McMillen ~6-8 appearances
  - _MIN_FIGHT_COMBINED: 0.80 → 0.65 — reduces Manolo Zecchini safety-bump cap
    (fight-11: Tommy cap 7/50 + Manolo raised to ~26/50 vs previous ~33/50)

2026-04-01 (v5) — Aggressive mode separation with negative weights + salary floor
  - "diverse": weight=-0.012, tier penalties, deviation=0.50, debut_cap=10%
  - "medium":  weight=-0.003, mild tier penalties, deviation=0.25, debut_cap=20%
  - "higher":  weight=+0.003, tier bonuses, deviation=0.08, debut_cap=30%
  - "higher" uses set_min_salary_cap(49500) to guarantee $49.5k+ lineups
  - Achieves ~$1,400 gap between diverse ($48.3k) and higher ($49.8k)

2026-04-01 (v4) — Mode redesign: clear distinct separation
  - "diverse": weight=0.0, tier={}, deviation=0.38, debut_cap=14% (7/50)
  - "medium":  weight=0.00075, tier small, deviation=0.22, debut_cap=22% (11/50)
  - "higher":  weight=0.00200, tier large, deviation=0.10, debut_cap=30% (15/50)
  - Debut exposure cap is now per-mode dict instead of a single scalar
  - Fight-capacity safety: if a fight's combined exposure < 60% of lineups,
    both fighters' caps are scaled up proportionally to avoid infeasibility
  - Min-usage floor bonus applied in all modes

2026-04-01 (v3) — Conservative debut projection + salary weight tuning
  - Debut formula: 48 + max(0, salary - 7500) * 0.0025

2026-04-01 (v2) — Debut fighter projection + exposure cap
  - 0-FPPG fighters get salary-scaled default; capped at 20% exposure

2026-04-01 (v1) — Exposure & salary rebalancing
  - Flat exposure cap, salary weight tuning, graceful degradation
────────────────────────────────────────────────────────────────────────────
"""
from __future__ import annotations
import json
import logging
import random
from pathlib import Path
from typing import Any

from pydfs_lineup_optimizer import (
    Player,
    RandomFantasyPointsStrategy,
    Site,
    Sport,
    get_optimizer,
)
from pydfs_lineup_optimizer.rules import MaxFromOneTeamRule

from models import LineupOut, OptimizeRequest
from projections import project_full_card

logger = logging.getLogger(__name__)

_STATS_PATH = Path(__file__).resolve().parent.parent / "public" / "this_weeks_stats.json"


# ── Salary bias parameters — see module docstring for mode descriptions ──────
_MODE_SALARY_WEIGHT: dict[str, float] = {
    "diverse": -0.01200,  # strong negative bias — actively prefer cheaper fighters
    "medium":  -0.00300,  # mild negative bias — slight lean toward value
    "higher":  0.00200,   # moderate positive bias — v5.2: was 0.003
}

_TIER_BONUSES: dict[str, dict[int, float]] = {
    "diverse": {9500: -3.0, 9000: -1.5},  # penalize expensive fighters
    "medium":  {9500: -1.0, 9000: -0.5},  # mild penalty for top tier
    "higher":  {9500: 3.5, 9000: 1.8},    # reward expensive fighters — v5.2: was 5.0/2.5
}

def _tier_bonus(mode: str, salary: int) -> float:
    bonuses = _TIER_BONUSES.get(mode, {})
    for threshold in sorted(bonuses, reverse=True):
        if salary >= threshold:
            return bonuses[threshold]
    return 0.0


_RANDOM_DEVIATION: dict[str, float | None] = {
    "diverse": 0.50,   # very high noise → big swings, value fighters shine
    "medium":  0.25,   # moderate — fresh lineups with good variety
    "higher":  0.08,   # very low noise → stays near high-salary deterministic optimum
}


# ── Exposure tiers (max_exposure by rank for non-debut fighters) ─────────────
# Flat 32% cap (v5.3: was 28%) gives 16/50 max per fighter and 384 total
# appearance slots across 24 fighters, enough headroom to complete 50 lineups
# under heavy RandomFantasyPointsStrategy noise without pool exhaustion.
# Debut fighters use _DEBUT_MAX_EXPOSURE[mode] instead (mode-specific).
_EXPOSURE_TIERS: list[tuple[float, float]] = [
    (1.00, 0.32),   # everyone → capped at 32 % (16 of 50)  ← v5.3: was 0.28
]


# ── Default projection for debut / 0-FPPG fighters ──────────────────────────
# DK prices debutants proportional to perceived win probability, so salary is
# a reliable proxy for expected output.  A first-round finish = 100-120+ pts.
#
# Conservative formula (v3): 48 + max(0, salary - 7500) * 0.0025
#   Fighters priced ≤ $7500  → flat 48 pts (unknown upside, hold-down floor)
#   Fighters priced  > $7500 → 48 + scaled bonus, capped by _DEBUT_MAX_EXPOSURE
#   Example:  $9800 → 53.75 pts,  $9200 → 52.25 pts,  $6400 → 48.0 pts
_DEBUT_BASE_MIN: float = 48.0   # floor (cheapest / unknown debutants)
_DEBUT_SALARY_ANCHOR: int = 7500
_DEBUT_SALARY_SLOPE: float = 0.0025  # +2.5 pts per $1000 above anchor


def _debut_default_fppg(salary: int) -> float:
    """Salary-scaled default projection for fighters with no UFC FPPG history."""
    return _DEBUT_BASE_MIN + max(0, salary - _DEBUT_SALARY_ANCHOR) * _DEBUT_SALARY_SLOPE


_DEBUT_MAX_EXPOSURE: dict[str, float] = {
    "diverse": 0.14,   # 7/50  — v5.1: was 0.10 (5); bumped for ~6-8 Tommy appearances
    "medium":  0.20,   # 10/50 — moderate
    "higher":  0.30,   # 15/50 — embrace high-upside debutants (same as regular cap)
}


# ── Min-usage floor (mild FPPG boost for low-projected but viable fighters) ─
_MIN_USAGE_FLOOR_FPPG: float = 6.0
_MIN_USAGE_BONUS: float = 3.5


def _get_exposure_cap(rank: int, total: int, global_cap: float) -> float:
    pct = (rank + 1) / total
    for tier_pct, tier_cap in _EXPOSURE_TIERS:
        if pct <= tier_pct:
            return min(tier_cap, global_cap)
    return min(1.0, global_cap)


# ── Data helpers ─────────────────────────────────────────────────────────────
def load_this_weeks_stats() -> dict[str, Any]:
    if not _STATS_PATH.exists():
        raise FileNotFoundError(f"this_weeks_stats.json not found at {_STATS_PATH}")
    with _STATS_PATH.open("r", encoding="utf-8") as f:
        return json.load(f)


def _build_flat_fighters(stats: dict[str, Any]) -> list[dict[str, Any]]:
    fighters = []
    for fight in stats.get("fights", []):
        if not isinstance(fight, dict):
            logger.warning("Skipping non-dict fight entry: %r", fight)
            continue
        for f in fight.get("fighters", []):
            if not isinstance(f, dict):
                logger.warning("Skipping non-dict fighter entry in fight %s: %r", fight.get("fight_id"), f)
                continue
            fighters.append({
                "id": str(f.get("dk_id", "")),
                "name": str(f.get("name", "Unknown")),
                "salary": int(f.get("salary") or 0),
                "avgFPPG": float(f.get("avgPointsPerGame") or f.get("avgFPPG") or 0.0),
                "fight_id": str(fight.get("fight_id", "")),
            })
    return fighters


def _name_to_first_last(full_name: str) -> tuple[str, str]:
    parts = full_name.strip().split(" ", 1)
    return (parts[0], parts[1] if len(parts) > 1 else "")


# ── Main optimizer ───────────────────────────────────────────────────────────
def run_optimizer(request: OptimizeRequest) -> list[LineupOut]:
    stats = load_this_weeks_stats()
    flat = _build_flat_fighters(stats)

    # ── Load matchup-aware projections ───────────────────────────────────
    try:
        proj_list = project_full_card(stats)
        proj_by_id = {p["id"]: p for p in proj_list}
    except Exception as exc:
        logger.warning("Projection engine failed, falling back to DK avgs: %s", exc)
        proj_by_id = {}

    excluded_set = set(request.excluded_fighters)
    locked_set = set(request.locked_fighters)

    id_to_raw = {f["id"]: f for f in flat}

    eligible = [f for f in flat if f["id"] not in excluded_set and f["salary"] > 0]

    if len(eligible) < 6:
        raise ValueError(f"Not enough eligible fighters (need >=6, have {len(eligible)})")

    mode = request.salary_mode
    weight = _MODE_SALARY_WEIGHT[mode]

    # Adjusted fppg with matchup-aware projection + salary bias + tier bonus
    def _adjusted(f: dict) -> float:
        # Use matchup-aware projection if available, else fall back to DK avg
        proj = proj_by_id.get(f["id"])
        if proj:
            base = proj["proj_fppg"]
        else:
            base = f["avgFPPG"]
            # Debut / 0-FPPG fighters get a salary-scaled default projection
            if base <= 0:
                base = _debut_default_fppg(f["salary"])

        # Debut fighters from projection engine may still need floor
        if base <= 0:
            base = _debut_default_fppg(f["salary"])

        adj = base + f["salary"] * weight + _tier_bonus(mode, f["salary"])
        # Mild boost for low-projected but viable fighters (applied in all modes)
        if 0 < base < _MIN_USAGE_FLOOR_FPPG:
            adj += _MIN_USAGE_BONUS
        return max(adj, 0.01)

    fighter_adj = [(f, _adjusted(f)) for f in eligible]

    # Rank and assign exposure caps
    sorted_desc = sorted(fighter_adj, key=lambda x: -x[1])
    n = len(sorted_desc)

    exposure_caps = {}
    for rank, (fighter, _) in enumerate(sorted_desc):
        fid = fighter["id"]
        if fid in locked_set:
            exposure_caps[fid] = 1.0
        elif fighter["avgFPPG"] <= 0:
            exposure_caps[fid] = _DEBUT_MAX_EXPOSURE[mode]
        else:
            exposure_caps[fid] = _get_exposure_cap(rank, n, request.exposure_limit)

    # ── Fight-capacity safety: ensure each fight can cover enough lineups ────
    # In a 50-lineup run, each fight typically appears in ~25 lineups (6 of 12
    # fights per lineup). With randomness, some fights appear 30+. If both
    # fighters have restricted caps, the solver can become infeasible.
    # Fix: when combined cap < threshold, raise the NON-debut fighter's cap
    # just enough. If both are debuts or both are regular, raise the one with
    # the higher current cap.
    _MIN_FIGHT_COMBINED = 0.80  # v5.3: restored from 0.65 — fight 11 Tommy(7)+Manolo(33)=40 slots
    fight_groups: dict[str, list[str]] = {}
    for f in eligible:
        fight_groups.setdefault(f["fight_id"], []).append(f["id"])
    fid_to_fighter = {f["id"]: f for f in eligible}
    for fight_id, fids in fight_groups.items():
        if len(fids) != 2:
            continue
        a, b = fids
        cap_a = exposure_caps.get(a, 1.0)
        cap_b = exposure_caps.get(b, 1.0)
        combined = cap_a + cap_b
        if combined >= _MIN_FIGHT_COMBINED:
            continue
        shortfall = _MIN_FIGHT_COMBINED - combined
        # Prefer to raise the non-debutant's cap
        a_is_debut = fid_to_fighter[a]["avgFPPG"] <= 0
        b_is_debut = fid_to_fighter[b]["avgFPPG"] <= 0
        if a_is_debut and not b_is_debut:
            target = b
        elif b_is_debut and not a_is_debut:
            target = a
        else:
            # Both same type — raise whichever has the higher cap
            target = a if cap_a >= cap_b else b
        exposure_caps[target] = min(exposure_caps[target] + shortfall, 1.0)

    # ── Apply per-fighter exposure overrides (user-specified min/max) ────────
    # These are applied AFTER rank-based caps and fight-capacity safety so the
    # user's intent wins. Locked/excluded fighters skip this block.
    min_exposure_caps: dict[str, float | None] = {f["id"]: None for f in eligible}
    for fid, overrides in request.fighter_overrides.items():
        if fid not in exposure_caps:
            continue
        user_max = overrides.get("max_exposure")
        user_min = overrides.get("min_exposure")
        if user_max is not None and user_min is not None and float(user_min) < float(user_max):
            # True range — sample a random target within [user_min, user_max] and
            # set BOTH min and max close to that target.  This is the key fix for
            # low-projected fighters: previously only the ceiling was randomised, so
            # fighters the solver "doesn't want" still hugged their original floor.
            # By raising the floor to the sampled target the solver is forced to land
            # near target regardless of whether the fighter is high- or low-projected.
            # Each regeneration samples a different target → natural count variation.
            user_min_f = float(user_min)
            user_max_f = float(user_max)
            target = random.triangular(user_min_f, user_max_f)
            # Small headroom above target gives the solver a 2-lineup breathing window
            # (0.04 × 50 = 2) while keeping the count close to target.
            headroom = 0.04
            effective_min = target
            effective_max = min(user_max_f, target + headroom)
            min_exposure_caps[fid] = effective_min
            exposure_caps[fid] = effective_max
        elif user_max is not None:
            # Full lock (min == max) or max-only cap — use exact values.
            exposure_caps[fid] = min(float(user_max), 1.0)
            if user_min is not None:
                min_exposure_caps[fid] = min(float(user_min), exposure_caps[fid])

    # Build pydfs Players
    pydfs_players = [
        Player(
            player_id=fighter["id"],
            first_name=_name_to_first_last(fighter["name"])[0],
            last_name=_name_to_first_last(fighter["name"])[1],
            positions=["F"],
            team=fighter["fight_id"],
            salary=fighter["salary"],
            fppg=adj_fppg,
            max_exposure=exposure_caps[fighter["id"]],
            min_exposure=min_exposure_caps.get(fighter["id"]),
        )
        for fighter, adj_fppg in fighter_adj
    ]

    # Configure optimizer
    opt = get_optimizer(Site.DRAFTKINGS, Sport.MMA)
    opt._settings.max_from_one_team = 1
    opt.add_new_rule(MaxFromOneTeamRule)
    opt.load_players(pydfs_players)

    # Lock fighters
    for fid in locked_set:
        if fid in id_to_raw and fid not in excluded_set:
            try:
                p = opt.get_player_by_id(fid)
                opt.add_player_to_lineup(p)
            except Exception:
                logger.warning("Could not lock fighter %s", fid)

    # Hard salary floors per mode — diverse: none (pure spread), medium: ≥$48.5k,
    # higher: ≥$49.2k (v5.2: was 49500)
    _MIN_SALARY_CAP: dict[str, int | None] = {
        "diverse": None,
        "medium":  48500,   # v5.2: new floor anchors mid-range bottom end
        "higher":  49200,   # v5.2: was 49500, lowered to widen higher's range
    }
    min_sal = _MIN_SALARY_CAP.get(mode)
    if min_sal is not None:
        opt.set_min_salary_cap(min_sal)

    # Add diversity noise
    deviation = _RANDOM_DEVIATION.get(mode)
    if deviation is not None:
        opt.set_fantasy_points_strategy(RandomFantasyPointsStrategy(0.0, deviation))

    # Generate lineups
    lineups: list[LineupOut] = []
    try:
        for lineup in opt.optimize(request.num_lineups):
            raw_fighters = []
            for p in lineup:
                source = id_to_raw.get(p.id, {})
                raw_fighters.append({
                    "id": p.id,
                    "name": p.full_name,
                    "salary": int(p.salary),
                    "avgFPPG": source.get("avgFPPG", 0.0),
                    "fight_id": source.get("fight_id", ""),
                })
            total_salary = sum(f["salary"] for f in raw_fighters)
            projected = round(sum(f["avgFPPG"] for f in raw_fighters), 2)

            lineups.append(LineupOut(
                fighters=raw_fighters,
                total_salary=total_salary,
                projected_fpts=projected,
            ))
    except Exception as exc:
        # If we already have some lineups, return them (exposure caps can
        # become infeasible near the end of large runs — graceful degradation)
        if lineups:
            logger.warning(
                "Stopped at %d/%d lineups (mode=%s): %s",
                len(lineups), request.num_lineups, mode, exc,
            )
        else:
            logger.error("Optimizer error: %s", exc)
            raise ValueError(f"Could not generate lineups: {exc}") from exc

    logger.info("Generated %d/%d lineups (mode=%s)", len(lineups), request.num_lineups, mode)
    return lineups