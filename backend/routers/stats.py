"""
backend/routers/stats.py — Serves this_weeks_stats.json and fight results over the API.

Exposes GET /api/this-weeks-stats so the frontend reads fight/fighter
data through the same Railway URL used for all other endpoints, rather
than fetching the static file directly (which fails from Capacitor/Android
because the file origin doesn't match the API origin).

Also exposes GET /api/last-event-results which parses ufc_fight_results.csv
and returns the most recent event's bouts as JSON.  This is preferred over
fetching the raw CSV from the frontend because Vercel's SPA catch-all rewrite
can silently return index.html for unknown file extensions.
"""
from __future__ import annotations

import csv
import json
import logging
import os
from pathlib import Path

from fastapi import APIRouter, HTTPException

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["stats"])


def _locate_stats_file() -> Path:
    """Find this_weeks_stats.json at runtime without hardcoding an absolute path.

    Tries known candidates first, then falls back to a filesystem scan of /app
    so the endpoint works regardless of where Railway places the repo root.
    The first successful hit is cached at module load time.
    """
    candidates = [
        # Standard Railway Nixpacks layout (full repo at /app)
        Path("/app/public/this_weeks_stats.json"),
        # Relative to this file: backend/routers/stats.py → 3 levels up = repo root
        Path(__file__).resolve().parent.parent.parent / "public" / "this_weeks_stats.json",
        # Fallback: repo root is parent of backend/
        Path(__file__).resolve().parent.parent / "public" / "this_weeks_stats.json",
    ]
    for p in candidates:
        if p.exists():
            logger.info("stats: found this_weeks_stats.json at %s", p)
            return p

    # Last resort: walk /app to find it anywhere
    search_root = Path("/app")
    if search_root.exists():
        for dirpath, _dirs, filenames in os.walk(search_root):
            if "this_weeks_stats.json" in filenames:
                found = Path(dirpath) / "this_weeks_stats.json"
                logger.info("stats: found this_weeks_stats.json via scan at %s", found)
                return found

    # Not found — return best candidate so the error message is meaningful
    logger.error(
        "stats: this_weeks_stats.json not found. Tried: %s. "
        "/app contents: %s. __file__: %s",
        [str(p) for p in candidates],
        os.listdir("/app") if Path("/app").exists() else "no /app dir",
        Path(__file__).resolve(),
    )
    return candidates[0]


_STATS_PATH = _locate_stats_file()


@router.get("/this-weeks-stats")
def get_this_weeks_stats() -> dict:
    if not _STATS_PATH.exists():
        raise HTTPException(
            status_code=503,
            detail=(
                f"Stats file not found. Last path tried: {_STATS_PATH}. "
                f"CWD: {os.getcwd()}. "
                f"/app contents: {os.listdir('/app') if Path('/app').exists() else 'no /app'}"
            ),
        )
    with _STATS_PATH.open("r", encoding="utf-8") as f:
        return json.load(f)


# ── Last event fight results ─────────────────────────────────────────────────

def _locate_fight_results_csv() -> Path | None:
    """Find ufc_fight_results.csv at runtime — mirrors _locate_stats_file logic."""
    candidates = [
        Path("/app/public/ufcstats_raw/ufc_fight_results.csv"),
        Path(__file__).resolve().parent.parent.parent / "public" / "ufcstats_raw" / "ufc_fight_results.csv",
        Path(__file__).resolve().parent.parent / "public" / "ufcstats_raw" / "ufc_fight_results.csv",
    ]
    for p in candidates:
        if p.exists():
            logger.info("stats: found ufc_fight_results.csv at %s", p)
            return p
    logger.warning("stats: ufc_fight_results.csv not found. Tried: %s", [str(p) for p in candidates])
    return None


@router.get("/last-event-results")
def get_last_event_results() -> dict:
    """Return the most recent UFC event's fight results as JSON.

    Reads ufc_fight_results.csv (newest-event-first) and returns all bouts
    from the first event in the file.
    """
    csv_path = _locate_fight_results_csv()
    if csv_path is None:
        raise HTTPException(status_code=404, detail="Fight results data not available")

    try:
        with open(csv_path, "r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            all_rows = [{k.strip(): (v.strip() if v else "") for k, v in row.items()} for row in reader]
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to parse fight results: {exc}")

    if not all_rows:
        return {"event": None, "fights": []}

    most_recent_event = all_rows[0].get("EVENT", "").strip()
    recent_fights = [row for row in all_rows if row.get("EVENT", "").strip() == most_recent_event]

    return {"event": most_recent_event, "fights": recent_fights}
