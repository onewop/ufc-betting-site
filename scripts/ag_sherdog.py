"""
ag_sherdog.py — Sherdog.com (and BestFightOdds) scraping for the aggregate_stats pipeline.

Public functions:
  scrape_sherdog_event_card(event_url)
      One HTTP request → full fighter card dict.  Supply SHERDOG_EVENT_URL env var
      to skip the per-fighter search step (saves ~28 requests, ~2–3 min).

  _match_sherdog_card(dk_name, card)
      Look up a DK display-name in the pre-loaded event card dict.

  scrape_sherdog_fighter_data(fighter_name, profile_url=None)
      Full Sherdog profile scrape: record, win breakdown, bio, fight history.
      Supply profile_url to skip the fightfinder search step.

  get_empty_sherdog_data()
      Safe zero-filled fallback structure (returned on any scrape failure).

  scrape_betting_odds(matchup)
      BestFightOdds moneyline / O/U scraper — low priority / optional.

  scrape_fightmatrix_fighter_data / scrape_espn_fighter_data
      Future stubs (not yet implemented).

Imported by:  aggregate_stats.py
Rollback:     cp _archive/scripts/aggregate_stats_ORIGINAL_PRESPLIT.py scripts/aggregate_stats.py
"""

import requests
from bs4 import BeautifulSoup
import time
import re
import random
from urllib.parse import quote_plus
from fuzzywuzzy import fuzz


# ── Event-card prefetch ─────────────────────────────────────────────────────
# Set SHERDOG_EVENT_URL to the Sherdog event page for the current card:
#   SHERDOG_EVENT_URL=https://www.sherdog.com/events/UFC-Fight-Night-269-...-110785
# That single request returns all fighter names, profile URLs, and W-L-D records,
# letting us skip the per-fighter search entirely.

def scrape_sherdog_event_card(event_url):
    """Scrape a Sherdog event page and return a pre-built fighter lookup dict.

    Pass the event URL via env var:
        SHERDOG_EVENT_URL=https://www.sherdog.com/events/UFC-Fight-Night-269-... \\
        SCRAPE_SHERDOG=1 python3 scripts/aggregate_stats.py

    Returns:
        event_name (str)  — e.g. "UFC Fight Night 269 - Emmett vs. Vallejos"
        card (dict)       — normalized_dk_name → {
                                'sherdog_name': str,   # exact name as on Sherdog
                                'profile_url':  str,   # direct /fighter/... link
                                'record':       str,   # "19-6-0"
                                'wins':         int,
                                'losses':       int,
                                'draws':        int,
                            }
    Fighters are matched to DK names with last-name + fuzzy fallback in _match_sherdog_card().
    Returns ("", {}) on any failure.
    """
    headers = {
        'User-Agent': (
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 '
            '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
        ),
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Referer': 'https://www.sherdog.com/',
    }

    def _norm(name):
        """Strip noise for event-card matching (lowercase, alphanum + space only)."""
        name = name.lower()
        name = re.sub(r"\b(jr\.?|sr\.?|de|da|dos|das)\b", "", name)
        name = re.sub(r"[^a-z0-9 ]", "", name)
        return " ".join(name.split())

    try:
        print(f"\n🌐 Fetching Sherdog event page: {event_url}")
        resp = requests.get(event_url, headers=headers, timeout=15)
        resp.raise_for_status()
        soup = BeautifulSoup(resp.content, "html.parser")

        # Event name — try <span itemprop="name"> then common heading selectors
        event_name = ""
        for sel in ['[itemprop="name"]', 'h1.fight-card-header', 'h1']:
            el = soup.select_one(sel)
            if el:
                event_name = el.get_text(strip=True)
                if event_name:
                    break

        print(f"  📅 Event: {event_name or '(name not found)'}")

        # Fighters appear as <a href="/fighter/..."> links throughout the page.
        # Each link wraps the fighter's name; the "W-L-D" record sits in a nearby
        # parent/sibling element.
        card = {}  # normalized_name → fighter dict
        for a in soup.select("a[href^='/fighter/']"):
            sherdog_name = a.get_text(strip=True)
            if not sherdog_name or len(sherdog_name) < 2:
                continue
            profile_url = "https://www.sherdog.com" + a["href"]

            # Walk up to 5 ancestor nodes looking for a "W-L-D" pattern
            record_str = ""
            wins = losses = draws = 0
            node = a
            for _ in range(5):
                text = node.get_text(" ", strip=True)
                m = re.search(r"\b(\d+)-(\d+)-(\d+)\b", text)
                if m:
                    wins, losses, draws = int(m.group(1)), int(m.group(2)), int(m.group(3))
                    record_str = f"{wins}-{losses}-{draws}"
                    break
                if node.parent:
                    node = node.parent
                else:
                    break

            norm = _norm(sherdog_name)
            card[norm] = {
                'sherdog_name': sherdog_name,
                'profile_url':  profile_url,
                'record':       record_str,
                'wins':         wins,
                'losses':       losses,
                'draws':        draws,
            }

        print(f"  ✅ Found {len(card)} fighters on Sherdog event card")
        for norm, d in sorted(card.items(), key=lambda x: x[1]['sherdog_name']):
            print(f"     {d['sherdog_name']:30s}  {d['record']}")
        return event_name, card

    except Exception as e:
        print(f"  ❌ Could not load Sherdog event page: {e}")
        return "", {}


