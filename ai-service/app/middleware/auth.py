import logging
from dataclasses import dataclass

import httpx
from fastapi import Depends, HTTPException, Request
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
    """Extract JWT from Authorization header, validate via Supabase, and resolve store ownership.

    Uses Supabase's /auth/v1/user endpoint to validate the token, which handles
    both HS256 and ES256 algorithms transparently.

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

    # Validate token via Supabase Auth API
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"{settings.supabase_url}/auth/v1/user",
                headers={
                    "Authorization": f"Bearer {token}",
                    "apikey": settings.supabase_service_role_key,
                },
                timeout=10.0,
            )

        if resp.status_code != 200:
            logger.warning("Supabase auth validation failed: %s", resp.text)
            raise HTTPException(status_code=401, detail="Invalid or expired token")

        user_data = resp.json()
        user_id = user_data.get("id")
    except httpx.RequestError as e:
        logger.error("Failed to reach Supabase auth: %s", e)
        raise HTTPException(status_code=401, detail="Auth service unavailable")

    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid token: missing user ID")

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
