"""
ag_ufcstats.py — UFCStats.com fighter-profile scraper for the aggregate_stats pipeline.

Scrapes the public fighter browse + profile pages on ufcstats.com to retrieve:
  td_defense, striking_defense, sub_avg, slpm, sapm, str_acc, td_avg, td_acc,
  height, reach, stance, dob, nickname, record, weight_lbs

HTTP fetches are routed through ag_perfight._perfight_get() which:
  - Maintains a persistent disk cache (public/ufcstats_perfight_cache.json)
  - Adds a polite 8–15 second delay on every *new* URL
  - Returns the cached HTML text on subsequent calls (zero network cost)
This means if SCRAPE_PERFIGHT=1 already ran and populated the cache, running
SCRAPE_UFCSTATS=1 afterward costs zero extra requests for fighters already seen.

Imported by:  aggregate_stats.py
Depends on:   ag_perfight._perfight_get  (shared HTTP cache)
Rollback:     cp _archive/scripts/aggregate_stats_ORIGINAL_PRESPLIT.py scripts/aggregate_stats.py
"""

import re
from bs4 import BeautifulSoup

# _perfight_get is our shared caching HTTP fetcher defined in ag_perfight.
# Importing it here ensures the same in-memory cache is shared across both
# SCRAPE_UFCSTATS and SCRAPE_PERFIGHT passes within a single pipeline run.
from ag_perfight import _perfight_get


# ── DK ID → UFCStats ID mapping ─────────────────────────────────────────────
# Not currently used by the main pipeline (it does URL-based lookup instead),
# but kept here as a reference for manual overrides when auto-matching fails.
#
# To find a UFCStats ID:
#   1. Go to http://ufcstats.com/statistics/fighters?char=<first_letter>&page=all
#   2. Find the fighter and click their name
#   3. Copy the hex ID from the URL: /fighter-details/<ID>
#
# Format: { "DK_id_string": "ufcstats_hex_id", ... }
id_mapping = {
    # "42160385": "93fe7332d16c6ad9",  # Example — DK ID → UFCStats ID
    # Populate with real IDs for the current card when auto-matching struggles
}


# ── Fighter profile scraper ──────────────────────────────────────────────────

