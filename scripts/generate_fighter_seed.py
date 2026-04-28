"""
scripts/generate_fighter_seed.py — Build fighter seed lists from ufc-master.csv.

Uses the GitHub-sourced ufc-master.csv (6,528 rows, 2010-2024) to produce:

  public/fighters_active.json  — full detail for active/recent fighters
  public/fighters_all.json     — lightweight index of every UFC fighter

These files feed into build_fighter_profiles.py so heavy scraping (Sherdog +
portrait images) is only done for fighters who are actually still competing.

Usage:
  # Default: active = last fight on or after 2023-01-01
  python3 scripts/generate_fighter_seed.py

  # Custom cutoff year:
  python3 scripts/generate_fighter_seed.py --active-since 2022

  # Dry-run (print summary only, no files written):
  python3 scripts/generate_fighter_seed.py --dry-run
"""
from __future__ import annotations

import argparse
import csv
import json
import re
import sys
from collections import defaultdict
from datetime import date, datetime
from pathlib import Path

# ── Paths ────────────────────────────────────────────────────────────────────
SCRIPT_DIR  = Path(__file__).resolve().parent
REPO_ROOT   = SCRIPT_DIR.parent
PUBLIC_DIR  = REPO_ROOT / "public"
CSV_PATH    = PUBLIC_DIR / "ufc-master.csv"

OUT_ACTIVE  = PUBLIC_DIR / "fighters_active.json"
OUT_ALL     = PUBLIC_DIR / "fighters_all.json"


# ── Helpers ──────────────────────────────────────────────────────────────────

def to_slug(name: str) -> str:
    """Convert a fighter name to a URL-safe slug. Must match build_fighter_profiles.py."""
    s = name.lower().strip()
    s = re.sub(r"[''`]", "", s)
    s = re.sub(r"[^a-z0-9]+", "-", s)
    return s.strip("-")


def _safe_float(val: str, default: float | None = None) -> float | None:
    """Return float or default for empty / non-numeric strings."""
    try:
        v = float(val)
        return v if v != 0.0 else default
    except (ValueError, TypeError):
        return default


def _safe_int(val: str, default: int = 0) -> int:
    try:
        return int(float(val))
    except (ValueError, TypeError):
        return default


