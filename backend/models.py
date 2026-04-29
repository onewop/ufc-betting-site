"""
Pydantic schemas (request/response) and SQLAlchemy ORM models.
Section 1 — ORM models (mapped to DB tables).
Section 2 — Pydantic schemas (API layer).
"""
from __future__ import annotations

import datetime
from typing import Any

from pydantic import BaseModel, EmailStr, Field, field_validator
from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, JSON, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database import Base

# ═════════════════════════════════════════════════════════════════════════════
# Section 1 — SQLAlchemy ORM models
# ═════════════════════════════════════════════════════════════════════════════


class User(Base):
    """Registered user — stores credentials and profile."""
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    username: Mapped[str] = mapped_column(String(50), unique=True, index=True, nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    stripe_customer_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    subscription_status: Mapped[str] = mapped_column(String(20), default="free", nullable=False)
    trial_expires_at: Mapped[datetime.datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    def __repr__(self) -> str:
        return f"<User id={self.id} username={self.username!r}>"


class Event(Base):
    __tablename__ = "events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    date: Mapped[str] = mapped_column(String(20), nullable=True)  # ISO date string

    lineups: Mapped[list["CachedLineup"]] = relationship(
        "CachedLineup", back_populates="event", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<Event id={self.id} title={self.title!r}>"


class CachedLineup(Base):
    __tablename__ = "cached_lineups"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    event_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("events.id"), nullable=False, index=True
    )
    lineup_json: Mapped[str] = mapped_column(Text, nullable=False)
    salary_mode: Mapped[str] = mapped_column(String(20), nullable=False, default="diverse")
    created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    event: Mapped["Event"] = relationship("Event", back_populates="lineups")

    def __repr__(self) -> str:
        return f"<CachedLineup id={self.id} event_id={self.event_id}>"


class SavedLineup(Base):
    """Lineup set saved by a logged-in user."""
    __tablename__ = "saved_lineups"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    lineup_data: Mapped[Any] = mapped_column(JSON, nullable=False)
    total_salary: Mapped[int] = mapped_column(Integer, nullable=False)
    projected_fpts: Mapped[float] = mapped_column(Float, nullable=False)
    salary_mode: Mapped[str] = mapped_column(String(20), nullable=False, default="diverse")
    created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    def __repr__(self) -> str:
        return f"<SavedLineup id={self.id} user_id={self.user_id} name={self.name!r}>"


class HistoricalResult(Base):
    __tablename__ = "historical_results"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    event_title: Mapped[str] = mapped_column(String(255), nullable=False)
    event_date: Mapped[str] = mapped_column(String(20), nullable=True)
    fighter_name: Mapped[str] = mapped_column(String(255), nullable=False)
    dk_salary: Mapped[int] = mapped_column(Integer, nullable=True)
    actual_fpts: Mapped[str] = mapped_column(String(20), nullable=True)  # float stored as str for flexibility
    result: Mapped[str] = mapped_column(String(10), nullable=True)  # "W" | "L" | "D" | "NC"
    created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    def __repr__(self) -> str:
        return f"<HistoricalResult id={self.id} fighter={self.fighter_name!r}>"


# ═════════════════════════════════════════════════════════════════════════════
# Section 2 — Pydantic schemas
# ═════════════════════════════════════════════════════════════════════════════

SalaryMode = str  # "higher" | "medium" | "diverse" — validated below


class OptimizeRequest(BaseModel):
    num_lineups: int = Field(default=5, ge=1, le=150, description="Number of lineups to generate")
    salary_mode: SalaryMode = Field(default="diverse", description="diverse (default/balanced) | medium (higher salaries) | higher (aggressive/max)")
    locked_fighters: list[str] = Field(default_factory=list, description="Fighter IDs to lock in every lineup")
    excluded_fighters: list[str] = Field(default_factory=list, description="Fighter IDs to exclude entirely")
    exposure_limit: float = Field(default=1.0, ge=0.0, le=1.0, description="Max exposure fraction per fighter (0.0–1.0)")
    fighter_overrides: dict[str, dict[str, float]] = Field(
        default_factory=dict,
        description="Per-fighter exposure overrides: {fighter_id: {min_exposure: 0.0-1.0, max_exposure: 0.0-1.0}}",
    )

    @field_validator("salary_mode")
    @classmethod
    def validate_salary_mode(cls, v: str) -> str:
        allowed = {"higher", "medium", "diverse"}
        if v not in allowed:
            raise ValueError(f"salary_mode must be one of {allowed}")
        return v


class FighterOut(BaseModel):
    id: str
    name: str
    salary: int
    avgFPPG: float
    fight_id: str


class FightersResponse(BaseModel):
    fights: list[str]
    fighters: list[FighterOut]


class LineupOut(BaseModel):
    fighters: list[dict[str, Any]]
    total_salary: int
    projected_fpts: float


class OptimizeResponse(BaseModel):
    status: str
    lineups: list[LineupOut]
    num_requested: int
    num_generated: int
    salary_mode: str
    echoed_request: OptimizeRequest


# ── Event schemas ─────────────────────────────────────────────────────────────

class EventCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    date: str | None = None


class EventOut(BaseModel):
    id: int
    title: str
    date: str | None

    model_config = {"from_attributes": True}


# ── CachedLineup schemas ──────────────────────────────────────────────────────

class CachedLineupOut(BaseModel):
    id: int
    event_id: int
    lineup_json: str
    salary_mode: str
    created_at: datetime.datetime

    model_config = {"from_attributes": True}


# ── Auth schemas ──────────────────────────────────────────────────────────────

class UserCreate(BaseModel):
    """Payload for POST /auth/register."""
    email: EmailStr
    username: str = Field(..., min_length=3, max_length=50, pattern=r"^[a-zA-Z0-9_-]+$")
    password: str = Field(..., min_length=8, description="Minimum 8 characters")


class UserLogin(BaseModel):
    """Payload for POST /auth/login."""
    email: EmailStr
    password: str


class Token(BaseModel):
    """JWT token returned on successful login."""
    access_token: str
    token_type: str = "bearer"


class TokenData(BaseModel):
    """Data encoded inside the JWT."""
    sub: str  # subject = user email


class UserOut(BaseModel):
    """Safe user representation — never includes hashed_password."""
    id: int
    email: str
    username: str
    is_active: bool
    created_at: datetime.datetime
    subscription_status: str
    trial_expires_at: datetime.datetime | None = None

    model_config = {"from_attributes": True}


# ── SavedLineup schemas ───────────────────────────────────────────────────────

class SavedLineupCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    lineup_data: list[Any]
    total_salary: int
    projected_fpts: float
    salary_mode: str = "diverse"


class SavedLineupOut(BaseModel):
    id: int
    user_id: int
    name: str
    lineup_data: list[Any]
    total_salary: int
    projected_fpts: float
    salary_mode: str
    created_at: datetime.datetime

    model_config = {"from_attributes": True}
