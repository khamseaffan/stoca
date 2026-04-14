"""Tool endpoints called by Next.js on behalf of Claude's tool calls.

Every endpoint requires JWT auth via Depends(get_verified_store) and returns
{"success": bool, "result": str}. All SQL uses text() with named params.
"""

import json
import logging
from datetime import datetime, timedelta, timezone
from urllib.parse import quote_plus

import httpx
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.enrichment.product_enricher import enrich
from app.middleware.auth import Store, get_verified_store
from app.vision.inventory_scanner import scan_image
from app.vision.product_matcher import match_to_catalog

logger = logging.getLogger(__name__)
router = APIRouter()


# ---------------------------------------------------------------------------
# Request models
# ---------------------------------------------------------------------------


class SearchProductsReq(BaseModel):
    query: str


class GetAllProductsReq(BaseModel):
    page: int = 1
    per_page: int = 20


class UpdatePriceReq(BaseModel):
    product_name: str
    new_price: float


class AddFromCatalogReq(BaseModel):
    query: str
    price: float


class AddCustomProductReq(BaseModel):
    name: str
    price: float
    category: str = "General"
    description: str | None = None
    quantity: int = 0


class RemoveProductReq(BaseModel):
    product_name: str


class UpdateStockReq(BaseModel):
    product_name: str
    quantity: int


class UpdateStoreHoursReq(BaseModel):
    hours: dict


class UpdateStoreInfoReq(BaseModel):
    name: str | None = None
    description: str | None = None
    phone: str | None = None


class CreatePromotionReq(BaseModel):
    title: str
    product_name: str | None = None
    discount_percent: float | None = None
    discount_amount: float | None = None


class GetOrdersReq(BaseModel):
    limit: int = 10


class GetOrderDetailsReq(BaseModel):
    order_id: str


class UpdateOrderStatusReq(BaseModel):
    order_id: str
    status: str


class SalesSummaryReq(BaseModel):
    period: str = "today"


class TopProductsReq(BaseModel):
    limit: int = 5


class ScanInventoryReq(BaseModel):
    image_url: str


class SearchProductImageReq(BaseModel):
    product_name: str
    category: str | None = None


class EnrichProductDescriptionReq(BaseModel):
    product_name: str


class EnrichProductsBulkReq(BaseModel):
    filter: str = "all"  # "missing_images" | "missing_descriptions" | "all"


# ---------------------------------------------------------------------------
# Product Tools
# ---------------------------------------------------------------------------


