import json
import logging
from datetime import datetime, timedelta, timezone
from urllib.parse import quote_plus

import httpx
from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.middleware.auth import Store, get_verified_store
from app.routers.tool_models import (
    AddCustomProductReq,
    AddFromCatalogReq,
    BulkUpdatePricesReq,
    BulkUpdateStockReq,
    DuplicateProductCheckReq,
    FindProductsMissingDataReq,
    FindStaleInventoryReq,
    GetAllProductsReq,
    MarkOutOfStockReq,
    RemoveProductReq,
    RestockRecommendationsReq,
    SearchProductsReq,
    SetFeaturedProductReq,
    SetProductAvailabilityReq,
    SetProductImagesBulkReq,
    SlowMovingProductsReq,
    SuggestProductCategoriesReq,
    UpdateLowStockThresholdReq,
    UpdatePriceReq,
    UpdateProductDetailsReq,
    UpdateStockReq,
)
from app.routers.tool_utils import find_single_product

logger = logging.getLogger(__name__)

router = APIRouter()


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
            "WHERE store_id = :sid AND name ILIKE :name AND is_available = true "
            "LIMIT 5 FOR UPDATE"
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
            "WHERE store_id = :sid AND name ILIKE :name AND is_available = true "
            "LIMIT 5 FOR UPDATE"
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


