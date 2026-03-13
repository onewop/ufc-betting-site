#!/usr/bin/env python3
"""
scrape_ufcstats_perfight.py

Polite, one-time scraper for per-fight KD (knockdowns) and CTRL (ground control
time) from UFCStats.com, written back into this_weeks_stats.json.

Usage:
    cd ufc-betting-site-main
    python3 scripts/scrape_ufcstats_perfight.py

Design constraints:
  - Caches every fetched URL to public/ufcstats_perfight_cache.json
    so re-running never re-fetches already-seen pages.
  - Random 8-15 second delay between ALL network requests.
  - Only fetches fighter profile pages for current card fighters.
  - Analyzes the last N completed fights per fighter (default 5).
  - Writes avg_kd_per_fight, avg_ctrl_secs, grappling_control_pct to JSON.

Fields added to each fighter's 'stats' dict:
  avg_kd_per_fight        — average knockdowns landed per fight (last 5)
  avg_ctrl_secs           — average ground control time in seconds (last 5)
  grappling_control_pct   — ctrl time as % of total fight time (last 5)
"""

import json
import os
import re
import shutil
import time
import random
from datetime import datetime

import requests
from bs4 import BeautifulSoup
from fuzzywuzzy import fuzz

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
SCRIPT_DIR      = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT    = os.path.dirname(SCRIPT_DIR)
WEEKS_STATS     = os.path.join(PROJECT_ROOT, 'public', 'this_weeks_stats.json')
CACHE_PATH      = os.path.join(PROJECT_ROOT, 'public', 'ufcstats_perfight_cache.json')
ARCHIVE_DIR     = os.path.join(PROJECT_ROOT, 'public', 'archive')
FIGHTS_TO_ANALYZE = 5
DELAY_MIN       = 8.0
DELAY_MAX       = 15.0
FUZZY_THRESHOLD = 72        # minimum score to accept a name match

ALPHA_URL   = 'http://ufcstats.com/statistics/fighters?char={letter}&page=all'
HEADERS = {
    'User-Agent': (
        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 '
        '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
    ),
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.5',
}

# ---------------------------------------------------------------------------
# Cache helpers
# ---------------------------------------------------------------------------

def load_cache() -> dict:
    if os.path.exists(CACHE_PATH):
        with open(CACHE_PATH, encoding='utf-8') as f:
            return json.load(f)
    return {}


def save_cache(cache: dict) -> None:
    with open(CACHE_PATH, 'w', encoding='utf-8') as f:
        json.dump(cache, f, indent=1)


def polite_get(url: str, cache: dict) -> str | None:
    """Return HTML for url, fetching politely only if not cached."""
    if url in cache:
        return cache[url]

    delay = random.uniform(DELAY_MIN, DELAY_MAX)
    print(f"    [wait {delay:.1f}s] GET {url}")
    time.sleep(delay)

    try:
        resp = requests.get(url, headers=HEADERS, timeout=18)
        resp.raise_for_status()
        cache[url] = resp.text
        save_cache(cache)
        return resp.text
    except Exception as e:
        print(f"    [ERROR] {url}: {e}")
        return None


# ---------------------------------------------------------------------------
# Lookup: DK name → UFCStats profile URL
# ---------------------------------------------------------------------------

def find_profile_url(dk_name: str, cache: dict) -> str | None:
    """
    Browse the alphabetical fighter listing by last-name initial, fuzzy-match
    the fighter's full name, and return their UFCStats profile URL.
    """
    parts = dk_name.strip().split()
    last_name = parts[-1] if parts else 'a'
    letter = last_name[0].lower()
    if not letter.isalpha():
        letter = 'a'

    html = polite_get(ALPHA_URL.format(letter=letter), cache)
    if not html:
        return None

    soup = BeautifulSoup(html, 'html.parser')
    table = soup.find('table', class_='b-statistics__table')
    if not table:
        return None

    best_score = 0
    best_url   = None

    for row in table.find_all('tr')[1:]:
        cells = row.find_all('td')
        if len(cells) < 2:
            continue
        # First two columns are First Name and Last Name
        first = cells[0].get_text(strip=True)
        last  = cells[1].get_text(strip=True)
        full  = f"{first} {last}"

        a_tag = cells[0].find('a', href=True) or cells[1].find('a', href=True)
        if not a_tag:
            continue

        score = fuzz.token_sort_ratio(dk_name.lower(), full.lower())
        if score > best_score:
            best_score = score
            best_url   = a_tag['href']

    if best_score >= FUZZY_THRESHOLD:
        return best_url

    print(f"    [MISS] '{dk_name}' — best match score {best_score} < {FUZZY_THRESHOLD}")
    return None


# ---------------------------------------------------------------------------
# Parse fight history from fighter profile page
# ---------------------------------------------------------------------------

