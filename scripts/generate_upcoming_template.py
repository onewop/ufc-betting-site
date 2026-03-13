"""
generate_upcoming_template.py
─────────────────────────────
Reads DKSalaries.csv, extracts this week's fight pairings from the
"Game Info" column, and writes (or overwrites) public/upcoming.csv with
a template that has RedFighter / BlueFighter filled in and all odds
columns set to NaN.

After running this, fill in the odds columns manually or from a sportsbook:
  RedOdds      BlueOdds
  RKOOdds      BKOOdds
  RSubOdds     BSubOdds
  RedDecOdds   BlueDecOdds

Usage:
  python scripts/generate_upcoming_template.py

Or to keep the existing file and only add missing fights:
  python scripts/generate_upcoming_template.py --merge
"""

import os
import re
import sys
import argparse
import pandas as pd

DK_PATH       = "DKSalaries.csv"
OUTPUT_PATH   = "public/upcoming.csv"

# Minimal columns needed by aggregate_stats.py odds enrichment
ODDS_COLUMNS = [
    "RedFighter", "BlueFighter",
    "RedOdds", "BlueOdds",
    "RKOOdds", "BKOOdds",
    "RSubOdds", "BSubOdds",
    "RedDecOdds", "BlueDecOdds",
]


def extract_fights(dk_path: str) -> list[dict]:
    """Parse DKSalaries.csv Game Info column to get (red, blue) pairs.

    Strategy: both fighters in a matchup share the same Game Info string.
    Group rows by their normalised game_info key and take the two fighters
    in each group, using the '@' position to assign corners.
    """
    dk = pd.read_csv(dk_path)
    if "Game Info" not in dk.columns or "Name" not in dk.columns:
        print("❌ DKSalaries.csv missing 'Game Info' or 'Name' column")
        sys.exit(1)

    # Filter out cancelled / missing entries
    dk = dk.dropna(subset=["Game Info"])
    dk = dk[dk["Game Info"].str.contains("@", na=False)]
    dk = dk[~dk["Game Info"].str.startswith("Cancelled")]

    # Extract normalised matchup key (everything before the date)
    def _matchup_key(gi):
        m = re.match(r'^(.+?)\s+\d{1,2}/\d{1,2}/\d{4}', str(gi))
        return m.group(1).strip().lower() if m else str(gi).lower()

    dk["_key"] = dk["Game Info"].apply(_matchup_key)

    rows = []
    for key, group in dk.groupby("_key"):
        names = group["Name"].dropna().tolist()
        if len(names) < 2:
            continue

        # The matchup key looks like "blueName@redName"
        # Determine which name is "red" (right of @) vs "blue" (left of @)
        if "@" in key:
            blue_part, red_part = key.rsplit("@", 1)
        else:
            blue_part, red_part = "", key

        def _best_match(part, candidates):
            """Return the candidate whose last token best matches part."""
            part_clean = re.sub(r'[^a-z0-9]', '', part)
            scored = []
            for c in candidates:
                c_clean = re.sub(r'[^a-z0-9]', '', c.lower())
                # Check if last name token of c is in part_clean
                last = re.sub(r'[^a-z0-9]', '', c.split()[-1].lower())
                score = 2 if last in part_clean else (1 if part_clean[:4] in c_clean else 0)
                scored.append((score, c))
            scored.sort(reverse=True)
            return scored[0][1] if scored else candidates[0]

        red_name  = _best_match(red_part,  names)
        blue_name = _best_match(blue_part, [n for n in names if n != red_name])

        rows.append({"RedFighter": red_name, "BlueFighter": blue_name})

    return rows


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--merge", action="store_true",
                        help="Keep existing rows, only add missing fights")
    args = parser.parse_args()

    if not os.path.exists(DK_PATH):
        print(f"❌ {DK_PATH} not found. Run from the project root.")
        sys.exit(1)

    fight_rows = extract_fights(DK_PATH)
    if not fight_rows:
        print("⚠️  No fights extracted from DKSalaries.csv")
        sys.exit(1)

    # Build template DataFrame
    template = pd.DataFrame(fight_rows)
    for col in ODDS_COLUMNS:
        if col not in template.columns:
            template[col] = float("nan")

    template = template[ODDS_COLUMNS]

    if args.merge and os.path.exists(OUTPUT_PATH):
        existing = pd.read_csv(OUTPUT_PATH)
        # Add any missing columns
        for col in ODDS_COLUMNS:
            if col not in existing.columns:
                existing[col] = float("nan")
        # Append fights not already present
        existing_pairs = set(zip(existing["RedFighter"], existing["BlueFighter"]))
        new_rows = template[
            ~template.apply(
                lambda r: (r["RedFighter"], r["BlueFighter"]) in existing_pairs, axis=1
            )
        ]
        combined = pd.concat([existing, new_rows], ignore_index=True)
        combined.to_csv(OUTPUT_PATH, index=False)
        print(f"✅ Merged {len(new_rows)} new fight(s) into {OUTPUT_PATH}")
    else:
        template.to_csv(OUTPUT_PATH, index=False)
        print(f"✅ Wrote {len(template)} fights to {OUTPUT_PATH}")

    print("\nFights written:")
    for _, row in template.iterrows():
        print(f"  {row['RedFighter']} (Red) vs {row['BlueFighter']} (Blue)")

    print(f"""
─────────────────────────────────────────────────────
Next step: fill in the odds columns in {OUTPUT_PATH}

  RedOdds / BlueOdds   — moneyline (e.g. -250, +200)
  RKOOdds  / BKOOdds   — KO/TKO to win odds
  RSubOdds / BSubOdds  — submission to win odds
  RedDecOdds / BlueDecOdds — decision to win odds

Then re-run:  python scripts/aggregate_stats.py
─────────────────────────────────────────────────────
""")


if __name__ == "__main__":
    main()
