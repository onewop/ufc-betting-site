"""
aggregate_stats.py — Main data-pipeline entry point for the UFC DFS/betting site.

HOW TO RUN
----------
From the project root directory (ufc-betting-site-main/):

    python3 scripts/aggregate_stats.py                          # base run (ufc-master.csv only)

    SCRAPE_UFCSTATS=1        python3 scripts/aggregate_stats.py # + td/str defense (~5-10 min)
    SCRAPE_PERFIGHT=1        python3 scripts/aggregate_stats.py # + KD/CTRL time  (~15-30 min first run, instant after)
    SCRAPE_DEF_GRAPPLING=1   python3 scripts/aggregate_stats.py # + sub defense   (instant if PERFIGHT cache exists)
    SCRAPE_SHERDOG=1         python3 scripts/aggregate_stats.py # + nationality/team/record (~3-6 min)
    SCRAPE_UFCSTATS_RESULTS=1 python3 scripts/aggregate_stats.py # downloads raw UFC CSVs

    # Full run with all scrapers + Sherdog event page prefetch:
    SCRAPE_UFCSTATS=1 SCRAPE_PERFIGHT=1 SCRAPE_DEF_GRAPPLING=1 \\
    SCRAPE_SHERDOG=1 SHERDOG_EVENT_URL=https://www.sherdog.com/events/... \\
    python3 scripts/aggregate_stats.py

OUTPUT
------
  public/this_weeks_stats.json    — consumed by the React app
  public/current_event.json       — event title banner
  public/DKSalaries.csv           — synced from DKSalaries.csv
  public/archive/                 — auto-timestamped backup of the previous JSON

ROLLBACK (if something breaks)
-------------------------------
    cp _archive/scripts/aggregate_stats_ORIGINAL_PRESPLIT.py scripts/aggregate_stats.py

FILE STRUCTURE (split from the original 2416-line monolith)
-----------------------------------------------------------
  ag_utils.py     — normalize_name, save_to_json, _parse_of and helpers
  ag_sherdog.py   — all Sherdog.com scraping (event card + fighter profiles)
  ag_ufcstats.py  — UFCStats.com fighter profile scraper
  ag_perfight.py  — UFCStats per-fight + defensive grappling scrapers + HTTP cache
  aggregate_stats.py (THIS FILE) — csv_to_json orchestration + __main__
"""

import pandas as pd
import json
import os
import re
import time
import random
from fuzzywuzzy import process

# ── Pull in all scraper helpers from the split modules ──────────────────────
# ag_utils: name normalisation, JSON save-with-backup
from ag_utils import normalize_name, save_to_json

# ag_sherdog: Sherdog event card, fighter profile, and BestFightOdds scrapers
from ag_sherdog import (
    scrape_sherdog_event_card,
    _match_sherdog_card,
    scrape_sherdog_fighter_data,
)

# ag_ufcstats: UFCStats.com fighter-profile scraper (td_def, str_def, bio)
from ag_ufcstats import scrape_ufcstats_fighter

# ag_perfight: UFCStats per-fight (KD/CTRL) and defensive grappling scrapers
from ag_perfight import scrape_ufcstats_perfight, scrape_ufcstats_def_grappling


