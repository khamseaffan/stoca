import json
from datetime import datetime, timedelta, timezone

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.routers.tool_models import PromotionLookupReq


def period_start(period: str) -> datetime:
    now = datetime.now(timezone.utc)
    if period == "today":
        return now.replace(hour=0, minute=0, second=0, microsecond=0)
    if period == "week":
        return now - timedelta(days=7)
    if period == "month":
        return now - timedelta(days=30)
    raise ValueError("Invalid period. Use: today, week, month.")


async def find_single_product(
    db: AsyncSession,
    store_id: str,
    product_name: str,
    *,
    only_available: bool = True,
):
    available_clause = "AND is_available = true" if only_available else ""
    result = await db.execute(
        text(
            "SELECT id, name, price, quantity, category, low_stock_threshold "
            "FROM store_products "
            f"WHERE store_id = :sid AND name ILIKE :name {available_clause} LIMIT 5"
        ),
        {"sid": store_id, "name": f"%{product_name}%"},
    )
    rows = result.fetchall()
    if not rows:
        return None, f"No product matching '{product_name}'."
    if len(rows) > 1:
        return None, f"Multiple matches: {[r.name for r in rows]}. Which one?"
    return rows[0], None


async def find_single_promotion(db: AsyncSession, store_id: str, body: PromotionLookupReq):
    if body.promotion_id:
        result = await db.execute(
            text(
                "SELECT p.*, sp.name as product_name "
                "FROM promotions p "
                "LEFT JOIN store_products sp ON sp.id = p.store_product_id "
                "WHERE p.store_id = :sid AND p.id = :pid"
            ),
            {"sid": store_id, "pid": body.promotion_id},
        )
        row = result.fetchone()
        if not row:
            return None, f"Promotion {body.promotion_id} not found."
        return row, None

    if not body.title:
        return None, "Provide promotion_id or title."

    result = await db.execute(
        text(
            "SELECT p.*, sp.name as product_name "
            "FROM promotions p "
            "LEFT JOIN store_products sp ON sp.id = p.store_product_id "
            "WHERE p.store_id = :sid AND p.title ILIKE :title "
            "ORDER BY p.created_at DESC LIMIT 5"
        ),
        {"sid": store_id, "title": f"%{body.title}%"},
    )
    rows = result.fetchall()
    if not rows:
        return None, f"No promotion matching '{body.title}'."
    if len(rows) > 1:
        options = [{"id": str(r.id), "title": r.title} for r in rows]
        return None, f"Multiple matches: {json.dumps(options)}. Which one?"
    return rows[0], None


def promotion_to_dict(row) -> dict:
    return {
        "id": str(row.id),
        "title": row.title,
        "product_name": row.product_name,
        "discount_percent": float(row.discount_percent) if row.discount_percent is not None else None,
        "discount_amount": float(row.discount_amount) if row.discount_amount is not None else None,
        "start_date": row.start_date.isoformat() if row.start_date else None,
        "end_date": row.end_date.isoformat() if row.end_date else None,
        "is_active": row.is_active,
    }

