"""
Router: /api/trial

Endpoints:
  POST /api/trial-signup — register an email for free trial access until May 15
"""
from __future__ import annotations

import logging
import secrets
import string
from datetime import datetime, timezone

import bcrypt
from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session

from database import get_db
from limiter import limiter
from models import Token, User, UserOut
from routers.auth import _create_access_token

logger = logging.getLogger(__name__)

# Free trial ends May 15, 2026 at midnight UTC
TRIAL_END = datetime(2026, 5, 15, 23, 59, 59, tzinfo=timezone.utc)

router = APIRouter(prefix="/api", tags=["trial"])


class TrialSignupRequest(BaseModel):
    email: EmailStr


class TrialSignupResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    trial_expires_at: str  # ISO string for frontend display


def _random_password() -> str:
    """Generate a secure random password for trial accounts (user never sees it)."""
    alphabet = string.ascii_letters + string.digits
    return "".join(secrets.choice(alphabet) for _ in range(32))


def _random_username(email: str) -> str:
    """Derive a unique-enough username from the email + random suffix."""
    base = email.split("@")[0][:20].replace(".", "_").replace("+", "_")
    suffix = secrets.token_hex(3)  # 6 hex chars
    return f"{base}_{suffix}"


@router.post("/trial-signup", response_model=TrialSignupResponse)
@limiter.limit("5/minute")
def trial_signup(
    request: Request,
    payload: TrialSignupRequest,
    db: Session = Depends(get_db),
) -> TrialSignupResponse:
    """
    Register or re-activate a free trial account by email only.

    - If the email is new: creates an account with a random password and grants trial access.
    - If the email exists with status 'free': upgrades to trial.
    - If the email already has 'pro' or active trial: returns a token immediately.
    - Returns a JWT so the frontend can log the user in automatically.
    """
    now = datetime.now(timezone.utc)

    if now > TRIAL_END:
        raise HTTPException(
            status_code=status.HTTP_410_GONE,
            detail="The free trial period has ended. Please sign up for a Pro subscription.",
        )

    email = payload.email.lower().strip()
    user = db.query(User).filter(User.email == email).first()

    if user is None:
        # New email — create a trial account
        user = User(
            email=email,
            username=_random_username(email),
            hashed_password=bcrypt.hashpw(
                _random_password().encode(), bcrypt.gensalt(12)
            ).decode(),
            subscription_status="trial",
            trial_expires_at=TRIAL_END,
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        logger.info("New trial account created: %s", email)
    elif user.subscription_status == "pro":
        # Already a paying subscriber — just return a token
        logger.info("Trial signup for existing Pro user: %s", email)
    else:
        # Existing free/trial/lapsed user — grant/extend trial
        user.subscription_status = "trial"
        user.trial_expires_at = TRIAL_END
        db.commit()
        logger.info("Trial activated/extended for existing user: %s", email)

    token = _create_access_token(user.email)
    return TrialSignupResponse(
        access_token=token,
        trial_expires_at=TRIAL_END.isoformat(),
    )
