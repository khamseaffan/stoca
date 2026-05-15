from datetime import datetime

from pydantic import BaseModel


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


class BulkStockUpdate(BaseModel):
    product_name: str
    quantity: int


class BulkUpdateStockReq(BaseModel):
    updates: list[BulkStockUpdate]


class MarkOutOfStockReq(BaseModel):
    product_name: str
    hide_product: bool = False


class RestockRecommendationsReq(BaseModel):
    days: int = 30
    limit: int = 20


class UpdateProductDetailsReq(BaseModel):
    product_name: str
    new_name: str | None = None
    description: str | None = None
    category: str | None = None
    subcategory: str | None = None
    compare_at_price: float | None = None


class SetProductAvailabilityReq(BaseModel):
    product_name: str
    is_available: bool


class SetFeaturedProductReq(BaseModel):
    product_name: str
    is_featured: bool


class UpdateLowStockThresholdReq(BaseModel):
    product_name: str
    threshold: int


class BulkUpdatePricesReq(BaseModel):
    product_names: list[str] | None = None
    category: str | None = None
    percent_change: float | None = None
    fixed_change: float | None = None
    set_price: float | None = None


class FindProductsMissingDataReq(BaseModel):
    filter: str = "all"


class SuggestProductCategoriesReq(BaseModel):
    limit: int = 50


class SetProductImagesBulkReq(BaseModel):
    filter: str = "missing_images"
    limit: int = 20


class DuplicateProductCheckReq(BaseModel):
    limit: int = 50


class UpdateStoreHoursReq(BaseModel):
    hours: dict


class UpdateStoreInfoReq(BaseModel):
    name: str | None = None
    description: str | None = None
    phone: str | None = None


class UpdateDeliverySettingsReq(BaseModel):
    pickup_enabled: bool | None = None
    delivery_enabled: bool | None = None
    delivery_radius_km: float | None = None
    delivery_fee: float | None = None
    minimum_order: float | None = None


class UpdateStoreAddressReq(BaseModel):
    street_address: str | None = None
    city: str | None = None
    state: str | None = None
    zipcode: str | None = None
    country: str | None = None
    latitude: float | None = None
    longitude: float | None = None


class SetStoreActiveStatusReq(BaseModel):
    is_active: bool


class UpdateStoreBrandingReq(BaseModel):
    logo_url: str | None = None
    banner_url: str | None = None


class CreatePromotionReq(BaseModel):
    title: str
    product_name: str | None = None
    discount_percent: float | None = None
    discount_amount: float | None = None
    start_date: datetime | None = None
    end_date: datetime | None = None


class PromotionLookupReq(BaseModel):
    promotion_id: str | None = None
    title: str | None = None


class ListPromotionsReq(BaseModel):
    status: str = "active"
    limit: int = 20


class UpdatePromotionReq(PromotionLookupReq):
    title_new: str | None = None
    product_name: str | None = None
    apply_store_wide: bool = False
    discount_percent: float | None = None
    discount_amount: float | None = None
    start_date: datetime | None = None
    end_date: datetime | None = None
    is_active: bool | None = None


class PromotionPerformanceReq(PromotionLookupReq):
    pass


class GetOrdersReq(BaseModel):
    limit: int = 10


class ListOrdersByStatusReq(BaseModel):
    status: str
    limit: int = 20


class GetOrderDetailsReq(BaseModel):
    order_id: str


class UpdateOrderStatusReq(BaseModel):
    order_id: str
    status: str


class FindDelayedOrdersReq(BaseModel):
    older_than_minutes: int = 60
    limit: int = 20


class AddOrderNoteReq(BaseModel):
    order_id: str
    note: str


class GetCustomerOrderHistoryReq(BaseModel):
    customer_email: str | None = None
    customer_name: str | None = None
    limit: int = 20


class CancelOrderReq(BaseModel):
    order_id: str


class SalesSummaryReq(BaseModel):
    period: str = "today"


class TopProductsReq(BaseModel):
    limit: int = 5


class CompareSalesPeriodsReq(BaseModel):
    period: str = "week"


class CategorySalesSummaryReq(BaseModel):
    period: str = "month"
    limit: int = 20


class FindStaleInventoryReq(BaseModel):
    days: int = 30
    limit: int = 20


class SlowMovingProductsReq(BaseModel):
    days: int = 30
    limit: int = 20


class CustomerSummaryReq(BaseModel):
    period: str = "month"
    limit: int = 10


class ScanInventoryReq(BaseModel):
    image_url: str


class SearchProductImageReq(BaseModel):
    product_name: str
    category: str | None = None


class EnrichProductDescriptionReq(BaseModel):
    product_name: str


class EnrichProductsBulkReq(BaseModel):
    filter: str = "all"  # "missing_images" | "missing_descriptions" | "all"
