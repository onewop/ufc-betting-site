"""
backend/routers/fighters.py — Combat Dossier fighter profile API.

Routes:
  GET  /api/fighters              — Paginated + searchable directory (from fighters_index.json)
  GET  /api/fighters/{slug}       — Full fighter profile (from fighter_profiles/{slug}.json)
  POST /api/fighters/{slug}/vote  — Cast a community vote for this fighter
  GET  /api/fighters/{slug}/votes — Get current vote totals for this fighter
"""
from __future__ import annotations

import json
import logging
import os
import re
import threading
from pathlib import Path
from typing import Literal

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/fighters", tags=["fighters"])

# ── File location helpers ────────────────────────────────────────────────────

def _find_public_dir() -> Path:
    """Locate the public/ directory at runtime regardless of Railway layout."""
    candidates = [
        Path("/app/public"),
        Path(__file__).resolve().parent.parent.parent / "public",
        Path(__file__).resolve().parent.parent / "public",
    ]
    for p in candidates:
        if p.exists():
            return p
    return candidates[0]


_PUBLIC_DIR    = _find_public_dir()
_INDEX_PATH    = _PUBLIC_DIR / "fighters_index.json"
_PROFILES_DIR  = _PUBLIC_DIR / "fighter_profiles"
_VOTES_PATH    = _PUBLIC_DIR / "fighter_votes.json"

# Thread lock for vote file writes
_votes_lock = threading.Lock()

# In-memory cache for the index (reloaded on process start)
_index_cache: list[dict] | None = None


def _load_index() -> list[dict]:
    global _index_cache
    if _index_cache is not None:
        return _index_cache
    if not _INDEX_PATH.exists():
        logger.warning("fighters_index.json not found at %s — run build_fighter_profiles.py first", _INDEX_PATH)
        return []
    with _INDEX_PATH.open("r", encoding="utf-8") as f:
        _index_cache = json.load(f)
    logger.info("fighters: loaded index with %d fighters", len(_index_cache))
    return _index_cache


def _load_profile(slug: str) -> dict | None:
    """Load a single fighter profile JSON. Returns None if not found."""
    profile_path = _PROFILES_DIR / f"{slug}.json"
    if not profile_path.exists():
        return None
    try:
        with profile_path.open("r", encoding="utf-8") as f:
            return json.load(f)
    except json.JSONDecodeError as e:
        logger.error("fighters: corrupt profile JSON for slug=%s: %s", slug, e)
        return None


def _load_votes() -> dict:
    """Load fighter_votes.json — returns {} if not found."""
    if not _VOTES_PATH.exists():
        return {}
    try:
        with _VOTES_PATH.open("r", encoding="utf-8") as f:
            return json.load(f)
    except (json.JSONDecodeError, OSError):
        return {}


def _save_votes(votes: dict) -> None:
    """Atomically write fighter_votes.json."""
    tmp = _VOTES_PATH.with_suffix(".tmp")
    with tmp.open("w", encoding="utf-8") as f:
        json.dump(votes, f, ensure_ascii=False, indent=2)
    tmp.replace(_VOTES_PATH)


# ── Request / response models ────────────────────────────────────────────────

class VoteRequest(BaseModel):
    vote: Literal["fighter_a", "fighter_b"]


# ── Routes ───────────────────────────────────────────────────────────────────

@router.get("")
def list_fighters(
    q:           str | None = Query(default=None, description="Search by fighter name"),
    weight_class: str | None = Query(default=None, alias="weightClass"),
    nationality:  str | None = Query(default=None),
    team:         str | None = Query(default=None),
    limit:        int        = Query(default=100, le=500),
    offset:       int        = Query(default=0, ge=0),
) -> dict:
    """Return paginated fighter list with optional search/filter.
    
    Supports:
      ?q=prates           — fuzzy name search
      ?weightClass=Welterweight
      ?nationality=Brazil
      ?team=American+Top+Team
      ?limit=50&offset=0  — pagination
    """
    fighters = _load_index()

    if q:
        q_lower = q.lower()
        fighters = [
            f for f in fighters
            if q_lower in f.get("name", "").lower()
            or q_lower in f.get("nickname", "").lower()
        ]

    if weight_class:
        wc_lower = weight_class.lower()
        fighters = [
            f for f in fighters
            if wc_lower in f.get("weight_class", "").lower()
        ]

    if nationality:
        nat_lower = nationality.lower()
        fighters = [
            f for f in fighters
            if nat_lower in f.get("nationality", "").lower()
        ]

    if team:
        team_lower = team.lower()
        fighters = [
            f for f in fighters
            if team_lower in f.get("team", "").lower()
        ]

    total = len(fighters)
    page  = fighters[offset : offset + limit]

    return {
        "total":   total,
        "offset":  offset,
        "limit":   limit,
        "results": page,
    }


@router.get("/{slug}")
def get_fighter_profile(slug: str) -> dict:
    """Return full fighter profile for the given slug."""
    # Sanitize slug — alphanumeric + hyphens only
    clean_slug = re.sub(r"[^a-z0-9-]", "", slug.lower())
    if clean_slug != slug:
        raise HTTPException(status_code=400, detail="Invalid slug format")

    profile = _load_profile(clean_slug)
    if profile is None:
        raise HTTPException(
            status_code=404,
            detail=f"Fighter profile not found for slug '{clean_slug}'. "
                   "Run scripts/build_fighter_profiles.py to generate profiles.",
        )

    # Attach vote totals inline
    votes = _load_votes()
    profile["votes"] = votes.get(clean_slug, {"fighter_a": 0, "fighter_b": 0})

    return profile


@router.post("/{slug}/vote")
def cast_vote(slug: str, body: VoteRequest) -> dict:
    """Record a community vote for a fighter.
    
    vote: "fighter_a" = pick this fighter to win their next fight
    vote: "fighter_b" = pick their opponent
    """
    clean_slug = re.sub(r"[^a-z0-9-]", "", slug.lower())
    if clean_slug != slug:
        raise HTTPException(status_code=400, detail="Invalid slug format")

    # Verify the fighter exists
    if _load_profile(clean_slug) is None:
        raise HTTPException(status_code=404, detail="Fighter not found")

    with _votes_lock:
        votes = _load_votes()
        if clean_slug not in votes:
            votes[clean_slug] = {"fighter_a": 0, "fighter_b": 0}
        votes[clean_slug][body.vote] = votes[clean_slug].get(body.vote, 0) + 1
        _save_votes(votes)

    return {
        "slug":  clean_slug,
        "votes": votes[clean_slug],
    }


@router.get("/{slug}/votes")
def get_votes(slug: str) -> dict:
    """Return current vote totals for a fighter."""
    clean_slug = re.sub(r"[^a-z0-9-]", "", slug.lower())
    votes = _load_votes()
    return {
        "slug":  clean_slug,
        "votes": votes.get(clean_slug, {"fighter_a": 0, "fighter_b": 0}),
    }
