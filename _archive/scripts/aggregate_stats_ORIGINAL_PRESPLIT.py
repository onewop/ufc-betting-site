import pandas as pd
import json
import os
import datetime
import shutil
import unicodedata
from fuzzywuzzy import process, fuzz
import requests
from bs4 import BeautifulSoup
import time
import re
from urllib.parse import quote_plus
import random

def normalize_name(name):
    """Aggressively normalize fighter name for matching"""
    if pd.isna(name):
        return ""
    
    # Convert to lowercase and strip
    name = str(name).lower().strip()
    
    # Remove accents (é, á, ü, ö, etc.)
    name = ''.join(
        c for c in unicodedata.normalize('NFD', name)
        if unicodedata.category(c) != 'Mn'
    )
    
    # Remove common suffixes and prefixes
    name = name.replace('jr.', '').replace('jr', '')
    name = name.replace('sr.', '').replace('sr', '')
    name = name.replace('iii', '').replace('ii', '').replace('iv', '')
    name = name.replace('de ', '')  # Spanish/Portuguese particle
    
    # Remove punctuation
    name = name.replace('.', '').replace('-', ' ').replace(',', '')
    
    # Remove extra whitespace
    name = ' '.join(name.split())
    
    return name

def extract_ufcstats_id(url):
    """Extract UFCStats ID from URL like 'http://ufcstats.com/fighter-details/93fe7332d16c6ad9'"""
    if pd.isna(url):
        return None
    try:
        url_str = str(url).strip()
        # ID is the last part after /fighter-details/
        if '/fighter-details/' in url_str:
            return url_str.split('/fighter-details/')[-1]
    except:
        pass
    return None

def save_to_json(data, output_path="public/this_weeks_stats.json"):
    """Save data to JSON with timestamped backup"""
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    if os.path.exists(output_path):
        archive_dir = "public/archive"
        os.makedirs(archive_dir, exist_ok=True)
        timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
        backup_path = f"{archive_dir}/this_weeks_stats-backup-{timestamp}.json"
        shutil.copy(output_path, backup_path)
        print(f"Backed up existing file to {backup_path}")
    with open(output_path, "w") as f:
        json.dump(data, f, indent=2)
    print(f"Saved data to {output_path}")