def csv_to_json(
    dk_path="DKSalaries.csv",  # Changed to current directory (no ../)
    fighter_details_path="../scrape_ufc_stats/ufc_fighter_details.csv",
    fighter_tott_path="../scrape_ufc_stats/ufc_fighter_tott.csv",
    output_path="public/this_weeks_stats.json"
):
    try:
        print("Loading DKSalaries.csv from:", dk_path)

        # ── Load previous JSON for Sherdog field preservation ─────────────────
        # When SCRAPE_SHERDOG=0 (the default), the pipeline rebuilds everything from
        # scratch and loses fight_history / nationality / team that previous runs
        # scraped from Sherdog.  We load the existing output file once here so the
        # Sherdog-skipped branch can copy those fields over for matching fighters.
        _prev_sherdog = {}  # { normalized_name: fighter_dict_from_prev_run }
        if os.path.exists(output_path):
            try:
                with open(output_path) as _pf:
                    _prev_data = json.load(_pf)
                for _pfight in _prev_data.get('fights', []):
                    for _pf in _pfight.get('fighters', []):
                        _pname = normalize_name(_pf.get('name', ''))
                        if _pname:
                            _prev_sherdog[_pname] = _pf
                if _prev_sherdog:
                    print(f"ℹ️  Loaded previous JSON ({len(_prev_sherdog)} fighters) for Sherdog field preservation")
            except Exception as _e:
                print(f"ℹ️  Could not load previous JSON for Sherdog preservation: {_e}")

        # The CSV in this repo has a proper header on the first line and
        # data starting on the second line. Do not skip rows here.
        dk_df = pd.read_csv(dk_path, header=0)
        column_names = ['Position', 'Name + ID', 'Name', 'ID', 'Roster Position', 'Salary', 'Game Info', 'TeamAbbrev', 'AvgPointsPerGame']
        dk_df = dk_df.iloc[:, -len(column_names):]
        dk_df.columns = column_names

        dk_df['Name'] = dk_df['Name'].astype(str).str.strip()
        dk_df['Salary'] = pd.to_numeric(dk_df['Salary'], errors='coerce').fillna(0).astype(int)

        # Debug: Print all unique Game Info values BEFORE processing
        print("\n" + "="*80)
        print("📋 ALL UNIQUE 'Game Info' VALUES FROM CSV:")
        print("="*80)
        game_info_values = dk_df['Game Info'].astype(str).str.strip().unique()
        for idx, info in enumerate(game_info_values, 1):
            print(f"{idx}. {info}")
        print("="*80 + "\n")

        # Remove rows where Game Info signals a cancelled fight
        cancelled_mask = dk_df['Game Info'].astype(str).str.strip().str.lower() == 'cancelled'
        cancelled_mask |= dk_df['Game Info'].astype(str).str.contains('Cancelled', case=False, na=False)
        if cancelled_mask.any():
            for _, row in dk_df[cancelled_mask].iterrows():
                print(f"⛔ Skipped {row['Name']} - Cancelled fight")
            dk_df = dk_df[~cancelled_mask].copy()

        # Only keep rows whose Game Info contains "@" (valid matchup format)
        valid_mask = dk_df['Game Info'].astype(str).str.contains('@', na=False)
        invalid_rows = dk_df[~valid_mask]
        if not invalid_rows.empty:
            for _, row in invalid_rows.iterrows():
                print(f"⚠️  Skipped {row['Name']} - Game Info has no '@': {row['Game Info']!r}")
            dk_df = dk_df[valid_mask].copy()

        # ── Derive event date from the Game Info column ────────────────────────
        # Game Info format: "Fighter1@Fighter2 MM/DD/YYYY HH:MMPM ET"
        # Take the latest fight date on the card as the event date.
        date_series = dk_df['Game Info'].str.extract(
            r'(\d{1,2}/\d{1,2}/\d{4})', expand=False
        ).dropna()
        event_date_str = "Unknown"
        if not date_series.empty:
            from datetime import datetime as _dt
            parsed_dates = []
            for d in date_series:
                try:
                    parsed_dates.append(_dt.strptime(d, "%m/%d/%Y"))
                except ValueError:
                    pass
            if parsed_dates:
                latest = max(parsed_dates)
                event_date_str = latest.strftime("%B %-d, %Y")

        # Improved matchup extraction: extract "Fighter1@Fighter2" before the date
        dk_df['matchup_raw'] = dk_df['Game Info'].astype(str).str.strip()
        
        # Extract everything before the date pattern (MM/DD/YYYY)
        # This captures "Fighter1@Fighter2" even if fighter names have spaces
        dk_df['matchup'] = dk_df['matchup_raw'].str.extract(
            r'(.+?)\s+\d{1,2}/\d{1,2}/\d{4}',
            expand=False
        )
        
        # If extraction failed (no date found), use the raw value
        dk_df['matchup'] = dk_df['matchup'].fillna(dk_df['matchup_raw'])
        
        # Handle edge cases: if matchup is very short or incomplete, log it
        dk_df['matchup'] = dk_df['matchup'].str.strip()
        
        # Replace @ with vs.
        dk_df['matchup'] = dk_df['matchup'].str.replace('@', ' vs. ', regex=False)
        
        # Final cleanup
        dk_df['matchup'] = dk_df['matchup'].str.strip()

        # Debug: show what we parsed
        print("\n" + "="*80)
        print("✅ EXTRACTED MATCHUPS (after parsing):")
        print("="*80)
        unique_matchups = dk_df['matchup'].unique()
        print(f"Found {len(unique_matchups)} unique matchups from {len(dk_df)} rows")
        for idx, matchup in enumerate(unique_matchups, 1):
            count = (dk_df['matchup'] == matchup).sum()
            print(f"{idx}. '{matchup}' ({count} fighter rows)")
        print("="*80 + "\n")
        print(f"Found {len(unique_matchups)} valid matchups after skipping cancellations\n")

        # Track skipped matchups for logging
        skipped_matchups = []

        fights = []
        for matchup, group in dk_df.groupby('matchup'):
            group_clean = group.dropna(subset=['Name', 'Salary'])
            
            # Only accept exactly 2 fighters per matchup
            if len(group_clean) != 2:
                reason = f"found {len(group_clean)} valid fighters (expected 2), raw group size: {len(group)}"
                raw_game_infos = group['Game Info'].unique().tolist()
                skipped_matchups.append({
                    'matchup': matchup,
                    'reason': reason,
                    'raw_game_infos': raw_game_infos,
                    'fighters': group_clean['Name'].tolist()
                })
                print(f"⚠️  SKIPPED: '{matchup}'")
                print(f"   └─ Reason: {reason}")
                print(f"   └─ Fighters found: {group_clean['Name'].tolist()}")
                print(f"   └─ Raw Game Info values: {raw_game_infos}")
                continue

            fighters = []
            for _, row in group_clean.iterrows():
                fighters.append({
                    "name": row['Name'].strip(),
                    "dk_id": str(row['ID']),
                    "salary": int(row['Salary']),
                    "avgPointsPerGame": float(row.get('AvgPointsPerGame', 0.0)),
                    "nickname": None,
                    "record": "N/A",
                    "height": "N/A",
                    "reach": "N/A",
                    "stance": "N/A",
                    "dob": "N/A",
                    "stats": {
                        "slpm": 0.0,
                        "sapm": 0.0,
                        "striking_defense": "N/A",
                        "td_avg": 0.0,
                        "td_defense": "N/A"
                    }
                })
                print(f"  Added fighter: {row['Name'].strip()} | Salary: ${row['Salary']} | AvgPoints: {fighters[-1]['avgPointsPerGame']}")

            fights.append({
                "fight_id": len(fights),
                "matchup": matchup,
                "weight_class": "N/A",
                "fighters": fighters
            })

        # Final summary
        print("\n" + "="*80)
        print(f"✅ PROCESSING COMPLETE")
        print("="*80)
        print(f"Total matchups in CSV: {len(unique_matchups)}")
        print(f"Valid matchups processed: {len(fights)}")
        print(f"Skipped matchups: {len(skipped_matchups)}")
        if skipped_matchups:
            print(f"\nSkipped details:")
            for skip in skipped_matchups:
                print(f"  - '{skip['matchup']}': {skip['reason']}")
        print("="*80 + "\n")

        # ── UFC Master CSV enrichment ──────────────────────────────────────────
        # Use the on-disk ufc-master.csv (Red/Blue per-fight structure).
        # Find each fighter's most recent row and extract career stats.
        ufc_master_path = "public/ufc-master.csv"
        if os.path.exists(ufc_master_path):
            print("\n" + "="*80)
            print("📊 UFC MASTER CSV ENRICHMENT (career stats from historical fights)")
            print("="*80)
            master_df = pd.read_csv(ufc_master_path)
            master_df['Date'] = pd.to_datetime(master_df['Date'], errors='coerce')
            master_df = master_df.sort_values('Date')  # oldest first; .iloc[-1] = most recent

            matched_count = 0
            no_match_count = 0

            for fight in fights:
                for f in fight['fighters']:
                    dk_name = f['name']
                    norm_q = normalize_name(dk_name)

                    # ── Try exact name match as Red or Blue ──────────────────
                    def _find_rows(col):
                        """Return rows where normalize_name(col) == norm_q."""
                        return master_df[master_df[col].apply(
                            lambda n: normalize_name(str(n)) == norm_q
                        )]

                    red_rows = _find_rows('RedFighter')
                    blue_rows = _find_rows('BlueFighter')

                    # Fallback: fuzzy match if no exact hit
                    if red_rows.empty and blue_rows.empty:
                        all_names = pd.concat([
                            master_df['RedFighter'],
                            master_df['BlueFighter']
                        ]).dropna().unique().tolist()
                        norm_names = [normalize_name(n) for n in all_names]
                        best_norm, score = process.extractOne(norm_q, norm_names)
                        if score >= 80:
                            best_name = all_names[norm_names.index(best_norm)]
                            # Guard: the last name (last word) of the DK name must
                            # exactly match the last word of the candidate name
                            # (hyphens preserved) to reject false positives like:
                            #   "Kevin Vallejos" → "Kevin Lee"       (score 86)
                            #   "Elijah Smith"   → "Ashlee Evans-Smith" (score 86)
                            dk_last   = dk_name.split()[-1].lower()
                            cand_last = best_name.split()[-1].lower()
                            if dk_last != cand_last:
                                score = 0  # reject — last-name mismatch
                        if score >= 80:
                            red_rows = master_df[master_df['RedFighter'] == best_name]
                            blue_rows = master_df[master_df['BlueFighter'] == best_name]
                            print(f"  ~ UFC-MASTER [FUZZY] {dk_name} → '{best_name}' (score {score})")

                    # Pick the most recent row (either corner)
                    candidate_rows = []
                    if not red_rows.empty:
                        candidate_rows.append(('red', red_rows.iloc[-1]))
                    if not blue_rows.empty:
                        candidate_rows.append(('blue', blue_rows.iloc[-1]))

                    if not candidate_rows:
                        no_match_count += 1
                        print(f"  ✗ UFC-MASTER [MISS]  {dk_name} — no match found")
                        continue

                    # Use whichever (red/blue) has the later date
                    corner, row = max(candidate_rows,
                        key=lambda cr: cr[1]['Date'] if pd.notna(cr[1]['Date']) else pd.Timestamp.min)
                    p = corner.capitalize()  # 'Red' or 'Blue'

                    wins   = int(row.get(f'{p}Wins', 0) or 0)
                    losses = int(row.get(f'{p}Losses', 0) or 0)
                    draws  = int(row.get(f'{p}Draws', 0) or 0)
                    ko_wins  = (int(row.get(f'{p}WinsByKO', 0) or 0)
                             + int(row.get(f'{p}WinsByTKODoctorStoppage', 0) or 0))
                    sub_wins = int(row.get(f'{p}WinsBySubmission', 0) or 0)
                    dec_wins = (int(row.get(f'{p}WinsByDecisionUnanimous', 0) or 0)
                              + int(row.get(f'{p}WinsByDecisionSplit', 0) or 0)
                              + int(row.get(f'{p}WinsByDecisionMajority', 0) or 0))
                    win_streak  = int(row.get(f'{p}CurrentWinStreak', 0) or 0)
                    loss_streak = int(row.get(f'{p}CurrentLoseStreak', 0) or 0)
                    slpm   = float(row.get(f'{p}AvgSigStrLanded', 0.0) or 0.0)
                    str_pct = float(row.get(f'{p}AvgSigStrPct', 0.0) or 0.0)
                    td_avg  = float(row.get(f'{p}AvgTDLanded', 0.0) or 0.0)
                    td_pct  = float(row.get(f'{p}AvgTDPct', 0.0) or 0.0)
                    height_cm = float(row.get(f'{p}HeightCms', 0.0) or 0.0)
                    reach_cm  = float(row.get(f'{p}ReachCms', 0.0) or 0.0)
                    stance = str(row.get(f'{p}Stance', 'N/A') or 'N/A')

                    total_fights = wins + losses + draws
                    finish_pct = round((ko_wins + sub_wins) / wins * 100, 1) if wins else 0.0
                    dec_pct    = round(dec_wins / wins * 100, 1) if wins else 0.0

                    # Height / reach: convert cm → feet'inches" / inches"
                    def cm_to_ftin(cm):
                        if not cm: return 'N/A'
                        total_inches = cm / 2.54
                        ft = int(total_inches // 12)
                        inch = round(total_inches % 12)
                        return f"{ft}'{inch}\""

                    def cm_to_in(cm):
                        return f'{round(cm / 2.54)}"' if cm else 'N/A'

                    # ── Derived fields from all historical rows for this fighter ────────
                    all_rows = pd.concat(
                        [df for df in [
                            red_rows.assign(_corner='Red'),
                            blue_rows.assign(_corner='Blue'),
                        ] if not df.empty]
                    ).sort_values('Date')

                    def _won(corner_label, row_series):
                        return row_series['Winner'] == corner_label

                    # avg fight duration (minutes, all fights)
                    all_secs = all_rows['TotalFightTimeSecs'].dropna()
                    avg_fight_dur = round(all_secs.mean() / 60, 1) if len(all_secs) else 'N/A'

                    # first round wins
                    r1_wins = 0
                    for _, hr in all_rows.iterrows():
                        won = hr['Winner'] == hr['_corner']
                        if won and hr.get('FinishRound') == 1:
                            r1_wins += 1

                    # career longevity in years
                    valid_dates = all_rows['Date'].dropna()
                    if len(valid_dates) >= 2:
                        career_yrs = round((valid_dates.iloc[-1] - valid_dates.iloc[0]).days / 365.25, 1)
                    else:
                        career_yrs = 'N/A'

                    # last fight result
                    if not all_rows.empty:
                        last_row = all_rows.iloc[-1]
                        last_corner = last_row['_corner']
                        last_won = last_row['Winner'] == last_corner
                        finish = str(last_row.get('Finish', '') or '')
                        finish_detail = str(last_row.get('FinishDetails', '') or '')
                        method = finish_detail if finish_detail and finish_detail != 'nan' else finish
                        last_fight_result = f"{'W' if last_won else 'L'} – {method}" if method and method != 'nan' else ('W' if last_won else 'L')
                    else:
                        last_fight_result = 'N/A'

                    # record_last_5 and record_last_10
                    def _record_last_n(n):
                        subset = all_rows.tail(n)
                        w = sum(r['Winner'] == r['_corner'] for _, r in subset.iterrows())
                        l = len(subset) - w
                        return f"{w}-{l}"

                    record_last_5  = _record_last_n(5)  if len(all_rows) >= 1 else 'N/A'
                    record_last_10 = _record_last_n(10) if len(all_rows) >= 1 else 'N/A'

                    # ── Recompute streaks from fight history so they always agree
                    # with last_fight_result.  The CSV's CurrentWinStreak column
                    # stores the streak *going into* that fight, not after, so a
                    # fighter who just snapped a 5-fight win streak would still
                    # show streak=5 from the CSV even though they lost.
                    win_streak = 0
                    loss_streak = 0
                    for _, hr in all_rows.iloc[::-1].iterrows():
                        won = str(hr.get('Winner', '')) == str(hr.get('_corner', ''))
                        if win_streak == 0 and loss_streak == 0:
                            if won:
                                win_streak = 1
                            else:
                                loss_streak = 1
                        elif win_streak > 0:
                            if won:
                                win_streak += 1
                            else:
                                break
                        else:
                            if not won:
                                loss_streak += 1
                            else:
                                break

                    # submission win pct
                    sub_wins_pct = round(sub_wins / total_fights * 100, 1) if total_fights else 0.0

                    # avg submission attempts per fight
                    sub_att_col = f'{p}AvgSubAtt'
                    sub_att_vals = all_rows[sub_att_col].dropna() if sub_att_col in all_rows.columns else pd.Series()
                    avg_sub_att = round(sub_att_vals.mean(), 2) if len(sub_att_vals) else 0.0

                    # subs_conceded — full UFC career from CSV (Finish == 'SUB' and fighter lost)
                    csv_subs_conceded = int(sum(
                        1 for _, hr in all_rows.iterrows()
                        if hr['Winner'] != hr['_corner']
                        and str(hr.get('Finish', '')).strip().upper() == 'SUB'
                    ))

                    # longest win streak — CSV stores the streak going *into* each fight,
                    # so a fighter currently on a 9-fight win streak may only show 5 in the
                    # CSV if that was the peak captured at the time. Always use whichever is
                    # larger: the CSV column or the current computed streak.
                    longest_streak = max(int(row.get(f'{p}LongestWinStreak', 0) or 0), win_streak)

                    # total title bouts
                    total_title = int(row.get(f'{p}TotalTitleBouts', 0) or 0)

                    # age (from most recent row)
                    age_val = row.get(f'{p}Age', None)
                    age = int(age_val) if age_val and not pd.isna(age_val) else 'N/A'

                    # UFC ranking (weight-class rank from most recent row)
                    rank_col = f'{p[0]}MatchWCRank'
                    rank_val = row.get(rank_col, None)
                    ufc_rank = int(rank_val) if rank_val and not pd.isna(rank_val) else 'N/A'

                    # weight class
                    wc = str(row.get('WeightClass', 'N/A') or 'N/A')

                    # ── Write back to fighter dict ────────────────────────────────────────
                    f['wins']   = wins
                    f['losses'] = losses
                    f['draws']  = draws
                    f['record'] = f"{wins}-{losses}-{draws}"
                    f['stance'] = stance
                    f['height'] = cm_to_ftin(height_cm)
                    f['reach']  = cm_to_in(reach_cm)
                    f['age']    = age
                    f['weight_class'] = wc
                    f['current_win_streak']   = win_streak
                    f['current_loss_streak']  = loss_streak
                    f['longest_win_streak']   = longest_streak
                    f['wins_ko_tko']          = ko_wins
                    f['wins_submission']      = sub_wins
                    f['wins_decision']        = dec_wins
                    f['finish_rate_pct']      = finish_pct
                    f['decision_rate_pct']    = dec_pct
                    f['submission_wins_pct']  = sub_wins_pct
                    f['avg_sub_attempts']     = avg_sub_att
                    f['total_title_bouts']    = total_title
                    f['avg_fight_duration']   = avg_fight_dur
                    f['first_round_wins']     = r1_wins
                    f['career_longevity_years'] = career_yrs
                    f['last_fight_result']    = last_fight_result
                    f['record_last_5']        = record_last_5
                    f['record_last_10']       = record_last_10
                    f['ufc_ranking']          = ufc_rank
                    f['stats']['slpm']              = round(slpm, 2)
                    f['stats']['sapm']              = None  # populated by UFCStats enrichment; None until then
                    f['stats']['striking_accuracy'] = round(str_pct * 100, 1)
                    f['stats']['td_avg']            = round(td_avg, 2)
                    f['stats']['td_accuracy']       = round(td_pct * 100, 1)
                    f['stats']['td_defense']        = 'N/A'  # populated later by UFCStats enrichment
                    f['stats']['striking_defense']  = 'N/A'  # populated later by UFCStats enrichment
                    f['stats']['subs_conceded']     = csv_subs_conceded

                    matched_count += 1
                    print(f"  ✓ UFC-MASTER [{p.upper()}] {dk_name} | "
                          f"record={wins}-{losses}-{draws}, KO={ko_wins}, Sub={sub_wins}, "
                          f"Dec={dec_wins}, SLpM={slpm:.2f}, TDAvg={td_avg:.2f}, "
                          f"streak={win_streak}W/{loss_streak}L | "
                          f"age={age}, rank={ufc_rank}, last5={record_last_5}, dur={avg_fight_dur}m")

            print(f"\nUFC Master Summary: {matched_count} matched, {no_match_count} unmatched")
            print("="*80 + "\n")
        else:
            print(f"⚠️  ufc-master.csv not found at {ufc_master_path} — skipping career stats enrichment")

        # ── UFCStats.com enrichment ───────────────────────────────────────────
        # Fetches td_defense and striking_defense (not available in ufc-master.csv),
        # plus verifies/updates slpm, sapm, str_acc, td_avg, sub_avg from the
        # official UFC stats database. Set SCRAPE_UFCSTATS=1 to enable.
        if os.environ.get('SCRAPE_UFCSTATS', '0') == '1':
            print("\n" + "="*80)
            print("📡 UFCSTATS.COM ENRICHMENT (td_defense, striking_defense, bio fields)")
            print("="*80)
            ufcstats_matched = 0
            ufcstats_missed  = 0
            for fight in fights:
                for f in fight['fighters']:
                    us = scrape_ufcstats_fighter(f['name'])
                    if not us:
                        ufcstats_missed += 1
                        continue
                    if us.get('td_defense') not in (None, 'N/A'):
                        f['stats']['td_defense'] = us['td_defense']
                    if us.get('striking_defense') not in (None, 'N/A'):
                        f['stats']['striking_defense'] = us['striking_defense']
                    if us.get('td_acc') is not None:
                        f['stats']['td_accuracy'] = round(us['td_acc'], 1)
                    if us.get('sub_avg') is not None:
                        f['avg_sub_attempts'] = round(us['sub_avg'], 2)
                    # Bio fields: fill in if currently missing (ufc-master may have missed this fighter)
                    if f.get('height', 'N/A') in ('N/A', '') and us.get('height', 'N/A') not in ('N/A', ''):
                        f['height'] = us['height']
                    if f.get('reach', 'N/A') in ('N/A', '') and us.get('reach', 'N/A') not in ('N/A', ''):
                        f['reach'] = us['reach']
                    if f.get('stance', 'N/A') in ('N/A', '') and us.get('stance', 'N/A') not in ('N/A', ''):
                        f['stance'] = us['stance']
                    if f.get('dob', 'N/A') in ('N/A', '') and us.get('dob', 'N/A') not in ('N/A', ''):
                        f['dob'] = us['dob']
                    # Derive age from dob if age is still missing
                    if f.get('age') in (None, 'N/A', '') and f.get('dob', 'N/A') not in ('N/A', ''):
                        try:
                            from datetime import date as _date_cls
                            import re as _re
                            _dob = f['dob']
                            # Accept "Apr 23, 2001" and "1990-05-12" formats
                            try:
                                _d = __import__('datetime').datetime.strptime(_dob, '%b %d, %Y').date()
                            except ValueError:
                                _d = __import__('datetime').datetime.strptime(_dob, '%Y-%m-%d').date()
                            _today = _date_cls.today()
                            f['age'] = _today.year - _d.year - ((_today.month, _today.day) < (_d.month, _d.day))
                        except Exception:
                            pass
                    # Nickname: only fill if missing (None or empty)
                    if not f.get('nickname') and us.get('nickname'):
                        f['nickname'] = us['nickname']
                    # Record: only fill if missing (debut fighters not in ufc-master.csv)
                    if f.get('record', 'N/A') in ('N/A', '', None) and us.get('record'):
                        f['record'] = us['record']
                    # Always update sapm from UFCStats (ufc-master.csv has no real SApM).
                    # Only override slpm/td_avg if UFC master missed this fighter.
                    if us.get('sapm'):  f['stats']['sapm'] = round(us['sapm'], 2)
                    if f['stats'].get('slpm', 0) == 0:
                        if us.get('slpm'):  f['stats']['slpm'] = round(us['slpm'], 2)
                        if us.get('td_avg'): f['stats']['td_avg'] = round(us['td_avg'], 2)
                    ufcstats_matched += 1
                    print(f"  ✓ UFCStats enriched: {f['name']} | "
                          f"td_def={f['stats']['td_defense']}, str_def={f['stats']['striking_defense']}, "
                          f"height={f.get('height','?')}, reach={f.get('reach','?')}, dob={f.get('dob','?')}")
            print(f"\nUFCStats Summary: {ufcstats_matched} matched, {ufcstats_missed} missed")
            print("="*80 + "\n")
        else:
            print("ℹ️  UFCStats scraping skipped (set SCRAPE_UFCSTATS=1 to enable — adds ~5–10 min)")

        # ── UFCStats per-fight enrichment (KD + CTRL time) ───────────────────
        # Scrapes the last 5 completed fights per fighter from UFCStats fight
        # detail pages to compute avg_kd_per_fight, avg_ctrl_secs, and
        # grappling_control_pct.  Results are cached permanently so re-running
        # aggregate_stats.py never re-fetches already-seen URLs.
        # Set SCRAPE_PERFIGHT=1 to enable.  First run adds ~15–30 min;
        # subsequent runs are instant (served from cache).
        if os.environ.get('SCRAPE_PERFIGHT', '0') == '1':
            print("\n" + "="*80)
            print("📡 UFCSTATS PER-FIGHT ENRICHMENT (KD + CTRL time, last 5 fights)")
            print("="*80)
            pf_matched = 0
            pf_missed  = 0
            for fight in fights:
                for f in fight['fighters']:
                    pf = scrape_ufcstats_perfight(f['name'])
                    if not pf:
                        pf_missed += 1
                        continue
                    f['stats']['avg_kd_per_fight']     = pf['avg_kd_per_fight']
                    f['stats']['avg_ctrl_secs']         = pf['avg_ctrl_secs']
                    f['stats']['grappling_control_pct'] = pf['grappling_control_pct']
                    # Strike distribution (% of landed sig strikes by target / position)
                    for key in ('head_str_pct', 'body_str_pct', 'leg_str_pct',
                                'distance_str_pct', 'clinch_str_pct', 'ground_str_pct'):
                        if pf.get(key) is not None:
                            f['stats'][key] = pf[key]
                    pf_matched += 1
                    print(
                        f"  ✓ {f['name']} | kd/fight={pf['avg_kd_per_fight']}  "
                        f"ctrl={pf['avg_ctrl_secs']}s  ctrl%={pf['grappling_control_pct']}%  "
                        f"head={pf.get('head_str_pct')}%  body={pf.get('body_str_pct')}%  leg={pf.get('leg_str_pct')}%  "
                        f"({pf['fights_analyzed']} fights)"
                    )
            print(f"\nPer-Fight Summary: {pf_matched} matched, {pf_missed} missed")
            print("="*80 + "\n")
        else:
            print("ℹ️  Per-fight scraping skipped (set SCRAPE_PERFIGHT=1 to enable — adds ~15–30 min on first run)")

        # ── Data Quality Warnings ─────────────────────────────────────────────
        warnings_found = []
        for fight in fights:
            for f in fight['fighters']:
                name = f['name']
                avg_pts = f.get('avgPointsPerGame', 0)
                n_fights = f.get('stats', {}).get('fights_analyzed', None)
                no_ufc_history = f.get('record', 'N/A') == 'N/A'

                if no_ufc_history:
                    warnings_found.append(
                        f"  ⚠️  {name} — no UFC-master history (Bellator/regional crossover). "
                        f"AvgPoints={avg_pts} based on limited UFC data."
                    )
                elif n_fights is not None and n_fights < 5 and avg_pts > 80:
                    warnings_found.append(
                        f"  ⚠️  {name} — AvgPoints={avg_pts} but only {n_fights} UFC fight(s) scraped. "
                        f"Small sample — projection may be unreliable."
                    )

        if warnings_found:
            print("\n" + "="*80)
            print("⚠️  DATA QUALITY WARNINGS")
            print("="*80)
            for w in warnings_found:
                print(w)
            print("="*80 + "\n")


        # ── Defensive grappling enrichment ────────────────────────────────────
        # Extracts from the same UFCStats fight detail pages (all cached):
        #   avg_opp_ctrl_secs       — seconds/fight opponent controlled this fighter
        #   avg_reversals_per_fight — reversals per fight (sign of active escapes)
        #   implied_sub_def_pct     — % of opp sub attempts successfully defended
        #   opp_sub_attempts_vs     — raw opp sub attempt count (over analyzed fights)
        #   subs_conceded           — fights ended against this fighter by submission
        #
        # Gate: SCRAPE_DEF_GRAPPLING=1
        # Works best AFTER SCRAPE_PERFIGHT=1 has populated the cache (page cache is
        # shared, so re-running costs zero extra network requests).
        if os.environ.get('SCRAPE_DEF_GRAPPLING', '0') == '1':
            print("\n" + "="*80)
            print("\U0001f6e1\ufe0f  DEFENSIVE GRAPPLING ENRICHMENT (opp ctrl, reversals, implied sub def)")
            print("="*80)
            dg_enriched = 0
            dg_missed   = 0
            for fight in fights:
                for f in fight['fighters']:
                    dg = scrape_ufcstats_def_grappling(f['name'])
                    if not dg:
                        dg_missed += 1
                        print(f"  \u2717 No defensive grappling data for {f['name']}")
                        continue
                    # Store under f['stats'] alongside existing grappling fields
                    f['stats']['avg_opp_ctrl_secs']       = dg['avg_opp_ctrl_secs']
                    f['stats']['avg_reversals_per_fight']  = dg['avg_reversals_per_fight']
                    f['stats']['implied_sub_def_pct']      = dg['implied_sub_def_pct']
                    # Supporting transparency fields
                    f['stats']['opp_sub_attempts_vs']      = dg['opp_sub_attempts_vs']
                    # subs_conceded already set from full CSV history — do not overwrite with 5-fight scraper value
                    dg_enriched += 1
                    print(
                        f"  \u2705 Added defensive stats for {f['name']}: "
                        f"opp_ctrl={dg['avg_opp_ctrl_secs']}s/fight  "
                        f"rev={dg['avg_reversals_per_fight']}/fight  "
                        f"implied_sub_def={dg['implied_sub_def_pct']}%  "
                        f"({dg['def_fights_analyzed']} fights analyzed)"
                    )
            print(f"\nDefensive grappling stats enriched for {dg_enriched}/{dg_enriched + dg_missed} fighters")
            print("="*80 + "\n")
        else:
            print("\u2139\ufe0f  Defensive grappling enrichment skipped (set SCRAPE_DEF_GRAPPLING=1 to enable)")

        # Details CSV: match on normalized names with fuzzy matching
        if os.path.exists(fighter_details_path):
            print("\n" + "="*80)
            print("🔍 DETAILS ENRICHMENT (Normalized name matching with fuzzy fallback)")
            print("="*80)
            details_df = pd.read_csv(fighter_details_path)
            
            # Create normalized full names for matching
            details_df['full_name'] = (details_df['FIRST'].astype(str).str.strip() + ' ' + 
                                      details_df['LAST'].astype(str).str.strip())
            details_df['normalized_name'] = details_df['full_name'].apply(normalize_name)
            
            # Build list of normalized names for fuzzy matching
            details_names = details_df['normalized_name'].tolist()
            details_full_names = details_df['full_name'].tolist()
            
            print(f"Loaded {len(details_df)} fighters from details CSV")
            matched_count = 0
            no_match_count = 0

            for fight in fights:
                for f in fight['fighters']:
                    dk_name = f['name']
                    normalized_query = normalize_name(dk_name)
                    
                    # Try exact match first
                    exact_matches = details_df[details_df['normalized_name'] == normalized_query]
                    
                    if not exact_matches.empty:
                        row = exact_matches.iloc[0]
                        f['nickname'] = row.get('NICKNAME', None)
                        matched_count += 1
                        print(f"✓ DETAILS [EXACT] {dk_name} | normalized: '{normalized_query}' → {row['full_name']} (score: 100) | avgPointsPerGame={f['avgPointsPerGame']}")
                    else:
                        # Try fuzzy match
                        best_match, score = process.extractOne(normalized_query, details_names)
                        
                        if score >= 75:
                            best_idx = details_names.index(best_match)
                            row = details_df.iloc[best_idx]
                            f['nickname'] = row.get('NICKNAME', None)
                            matched_count += 1
                            print(f"✓ DETAILS [FUZZY] {dk_name} | normalized: '{normalized_query}' → {row['full_name']} (score: {score}) | avgPointsPerGame={f['avgPointsPerGame']}")
                        else:
                            no_match_count += 1
                            best_idx = details_names.index(best_match)
                            best_name = details_full_names[best_idx]
                            print(f"✗ DETAILS [FAIL]  {dk_name} | normalized: '{normalized_query}' | best: '{best_name}' (score: {score}) - No good match")
            
            print(f"\nDetails Summary: {matched_count} matched, {no_match_count} unmatched")
            print("="*80 + "\n")

        # Tott CSV: match on normalized names with fuzzy matching
        if os.path.exists(fighter_tott_path):
            print("\n" + "="*80)
            print("✈️  TOTT ENRICHMENT (Normalized name matching with fuzzy fallback)")
            print("="*80)
            tott_df = pd.read_csv(fighter_tott_path)
            
            # Create normalized full names for matching
            tott_df['full_name'] = (tott_df['FIRST'].astype(str).str.strip() + ' ' + 
                                   tott_df['LAST'].astype(str).str.strip())
            tott_df['normalized_name'] = tott_df['full_name'].apply(normalize_name)
            
            # Build list of normalized names for fuzzy matching
            tott_names = tott_df['normalized_name'].tolist()
            tott_full_names = tott_df['full_name'].tolist()
            
            print(f"Loaded {len(tott_df)} fighters from tott CSV")
            matched_count = 0
            no_match_count = 0

            for fight in fights:
                for f in fight['fighters']:
                    dk_name = f['name']
                    normalized_query = normalize_name(dk_name)
                    
                    # Try exact match first
                    exact_matches = tott_df[tott_df['normalized_name'] == normalized_query]
                    
                    if not exact_matches.empty:
                        row = exact_matches.iloc[0]
                        f['stats'] = {
                            "slpm": float(row.get('slpm', 0.0)),
                            "sapm": float(row.get('sapm', 0.0)),
                            "striking_defense": row.get('str_def', "N/A"),
                            "td_avg": float(row.get('td_avg', 0.0)),
                            "td_defense": row.get('td_def', "N/A")
                        }
                        f['height'] = row.get('HEIGHT', "N/A")
                        f['reach'] = row.get('REACH', "N/A")
                        f['stance'] = row.get('STANCE', "N/A")
                        f['dob'] = row.get('DOB', "N/A")
                        matched_count += 1
                        print(f"✓ TOTT [EXACT] {dk_name} | normalized: '{normalized_query}' → {row['full_name']} (score: 100) | slpm={row.get('slpm', 0.0)}, td_avg={row.get('td_avg', 0.0)} | avgPointsPerGame={f['avgPointsPerGame']}")
                    else:
                        # Try fuzzy match
                        best_match, score = process.extractOne(normalized_query, tott_names)
                        
                        if score >= 75:
                            best_idx = tott_names.index(best_match)
                            row = tott_df.iloc[best_idx]
                            f['stats'] = {
                                "slpm": float(row.get('slpm', 0.0)),
                                "sapm": float(row.get('sapm', 0.0)),
                                "striking_defense": row.get('str_def', "N/A"),
                                "td_avg": float(row.get('td_avg', 0.0)),
                                "td_defense": row.get('td_def', "N/A")
                            }
                            f['height'] = row.get('HEIGHT', "N/A")
                            f['reach'] = row.get('REACH', "N/A")
                            f['stance'] = row.get('STANCE', "N/A")
                            f['dob'] = row.get('DOB', "N/A")
                            matched_count += 1
                            print(f"✓ TOTT [FUZZY] {dk_name} | normalized: '{normalized_query}' → {row['full_name']} (score: {score}) | slpm={row.get('slpm', 0.0)}, td_avg={row.get('td_avg', 0.0)} | avgPointsPerGame={f['avgPointsPerGame']}")
                        else:
                            no_match_count += 1
                            best_idx = tott_names.index(best_match)
                            best_name = tott_full_names[best_idx]
                            print(f"✗ TOTT [FAIL]  {dk_name} | normalized: '{normalized_query}' | best: '{best_name}' (score: {score}) - No good match")
            
            print(f"\nTott Summary: {matched_count} matched, {no_match_count} unmatched")
            print("="*80 + "\n")

        # ── Betting Odds enrichment (upcoming.csv) ────────────────────────────
        # upcoming.csv must be kept up-to-date with each new event card.
        # Columns used: RedFighter, BlueFighter, RedOdds, BlueOdds,
        #               RKOOdds, BKOOdds, RedDecOdds, BlueDecOdds
        print("\n" + "="*80)
        print("🎲 BETTING ODDS ENRICHMENT (upcoming.csv)")
        print("="*80)

        up_csv_path = os.path.join(os.path.dirname(os.path.abspath(output_path)), "upcoming.csv")
        up_odds_df = None
        if os.path.exists(up_csv_path):
            up_odds_df = pd.read_csv(up_csv_path)
            print(f"  Loaded {up_csv_path} ({len(up_odds_df)} rows)")
        else:
            print(f"  ⚠️  {up_csv_path} not found — odds will be empty")

        def _fmt_ml(val):
            """Format numeric American ML odds as string with explicit +/- prefix."""
            try:
                v = float(val)
                if pd.isna(v):
                    return "N/A"
                v = int(round(v))
                return f"+{v}" if v > 0 else str(v)
            except (TypeError, ValueError):
                return "N/A"

        def _norm_name(s):
            return re.sub(r'[^a-z0-9]', '', str(s).lower())

        def _name_hit(query_name, candidate_name):
            """
            True if any word(≥4 chars) in query_name appears in candidate_name
            or vice versa.  Handles DK abbrevs vs full names, Jr./II etc.
            """
            q = _norm_name(query_name)
            c = _norm_name(candidate_name)
            if q in c or c in q:
                return True
            # token-level check — any significant word in common
            for tok in str(query_name).split():
                t = _norm_name(tok)
                if len(t) >= 4 and t in c:
                    return True
            return False

        odds_matched = 0
        for fight in fights:
            fighters = fight.get('fighters', [])
            if len(fighters) < 2 or up_odds_df is None:
                fight['betting_odds'] = {}
                continue

            name1 = fighters[0].get('name', '')
            name2 = fighters[1].get('name', '')

            best_row  = None
            best_score = 0
            for _, row in up_odds_df.iterrows():
                rn = str(row.get('RedFighter',  ''))
                bn = str(row.get('BlueFighter', ''))
                score = 0
                if _name_hit(name1, rn): score += 2
                if _name_hit(name2, bn): score += 2
                if _name_hit(name1, bn): score += 1   # cross-match
                if _name_hit(name2, rn): score += 1   # cross-match
                if score >= 3 and score > best_score:
                    best_row  = row
                    best_score = score

            # Fallback: rapidfuzz if containment check found nothing
            if best_row is None:
                from rapidfuzz import process as rfp, fuzz
                all_reds  = up_odds_df['RedFighter'].fillna('').tolist()
                all_blues = up_odds_df['BlueFighter'].fillna('').tolist()
                r1 = rfp.extractOne(name1, all_reds,  scorer=fuzz.token_sort_ratio)
                r2 = rfp.extractOne(name2, all_blues, scorer=fuzz.token_sort_ratio)
                b1 = rfp.extractOne(name1, all_blues, scorer=fuzz.token_sort_ratio)
                b2 = rfp.extractOne(name2, all_reds,  scorer=fuzz.token_sort_ratio)
                if r1 and r2 and r1[1] >= 70 and r2[1] >= 70:
                    idx = all_reds.index(r1[0])
                    best_row = up_odds_df.iloc[idx]
                elif b1 and b2 and b1[1] >= 70 and b2[1] >= 70:
                    idx = all_blues.index(b1[0])
                    best_row = up_odds_df.iloc[idx]

            if best_row is None:
                fight['betting_odds'] = {}
                print(f"  ❌ No odds match in upcoming.csv for '{name1} vs. {name2}'")
                continue

            # Determine which corner each fighter is in
            name1_is_red = _name_hit(name1, str(best_row.get('RedFighter', '')))
            if name1_is_red:
                ml1  = _fmt_ml(best_row.get('RedOdds'))
                ml2  = _fmt_ml(best_row.get('BlueOdds'))
                ko1  = _fmt_ml(best_row.get('RKOOdds'))
                ko2  = _fmt_ml(best_row.get('BKOOdds'))
                dec1 = _fmt_ml(best_row.get('RedDecOdds'))
                dec2 = _fmt_ml(best_row.get('BlueDecOdds'))
                sub1 = _fmt_ml(best_row.get('RSubOdds'))
                sub2 = _fmt_ml(best_row.get('BSubOdds'))
            else:
                ml1  = _fmt_ml(best_row.get('BlueOdds'))
                ml2  = _fmt_ml(best_row.get('RedOdds'))
                ko1  = _fmt_ml(best_row.get('BKOOdds'))
                ko2  = _fmt_ml(best_row.get('RKOOdds'))
                dec1 = _fmt_ml(best_row.get('BlueDecOdds'))
                dec2 = _fmt_ml(best_row.get('RedDecOdds'))
                sub1 = _fmt_ml(best_row.get('BSubOdds'))
                sub2 = _fmt_ml(best_row.get('RSubOdds'))

            fight['betting_odds'] = {
                'fighter1_name': name1,
                'fighter2_name': name2,
                'fighter1_moneyline': ml1,
                'fighter2_moneyline': ml2,
                'over_under_rounds': 'N/A',  # not in upcoming.csv
                'over_odds':  'N/A',
                'under_odds': 'N/A',
                'fighter1_ko_odds':       ko1,
                'fighter2_ko_odds':       ko2,
                'fighter1_sub_odds':      sub1,
                'fighter2_sub_odds':      sub2,
                'fighter1_decision_odds': dec1,
                'fighter2_decision_odds': dec2,
            }
            # WeightClass column: populate fight-level weight_class and fill
            # each fighter's weight_class if it's still missing (debut fighters
            # not in ufc-master.csv won't have had it set by the master enrichment)
            wc_val = str(best_row.get('WeightClass', '') or '').strip()
            if wc_val and wc_val not in ('N/A', 'nan', ''):
                fight['weight_class'] = wc_val
                for fighter in fight.get('fighters', []):
                    if fighter.get('weight_class', 'N/A') in ('N/A', '', None):
                        fighter['weight_class'] = wc_val
            odds_matched += 1
            print(f"  ✅ {name1} vs. {name2}: ML {ml1} / {ml2}")

        print(f"\nBetting Odds Summary: {odds_matched}/{len(fights)} fights enriched")
        print("="*80 + "\n")

        # ── Sherdog enrichment ───────────────────────────────────────────────
        # Fills nationality, team/gym, DOB, height, win/loss breakdown for
        # fighters missing those fields (or all fighters if UFC master missed them).
        # Uses the fightfinder search page (working as of 2026).
        # Set SCRAPE_SHERDOG=1 to enable.  Adds ~3–6 min per 28-fighter card.
        #
        # Speed-up: set SHERDOG_EVENT_URL to the Sherdog event page for this card,
        # e.g. https://www.sherdog.com/events/UFC-Fight-Night-269-...-110785
        # This scrapes all names + records + direct profile links in ONE request,
        # eliminating the per-fighter search step (~28 saved requests, ~2-3 min faster).
        # It also uses canonical Sherdog names, fixing mismatches like "SuYoung You".
        event_card_name = ""  # set below when SHERDOG_EVENT_URL is used
        if os.environ.get('SCRAPE_SHERDOG', '0') == '1':
            print("\n" + "="*80)
            print("🐶 SHERDOG ENRICHMENT (nationality, team, dob, height, record breakdown)")
            print("="*80)

            # Pre-load event card if SHERDOG_EVENT_URL is set
            event_url = os.environ.get('SHERDOG_EVENT_URL', '').strip()
            event_card_name = ""
            event_card = {}
            if event_url:
                event_card_name, event_card = scrape_sherdog_event_card(event_url)
                if not event_card:
                    print("  ⚠️  Event card empty — falling back to per-fighter search")
                time.sleep(random.uniform(2, 4))

            sh_matched = 0
            sh_missed  = 0
            for fight in fights:
                for f in fight['fighters']:
                    dk_name = f['name']
                    # Try event card first (direct profile URL, no search needed)
                    direct_url = None
                    if event_card:
                        card_entry = _match_sherdog_card(dk_name, event_card)
                        if card_entry:
                            direct_url = card_entry['profile_url']
                            print(f"  🗂️  Matched {dk_name} → {card_entry['sherdog_name']} via event card")
                        else:
                            print(f"  🔎 Fallback search for {dk_name} (not on event card)")
                    sd = scrape_sherdog_fighter_data(dk_name, profile_url=direct_url)
                    has_sherdog_data = (
                        bool(sd.get('fight_history')) or
                        sd.get('dob', 'N/A') not in ('N/A', '') or
                        bool(sd.get('wins_by_ko', 0)) or
                        bool(sd.get('wins_by_submission', 0)) or
                        bool(sd.get('wins_by_decision', 0))
                    )
                    if not has_sherdog_data:
                        sh_missed += 1
                        continue
                    # Unique fields only Sherdog provides
                    if sd.get('nationality', 'N/A') not in ('N/A', ''):
                        f['nationality'] = sd['nationality']
                    if sd.get('team', 'N/A') not in ('N/A', ''):
                        f['team'] = sd['team']
                    if sd.get('nickname') and not f.get('nickname'):
                        f['nickname'] = sd['nickname']
                    # Fill bio gaps for fighters UFC master missed
                    if f.get('dob',    'N/A') in ('N/A', '') and sd.get('dob',    'N/A') not in ('N/A', ''):
                        f['dob']    = sd['dob']
                    if f.get('height', 'N/A') in ('N/A', '') and sd.get('height', 'N/A') not in ('N/A', ''):
                        f['height'] = sd['height']
                    # Always overwrite record/wins/losses/draws from Sherdog — Sherdog has
                    # the full career record (incl. non-UFC fights) which is what broadcasts
                    # show.  ufc-master.csv only tracks UFC bouts and is incomplete/outdated.
                    sherdog_rec = sd.get('sherdog_record', 'N/A')
                    if sherdog_rec not in ('N/A', ''):
                        parts = sherdog_rec.split('-')
                        if len(parts) >= 2:
                            f['wins']   = int(parts[0]) if parts[0].isdigit() else f.get('wins', 0)
                            f['losses'] = int(parts[1]) if parts[1].isdigit() else f.get('losses', 0)
                            f['draws']  = int(parts[2]) if len(parts) > 2 and parts[2].isdigit() else f.get('draws', 0)
                            f['record'] = sherdog_rec
                    # Always overwrite win-method breakdown from Sherdog's career totals
                    if sd.get('wins_by_ko', 0) or sd.get('wins_by_submission', 0) or sd.get('wins_by_decision', 0):
                        f['wins_ko_tko']    = sd.get('wins_by_ko', f.get('wins_ko_tko', 0))
                        f['wins_submission'] = sd.get('wins_by_submission', f.get('wins_submission', 0))
                        f['wins_decision']  = sd.get('wins_by_decision', f.get('wins_decision', 0))
                        # Recompute finish_rate_pct from the updated full-career numbers
                        sh_wins = f.get('wins', 0) or 0
                        if sh_wins > 0:
                            f['finish_rate_pct'] = round(
                                (f['wins_ko_tko'] + f['wins_submission']) / sh_wins * 100, 1
                            )
                            f['decision_rate_pct'] = round(f['wins_decision'] / sh_wins * 100, 1)
                    # Fight history (last 5 fights from Sherdog profile page)
                    if sd.get('fight_history'):
                        f['fight_history'] = sd['fight_history']
                    sh_matched += 1
                    # Shorter sleep when we already had a direct URL (1 request vs 2)
                    if direct_url:
                        time.sleep(random.uniform(1.5, 3))
                    else:
                        time.sleep(random.uniform(3, 6))
            print(f"\nSherdog Summary: {sh_matched} matched, {sh_missed} missed")
            if event_card_name:
                print(f"  Event name from Sherdog: {event_card_name}")
            print("="*80 + "\n")
        else:
            print("ℹ️  Sherdog scraping skipped (set SCRAPE_SHERDOG=1 to enable — adds ~3–6 min)")

            # ── Preserve Sherdog-sourced fields from previous run ──────────────
            # Fields that only Sherdog populates and that the pipeline cannot
            # reconstruct from CSV/UFCStats sources:
            #   fight_history  — full pro career fight list (used by FullFightRecord modal)
            #   nationality    — country of birth
            #   team           — home gym / training camp
            # Copy each of these from the previous JSON if:
            #   (a) the fighter appears in the previous JSON by normalised name, AND
            #   (b) the current fighter dict is missing that field / has an empty value.
            # This means re-running the pipeline NEVER wipes Sherdog data that was
            # already scraped; only SCRAPE_SHERDOG=1 can overwrite it.
            preserved = 0
            sherdog_only_fields = ['fight_history', 'nationality', 'team']
            if _prev_sherdog:
                for fight in fights:
                    for f in fight['fighters']:
                        key = normalize_name(f.get('name', ''))
                        prev = _prev_sherdog.get(key)
                        if not prev:
                            continue
                        for field in sherdog_only_fields:
                            prev_val = prev.get(field)
                            # Only copy if prev has a real value and current is missing/empty
                            if prev_val and not f.get(field):
                                f[field] = prev_val
                                preserved += 1
            if preserved:
                print(f"ℹ️  Preserved {preserved} Sherdog field(s) from previous run (fight_history / nationality / team)")
            else:
                print("ℹ️  No previous Sherdog data found to preserve — run with SCRAPE_SHERDOG=1 to populate")


        data = {
            "event": {
                "name": event_card_name if (os.environ.get('SHERDOG_EVENT_URL') and event_card_name) else "UFC Fight Night",
                "date": event_date_str,
                "location": "Las Vegas, Nevada, USA"
            },
            "fights": fights
        }

        # ── Merge YouTube highlight video IDs from public/highlight_videos.json ─
        merge_highlight_videos(data)

        save_to_json(data, output_path)
        print(f"Processed {len(fights)} fights! Check public/this_weeks_stats.json")

        # ── Sync DKSalaries.csv → public/ so the React app always reads the current slate ──
        import shutil as _shutil
        public_dk = os.path.join(os.path.dirname(os.path.abspath(output_path)), "DKSalaries.csv")
        _shutil.copy(dk_path, public_dk)
        print(f"Synced DKSalaries.csv → {public_dk}")

        # ── Write public/current_event.json from the data we already have ──────────
        event_name_for_banner = data["event"]["name"]
        banner_title = f"{event_name_for_banner} \u2014 {event_date_str}"
        current_event_path = os.path.join(
            os.path.dirname(os.path.abspath(output_path)), "current_event.json"
        )
        with open(current_event_path, "w") as _f:
            json.dump({"title": banner_title}, _f)
        print(f"Written current_event.json: {banner_title}")

    except Exception as e:
        print(f"Error during processing: {e}")
        import traceback
        traceback.print_exc()

def download_ufcstats_csvs():
    """Download latest UFC stats CSVs from Greco1899/scrape_ufc_stats repo"""
    import requests
    import os
    
    # Create directory if it doesn't exist
    os.makedirs("public/ufcstats_raw", exist_ok=True)
    
    csv_files = [
        "ufc_fight_results.csv",
        "ufc_fight_stats.csv", 
        "ufc_fighter_details.csv",
        "ufc_event_details.csv",
        "ufc_fight_details.csv",
        "ufc_fighter_tott.csv"
    ]
    
    base_url = "https://raw.githubusercontent.com/Greco1899/scrape_ufc_stats/main/"
    
    for csv_file in csv_files:
        url = base_url + csv_file
        local_path = f"public/ufcstats_raw/{csv_file}"
        
        print(f"Downloading {csv_file}...")
        try:
            response = requests.get(url, timeout=30)
            response.raise_for_status()
            
            with open(local_path, 'w', encoding='utf-8') as f:
                f.write(response.text)
            
            print(f"✓ Saved {csv_file} to {local_path}")
            
        except Exception as e:
            print(f"✗ Failed to download {csv_file}: {e}")

def merge_highlight_videos(data, highlights_path="public/highlight_videos.json"):
    """Merge YouTube highlight video IDs from highlight_videos.json into fighter objects.

    Reads public/highlight_videos.json (name → 11-char YouTube video ID).
    Matches each fighter in *data* by normalized name and injects two fields:
      - highlightVideoId     (e.g. "dQw4w9WgXcQ")
      - youtubeHighlightUrl  (e.g. "https://www.youtube.com/watch?v=dQw4w9WgXcQ")

    Fighters with no match are left unchanged (fields stay absent / null).
    Call this right before save_to_json() so every weekly run auto-merges.
    """
    if not os.path.exists(highlights_path):
        print(f"ℹ️  No highlight_videos.json found at {highlights_path} — skipping video merge")
        return

    try:
        with open(highlights_path, "r") as f:
            raw = json.load(f)
    except Exception as e:
        print(f"⚠️  Could not load {highlights_path}: {e} — skipping video merge")
        return

    # Build a normalized-name → video-id lookup, skipping the _instructions key
    # YouTube video IDs are exactly 11 characters: [A-Za-z0-9_-]
    _yt_id_re = re.compile(r'^[A-Za-z0-9_-]{11}$')
    lookup = {}
    for name, video_id in raw.items():
        if name.startswith("_"):
            continue
        if not isinstance(video_id, str) or not video_id.strip():
            continue
        if not _yt_id_re.match(video_id.strip()):
            print(f"⚠️  Skipping invalid YouTube ID for '{name}': {video_id!r} (must be 11 chars [A-Za-z0-9_-])")
            continue
        lookup[normalize_name(name)] = video_id.strip()

    if not lookup:
        print("ℹ️  highlight_videos.json has no valid entries — skipping video merge")
        return

    matched = 0
    for fight in data.get("fights", []):
        for fighter in fight.get("fighters", []):
            norm = normalize_name(fighter.get("name", ""))
            video_id = lookup.get(norm)
            if video_id:
                fighter["highlightVideoId"] = video_id
                fighter["youtubeHighlightUrl"] = f"https://www.youtube.com/watch?v={video_id}"
                matched += 1
            else:
                # Ensure the fields exist so the React component never gets KeyError
                fighter.setdefault("highlightVideoId", None)
                fighter.setdefault("youtubeHighlightUrl", None)

    print(f"🎥 Highlight videos merged: {matched} fighter(s) matched from {highlights_path}")


def merge_ufcstats_results():
    """Optionally merge recent fight results into this_weeks_stats.json for context"""
    import json
    
    results_path = "public/ufcstats_raw/ufc_fight_results.csv"
    stats_path = "public/ufcstats_raw/ufc_fight_stats.csv"
    json_path = "public/this_weeks_stats.json"
    
    if not os.path.exists(results_path) or not os.path.exists(json_path):
        print("Skipping merge: required files not found")
        return
    
    try:
        # Load existing JSON
        with open(json_path, 'r') as f:
            data = json.load(f)
        
        # Load fight results
        results_df = pd.read_csv(results_path)
        
        # For each fighter, add recent fight context if available
        # This is optional enhancement - keep it minimal
        print("✓ UFC stats merge completed (placeholder - no actual merge implemented yet)")
        
    except Exception as e:
        print(f"Error during merge: {e}")

if __name__ == "__main__":
    # Run main aggregation
    csv_to_json()
    
    # Optional: Download UFC stats CSVs if env var is set
    if os.environ.get('SCRAPE_UFCSTATS_RESULTS', '0') == '1':
        print("\n" + "="*60)
        print("📊 DOWNLOADING UFC STATS CSVs...")
        print("="*60)
        download_ufcstats_csvs()
        merge_ufcstats_results()