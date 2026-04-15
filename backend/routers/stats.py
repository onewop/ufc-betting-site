"""
backend/routers/stats.py — Serves this_weeks_stats.json over the API.

Exposes GET /api/this-weeks-stats so the frontend reads fight/fighter
data through the same Railway URL used for all other endpoints, rather
than fetching the static file directly (which fails from Capacitor/Android
because the file origin doesn't match the API origin).
"""
from __future__ import annotations

import json
from pathlib import Path

from fastapi import APIRouter, HTTPException

router = APIRouter(prefix="/api", tags=["stats"])

_STATS_PATH = Path("/app/public/this_weeks_stats.json")


@router.get("/this-weeks-stats")
def get_this_weeks_stats() -> dict:
    if not _STATS_PATH.exists():
        raise HTTPException(
            status_code=503,
            detail=f"Stats file not found at {_STATS_PATH}",
        )
    with _STATS_PATH.open("r", encoding="utf-8") as f:
        return json.load(f)
