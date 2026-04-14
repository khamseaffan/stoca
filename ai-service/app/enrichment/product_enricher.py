import json
import logging

import anthropic

from app.config import settings
from app.models.enrichment import EnrichResponse

logger = logging.getLogger(__name__)

_ENRICH_PROMPT = (
    "Generate a product listing for: {name}. "
    "Price: {price}. Category: {category}. "
    "Return JSON with keys: description (2 compelling sentences for a local "
    "store listing), category, subcategory, tags (list of 3-5 relevant tags). "
    "Return ONLY the JSON object, no other text."
)


async def enrich(
    name: str,
    price: float | None = None,
    category: str | None = None,
) -> EnrichResponse:
    """Generate enriched product metadata using Claude.

    Calls Claude to generate a compelling description, inferred category,
    subcategory, and tags for a product based on its name and optional
    price/category hints.

    Args:
        name: The product name to enrich.
        price: Optional price hint for context.
        category: Optional category hint for context.

    Returns:
        An EnrichResponse with generated description, category, subcategory,
        and tags. Returns a basic fallback response if the API call fails.
    """
    prompt = _ENRICH_PROMPT.format(
        name=name,
        price=f"${price:.2f}" if price else "unknown",
        category=category or "unknown",
    )

    try:
        client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)
        message = await client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=512,
            messages=[{"role": "user", "content": prompt}],
        )

        raw = message.content[0].text.strip()
        if raw.startswith("```"):
            lines = raw.split("\n")
            lines = lines[1:]
            if lines and lines[-1].strip() == "```":
                lines = lines[:-1]
            raw = "\n".join(lines).strip()

        data = json.loads(raw)
        return EnrichResponse(
            description=data["description"],
            category=data["category"],
            subcategory=data["subcategory"],
            tags=data["tags"],
        )
    except Exception:
        logger.exception("Failed to enrich product: %s", name)
        return EnrichResponse(
            description=f"{name} — available at your local store.",
            category=category or "General",
            subcategory="Other",
            tags=[name.lower()],
        )