def scrape_sherdog_event_card(event_url):
    """
    Scrape the Sherdog event page for a UFC card and return a lookup dict.

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
    Fighters are matched to DK names with simple last-name + fuzzy fallback.
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
        name = name.lower()
        name = re.sub(r"\b(jr\.?|sr\.?|de|da|dos|das)\b", "", name)
        name = re.sub(r"[^a-z0-9 ]", "", name)
        return " ".join(name.split())

    try:
        print(f"\n🌐 Fetching Sherdog event page: {event_url}")
        resp = requests.get(event_url, headers=headers, timeout=15)
        resp.raise_for_status()
        soup = BeautifulSoup(resp.content, "html.parser")

        # Event name — <span itemprop="name"> inside .fight-card-header or <h1>
        event_name = ""
        for sel in ['[itemprop="name"]', 'h1.fight-card-header', 'h1']:
            el = soup.select_one(sel)
            if el:
                event_name = el.get_text(strip=True)
                if event_name:
                    break

        print(f"  📅 Event: {event_name or '(name not found)'}")

        # Fighters are in <a href="/fighter/..."> links inside the fight card table.
        # Each link wraps the fighter's name; the record "W-L-D" sits nearby.
        card = {}  # normalized_name → fighter dict

        # Strategy: find every fighter <a href="/fighter/..."> on the page,
        # grab the name text and try to find the adjacent record "(W-L-D)" text.
        for a in soup.select("a[href^='/fighter/']"):
            sherdog_name = a.get_text(strip=True)
            if not sherdog_name or len(sherdog_name) < 2:
                continue
            profile_url = "https://www.sherdog.com" + a["href"]

            # Look for a record near this link — typically in a sibling/parent span
            record_str = ""
            wins = losses = draws = 0
            # Walk up a few levels to find a record pattern like "19-6-0"
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


def _match_sherdog_card(dk_name, card):
    """
    Look up a DK fighter name in the pre-loaded Sherdog event card dict.
    Tries last-name exact match first, then full-name fuzzy.
    Returns the card entry dict or None.
    """
    def _norm(name):
        name = name.lower()
        name = re.sub(r"\b(jr\.?|sr\.?|de|da|dos|das)\b", "", name)
        name = re.sub(r"[^a-z0-9 ]", "", name)
        return " ".join(name.split())

    norm_q = _norm(dk_name)
    # Direct hit
    if norm_q in card:
        return card[norm_q]
    # Last-name match
    last = norm_q.split()[-1] if norm_q else ""
    last_hits = [v for k, v in card.items() if k.split()[-1] == last]
    if len(last_hits) == 1:
        return last_hits[0]
    # Fuzzy fallback
    best_score, best = 0, None
    for norm_key, entry in card.items():
        score = fuzz.token_sort_ratio(norm_q, norm_key)
        if score > best_score:
            best_score, best = score, entry
    if best_score >= 72:
        return best
    return None


def scrape_sherdog_fighter_data(fighter_name, profile_url=None):
    """
    Scrape Sherdog data for a fighter using their DK name.

    Search URL: https://www.sherdog.com/stats/fightfinder?SearchTxt={query}&action=search
    Results table has fighter links (a[href^='/fighter/']); fuzzy-match by name.
    Profile fields extracted via itemprop attributes and regex on .fighter-info text.

    If profile_url is supplied (e.g. from scrape_sherdog_event_card), the search
    step is skipped and the profile page is fetched directly — saving ~1 request
    and the associated sleep delay per fighter.

    Returns a dict with keys from get_empty_sherdog_data() plus:
      dob, height, weight, nationality, team (all strings).
    Returns get_empty_sherdog_data() on failure.
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
            # Direct profile URL supplied — skip search entirely
            print(f"  📄 Sherdog direct profile: {fighter_name} → {profile_url}")
        else:
            from urllib.parse import quote_plus
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

            # Results are in a <table> with rows linking to /fighter/ pages.
            # Collect all candidate (name, href) pairs and fuzzy-match to dk name.
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

            if best_score < 72 or not profile_url:
                # Retry without name suffixes (Jr., Sr., II, III) — Sherdog often
                # omits these, e.g. "Michael Aswell Jr." → "Michael Aswell"
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

        # ── Fetch profile page ────────────────────────────────────────────────
        resp2 = requests.get(profile_url, headers=headers, timeout=12)
        resp2.raise_for_status()
        time.sleep(random.uniform(3, 6))
        soup2 = BeautifulSoup(resp2.content, "html.parser")

        data = get_empty_sherdog_data()

        # Record: "21-11-0 (WIN-LOSS-DRAW)"
        rec_el = soup2.select_one(".record")
        if rec_el:
            rec_text = rec_el.get_text(strip=True)
            m = re.match(r"(\d+)-(\d+)-(\d+)", rec_text)
            if m:
                data["sherdog_record"] = f"{m.group(1)}-{m.group(2)}-{m.group(3)}"
            else:
                data["sherdog_record"] = rec_text.split("(")[0].strip()

        # Bio fields via itemprop
        def _itemprop(prop):
            el = soup2.select_one(f'[itemprop="{prop}"]')
            return el.get_text(strip=True) if el else "N/A"

        data["dob"]         = _itemprop("birthDate")
        data["height"]      = _itemprop("height")
        data["weight"]      = _itemprop("weight")
        data["nationality"] = _itemprop("nationality")

        # Nickname: <span class="nickname"><em>"The Eagle"</em></span>
        nick_el = soup2.select_one(".nickname em") or soup2.select_one(".nickname")
        if nick_el:
            nick_text = nick_el.get_text(strip=True).strip('"\' ')
            data["nickname"] = nick_text if nick_text else None
        else:
            data["nickname"] = None

        # Team / gym: first memberOf name
        member_names = [
            el.get_text(strip=True)
            for el in soup2.select('[itemprop="memberOf"] [itemprop="name"]')
        ]
        data["team"] = member_names[0] if member_names else "N/A"

        # Wins / losses breakdown — parse from .fighter-info plain text
        fi_text = soup2.select_one(".fighter-info")
        fi_text = fi_text.get_text(" ", strip=True) if fi_text else ""

        def _parse_breakdown_section(label):
            """
            Extracts KO/TKO, submission, decision counts from a section like:
            "Wins 21 KO / TKO 5 24% SUBMISSIONS 2 10% DECISIONS 14 67%"
            """
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

        # ── Fight history (full career from Sherdog profile) ───────────────
        # Identify amateur rows: any fight_history section whose nearest preceding
        # heading contains "AMATEUR" is the amateur section.
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
            # Opponent
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
                # Strip "VIEW PLAY-BY-PLAY" and anything after referee name pattern
                raw_method = re.sub(r'\s*VIEW PLAY-BY-PLAY.*', '', raw_method, flags=re.IGNORECASE).strip()
                # If it contains a parenthesized detail, split it out
                m2 = re.match(r'^(.+?\))\s*(.*)', raw_method)
                fmethod = m2.group(1).strip() if m2 else raw_method
                sub_el = method_col.select_one('.sub_line')
                fmethod_detail = sub_el.get_text(strip=True) if sub_el else (m2.group(2).strip() if m2 else '')
            else:
                fmethod = ''
                fmethod_detail = ''
            # Event + Date — new Sherdog layout combines them in one td (no class)
            ev_col = frow.select_one('td.col_event')
            # Fallback: positional td[2] (new layout: event+date combined)
            if not ev_col and len(fcols) > 2:
                ev_col = fcols[2]
            fevent = ''
            fdate_str = ''
            if ev_col:
                ev_text = ev_col.get_text(' ', strip=True)
                # Try to split date (e.g. "Sep / 09 / 2025" or "Sep 09, 2025")
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
            # Date, Round, Time — class-based first, then positional fallback
            fdate_el  = (frow.select_one('td.col_date')  or frow.select_one('td[class*="date"]'))
            fround_el = (frow.select_one('td.col_round') or frow.select_one('td[class*="round"]'))
            ftime_el  = (frow.select_one('td.col_time')  or frow.select_one('td[class*="time"]'))
            # Positional fallback for new layout: round=td[4], time=td[5]
            if not fdate_el and not fdate_str and len(fcols) > 2:
                fdate_str = ''  # already extracted above from ev_col
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