# ── Event-card name lookup ──────────────────────────────────────────────────

def _match_sherdog_card(dk_name, card):
    """Look up a DK display-name in the pre-loaded Sherdog event card dict.

    Strategy (in order):
      1. Direct lookup by normalized full name
      2. Last-name-only exact match (catches DK abbreviations)
      3. Fuzzy full-name fallback (threshold: 72)

    Returns the card entry dict (keys: sherdog_name, profile_url, record, …)
    or None if no match exceeds the threshold.
    """
    def _norm(name):
        name = name.lower()
        name = re.sub(r"\b(jr\.?|sr\.?|de|da|dos|das)\b", "", name)
        name = re.sub(r"[^a-z0-9 ]", "", name)
        return " ".join(name.split())

    norm_q = _norm(dk_name)

    # 1. Direct hit
    if norm_q in card:
        return card[norm_q]

    # 2. Last-name only (only works when exactly one fighter on the card shares it)
    last = norm_q.split()[-1] if norm_q else ""
    last_hits = [v for k, v in card.items() if k.split()[-1] == last]
    if len(last_hits) == 1:
        return last_hits[0]

    # 3. Fuzzy fallback
    best_score, best = 0, None
    for norm_key, entry in card.items():
        score = fuzz.token_sort_ratio(norm_q, norm_key)
        if score > best_score:
            best_score, best = score, entry
    if best_score >= 72:
        return best

    return None


# ── Fighter profile scraper ─────────────────────────────────────────────────

