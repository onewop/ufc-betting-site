#!/usr/bin/env python3
"""Fast portrait-only update for fighter profiles.

Re-scrapes ONLY the Sherdog fighter page to extract the portrait URL for fighters
that have a dead /300/400/ URL or no ufc_image_url at all.  Skips full
UFCStats/Sherdog career stat re-scraping — reads existing profile JSONs and only
updates the ufc_image_url field.

Usage:
    python3 scripts/update_portraits.py           # update all fighters with dead/missing portraits
    python3 scripts/update_portraits.py --all     # update every fighter regardless
    python3 scripts/update_portraits.py --fighter "Marlon Vera"
"""
import json
import glob
import os
import sys
import random
import time
import argparse
import requests
from bs4 import BeautifulSoup
from pathlib import Path

PROFILES_DIR = Path(__file__).parent.parent / "public" / "fighter_profiles"
INDEX_FILE   = Path(__file__).parent.parent / "public" / "fighters_index.json"

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml",
    "Accept-Language": "en-US,en;q=0.9",
    # No Referer — required to bypass Sherdog hotlink protection on image CDN
}


def fetch_portrait(sherdog_url: str) -> str | None:
    """Fetch the Sherdog profile page and extract the real 200×300 portrait URL."""
    if not sherdog_url:
        return None
    try:
        resp = requests.get(sherdog_url, headers=HEADERS, timeout=15)
        if resp.status_code != 200:
            return None
        soup = BeautifulSoup(resp.text, "html.parser")
        for img in soup.find_all("img"):
            src = img.get("src", "")
            if "_ff." in src and "/image_crop/200/300/" in src:
                return src if src.startswith("http") else f"https://www.sherdog.com{src}"
        return None
    except Exception as e:
        print(f"    ERROR fetching {sherdog_url}: {e}")
        return None


def is_dead_url(url: str) -> bool:
    """Return True if the URL uses the old dead /300/400/{id}_ff.jpg format."""
    return bool(url and "/image_crop/300/400/" in url)


def main():
    parser = argparse.ArgumentParser(description="Update fighter portrait URLs")
    parser.add_argument("--all", action="store_true", help="Update all fighters")
    parser.add_argument("--fighter", help="Only update fighters whose name contains this")
    parser.add_argument("--dry-run", action="store_true", help="Show what would be updated, don't write")
    args = parser.parse_args()

    profiles = sorted(PROFILES_DIR.glob("*.json"))
    total = len(profiles)
    print(f"Loaded {total} profiles")

    # Determine which fighters need portrait updates
    to_update = []
    for p in profiles:
        d = json.loads(p.read_text())
        uid = d.get("ufc_image_url") or ""
        sid = d.get("sherdog_url") or ""
        name = d.get("name", "")

        if args.fighter and args.fighter.lower() not in name.lower():
            continue

        if args.all or is_dead_url(uid) or (not uid and sid):
            to_update.append((p, d))

    print(f"Fighters needing portrait update: {len(to_update)}")
    if args.dry_run:
        for p, d in to_update[:20]:
            print(f"  {d.get('name')} → current: {d.get('ufc_image_url') or 'none'}")
        return

    updated = 0
    found = 0
    missing = 0
    skipped = 0

    for i, (p, profile) in enumerate(to_update, 1):
        name = profile.get("name", p.stem)
        sherdog_url = profile.get("sherdog_url") or ""
        old_url = profile.get("ufc_image_url") or ""

        if not sherdog_url:
            print(f"  [{i}/{len(to_update)}] ⚠️  {name} — no sherdog_url, skipping")
            skipped += 1
            continue

        print(f"  [{i}/{len(to_update)}] {name} ...", end=" ", flush=True)

        time.sleep(random.uniform(1.0, 2.5))  # polite delay
        portrait = fetch_portrait(sherdog_url)

        if portrait:
            profile["ufc_image_url"] = portrait
            p.write_text(json.dumps(profile, ensure_ascii=False, indent=2))
            print(f"✅ {portrait.split('/')[-1]}")
            found += 1
        else:
            profile["ufc_image_url"] = None
            p.write_text(json.dumps(profile, ensure_ascii=False, indent=2))
            print(f"⚠️  no portrait")
            missing += 1

        updated += 1

    print(f"\n✅ Done. Updated: {updated}  Found portraits: {found}  Missing: {missing}  Skipped: {skipped}")

    # Rebuild the fighters_index.json
    print("\n📋 Rebuilding fighters_index.json ...")
    index = []
    for p in sorted(PROFILES_DIR.glob("*.json")):
        d = json.loads(p.read_text())
        index.append({
            "slug":        d.get("slug", p.stem),
            "name":        d.get("name", ""),
            "nickname":    d.get("nickname"),
            "weight_class": d.get("weight_class"),
            "record":      d.get("record"),
            "nationality": d.get("nationality"),
            "team":        d.get("team"),
            "ufc_image_url": d.get("ufc_image_url"),
            "sherdog_url": d.get("sherdog_url"),
        })
    INDEX_FILE.write_text(json.dumps(index, ensure_ascii=False, indent=2))
    print(f"   {len(index)} fighters → {INDEX_FILE}")


if __name__ == "__main__":
    main()