def get_fight_history(profile_url: str, dk_name: str, cache: dict) -> list[dict]:
    """
    Returns up to FIGHTS_TO_ANALYZE completed fights, each a dict with:
      fight_url, our_kd, total_secs (total fight time)
    """
    html = polite_get(profile_url, cache)
    if not html:
        return []

    soup  = BeautifulSoup(html, 'html.parser')
    table = soup.find('table', class_='b-fight-details__table')
    if not table:
        return []

    fights = []
    for row in table.find_all('tr')[1:]:          # skip header
        cells = row.find_all('td')
        if len(cells) < 10:
            continue

        wl = cells[0].get_text(strip=True).lower()
        if wl not in ('win', 'loss', 'nc', 'draw'):
            continue                               # skip upcoming / empty rows

        # Determine our fighter's index in dual-value cells
        # On a fighter's own profile page the profile fighter is always [0],
        # but we verify by fuzzy-matching the name cell's <p> tags.
        name_ps = cells[1].find_all('p')
        if name_ps:
            name0 = name_ps[0].get_text(strip=True)
            our_idx = 0 if fuzz.token_sort_ratio(dk_name.lower(), name0.lower()) >= 60 else 1
        else:
            our_idx = 0

        # KD for our fighter
        kd_ps = cells[2].find_all('p')
        if kd_ps and len(kd_ps) > our_idx:
            kd_raw = kd_ps[our_idx].get_text(strip=True)
            our_kd = int(kd_raw) if kd_raw.isdigit() else 0
        else:
            kd_text = cells[2].get_text(' ', strip=True).split()
            our_kd  = int(kd_text[our_idx]) if len(kd_text) > our_idx and kd_text[our_idx].isdigit() else 0

        # Total fight time in seconds
        rnd_text  = cells[8].get_text(strip=True)
        time_text = cells[9].get_text(strip=True)
        try:
            finished_round = int(rnd_text)
            m, s = time_text.split(':')
            total_secs = (finished_round - 1) * 5 * 60 + int(m) * 60 + int(s)
        except Exception:
            total_secs = 0

        # Fight detail link
        fight_links = [
            a['href'] for a in row.find_all('a', href=True)
            if 'fight-details' in a['href']
        ]
        if not fight_links:
            continue

        fights.append({
            'fight_url':  fight_links[0],
            'our_idx':    our_idx,
            'our_kd':     our_kd,
            'total_secs': total_secs,
        })

        if len(fights) >= FIGHTS_TO_ANALYZE:
            break

    return fights


# ---------------------------------------------------------------------------
# Fetch CTRL from individual fight detail page
# ---------------------------------------------------------------------------

def ctrl_to_secs(ctrl_str: str) -> int:
    """Convert 'M:SS' to seconds. Returns 0 on failure."""
    try:
        m, s = ctrl_str.strip().split(':')
        return int(m) * 60 + int(s)
    except Exception:
        return 0


def get_ctrl_from_fight(fight_url: str, our_idx: int, cache: dict) -> int | None:
    """
    Fetch a fight detail page and return our fighter's control time in seconds.
    Returns None on failure.
    """
    html = polite_get(fight_url, cache)
    if not html:
        return None

    soup   = BeautifulSoup(html, 'html.parser')
    tables = soup.find_all('table')
    if not tables:
        return None

    # Table 0 is the totals table:
    # cols: Fighter | KD | Sig.str. | Sig.str.% | Total str. | TD | TD% | Sub.att | Rev. | Ctrl
    totals_rows = tables[0].find_all('tr')
    if len(totals_rows) < 2:
        return None

    data_cells = totals_rows[1].find_all('td')
    if len(data_cells) < 10:
        return None

    ctrl_cell = data_cells[9]
    ps = ctrl_cell.find_all('p')
    if ps and len(ps) > our_idx:
        return ctrl_to_secs(ps[our_idx].get_text(strip=True))

    # Fallback: space-split the combined text
    raw = ctrl_cell.get_text(' ', strip=True).split()
    if len(raw) > our_idx:
        return ctrl_to_secs(raw[our_idx])

    return None


# ---------------------------------------------------------------------------
# Per-fighter aggregation
# ---------------------------------------------------------------------------

