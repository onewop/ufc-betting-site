"""
backend/routers/stats.py — Serves this_weeks_stats.json over the API.

Exposes GET /api/this-weeks-stats so the frontend reads fight/fighter
data through the same Railway URL used for all other endpoints, rather
than fetching the static file directly (which fails from Capacitor/Android
because the file origin doesn't match the API origin).
"""
from __future__ import annotations

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
