"""Semantic search endpoint for product discovery."""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.middleware.auth import Store, get_verified_store
from app.models.search import SearchRequest, SearchResult
from app.search.semantic_search import search

router = APIRouter()


@router.post("/api/ai/search", response_model=list[SearchResult])
async def semantic_search(
    body: SearchRequest,
    store: Store = Depends(get_verified_store),
    db: AsyncSession = Depends(get_db),
) -> list[SearchResult]:
    """Search products using vector similarity and text fallback.

    Uses OpenAI embeddings + pgvector for semantic search, with an ILIKE
    fallback for products that lack embeddings. Results are merged and
    deduplicated by relevance score.
    """
    return await search(
        query=body.query,
        db=db,
        store_id=body.store_id,
        category=body.category,
        limit=body.limit,
    )