def scrape_ufcstats_fighter(dk_name):
    """Scrape UFCStats.com for a fighter's career stat page.

    Strategy:
      1. Build the browse URL using the first letter of the fighter's last name:
             http://ufcstats.com/statistics/fighters?char=<letter>&page=all
         (The search endpoint is unreliable; char= browsing is stable.)
      2. Find the best-matching row (exact first, then fuzzy ≥80) and get the
         profile URL from the link in that row.
      3. Fetch the profile page and parse the stat box + header.

    The _perfight_get() cache is reused for both the browse page and the profile
    page, so fighters already scraped by SCRAPE_PERFIGHT require zero extra HTTP
    requests here.

    Returns a dict with keys:
        td_defense (str "64%"), striking_defense (str "57%"),
        sub_avg, slpm, sapm, str_acc, td_avg, td_acc (float or None),
        height, reach, stance, dob, record, weight_lbs (str or "N/A"),
        nickname (str or None)
    Returns {} on failure or no match.
    """
    parts = dk_name.strip().split()
    if not parts:
        return {}
    first = parts[0]
    last  = parts[-1] if len(parts) > 1 else ''

    # Strip name suffixes before picking the browse letter, because UFCStats
    # indexes fighters by their actual last name, not the suffix.
    # e.g. "Michael Aswell Jr." → last="Jr." → char='j' is WRONG; should be 'a'.
    _SUFFIXES = {'jr', 'jr.', 'sr', 'sr.', 'ii', 'iii', 'iv'}
    name_for_char = [p for p in parts if p.lower() not in _SUFFIXES]
    last_for_char = name_for_char[-1] if len(name_for_char) > 1 else (name_for_char[0] if name_for_char else last)

    try:
        char = (last_for_char[0] if last_for_char else first[0]).lower()
        search_url = f"http://ufcstats.com/statistics/fighters?char={char}&page=all"
        print(f"  🔍 UFCStats browse (char={char}): {dk_name}")
        html = _perfight_get(search_url)
        if not html:
            return {}
        soup = BeautifulSoup(html, 'html.parser')

        def _norm(s):
            """Reduce a name to lowercase letters only for exact comparison."""
            return re.sub(r'[^a-z]', '', s.lower())

        norm_q = _norm(dk_name)
        profile_url = None

        # Pass 1: exact match (first + last name concatenated, letters only)
        for row in soup.select('table.b-statistics__table tbody tr'):
            cells = row.find_all('td')
            if len(cells) < 2:
                continue
            fn = cells[0].get_text(strip=True)
            ln = cells[1].get_text(strip=True)
            full = f"{fn} {ln}".strip()
            if _norm(full) == norm_q or _norm(fn + ln) == _norm(dk_name.replace(' ', '')):
                link = cells[0].find('a') or cells[1].find('a')
                if link and link.get('href'):
                    profile_url = link['href']
                    print(f"  ✅ UFCStats match: '{full}' → {profile_url}")
                    break

        # Pass 2: fuzzy fallback using fuzzywuzzy
        if not profile_url:
            from fuzzywuzzy import process
            candidates = []
            for row in soup.select('table.b-statistics__table tbody tr'):
                cells = row.find_all('td')
                if len(cells) < 2:
                    continue
                fn = cells[0].get_text(strip=True)
                ln = cells[1].get_text(strip=True)
                full = f"{fn} {ln}".strip()
                link = cells[0].find('a') or cells[1].find('a')
                if link and link.get('href') and full:
                    candidates.append((full, link['href']))

            if candidates:
                names  = [c[0] for c in candidates]
                result = process.extractOne(_norm(dk_name), [_norm(n) for n in names])
                if result and result[1] >= 80:
                    idx = [_norm(n) for n in names].index(result[0])
                    profile_url = candidates[idx][1]
                    print(f"  ~ UFCStats [FUZZY] '{dk_name}' → '{candidates[idx][0]}' (score {result[1]})")

        if not profile_url:
            print(f"  ❌ UFCStats: no profile found for '{dk_name}'")
            return {}

        # ── Fetch fighter profile page ────────────────────────────────────
        if not profile_url.startswith('http'):
            profile_url = 'http://ufcstats.com' + profile_url
        html2 = _perfight_get(profile_url)
        if not html2:
            return {}
        soup2 = BeautifulSoup(html2, 'html.parser')

        # ── Parse stat box  ───────────────────────────────────────────────
        # The profile page has a list of <li class="b-list__box-list-item">
        # elements.  Each item has a label (<i ...>) and a plain-text value.
        stats_out = {}
        for item in soup2.select('li.b-list__box-list-item'):
            label_el = item.select_one('i.b-list__box-item-title')
            if not label_el:
                continue
            label = label_el.get_text(strip=True).rstrip(':').lower()
            label_el.extract()  # remove label so only the value text remains
            value = item.get_text(strip=True)
            stats_out[label] = value

        def _pct(val):
            """Convert '64%' → 64.0, return 'N/A' on failure (kept as string for display)."""
            if not val or val in ('--', ''):
                return 'N/A'
            val = str(val).replace('%', '').strip()
            try:
                return float(val)
            except ValueError:
                return 'N/A'

        def _num(val):
            """Convert a numeric string to float, return None on failure."""
            if not val or val in ('--', ''):
                return None
            try:
                return float(str(val).replace('%', '').strip())
            except ValueError:
                return None

        # ── Nickname and record from page header ──────────────────────────
        nick_el    = soup2.find('p', class_='b-content__Nickname')
        rec_el     = soup2.find('span', class_='b-content__title-record')
        nickname   = nick_el.get_text(strip=True) if nick_el else None
        record_raw = rec_el.get_text(strip=True).replace('Record:', '').strip() if rec_el else None

        result = {
            # Defensive stats — NOT in ufc-master.csv, primary reason to call this
            'td_defense':       stats_out.get('td def.', stats_out.get('td def', 'N/A')),
            'striking_defense': stats_out.get('str. def', stats_out.get('str def', 'N/A')),
            # Offensive stats (ufc-master.csv values are used by preference when available)
            'sub_avg':  _num(stats_out.get('sub. avg.', stats_out.get('sub avg', None))),
            'slpm':     _num(stats_out.get('slpm')),
            'sapm':     _num(stats_out.get('sapm')),
            'str_acc':  _num(stats_out.get('str. acc.', stats_out.get('str acc', None))),
            'td_avg':   _num(stats_out.get('td avg.', stats_out.get('td avg', None))),
            'td_acc':   _num(stats_out.get('td acc.', stats_out.get('td acc', None))),
            # Bio fields — used as fallback when ufc-master.csv misses a fighter
            'height':     stats_out.get('height', 'N/A'),
            'reach':      stats_out.get('reach',  'N/A'),
            'stance':     stats_out.get('stance', 'N/A').title() if stats_out.get('stance') else 'N/A',
            'dob':        stats_out.get('dob',    'N/A'),
            'nickname':   nickname,
            'record':     record_raw,
            'weight_lbs': stats_out.get('weight', None),  # e.g. '115 lbs.'
        }
        print(f"  ✅ UFCStats stats for '{dk_name}': {result}")
        return result

    except Exception as e:
        print(f"  ❌ UFCStats error for '{dk_name}': {e}")
        return {}
