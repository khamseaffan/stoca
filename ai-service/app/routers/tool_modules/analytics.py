import json
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.middleware.auth import Store, get_verified_store
from app.routers.tool_models import (
    CategorySalesSummaryReq,
    CompareSalesPeriodsReq,
    CustomerSummaryReq,
    SalesSummaryReq,
    SlowMovingProductsReq,
    TopProductsReq,
)
from app.routers.tool_utils import period_start

router = APIRouter()


@router.post("/api/tools/sales-summary")
async def sales_summary(
    body: SalesSummaryReq,
    store: Store = Depends(get_verified_store),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Get revenue and order count for a period."""
    now = datetime.now(timezone.utc)
    if body.period == "today":
        start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    elif body.period == "week":
        start = now - timedelta(days=7)
    elif body.period == "month":
        start = now - timedelta(days=30)
    else:
        return {"success": False, "result": "Invalid period. Use: today, week, month."}

    result = await db.execute(
        text(
            "SELECT COALESCE(SUM(total), 0) as revenue, COUNT(*) as order_count "
            "FROM orders "
            "WHERE store_id = :sid AND created_at >= :start "
            "AND status NOT IN ('CANCELLED')"
        ),
        {"sid": store.id, "start": start},
    )
    row = result.fetchone()

    revenue = float(row.revenue)
    count = row.order_count
    avg = revenue / count if count > 0 else 0

    summary = {
        "period": body.period,
        "total_revenue": round(revenue, 2),
        "order_count": count,
        "average_order": round(avg, 2),
    }
    return {"success": True, "result": json.dumps(summary)}


@router.post("/api/tools/top-products")
async def top_products(
    body: TopProductsReq,
    store: Store = Depends(get_verified_store),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Get best-selling products by units sold."""
    result = await db.execute(
        text(
            "SELECT oi.product_name, "
            "SUM(oi.quantity) as units_sold, "
            "SUM(oi.total_price) as revenue "
            "FROM order_items oi "
            "JOIN orders o ON oi.order_id = o.id "
            "WHERE o.store_id = :sid AND o.status NOT IN ('CANCELLED') "
            "GROUP BY oi.product_name "
            "ORDER BY units_sold DESC LIMIT :lim"
        ),
        {"sid": store.id, "lim": body.limit},
    )
    rows = result.fetchall()

    if not rows:
        return {"success": True, "result": "No sales data yet."}

    products = [
        {"name": r.product_name, "units_sold": int(r.units_sold), "revenue": round(float(r.revenue), 2)}
        for r in rows
    ]
    return {"success": True, "result": json.dumps(products)}


@router.post("/api/tools/compare-sales-periods")
async def compare_sales_periods(
    body: CompareSalesPeriodsReq,
    store: Store = Depends(get_verified_store),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Compare sales for a period against the previous equivalent period."""
    try:
        current_start = period_start(body.period)
    except ValueError as exc:
        return {"success": False, "result": str(exc)}

    now = datetime.now(timezone.utc)
    duration = now - current_start
    previous_start = current_start - duration

    result = await db.execute(
        text(
            "SELECT "
            "COALESCE(SUM(total) FILTER (WHERE created_at >= :current_start), 0) as current_revenue, "
            "COUNT(*) FILTER (WHERE created_at >= :current_start) as current_orders, "
            "COALESCE(SUM(total) FILTER (WHERE created_at >= :previous_start AND created_at < :current_start), 0) as previous_revenue, "
            "COUNT(*) FILTER (WHERE created_at >= :previous_start AND created_at < :current_start) as previous_orders "
            "FROM orders "
            "WHERE store_id = :sid AND status NOT IN ('CANCELLED') AND created_at >= :previous_start"
        ),
        {"sid": store.id, "current_start": current_start, "previous_start": previous_start},
    )
    row = result.fetchone()
    current_revenue = float(row.current_revenue)
    previous_revenue = float(row.previous_revenue)
    revenue_change_percent = (
        round(((current_revenue - previous_revenue) / previous_revenue) * 100, 2)
        if previous_revenue
        else None
    )
    summary = {
        "period": body.period,
        "current": {"revenue": round(current_revenue, 2), "orders": row.current_orders},
        "previous": {"revenue": round(previous_revenue, 2), "orders": row.previous_orders},
        "revenue_change_percent": revenue_change_percent,
    }
    return {"success": True, "result": json.dumps(summary)}


@router.post("/api/tools/category-sales-summary")
async def category_sales_summary(
    body: CategorySalesSummaryReq,
    store: Store = Depends(get_verified_store),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Summarize revenue and units sold by product category."""
    try:
        start = period_start(body.period)
    except ValueError as exc:
        return {"success": False, "result": str(exc)}

    result = await db.execute(
        text(
            "SELECT COALESCE(sp.category, 'Uncategorized') as category, "
            "COALESCE(SUM(oi.quantity), 0) as units_sold, "
            "COALESCE(SUM(oi.total_price), 0) as revenue "
            "FROM order_items oi "
            "JOIN orders o ON o.id = oi.order_id "
            "LEFT JOIN store_products sp ON sp.id = oi.store_product_id "
            "WHERE o.store_id = :sid AND o.created_at >= :start AND o.status NOT IN ('CANCELLED') "
            "GROUP BY COALESCE(sp.category, 'Uncategorized') "
            "ORDER BY revenue DESC LIMIT :lim"
        ),
        {"sid": store.id, "start": start, "lim": body.limit},
    )
    categories = [
        {"category": r.category, "units_sold": int(r.units_sold), "revenue": round(float(r.revenue), 2)}
        for r in result.fetchall()
    ]
    return {"success": True, "result": json.dumps(categories)}


@router.post("/api/tools/slow-moving-products")
async def slow_moving_products(
    body: SlowMovingProductsReq,
    store: Store = Depends(get_verified_store),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Find stocked products with the lowest recent sales velocity."""
    start = datetime.now(timezone.utc) - timedelta(days=body.days)
    result = await db.execute(
        text(
            "SELECT sp.id, sp.name, sp.quantity, sp.price, sp.category, "
            "COALESCE(SUM(oi.quantity) FILTER (WHERE o.id IS NOT NULL), 0) as units_sold "
            "FROM store_products sp "
            "LEFT JOIN order_items oi ON oi.store_product_id = sp.id "
            "LEFT JOIN orders o ON o.id = oi.order_id AND o.created_at >= :start AND o.status NOT IN ('CANCELLED') "
            "WHERE sp.store_id = :sid AND sp.is_available = true AND sp.quantity > 0 "
            "GROUP BY sp.id, sp.name, sp.quantity, sp.price, sp.category "
            "ORDER BY units_sold ASC, sp.quantity DESC LIMIT :lim"
        ),
        {"sid": store.id, "start": start, "lim": body.limit},
    )
    products = [
        {
            "id": str(r.id),
            "name": r.name,
            "category": r.category,
            "quantity": r.quantity,
            "units_sold": int(r.units_sold),
            "retail_value": round(float(r.price) * r.quantity, 2),
        }
        for r in result.fetchall()
    ]
    return {"success": True, "result": json.dumps(products)}


@router.post("/api/tools/customer-summary")
async def customer_summary(
    body: CustomerSummaryReq,
    store: Store = Depends(get_verified_store),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Summarize customers and top customers for a period."""
    try:
        start = period_start(body.period)
    except ValueError as exc:
        return {"success": False, "result": str(exc)}

    totals_result = await db.execute(
        text(
            "WITH customer_orders AS ("
            "  SELECT user_id, COUNT(*) as orders, SUM(total) as revenue "
            "  FROM orders WHERE store_id = :sid AND created_at >= :start AND status NOT IN ('CANCELLED') "
            "  GROUP BY user_id"
            ") "
            "SELECT COUNT(*) as customers, "
            "COUNT(*) FILTER (WHERE orders = 1) as one_time_customers, "
            "COUNT(*) FILTER (WHERE orders > 1) as repeat_customers "
            "FROM customer_orders"
        ),
        {"sid": store.id, "start": start},
    )
    totals = totals_result.fetchone()

    top_result = await db.execute(
        text(
            "SELECT p.first_name, p.last_name, p.email, COUNT(o.id) as order_count, "
            "COALESCE(SUM(o.total), 0) as revenue "
            "FROM orders o "
            "JOIN profiles p ON p.id = o.user_id "
            "WHERE o.store_id = :sid AND o.created_at >= :start AND o.status NOT IN ('CANCELLED') "
            "GROUP BY p.id, p.first_name, p.last_name, p.email "
            "ORDER BY revenue DESC LIMIT :lim"
        ),
        {"sid": store.id, "start": start, "lim": body.limit},
    )
    top_customers = [
        {
            "name": f"{r.first_name} {r.last_name}".strip(),
            "email": r.email,
            "order_count": r.order_count,
            "revenue": round(float(r.revenue), 2),
        }
        for r in top_result.fetchall()
    ]
    summary = {
        "period": body.period,
        "customers": totals.customers,
        "one_time_customers": totals.one_time_customers,
        "repeat_customers": totals.repeat_customers,
        "top_customers": top_customers,
    }
    return {"success": True, "result": json.dumps(summary)}


@router.post("/api/tools/daily-business-brief")
async def daily_business_brief(
    store: Store = Depends(get_verified_store),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Return a compact daily operating brief."""
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    result = await db.execute(
        text(
            "SELECT "
            "COALESCE((SELECT SUM(total) FROM orders WHERE store_id = :sid AND created_at >= :start AND status NOT IN ('CANCELLED')), 0) as revenue, "
            "(SELECT COUNT(*) FROM orders WHERE store_id = :sid AND created_at >= :start AND status NOT IN ('CANCELLED')) as orders_today, "
            "(SELECT COUNT(*) FROM orders WHERE store_id = :sid AND status IN ('PENDING', 'CONFIRMED', 'PREPARING')) as open_orders, "
            "(SELECT COUNT(*) FROM store_products WHERE store_id = :sid AND is_available = true AND quantity < low_stock_threshold) as low_stock_products, "
            "(SELECT COUNT(*) FROM promotions WHERE store_id = :sid AND is_active = true AND start_date <= now() AND (end_date IS NULL OR end_date >= now())) as active_promotions"
        ),
        {"sid": store.id, "start": today_start},
    )
    row = result.fetchone()
    brief = {
        "store_name": store.name,
        "todays_revenue": round(float(row.revenue), 2),
        "orders_today": row.orders_today,
        "open_orders": row.open_orders,
        "low_stock_products": row.low_stock_products,
        "active_promotions": row.active_promotions,
    }
    return {"success": True, "result": json.dumps(brief)}
