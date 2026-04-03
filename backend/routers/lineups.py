"""
Router: /api/lineups

Endpoints:
  POST   /api/lineups              — save a new lineup set (requires auth)
  GET    /api/lineups              — list all saved lineups for current user
  DELETE /api/lineups/{lineup_id}  — delete a saved lineup
"""
from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models import SavedLineup, SavedLineupCreate, SavedLineupOut, User
from backend.routers.auth import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/lineups", tags=["lineups"])


@router.post("", response_model=SavedLineupOut, status_code=status.HTTP_201_CREATED)
def save_lineup(
    payload: SavedLineupCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> SavedLineupOut:
    lineup = SavedLineup(
        user_id=current_user.id,
        name=payload.name,
        lineup_data=payload.lineup_data,
        total_salary=payload.total_salary,
        projected_fpts=payload.projected_fpts,
        salary_mode=payload.salary_mode,
    )
    db.add(lineup)
    db.commit()
    db.refresh(lineup)
    logger.info("User %s saved lineup set: %r", current_user.email, lineup.name)
    return lineup  # type: ignore[return-value]


@router.get("", response_model=list[SavedLineupOut])
def list_lineups(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[SavedLineupOut]:
    return (
        db.query(SavedLineup)
        .filter(SavedLineup.user_id == current_user.id)
        .order_by(SavedLineup.created_at.desc())
        .all()
    )  # type: ignore[return-value]


@router.delete("/{lineup_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_lineup(
    lineup_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    lineup = (
        db.query(SavedLineup)
        .filter(SavedLineup.id == lineup_id, SavedLineup.user_id == current_user.id)
        .first()
    )
    if lineup is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lineup not found")
    db.delete(lineup)
    db.commit()
