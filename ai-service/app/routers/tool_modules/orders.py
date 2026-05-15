import json
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.middleware.auth import Store, get_verified_store
from app.routers.tool_models import (
    AddOrderNoteReq,
    CancelOrderReq,
    FindDelayedOrdersReq,
    GetCustomerOrderHistoryReq,
    GetOrderDetailsReq,
    GetOrdersReq,
    ListOrdersByStatusReq,
    UpdateOrderStatusReq,
)

router = APIRouter()


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
        text("SELECT id, status FROM orders WHERE id = :oid AND store_id = :sid FOR UPDATE"),
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


@router.post("/api/tools/list-orders-by-status")
async def list_orders_by_status(
    body: ListOrdersByStatusReq,
    store: Store = Depends(get_verified_store),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """List orders by exact status."""
    result = await db.execute(
        text(
            "SELECT o.id, o.status, o.order_type, o.total, o.created_at, "
            "p.first_name, p.last_name, p.email, "
            "(SELECT COUNT(*) FROM order_items oi WHERE oi.order_id = o.id) as item_count "
            "FROM orders o "
            "JOIN profiles p ON p.id = o.user_id "
            "WHERE o.store_id = :sid AND o.status = :status "
            "ORDER BY o.created_at DESC LIMIT :lim"
        ),
        {"sid": store.id, "status": body.status, "lim": body.limit},
    )
    orders = [
        {
            "id": str(r.id),
            "status": r.status,
            "order_type": r.order_type,
            "total": float(r.total),
            "customer_name": f"{r.first_name} {r.last_name}".strip(),
            "customer_email": r.email,
            "item_count": r.item_count,
            "created_at": r.created_at.isoformat(),
        }
        for r in result.fetchall()
    ]
    return {"success": True, "result": json.dumps(orders)}


@router.post("/api/tools/find-delayed-orders")
async def find_delayed_orders(
    body: FindDelayedOrdersReq,
    store: Store = Depends(get_verified_store),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Find open orders that have been waiting longer than a threshold."""
    cutoff = datetime.now(timezone.utc) - timedelta(minutes=body.older_than_minutes)
    result = await db.execute(
        text(
            "SELECT o.id, o.status, o.order_type, o.total, o.created_at, "
            "p.first_name, p.last_name "
            "FROM orders o "
            "JOIN profiles p ON p.id = o.user_id "
            "WHERE o.store_id = :sid "
            "AND o.status IN ('PENDING', 'CONFIRMED', 'PREPARING', 'READY_FOR_PICKUP', 'OUT_FOR_DELIVERY') "
            "AND o.created_at <= :cutoff "
            "ORDER BY o.created_at ASC LIMIT :lim"
        ),
        {"sid": store.id, "cutoff": cutoff, "lim": body.limit},
    )
    orders = [
        {
            "id": str(r.id),
            "status": r.status,
            "order_type": r.order_type,
            "total": float(r.total),
            "customer_name": f"{r.first_name} {r.last_name}".strip(),
            "created_at": r.created_at.isoformat(),
        }
        for r in result.fetchall()
    ]
    return {"success": True, "result": json.dumps(orders)}


@router.post("/api/tools/add-order-note")
async def add_order_note(
    body: AddOrderNoteReq,
    store: Store = Depends(get_verified_store),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Append a store note to an order."""
    result = await db.execute(
        text("SELECT id, store_notes FROM orders WHERE id = :oid AND store_id = :sid"),
        {"oid": body.order_id, "sid": store.id},
    )
    order = result.fetchone()
    if not order:
        return {"success": False, "result": f"Order {body.order_id} not found."}

    existing = order.store_notes or ""
    note = f"{existing}\n{body.note}".strip() if existing else body.note
    await db.execute(
        text("UPDATE orders SET store_notes = :note WHERE id = :oid"),
        {"note": note, "oid": body.order_id},
    )
    await db.commit()
    return {"success": True, "result": f"Added note to order {body.order_id}."}


@router.post("/api/tools/get-customer-order-history")
async def get_customer_order_history(
    body: GetCustomerOrderHistoryReq,
    store: Store = Depends(get_verified_store),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Get order history for a customer by email or name."""
    if not body.customer_email and not body.customer_name:
        return {"success": False, "result": "Provide customer_email or customer_name."}

    filters = ["o.store_id = :sid"]
    params: dict = {"sid": store.id, "lim": body.limit}
    if body.customer_email:
        filters.append("p.email ILIKE :email")
        params["email"] = f"%{body.customer_email}%"
    if body.customer_name:
        filters.append("(p.first_name || ' ' || p.last_name) ILIKE :name")
        params["name"] = f"%{body.customer_name}%"

    result = await db.execute(
        text(
            "SELECT o.id, o.status, o.order_type, o.total, o.created_at, "
            "p.first_name, p.last_name, p.email "
            "FROM orders o "
            "JOIN profiles p ON p.id = o.user_id "
            f"WHERE {' AND '.join(filters)} "
            "ORDER BY o.created_at DESC LIMIT :lim"
        ),
        params,
    )
    orders = [
        {
            "id": str(r.id),
            "status": r.status,
            "order_type": r.order_type,
            "total": float(r.total),
            "customer_name": f"{r.first_name} {r.last_name}".strip(),
            "customer_email": r.email,
            "created_at": r.created_at.isoformat(),
        }
        for r in result.fetchall()
    ]
    return {"success": True, "result": json.dumps(orders)}


@router.post("/api/tools/cancel-order")
async def cancel_order(
    body: CancelOrderReq,
    store: Store = Depends(get_verified_store),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Cancel an order. This does not issue a payment refund."""
    result = await db.execute(
        text("SELECT id, status FROM orders WHERE id = :oid AND store_id = :sid FOR UPDATE"),
        {"oid": body.order_id, "sid": store.id},
    )
    order = result.fetchone()
    if not order:
        return {"success": False, "result": f"Order {body.order_id} not found."}
    if order.status in {"DELIVERED", "COMPLETED", "CANCELLED"}:
        return {"success": False, "result": f"Order is already {order.status} and cannot be cancelled here."}

    await db.execute(
        text("UPDATE orders SET status = 'CANCELLED' WHERE id = :oid"),
        {"oid": body.order_id},
    )
    await db.commit()
    return {"success": True, "result": f"Cancelled order {body.order_id}. Refunds are not handled by this tool."}

