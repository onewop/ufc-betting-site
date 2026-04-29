"""
UFC DFS Optimizer — FastAPI application entry point.

Run with:
    cd ufc-betting-site-main
    uvicorn main:app --reload --port 8000
"""
from __future__ import annotations

import logging
import os

from dotenv import load_dotenv

# Load environment variables from .env file as early as possible
load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

from database import Base, engine
from limiter import limiter
from routers.auth import router as auth_router
from routers.fighters import router as fighters_router
from routers.lineups import router as lineups_router
from routers.optimize import router as optimize_router
from routers.payments import router as payments_router
from routers.stats import router as stats_router
from routers.trial import router as trial_router

# ── Logging ───────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s — %(message)s",
)
logger = logging.getLogger(__name__)


# ── App factory ───────────────────────────────────────────────────────────────
def create_app() -> FastAPI:
    _env = os.getenv("ENVIRONMENT", "production").lower()
    _is_dev = _env in ("development", "dev", "local")

    app = FastAPI(
        title="UFC DFS Optimizer API",
        description="Backend for generating DraftKings UFC DFS lineups.",
        version="0.1.0",
        docs_url="/docs" if _is_dev else None,
        redoc_url="/redoc" if _is_dev else None,
    )

    # ── Rate limiter ─────────────────────────────────────────────────────────
    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
    app.add_middleware(SlowAPIMiddleware)

    # ── CORS ─────────────────────────────────────────────────────────────────
    cors_origins = [
        origin.strip()
        for origin in os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",")
        if origin.strip()
    ]
    logger.info("CORS allow_origins: %s", cors_origins)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # ── Create DB tables ─────────────────────────────────────────────────────
    @app.on_event("startup")
    def on_startup() -> None:
        logger.info("Creating database tables if not present…")
        Base.metadata.create_all(bind=engine)
        logger.info("Database ready.")

    # ── Routers ──────────────────────────────────────────────────────────────
    app.include_router(auth_router)
    app.include_router(fighters_router)
    app.include_router(lineups_router)
    app.include_router(optimize_router)
    app.include_router(payments_router)
    app.include_router(stats_router)
    app.include_router(trial_router)

    # ── Health check ─────────────────────────────────────────────────────────
    @app.get("/health", tags=["meta"])
    def health() -> dict[str, str]:
        return {"status": "ok"}

    return app


app = create_app()
