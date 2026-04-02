"""
UFC DFS Optimizer — FastAPI application entry point.

Run with:
    cd ufc-betting-site-main
    uvicorn backend.main:app --reload --port 8000
"""
from __future__ import annotations

import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.database import Base, engine
from backend.routers.auth import router as auth_router
from backend.routers.optimize import router as optimize_router

# ── Logging ───────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s — %(message)s",
)
logger = logging.getLogger(__name__)


# ── App factory ───────────────────────────────────────────────────────────────
def create_app() -> FastAPI:
    app = FastAPI(
        title="UFC DFS Optimizer API",
        description="Backend for generating DraftKings UFC DFS lineups.",
        version="0.1.0",
        docs_url="/docs",
        redoc_url="/redoc",
    )

    # ── CORS ─────────────────────────────────────────────────────────────────
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://localhost:3000"],
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
    app.include_router(optimize_router)

    # ── Health check ─────────────────────────────────────────────────────────
    @app.get("/health", tags=["meta"])
    def health() -> dict[str, str]:
        return {"status": "ok"}

    return app


app = create_app()
