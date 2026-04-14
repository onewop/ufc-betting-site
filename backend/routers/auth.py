"""
Router: /auth

Endpoints:
  POST /auth/register  — create a new account
  POST /auth/login     — authenticate and receive a JWT
  GET  /auth/me        — return the current user (requires valid JWT)
"""
from __future__ import annotations

import logging
import os
from datetime import datetime, timedelta, timezone
from typing import Annotated

import bcrypt
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from sqlalchemy.orm import Session

from database import get_db
from models import Token, TokenData, User, UserCreate, UserLogin, UserOut

logger = logging.getLogger(__name__)

# ── JWT configuration ─────────────────────────────────────────────────────────
# AUTH_SECRET_KEY must be set in .env — the server will refuse to start without it.
#   Generate one with: python -c "import secrets; print(secrets.token_hex(32))"
SECRET_KEY: str = os.getenv("AUTH_SECRET_KEY", "")
if not SECRET_KEY:
    raise RuntimeError(
        "AUTH_SECRET_KEY environment variable is not set. "
        "Generate one with: python -c \"import secrets; print(secrets.token_hex(32))\" "
        "and add it to your .env file."
    )
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_DAYS = 7

# ── Password hashing ──────────────────────────────────────────────────────────
# Using bcrypt directly (passlib 1.7.4 is incompatible with bcrypt 4.x+).
_BCRYPT_ROUNDS = 12  # work factor — increase to slow down brute-force

# ── OAuth2 scheme — reads Bearer token from Authorization header ──────────────
_oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")

router = APIRouter(prefix="/auth", tags=["auth"])


# ── Internal helpers ──────────────────────────────────────────────────────────

def _hash_password(plain: str) -> str:
    return bcrypt.hashpw(plain.encode(), bcrypt.gensalt(_BCRYPT_ROUNDS)).decode()


def _verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode(), hashed.encode())


def _create_access_token(subject: str) -> str:
    """Encode a JWT with the user's email as the subject claim."""
    expire = datetime.now(timezone.utc) + timedelta(days=ACCESS_TOKEN_EXPIRE_DAYS)
    payload = {"sub": subject, "exp": expire}
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def _get_user_by_email(db: Session, email: str) -> User | None:
    return db.query(User).filter(User.email == email).first()


def _get_user_by_username(db: Session, username: str) -> User | None:
    return db.query(User).filter(User.username == username).first()


# ── Reusable dependency: resolve current user from JWT ────────────────────────

def get_current_user(
    token: Annotated[str, Depends(_oauth2_scheme)],
    db: Session = Depends(get_db),
) -> User:
    """
    FastAPI dependency that decodes the Bearer JWT and returns the User.
    Raises HTTP 401 if the token is missing, expired, or invalid.
    """
    credentials_exc = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str | None = payload.get("sub")
        if email is None:
            raise credentials_exc
        token_data = TokenData(sub=email)
    except JWTError:
        raise credentials_exc

    user = _get_user_by_email(db, token_data.sub)
    if user is None or not user.is_active:
        raise credentials_exc
    return user


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post(
    "/register",
    response_model=UserOut,
    status_code=status.HTTP_201_CREATED,
    summary="Register a new user",
)
def register(payload: UserCreate, db: Session = Depends(get_db)) -> UserOut:
    """
    Create a new account.  Returns the created user (without password).

    - **email**: must be unique
    - **username**: 3–50 chars, alphanumeric / underscore / dash; must be unique
    - **password**: minimum 8 characters (stored as bcrypt hash)
    """
    if _get_user_by_email(db, payload.email):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email already registered",
        )
    if _get_user_by_username(db, payload.username):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Username already taken",
        )

    user = User(
        email=payload.email,
        username=payload.username,
        hashed_password=_hash_password(payload.password),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    logger.info("New user registered: %s", user.email)
    return user  # type: ignore[return-value]


@router.post(
    "/login",
    response_model=Token,
    summary="Login and receive a JWT access token",
)
def login(payload: UserLogin, db: Session = Depends(get_db)) -> Token:
    """
    Authenticate with email + password.  Returns a Bearer JWT valid for 7 days.

    The token must be sent in subsequent requests as:
      `Authorization: Bearer <token>`
    """
    user = _get_user_by_email(db, payload.email)
    # Deliberately give the same error for "user not found" and "wrong password"
    # to avoid username enumeration.
    if user is None or not _verify_password(payload.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is disabled",
        )

    # TEMP: For testing, if user has stripe_customer_id, force pro status
    if user.stripe_customer_id and user.subscription_status != "pro":
        user.subscription_status = "pro"
        db.commit()
        logger.info("Forced pro status for user with stripe_customer_id: %s", user.email)

    token = _create_access_token(user.email)
    logger.info("User logged in: %s", user.email)
    return Token(access_token=token)


@router.get(
    "/me",
    response_model=UserOut,
    summary="Get current authenticated user",
)
def get_me(current_user: Annotated[User, Depends(get_current_user)], db: Session = Depends(get_db)) -> UserOut:
    """
    Return the profile of the currently authenticated user.
    Requires a valid Bearer JWT in the Authorization header.
    """
    # TEMP: For testing, if user has stripe_customer_id, force pro status
    if current_user.stripe_customer_id and current_user.subscription_status != "pro":
        current_user.subscription_status = "pro"
        db.commit()
        logger.info("Forced pro status for user with stripe_customer_id: %s", current_user.email)

    return UserOut.from_orm(current_user)
