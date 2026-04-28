"""
scripts/generate_sitemap.py — Generate sitemap.xml for CageVault.

Reads public/fighters_active.json and outputs public/sitemap.xml with:
  - Static pages (home, /fighters, /odds, etc.)
  - One <url> per active fighter at /fighters/{slug}

Usage:
  python3 scripts/generate_sitemap.py
  python3 scripts/generate_sitemap.py --base-url https://cagevault.com
"""
from __future__ import annotations

import argparse
import json
from datetime import date
from pathlib import Path
from xml.etree import ElementTree as ET

# ── Paths ────────────────────────────────────────────────────────────────────

ROOT_DIR    = Path(__file__).resolve().parent.parent
PUBLIC_DIR  = ROOT_DIR / "public"
ACTIVE_JSON = PUBLIC_DIR / "fighters_active.json"
OUTPUT_PATH = PUBLIC_DIR / "sitemap.xml"

# ── Static pages ─────────────────────────────────────────────────────────────

STATIC_PAGES = [
    {"path": "/",            "priority": "1.0",  "changefreq": "weekly"},
    {"path": "/fighters",    "priority": "0.9",  "changefreq": "weekly"},
    {"path": "/odds",        "priority": "0.8",  "changefreq": "daily"},
    {"path": "/picks",       "priority": "0.8",  "changefreq": "weekly"},
    {"path": "/parlay",      "priority": "0.7",  "changefreq": "weekly"},
    {"path": "/track-record","priority": "0.6",  "changefreq": "weekly"},
    {"path": "/value-bets",  "priority": "0.7",  "changefreq": "daily"},
]


def generate_sitemap(base_url: str = "https://cagevault.com") -> None:
    base_url = base_url.rstrip("/")
    today = date.today().isoformat()

    # Load active fighters
    if not ACTIVE_JSON.exists():
        print(f"❌  {ACTIVE_JSON} not found — run generate_fighter_seed.py first")
        return

    with open(ACTIVE_JSON, "r", encoding="utf-8") as f:
        fighters = json.load(f)

    # Build XML
    urlset = ET.Element("urlset")
    urlset.set("xmlns", "http://www.sitemaps.org/schemas/sitemap/0.9")

    # Static pages
    for page in STATIC_PAGES:
        url_el = ET.SubElement(urlset, "url")
        ET.SubElement(url_el, "loc").text          = f"{base_url}{page['path']}"
        ET.SubElement(url_el, "lastmod").text      = today
        ET.SubElement(url_el, "changefreq").text   = page["changefreq"]
        ET.SubElement(url_el, "priority").text     = page["priority"]

    # Fighter profile pages
    added = 0
    for fighter in fighters:
        slug = fighter.get("slug", "").strip()
        if not slug:
            continue
        url_el = ET.SubElement(urlset, "url")
        ET.SubElement(url_el, "loc").text        = f"{base_url}/fighters/{slug}"
        ET.SubElement(url_el, "lastmod").text    = today
        ET.SubElement(url_el, "changefreq").text = "monthly"
        ET.SubElement(url_el, "priority").text   = "0.7"
        added += 1

    # Write with declaration + pretty indentation
    ET.indent(urlset, space="  ")
    tree = ET.ElementTree(urlset)
    with open(OUTPUT_PATH, "wb") as f:
        tree.write(f, xml_declaration=True, encoding="UTF-8")

    total = len(STATIC_PAGES) + added
    print(f"✅  sitemap.xml written → {OUTPUT_PATH}")
    print(f"   {len(STATIC_PAGES)} static pages + {added} fighter profiles = {total} URLs")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Generate sitemap.xml for CageVault")
    parser.add_argument(
        "--base-url",
        default="https://cagevault.com",
        help="Base URL (default: https://cagevault.com)",
    )
    args = parser.parse_args()
    generate_sitemap(base_url=args.base_url)
