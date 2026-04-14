from pydantic import BaseModel


class IdentifiedProduct(BaseModel):
    """A product identified from an inventory scan image."""

    name: str
    brand: str | None = None
    estimated_quantity: int | None = None
    confidence: float
    matched_global_product_id: str | None = None


class InventoryScanResult(BaseModel):
    """Result of scanning an inventory image."""

    identified_products: list[IdentifiedProduct]
    unmatched_items: list[str]
