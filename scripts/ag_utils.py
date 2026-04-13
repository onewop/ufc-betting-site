"""
ag_utils.py — Shared utility functions for the aggregate_stats pipeline.

Anything that every scraper module needs (name normalisation, JSON save, cell
parsers) lives here so it can be imported once without circular dependencies.

Imported by:  ag_sherdog.py · ag_ufcstats.py · ag_perfight.py · aggregate_stats.py
Rollback:     cp _archive/scripts/aggregate_stats_ORIGINAL_PRESPLIT.py scripts/aggregate_stats.py
"""

import pandas as pd
import json
import os
import datetime
import shutil
import unicodedata
import re


# ── Name normalisation ──────────────────────────────────────────────────────
# DraftKings names frequently differ from external databases in diacritics,
# honorifics (Jr./Sr./III/IV), name particles (de/da/dos), punctuation, and
# extra whitespace.  normalize_name() strips all of that so matchmaking across
# ufc-master.csv / UFCStats / Sherdog works reliably.

def normalize_name(name):
    """Aggressively normalize a fighter name for fuzzy matching across data sources.

    Steps:
      1. Lowercase + strip whitespace
      2. Remove accents via Unicode NFD decomposition (é→e, ü→u, etc.)
      3. Remove honorific suffixes: jr, sr, ii, iii, iv
      4. Remove common name particles: 'de' (Portuguese/Spanish)
      5. Strip dots, hyphens, commas
      6. Collapse internal whitespace

    Returns a lowercase ASCII string, or '' if *name* is NaN/None.
    """
    if pd.isna(name):
        return ""

    name = str(name).lower().strip()

    # NFD decomposes combined chars; dropping category 'Mn' removes accent marks
    name = ''.join(
        c for c in unicodedata.normalize('NFD', name)
        if unicodedata.category(c) != 'Mn'
    )

    # Honorifics / particles
    name = name.replace('jr.', '').replace('jr', '')
    name = name.replace('sr.', '').replace('sr', '')
    name = name.replace('iii', '').replace('ii', '').replace('iv', '')
    name = name.replace('de ', '')  # e.g. "Renato Moicano de Lima" → "renato moicano lima"

    # Punctuation
    name = name.replace('.', '').replace('-', ' ').replace(',', '')

    # Collapse spaces left after removals
    name = ' '.join(name.split())
    return name


# ── UFCStats URL ID helper ──────────────────────────────────────────────────
# UFCStats embeds a hex fighter ID in each profile URL:
#   http://ufcstats.com/fighter-details/93fe7332d16c6ad9
# This helper extracts that ID for cross-referencing with ag_ufcstats.id_mapping.

def extract_ufcstats_id(url):
    """Extract the hex fighter ID from a UFCStats profile URL.

    Returns the ID string, or None if *url* is NaN/None or has no /fighter-details/ segment.
    """
    if pd.isna(url):
        return None
    try:
        url_str = str(url).strip()
        if '/fighter-details/' in url_str:
            # The ID is the last path segment after /fighter-details/
            return url_str.split('/fighter-details/')[-1]
    except Exception:
        pass
    return None


# ── JSON output with timestamped backup ──────────────────────────────────────
# Every time the pipeline writes this_weeks_stats.json it first copies the
# previous version into public/archive/ so you can roll back to the last good
# data in one command:
#   cp public/archive/this_weeks_stats-backup-YYYYMMDD_HHMMSS.json public/this_weeks_stats.json

def save_to_json(data, output_path="public/this_weeks_stats.json"):
    """Serialize *data* to JSON at *output_path*, creating a timestamped backup first.

    Creates the parent directory and public/archive/ if they don't exist.
    Backup path: public/archive/this_weeks_stats-backup-YYYYMMDD_HHMMSS.json
    """
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


# ── UFCStats 'X of Y' cell parser ───────────────────────────────────────────
# UFCStats fight detail pages show striking totals in "landed of attempted" form,
# e.g. "15 of 23".  ag_perfight.py calls this repeatedly when parsing significant
# strikes by target (Head/Body/Leg) and position (Distance/Clinch/Ground).

def _parse_of(cell_text):
    """Parse a UFCStats 'X of Y' string into (landed, attempted).

    Returns (0, 0) if the text does not match the expected pattern.
    Example: '15 of 23' → (15, 23)
    """
    m = re.match(r'(\d+)\s+of\s+(\d+)', cell_text.strip(), re.IGNORECASE)
    return (int(m.group(1)), int(m.group(2))) if m else (0, 0)