def get_empty_sherdog_data():
    """Return empty Sherdog data structure with N/A fallbacks"""
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

# Mapping: DK ID (str) → UFCStats ID (str)
# To find UFCStats IDs:
# 1. Go to ufcstats.com/fighter-details/[ID]
# 2. Get the [ID] part from the URL
# 3. Or extract from ufc_fighter_details.csv/ufc_fighter_tott.csv 'URL' column
#
# TODO: Populate with real IDs for current card (20-24 fighters)
id_mapping = {
    # "42160385": "93fe7332d16c6ad9",  # Example format - DK ID → UFCStats ID
    # Add all fighter IDs from DK CSV here...
}


def _parse_of(cell_text):
    """Parse UFCStats 'X of Y' cell text → (landed, attempted). Returns (0,0) on failure."""
    m = re.match(r'(\d+)\s+of\s+(\d+)', cell_text.strip(), re.IGNORECASE)
    return (int(m.group(1)), int(m.group(2))) if m else (0, 0)


def scrape_betting_odds(matchup):
    """
    Scrape moneyline + over/under odds from BestFightOdds for one matchup.
    matchup format: "Fighter A vs. Fighter B"
    Returns: {
        fighter1_name, fighter2_name,
        fighter1_moneyline, fighter2_moneyline,
        over_under_rounds, over_odds, under_odds,
        fighter1_ko_odds, fighter2_ko_odds,
        fighter1_decision_odds, fighter2_decision_odds
    } or {} on failure.
    """
    import re
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

    # Extract the two fighter names from "A vs. B"
    parts = [p.strip() for p in re.split(r' vs\.? ', matchup, maxsplit=1)]
    if len(parts) != 2:
        print(f"  ⚠️  Cannot parse matchup: '{matchup}'")
        return {}
    name1, name2 = parts

    try:
        # BestFightOdds uses a query string for search
        query = name1.split()[-1]  # last name of fighter 1 usually sufficient
        url = f"https://www.bestfightodds.com/search?query={quote_plus(query)}"
        print(f"  🔍 BestFightOdds search: {url}")
        session = requests.Session()
        session.headers.update(headers)
        # Prime session with homepage
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

        # Look for an event/fight link whose text contains both fighter last names
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

        # BestFightOdds renders odds in a table with class 'odds-table' or similar.
        # Each row is a market (Moneyline, Over/Under, KO, etc.).
        # Fighter names appear as column headers; odds are in <td class="odds-td">.
        # Strategy: find all table rows, look for fighter-name headers to map columns,
        # then extract moneyline row values.
        tables = soup2.select('table') or []
        for table in tables:
            headers_row = table.find('tr')
            if not headers_row:
                continue
            cols = [th.get_text(strip=True) for th in headers_row.find_all(['th', 'td'])]
            # Map column index to fighter
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
            break  # found and processed main table

        print(f"  ✅ Odds for {matchup}: ML {odds['fighter1_moneyline']} / {odds['fighter2_moneyline']}")
        return odds

    except Exception as e:
        print(f"  ❌ Error scraping BestFightOdds for '{matchup}': {e}")
        return {}


