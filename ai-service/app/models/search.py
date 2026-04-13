from pydantic import BaseModel


class SearchRequest(BaseModel):
    """Semantic search request."""

    query: str
    store_id: str | None = None
    category: str | None = None
    limit: int = 20


class SearchResult(BaseModel):
    """Single search result."""

    product_id: str
    store_id: str
    store_name: str
    product_name: str
    price: float
    image_url: str | None = None
    score: float
