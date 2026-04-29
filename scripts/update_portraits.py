#!/usr/bin/env python3
"""Fast portrait-only update for fighter profiles.

Re-scrapes ONLY the Sherdog fighter page to extract the portrait URL for fighters
that have a dead /300/400/ URL or no ufc_image_url at all.  Skips full
UFCStats/Sherdog career stat re-scraping — reads existing profile JSONs and only
updates the ufc_image_url field.

Usage:
    python3 scripts/update_portraits.py             # scrape real URLs for dead/missing portraits
    python3 scripts/update_portraits.py --download  # download all 200/300 JPEGs and self-host them
    python3 scripts/update_portraits.py --all       # re-scrape every fighter regardless
    python3 scripts/update_portraits.py --fighter "Cub Swanson"
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

PROFILES_DIR  = Path(__file__).parent.parent / "public" / "fighter_profiles"
INDEX_FILE    = Path(__file__).parent.parent / "public" / "fighters_index.json"
FIGHTERS_IMG  = Path(__file__).parent.parent / "public" / "images" / "fighters"

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml",
    "Accept-Language": "en-US,en;q=0.9",
    # No Referer — required to bypass Sherdog hotlink protection on image CDN
}

IMG_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
    ),
    # No Referer — Sherdog 403s any request with a foreign Referer
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


def download_image(url: str, dest: Path) -> bool:
    """Download a JPEG from url to dest. Returns True on success."""
    try:
        r = requests.get(url, headers=IMG_HEADERS, timeout=15, stream=True)
        if r.status_code != 200:
            return False
        data = r.content
        if len(data) < 1000 or data[:3] != bytes([0xFF, 0xD8, 0xFF]):
            return False  # not a real JPEG
        dest.write_bytes(data)
        return True
    except Exception as e:
        print(f"    ERROR downloading {url}: {e}")
        return False


def is_dead_url(url: str) -> bool:
    """Return True if the URL uses the old dead /300/400/{id}_ff.jpg format."""
    return bool(url and "/image_crop/300/400/" in url)


def rebuild_index():
    print("\n📋 Rebuilding fighters_index.json ...")
    index = []
    for p in sorted(PROFILES_DIR.glob("*.json")):
        d = json.loads(p.read_text())
        index.append({
            "slug":         d.get("slug", p.stem),
            "name":         d.get("name", ""),
            "nickname":     d.get("nickname"),
            "weight_class": d.get("weight_class"),
            "record":       d.get("record"),
            "nationality":  d.get("nationality"),
            "team":         d.get("team"),
            "ufc_image_url": d.get("ufc_image_url"),
            "sherdog_url":  d.get("sherdog_url"),
        })
    INDEX_FILE.write_text(json.dumps(index, ensure_ascii=False, indent=2))
    print(f"   {len(index)} fighters → {INDEX_FILE}")


def run_download():
    """Download all Sherdog 200/300 portraits and self-host under public/images/fighters/."""
    FIGHTERS_IMG.mkdir(parents=True, exist_ok=True)

    profiles = sorted(PROFILES_DIR.glob("*.json"))
    to_download = []
    for p in profiles:
        d = json.loads(p.read_text())
        uid = d.get("ufc_image_url") or ""
        slug = d.get("slug", p.stem)
        local_path = FIGHTERS_IMG / f"{slug}.jpg"

        # Queue if we have a Sherdog URL and don't yet have a local copy
        if "sherdog.com/image_crop/200/300" in uid and not local_path.exists():
            to_download.append((p, d, uid, local_path))
        elif "/images/fighters/" in uid:
            pass  # already local
        # Also re-point profiles that are already local (idempotent)

    print(f"Portraits to download: {len(to_download)}")

    ok = 0
    fail = 0
    for i, (p, profile, url, dest) in enumerate(to_download, 1):
        name = profile.get("name", p.stem)
        slug = profile.get("slug", p.stem)
        print(f"  [{i}/{len(to_download)}] {name} ...", end=" ", flush=True)

        if download_image(url, dest):
            # Point profile at local path
            profile["ufc_image_url"] = f"/images/fighters/{slug}.jpg"
            p.write_text(json.dumps(profile, ensure_ascii=False, indent=2))
            print(f"✅ saved ({dest.stat().st_size // 1024}KB)")
            ok += 1
        else:
            print(f"❌ failed — keeping Sherdog URL")
            fail += 1

        time.sleep(0.3)  # light delay — downloading, not scraping

    # Also re-point any profiles that already have local files but still reference Sherdog
    for p in sorted(PROFILES_DIR.glob("*.json")):
        d = json.loads(p.read_text())
        slug = d.get("slug", p.stem)
        local_path = FIGHTERS_IMG / f"{slug}.jpg"
        uid = d.get("ufc_image_url") or ""
        if local_path.exists() and "/images/fighters/" not in uid:
            d["ufc_image_url"] = f"/images/fighters/{slug}.jpg"
            p.write_text(json.dumps(d, ensure_ascii=False, indent=2))

    print(f"\n✅ Downloaded: {ok}  Failed: {fail}")
    rebuild_index()


def main():
    parser = argparse.ArgumentParser(description="Update fighter portrait URLs")
    parser.add_argument("--download", action="store_true",
                        help="Download all Sherdog portraits and self-host locally")
    parser.add_argument("--all", action="store_true", help="Re-scrape every fighter")
    parser.add_argument("--fighter", help="Only update fighters whose name contains this")
    parser.add_argument("--dry-run", action="store_true", help="Show what would be updated, don't write")
    args = parser.parse_args()

    if args.download:
        run_download()
        return

    profiles = sorted(PROFILES_DIR.glob("*.json"))
    total = len(profiles)
    print(f"Loaded {total} profiles")

    # Determine which fighters need portrait URL scraping
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
    rebuild_index()


if __name__ == "__main__":
    main()



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