def scrape_fightmatrix_fighter_data(dk_name):
    print(f"TODO: Implement real FightMatrix scraping for {dk_name}")
    return {}

def scrape_espn_fighter_data(dk_name):
    print(f"TODO: Implement real ESPN MMA scraping for {dk_name}")
    return {}

def scrape_ufcstats_fighter(dk_name):
    """
    Scrape UFCStats.com for a fighter's career stat page.
    Returns a dict with keys:
      td_defense (str, e.g. "64%"), striking_defense (str, e.g. "57%"),
      sub_avg (float), slpm (float), sapm (float), str_acc (float), td_avg (float)
    Returns {} on failure or no match.

    Source: http://ufcstats.com/statistics/fighters?action=search&...
    This is the official UFC stat database — fully public, no auth required.
    Polite delays are included to avoid hammering the server.
    """
    parts = dk_name.strip().split()
    if not parts:
        return {}
    first = parts[0]
    last  = parts[-1] if len(parts) > 1 else ''

    # Strip name suffixes (Jr., Sr., II, III, IV) before choosing the char= letter,
    # because UFCStats indexes fighters by their actual last name, not the suffix.
    # e.g. "Michael Aswell Jr." → last="Jr." → char='j' is WRONG; should be 'a'.
    _SUFFIXES = {'jr', 'jr.', 'sr', 'sr.', 'ii', 'iii', 'iv'}
    name_for_char = [p for p in parts if p.lower() not in _SUFFIXES]
    last_for_char = name_for_char[-1] if len(name_for_char) > 1 else (name_for_char[0] if name_for_char else last)

    try:
        # Use the char= browse endpoint (first letter of last name).
        # The ?action=search endpoint ignores its parameters server-side and
        # always returns the default 'A' alphabetical page, so it only works
        # for fighters whose last name starts with 'A'. char= is reliable.
        # Reuse the shared _perfight_get cache so fighters already scraped by
        # SCRAPE_PERFIGHT don't require additional network requests here.
        char = (last_for_char[0] if last_for_char else first[0]).lower()
        search_url = f"http://ufcstats.com/statistics/fighters?char={char}&page=all"
        print(f"  🔍 UFCStats browse (char={char}): {dk_name}")
        html = _perfight_get(search_url)
        if not html:
            return {}
        soup = BeautifulSoup(html, 'html.parser')

        def _norm(s):
            return re.sub(r'[^a-z]', '', s.lower())

        norm_q = _norm(dk_name)

        # Find best matching fighter link in results table
        profile_url = None
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

        # Fallback: fuzzy — pick the closest name in results
        if not profile_url:
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

        # Fetch fighter profile page (reuses shared _perfight_get cache — zero
        # extra requests if SCRAPE_PERFIGHT already ran for this fighter)
        if not profile_url.startswith('http'):
            profile_url = 'http://ufcstats.com' + profile_url
        html2 = _perfight_get(profile_url)
        if not html2:
            return {}
        soup2 = BeautifulSoup(html2, 'html.parser')

        # UFCStats profile page has a stat box:
        # <li class="b-list__box-list-item ...">
        #   <i class="b-list__box-item-title ...">SLpM:</i> 3.43
        # Pattern: find all stat items and build a dict label → value
        stats_out = {}
        for item in soup2.select('li.b-list__box-list-item'):
            label_el = item.select_one('i.b-list__box-item-title')
            if not label_el:
                continue
            label = label_el.get_text(strip=True).rstrip(':').lower()
            # Value is the text after removing the label
            label_el.extract()
            value = item.get_text(strip=True)
            stats_out[label] = value

        def _pct(val):
            """Convert '64%' → 64.0 or return 'N/A'"""
            if not val or val in ('--', ''):
                return 'N/A'
            val = str(val).replace('%', '').strip()
            try:
                return float(val)
            except ValueError:
                return 'N/A'

        def _num(val):
            if not val or val in ('--', ''):
                return None
            try:
                return float(str(val).replace('%', '').strip())
            except ValueError:
                return None

        # Extract nickname and record from page header — not in the stat box
        nick_el   = soup2.find('p', class_='b-content__Nickname')
        rec_el    = soup2.find('span', class_='b-content__title-record')
        nickname  = nick_el.get_text(strip=True) if nick_el else None
        record_raw = rec_el.get_text(strip=True).replace('Record:', '').strip() if rec_el else None

        result = {
            'td_defense':       stats_out.get('td def.', stats_out.get('td def', 'N/A')),
            'striking_defense': stats_out.get('str. def', stats_out.get('str def', 'N/A')),
            'sub_avg':          _num(stats_out.get('sub. avg.', stats_out.get('sub avg', None))),
            'slpm':             _num(stats_out.get('slpm')),
            'sapm':             _num(stats_out.get('sapm')),
            'str_acc':          _num(stats_out.get('str. acc.', stats_out.get('str acc', None))),
            'td_avg':           _num(stats_out.get('td avg.', stats_out.get('td avg', None))),
            'td_acc':           _num(stats_out.get('td acc.', stats_out.get('td acc', None))),
            # Bio fields – already on the same page, zero extra requests
            'height':   stats_out.get('height', 'N/A'),
            'reach':    stats_out.get('reach',  'N/A'),
            'stance':   stats_out.get('stance', 'N/A').title() if stats_out.get('stance') else 'N/A',
            'dob':      stats_out.get('dob',    'N/A'),
            'nickname': nickname,
            'record':   record_raw,
            'weight_lbs': stats_out.get('weight', None),  # e.g. '115 lbs.'
        }
        print(f"  ✅ UFCStats stats for '{dk_name}': {result}")
        return result

    except Exception as e:
        print(f"  ❌ UFCStats error for '{dk_name}': {e}")
        return {}


