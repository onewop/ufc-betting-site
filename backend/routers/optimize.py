"""
Router: /api/optimize
"""
from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models import (
    CachedLineupOut,
    EventCreate,
    EventOut,
    FighterOut,
    FightersResponse,
    OptimizeRequest,
    OptimizeResponse,
    Event,
    CachedLineup,
)
from backend.optimizer import load_this_weeks_stats, _build_flat_fighters, run_optimizer
from backend.projections import project_full_card, generate_smart_lineups, STRATEGIES

import json

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["optimizer"])


@router.get(
    "/fighters",
    response_model=FightersResponse,
    summary="Return this week's fighter roster",
)
def get_fighters() -> FightersResponse:
    """Return the fighter pool parsed from this_weeks_stats.json."""
    try:
        stats = load_this_weeks_stats()
    except FileNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc))

    flat = _build_flat_fighters(stats)
    fight_ids = list(dict.fromkeys(f["fight_id"] for f in flat))
    return FightersResponse(
        fights=fight_ids,
        fighters=[FighterOut(**f) for f in flat],
    )


@router.get(
    "/projections",
    summary="Return matchup-aware projections for every fighter",
)
def get_projections():
    """Return detailed projections with reasoning for the full card."""
    try:
        projections = project_full_card()
    except FileNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc))
    return {"projections": projections}


@router.get(
    "/smart-lineups",
    summary="AI-recommended lineups with reasoning",
)
def get_smart_lineups(
    num_lineups: int = 5,
    strategy: str | None = None,
    exclude: str | None = None,
):
    """
    Generate recommended lineups with strategy explanations.

    Query params:
      - strategy: one of highest_projection, best_value, contrarian,
        finish_upside, balanced. Omit for one-of-each overview.
      - num_lineups: how many to return (1-20, default 5).
      - exclude: comma-separated lineup fingerprints to skip (for regenerate).
    """
    if num_lineups < 1 or num_lineups > 20:
        raise HTTPException(status_code=422, detail="num_lineups must be 1-20")
    if strategy and strategy not in STRATEGIES:
        raise HTTPException(
            status_code=422,
            detail=f"Unknown strategy '{strategy}'. Valid: {', '.join(STRATEGIES.keys())}",
        )
    exclude_fps = [fp.strip() for fp in exclude.split("|") if fp.strip()] if exclude else None
    try:
        lineups = generate_smart_lineups(
            num_lineups=num_lineups,
            strategy=strategy,
            exclude_fingerprints=exclude_fps,
        )
    except FileNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc))
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc))
    return {"lineups": lineups, "num_generated": len(lineups)}


@router.get(
    "/strategies",
    summary="List available AI lineup strategies",
)
def get_strategies():
    """Return the list of available strategies with labels and descriptions."""
    return {"strategies": STRATEGIES}


@router.post(
    "/optimize",
    response_model=OptimizeResponse,
    summary="Generate DFS lineups",
)
def optimize(
    request: OptimizeRequest,
    db: Session = Depends(get_db),
) -> OptimizeResponse:
    """
    Generate DK UFC DFS lineups according to the optimization request.

    - **num_lineups**: how many lineups to produce (1–150)
    - **salary_mode**: `higher` | `medium` | `diverse`
    - **locked_fighters**: fighter IDs always included
    - **excluded_fighters**: fighter IDs never included
    - **exposure_limit**: max fraction of lineups any single fighter can appear in
    """
    try:
        lineups = run_optimizer(request)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc))
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc))
    except Exception as exc:
        logger.exception("Unexpected optimizer error")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Optimizer failed: {exc}",
        )

    return OptimizeResponse(
        status="ok",
        lineups=lineups,
        num_requested=request.num_lineups,
        num_generated=len(lineups),
        salary_mode=request.salary_mode,
        echoed_request=request,
    )


# ── Event CRUD (lightweight) ─────────────────────────────────────────────────

@router.post("/events", response_model=EventOut, status_code=status.HTTP_201_CREATED)
def create_event(payload: EventCreate, db: Session = Depends(get_db)) -> EventOut:
    event = Event(title=payload.title, date=payload.date)
    db.add(event)
    db.commit()
    db.refresh(event)
    return event  # type: ignore[return-value]


@router.get("/events", response_model=list[EventOut])
def list_events(db: Session = Depends(get_db)) -> list[EventOut]:
    return db.query(Event).order_by(Event.id.desc()).all()  # type: ignore[return-value]


@router.get("/events/{event_id}", response_model=EventOut)
def get_event(event_id: int, db: Session = Depends(get_db)) -> EventOut:
    event = db.get(Event, event_id)
    if event is None:
        raise HTTPException(status_code=404, detail="Event not found")
    return event  # type: ignore[return-value]


# ── Lineup cache ──────────────────────────────────────────────────────────────

@router.get("/events/{event_id}/lineups", response_model=list[CachedLineupOut])
def get_cached_lineups(event_id: int, db: Session = Depends(get_db)) -> list[CachedLineupOut]:
    event = db.get(Event, event_id)
    if event is None:
        raise HTTPException(status_code=404, detail="Event not found")
    return event.lineups  # type: ignore[return-value]


@router.post(
    "/events/{event_id}/lineups",
    response_model=CachedLineupOut,
    status_code=status.HTTP_201_CREATED,
)
def cache_lineup(
    event_id: int,
    request: OptimizeRequest,
    db: Session = Depends(get_db),
) -> CachedLineupOut:
    """Generate lineups and persist the first one against the event."""
    event = db.get(Event, event_id)
    if event is None:
        raise HTTPException(status_code=404, detail="Event not found")

    try:
        lineups = run_optimizer(request)
    except (FileNotFoundError, ValueError) as exc:
        raise HTTPException(status_code=422, detail=str(exc))

    if not lineups:
        raise HTTPException(status_code=422, detail="Optimizer produced no lineups.")

    cached = CachedLineup(
        event_id=event_id,
        lineup_json=json.dumps([lu.model_dump() for lu in lineups]),
        salary_mode=request.salary_mode,
    )
    db.add(cached)
    db.commit()
    db.refresh(cached)
    return cached  # type: ignore[return-value]
