import json

from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.middleware.auth import Store, get_verified_store
from app.routers.tool_models import (
    CreatePromotionReq,
    ListPromotionsReq,
    PromotionLookupReq,
    PromotionPerformanceReq,
    UpdatePromotionReq,
)
from app.routers.tool_utils import find_single_product, find_single_promotion, promotion_to_dict

router = APIRouter()


@router.post("/api/tools/create-promotion")
async def create_promotion(
    body: CreatePromotionReq,
    store: Store = Depends(get_verified_store),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Create a discount promotion."""
    if (body.discount_percent is None) == (body.discount_amount is None):
        return {"success": False, "result": "Provide exactly one of discount_percent or discount_amount."}

    product_id = None
    if body.product_name:
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
        product_id = str(rows[0].id)

    await db.execute(
        text(
            "INSERT INTO promotions "
            "(store_id, store_product_id, title, discount_percent, discount_amount, start_date, end_date) "
            "VALUES (:sid, :pid, :title, :pct, :amt, COALESCE(:start_date, now()), :end_date)"
        ),
        {
            "sid": store.id,
            "pid": product_id,
            "title": body.title,
            "pct": body.discount_percent,
            "amt": body.discount_amount,
            "start_date": body.start_date,
            "end_date": body.end_date,
        },
    )
    await db.commit()

    discount_str = (
        f"{body.discount_percent}% off"
        if body.discount_percent
        else f"${body.discount_amount:.2f} off"
    )
    target = f" on {body.product_name}" if body.product_name else ""
    return {"success": True, "result": f"Created promotion '{body.title}': {discount_str}{target}."}


@router.post("/api/tools/list-promotions")
async def list_promotions(
    body: ListPromotionsReq,
    store: Store = Depends(get_verified_store),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """List promotions by status."""
    status_clauses = {
        "active": "p.is_active = true AND p.start_date <= now() AND (p.end_date IS NULL OR p.end_date >= now())",
        "scheduled": "p.is_active = true AND p.start_date > now()",
        "expired": "p.end_date IS NOT NULL AND p.end_date < now()",
        "inactive": "p.is_active = false",
        "all": "true",
    }
    if body.status not in status_clauses:
        return {"success": False, "result": f"Invalid status. Use: {sorted(status_clauses.keys())}"}

    result = await db.execute(
        text(
            "SELECT p.*, sp.name as product_name "
            "FROM promotions p "
            "LEFT JOIN store_products sp ON sp.id = p.store_product_id "
            f"WHERE p.store_id = :sid AND {status_clauses[body.status]} "
            "ORDER BY p.created_at DESC LIMIT :lim"
        ),
        {"sid": store.id, "lim": body.limit},
    )
    promotions = [promotion_to_dict(r) for r in result.fetchall()]
    return {"success": True, "result": json.dumps(promotions)}


@router.post("/api/tools/get-promotion-details")
async def get_promotion_details(
    body: PromotionLookupReq,
    store: Store = Depends(get_verified_store),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Get a single promotion by id or title."""
    promotion, error = await find_single_promotion(db, store.id, body)
    if error:
        return {"success": False, "result": error}
    return {"success": True, "result": json.dumps(promotion_to_dict(promotion))}


@router.post("/api/tools/update-promotion")
async def update_promotion(
    body: UpdatePromotionReq,
    store: Store = Depends(get_verified_store),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Update promotion fields."""
    promotion, error = await find_single_promotion(db, store.id, body)
    if error:
        return {"success": False, "result": error}

    updates: list[str] = []
    params: dict = {"id": str(promotion.id)}
    if body.title_new is not None:
        updates.append("title = :title_new")
        params["title_new"] = body.title_new
    if body.discount_percent is not None:
        updates.append("discount_percent = :discount_percent")
        updates.append("discount_amount = NULL")
        params["discount_percent"] = body.discount_percent
    if body.discount_amount is not None:
        updates.append("discount_amount = :discount_amount")
        updates.append("discount_percent = NULL")
        params["discount_amount"] = body.discount_amount
    if body.start_date is not None:
        updates.append("start_date = :start_date")
        params["start_date"] = body.start_date
    if body.end_date is not None:
        updates.append("end_date = :end_date")
        params["end_date"] = body.end_date
    if body.is_active is not None:
        updates.append("is_active = :is_active")
        params["is_active"] = body.is_active
    if body.apply_store_wide:
        updates.append("store_product_id = NULL")
    elif body.product_name is not None:
        product, product_error = await find_single_product(db, store.id, body.product_name)
        if product_error:
            return {"success": False, "result": product_error}
        updates.append("store_product_id = :product_id")
        params["product_id"] = str(product.id)

    if not updates:
        return {"success": False, "result": "No promotion fields to update."}

    await db.execute(
        text(f"UPDATE promotions SET {', '.join(updates)}, updated_at = now() WHERE id = :id"),
        params,
    )
    await db.commit()
    return {"success": True, "result": f"Updated promotion {promotion.title}."}


@router.post("/api/tools/deactivate-promotion")
async def deactivate_promotion(
    body: PromotionLookupReq,
    store: Store = Depends(get_verified_store),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Deactivate a promotion."""
    promotion, error = await find_single_promotion(db, store.id, body)
    if error:
        return {"success": False, "result": error}
    await db.execute(
        text("UPDATE promotions SET is_active = false, updated_at = now() WHERE id = :id"),
        {"id": str(promotion.id)},
    )
    await db.commit()
    return {"success": True, "result": f"Deactivated promotion {promotion.title}."}


@router.post("/api/tools/reactivate-promotion")
async def reactivate_promotion(
    body: PromotionLookupReq,
    store: Store = Depends(get_verified_store),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Reactivate a promotion."""
    promotion, error = await find_single_promotion(db, store.id, body)
    if error:
        return {"success": False, "result": error}
    await db.execute(
        text("UPDATE promotions SET is_active = true, updated_at = now() WHERE id = :id"),
        {"id": str(promotion.id)},
    )
    await db.commit()
    return {"success": True, "result": f"Reactivated promotion {promotion.title}."}


@router.post("/api/tools/promotion-performance")
async def promotion_performance(
    body: PromotionPerformanceReq,
    store: Store = Depends(get_verified_store),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Estimate promotion performance from orders during the promotion window."""
    promotion, error = await find_single_promotion(db, store.id, body)
    if error:
        return {"success": False, "result": error}

    product_filter = "AND (:pid IS NULL OR oi.store_product_id = :pid)"
    result = await db.execute(
        text(
            "SELECT COUNT(DISTINCT o.id) as order_count, "
            "COALESCE(SUM(oi.quantity), 0) as units_sold, "
            "COALESCE(SUM(oi.total_price), 0) as revenue "
            "FROM orders o "
            "JOIN order_items oi ON oi.order_id = o.id "
            "WHERE o.store_id = :sid AND o.status NOT IN ('CANCELLED') "
            "AND o.created_at >= :start_date "
            "AND (:end_date IS NULL OR o.created_at <= :end_date) "
            f"{product_filter}"
        ),
        {
            "sid": store.id,
            "pid": str(promotion.store_product_id) if promotion.store_product_id else None,
            "start_date": promotion.start_date,
            "end_date": promotion.end_date,
        },
    )
    row = result.fetchone()
    summary = {
        "promotion": promotion_to_dict(promotion),
        "order_count": int(row.order_count),
        "units_sold": int(row.units_sold),
        "revenue": round(float(row.revenue), 2),
        "note": "Performance is estimated from matching product/order sales during the promotion window.",
    }
    return {"success": True, "result": json.dumps(summary)}