# ---------------------------------------------------------------------------
# UFCStats per-fight scraper: KD + CTRL time (last N fights)
# ---------------------------------------------------------------------------
_PERFIGHT_CACHE_PATH = os.path.join(
    os.path.dirname(__file__), '..', 'public', 'ufcstats_perfight_cache.json'
)
_PERFIGHT_ALPHA_URL  = 'http://ufcstats.com/statistics/fighters?char={letter}&page=all'
_PERFIGHT_HEADERS    = {
    'User-Agent': (
        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 '
        '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
    ),
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.5',
}
_PERFIGHT_FIGHT_LIMIT   = 5      # analyze last N completed fights
_PERFIGHT_DELAY_MIN     = 8.0
_PERFIGHT_DELAY_MAX     = 15.0
_PERFIGHT_FUZZY_MIN     = 72

_perfight_cache = None  # lazy-loaded once per run


def _perfight_load_cache():
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
    global _perfight_cache
    if _perfight_cache is None:
        return
    path = os.path.normpath(_PERFIGHT_CACHE_PATH)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(_perfight_cache, f, indent=1)


def _perfight_get(url):
    """Fetch url, caching the result.  Always adds a polite delay on live fetches."""
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


def _ctrl_to_secs(ctrl_str):
    try:
        m, s = ctrl_str.strip().split(':')
        return int(m) * 60 + int(s)
    except Exception:
        return 0