def scrape_fighter(dk_name: str, cache: dict) -> dict | None:
    """
    Finds and scrapes a fighter's last FIGHTS_TO_ANALYZE fights.
    Returns dict with avg_kd_per_fight, avg_ctrl_secs, grappling_control_pct,
    or None on failure.
    """
    profile_url = find_profile_url(dk_name, cache)
    if not profile_url:
        return None

    print(f"  Profile: {profile_url}")
    fights = get_fight_history(profile_url, dk_name, cache)
    if not fights:
        print(f"  [MISS] No completed fight history for: {dk_name}")
        return None

    print(f"  Found {len(fights)} fight(s) to analyze")

    ctrl_times  = []
    kd_total    = 0
    time_total  = 0

    for i, fight in enumerate(fights):
        ctrl = get_ctrl_from_fight(fight['fight_url'], fight['our_idx'], cache)
        ctrl_secs = ctrl if ctrl is not None else 0
        ctrl_times.append(ctrl_secs)
        kd_total   += fight['our_kd']
        time_total += fight['total_secs']
        print(f"    fight {i+1}: kd={fight['our_kd']}  ctrl={ctrl_secs}s")

    n = len(fights)
    avg_kd   = round(kd_total / n, 2)
    avg_ctrl = round(sum(ctrl_times) / n, 1)
    ctrl_pct = round(sum(ctrl_times) / time_total * 100, 1) if time_total > 0 else None

    return {
        'avg_kd_per_fight':       avg_kd,
        'avg_ctrl_secs':          avg_ctrl,
        'grappling_control_pct':  ctrl_pct,
        'fights_analyzed':        n,
    }


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> None:
    print("=" * 60)
    print("  UFCStats Per-Fight Scraper (KD + CTRL)")
    print("=" * 60)

    with open(WEEKS_STATS, encoding='utf-8') as f:
        stats_data = json.load(f)

    fighters = stats_data.get('fighters', [])
    if not fighters:
        print("No fighters found in this_weeks_stats.json. Exiting.")
        return

    print(f"\nFighters on this week's card: {len(fighters)}")

    cache = load_cache()
    cached_count = len(cache)

    # Rough request estimate
    letters_needed = set()
    for fd in fighters:
        name = fd.get('name', '')
        parts = name.strip().split()
        if parts and parts[-1]:
            letters_needed.add(parts[-1][0].lower())

    new_alpha    = sum(1 for l in letters_needed if ALPHA_URL.format(letter=l) not in cache)
    est_requests = new_alpha + len(fighters) + len(fighters) * FIGHTS_TO_ANALYZE
    est_min_mins = est_requests * DELAY_MIN / 60
    est_max_mins = est_requests * DELAY_MAX / 60

    print(f"Already-cached URLs: {cached_count}")
    print(f"Estimated NEW requests: ~{est_requests}")
    print(f"Estimated time: {est_min_mins:.0f}–{est_max_mins:.0f} minutes")
    print(f"\nThis will write avg_kd_per_fight, avg_ctrl_secs, grappling_control_pct")
    print(f"into {WEEKS_STATS}")
    print(f"\nCache file: {CACHE_PATH}")
    print("(Re-running is safe — cached URLs are never re-fetched.)")
    print("\nPress ENTER to start, or Ctrl+C to abort.")

    try:
        input()
    except KeyboardInterrupt:
        print("\nAborted.")
        return

    results = {}
    matched  = 0
    missed   = 0

    for i, fighter_data in enumerate(fighters):
        dk_name = fighter_data.get('name', '')
        if not dk_name:
            continue

        print(f"\n[{i+1}/{len(fighters)}] {dk_name}")
        result = scrape_fighter(dk_name, cache)

        if result:
            results[dk_name] = result
            matched += 1
            print(
                f"  ✓  KD/fight={result['avg_kd_per_fight']}  "
                f"CTRL={result['avg_ctrl_secs']}s  "
                f"ctrl%={result['grappling_control_pct']}%"
            )
        else:
            missed += 1
            print(f"  ✗  {dk_name} — no data")

    # Write results back
    for fighter_data in fighters:
        dk_name = fighter_data.get('name', '')
        if dk_name not in results:
            continue
        r = results[dk_name]
        fighter_data.setdefault('stats', {})
        fighter_data['stats']['avg_kd_per_fight']      = r['avg_kd_per_fight']
        fighter_data['stats']['avg_ctrl_secs']          = r['avg_ctrl_secs']
        fighter_data['stats']['grappling_control_pct']  = r['grappling_control_pct']

    # Backup before overwrite
    os.makedirs(ARCHIVE_DIR, exist_ok=True)
    ts = datetime.now().strftime('%Y%m%d_%H%M%S')
    backup = os.path.join(ARCHIVE_DIR, f'this_weeks_stats-backup-{ts}.json')
    shutil.copy(WEEKS_STATS, backup)
    print(f"\nBacked up → {backup}")

    with open(WEEKS_STATS, 'w', encoding='utf-8') as f:
        json.dump(stats_data, f, indent=2)

    print(f"\n{'=' * 60}")
    print(f"  Done — matched {matched}, missed {missed}")
    print(f"  Results written to {WEEKS_STATS}")
    print(f"  Cache saved to {CACHE_PATH}")
    print(f"{'=' * 60}")


if __name__ == '__main__':
    main()
