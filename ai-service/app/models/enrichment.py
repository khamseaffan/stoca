from pydantic import BaseModel


class EnrichRequest(BaseModel):
    """Product enrichment request."""

    name: str
    price: float | None = None
    category: str | None = None


class EnrichResponse(BaseModel):
    """Enriched product data."""

    description: str
    category: str
    subcategory: str
    tags: list[str]