def _height_cms_to_str(cms_str: str) -> str | None:
    """Convert '180.34' cm string to human-readable '5\' 11"'."""
    v = _safe_float(cms_str)
    if not v:
        return None
    total_inches = v / 2.54
    feet   = int(total_inches // 12)
    inches = round(total_inches % 12)
    if inches == 12:
        feet  += 1
        inches = 0
    return f"{feet}' {inches}\""


def _reach_cms_to_str(cms_str: str) -> str | None:
    """Convert '187.96' cm string to '74"'."""
    v = _safe_float(cms_str)
    if not v:
        return None
    return f'{round(v / 2.54)}"'


# ── Main ──────────────────────────────────────────────────────────────────────

def build_seed(active_since_year: int = 2023, dry_run: bool = False) -> None:
    if not CSV_PATH.exists():
        sys.exit(f"❌ CSV not found: {CSV_PATH}")

    cutoff = date(active_since_year, 1, 1)

    # ── Load CSV ─────────────────────────────────────────────────────────────
    with open(CSV_PATH, newline="", encoding="utf-8") as f:
        rows = list(csv.DictReader(f))

    print(f"📂 Loaded {len(rows):,} rows from {CSV_PATH.name}")

    # ── Per-fighter data accumulator ─────────────────────────────────────────
    # key = normalised name, value = dict of aggregated info
    fighters: dict[str, dict] = {}

    def _process_corner(row: dict, corner: str) -> None:
        """Extract and accumulate data for one corner (Red/Blue) in a fight row."""
        pfx  = corner          # "Red" or "Blue"
        opfx = "Blue" if corner == "Red" else "Red"

        name = row.get(f"{pfx}Fighter", "").strip()
        if not name:
            return

        fight_date_str = row.get("Date", "").strip()
        try:
            fight_date = date.fromisoformat(fight_date_str)
        except ValueError:
            return

        winner_corner = row.get("Winner", "").strip()  # "Red" or "Blue"
        won  = winner_corner == corner
        lost = winner_corner == opfx

        finish      = row.get("Finish", "").strip().upper()     # KO, TKO, SUB, U-DEC, S-DEC, M-DEC
        finish_details = row.get("FinishDetails", "").strip()
        weight_class = row.get("WeightClass", "").strip()
        gender       = row.get("Gender", "").strip()
        title_bout   = row.get("TitleBout", "").strip().lower() == "true"

        # Stats at time of fight (cumulative record going IN)
        height_cms  = row.get(f"{pfx}HeightCms", "")
        reach_cms   = row.get(f"{pfx}ReachCms", "")
        weight_lbs  = row.get(f"{pfx}WeightLbs", "")
        stance      = row.get(f"{pfx}Stance", "")
        age         = _safe_int(row.get(f"{pfx}Age", "0"))

        # Cumulative totals going INTO this fight
        wins_into        = _safe_int(row.get(f"{pfx}Wins", "0"))
        losses_into      = _safe_int(row.get(f"{pfx}Losses", "0"))
        draws_into       = _safe_int(row.get(f"{pfx}Draws", "0"))
        wins_ko_into     = _safe_int(row.get(f"{pfx}WinsByKO", "0"))
        wins_tko_into    = _safe_int(row.get(f"{pfx}WinsByTKODoctorStoppage", "0"))
        wins_sub_into    = _safe_int(row.get(f"{pfx}WinsBySubmission", "0"))
        wins_dec_u_into  = _safe_int(row.get(f"{pfx}WinsByDecisionUnanimous", "0"))
        wins_dec_s_into  = _safe_int(row.get(f"{pfx}WinsByDecisionSplit", "0"))
        wins_dec_m_into  = _safe_int(row.get(f"{pfx}WinsByDecisionMajority", "0"))
        title_bouts_into = _safe_int(row.get(f"{pfx}TotalTitleBouts", "0"))
        win_streak_into  = _safe_int(row.get(f"{pfx}CurrentWinStreak", "0"))

        # UFC ranking (use the matchup weight class rank if available, else PFP)
        match_wc_rank = _safe_float(row.get(f"{pfx[0]}MatchWCRank", ""))
        pfp_rank      = _safe_float(row.get(f"{'R' if pfx == 'Red' else 'B'}PFPRank", ""))

        key = name  # use exact name as key (normalised below)

        if key not in fighters:
            fighters[key] = {
                "name":          name,
                "slug":          to_slug(name),
                "gender":        gender,
                # Best physical attributes seen (most recent non-null value)
                "height_cms":    None,
                "reach_cms":     None,
                "weight_lbs":    None,
                "stance":        None,
                # Fights list for aggregation
                "_fights":       [],
                # Most recent known stats
                "_latest_date":  None,
                "_latest_wc":    None,
                "_latest_record_row": None,
            }

        f = fighters[key]

        # Update physical attributes with any non-null values
        if _safe_float(height_cms):
            f["height_cms"] = height_cms
        if _safe_float(reach_cms):
            f["reach_cms"] = reach_cms
        if _safe_float(weight_lbs):
            f["weight_lbs"] = weight_lbs
        if stance:
            f["stance"] = stance
        if gender:
            f["gender"] = gender

        f["_fights"].append({
            "date":       fight_date,
            "won":        won,
            "lost":       lost,
            "finish":     finish,
            "weight_class": weight_class,
            "title_bout": title_bout,
            # Pre-fight cumulative record
            "wins_into":       wins_into,
            "losses_into":     losses_into,
            "draws_into":      draws_into,
            "wins_ko_into":    wins_ko_into + wins_tko_into,
            "wins_sub_into":   wins_sub_into,
            "wins_dec_into":   wins_dec_u_into + wins_dec_s_into + wins_dec_m_into,
            "title_bouts_into": title_bouts_into,
            "win_streak_into": win_streak_into,
            "match_wc_rank":   match_wc_rank,
            "pfp_rank":        pfp_rank,
            "age_at_fight":    age,
        })

        # Track most recent fight row for record extraction
        if f["_latest_date"] is None or fight_date > f["_latest_date"]:
            f["_latest_date"]       = fight_date
            f["_latest_wc"]         = weight_class
            f["_latest_record_row"] = {
                "wins_into":       wins_into,
                "losses_into":     losses_into,
                "draws_into":      draws_into,
                "wins_ko_into":    wins_ko_into + wins_tko_into,
                "wins_sub_into":   wins_sub_into,
                "wins_dec_into":   wins_dec_u_into + wins_dec_s_into + wins_dec_m_into,
                "title_bouts_into": title_bouts_into,
                "won":             won,
                "lost":            lost,
                "finish":          finish,
                "match_wc_rank":   match_wc_rank,
                "pfp_rank":        pfp_rank,
            }

    # ── Process all rows ─────────────────────────────────────────────────────
    for row in rows:
        _process_corner(row, "Red")
        _process_corner(row, "Blue")

    print(f"✅ Found {len(fighters):,} unique fighters")

    # ── Aggregate each fighter ────────────────────────────────────────────────
    active_list  = []
    all_list     = []

    for name, f in fighters.items():
        fights   = sorted(f["_fights"], key=lambda x: x["date"])
        last_row = f["_latest_record_row"] or {}

        last_date     = f["_latest_date"]
        fight_count   = len(fights)
        is_active     = last_date is not None and last_date >= cutoff

        # ── Calculate actual record (pre-fight record + this fight outcome) ──
        # The most recent row has the record going INTO that fight.
        # Add 1 win or loss for the outcome of that fight.
        wins   = last_row.get("wins_into", 0)
        losses = last_row.get("losses_into", 0)
        draws  = last_row.get("draws_into", 0)
        if last_row.get("won"):
            wins += 1
        elif last_row.get("lost"):
            losses += 1
        # (NC / draw increments draws_into already in next fight, skip for now)

        # ── Finish breakdown (cumulative at end of final fight) ──────────────
        wins_ko  = last_row.get("wins_ko_into", 0)
        wins_sub = last_row.get("wins_sub_into", 0)
        wins_dec = last_row.get("wins_dec_into", 0)
        # Add this fight's outcome
        if last_row.get("won"):
            finish = last_row.get("finish", "")
            if finish in ("KO", "TKO"):
                wins_ko  += 1
            elif finish == "SUB":
                wins_sub += 1
            elif "DEC" in finish:
                wins_dec += 1

        total_wins    = wins
        finish_pct    = round((wins_ko + wins_sub) / total_wins * 100, 1) if total_wins > 0 else 0.0

        # ── Win streak (current) ─────────────────────────────────────────────
        win_streak = last_row.get("win_streak_into", 0) + (1 if last_row.get("won") else 0)
        if last_row.get("lost"):
            win_streak = 0

        # ── Rankings ─────────────────────────────────────────────────────────
        best_rank  = last_row.get("match_wc_rank")   # rank in their weight class
        pfp_rank   = last_row.get("pfp_rank")

        # ── Title bout history ───────────────────────────────────────────────
        title_bouts = last_row.get("title_bouts_into", 0) + (1 if fights[-1]["title_bout"] else 0)

        # ── Physical stats ────────────────────────────────────────────────────
        height_str = _height_cms_to_str(f.get("height_cms") or "")
        reach_str  = _reach_cms_to_str(f.get("reach_cms") or "")
        wt_lbs     = f.get("weight_lbs") or ""
        stance     = f.get("stance") or ""

        # ── Weight class history ─────────────────────────────────────────────
        wc_set   = sorted({fgt["weight_class"] for fgt in fights if fgt["weight_class"]})
        main_wc  = f["_latest_wc"] or (wc_set[0] if wc_set else "")
        gender   = f.get("gender", "")

        record_str = f"{wins}-{losses}-{draws}"

        entry_full = {
            "name":            name,
            "slug":            f["slug"],
            "gender":          gender,
            "weight_class":    main_wc,
            "weight_classes":  wc_set,
            "record":          record_str,
            "wins":            wins,
            "losses":          losses,
            "draws":           draws,
            "wins_ko_tko":     wins_ko,
            "wins_submission": wins_sub,
            "wins_decision":   wins_dec,
            "finish_rate_pct": finish_pct,
            "win_streak":      win_streak,
            "title_bouts":     title_bouts,
            "fight_count_ufc": fight_count,
            "last_fight_date": last_date.isoformat() if last_date else None,
            "is_active":       is_active,
            "rank_in_class":   int(best_rank) if best_rank else None,
            "pfp_rank":        int(pfp_rank)  if pfp_rank  else None,
            "height":          height_str,
            "reach":           reach_str,
            "weight_lbs":      f"{int(float(wt_lbs))} lbs" if wt_lbs else None,
            "stance":          stance or None,
            # Source marker so build_fighter_profiles.py knows this came from CSV seed
            "_seed_source":    "ufc-master.csv",
        }

        entry_light = {
            "name":           name,
            "slug":           f["slug"],
            "gender":         gender,
            "weight_class":   main_wc,
            "record":         record_str,
            "last_fight_date": last_date.isoformat() if last_date else None,
            "is_active":      is_active,
            "fight_count_ufc": fight_count,
        }

        all_list.append(entry_light)
        if is_active:
            active_list.append(entry_full)

    # Sort active by most recent fight date (most active first)
    active_list.sort(key=lambda x: x["last_fight_date"] or "0000", reverse=True)
    all_list.sort(key=lambda x: x["last_fight_date"] or "0000", reverse=True)

    # ── Summary ───────────────────────────────────────────────────────────────
    print(f"\n📊 Summary:")
    print(f"   Total unique fighters : {len(all_list):>6,}")
    print(f"   Active (>= {active_since_year}-01-01) : {len(active_list):>6,}")
    print(f"   Inactive / retired    : {len(all_list) - len(active_list):>6,}")

    # ── Sample output ─────────────────────────────────────────────────────────
    print(f"\n🔍 Sample active fighters (first 8):")
    print(f"  {'Name':<28} {'Record':<10} {'Division':<20} {'Last Fight':<12} {'Rank':<6} {'Finish%'}")
    print(f"  {'-'*28} {'-'*10} {'-'*20} {'-'*12} {'-'*6} {'-'*7}")
    for f in active_list[:8]:
        rank = str(f["rank_in_class"]) if f["rank_in_class"] is not None else "-"
        print(
            f"  {f['name']:<28} {f['record']:<10} {f['weight_class']:<20} "
            f"{f['last_fight_date']:<12} #{rank:<5} {f['finish_rate_pct']}%"
        )

    if dry_run:
        print("\n⚠️  --dry-run: no files written.")
        return

    # ── Write output ─────────────────────────────────────────────────────────
    PUBLIC_DIR.mkdir(exist_ok=True)

    with open(OUT_ACTIVE, "w", encoding="utf-8") as fh:
        json.dump(active_list, fh, indent=2, ensure_ascii=False)
    print(f"\n✅ Wrote {len(active_list):,} active fighters → {OUT_ACTIVE.relative_to(REPO_ROOT)}")

    with open(OUT_ALL, "w", encoding="utf-8") as fh:
        json.dump(all_list, fh, indent=2, ensure_ascii=False)
    print(f"✅ Wrote {len(all_list):,} total fighters  → {OUT_ALL.relative_to(REPO_ROOT)}")

    print(f"""
╔══════════════════════════════════════════════════════════════════╗
║  Next step: run build_fighter_profiles.py using the seed list    ║
║                                                                  ║
║  python3 scripts/build_fighter_profiles.py --active-only         ║
║                                                                  ║
║  This will scrape Sherdog + UFC.com portraits for active         ║
║  fighters only (~{len(active_list)} fighters vs {len(all_list)} total), cutting run time   ║
║  from ~12 hours to ~1–2 hours.                                   ║
╚══════════════════════════════════════════════════════════════════╝""")


# ── CLI ───────────────────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(
        description="Build fighter seed lists from ufc-master.csv"
    )
    parser.add_argument(
        "--active-since",
        type=int,
        default=2023,
        metavar="YEAR",
        help="Fighters whose last UFC fight was on or after YEAR-01-01 are marked active (default: 2023)",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print summary only — do not write any files",
    )
    args = parser.parse_args()
    build_seed(active_since_year=args.active_since, dry_run=args.dry_run)


if __name__ == "__main__":
    main()
