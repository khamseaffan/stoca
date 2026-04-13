import logging

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.vision import IdentifiedProduct

logger = logging.getLogger(__name__)

_MATCH_QUERY = text(
    "SELECT id, name FROM global_products "
    "WHERE name ILIKE :name OR brand ILIKE :brand "
    "LIMIT 3"
)


async def match_to_catalog(
    products: list[IdentifiedProduct],
    db: AsyncSession,
) -> list[IdentifiedProduct]:
    """Match identified products against the global_products catalog.

    For each identified product, queries the global_products table using
    case-insensitive partial matching on the product name and brand. If a
    match is found, sets the ``matched_global_product_id`` field to the
    ID of the first matching catalog entry.

    Args:
        products: A list of products identified from an inventory scan
            image via Claude Vision.
        db: An async SQLAlchemy database session for executing queries.

    Returns:
        The same list of IdentifiedProduct instances, updated in place
        with ``matched_global_product_id`` set for any products that
        matched a catalog entry.
    """
    for product in products:
        try:
            result = await db.execute(
                _MATCH_QUERY,
                {
                    "name": f"%{product.name}%",
                    "brand": f"%{product.brand or ''}%",
                },
            )
            rows = result.fetchall()

            if rows:
                product.matched_global_product_id = str(rows[0].id)
                logger.info(
                    "Matched '%s' to catalog product '%s' (id=%s)",
                    product.name,
                    rows[0].name,
                    rows[0].id,
                )
            else:
                logger.debug("No catalog match found for '%s'", product.name)

        except Exception:
            logger.exception(
                "Database error while matching product '%s'", product.name
            )
            continue

    return products
