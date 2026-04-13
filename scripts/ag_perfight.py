"""
ag_perfight.py — UFCStats per-fight and defensive-grappling scrapers.

All network requests go through the shared _perfight_get() function which:
  • Loads/saves a permanent disk cache at public/ufcstats_perfight_cache.json
  • Adds a polite 8–15 second delay on every *new* URL
  • Returns cached HTML text instantly on subsequent calls

This means:
  • First run with SCRAPE_PERFIGHT=1 takes ~15–30 min (one request per fight page)
  • Every subsequent run (same event or re-run) is instant (read from cache)
  • SCRAPE_DEF_GRAPPLING=1 costs zero extra requests if SCRAPE_PERFIGHT already ran
  • SCRAPE_UFCSTATS=1 also shares this cache via the _perfight_get import in ag_ufcstats.py

Public functions:
  scrape_ufcstats_perfight(dk_name)
      Aggregates avg_kd_per_fight, avg_ctrl_secs, grappling_control_pct, and
      significant strike distribution (by target and position) over last 5 fights.

  scrape_ufcstats_def_grappling(dk_name)
      Aggregates avg_opp_ctrl_secs, avg_reversals_per_fight, implied_sub_def_pct
      over the same last 5 fights (zero extra requests after SCRAPE_PERFIGHT ran).

Imported by:  aggregate_stats.py · ag_ufcstats.py
Depends on:   ag_utils._parse_of  (parses 'X of Y' striking cells)
Rollback:     cp _archive/scripts/aggregate_stats_ORIGINAL_PRESPLIT.py scripts/aggregate_stats.py
"""

import json
import os
import requests
from bs4 import BeautifulSoup
import time
import re
import random

from ag_utils import _parse_of


# ── Cache configuration ──────────────────────────────────────────────────────
# The cache file lives in public/ (next to this_weeks_stats.json) so that the
# browser build folder also keeps it.  __file__ is scripts/ag_perfight.py so
# scripts/../public/ correctly resolves to the project-root public/ folder.

_PERFIGHT_CACHE_PATH = os.path.join(
    os.path.dirname(__file__), '..', 'public', 'ufcstats_perfight_cache.json'
)

# UFCStats browse URL — {letter} is substituted at call time
_PERFIGHT_ALPHA_URL = 'http://ufcstats.com/statistics/fighters?char={letter}&page=all'

# Request headers for all UFCStats fetches
_PERFIGHT_HEADERS = {
    'User-Agent': (
        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 '
        '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
    ),
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.5',
}

_PERFIGHT_FIGHT_LIMIT = 5    # analyze last N completed fights per fighter
_PERFIGHT_DELAY_MIN   = 8.0  # seconds — minimum polite delay between live fetches
_PERFIGHT_DELAY_MAX   = 15.0 # seconds — maximum polite delay between live fetches
_PERFIGHT_FUZZY_MIN   = 72   # minimum fuzzy match score to accept a fighter profile

_perfight_cache = None  # lazy-loaded on first call to _perfight_get()


# ── Cache I/O ────────────────────────────────────────────────────────────────

def _perfight_load_cache():
    """Load (or initialise) the in-memory URL→HTML cache from disk.

    Called lazily by _perfight_get() on its first invocation.  Subsequent calls
    return the already-loaded dict without disk I/O.
    """
    global _perfight_cache
    if _perfight_cache is not None:
        return _perfight_cache
    path = os.path.normpath(_PERFIGHT_CACHE_PATH)
    if os.path.exists(path):
        with open(path, encoding='utf-8') as f:
            _perfight_cache = json.load(f)
    else:
        _perfight_cache = {}
    return _perfight_cache


def _perfight_save_cache():
    """Flush the in-memory cache to disk after each new URL is fetched.

    Saving after every fetch means a mid-run crash loses at most one request.
    """
    global _perfight_cache
    if _perfight_cache is None:
        return
    path = os.path.normpath(_PERFIGHT_CACHE_PATH)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(_perfight_cache, f, indent=1)


# ── Shared caching HTTP fetcher ──────────────────────────────────────────────
# Used by both this module and ag_ufcstats.scrape_ufcstats_fighter().
# Exported so ag_ufcstats can import it directly.

def _perfight_get(url):
    """Fetch *url* and cache the HTML, adding a polite delay on live fetches.

    Returns the HTML text string, or None on network error.
    Cached responses are returned instantly with no delay.
    """
    cache = _perfight_load_cache()
    if url in cache:
        return cache[url]
    delay = random.uniform(_PERFIGHT_DELAY_MIN, _PERFIGHT_DELAY_MAX)
    print(f"    [wait {delay:.1f}s] GET {url}")
    time.sleep(delay)
    try:
        resp = requests.get(url, headers=_PERFIGHT_HEADERS, timeout=18)
        resp.raise_for_status()
        cache[url] = resp.text
        _perfight_save_cache()
        return resp.text
    except Exception as e:
        print(f"    [ERROR] {url}: {e}")
        return None


