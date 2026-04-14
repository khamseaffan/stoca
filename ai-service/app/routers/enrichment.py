"""Product enrichment endpoint using Claude."""

from fastapi import APIRouter, Depends

from app.middleware.auth import Store, get_verified_store
from app.models.enrichment import EnrichRequest, EnrichResponse
from app.enrichment.product_enricher import enrich

router = APIRouter()


@router.post("/api/ai/enrich", response_model=EnrichResponse)
async def enrich_product(
    body: EnrichRequest,
    store: Store = Depends(get_verified_store),
) -> EnrichResponse:
    """Generate enriched product metadata using Claude.

    Takes a product name and optional price/category hints, returns a
    compelling description, inferred category, subcategory, and tags.
    """
    return await enrich(
        name=body.name,
        price=body.price,
        category=body.category,
    )