@router.post("/api/tools/update-product-details")
async def update_product_details(
    body: UpdateProductDetailsReq,
    store: Store = Depends(get_verified_store),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Update editable product metadata by name."""
    result = await db.execute(
        text(
            "SELECT id, name FROM store_products "
            "WHERE store_id = :sid AND name ILIKE :name AND is_available = true "
            "LIMIT 5 FOR UPDATE"
        ),
        {"sid": store.id, "name": f"%{body.product_name}%"},
    )
    rows = result.fetchall()

    if not rows:
        return {"success": False, "result": f"No product matching '{body.product_name}'."}
    if len(rows) > 1:
        names = [r.name for r in rows]
        return {"success": False, "result": f"Multiple matches: {names}. Which one?"}

    updates: list[str] = []
    params: dict = {"id": str(rows[0].id)}

    if body.new_name is not None:
        updates.append("name = :new_name")
        params["new_name"] = body.new_name
    if body.description is not None:
        updates.append("description = :description")
        params["description"] = body.description
    if body.category is not None:
        updates.append("category = :category")
        params["category"] = body.category
    if body.subcategory is not None:
        updates.append("subcategory = :subcategory")
        params["subcategory"] = body.subcategory
    if body.compare_at_price is not None:
        updates.append("compare_at_price = :compare_at_price")
        params["compare_at_price"] = body.compare_at_price

    if not updates:
        return {"success": False, "result": "No product fields to update."}

    await db.execute(
        text(f"UPDATE store_products SET {', '.join(updates)} WHERE id = :id"),
        params,
    )
    await db.commit()

    changed = [field.split(" = ")[0] for field in updates]
    return {"success": True, "result": f"Updated {rows[0].name}: {', '.join(changed)}."}


@router.post("/api/tools/set-product-availability")
async def set_product_availability(
    body: SetProductAvailabilityReq,
    store: Store = Depends(get_verified_store),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Publish or hide a product from customers."""
    result = await db.execute(
        text(
            "SELECT id, name, is_available FROM store_products "
            "WHERE store_id = :sid AND name ILIKE :name "
            "LIMIT 5 FOR UPDATE"
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
        text("UPDATE store_products SET is_available = :is_available WHERE id = :id"),
        {"is_available": body.is_available, "id": str(rows[0].id)},
    )
    await db.commit()

    state = "available" if body.is_available else "hidden"
    return {"success": True, "result": f"Set {rows[0].name} to {state}."}


@router.post("/api/tools/set-featured-product")
async def set_featured_product(
    body: SetFeaturedProductReq,
    store: Store = Depends(get_verified_store),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Feature or unfeature a product."""
    result = await db.execute(
        text(
            "SELECT id, name FROM store_products "
            "WHERE store_id = :sid AND name ILIKE :name AND is_available = true "
            "LIMIT 5 FOR UPDATE"
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
        text("UPDATE store_products SET is_featured = :is_featured WHERE id = :id"),
        {"is_featured": body.is_featured, "id": str(rows[0].id)},
    )
    await db.commit()

    state = "featured" if body.is_featured else "not featured"
    return {"success": True, "result": f"Set {rows[0].name} to {state}."}


@router.post("/api/tools/update-low-stock-threshold")
async def update_low_stock_threshold(
    body: UpdateLowStockThresholdReq,
    store: Store = Depends(get_verified_store),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Update the low-stock alert threshold for a product."""
    if body.threshold < 0:
        return {"success": False, "result": "Threshold must be zero or greater."}

    result = await db.execute(
        text(
            "SELECT id, name, low_stock_threshold FROM store_products "
            "WHERE store_id = :sid AND name ILIKE :name AND is_available = true "
            "LIMIT 5 FOR UPDATE"
        ),
        {"sid": store.id, "name": f"%{body.product_name}%"},
    )
    rows = result.fetchall()

    if not rows:
        return {"success": False, "result": f"No product matching '{body.product_name}'."}
    if len(rows) > 1:
        names = [r.name for r in rows]
        return {"success": False, "result": f"Multiple matches: {names}. Which one?"}

    old_threshold = rows[0].low_stock_threshold
    await db.execute(
        text("UPDATE store_products SET low_stock_threshold = :threshold WHERE id = :id"),
        {"threshold": body.threshold, "id": str(rows[0].id)},
    )
    await db.commit()

    return {
        "success": True,
        "result": f"Updated {rows[0].name} low-stock threshold: {old_threshold} → {body.threshold}",
    }


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


@router.post("/api/tools/inventory-summary")
async def inventory_summary(
    store: Store = Depends(get_verified_store),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Summarize inventory health and value."""
    totals_result = await db.execute(
        text(
            "SELECT "
            "COUNT(*) FILTER (WHERE is_available = true) as active_products, "
            "COUNT(*) FILTER (WHERE is_available = false) as hidden_products, "
            "COUNT(*) FILTER (WHERE is_available = true AND quantity = 0) as out_of_stock, "
            "COUNT(*) FILTER (WHERE is_available = true AND quantity < low_stock_threshold) as low_stock, "
            "COALESCE(SUM(quantity), 0) as units_on_hand, "
            "COALESCE(SUM(price * quantity), 0) as retail_value "
            "FROM store_products WHERE store_id = :sid"
        ),
        {"sid": store.id},
    )
    totals = totals_result.fetchone()

    category_result = await db.execute(
        text(
            "SELECT COALESCE(category, 'Uncategorized') as category, "
            "COUNT(*) as product_count, "
            "COALESCE(SUM(quantity), 0) as units_on_hand, "
            "COALESCE(SUM(price * quantity), 0) as retail_value "
            "FROM store_products "
            "WHERE store_id = :sid AND is_available = true "
            "GROUP BY COALESCE(category, 'Uncategorized') "
            "ORDER BY retail_value DESC"
        ),
        {"sid": store.id},
    )
    categories = [
        {
            "category": r.category,
            "product_count": int(r.product_count),
            "units_on_hand": int(r.units_on_hand),
            "retail_value": round(float(r.retail_value), 2),
        }
        for r in category_result.fetchall()
    ]

    summary = {
        "active_products": int(totals.active_products),
        "hidden_products": int(totals.hidden_products),
        "out_of_stock": int(totals.out_of_stock),
        "low_stock": int(totals.low_stock),
        "units_on_hand": int(totals.units_on_hand),
        "retail_value": round(float(totals.retail_value), 2),
        "categories": categories,
    }
    return {"success": True, "result": json.dumps(summary)}


@router.post("/api/tools/restock-recommendations")
async def restock_recommendations(
    body: RestockRecommendationsReq,
    store: Store = Depends(get_verified_store),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Recommend products to restock using current inventory and recent sales."""
    start = datetime.now(timezone.utc) - timedelta(days=body.days)
    result = await db.execute(
        text(
            "SELECT sp.id, sp.name, sp.quantity, sp.low_stock_threshold, "
            "COALESCE(SUM(oi.quantity) FILTER (WHERE o.id IS NOT NULL), 0) as units_sold "
            "FROM store_products sp "
            "LEFT JOIN order_items oi ON oi.store_product_id = sp.id "
            "LEFT JOIN orders o ON o.id = oi.order_id AND o.created_at >= :start AND o.status NOT IN ('CANCELLED') "
            "WHERE sp.store_id = :sid AND sp.is_available = true "
            "GROUP BY sp.id, sp.name, sp.quantity, sp.low_stock_threshold "
            "HAVING sp.quantity < sp.low_stock_threshold "
            "OR COALESCE(SUM(oi.quantity) FILTER (WHERE o.id IS NOT NULL), 0) > sp.quantity "
            "ORDER BY (sp.low_stock_threshold - sp.quantity) DESC, units_sold DESC "
            "LIMIT :lim"
        ),
        {"sid": store.id, "start": start, "lim": body.limit},
    )
    recommendations = []
    for r in result.fetchall():
        target_stock = max((r.low_stock_threshold or 5) * 2, int(r.units_sold))
        recommended_qty = max(target_stock - r.quantity, 0)
        recommendations.append(
            {
                "id": str(r.id),
                "name": r.name,
                "current_quantity": r.quantity,
                "low_stock_threshold": r.low_stock_threshold,
                "units_sold": int(r.units_sold),
                "recommended_restock_quantity": recommended_qty,
            }
        )
    if not recommendations:
        return {"success": True, "result": "No restock recommendations right now."}
    return {"success": True, "result": json.dumps(recommendations)}


@router.post("/api/tools/bulk-update-stock")
async def bulk_update_stock(
    body: BulkUpdateStockReq,
    store: Store = Depends(get_verified_store),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Update stock quantities for multiple products."""
    updated = []
    errors = []
    for item in body.updates[:50]:
        if item.quantity < 0:
            errors.append({"product_name": item.product_name, "error": "Quantity must be zero or greater."})
            continue
        product, error = await find_single_product(db, store.id, item.product_name)
        if error:
            errors.append({"product_name": item.product_name, "error": error})
            continue
        await db.execute(
            text("UPDATE store_products SET quantity = :qty WHERE id = :id"),
            {"qty": item.quantity, "id": str(product.id)},
        )
        updated.append({"product_name": product.name, "quantity": item.quantity})

    if errors:
        await db.rollback()
        return {"success": False, "result": json.dumps({"updated": [], "errors": errors})}

    await db.commit()
    return {"success": True, "result": json.dumps({"updated": updated, "errors": []})}


@router.post("/api/tools/mark-out-of-stock")
async def mark_out_of_stock(
    body: MarkOutOfStockReq,
    store: Store = Depends(get_verified_store),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Set product quantity to zero, optionally hiding it from customers."""
    product, error = await find_single_product(db, store.id, body.product_name, only_available=False)
    if error:
        return {"success": False, "result": error}

    await db.execute(
        text("UPDATE store_products SET quantity = 0, is_available = :available WHERE id = :id"),
        {"available": not body.hide_product, "id": str(product.id)},
    )
    await db.commit()
    suffix = " and hidden" if body.hide_product else ""
    return {"success": True, "result": f"Marked {product.name} out of stock{suffix}."}


@router.post("/api/tools/find-stale-inventory")
async def find_stale_inventory(
    body: FindStaleInventoryReq,
    store: Store = Depends(get_verified_store),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Find products with stock on hand but no recent sales."""
    start = datetime.now(timezone.utc) - timedelta(days=body.days)
    result = await db.execute(
        text(
            "SELECT sp.id, sp.name, sp.quantity, sp.price, sp.category "
            "FROM store_products sp "
            "WHERE sp.store_id = :sid AND sp.is_available = true AND sp.quantity > 0 "
            "AND NOT EXISTS ("
            "  SELECT 1 FROM order_items oi "
            "  JOIN orders o ON o.id = oi.order_id "
            "  WHERE oi.store_product_id = sp.id AND o.created_at >= :start AND o.status NOT IN ('CANCELLED')"
            ") "
            "ORDER BY sp.quantity DESC LIMIT :lim"
        ),
        {"sid": store.id, "start": start, "lim": body.limit},
    )
    products = [
        {
            "id": str(r.id),
            "name": r.name,
            "quantity": r.quantity,
            "price": float(r.price),
            "category": r.category,
            "retail_value": round(float(r.price) * r.quantity, 2),
        }
        for r in result.fetchall()
    ]
    if not products:
        return {"success": True, "result": f"No stale inventory found in the last {body.days} days."}
    return {"success": True, "result": json.dumps(products)}


@router.post("/api/tools/inventory-value-by-category")
async def inventory_value_by_category(
    store: Store = Depends(get_verified_store),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Get inventory units and retail value grouped by category."""
    result = await db.execute(
        text(
            "SELECT COALESCE(category, 'Uncategorized') as category, "
            "COUNT(*) as product_count, COALESCE(SUM(quantity), 0) as units_on_hand, "
            "COALESCE(SUM(quantity * price), 0) as retail_value "
            "FROM store_products "
            "WHERE store_id = :sid AND is_available = true "
            "GROUP BY COALESCE(category, 'Uncategorized') "
            "ORDER BY retail_value DESC"
        ),
        {"sid": store.id},
    )
    categories = [
        {
            "category": r.category,
            "product_count": int(r.product_count),
            "units_on_hand": int(r.units_on_hand),
            "retail_value": round(float(r.retail_value), 2),
        }
        for r in result.fetchall()
    ]
    return {"success": True, "result": json.dumps(categories)}


@router.post("/api/tools/bulk-update-prices")
async def bulk_update_prices(
    body: BulkUpdatePricesReq,
    store: Store = Depends(get_verified_store),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Bulk update product prices by explicit product names or category."""
    price_modes = [body.percent_change is not None, body.fixed_change is not None, body.set_price is not None]
    if sum(price_modes) != 1:
        return {"success": False, "result": "Provide exactly one of percent_change, fixed_change, or set_price."}
    if not body.product_names and not body.category:
        return {"success": False, "result": "Provide product_names or category."}

    where_parts = ["store_id = :sid", "is_available = true"]
    params: dict = {"sid": store.id}
    if body.category:
        where_parts.append("category ILIKE :category")
        params["category"] = body.category
    if body.product_names:
        where_parts.append("name = ANY(:names)")
        params["names"] = body.product_names

    if body.percent_change is not None:
        set_expr = "price = GREATEST(0.01, ROUND((price * (1 + :pct / 100.0))::numeric, 2))"
        params["pct"] = body.percent_change
    elif body.fixed_change is not None:
        set_expr = "price = GREATEST(0.01, ROUND((price + :fixed)::numeric, 2))"
        params["fixed"] = body.fixed_change
    else:
        if body.set_price is None or body.set_price <= 0:
            return {"success": False, "result": "set_price must be greater than zero."}
        set_expr = "price = :set_price"
        params["set_price"] = body.set_price

    result = await db.execute(
        text(
            f"UPDATE store_products SET {set_expr} "
            f"WHERE {' AND '.join(where_parts)} "
            "RETURNING id, name, price"
        ),
        params,
    )
    rows = result.fetchall()
    await db.commit()
    products = [{"id": str(r.id), "name": r.name, "price": float(r.price)} for r in rows]
    return {"success": True, "result": json.dumps({"updated_count": len(products), "products": products})}


@router.post("/api/tools/find-products-missing-data")
async def find_products_missing_data(
    body: FindProductsMissingDataReq,
    store: Store = Depends(get_verified_store),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Find products missing image, description, category, or suspicious price data."""
    conditions = {
        "missing_images": "(image_urls IS NULL OR image_urls = '{}')",
        "missing_descriptions": "(description IS NULL OR description = '')",
        "missing_categories": "(category IS NULL OR category = '')",
        "price_anomalies": "(price <= 0 OR compare_at_price < price)",
    }
    if body.filter == "all":
        where = " OR ".join(conditions.values())
    elif body.filter in conditions:
        where = conditions[body.filter]
    else:
        return {"success": False, "result": f"Invalid filter. Use: {sorted([*conditions.keys(), 'all'])}"}

    result = await db.execute(
        text(
            "SELECT id, name, price, compare_at_price, category, description, image_urls "
            "FROM store_products "
            f"WHERE store_id = :sid AND is_available = true AND ({where}) "
            "ORDER BY name LIMIT 100"
        ),
        {"sid": store.id},
    )
    products = []
    for r in result.fetchall():
        missing = []
        if not r.image_urls:
            missing.append("image")
        if not r.description:
            missing.append("description")
        if not r.category:
            missing.append("category")
        if float(r.price) <= 0 or (r.compare_at_price is not None and r.compare_at_price < r.price):
            missing.append("price")
        products.append({"id": str(r.id), "name": r.name, "missing": missing})
    return {"success": True, "result": json.dumps(products)}


@router.post("/api/tools/duplicate-product-check")
async def duplicate_product_check(
    body: DuplicateProductCheckReq,
    store: Store = Depends(get_verified_store),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Find likely duplicate products by normalized product name."""
    result = await db.execute(
        text(
            "SELECT LOWER(REGEXP_REPLACE(name, '[^a-zA-Z0-9]+', '', 'g')) as normalized_name, "
            "JSON_AGG(JSON_BUILD_OBJECT('id', id, 'name', name, 'price', price)) as products, "
            "COUNT(*) as count "
            "FROM store_products "
            "WHERE store_id = :sid AND is_available = true "
            "GROUP BY normalized_name HAVING COUNT(*) > 1 "
            "ORDER BY count DESC LIMIT :lim"
        ),
        {"sid": store.id, "lim": body.limit},
    )
    groups = [
        {"normalized_name": r.normalized_name, "count": int(r.count), "products": r.products}
        for r in result.fetchall()
    ]
    return {"success": True, "result": json.dumps(groups)}


@router.post("/api/tools/suggest-product-categories")
async def suggest_product_categories(
    body: SuggestProductCategoriesReq,
    store: Store = Depends(get_verified_store),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Suggest simple category cleanup based on product names and existing categories."""
    result = await db.execute(
        text(
            "SELECT id, name, category FROM store_products "
            "WHERE store_id = :sid AND is_available = true "
            "ORDER BY name LIMIT :lim"
        ),
        {"sid": store.id, "lim": body.limit},
    )
    suggestions = []
    rules = [
        ("milk|cheese|yogurt|butter|eggs", "Dairy"),
        ("bread|bagel|croissant|muffin|pastry", "Bakery"),
        ("apple|banana|orange|lettuce|tomato|onion|potato", "Produce"),
        ("coffee|tea|juice|soda|water", "Beverages"),
        ("chicken|beef|pork|salmon|fish", "Meat & Seafood"),
        ("chips|cookie|cracker|candy|chocolate", "Snacks"),
    ]
    for r in result.fetchall():
        current = r.category or ""
        lower_name = r.name.lower()
        suggested = None
        for pattern, category in rules:
            if any(term in lower_name for term in pattern.split("|")):
                suggested = category
                break
        if suggested and suggested.lower() != current.lower():
            suggestions.append(
                {
                    "id": str(r.id),
                    "name": r.name,
                    "current_category": r.category,
                    "suggested_category": suggested,
                }
            )
    return {"success": True, "result": json.dumps(suggestions)}


@router.post("/api/tools/set-product-images-bulk")
async def set_product_images_bulk(
    body: SetProductImagesBulkReq,
    store: Store = Depends(get_verified_store),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Find and set images for products missing images, trying Pexels first."""
    if body.filter != "missing_images":
        return {"success": False, "result": "Only missing_images is supported."}

    result = await db.execute(
        text(
            "SELECT id, name, category FROM store_products "
            "WHERE store_id = :sid AND is_available = true "
            "AND (image_urls IS NULL OR image_urls = '{}') "
            "ORDER BY name LIMIT :lim"
        ),
        {"sid": store.id, "lim": min(body.limit, 50)},
    )
    rows = result.fetchall()
    updated = []
    for r in rows:
        url = f"https://placehold.co/400x400/e2e8f0/64748b?text={quote_plus(r.name)}"

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
                logger.warning("Pexels API failed for '%s', using placeholder", r.name)

        await db.execute(
            text("UPDATE store_products SET image_urls = ARRAY[:url] WHERE id = :id"),
            {"url": url, "id": str(r.id)},
        )
        updated.append({"id": str(r.id), "name": r.name, "image_url": url})
    if updated:
        await db.commit()
    return {"success": True, "result": json.dumps({"updated_count": len(updated), "products": updated})}