# ── CTRL time parser ─────────────────────────────────────────────────────────

def _ctrl_to_secs(ctrl_str):
    """Convert a 'MM:SS' control-time string to total seconds.

    Returns 0 on any parse error (e.g. '--', empty string).
    """
    try:
        m, s = ctrl_str.strip().split(':')
        return int(m) * 60 + int(s)
    except Exception:
        return 0


# ── Per-fight enrichment ──────────────────────────────────────────────────────

def scrape_ufcstats_perfight(dk_name):
    """Scrape UFCStats for a fighter's last _PERFIGHT_FIGHT_LIMIT completed fights.

    Aggregates from fight detail pages:
      avg_kd_per_fight       — average knockdowns landed per fight
      avg_ctrl_secs          — average grappling control time per fight (seconds)
      grappling_control_pct  — ctrl_secs / total_fight_time * 100
      fights_analyzed        — number of fights used (may be < _PERFIGHT_FIGHT_LIMIT
                               if the fighter has fewer recorded bouts)
      head_str_pct           — % of landed sig strikes aimed at the head
      body_str_pct           — % aimed at the body
      leg_str_pct            — % aimed at the legs
      distance_str_pct       — % thrown at distance
      clinch_str_pct         — % thrown in the clinch
      ground_str_pct         — % thrown on the ground

    All HTTP fetches go through _perfight_get() (cached).
    Returns a dict with the above keys, or {} on failure.
    """
    from fuzzywuzzy import fuzz as _fuzz

    parts  = dk_name.strip().split()
    letter = (parts[-1][0] if parts and parts[-1] else 'a').lower()
    if not letter.isalpha():
        letter = 'a'

    # ── Step 1: find the fighter's profile URL via the alpha browse page ─────
    alpha_html = _perfight_get(_PERFIGHT_ALPHA_URL.format(letter=letter))
    if not alpha_html:
        return {}

    soup  = BeautifulSoup(alpha_html, 'html.parser')
    table = soup.find('table', class_='b-statistics__table')
    if not table:
        return {}

    best_score, best_url = 0, None
    for row in table.find_all('tr')[1:]:
        cells = row.find_all('td')
        if len(cells) < 2:
            continue
        first = cells[0].get_text(strip=True)
        last  = cells[1].get_text(strip=True)
        full  = f"{first} {last}"
        a_tag = cells[0].find('a', href=True) or cells[1].find('a', href=True)
        if not a_tag:
            continue
        score = _fuzz.token_sort_ratio(dk_name.lower(), full.lower())
        if score > best_score:
            best_score = score
            best_url   = a_tag['href']

    if best_score < _PERFIGHT_FUZZY_MIN or not best_url:
        print(f"  ✗ per-fight: no profile found for '{dk_name}' (best score {best_score})")
        return {}

    # ── Step 2: fetch fighter profile for fight-history URLs ─────────────────
    profile_html = _perfight_get(best_url)
    if not profile_html:
        return {}

    psoup  = BeautifulSoup(profile_html, 'html.parser')
    ptable = psoup.find('table', class_='b-fight-details__table')
    if not ptable:
        return {}

    fights = []
    for row in ptable.find_all('tr')[1:]:
        cells = row.find_all('td')
        if len(cells) < 10:
            continue
        wl = cells[0].get_text(strip=True).lower()
        if wl not in ('win', 'loss', 'nc', 'draw'):
            continue

        # Determine which <p> element index (0 or 1) is our fighter
        name_ps = cells[1].find_all('p')
        our_idx = 0
        if name_ps:
            name0 = name_ps[0].get_text(strip=True)
            if _fuzz.token_sort_ratio(dk_name.lower(), name0.lower()) < 60:
                our_idx = 1

        # KD — knockdowns *landed* by our fighter in this fight
        kd_ps = cells[2].find_all('p')
        if kd_ps and len(kd_ps) > our_idx:
            kd_raw = kd_ps[our_idx].get_text(strip=True)
            our_kd = int(kd_raw) if kd_raw.isdigit() else 0
        else:
            kd_parts = cells[2].get_text(' ', strip=True).split()
            our_kd = int(kd_parts[our_idx]) if len(kd_parts) > our_idx and kd_parts[our_idx].isdigit() else 0

        # Total fight time in seconds (for grappling_control_pct denominator)
        rnd_text  = cells[8].get_text(strip=True)
        time_text = cells[9].get_text(strip=True)
        try:
            finished_round = int(rnd_text)
            m, s = time_text.split(':')
            total_secs = (finished_round - 1) * 5 * 60 + int(m) * 60 + int(s)
        except Exception:
            total_secs = 0

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
        if len(fights) >= _PERFIGHT_FIGHT_LIMIT:
            break

    if not fights:
        return {}

    # ── Step 3: fetch each fight detail page for CTRL + strike breakdown ─────
    # UFCStats fight detail "Totals" table column layout (per <td>, two <p> per fighter):
    #   cells[0]  Fighter names     cells[5]  TD
    #   cells[1]  KD                cells[6]  TD %
    #   cells[2]  Sig.Str           cells[7]  Sub.Att
    #   cells[3]  Sig.Str %         cells[8]  Rev.
    #   cells[4]  Total Str         cells[9]  CTRL
    # Significant strikes by target/position (table index 2):
    #   col[3]=Head  col[4]=Body  col[5]=Leg  col[6]=Distance  col[7]=Clinch  col[8]=Ground

    ctrl_times, kd_total, time_total = [], 0, 0
    head_l_tot = head_a_tot = 0
    body_l_tot = body_a_tot = 0
    leg_l_tot  = leg_a_tot  = 0
    dist_l_tot = dist_a_tot = 0
    clinch_l_tot = clinch_a_tot = 0
    ground_l_tot = ground_a_tot = 0

    for fight in fights:
        fight_html = _perfight_get(fight['fight_url'])
        ctrl_secs  = 0
        if fight_html:
            fsoup  = BeautifulSoup(fight_html, 'html.parser')
            tables = fsoup.find_all('table')
            if tables:
                data_rows = tables[0].find_all('tr')
                if len(data_rows) >= 2:
                    dcells = data_rows[1].find_all('td')
                    if len(dcells) >= 10:
                        ctrl_cell = dcells[9]
                        ps = ctrl_cell.find_all('p')
                        if ps and len(ps) > fight['our_idx']:
                            ctrl_secs = _ctrl_to_secs(ps[fight['our_idx']].get_text(strip=True))
                        else:
                            raw = ctrl_cell.get_text(' ', strip=True).split()
                            if len(raw) > fight['our_idx']:
                                ctrl_secs = _ctrl_to_secs(raw[fight['our_idx']])

            # Significant strikes by target / position from table[2]
            if len(tables) >= 3:
                sig_rows = tables[2].find_all('tr')
                if len(sig_rows) >= 2:
                    sc = sig_rows[1].find_all('td')

                    def _get_of(col_idx, our_idx=fight['our_idx']):
                        """Extract (landed, attempted) from a sig-strike column cell."""
                        if len(sc) <= col_idx:
                            return (0, 0)
                        ps2 = sc[col_idx].find_all('p')
                        if ps2 and len(ps2) > our_idx:
                            return _parse_of(ps2[our_idx].get_text(strip=True))
                        raw2 = sc[col_idx].get_text(' ', strip=True).split()
                        start = our_idx * 3
                        if len(raw2) >= start + 3 and raw2[start + 1].lower() == 'of':
                            try:
                                return (int(raw2[start]), int(raw2[start + 2]))
                            except (ValueError, IndexError):
                                pass
                        return (0, 0)

                    hl, ha = _get_of(3)  # Head
                    bl, ba = _get_of(4)  # Body
                    ll, la = _get_of(5)  # Leg
                    dl, da = _get_of(6)  # Distance
                    cl, ca = _get_of(7)  # Clinch
                    gl, ga = _get_of(8)  # Ground
                    head_l_tot += hl;   head_a_tot += ha
                    body_l_tot += bl;   body_a_tot += ba
                    leg_l_tot  += ll;   leg_a_tot  += la
                    dist_l_tot += dl;   dist_a_tot += da
                    clinch_l_tot += cl; clinch_a_tot += ca
                    ground_l_tot += gl; ground_a_tot += ga

        ctrl_times.append(ctrl_secs)
        kd_total   += fight['our_kd']
        time_total += fight['total_secs']

    n = len(fights)

    # Strike distribution: % of *landed* sig strikes by target and position
    by_target = head_l_tot + body_l_tot + leg_l_tot
    by_pos    = dist_l_tot + clinch_l_tot + ground_l_tot

    def _spct(part, total):
        return round(part / total * 100) if total > 0 else None

    return {
        'avg_kd_per_fight':       round(kd_total / n, 2),
        'avg_ctrl_secs':          round(sum(ctrl_times) / n, 1),
        'grappling_control_pct':  round(sum(ctrl_times) / time_total * 100, 1) if time_total > 0 else None,
        'fights_analyzed':        n,
        'head_str_pct':     _spct(head_l_tot,   by_target),
        'body_str_pct':     _spct(body_l_tot,   by_target),
        'leg_str_pct':      _spct(leg_l_tot,    by_target),
        'distance_str_pct': _spct(dist_l_tot,   by_pos),
        'clinch_str_pct':   _spct(clinch_l_tot, by_pos),
        'ground_str_pct':   _spct(ground_l_tot, by_pos),
    }