def scrape_sherdog_fighter_data(fighter_name, profile_url=None):
    """Scrape a Sherdog fighter profile for bio data, record breakdown, and fight history.

    If *profile_url* is supplied (from scrape_sherdog_event_card) the fightfinder
    search step is skipped — saving one HTTP request and the associated delay.

    Search URL:
        https://www.sherdog.com/stats/fightfinder?SearchTxt={query}&action=search
    Profile fields are extracted via itemprop attributes and regex on .fighter-info text.

    Returns a dict with keys from get_empty_sherdog_data() plus:
        dob, height, weight, nationality, team, nickname, fight_history
    Returns get_empty_sherdog_data() on any failure.
    """
    headers = {
        'User-Agent': (
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 '
            '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
        ),
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Referer': 'https://www.sherdog.com/',
    }

    def _norm(name):
        name = name.lower()
        name = re.sub(r"\b(jr\.?|sr\.?|de|da|dos|das)\b", "", name)
        name = re.sub(r"[^a-z0-9 ]", "", name)
        return " ".join(name.split())

    try:
        if profile_url:
            # Direct profile URL supplied — skip search step entirely
            print(f"  📄 Sherdog direct profile: {fighter_name} → {profile_url}")
        else:
            # ── Search step ────────────────────────────────────────────────
            query = quote_plus(fighter_name)
            search_url = (
                f"https://www.sherdog.com/stats/fightfinder"
                f"?SearchTxt={query}&Association=&Weight=&action=search"
            )
            print(f"  🔍 Sherdog search: {fighter_name}")
            resp = requests.get(search_url, headers=headers, timeout=12)
            resp.raise_for_status()
            time.sleep(random.uniform(3, 6))

            soup = BeautifulSoup(resp.content, "html.parser")

            # Fuzzy-match all /fighter/ links in the results table against the DK name
            best_score = 0
            norm_q = _norm(fighter_name)
            for a in soup.select("a[href^='/fighter/']"):
                link_name = a.get_text(strip=True)
                if not link_name:
                    continue
                score = fuzz.token_sort_ratio(norm_q, _norm(link_name))
                if score > best_score:
                    best_score = score
                    profile_url = "https://www.sherdog.com" + a["href"]

            # Retry without name suffixes (Jr., Sr., II, III) — Sherdog often omits them
            if best_score < 72 or not profile_url:
                stripped_name = re.sub(
                    r'\b(jr\.?|sr\.?|ii|iii|iv)\b', '', fighter_name, flags=re.IGNORECASE
                ).strip()
                if stripped_name != fighter_name:
                    print(f"  🔄 Retrying Sherdog search without suffix: '{stripped_name}'")
                    query2 = quote_plus(stripped_name)
                    search_url2 = (
                        f"https://www.sherdog.com/stats/fightfinder"
                        f"?SearchTxt={query2}&Association=&Weight=&action=search"
                    )
                    resp_r = requests.get(search_url2, headers=headers, timeout=12)
                    resp_r.raise_for_status()
                    time.sleep(random.uniform(2, 4))
                    soup_r = BeautifulSoup(resp_r.content, "html.parser")
                    norm_stripped = _norm(stripped_name)
                    for a in soup_r.select("a[href^='/fighter/']"):
                        link_name = a.get_text(strip=True)
                        if not link_name:
                            continue
                        score = fuzz.token_sort_ratio(norm_stripped, _norm(link_name))
                        if score > best_score:
                            best_score = score
                            profile_url = "https://www.sherdog.com" + a["href"]

            if best_score < 72 or not profile_url:
                print(f"  ❌ Sherdog: no profile found for '{fighter_name}' (best score {best_score})")
                return get_empty_sherdog_data()

            print(f"  📄 Sherdog profile: {profile_url} (score {best_score})")

        # ── Profile page fetch ────────────────────────────────────────────
        resp2 = requests.get(profile_url, headers=headers, timeout=12)
        resp2.raise_for_status()
        time.sleep(random.uniform(3, 6))
        soup2 = BeautifulSoup(resp2.content, "html.parser")

        data = get_empty_sherdog_data()

        # ── Overall record "21-11-0" ──────────────────────────────────────
        rec_el = soup2.select_one(".record")
        if rec_el:
            rec_text = rec_el.get_text(strip=True)
            m = re.match(r"(\d+)-(\d+)-(\d+)", rec_text)
            if m:
                data["sherdog_record"] = f"{m.group(1)}-{m.group(2)}-{m.group(3)}"
            else:
                data["sherdog_record"] = rec_text.split("(")[0].strip()

        # ── Bio fields via itemprop attributes ────────────────────────────
        def _itemprop(prop):
            el = soup2.select_one(f'[itemprop="{prop}"]')
            return el.get_text(strip=True) if el else "N/A"

        data["dob"]         = _itemprop("birthDate")
        data["height"]      = _itemprop("height")
        data["weight"]      = _itemprop("weight")
        data["nationality"] = _itemprop("nationality")

        # ── Nickname: <span class="nickname"><em>"The Eagle"</em></span> ──
        nick_el = soup2.select_one(".nickname em") or soup2.select_one(".nickname")
        if nick_el:
            nick_text = nick_el.get_text(strip=True).strip('"\' ')
            data["nickname"] = nick_text if nick_text else None
        else:
            data["nickname"] = None

        # ── Team / gym ────────────────────────────────────────────────────
        member_names = [
            el.get_text(strip=True)
            for el in soup2.select('[itemprop="memberOf"] [itemprop="name"]')
        ]
        data["team"] = member_names[0] if member_names else "N/A"

        # ── Win / loss breakdown ──────────────────────────────────────────
        # The fighter-info block contains plain text like:
        #   "Wins 21 KO / TKO 5 24% SUBMISSIONS 2 10% DECISIONS 14 67%"
        fi_text = soup2.select_one(".fighter-info")
        fi_text = fi_text.get_text(" ", strip=True) if fi_text else ""

        def _parse_breakdown_section(label):
            """Extract KO/TKO, submission, and decision counts from a stats section."""
            result = {"ko": 0, "sub": 0, "dec": 0}
            pat = re.compile(
                rf"{label}\s+\d+"
                r".*?KO\s*/\s*TKO\s+(\d+)"
                r".*?SUBMISSIONS?\s+(\d+)"
                r".*?DECISIONS?\s+(\d+)",
                re.IGNORECASE | re.DOTALL,
            )
            m = pat.search(fi_text)
            if m:
                result["ko"]  = int(m.group(1))
                result["sub"] = int(m.group(2))
                result["dec"] = int(m.group(3))
            return result

        wins_bd   = _parse_breakdown_section("Wins")
        losses_bd = _parse_breakdown_section("Losses")
        data.update({
            "wins_by_ko":           wins_bd["ko"],
            "wins_by_submission":   wins_bd["sub"],
            "wins_by_decision":     wins_bd["dec"],
            "losses_by_ko":         losses_bd["ko"],
            "losses_by_submission": losses_bd["sub"],
            "losses_by_decision":   losses_bd["dec"],
        })

        # ── Full career fight history ──────────────────────────────────────
        # Mark rows inside the AMATEUR section so we can tag them separately.
        amateur_rows = set()
        for fh_sec in soup2.find_all('div', class_='module fight_history'):
            prev_sec = fh_sec.find_previous('section')
            heading = ''
            if prev_sec:
                st = prev_sec.find('div', class_='slanted_title')
                if st:
                    heading = st.get_text(strip=True)
            if 'AMATEUR' in heading.upper():
                for tr in fh_sec.find_all('tr'):
                    amateur_rows.add(id(tr))

        fight_history = []
        fight_rows = soup2.select('tr.win, tr.loss, tr.nc, tr.draw')
        if not fight_rows:
            fight_rows = [tr for tr in soup2.find_all('tr') if tr.select_one('.final_result')]

        for frow in fight_rows:
            fcols = frow.find_all('td')
            if len(fcols) < 5:
                continue

            # Result
            res_el = frow.select_one('.final_result')
            fresult = res_el.get_text(strip=True).lower() if res_el else (frow.get('class') or [''])[0].lower()

            # Opponent name
            opp_name = ''
            for fc in fcols[1:3]:
                fa = fc.find('a', href=lambda h: h and '/fighter/' in h)
                if fa:
                    opp_name = fa.get_text(strip=True)
                    break
            if not opp_name:
                continue

            # Method
            method_col = (frow.select_one('td.col_sub') or
                          next((c for c in fcols if c.select_one('.method')), None) or
                          next((c for c in fcols if c.get('class') and any('winby' in cl for cl in c.get('class', []))), None))
            if method_col:
                m_el = method_col.select_one('.method')
                raw_method = m_el.get_text(strip=True) if m_el else method_col.get_text(' ', strip=True).split('\n')[0].strip()
                raw_method = re.sub(r'\s*VIEW PLAY-BY-PLAY.*', '', raw_method, flags=re.IGNORECASE).strip()
                m2 = re.match(r'^(.+?\))\s*(.*)', raw_method)
                fmethod = m2.group(1).strip() if m2 else raw_method
                sub_el = method_col.select_one('.sub_line')
                fmethod_detail = sub_el.get_text(strip=True) if sub_el else (m2.group(2).strip() if m2 else '')
            else:
                fmethod = ''
                fmethod_detail = ''

            # Event + Date — new Sherdog layout combines them in one td
            ev_col = frow.select_one('td.col_event')
            if not ev_col and len(fcols) > 2:
                ev_col = fcols[2]
            fevent = ''
            fdate_str = ''
            if ev_col:
                ev_text = ev_col.get_text(' ', strip=True)
                date_m = re.search(
                    r'((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s*[/,]?\s*\d{1,2}\s*[/,]?\s*\d{4})',
                    ev_text, re.IGNORECASE
                )
                if date_m:
                    fdate_str = re.sub(r'\s*/\s*', ' ', date_m.group(1)).strip()
                    fevent = ev_text[:date_m.start()].strip().rstrip(' -,')
                else:
                    ev_a = ev_col.find('a')
                    fevent = ev_a.get_text(strip=True) if ev_a else ev_text

            # Round and time — try class-based selectors first, then positional fallback
            fdate_el  = (frow.select_one('td.col_date')  or frow.select_one('td[class*="date"]'))
            fround_el = (frow.select_one('td.col_round') or frow.select_one('td[class*="round"]'))
            ftime_el  = (frow.select_one('td.col_time')  or frow.select_one('td[class*="time"]'))
            if not fround_el and len(fcols) > 4:
                fround_el = fcols[4]
            if not ftime_el and len(fcols) > 5:
                ftime_el = fcols[5]

            fight_history.append({
                'result':        fresult,
                'opponent':      opp_name,
                'method':        fmethod,
                'method_detail': fmethod_detail,
                'event':         fevent,
                'date':          fdate_el.get_text(strip=True) if fdate_el else fdate_str,
                'round':         fround_el.get_text(strip=True) if fround_el else '',
                'time':          ftime_el.get_text(strip=True)  if ftime_el  else '',
                'fight_type':    'amateur' if id(frow) in amateur_rows else 'pro',
            })

        data['fight_history'] = fight_history

        print(
            f"  ✅ Sherdog: {fighter_name} | record={data['sherdog_record']} | "
            f"KO={data['wins_by_ko']} Sub={data['wins_by_submission']} "
            f"Dec={data['wins_by_decision']} | "
            f"dob={data['dob']} height={data['height']} team={data['team']} "
            f"nickname={data['nickname']} | history={len(fight_history)} fights"
        )
        return data

    except Exception as e:
        print(f"  ❌ Sherdog error for '{fighter_name}': {e}")
        return get_empty_sherdog_data()


