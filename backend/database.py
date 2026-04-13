"""
PostgreSQL + SQLAlchemy setup (Railway-compatible).
Provides engine, session factory, Base, and a FastAPI dependency.

Falls back to a local SQLite file when DATABASE_URL is not set, so local
development still works without a Postgres instance.
"""
import os
from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker, Session

# ── Resolve DATABASE_URL ──────────────────────────────────────────────────────
# Railway injects DATABASE_URL with the legacy "postgres://" scheme; psycopg2
# requires "postgresql://".  Normalize it here so both work transparently.
BASE_DIR = Path(__file__).resolve().parent
_raw_url = os.getenv("DATABASE_URL", f"sqlite:///{BASE_DIR / 'ufc_dfs.db'}")

DATABASE_URL: str = (
    _raw_url.replace("postgres://", "postgresql://", 1)
    if _raw_url.startswith("postgres://")
    else _raw_url
)

# ── Engine — SQLite needs check_same_thread; Postgres must NOT have it ────────
_is_sqlite = DATABASE_URL.startswith("sqlite")
_connect_args = {"check_same_thread": False} if _is_sqlite else {}

engine = create_engine(
    DATABASE_URL,
    connect_args=_connect_args,
    pool_pre_ping=True,  # resilient to dropped connections on Railway
    echo=False,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


# ── FastAPI dependency ────────────────────────────────────────────────────────
def get_db() -> Session:  # type: ignore[return]
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