@router.post("/api/tools/search-products")
async def search_products(
    body: SearchProductsReq,
    store: Store = Depends(get_verified_store),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Search store products by name."""
    result = await db.execute(
        text(
            "SELECT id, name, price, quantity, category "
            "FROM store_products "
            "WHERE store_id = :sid AND is_available = true AND name ILIKE :q "
            "ORDER BY name LIMIT 10"
        ),
        {"sid": store.id, "q": f"%{body.query}%"},
    )
    rows = result.fetchall()
    if not rows:
        return {"success": True, "result": f"No products matching '{body.query}'."}

    products = [
        {"id": str(r.id), "name": r.name, "price": float(r.price), "quantity": r.quantity, "category": r.category}
        for r in rows
    ]
    return {"success": True, "result": json.dumps(products)}


@router.post("/api/tools/get-all-products")
async def get_all_products(
    body: GetAllProductsReq,
    store: Store = Depends(get_verified_store),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """List store products with pagination."""
    offset = (body.page - 1) * body.per_page
    result = await db.execute(
        text(
            "SELECT id, name, price, quantity, category, is_available "
            "FROM store_products "
            "WHERE store_id = :sid "
            "ORDER BY name LIMIT :lim OFFSET :off"
        ),
        {"sid": store.id, "lim": body.per_page, "off": offset},
    )
    rows = result.fetchall()

    count_result = await db.execute(
        text("SELECT COUNT(*) as total FROM store_products WHERE store_id = :sid"),
        {"sid": store.id},
    )
    total = count_result.scalar()

    products = [
        {
            "id": str(r.id),
            "name": r.name,
            "price": float(r.price),
            "quantity": r.quantity,
            "category": r.category,
            "is_available": r.is_available,
        }
        for r in rows
    ]
    return {
        "success": True,
        "result": json.dumps({"products": products, "total": total, "page": body.page}),
    }


@router.post("/api/tools/update-price")
async def update_price(
    body: UpdatePriceReq,
    store: Store = Depends(get_verified_store),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Update a product's price by name."""
    result = await db.execute(
        text(
            "SELECT id, name, price FROM store_products "
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

    old_price = rows[0].price
    await db.execute(
        text("UPDATE store_products SET price = :price WHERE id = :id"),
        {"price": body.new_price, "id": str(rows[0].id)},
    )
    await db.commit()
    return {"success": True, "result": f"Updated {rows[0].name}: ${old_price:.2f} → ${body.new_price:.2f}"}


@router.post("/api/tools/add-from-catalog")
async def add_from_catalog(
    body: AddFromCatalogReq,
    store: Store = Depends(get_verified_store),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Search global catalog and add a product to this store."""
    result = await db.execute(
        text(
            "SELECT id, name, description, category, subcategory, brand, image_urls, embedding "
            "FROM global_products WHERE name ILIKE :q LIMIT 5"
        ),
        {"q": f"%{body.query}%"},
    )
    rows = result.fetchall()

    if not rows:
        return {"success": False, "result": f"No catalog product matching '{body.query}'."}
    if len(rows) > 1:
        options = [{"id": str(r.id), "name": r.name, "brand": r.brand} for r in rows]
        return {"success": False, "result": f"Multiple matches: {json.dumps(options)}. Which one?"}

    gp = rows[0]

    # Check if already added
    existing = await db.execute(
        text(
            "SELECT id FROM store_products "
            "WHERE store_id = :sid AND global_product_id = :gid"
        ),
        {"sid": store.id, "gid": str(gp.id)},
    )
    if existing.fetchone():
        return {"success": False, "result": f"{gp.name} is already in your store."}

    await db.execute(
        text(
            "INSERT INTO store_products "
            "(store_id, global_product_id, name, description, price, category, subcategory, image_urls, embedding) "
            "VALUES (:sid, :gid, :name, :desc, :price, :cat, :subcat, :imgs, :emb)"
        ),
        {
            "sid": store.id,
            "gid": str(gp.id),
            "name": gp.name,
            "desc": gp.description,
            "price": body.price,
            "cat": gp.category,
            "subcat": gp.subcategory,
            "imgs": gp.image_urls,
            "emb": str(gp.embedding) if gp.embedding else None,
        },
    )
    await db.commit()
    return {"success": True, "result": f"Added {gp.name} to your store at ${body.price:.2f}."}


@router.post("/api/tools/add-custom-product")
async def add_custom_product(
    body: AddCustomProductReq,
    store: Store = Depends(get_verified_store),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Add a custom product not in the global catalog."""
    await db.execute(
        text(
            "INSERT INTO store_products (store_id, name, description, price, category, quantity) "
            "VALUES (:sid, :name, :desc, :price, :cat, :qty)"
        ),
        {
            "sid": store.id,
            "name": body.name,
            "desc": body.description,
            "price": body.price,
            "cat": body.category,
            "qty": body.quantity,
        },
    )
    await db.commit()
    return {"success": True, "result": f"Added custom product '{body.name}' at ${body.price:.2f} (qty: {body.quantity})."}


@router.post("/api/tools/remove-product")
async def remove_product(
    body: RemoveProductReq,
    store: Store = Depends(get_verified_store),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Remove a product by setting is_available=false."""
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

    await db.execute(
        text("UPDATE store_products SET is_available = false WHERE id = :id"),
        {"id": str(rows[0].id)},
    )
    await db.commit()
    return {"success": True, "result": f"Removed {rows[0].name} from your store."}


@router.post("/api/tools/update-stock")
async def update_stock(
    body: UpdateStockReq,
    store: Store = Depends(get_verified_store),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Update stock quantity for a product."""
    result = await db.execute(
        text(
            "SELECT id, name, quantity FROM store_products "
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

    old_qty = rows[0].quantity
    await db.execute(
        text("UPDATE store_products SET quantity = :qty WHERE id = :id"),
        {"qty": body.quantity, "id": str(rows[0].id)},
    )
    await db.commit()
    return {"success": True, "result": f"Updated {rows[0].name} stock: {old_qty} → {body.quantity}"}


@router.post("/api/tools/low-stock-alerts")
async def low_stock_alerts(
    store: Store = Depends(get_verified_store),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """List products below their low stock threshold."""
    result = await db.execute(
        text(
            "SELECT id, name, quantity, low_stock_threshold "
            "FROM store_products "
            "WHERE store_id = :sid AND is_available = true "
            "AND quantity < low_stock_threshold "
            "ORDER BY quantity ASC"
        ),
        {"sid": store.id},
    )
    rows = result.fetchall()

    if not rows:
        return {"success": True, "result": "No low stock alerts. All products are well-stocked."}

    alerts = [
        {"id": str(r.id), "name": r.name, "quantity": r.quantity, "threshold": r.low_stock_threshold}
        for r in rows
    ]
    return {"success": True, "result": json.dumps(alerts)}


# ---------------------------------------------------------------------------
# Store Tools
# ---------------------------------------------------------------------------


@router.post("/api/tools/update-store-hours")
async def update_store_hours(
    body: UpdateStoreHoursReq,
    store: Store = Depends(get_verified_store),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Update the store's operating hours (JSONB)."""
    await db.execute(
        text("UPDATE stores SET operating_hours = :hours WHERE id = :id"),
        {"hours": json.dumps(body.hours), "id": store.id},
    )
    await db.commit()
    return {"success": True, "result": "Store hours updated."}


@router.post("/api/tools/update-store-info")
async def update_store_info(
    body: UpdateStoreInfoReq,
    store: Store = Depends(get_verified_store),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Update store name, description, or phone."""
    updates: list[str] = []
    params: dict = {"id": store.id}

    if body.name is not None:
        updates.append("name = :name")
        params["name"] = body.name
    if body.description is not None:
        updates.append("description = :desc")
        params["desc"] = body.description
    if body.phone is not None:
        updates.append("phone = :phone")
        params["phone"] = body.phone

    if not updates:
        return {"success": False, "result": "No fields to update."}

    set_clause = ", ".join(updates)
    await db.execute(
        text(f"UPDATE stores SET {set_clause} WHERE id = :id"),
        params,
    )
    await db.commit()
    changed = [f.split(" = ")[0] for f in updates]
    return {"success": True, "result": f"Updated store: {', '.join(changed)}."}


@router.post("/api/tools/create-promotion")
async def create_promotion(
    body: CreatePromotionReq,
    store: Store = Depends(get_verified_store),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Create a discount promotion."""
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
            "INSERT INTO promotions (store_id, store_product_id, title, discount_percent, discount_amount) "
            "VALUES (:sid, :pid, :title, :pct, :amt)"
        ),
        {
            "sid": store.id,
            "pid": product_id,
            "title": body.title,
            "pct": body.discount_percent,
            "amt": body.discount_amount,
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


# ---------------------------------------------------------------------------
# Order Tools
# ---------------------------------------------------------------------------


@router.post("/api/tools/get-orders")
async def get_orders(
    body: GetOrdersReq,
    store: Store = Depends(get_verified_store),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Get recent orders for the store."""
    result = await db.execute(
        text(
            "SELECT o.id, o.status, o.order_type, o.total, o.created_at, "
            "p.first_name, p.last_name, "
            "(SELECT COUNT(*) FROM order_items oi WHERE oi.order_id = o.id) as item_count "
            "FROM orders o "
            "JOIN profiles p ON o.user_id = p.id "
            "WHERE o.store_id = :sid "
            "ORDER BY o.created_at DESC LIMIT :lim"
        ),
        {"sid": store.id, "lim": body.limit},
    )
    rows = result.fetchall()

    if not rows:
        return {"success": True, "result": "No orders yet."}

    orders = [
        {
            "id": str(r.id),
            "customer_name": f"{r.first_name} {r.last_name}".strip(),
            "status": r.status,
            "order_type": r.order_type,
            "total": float(r.total),
            "item_count": r.item_count,
            "created_at": r.created_at.isoformat(),
        }
        for r in rows
    ]
    return {"success": True, "result": json.dumps(orders)}


@router.post("/api/tools/get-order-details")
async def get_order_details(
    body: GetOrderDetailsReq,
    store: Store = Depends(get_verified_store),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Get full order details including items."""
    result = await db.execute(
        text(
            "SELECT o.id, o.status, o.order_type, o.subtotal, o.tax, o.delivery_fee, "
            "o.total, o.customer_notes, o.created_at, "
            "p.first_name, p.last_name, p.email "
            "FROM orders o "
            "JOIN profiles p ON o.user_id = p.id "
            "WHERE o.id = :oid AND o.store_id = :sid"
        ),
        {"oid": body.order_id, "sid": store.id},
    )
    order = result.fetchone()

    if not order:
        return {"success": False, "result": f"Order {body.order_id} not found."}

    items_result = await db.execute(
        text(
            "SELECT product_name, quantity, unit_price, total_price "
            "FROM order_items WHERE order_id = :oid"
        ),
        {"oid": body.order_id},
    )
    items = items_result.fetchall()

    detail = {
        "id": str(order.id),
        "customer": {
            "name": f"{order.first_name} {order.last_name}".strip(),
            "email": order.email,
        },
        "status": order.status,
        "order_type": order.order_type,
        "items": [
            {
                "product_name": i.product_name,
                "quantity": i.quantity,
                "unit_price": float(i.unit_price),
                "total_price": float(i.total_price),
            }
            for i in items
        ],
        "subtotal": float(order.subtotal),
        "tax": float(order.tax),
        "delivery_fee": float(order.delivery_fee),
        "total": float(order.total),
        "customer_notes": order.customer_notes,
        "created_at": order.created_at.isoformat(),
    }
    return {"success": True, "result": json.dumps(detail)}


@router.post("/api/tools/update-order-status")
async def update_order_status(
    body: UpdateOrderStatusReq,
    store: Store = Depends(get_verified_store),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Change an order's status."""
    valid_statuses = {
        "PENDING", "CONFIRMED", "PREPARING", "READY_FOR_PICKUP",
        "OUT_FOR_DELIVERY", "DELIVERED", "COMPLETED", "CANCELLED",
    }
    if body.status not in valid_statuses:
        return {"success": False, "result": f"Invalid status. Valid: {sorted(valid_statuses)}"}

    result = await db.execute(
        text("SELECT id, status FROM orders WHERE id = :oid AND store_id = :sid"),
        {"oid": body.order_id, "sid": store.id},
    )
    order = result.fetchone()

    if not order:
        return {"success": False, "result": f"Order {body.order_id} not found."}

    old_status = order.status
    await db.execute(
        text("UPDATE orders SET status = :status WHERE id = :oid"),
        {"status": body.status, "oid": body.order_id},
    )
    await db.commit()
    return {"success": True, "result": f"Order updated: {old_status} → {body.status}"}


# ---------------------------------------------------------------------------
# Analytics Tools
# ---------------------------------------------------------------------------


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


# ---------------------------------------------------------------------------
# Store Context (used by Next.js to build system prompt)
# ---------------------------------------------------------------------------


@router.post("/api/tools/get-store-context")
async def get_store_context(
    store: Store = Depends(get_verified_store),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Get store context for the AI system prompt."""
    product_count = await db.execute(
        text(
            "SELECT COUNT(*) as cnt FROM store_products "
            "WHERE store_id = :sid AND is_available = true"
        ),
        {"sid": store.id},
    )

    pending_orders = await db.execute(
        text(
            "SELECT COUNT(*) as cnt FROM orders "
            "WHERE store_id = :sid AND status IN ('PENDING', 'CONFIRMED', 'PREPARING')"
        ),
        {"sid": store.id},
    )

    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    revenue_result = await db.execute(
        text(
            "SELECT COALESCE(SUM(total), 0) as revenue FROM orders "
            "WHERE store_id = :sid AND created_at >= :start AND status NOT IN ('CANCELLED')"
        ),
        {"sid": store.id, "start": today_start},
    )

    context = {
        "store_name": store.name,
        "store_type": store.store_type,
        "product_count": product_count.scalar(),
        "pending_orders": pending_orders.scalar(),
        "todays_revenue": round(float(revenue_result.scalar()), 2),
    }
    return {"success": True, "result": json.dumps(context)}


# ---------------------------------------------------------------------------
# Vision Tool
# ---------------------------------------------------------------------------


@router.post("/api/tools/scan-inventory")
async def scan_inventory(
    body: ScanInventoryReq,
    store: Store = Depends(get_verified_store),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Scan an inventory image using Claude Vision and match to catalog."""
    try:
        scan_result = await scan_image(body.image_url)
        matched = await match_to_catalog(scan_result.identified_products, db)

        products = [
            {
                "name": p.name,
                "brand": p.brand,
                "estimated_quantity": p.estimated_quantity,
                "confidence": p.confidence,
                "matched_global_product_id": p.matched_global_product_id,
            }
            for p in matched
        ]
        return {"success": True, "result": json.dumps(products)}
    except Exception:
        logger.exception("Inventory scan failed for image: %s", body.image_url)
        return {"success": False, "result": "Failed to scan inventory image. Please try again."}


# ---------------------------------------------------------------------------
# Enrichment Tools
# ---------------------------------------------------------------------------


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
