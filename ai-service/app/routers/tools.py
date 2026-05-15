"""Tool endpoints called by Next.js on behalf of Claude's tool calls.

Every endpoint requires JWT auth via Depends(get_verified_store) and returns
{"success": bool, "result": str}. Tool handlers live in grouped modules under
app.routers.tool_modules.
"""

from fastapi import APIRouter

from app.routers.tool_modules import analytics, enrichment, orders, products, promotions, store, vision

router = APIRouter()

for module in (products, store, promotions, orders, analytics, vision, enrichment):
    router.include_router(module.router)
