import base64
import json
import logging

import anthropic
import httpx

from app.config import settings
from app.models.vision import IdentifiedProduct, InventoryScanResult

logger = logging.getLogger(__name__)

_VISION_PROMPT = (
    "Identify all retail products visible in this image. "
    "For each product, provide: product name, brand if visible, "
    "estimated quantity on shelf, confidence score 0-1. "
    "Return a JSON array of objects with keys: name, brand, "
    "estimated_quantity, confidence. Return ONLY the JSON array, no other text."
)


async def scan_image(image_url: str) -> InventoryScanResult:
    """Download an image and use Claude Vision to identify retail products.

    Fetches the image from the provided URL (typically a Supabase Storage
    signed URL), converts it to base64, and sends it to Claude Vision for
    product identification.

    Args:
        image_url: The URL of the inventory image to scan. Must be a
            publicly accessible or signed URL pointing to a JPEG/PNG image.

    Returns:
        An InventoryScanResult containing the list of identified products
        and an empty unmatched_items list (matching is done separately).

    Raises:
        httpx.HTTPStatusError: If the image download fails with a non-2xx
            status code.
        anthropic.APIError: If the Claude Vision API call fails.
    """
    try:
        image_data = await _download_image(image_url)
    except httpx.HTTPStatusError as exc:
        logger.error(
            "Failed to download image from %s: %s %s",
            image_url,
            exc.response.status_code,
            exc.response.text,
        )
        raise

    image_base64 = base64.b64encode(image_data).decode("utf-8")
    media_type = _infer_media_type(image_url)

    try:
        raw_json = await _call_claude_vision(image_base64, media_type)
    except anthropic.APIError:
        logger.exception("Claude Vision API call failed for image: %s", image_url)
        raise

    products = _parse_vision_response(raw_json)

    return InventoryScanResult(
        identified_products=products,
        unmatched_items=[],
    )


async def _download_image(url: str) -> bytes:
    """Download image bytes from a URL.

    Args:
        url: The image URL to download.

    Returns:
        The raw bytes of the downloaded image.
    """
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.get(url)
        response.raise_for_status()
        return response.content


def _infer_media_type(url: str) -> str:
    """Infer the MIME type from the image URL extension.

    Args:
        url: The image URL.

    Returns:
        A MIME type string. Defaults to ``image/jpeg`` if the extension
        is not recognized.
    """
    lower = url.lower().split("?")[0]
    if lower.endswith(".png"):
        return "image/png"
    if lower.endswith(".webp"):
        return "image/webp"
    if lower.endswith(".gif"):
        return "image/gif"
    return "image/jpeg"


async def _call_claude_vision(image_base64: str, media_type: str) -> str:
    """Send a base64-encoded image to Claude Vision for product identification.

    Args:
        image_base64: The base64-encoded image data.
        media_type: The MIME type of the image (e.g. ``image/jpeg``).

    Returns:
        The raw text response from Claude containing a JSON array of
        identified products.
    """
    client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)

    message = await client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=1024,
        messages=[
            {
                "role": "user",
                "content": [
                    {
                        "type": "image",
                        "source": {
                            "type": "base64",
                            "media_type": media_type,
                            "data": image_base64,
                        },
                    },
                    {
                        "type": "text",
                        "text": _VISION_PROMPT,
                    },
                ],
            }
        ],
    )

    return message.content[0].text


def _parse_vision_response(raw_json: str) -> list[IdentifiedProduct]:
    """Parse the Claude Vision JSON response into a list of IdentifiedProduct.

    Handles cases where Claude wraps the JSON in markdown code fences.

    Args:
        raw_json: The raw text response from Claude Vision.

    Returns:
        A list of IdentifiedProduct instances parsed from the response.
        Returns an empty list if parsing fails.
    """
    cleaned = raw_json.strip()
    if cleaned.startswith("```"):
        lines = cleaned.split("\n")
        lines = lines[1:]  # Remove opening fence (e.g. ```json)
        if lines and lines[-1].strip() == "```":
            lines = lines[:-1]
        cleaned = "\n".join(lines).strip()

    try:
        items = json.loads(cleaned)
    except json.JSONDecodeError:
        logger.error("Failed to parse Claude Vision response as JSON: %s", raw_json)
        return []

    products: list[IdentifiedProduct] = []
    for item in items:
        try:
            products.append(
                IdentifiedProduct(
                    name=item["name"],
                    brand=item.get("brand"),
                    estimated_quantity=item.get("estimated_quantity"),
                    confidence=item["confidence"],
                )
            )
        except (KeyError, TypeError, ValueError) as exc:
            logger.warning("Skipping malformed product entry %s: %s", item, exc)
            continue

    return products