def scrape_ufcstats_perfight(dk_name):
    """
    Scrape UFCStats for a fighter's last _PERFIGHT_FIGHT_LIMIT completed fights.
    Aggregates avg_kd_per_fight, avg_ctrl_secs, grappling_control_pct.
    All network fetches are cached to avoid re-scraping.
    Returns dict or {} on failure.
    """
    from fuzzywuzzy import fuzz as _fuzz

    parts = dk_name.strip().split()
    letter = (parts[-1][0] if parts and parts[-1] else 'a').lower()
    if not letter.isalpha():
        letter = 'a'

    # ── find profile URL ──────────────────────────────────────────────────
    alpha_html = _perfight_get(_PERFIGHT_ALPHA_URL.format(letter=letter))
    if not alpha_html:
        return {}

    soup = BeautifulSoup(alpha_html, 'html.parser')
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

    # ── fetch profile for fight history ──────────────────────────────────
    profile_html = _perfight_get(best_url)
    if not profile_html:
        return {}

    psoup = BeautifulSoup(profile_html, 'html.parser')
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

        # determine which <p> index is our fighter
        name_ps = cells[1].find_all('p')
        our_idx = 0
        if name_ps:
            name0 = name_ps[0].get_text(strip=True)
            if _fuzz.token_sort_ratio(dk_name.lower(), name0.lower()) < 60:
                our_idx = 1

        # KD
        kd_ps = cells[2].find_all('p')
        if kd_ps and len(kd_ps) > our_idx:
            kd_raw = kd_ps[our_idx].get_text(strip=True)
            our_kd = int(kd_raw) if kd_raw.isdigit() else 0
        else:
            kd_parts = cells[2].get_text(' ', strip=True).split()
            our_kd = int(kd_parts[our_idx]) if len(kd_parts) > our_idx and kd_parts[our_idx].isdigit() else 0

        # total fight time in seconds
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

    # ── per-fight CTRL from fight detail pages ────────────────────────────
    ctrl_times, kd_total, time_total = [], 0, 0
    head_l_tot = head_a_tot = 0
    body_l_tot = body_a_tot = 0
    leg_l_tot  = leg_a_tot  = 0
    dist_l_tot = dist_a_tot = 0
    clinch_l_tot = clinch_a_tot = 0
    ground_l_tot = ground_a_tot = 0

    for fight in fights:
        fight_html = _perfight_get(fight['fight_url'])
        ctrl_secs = 0
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

            # ── Significant strikes by target / position (table index 2) ────
            # Columns: 0=Fighter 1=SigStr 2=SigStr% 3=Head 4=Body 5=Leg
            #          6=Distance 7=Clinch 8=Ground
            if len(tables) >= 3:
                sig_rows = tables[2].find_all('tr')
                if len(sig_rows) >= 2:
                    sc = sig_rows[1].find_all('td')

                    def _get_of(col_idx, our_idx=fight['our_idx']):
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

    # Strike distribution: % of landed sig strikes by target and position
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



