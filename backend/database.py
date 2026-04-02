"""
SQLite + SQLAlchemy setup.
Provides engine, session factory, Base, and a FastAPI dependency.
"""
import os
from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker, Session

# ── Database file sits inside backend/ ───────────────────────────────────────
BASE_DIR = Path(__file__).resolve().parent
DATABASE_URL = os.getenv("DATABASE_URL", f"sqlite:///{BASE_DIR / 'ufc_dfs.db'}")

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False},  # required for SQLite multi-thread
    echo=False,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


# ── FastAPI dependency ───────────────────────────────────────────────────────
def get_db() -> Session:  # type: ignore[return]
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