# ── Defensive grappling enrichment ───────────────────────────────────────────

def scrape_ufcstats_def_grappling(dk_name):
    """Scrape defensive grappling metrics for *dk_name* from UFCStats fight pages.

    Extracts (over last _PERFIGHT_FIGHT_LIMIT completed fights):
      avg_opp_ctrl_secs       — seconds/fight the *opponent* controlled our fighter
      avg_reversals_per_fight — bottom-to-top transitions (sign of active escapes)
      implied_sub_def_pct     — (opp_sub_att − subs_conceded) / opp_sub_att × 100
                                NOTE: No public source publishes a formal "Sub Def %"
                                column.  This derived metric is the best available proxy.
      opp_sub_attempts_vs     — raw opponent sub attempt count across analyzed fights
      subs_conceded           — fights the fighter lost by submission
      def_fights_analyzed     — number of fights used

    All HTTP fetches go through _perfight_get() — if SCRAPE_PERFIGHT already ran,
    every page is served from cache at zero network cost.

    Returns dict with above keys, or {} on failure.
    """
    from fuzzywuzzy import fuzz as _fuzz

    parts  = dk_name.strip().split()
    letter = (parts[-1][0] if parts and parts[-1] else 'a').lower()
    if not letter.isalpha():
        letter = 'a'

    # ── Step 1: locate fighter profile URL ───────────────────────────────────
    alpha_html = _perfight_get(_PERFIGHT_ALPHA_URL.format(letter=letter))
    if not alpha_html:
        return {}

    soup  = BeautifulSoup(alpha_html, 'html.parser')
    table = soup.find('table', class_='b-statistics__table')
    if not table:
        return {}

    best_score, best_url = 0, None
    for row in table.find_all('tr')[1:]:
        cells = row.find_all('td')
        if len(cells) < 2:
            continue
        first = cells[0].get_text(strip=True)
        last  = cells[1].get_text(strip=True)
        full  = f"{first} {last}"
        a_tag = cells[0].find('a', href=True) or cells[1].find('a', href=True)
        if not a_tag:
            continue
        score = _fuzz.token_sort_ratio(dk_name.lower(), full.lower())
        if score > best_score:
            best_score = score
            best_url   = a_tag['href']

    if best_score < _PERFIGHT_FUZZY_MIN or not best_url:
        print(f"  ✗ def-grappling: no profile for '{dk_name}' (best score {best_score})")
        return {}

    # ── Step 2: fetch profile → collect fight detail URLs ────────────────────
    profile_html = _perfight_get(best_url)
    if not profile_html:
        return {}

    psoup  = BeautifulSoup(profile_html, 'html.parser')
    ptable = psoup.find('table', class_='b-fight-details__table')
    if not ptable:
        return {}

    fights_meta = []
    for row in ptable.find_all('tr')[1:]:
        cells = row.find_all('td')
        if len(cells) < 10:
            continue
        wl = cells[0].get_text(strip=True).lower()
        if wl not in ('win', 'loss', 'nc', 'draw'):
            continue

        # Determine our fighter's column index (0 or 1)
        name_ps = cells[1].find_all('p')
        our_idx = 0
        if name_ps:
            name0 = name_ps[0].get_text(strip=True)
            if _fuzz.token_sort_ratio(dk_name.lower(), name0.lower()) < 60:
                our_idx = 1
        opp_idx = 1 - our_idx

        fight_links = [
            a['href'] for a in row.find_all('a', href=True)
            if 'fight-details' in a['href']
        ]
        if not fight_links:
            continue

        fights_meta.append({
            'fight_url': fight_links[0],
            'wl':        wl,
            'our_idx':   our_idx,
            'opp_idx':   opp_idx,
        })
        if len(fights_meta) >= _PERFIGHT_FIGHT_LIMIT:
            break

    if not fights_meta:
        return {}

    # ── Step 3: per-fight detail extraction ──────────────────────────────────
    # UFCStats fight detail "Totals" table cell layout (two <p> tags per fighter,
    # indexed by our_idx / opp_idx):
    #   dcells[0]  Fighter names    dcells[5] TD
    #   dcells[1]  KD               dcells[6] TD %
    #   dcells[2]  Sig.Str          dcells[7] Sub.Att  ← opp_idx (attempts against us)
    #   dcells[3]  Sig.Str %        dcells[8] Rev.     ← our_idx  (our reversals/escapes)
    #   dcells[4]  Total Str        dcells[9] CTRL     ← opp_idx  (time opponent held us)

    def _cell_int(dcells, col, fighter_idx):
        """Extract an integer from dcells[col] for fighter_idx; 0 on failure."""
        if col >= len(dcells):
            return 0
        ps = dcells[col].find_all('p')
        if ps and len(ps) > fighter_idx:
            txt = ps[fighter_idx].get_text(strip=True)
            return int(txt) if txt.isdigit() else 0
        raw = dcells[col].get_text(' ', strip=True).split()
        if len(raw) > fighter_idx and raw[fighter_idx].isdigit():
            return int(raw[fighter_idx])
        return 0

    opp_ctrl_list = []
    rev_list      = []
    opp_sub_total = 0
    subs_conceded = 0

    for fm in fights_meta:
        fight_html    = _perfight_get(fm['fight_url'])
        opp_ctrl_secs = 0
        our_rev       = 0
        opp_sub_att   = 0

        if fight_html:
            fsoup  = BeautifulSoup(fight_html, 'html.parser')
            tables = fsoup.find_all('table')

            if tables:
                data_rows = tables[0].find_all('tr')
                if len(data_rows) >= 2:
                    dcells = data_rows[1].find_all('td')
                    if len(dcells) >= 10:
                        # Opponent sub attempts against us
                        opp_sub_att = _cell_int(dcells, 7, fm['opp_idx'])
                        # Our reversals (bottom→top transitions)
                        our_rev     = _cell_int(dcells, 8, fm['our_idx'])
                        # Opponent control time over us
                        opp_ctrl_ps = dcells[9].find_all('p')
                        if opp_ctrl_ps and len(opp_ctrl_ps) > fm['opp_idx']:
                            opp_ctrl_secs = _ctrl_to_secs(
                                opp_ctrl_ps[fm['opp_idx']].get_text(strip=True)
                            )
                        else:
                            raw = dcells[9].get_text(' ', strip=True).split()
                            if len(raw) > fm['opp_idx']:
                                opp_ctrl_secs = _ctrl_to_secs(raw[fm['opp_idx']])

            # Was this fight lost by submission?  Check the fight detail method header.
            if fm['wl'] == 'loss':
                method_text = ''
                for item in fsoup.select('.b-fight-details__text-item'):
                    lbl = item.select_one('.b-fight-details__text-item-label')
                    if lbl and 'Method' in lbl.get_text():
                        method_text = item.get_text(' ', strip=True).lower()
                        break
                if not method_text:
                    mt = fsoup.find(string=lambda t: t and 'Method:' in t)
                    if mt:
                        sib = mt.find_next(string=True)
                        method_text = (sib.strip() if sib else '').lower()
                if 'sub' in method_text:
                    subs_conceded += 1

        opp_ctrl_list.append(opp_ctrl_secs)
        rev_list.append(our_rev)
        opp_sub_total += opp_sub_att

    n = len(fights_meta)

    # implied_sub_def_pct: percentage of opponent sub attempts that did NOT end the fight.
    # For fighters with zero opposition sub attempts, we assign 100% (vacuously defended all).
    implied_sub_def = None
    if opp_sub_total > 0:
        defended        = max(opp_sub_total - subs_conceded, 0)
        implied_sub_def = round(defended / opp_sub_total * 100, 1)
    elif n > 0:
        # No sub attempts ever recorded against this fighter → 100% vacuously
        implied_sub_def = 100.0

    result = {
        'avg_opp_ctrl_secs':       round(sum(opp_ctrl_list) / n, 1),
        'avg_reversals_per_fight': round(sum(rev_list) / n, 2),
        'implied_sub_def_pct':     implied_sub_def,
        'opp_sub_attempts_vs':     opp_sub_total,
        'subs_conceded':           subs_conceded,
        'def_fights_analyzed':     n,
    }
    print(
        f"  ✓ def-grappling '{dk_name}': "
        f"opp_ctrl={result['avg_opp_ctrl_secs']}s  "
        f"rev={result['avg_reversals_per_fight']}/fight  "
        f"implied_sub_def={result['implied_sub_def_pct']}%  "
        f"opp_sub_att={opp_sub_total}  subs_conceded={subs_conceded}  "
        f"({n} fights)"
    )
    return result
