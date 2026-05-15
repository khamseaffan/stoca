import json
import logging
from urllib.parse import quote_plus

import httpx
from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.enrichment.product_enricher import enrich
from app.middleware.auth import Store, get_verified_store
from app.routers.tool_models import (
    EnrichProductDescriptionReq,
    EnrichProductsBulkReq,
    SearchProductImageReq,
)

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("/api/tools/search-product-image")
async def search_product_image(
    body: SearchProductImageReq,
    store: Store = Depends(get_verified_store),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Find an image for a product using Pexels API (or placeholder fallback)."""
    # Find the product first
    result = await db.execute(
        text(
            "SELECT id, name FROM store_products "
            "WHERE store_id = :sid AND name ILIKE :name AND is_available = true LIMIT 5"
        ),
        {"sid": store.id, "name": f"%{body.product_name}%"},
    )
    rows = result.fetchall()

    if not rows:
        return {"success": False, "result": f"No product matching '{body.product_name}'."}
    if len(rows) > 1:
        names = [r.name for r in rows]
        return {"success": False, "result": f"Multiple matches: {names}. Which one?"}

    product = rows[0]
    image_url: str | None = None

    # Try Pexels API if key is available
    if settings.pexels_api_key:
        try:
            search_query = f"{product.name} {body.category or ''}".strip()
            async with httpx.AsyncClient() as client:
                resp = await client.get(
                    "https://api.pexels.com/v1/search",
                    params={"query": search_query, "per_page": 1, "orientation": "square"},
                    headers={"Authorization": settings.pexels_api_key},
                    timeout=10,
                )
                if resp.status_code == 200:
                    data = resp.json()
                    if data.get("photos"):
                        image_url = data["photos"][0]["src"]["medium"]
        except Exception:
            logger.warning("Pexels API failed for '%s', using placeholder", product.name)

    # Fallback to placeholder
    if not image_url:
        encoded_name = quote_plus(product.name)
        image_url = f"https://placehold.co/400x400/e2e8f0/64748b?text={encoded_name}"

    # Update the product
    await db.execute(
        text("UPDATE store_products SET image_urls = ARRAY[:url] WHERE id = :id"),
        {"url": image_url, "id": str(product.id)},
    )
    await db.commit()
    return {"success": True, "result": f"Found image for {product.name}"}


@router.post("/api/tools/enrich-product-description")
async def enrich_product_description(
    body: EnrichProductDescriptionReq,
    store: Store = Depends(get_verified_store),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Generate a compelling description for a product using Claude."""
    result = await db.execute(
        text(
            "SELECT id, name, price, category FROM store_products "
            "WHERE store_id = :sid AND name ILIKE :name AND is_available = true LIMIT 5"
        ),
        {"sid": store.id, "name": f"%{body.product_name}%"},
    )
    rows = result.fetchall()

    if not rows:
        return {"success": False, "result": f"No product matching '{body.product_name}'."}
    if len(rows) > 1:
        names = [r.name for r in rows]
        return {"success": False, "result": f"Multiple matches: {names}. Which one?"}

    product = rows[0]
    enriched = await enrich(
        name=product.name,
        price=float(product.price) if product.price else None,
        category=product.category,
    )

    await db.execute(
        text("UPDATE store_products SET description = :desc WHERE id = :id"),
        {"desc": enriched.description, "id": str(product.id)},
    )
    await db.commit()
    return {"success": True, "result": f"Updated description for {product.name}: {enriched.description}"}


@router.post("/api/tools/enrich-products-bulk")
async def enrich_products_bulk(
    body: EnrichProductsBulkReq,
    store: Store = Depends(get_verified_store),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Bulk-enrich products: find images or generate descriptions."""
    MAX_PER_CALL = 20

    if body.filter == "missing_images":
        result = await db.execute(
            text(
                "SELECT id, name, category FROM store_products "
                "WHERE store_id = :sid AND is_available = true "
                "AND (image_urls IS NULL OR image_urls = '{}') "
                "LIMIT :lim"
            ),
            {"sid": store.id, "lim": MAX_PER_CALL},
        )
        rows = result.fetchall()
        if not rows:
            return {"success": True, "result": "All products already have images."}

        count = 0
        for r in rows:
            encoded_name = quote_plus(r.name)
            url = f"https://placehold.co/400x400/e2e8f0/64748b?text={encoded_name}"

            if settings.pexels_api_key:
                try:
                    search_q = f"{r.name} {r.category or ''}".strip()
                    async with httpx.AsyncClient() as client:
                        resp = await client.get(
                            "https://api.pexels.com/v1/search",
                            params={"query": search_q, "per_page": 1, "orientation": "square"},
                            headers={"Authorization": settings.pexels_api_key},
                            timeout=10,
                        )
                        if resp.status_code == 200:
                            data = resp.json()
                            if data.get("photos"):
                                url = data["photos"][0]["src"]["medium"]
                except Exception:
                    pass

            await db.execute(
                text("UPDATE store_products SET image_urls = ARRAY[:url] WHERE id = :id"),
                {"url": url, "id": str(r.id)},
            )
            count += 1

        await db.commit()
        return {"success": True, "result": f"Enriched {count} products with images"}

    elif body.filter == "missing_descriptions":
        result = await db.execute(
            text(
                "SELECT id, name, price, category FROM store_products "
                "WHERE store_id = :sid AND is_available = true "
                "AND (description IS NULL OR description = '') "
                "LIMIT :lim"
            ),
            {"sid": store.id, "lim": MAX_PER_CALL},
        )
        rows = result.fetchall()
        if not rows:
            return {"success": True, "result": "All products already have descriptions."}

        count = 0
        for r in rows:
            enriched = await enrich(
                name=r.name,
                price=float(r.price) if r.price else None,
                category=r.category,
            )
            await db.execute(
                text("UPDATE store_products SET description = :desc WHERE id = :id"),
                {"desc": enriched.description, "id": str(r.id)},
            )
            count += 1

        await db.commit()
        return {"success": True, "result": f"Enriched {count} products with descriptions"}

    else:  # "all"
        # Count what needs enrichment
        img_result = await db.execute(
            text(
                "SELECT id, name, category FROM store_products "
                "WHERE store_id = :sid AND is_available = true "
                "AND (image_urls IS NULL OR image_urls = '{}') "
                "LIMIT :lim"
            ),
            {"sid": store.id, "lim": MAX_PER_CALL},
        )
        img_rows = img_result.fetchall()

        desc_result = await db.execute(
            text(
                "SELECT id, name, price, category FROM store_products "
                "WHERE store_id = :sid AND is_available = true "
                "AND (description IS NULL OR description = '') "
                "LIMIT :lim"
            ),
            {"sid": store.id, "lim": MAX_PER_CALL},
        )
        desc_rows = desc_result.fetchall()

        img_count = 0
        for r in img_rows:
            encoded_name = quote_plus(r.name)
            url = f"https://placehold.co/400x400/e2e8f0/64748b?text={encoded_name}"
            await db.execute(
                text("UPDATE store_products SET image_urls = ARRAY[:url] WHERE id = :id"),
                {"url": url, "id": str(r.id)},
            )
            img_count += 1

        desc_count = 0
        for r in desc_rows:
            enriched = await enrich(
                name=r.name,
                price=float(r.price) if r.price else None,
                category=r.category,
            )
            await db.execute(
                text("UPDATE store_products SET description = :desc WHERE id = :id"),
                {"desc": enriched.description, "id": str(r.id)},
            )
            desc_count += 1

        await db.commit()
        parts = []
        if img_count:
            parts.append(f"{img_count} with images")
        if desc_count:
            parts.append(f"{desc_count} with descriptions")
        if not parts:
            return {"success": True, "result": "All products already have images and descriptions."}
        return {"success": True, "result": f"Enriched {', '.join(parts)}"}
