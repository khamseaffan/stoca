import json
import logging

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.middleware.auth import Store, get_verified_store
from app.routers.tool_models import ScanInventoryReq
from app.vision.inventory_scanner import scan_image
from app.vision.product_matcher import match_to_catalog

logger = logging.getLogger(__name__)
router = APIRouter()


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

