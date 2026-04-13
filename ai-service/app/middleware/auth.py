import logging
from dataclasses import dataclass

from fastapi import Depends, HTTPException, Request
from jose import JWTError, jwt
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db

logger = logging.getLogger(__name__)


@dataclass
class Store:
    """Resolved store from JWT auth."""

    id: str
    owner_id: str
    name: str
    store_type: str


async def get_verified_store(
    request: Request, db: AsyncSession = Depends(get_db)
) -> Store:
    """Extract JWT from Authorization header, validate it, and resolve store ownership.

    Used as a FastAPI dependency on every tool endpoint to ensure the caller
    is an authenticated store owner.

    Args:
        request: The incoming HTTP request.
        db: Async database session.

    Returns:
        Store object for the authenticated owner.

    Raises:
        HTTPException: 401 if JWT is missing/invalid, 403 if user doesn't own a store.
    """
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing authorization token")

    token = auth_header.removeprefix("Bearer ")

    try:
        payload = jwt.decode(
            token,
            settings.supabase_jwt_secret,
            algorithms=["HS256"],
            audience="authenticated",
        )
    except JWTError as e:
        logger.warning("JWT validation failed: %s", e)
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid token: missing sub claim")

    result = await db.execute(
        text(
            "SELECT id, owner_id, name, store_type FROM stores WHERE owner_id = :uid LIMIT 1"
        ),
        {"uid": user_id},
    )
    row = result.fetchone()

    if not row:
        raise HTTPException(status_code=403, detail="User does not own a store")

    return Store(
        id=str(row.id),
        owner_id=str(row.owner_id),
        name=row.name,
        store_type=row.store_type,
    )