# ---------------------------------------------------------------------------
# UFCStats defensive grappling scraper
# Extracts — from the same per-fight detail pages used by scrape_ufcstats_perfight
# (all results served from the shared _perfight_get cache, so if SCRAPE_PERFIGHT
# already ran there are zero extra network requests):
#
#   avg_opp_ctrl_secs       — seconds/fight the OPPONENT controlled this fighter
#   avg_reversals_per_fight — bottom→top transitions per fight (escape activity)
#   implied_sub_def_pct     — (opp_sub_att - subs_conceded) / opp_sub_att × 100
#   opp_sub_attempts_vs     — raw opp sub attempts over analyzed fights
#   subs_conceded           — fights lost by submission
#
# NOTE: No public source (UFCStats, Sherdog, Tapology) publishes a formal
# "Submission Defense %" column.  implied_sub_def_pct is derived from fight-level
# data and is the closest honest proxy available.
# ---------------------------------------------------------------------------
def scrape_ufcstats_def_grappling(dk_name):
    """
    Scrape defensive grappling metrics for *dk_name* from UFCStats fight detail
    pages (last _PERFIGHT_FIGHT_LIMIT completed fights).
    All HTTP fetches go through _perfight_get() — results are permanently cached,
    so running SCRAPE_DEF_GRAPPLING after SCRAPE_PERFIGHT costs zero extra requests.

    Returns dict with keys:
        avg_opp_ctrl_secs, avg_reversals_per_fight, implied_sub_def_pct,
        opp_sub_attempts_vs, subs_conceded, def_fights_analyzed
    or {} on failure.
    """
    from fuzzywuzzy import fuzz as _fuzz

    parts = dk_name.strip().split()
    letter = (parts[-1][0] if parts and parts[-1] else 'a').lower()
    if not letter.isalpha():
        letter = 'a'

    # ── Locate fighter profile URL (same browse-page logic as scrape_ufcstats_perfight) ──
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
        print(f"  \u2717 def-grappling: no profile for '{dk_name}' (best score {best_score})")
        return {}

    # ── Fetch fighter profile to get fight history ────────────────────────────
    profile_html = _perfight_get(best_url)
    if not profile_html:
        return {}

    psoup  = BeautifulSoup(profile_html, 'html.parser')
    ptable = psoup.find('table', class_='b-fight-details__table')
    if not ptable:
        return {}

    # ── Collect fight detail URLs (up to _PERFIGHT_FIGHT_LIMIT) ──────────────
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

    # ── Per-fight detail extraction ───────────────────────────────────────────
    # UFCStats fight detail "Totals" table cell layout (each <td> has two <p>
    # tags — one per fighter — indexed by our_idx / opp_idx):
    #   dcells[0]  Fighter names
    #   dcells[1]  KD
    #   dcells[2]  Sig.Str
    #   dcells[3]  Sig.Str %
    #   dcells[4]  Total Str
    #   dcells[5]  TD
    #   dcells[6]  TD %
    #   dcells[7]  Sub.Att  ← opponent's attempts against us  (opp_idx)
    #   dcells[8]  Rev.     ← our reversals / escapes         (our_idx)
    #   dcells[9]  CTRL     ← opponent's control time over us (opp_idx)

    def _cell_int(dcells, col, fighter_idx):
        """Return int from dcells[col] for fighter_idx (0 or 1), 0 on failure."""
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

            # Was this fight lost by submission? Check fight detail page method header.
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
    implied_sub_def = None
    if opp_sub_total > 0:
        defended        = max(opp_sub_total - subs_conceded, 0)
        implied_sub_def = round(defended / opp_sub_total * 100, 1)
    elif n > 0:
        # No sub attempts recorded against this fighter across analyzed fights →
        # they have effectively defended 100% of all (zero) attempts.
        # This avoids null for most strikers who simply have never been sub-targeted.
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
        f"  \u2713 def-grappling '{dk_name}': "
        f"opp_ctrl={result['avg_opp_ctrl_secs']}s  "
        f"rev={result['avg_reversals_per_fight']}/fight  "
        f"implied_sub_def={result['implied_sub_def_pct']}%  "
        f"opp_sub_att={opp_sub_total}  subs_conceded={subs_conceded}  "
        f"({n} fights)"
    )
    return result

def csv_to_json(
    dk_path="DKSalaries.csv",  # Changed to current directory (no ../)
    fighter_details_path="../scrape_ufc_stats/ufc_fighter_details.csv",
    fighter_tott_path="../scrape_ufc_stats/ufc_fighter_tott.csv",
    output_path="public/this_weeks_stats.json"
):
    try:
        print("Loading DKSalaries.csv from:", dk_path)
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


        data = {
            "event": {
                "name": event_card_name if (os.environ.get('SHERDOG_EVENT_URL') and event_card_name) else "UFC Fight Night",
                "date": event_date_str,
                "location": "Las Vegas, Nevada, USA"
            },
            "fights": fights
        }

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