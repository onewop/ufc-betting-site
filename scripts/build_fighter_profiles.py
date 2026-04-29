"""
scripts/build_fighter_profiles.py — Combat Dossier data pipeline.

Scrapes all current + recent UFC fighters from UFCStats + Sherdog, fetches
official portrait URLs from UFC.com, and builds two output files:

  public/fighters_index.json          — lightweight directory (name, slug, record, etc.)
  public/fighter_profiles/{slug}.json — full profile per fighter

Data sources (reuses existing cached scrapers — zero extra HTTP for cached pages):
  • UFCStats — career stats (SLpM, SApM, TD avg/def, striking defense, etc.)
  • Sherdog  — fight history, nationality, team, nickname, bio
  • UFC.com  — official high-res portrait image URL

Usage:
  # First run (full scrape, 2-4 hours unattended due to polite delays):
  cd ufc-betting-site-main
  python3 scripts/build_fighter_profiles.py

  # Test with first 20 fighters only:
  python3 scripts/build_fighter_profiles.py --limit 20

  # Force re-scrape even for cached fighters:
  python3 scripts/build_fighter_profiles.py --refresh

  # Build index only (no re-scraping, just rebuild index from existing profiles):
  python3 scripts/build_fighter_profiles.py --index-only

  # Target a specific fighter by name:
  python3 scripts/build_fighter_profiles.py --fighter "Carlos Prates"

Output structure (fighter_profiles/{slug}.json):
  {
    "slug": "carlos-prates",
    "name": "Carlos Prates",
    "nickname": "The Natural Born Killer",
    "record": "23-7-0",
    "wins": 23, "losses": 7, "draws": 0,
    "weight_class": "Welterweight",
    "nationality": "Brazil",
    "team": "American Top Team",
    "height": "6' 0\"",
    "reach": "76\"",
    "stance": "Southpaw",
    "dob": "Oct 12, 1993",
    "age": 32,
    "ufc_image_url": "https://dmxg5wxfqgb4u.cloudfront.net/...",
    "ufcstats_url": "http://ufcstats.com/fighter-details/...",
    "sherdog_url": "https://www.sherdog.com/fighter/...",
    "stats": { "slpm": 4.5, "sapm": 3.1, ... },
    "fight_history": [ { "result": "win", "opponent": "...", ... } ],
    "wins_ko_tko": 10, "wins_submission": 5, "wins_decision": 8,
    "finish_rate_pct": 65.2,
    "avg_sub_attempts": 0.5,
    "last_updated": "2026-04-28T12:00:00"
  }
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
import time
import random
from datetime import datetime, date
from pathlib import Path

# ── Path setup ─────────────────────────────────────────────────────────────
SCRIPT_DIR = Path(__file__).resolve().parent
REPO_ROOT   = SCRIPT_DIR.parent
PUBLIC_DIR  = REPO_ROOT / "public"
PROFILES_DIR = PUBLIC_DIR / "fighter_profiles"

# Make sure the scripts directory is on sys.path so we can import the scrapers
sys.path.insert(0, str(SCRIPT_DIR))

from bs4 import BeautifulSoup
from fuzzywuzzy import fuzz

# Import existing HTTP cache — zero re-scraping cost for already-cached pages
from ag_perfight import _perfight_get

INDEX_PATH   = PUBLIC_DIR / "fighters_index.json"
CACHE_PATH   = PUBLIC_DIR / "ufcstats_perfight_cache.json"  # existing cache

# ── Helpers ─────────────────────────────────────────────────────────────────

def to_slug(name: str) -> str:
    """'Carlos Prates' → 'carlos-prates'"""
    s = name.lower()
    s = re.sub(r"[^a-z0-9\s-]", "", s)
    s = re.sub(r"\s+", "-", s.strip())
    return s


def calc_age(dob_str: str) -> int | None:
    """'Oct 12, 1993' → 32"""
    if not dob_str or dob_str == "N/A":
        return None
    MONTHS = {
        "jan": 1, "feb": 2, "mar": 3, "apr": 4, "may": 5, "jun": 6,
        "jul": 7, "aug": 8, "sep": 9, "oct": 10, "nov": 11, "dec": 12,
    }
    try:
        parts = dob_str.replace(",", "").split()
        if len(parts) == 3:
            month = MONTHS.get(parts[0][:3].lower(), 0)
            day   = int(parts[1])
            year  = int(parts[2])
            today = date.today()
            age   = today.year - year - ((today.month, today.day) < (month, day))
            return age
    except Exception:
        pass
    return None


def parse_record(record_str: str) -> dict:
    """'14-3-0' → {wins:14, losses:3, draws:0}"""
    if not record_str:
        return {"wins": 0, "losses": 0, "draws": 0}
    m = re.match(r"(\d+)-(\d+)-(\d+)", record_str)
    if m:
        return {"wins": int(m.group(1)), "losses": int(m.group(2)), "draws": int(m.group(3))}
    return {"wins": 0, "losses": 0, "draws": 0}


def compute_finish_stats(fight_history: list) -> dict:
    """Compute finish rate and method breakdown from fight history."""
    pro = [f for f in fight_history if f.get("fight_type") == "pro"]
    wins = [f for f in pro if f.get("result") == "win"]
    total = len(pro)

    ko_tko_wins  = sum(1 for f in wins if re.search(r"\bKO\b|\bTKO\b", f.get("method", ""), re.I))
    sub_wins     = sum(1 for f in wins if re.search(r"submission", f.get("method", ""), re.I))
    dec_wins     = len(wins) - ko_tko_wins - sub_wins
    finish_rate  = round((ko_tko_wins + sub_wins) / len(wins) * 100, 1) if wins else 0.0

    return {
        "wins_ko_tko":      ko_tko_wins,
        "wins_submission":  sub_wins,
        "wins_decision":    max(0, dec_wins),
        "finish_rate_pct":  finish_rate,
    }


def compute_win_streak(fight_history: list) -> dict:
    """Compute current win/loss streak and last 5 record from fight history."""
    pro = [f for f in fight_history if f.get("fight_type") == "pro"]
    if not pro:
        return {"current_win_streak": 0, "current_loss_streak": 0, "record_last_5": "0-0"}

    win_streak = loss_streak = 0
    for fight in pro:
        result = fight.get("result", "")
        if win_streak == 0 and loss_streak == 0:
            if result == "win":
                win_streak = 1
            elif result == "loss":
                loss_streak = 1
            else:
                break
        elif win_streak > 0:
            if result == "win":
                win_streak += 1
            else:
                break
        else:
            if result != "win":
                loss_streak += 1
            else:
                break

    last5 = pro[:5]
    wins5 = sum(1 for f in last5 if f.get("result") == "win")
    return {
        "current_win_streak":  win_streak,
        "current_loss_streak": loss_streak,
        "record_last_5":       f"{wins5}-{len(last5) - wins5}",
    }


# ── UFCStats enumeration ────────────────────────────────────────────────────

def enumerate_all_ufcstats_fighters() -> list[dict]:
    """Browse all letters on UFCStats and return {name, profile_url} for every fighter."""
    fighters = []
    seen_urls = set()

    for char in "abcdefghijklmnopqrstuvwxyz":
        url  = f"http://ufcstats.com/statistics/fighters?char={char}&page=all"
        html = _perfight_get(url)
        if not html:
            print(f"  ⚠️  No response for char={char}")
            continue

        soup = BeautifulSoup(html, "html.parser")
        rows = soup.select("table.b-statistics__table tbody tr")
        count = 0
        for row in rows:
            cells = row.find_all("td")
            if len(cells) < 2:
                continue
            fn = cells[0].get_text(strip=True)
            ln = cells[1].get_text(strip=True)
            full_name = f"{fn} {ln}".strip()
            if not full_name or len(full_name) < 3:
                continue

            link = cells[0].find("a") or cells[1].find("a")
            profile_url = None
            if link and link.get("href"):
                href = link["href"]
                if not href.startswith("http"):
                    href = "http://ufcstats.com" + href
                profile_url = href

            if profile_url and profile_url in seen_urls:
                continue
            if profile_url:
                seen_urls.add(profile_url)

            fighters.append({
                "name":        full_name,
                "profile_url": profile_url,
            })
            count += 1

        print(f"  [char={char}] {count} fighters found")

    print(f"\n✅ Total unique fighters from UFCStats: {len(fighters)}")
    return fighters


def scrape_ufcstats_profile_direct(profile_url: str) -> dict:
    """Fetch and parse a UFCStats fighter profile page directly by URL.
    
    Returns dict with: slpm, sapm, str_acc, striking_defense, td_avg, td_acc,
    td_defense, sub_avg, height, reach, stance, dob, nickname, weight_lbs
    """
    html = _perfight_get(profile_url)
    if not html:
        return {}

    soup = BeautifulSoup(html, "html.parser")
    result = {"ufcstats_url": profile_url}

    # ── Header bio ──────────────────────────────────────────────────────────
    nickname_el = soup.select_one("p.b-content__Nickname")
    if nickname_el:
        nick = nickname_el.get_text(strip=True).strip('"').strip("'").strip()
        if nick and nick.lower() != "nickname":
            result["nickname"] = nick

    # ── Stat list items ─────────────────────────────────────────────────────
    LABEL_MAP = {
        "slpm":    "SLpM:",
        "sapm":    "SApM:",
        "str_acc": "Str. Acc.:",
        "striking_defense": "Str. Def:",
        "td_avg":  "TD Avg.:",
        "td_acc":  "TD Acc.:",
        "td_defense": "TD Def.:",
        "sub_avg": "Sub. Avg.:",
        "height":  "Height:",
        "weight_lbs": "Weight:",
        "reach":   "Reach:",
        "stance":  "STANCE:",
        "dob":     "DOB:",
    }

    for li in soup.select("li.b-list__box-list-item"):
        label_el = li.find("i", class_="b-list__box-item-title")
        if not label_el:
            continue
        label_text = label_el.get_text(strip=True)
        value_text = li.get_text(strip=True).replace(label_text, "").strip()

        for key, label in LABEL_MAP.items():
            if label_text.lower().startswith(label.lower().rstrip(":")):
                if value_text and value_text != "--":
                    # Clean numeric values
                    if key in ("slpm", "sapm", "td_avg", "sub_avg"):
                        try:
                            result[key] = float(value_text)
                        except ValueError:
                            pass
                    elif key in ("str_acc", "striking_defense", "td_acc", "td_defense"):
                        result[key] = value_text  # keep as "47%" string
                    elif key == "weight_lbs":
                        m = re.search(r"(\d+)", value_text)
                        if m:
                            result["weight_lbs"] = m.group(1) + " lbs"
                    else:
                        result[key] = value_text
                break

    return result


# ── Portrait images ──────────────────────────────────────────────────────────

def get_sherdog_portrait_url(sherdog_url: str) -> str | None:
    """Scrape the Sherdog fighter profile page to extract the real portrait URL.

    Sherdog used to serve portraits at a predictable /{id}_ff.jpg CDN path, but
    now uses timestamped filenames like /20220922042411_Name_ff.JPG that cannot
    be derived from the profile URL alone.  We must fetch the profile page and
    parse the <img> tag.

    The images are served at https://www.sherdog.com/image_crop/... and require
    NO Referer header (hotlink-blocked when Referer is a foreign domain).  In the
    browser we set referrerpolicy="no-referrer" on the <img> tag to bypass this.

    E.g. https://www.sherdog.com/fighter/Cub-Swanson-11002
             → https://www.sherdog.com/image_crop/200/300/_images/fighter/20220922042411_Cub_Swanson_ff.JPG
    """
    if not sherdog_url:
        return None

    import requests as _requests
    from bs4 import BeautifulSoup as _BS

    headers = {
        "User-Agent": (
            "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
            "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
        ),
        "Accept": "text/html,application/xhtml+xml",
        "Accept-Language": "en-US,en;q=0.9",
        "Referer": "https://www.sherdog.com/",
    }

    # Use the perfight cache so we don't re-fetch pages already in the cache
    try:
        from ag_perfight import _perfight_load_cache, _perfight_save_cache
        cache = _perfight_load_cache()
        cache_key = f"sherdog_portrait__{sherdog_url}"
        if cache_key in cache:
            return cache[cache_key] or None

        import time as _time, random as _random
        _time.sleep(_random.uniform(1.5, 3.5))  # polite delay

        resp = _requests.get(sherdog_url, headers=headers, timeout=15)
        if resp.status_code != 200:
            cache[cache_key] = ""
            _perfight_save_cache()
            return None

        soup = _BS(resp.text, "html.parser")
        # The fighter portrait is at /image_crop/200/300/ (not the 72x72 sidebar thumbnails)
        for img in soup.find_all("img"):
            src = img.get("src", "")
            if "_ff." in src and "/image_crop/200/300/" in src:
                # Make absolute
                portrait = src if src.startswith("http") else f"https://www.sherdog.com{src}"
                cache[cache_key] = portrait
                _perfight_save_cache()
                return portrait

        cache[cache_key] = ""
        _perfight_save_cache()
        return None

    except Exception as e:
        print(f"    [portrait] Error fetching {sherdog_url}: {e}")
        return None


# ── UFC.com headers (full browser fingerprint) ──────────────────────────────
_UFC_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Accept-Encoding": "gzip, deflate, br",
    "Connection": "keep-alive",
    "Upgrade-Insecure-Requests": "1",
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "none",
    "Sec-Fetch-User": "?1",
    "Cache-Control": "max-age=0",
}


def get_ufc_portrait_url(fighter_name: str) -> str | None:
    """Fetch the official portrait URL from UFC.com for a fighter.

    Uses a proper browser-fingerprint session to avoid 403 blocks.
    UFC.com athlete slugs follow: first-last (lowercased, hyphenated).
    The og:image meta tag contains the CDN portrait URL.
    Uses the shared _perfight_get cache so it costs nothing on repeat runs.
    """
    import requests as _requests

    # Build slug variants to try
    slug_base = fighter_name.lower()
    slug_base = re.sub(r"[^a-z0-9\s-]", "", slug_base).strip()
    slug_base = re.sub(r"\s+", "-", slug_base)

    parts = slug_base.split("-")
    slug_variants = [slug_base]
    if len(parts) >= 3:
        slug_variants.append(f"{parts[0]}-{parts[-1]}")
    if len(parts) == 2:
        slug_variants.append(f"{parts[1]}-{parts[0]}")

    # Use a persistent session so cookies/headers carry over
    session = _requests.Session()
    session.headers.update(_UFC_HEADERS)

    for slug in slug_variants:
        url = f"https://www.ufc.com/athlete/{slug}"

        # Check cache first (free)
        from ag_perfight import _perfight_load_cache, _perfight_save_cache
        cache = _perfight_load_cache()
        if url in cache:
            html = cache[url]
        else:
            delay = random.uniform(8.0, 15.0)
            print(f"    [wait {delay:.1f}s] GET {url}")
            time.sleep(delay)
            try:
                resp = session.get(url, timeout=18, allow_redirects=True)
                if resp.status_code == 403:
                    print(f"    [403 blocked] {url}")
                    continue
                resp.raise_for_status()
                html = resp.text
                cache[url] = html
                _perfight_save_cache()
            except Exception as e:
                print(f"    [ERROR] {url}: {e}")
                continue

        if not html:
            continue

        soup = BeautifulSoup(html, "html.parser")

        # Method 1: og:image meta tag
        og = soup.find("meta", property="og:image")
        if og and og.get("content") and "cloudfront" in og["content"]:
            return og["content"]

        # Method 2: athlete hero image
        for selector in [
            ".c-hero--athlete img",
            ".athlete-hero img",
            "[class*='athlete'] img[src*='cloudfront']",
        ]:
            img = soup.select_one(selector)
            if img and img.get("src") and "cloudfront" in img.get("src", ""):
                return img["src"]

    return None


# ── Sherdog scrape (reuse existing, just call it) ───────────────────────────

def safe_sherdog_scrape(fighter_name: str, profile_url: str | None = None) -> dict:
    """Wrapper around ag_sherdog.scrape_sherdog_fighter_data with error handling."""
    try:
        from ag_sherdog import scrape_sherdog_fighter_data
        return scrape_sherdog_fighter_data(fighter_name, profile_url=profile_url)
    except Exception as e:
        print(f"  ⚠️  Sherdog scrape failed for {fighter_name}: {e}")
        return {}


# ── AI track record per fighter ─────────────────────────────────────────────

def build_ai_record_per_fighter(track_record_path: Path) -> dict[str, dict]:
    """Parse track_record.json and build per-fighter AI prediction record.
    
    Returns: { "Carlos Prates": {"picked": 3, "correct": 2, "record": "2-1"} }
    """
    if not track_record_path.exists():
        return {}

    with open(track_record_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    per_fighter: dict[str, dict] = {}

    def _norm(name):
        return re.sub(r"[^a-z]", "", (name or "").lower())

    for event in data.get("events", []):
        for fight in event.get("fights", []):
            bout      = fight.get("bout", "")
            our_pick  = fight.get("our_pick", "")
            result    = fight.get("result")  # None = ungraded
            if result is None:
                continue  # pending, skip

            # Extract both fighter names from "Fighter A vs. Fighter B"
            vs_match = re.split(r"\s+vs\.?\s+", bout, flags=re.I)
            if len(vs_match) != 2:
                continue
            f1_name, f2_name = vs_match[0].strip(), vs_match[1].strip()

            # Record the pick for the chosen fighter
            pick_norm   = _norm(our_pick)
            result_norm = _norm(result)
            correct     = pick_norm == result_norm

            for fighter_name in [f1_name, f2_name]:
                fn = _norm(fighter_name)
                if fn not in per_fighter:
                    per_fighter[fn] = {
                        "name":    fighter_name,
                        "picked":  0,
                        "correct": 0,
                        "record":  "0-0",
                    }
                # Only the picked fighter gets a record entry
                if _norm(fighter_name) == pick_norm:
                    per_fighter[fn]["picked"]  += 1
                    if correct:
                        per_fighter[fn]["correct"] += 1

    # Format records
    for fn, rec in per_fighter.items():
        p, c = rec["picked"], rec["correct"]
        rec["record"] = f"{c}-{p - c}"

    return per_fighter


# ── Main build loop ─────────────────────────────────────────────────────────

def build_all_profiles(
    limit:        int  | None = None,
    refresh:      bool        = False,
    fighter_name: str | None  = None,
    index_only:   bool        = False,
    active_only:  bool        = False,
) -> None:
    PROFILES_DIR.mkdir(parents=True, exist_ok=True)

    # Load existing track record for AI pick history
    ai_records = build_ai_record_per_fighter(PUBLIC_DIR / "track_record.json")
    print(f"📊 Loaded AI pick records for {len(ai_records)} fighters")

    if index_only:
        print("🗂  --index-only: rebuilding index from existing profiles...")
        _rebuild_index_only()
        return

    # ── Load seed data from ufc-master.csv (if available) ─────────────────
    # fighters_active.json is produced by generate_fighter_seed.py
    seed_by_slug: dict[str, dict] = {}
    active_slugs: set[str]        = set()
    seed_path = PUBLIC_DIR / "fighters_active.json"
    if seed_path.exists():
        with open(seed_path, encoding="utf-8") as _sf:
            _seed = json.load(_sf)
        seed_by_slug  = {e["slug"]: e for e in _seed}
        active_slugs  = set(seed_by_slug.keys())
        print(f"📋 Loaded seed: {len(active_slugs)} active fighters from fighters_active.json")
    elif active_only:
        print("❌ --active-only requires fighters_active.json — run generate_fighter_seed.py first")
        return

    # Step 1: Enumerate all fighters from UFCStats
    print("\n🔍 Enumerating all fighters from UFCStats...")
    all_fighters = enumerate_all_ufcstats_fighters()

    # Filter to active fighters only (seed-driven)
    if active_only and active_slugs:
        before = len(all_fighters)
        all_fighters = [f for f in all_fighters if to_slug(f["name"]) in active_slugs]
        print(f"  --active-only: {before} → {len(all_fighters)} fighters (matched against seed)")

    # Filter to a specific fighter if requested
    if fighter_name:
        target = fighter_name.lower()
        all_fighters = [f for f in all_fighters if target in f["name"].lower()]
        print(f"  Filtered to {len(all_fighters)} fighters matching '{fighter_name}'")

    if limit:
        all_fighters = all_fighters[:limit]
        print(f"  Limited to first {limit} fighters")

    total = len(all_fighters)
    print(f"\n🥊 Building profiles for {total} fighters...\n")

    built = 0
    skipped = 0
    failed = 0

    for i, fighter_meta in enumerate(all_fighters, 1):
        name        = fighter_meta["name"]
        profile_url = fighter_meta.get("profile_url")
        slug        = to_slug(name)
        out_path    = PROFILES_DIR / f"{slug}.json"

        # Skip if already built (unless --refresh)
        if out_path.exists() and not refresh:
            skipped += 1
            if i % 50 == 0:
                print(f"  [{i}/{total}] Skipped (cached): {name}")
            continue

        print(f"\n[{i}/{total}] Building: {name}")

        profile: dict = {
            "slug":          slug,
            "name":          name,
            "last_updated":  datetime.utcnow().isoformat(),
        }

        # ── Seed: pre-populate from ufc-master.csv data ───────────────────
        seed = seed_by_slug.get(slug)
        if seed:
            # Map CSV seed fields → profile keys (only if not already set)
            seed_map = {
                "weight_class": "weight_class",
                "record":       "record",
                "wins":         "wins",
                "losses":       "losses",
                "draws":        "draws",
                "height":       "height",
                "reach":        "reach",
                "weight_lbs":   "weight_lbs",
                "stance":       "stance",
                "gender":       "gender",
                "finish_rate_pct": "finish_rate_pct",
                "wins_ko_tko":  "wins_ko_tko",
                "wins_submission": "wins_submission",
                "wins_decision":"wins_decision",
                "win_streak":   "current_win_streak",
                "last_fight_date": "last_fight_date",
            }
            for src_key, dst_key in seed_map.items():
                val = seed.get(src_key)
                if val is not None and dst_key not in profile:
                    profile[dst_key] = val
            print(f"  ✅ Seed: record={seed.get('record')} wc={seed.get('weight_class')}")

        # ── Step A: UFCStats profile ──────────────────────────────────────
        if profile_url:
            ufcstats_data = scrape_ufcstats_profile_direct(profile_url)
            if ufcstats_data:
                profile.update(ufcstats_data)
                print(f"  ✅ UFCStats: slpm={ufcstats_data.get('slpm', '?')}")
            else:
                print(f"  ⚠️  UFCStats: no data")
        else:
            print(f"  ⚠️  No UFCStats profile URL")

        # ── Step B: Sherdog fight history + bio ───────────────────────────
        sherdog_data = safe_sherdog_scrape(name)
        if sherdog_data:
            # Merge — don't overwrite UFCStats stats with Sherdog blanks
            for k, v in sherdog_data.items():
                if v and (k not in profile or not profile[k]):
                    profile[k] = v
            print(f"  ✅ Sherdog: {len(sherdog_data.get('fight_history', []))} fights")
        else:
            print(f"  ⚠️  Sherdog: no data")

        # ── Step C: Record breakdown ──────────────────────────────────────
        fight_history = profile.get("fight_history", [])
        record_str    = profile.get("record", "")
        rec_parsed    = parse_record(record_str)
        profile.update(rec_parsed)

        finish_stats = compute_finish_stats(fight_history)
        profile.update(finish_stats)

        streak_stats = compute_win_streak(fight_history)
        profile.update(streak_stats)

        # ── Step D: Age ───────────────────────────────────────────────────
        dob = profile.get("dob")
        age = calc_age(dob)
        if age:
            profile["age"] = age

        # ── Step E: Portrait image ────────────────────────────────────────
        # Use the portrait_url already extracted from the Sherdog page in Step B
        # (ag_sherdog.py now extracts it from the same soup2 parse — no extra HTTP).
        # Fall back to get_sherdog_portrait_url() for fighters whose Sherdog data
        # came from cache (portrait_url may not be in older cached entries).
        portrait_url = profile.pop("portrait_url", None)
        if not portrait_url:
            sherdog_url = profile.get("sherdog_url") or ""
            portrait_url = get_sherdog_portrait_url(sherdog_url)

        if portrait_url:
            profile["ufc_image_url"] = portrait_url
            print(f"  ✅ Sherdog portrait: {portrait_url}")
        else:
            # Fall back to UFC.com (may be blocked but worth trying)
            ufc_img = get_ufc_portrait_url(name)
            if ufc_img:
                profile["ufc_image_url"] = ufc_img
                print(f"  ✅ UFC.com portrait found")
            else:
                profile["ufc_image_url"] = None
                print(f"  ⚠️  No portrait found")

        # ── Step F: Normalize stats dict ──────────────────────────────────
        stats = {
            "slpm":              profile.pop("slpm",              None),
            "sapm":              profile.pop("sapm",              None),
            "striking_accuracy": profile.pop("str_acc",           None),
            "striking_defense":  profile.pop("striking_defense",  None),
            "td_avg":            profile.pop("td_avg",            None),
            "td_accuracy":       profile.pop("td_acc",            None),
            "td_defense":        profile.pop("td_defense",        None),
            "avg_sub_attempts":  profile.pop("sub_avg",           None),
        }
        # Remove None values to keep the file clean
        stats = {k: v for k, v in stats.items() if v is not None}
        profile["stats"] = stats

        # ── Step G: AI pick record ────────────────────────────────────────
        def _norm_name(n):
            return re.sub(r"[^a-z]", "", (n or "").lower())

        ai_key = _norm_name(name)
        if ai_key in ai_records:
            profile["ai_record"] = ai_records[ai_key]
        else:
            profile["ai_record"] = None

        # ── Write profile ─────────────────────────────────────────────────
        with open(out_path, "w", encoding="utf-8") as f:
            json.dump(profile, f, ensure_ascii=False, indent=2)

        built += 1
        print(f"  💾 Saved: {out_path.name}")

    print(f"\n✅ Done. Built: {built}  Skipped: {skipped}  Failed: {failed}")

    # Rebuild index
    _rebuild_index_only()


def _rebuild_index_only() -> None:
    """Rebuild fighters_index.json from all existing profile JSON files."""
    index = []
    for profile_path in sorted(PROFILES_DIR.glob("*.json")):
        try:
            with open(profile_path, "r", encoding="utf-8") as f:
                p = json.load(f)
        except json.JSONDecodeError:
            continue

        # Only include the lightweight fields needed for the directory card
        index.append({
            "slug":            p.get("slug", ""),
            "name":            p.get("name", ""),
            "nickname":        p.get("nickname") or "",
            "record":          p.get("record", ""),
            "wins":            p.get("wins", 0),
            "losses":          p.get("losses", 0),
            "draws":           p.get("draws", 0),
            "weight_class":    p.get("weight_class") or p.get("weight_lbs") or "",
            "nationality":     p.get("nationality") or "",
            "team":            p.get("team") or "",
            "stance":          p.get("stance") or "",
            "ufc_image_url":   p.get("ufc_image_url") or None,
            "sherdog_url":     p.get("sherdog_url") or None,
            "finish_rate_pct": p.get("finish_rate_pct", 0),
            "wins_ko_tko":     p.get("wins_ko_tko", 0),
            "wins_submission":  p.get("wins_submission", 0),
            "current_win_streak": p.get("current_win_streak", 0),
            "age":             p.get("age") or None,
            "height":          p.get("height") or "",
            "reach":           p.get("reach") or "",
        })

    with open(INDEX_PATH, "w", encoding="utf-8") as f:
        json.dump(index, f, ensure_ascii=False, indent=2)

    print(f"\n📋 Index rebuilt: {len(index)} fighters → {INDEX_PATH}")


# ── CLI ─────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Build Combat Dossier fighter profiles"
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=None,
        help="Only process the first N fighters (for testing)",
    )
    parser.add_argument(
        "--refresh",
        action="store_true",
        help="Re-scrape and overwrite existing profile files",
    )
    parser.add_argument(
        "--fighter",
        type=str,
        default=None,
        help="Only process fighters whose name contains this string",
    )
    parser.add_argument(
        "--index-only",
        action="store_true",
        help="Skip scraping — just rebuild fighters_index.json from existing profiles",
    )
    parser.add_argument(
        "--active-only",
        action="store_true",
        help="Only build profiles for fighters in fighters_active.json (requires generate_fighter_seed.py to have been run)",
    )
    args = parser.parse_args()

    build_all_profiles(
        limit=args.limit,
        refresh=args.refresh,
        fighter_name=args.fighter,
        index_only=args.index_only,
        active_only=args.active_only,
    )
