import json
from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.middleware.auth import Store, get_verified_store
from app.routers.tool_models import (
    SetStoreActiveStatusReq,
    UpdateDeliverySettingsReq,
    UpdateStoreAddressReq,
    UpdateStoreBrandingReq,
    UpdateStoreHoursReq,
    UpdateStoreInfoReq,
)

router = APIRouter()


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


@router.post("/api/tools/update-delivery-settings")
async def update_delivery_settings(
    body: UpdateDeliverySettingsReq,
    store: Store = Depends(get_verified_store),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Update pickup/delivery modes, delivery radius, fee, and minimum order."""
    updates: list[str] = []
    params: dict = {"id": store.id}

    if body.pickup_enabled is not None:
        updates.append("pickup_enabled = :pickup_enabled")
        params["pickup_enabled"] = body.pickup_enabled
    if body.delivery_enabled is not None:
        updates.append("delivery_enabled = :delivery_enabled")
        params["delivery_enabled"] = body.delivery_enabled
    if body.delivery_radius_km is not None:
        updates.append("delivery_radius_km = :delivery_radius_km")
        params["delivery_radius_km"] = body.delivery_radius_km
    if body.delivery_fee is not None:
        updates.append("delivery_fee = :delivery_fee")
        params["delivery_fee"] = body.delivery_fee
    if body.minimum_order is not None:
        updates.append("minimum_order = :minimum_order")
        params["minimum_order"] = body.minimum_order

    if not updates:
        return {"success": False, "result": "No delivery settings to update."}

    await db.execute(text(f"UPDATE stores SET {', '.join(updates)} WHERE id = :id"), params)
    await db.commit()
    changed = [u.split(" = ")[0] for u in updates]
    return {"success": True, "result": f"Updated delivery settings: {', '.join(changed)}."}


@router.post("/api/tools/update-store-address")
async def update_store_address(
    body: UpdateStoreAddressReq,
    store: Store = Depends(get_verified_store),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Update store address and coordinates."""
    field_map = {
        "street_address": body.street_address,
        "city": body.city,
        "state": body.state,
        "zipcode": body.zipcode,
        "country": body.country,
        "latitude": body.latitude,
        "longitude": body.longitude,
    }
    updates = []
    changed_fields = []
    params: dict = {"id": store.id}
    for field, value in field_map.items():
        if value is not None:
            updates.append(f"{field} = :{field}")
            params[field] = value
            changed_fields.append(field)
    if not updates:
        return {"success": False, "result": "No address fields to update."}

    await db.execute(text(f"UPDATE stores SET {', '.join(updates)} WHERE id = :id"), params)
    await db.commit()
    return {"success": True, "result": f"Updated store address: {', '.join(changed_fields)}."}


@router.post("/api/tools/set-store-active-status")
async def set_store_active_status(
    body: SetStoreActiveStatusReq,
    store: Store = Depends(get_verified_store),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Launch or pause the storefront."""
    await db.execute(
        text("UPDATE stores SET is_active = :is_active WHERE id = :id"),
        {"is_active": body.is_active, "id": store.id},
    )
    await db.commit()
    state = "active" if body.is_active else "paused"
    return {"success": True, "result": f"Store is now {state}."}


@router.post("/api/tools/update-store-branding")
async def update_store_branding(
    body: UpdateStoreBrandingReq,
    store: Store = Depends(get_verified_store),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Update logo and banner URLs."""
    updates: list[str] = []
    params: dict = {"id": store.id}
    if body.logo_url is not None:
        updates.append("logo_url = :logo_url")
        params["logo_url"] = body.logo_url
    if body.banner_url is not None:
        updates.append("banner_url = :banner_url")
        params["banner_url"] = body.banner_url
    if not updates:
        return {"success": False, "result": "No branding fields to update."}

    await db.execute(text(f"UPDATE stores SET {', '.join(updates)} WHERE id = :id"), params)
    await db.commit()
    return {"success": True, "result": f"Updated branding: {', '.join(u.split(' = ')[0] for u in updates)}."}


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