# ── Empty fallback structure ─────────────────────────────────────────────────

def get_empty_sherdog_data():
    """Return a zero-filled Sherdog data structure used when scraping fails.

    All callers check for this shape, so it must match the full successful return.
    """
    return {
        'sherdog_record': 'N/A',
        'wins_by_ko': 0,
        'wins_by_submission': 0,
        'wins_by_decision': 0,
        'losses_by_ko': 0,
        'losses_by_submission': 0,
        'losses_by_decision': 0,
        'dob':         'N/A',
        'height':      'N/A',
        'weight':      'N/A',
        'nationality': 'N/A',
        'team':        'N/A',
        'nickname':    None,
        'fight_history': [],
    }


# ── BestFightOdds scraper ────────────────────────────────────────────────────
# NOTE: This scraper is low-priority / rarely used.  The primary odds source is
# upcoming.csv (filled in manually or via generate_upcoming_template.py).
# scrape_betting_odds() is NOT called from csv_to_json() by default.

def scrape_betting_odds(matchup):
    """Scrape moneyline + over/under odds from BestFightOdds for one matchup.

    matchup format: "Fighter A vs. Fighter B"

    Returns a dict with keys:
        fighter1_name, fighter2_name,
        fighter1_moneyline, fighter2_moneyline,
        over_under_rounds, over_odds, under_odds,
        fighter1_ko_odds, fighter2_ko_odds,
        fighter1_decision_odds, fighter2_decision_odds
    Returns {} on any failure.
    """
    ua = random.choice([
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
    ])
    headers = {
        'User-Agent': ua,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Referer': 'https://www.bestfightodds.com/',
    }

    parts = [p.strip() for p in re.split(r' vs\.? ', matchup, maxsplit=1)]
    if len(parts) != 2:
        print(f"  ⚠️  Cannot parse matchup: '{matchup}'")
        return {}
    name1, name2 = parts

    try:
        query = name1.split()[-1]  # last name of fighter 1 usually sufficient
        url = f"https://www.bestfightodds.com/search?query={quote_plus(query)}"
        print(f"  🔍 BestFightOdds search: {url}")
        session = requests.Session()
        session.headers.update(headers)
        # Prime session with homepage first
        try:
            session.get('https://www.bestfightodds.com/', timeout=10)
            time.sleep(random.uniform(2, 4))
        except Exception:
            pass
        resp = session.get(url, timeout=10)
        resp.raise_for_status()
        time.sleep(random.uniform(5, 10))
        soup = BeautifulSoup(resp.content, 'html.parser')

        def _norm(s):
            return re.sub(r'[^a-z0-9]', '', s.lower())

        n1_last = _norm(name1.split()[-1])
        n2_last = _norm(name2.split()[-1])
        fight_link = None
        for a in soup.find_all('a', href=True):
            txt = _norm(a.get_text())
            if n1_last in txt and n2_last in txt:
                href = a['href']
                fight_link = href if href.startswith('http') else 'https://www.bestfightodds.com' + href
                break

        if not fight_link:
            print(f"  ❌ BestFightOdds: no fight page found for '{matchup}'")
            return {}

        print(f"  📄 Found fight page: {fight_link}")
        resp2 = session.get(fight_link, timeout=10)
        resp2.raise_for_status()
        time.sleep(random.uniform(5, 10))
        soup2 = BeautifulSoup(resp2.content, 'html.parser')

        odds = {
            'fighter1_name': name1,
            'fighter2_name': name2,
            'fighter1_moneyline': 'N/A',
            'fighter2_moneyline': 'N/A',
            'over_under_rounds': 'N/A',
            'over_odds': 'N/A',
            'under_odds': 'N/A',
            'fighter1_ko_odds': 'N/A',
            'fighter2_ko_odds': 'N/A',
            'fighter1_decision_odds': 'N/A',
            'fighter2_decision_odds': 'N/A',
        }

        # Find the main odds table and map column indices to fighter names
        tables = soup2.select('table') or []
        for table in tables:
            headers_row = table.find('tr')
            if not headers_row:
                continue
            cols = [th.get_text(strip=True) for th in headers_row.find_all(['th', 'td'])]
            f1_col = next((i for i, c in enumerate(cols) if n1_last in _norm(c)), None)
            f2_col = next((i for i, c in enumerate(cols) if n2_last in _norm(c)), None)
            if f1_col is None or f2_col is None:
                continue

            for row in table.find_all('tr')[1:]:
                cells = row.find_all(['td', 'th'])
                row_label = _norm(cells[0].get_text()) if cells else ''

                def _cell(idx):
                    if idx < len(cells):
                        return cells[idx].get_text(strip=True) or 'N/A'
                    return 'N/A'

                if 'moneyline' in row_label or 'ml' == row_label or row_label == '':
                    odds['fighter1_moneyline'] = _cell(f1_col)
                    odds['fighter2_moneyline'] = _cell(f2_col)
                elif 'over' in row_label or 'under' in row_label or 'total' in row_label:
                    odds['over_under_rounds'] = _cell(0)
                    odds['over_odds']  = _cell(f1_col)
                    odds['under_odds'] = _cell(f2_col)
                elif 'ko' in row_label or 'tko' in row_label or 'finish' in row_label:
                    odds['fighter1_ko_odds'] = _cell(f1_col)
                    odds['fighter2_ko_odds'] = _cell(f2_col)
                elif 'decision' in row_label or 'dec' in row_label:
                    odds['fighter1_decision_odds'] = _cell(f1_col)
                    odds['fighter2_decision_odds'] = _cell(f2_col)
            break  # found and processed the main table

        print(f"  ✅ Odds for {matchup}: ML {odds['fighter1_moneyline']} / {odds['fighter2_moneyline']}")
        return odds

    except Exception as e:
        print(f"  ❌ Error scraping BestFightOdds for '{matchup}': {e}")
        return {}


# ── Future scraper stubs ──────────────────────────────────────────────────────
# These are placeholders for potential future data sources.  Not called by the
# main pipeline today.

def scrape_fightmatrix_fighter_data(dk_name):
    print(f"TODO: Implement real FightMatrix scraping for {dk_name}")
    return {}


def scrape_espn_fighter_data(dk_name):
    print(f"TODO: Implement real ESPN MMA scraping for {dk_name}")
    return {}
