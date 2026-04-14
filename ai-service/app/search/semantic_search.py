import logging

from sqlalchemy import text as sql_text
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.search import SearchResult
from app.search.embeddings import generate_embedding

logger = logging.getLogger(__name__)


async def search(
    query: str,
    db: AsyncSession,
    store_id: str | None = None,
    category: str | None = None,
    limit: int = 20,
) -> list[SearchResult]:
    """Search store products using vector similarity and text fallback.

    Generates an embedding for the query and searches against pgvector
    embeddings on store_products. Also performs a text ILIKE fallback for
    products that lack embeddings. Results are merged and deduplicated.

    Args:
        query: The search query string.
        db: Async SQLAlchemy database session.
        store_id: Optional store UUID to scope results to a single store.
        category: Optional category filter (case-insensitive).
        limit: Maximum number of results to return.

    Returns:
        A list of SearchResult objects sorted by relevance score.
    """
    results_map: dict[str, SearchResult] = {}

    embedding = await generate_embedding(query)
    if embedding:
        vector_results = await _vector_search(db, embedding, store_id, category, limit)
        for r in vector_results:
            results_map[r.product_id] = r

    text_results = await _text_search(db, query, store_id, category, limit)
    for r in text_results:
        if r.product_id not in results_map or r.score > results_map[r.product_id].score:
            results_map[r.product_id] = r

    sorted_results = sorted(results_map.values(), key=lambda r: r.score, reverse=True)
    return sorted_results[:limit]


async def _vector_search(
    db: AsyncSession,
    embedding: list[float],
    store_id: str | None,
    category: str | None,
    limit: int,
) -> list[SearchResult]:
    """Search using pgvector cosine similarity."""
    where_clauses = ["sp.is_available = true", "sp.embedding IS NOT NULL"]
    params: dict = {"emb": str(embedding), "lim": limit}

    if store_id:
        where_clauses.append("sp.store_id = :store_id")
        params["store_id"] = store_id
    if category:
        where_clauses.append("sp.category ILIKE :category")
        params["category"] = f"%{category}%"

    where_sql = " AND ".join(where_clauses)
    query = sql_text(
        f"SELECT sp.id, sp.store_id, s.name as store_name, sp.name as product_name, "
        f"sp.price, sp.image_urls, 1 - (sp.embedding <=> :emb::vector) as score "
        f"FROM store_products sp "
        f"JOIN stores s ON sp.store_id = s.id "
        f"WHERE {where_sql} "
        f"ORDER BY sp.embedding <=> :emb::vector LIMIT :lim"
    )

    try:
        result = await db.execute(query, params)
        rows = result.fetchall()
    except Exception:
        logger.exception("Vector search failed")
        return []

    return [
        SearchResult(
            product_id=str(row.id),
            store_id=str(row.store_id),
            store_name=row.store_name,
            product_name=row.product_name,
            price=float(row.price),
            image_url=row.image_urls[0] if row.image_urls else None,
            score=float(row.score),
        )
        for row in rows
    ]


async def _text_search(
    db: AsyncSession,
    query: str,
    store_id: str | None,
    category: str | None,
    limit: int,
) -> list[SearchResult]:
    """Fallback text search using ILIKE for products without embeddings."""
    where_clauses = ["sp.is_available = true", "sp.name ILIKE :q"]
    params: dict = {"q": f"%{query}%", "lim": limit}

    if store_id:
        where_clauses.append("sp.store_id = :store_id")
        params["store_id"] = store_id
    if category:
        where_clauses.append("sp.category ILIKE :category")
        params["category"] = f"%{category}%"

    where_sql = " AND ".join(where_clauses)
    text_query = sql_text(
        f"SELECT sp.id, sp.store_id, s.name as store_name, sp.name as product_name, "
        f"sp.price, sp.image_urls "
        f"FROM store_products sp "
        f"JOIN stores s ON sp.store_id = s.id "
        f"WHERE {where_sql} "
        f"ORDER BY sp.name LIMIT :lim"
    )

    try:
        result = await db.execute(text_query, params)
        rows = result.fetchall()
    except Exception:
        logger.exception("Text search failed")
        return []

    return [
        SearchResult(
            product_id=str(row.id),
            store_id=str(row.store_id),
            store_name=row.store_name,
            product_name=row.product_name,
            price=float(row.price),
            image_url=row.image_urls[0] if row.image_urls else None,
            score=0.5,
        )
        for row in rows
    ]
